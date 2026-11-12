import { supabase } from './supabase';
import type { Category, Offer } from '../types';

const MERCHANT_EMBED =
  'merchant:merchant_id (id, business_name, is_verified, is_active, is_suspended, category, whatsapp, municipality, logo_thumb, rating_sum, rating_count)';

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
  const { data, error } = await supabase.rpc('publish_offer_rpc', {
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
  });
  if (error) throw error;
  return data as unknown as Offer;
}

/** Reporte comunitario: 3 reportes tumban la oferta automáticamente. */
export async function reportOffer(offerId: string): Promise<{ reports: number; cancelled: boolean }> {
  const { data, error } = await supabase.rpc('report_offer_rpc', { p_offer_id: offerId });
  if (error) throw error;
  return data as unknown as { reports: number; cancelled: boolean };
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
  const { data, error } = await supabase.rpc('auto_prune_expired_data_rpc');
  if (error) throw error;
  return data as unknown as { offers_expired: number; requests_deleted: number };
}
