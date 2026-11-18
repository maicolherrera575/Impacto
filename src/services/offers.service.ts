import { supabase } from './supabase';
import { computeDeviceFingerprintSha256, getDeviceId } from './deviceFingerprint';
import { getEdgeClientIp } from './ip.service';
import { pruneStorageUrls } from './storagePruning.service';
import { validateOfferSecurity } from '../utils/securityFilter';
import type { Category, Offer } from '../types';

const MERCHANT_EMBED =
  'merchant:merchant_id (id, business_name, is_verified, trust_level, lifetime_orders_count, is_active, is_suspended, category, whatsapp, municipality, logo_thumb, rating_sum, rating_count)';

/** Proyección explícita de columnas públicas (cero SELECT * innecesarios). */
const OFFER_PUBLIC_SELECT = [
  'id',
  'merchant_id',
  'category',
  'title',
  'description',
  'emoji_icon',
  'original_price',
  'promo_price',
  'total_quota',
  'available_quota',
  'municipality',
  'lat',
  'lng',
  'expires_at',
  'status',
  'views_count',
  'image_thumb',
  'delivery_type',
  'reports_count',
  'created_at',
  MERCHANT_EMBED,
].join(', ');

const MERCHANT_HISTORY_SELECT =
  'id, merchant_id, category, title, description, emoji_icon, original_price, promo_price, total_quota, available_quota, municipality, lat, lng, expires_at, status, views_count, image_thumb, delivery_type, reports_count, created_at';

/** ⚡ Caché en memoria (TTL 30s) para proteger el Free Tier de Supabase bajo ráfagas. */
const FEED_CACHE_TTL_MS = 30_000;
const feedCache = new Map<string, { at: number; data: Offer[] }>();

export function invalidateOffersFeedCache(): void {
  feedCache.clear();
}

/** Ofertas activas y vigentes (Edge CDN cacheado 30s + caché cliente 30s + fallback directo Supabase). */
export async function fetchActiveOffers(municipality?: string, opts?: { forceFresh?: boolean }): Promise<Offer[]> {
  const cacheKey = (municipality ?? '__ALL__').trim();
  const now = Date.now();
  if (!opts?.forceFresh) {
    const cached = feedCache.get(cacheKey);
    if (cached && now - cached.at < FEED_CACHE_TTL_MS) {
      return cached.data;
    }

    // 1) Intentar primero el endpoint público Edge-cacheado (/api/public-offers)
    try {
      const qs = municipality ? `?municipality=${encodeURIComponent(municipality)}&limit=80` : '?limit=80';
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = ctrl ? window.setTimeout(() => ctrl.abort(), 3_500) : null;
      try {
        const res = await fetch(`/api/public-offers${qs}`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: ctrl?.signal,
        });
        if (res.ok) {
          const json = (await res.json().catch(() => null)) as { offers?: Offer[] } | null;
          if (Array.isArray(json?.offers)) {
            feedCache.set(cacheKey, { at: now, data: json.offers });
            return json.offers;
          }
        }
      } finally {
        if (timer != null) window.clearTimeout(timer);
      }
    } catch {
      /* fallback instantáneo a Supabase directo */
    }
  }

  // 2) Consulta directa con columnas explícitas (usada tras Realtime o fallback local)
  let query = supabase
    .from('offers')
    .select(OFFER_PUBLIC_SELECT)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(80);

  if (municipality) {
    query = query.eq('municipality', municipality);
  }

  const { data, error } = await query;
  if (error) throw error;
  const filtered = ((data ?? []) as unknown as Offer[]).filter(
    (o) => o.merchant?.is_active !== false && o.merchant?.is_suspended !== true,
  );
  feedCache.set(cacheKey, { at: Date.now(), data: filtered });
  return filtered;
}

/** Oferta individual (deep links: ?oferta=UUID). */
export async function fetchOfferById(offerId: string): Promise<Offer | null> {
  const { data, error } = await supabase
    .from('offers')
    .select(OFFER_PUBLIC_SELECT)
    .eq('id', offerId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as Offer) ?? null;
}

/**
 * V13 · Ofertas activas y vigentes de UN comercio (Perfil Público ?comercio=).
 */
export async function fetchActiveOffersByMerchant(merchantId: string): Promise<Offer[]> {
  const { data, error } = await supabase
    .from('offers')
    .select(OFFER_PUBLIC_SELECT)
    .eq('merchant_id', merchantId)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(40);
  if (error) throw error;
  return ((data ?? []) as unknown as Offer[]).filter(
    (o) => o.merchant?.is_active !== false && o.merchant?.is_suspended !== true,
  );
}

/** Historial del comerciante: sus últimas 10 ofertas (para republicar en 1 clic). */
export async function fetchMerchantOffers(merchantId: string): Promise<Offer[]> {
  const { data, error } = await supabase
    .from('offers')
    .select(MERCHANT_HISTORY_SELECT)
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) throw error;
  return (data ?? []) as unknown as Offer[];
}

