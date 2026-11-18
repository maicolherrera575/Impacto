import { supabase } from './supabase';
import { computeDeviceFingerprintSha256, getDeviceId } from './deviceFingerprint';
import { getEdgeClientIp } from './ip.service';
import { pruneStorageUrls } from './storagePruning.service';
import { validateOfferSecurity } from '../utils/securityFilter';
import type { Category, Offer } from '../types';

const MERCHANT_EMBED =
  'merchant:merchant_id (id, business_name, is_verified, lifetime_orders_count, is_active, is_suspended, category, whatsapp, municipality, logo_thumb, rating_sum, rating_count)';

/** Ofertas activas y vigentes (para el radar público). */
export async function fetchActiveOffers(municipality?: string): Promise<Offer[]> {
  let query = supabase
    .from('offers')
    .select(`*, ${MERCHANT_EMBED}`)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(100);

  if (municipality) {
    query = query.eq('municipality', municipality);
  }

  const { data, error } = await query;
  if (error) throw error;
  // Moderación: nunca mostramos ofertas de cuentas suspendidas o desactivadas
  return ((data ?? []) as unknown as Offer[]).filter(
    (o) => o.merchant?.is_active !== false && o.merchant?.is_suspended !== true
  );
}

/** Oferta individual (deep links: ?oferta=UUID). */
export async function fetchOfferById(offerId: string): Promise<Offer | null> {
  const { data, error } = await supabase
    .from('offers')
    .select(`*, ${MERCHANT_EMBED}`)
    .eq('id', offerId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as Offer) ?? null;
}

/**
 * V13 · Ofertas activas y vigentes de UN comercio (Perfil Público ?comercio=).
 * Mismo blindaje de moderación que el radar: nunca cuentas suspendidas.
 */
export async function fetchActiveOffersByMerchant(merchantId: string): Promise<Offer[]> {
  const { data, error } = await supabase
    .from('offers')
    .select(`*, ${MERCHANT_EMBED}`)
    .eq('merchant_id', merchantId)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return ((data ?? []) as unknown as Offer[]).filter(
    (o) => o.merchant?.is_active !== false && o.merchant?.is_suspended !== true
  );
}

/** Historial del comerciante: sus últimas 10 ofertas (para republicar en 1 clic). */
export async function fetchMerchantOffers(merchantId: string): Promise<Offer[]> {
  const { data, error } = await supabase
    .from('offers')
    .select('*')
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
 * atómica y ejecuta la auto-purga inteligente en el servidor.
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
  const { data, error } = await supabase.rpc('publish_offer_rpc', baseParams);
  if (error) throw error;
  const created = data as unknown as Offer;
  if (created?.id && deviceFp) {
    // Registra silenciosamente la huella forense SHA-256 en la oferta creada
    void supabase.from('offers').update({ device_id: deviceFp }).eq('id', created.id).then(() => undefined, () => undefined);
  }
  return created;
}

export interface ReportResult {
  reports: number;
  cancelled: boolean;
  /** true = este dispositivo o IP ya había reportado la oferta (no se vuelve a sumar). */
  already: boolean;
  verifiedBuyer?: boolean;
  underReview?: boolean;
}

/**
 * Reporte comunitario con motivo y blindaje anti-envidia:
 * el servidor deduplica por dispositivo e IP pública, verifica si el reportante
 * apartó realmente y protege a los comercios verificados de sabotajes por envidia.
 */
export async function reportOffer(
  offerId: string,
  reason: string,
  detail?: string | null
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
    () => undefined
  );
}

/**
 * Auto-compactación silenciosa: marca ofertas vencidas y borra pedidos
 * viejos de la comunidad (la app la llama 1 vez cada 12 horas).
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