export interface PublishOfferInput {
  category: Category;
  title: string;
  description: string;
  emojiIcon: string;
  originalPrice: number | null;
  promoPrice: number;
  totalQuota: number;
  durationHours: number;
  municipality: string;
  lat: number | null;
  lng: number | null;
  imageThumb?: string | null;
  deliveryType?: import('../types').DeliveryType;
}

/**
 * Publica una oferta vía RPC transaccional: descuenta 1 crédito de forma
 * atómica, registra la huella de hardware SHA-256 y ejecuta la auto-purga.
 */
export async function publishOffer(input: PublishOfferInput): Promise<Offer> {
  const sec = validateOfferSecurity(`${input.title} ${input.description}`);
  if (!sec.ok) {
    throw new Error(sec.reason);
  }
  const deviceFp = await computeDeviceFingerprintSha256();
  const baseParams = {
    p_category: input.category,
    p_title: input.title,
    p_description: input.description,
    p_emoji_icon: input.emojiIcon,
    p_original_price: input.originalPrice,
    p_promo_price: input.promoPrice,
    p_total_quota: input.totalQuota,
    p_duration_hours: input.durationHours,
    p_municipality: input.municipality,
    p_lat: input.lat,
    p_lng: input.lng,
    p_image_thumb: input.imageThumb ?? null,
    p_delivery_type: input.deliveryType ?? 'local_fisico',
  };

  let { data, error } = await supabase.rpc('publish_offer_rpc', {
    ...baseParams,
    p_device_id: deviceFp || getDeviceId(),
  });
  if (error && ((error as { code?: string }).code === 'PGRST202' || /could not find the function/i.test(error.message ?? ''))) {
    const retry = await supabase.rpc('publish_offer_rpc', baseParams);
    data = retry.data;
    error = retry.error;
  }
  if (error) throw error;
  invalidateOffersFeedCache();
  return data as unknown as Offer;
}

export interface ReportResult {
  reports: number;
  cancelled: boolean;
  /** true = este dispositivo o IP ya había reportado la oferta (no se vuelve a sumar). */
  already: boolean;
  verifiedBuyer?: boolean;
  underReview?: boolean;
}

export async function reportOffer(
  offerId: string,
  reason: string,
  detail?: string | null,
): Promise<ReportResult> {
  const [edgeIp, deviceFp] = await Promise.all([getEdgeClientIp(), computeDeviceFingerprintSha256()]);
  const baseParams = {
    p_offer_id: offerId,
    p_reason: reason,
    p_detail: detail ?? null,
    p_device_id: deviceFp || getDeviceId(),
  };
  let { data, error } = await supabase.rpc('report_offer_rpc', {
    ...baseParams,
    p_edge_ip: edgeIp,
  });
  if (error && ((error as { code?: string }).code === 'PGRST202' || /could not find the function/i.test(error.message ?? ''))) {
    const retry = await supabase.rpc('report_offer_rpc', baseParams);
    data = retry.data;
    error = retry.error;
  }
  if (error) throw error;
  const result = data as unknown as ReportResult;
  if (result.cancelled) {
    invalidateOffersFeedCache();
    void supabase
      .from('offers')
      .select('image_thumb')
      .eq('id', offerId)
      .maybeSingle()
      .then(({ data: row }) => pruneStorageUrls([(row as { image_thumb?: string | null } | null)?.image_thumb]), () => undefined);
  }
  return result;
}

/** Incremento atómico de vistas (fire-and-forget). */
export function incrementViews(offerId: string): void {
  void supabase.rpc('increment_offer_views_rpc', { p_offer_id: offerId }).then(
    ({ error }) => {
      if (error) console.warn('[Impulso] No se pudo registrar la vista', error.message);
    },
    () => undefined,
  );
}

/**
 * Auto-compactación silenciosa: marca ofertas vencidas, poda GPS > 7 días (Ley 1581)
 * y borra pedidos viejos de la comunidad (1 vez cada 12 horas).
 */
export async function autoPruneData(): Promise<{ offers_expired: number; requests_deleted: number }> {
  try {
    const { data: expiredOffers } = await supabase
      .from('offers')
      .select('image_thumb')
      .lt('expires_at', new Date().toISOString())
      .not('image_thumb', 'is', null)
      .limit(60);
    if (Array.isArray(expiredOffers) && expiredOffers.length > 0) {
      await pruneStorageUrls(expiredOffers.map((o) => (o as { image_thumb?: string | null }).image_thumb));
    }
  } catch {
    /* best-effort Storage pruning */
  }
  const { data, error } = await supabase.rpc('auto_prune_expired_data_rpc');
  if (error) throw error;
  return data as unknown as { offers_expired: number; requests_deleted: number };
}
