/**
 * Modelos de dominio de Impulso.
 * Espejo exacto del esquema de Supabase (supabase_schema.sql).
 */

export type Category =
  | 'comida'
  | 'transporte_flete'
  | 'agro_mercado'
  | 'hoteles_turismo'
  | 'salud_belleza'
  | 'hogar_construccion'
  | 'servicios_comercios';

export type OfferStatus = 'active' | 'sold_out' | 'expired' | 'cancelled';
export type ReservationStatus = 'pending' | 'completed' | 'released';
export type UserRole = 'merchant' | 'admin';

/** Modalidad de entrega segura elegida por el comerciante. */
export type DeliveryType = 'local_fisico' | 'parque_principal' | 'domicilio';

export const DELIVERY_TYPES: readonly { id: DeliveryType; label: string; emoji: string }[] = [
  { id: 'local_fisico', label: 'En el local comercial', emoji: '🏪' },
  { id: 'parque_principal', label: 'Parque Principal / Zona Central', emoji: '🌳' },
  { id: 'domicilio', label: 'Domicilio a la puerta', emoji: '🛵' },
] as const;

export function deliveryMeta(id: string): { id: DeliveryType; label: string; emoji: string } {
  return DELIVERY_TYPES.find((d) => d.id === id) ?? DELIVERY_TYPES[0];
}

export interface CategoryMeta {
  id: Category;
  label: string;
  emoji: string;
}

export const CATEGORIES: readonly CategoryMeta[] = [
  { id: 'comida', label: 'Comida y Bebidas', emoji: '🍽️' },
  { id: 'transporte_flete', label: 'Transporte y Flete', emoji: '🚚' },
  { id: 'agro_mercado', label: 'Agro y Mercado', emoji: '🌱' },
  { id: 'hoteles_turismo', label: 'Hoteles y Turismo', emoji: '🏨' },
  { id: 'salud_belleza', label: 'Salud y Belleza', emoji: '💄' },
  { id: 'hogar_construccion', label: 'Hogar y Construcción', emoji: '🏠' },
  { id: 'servicios_comercios', label: 'Otros Servicios', emoji: '🛠️' },
] as const;

export function categoryMeta(id: Category): CategoryMeta {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];
}

export interface Municipio {
  name: string;
  lat: number;
  lng: number;
}

/** Municipios de lanzamiento (Cundinamarca, Colombia). */
export const MUNICIPIOS: readonly Municipio[] = [
  { name: 'Gachetá', lat: 4.8167, lng: -73.6333 },
  { name: 'Junín', lat: 4.85, lng: -73.6167 },
  { name: 'Ubalá', lat: 4.7833, lng: -73.7333 },
  { name: 'Gama', lat: 4.8, lng: -73.5667 },
  { name: 'Gachalá', lat: 4.8833, lng: -73.5667 },
] as const;

export function municipioCenter(name: string): Municipio {
  return MUNICIPIOS.find((m) => m.name === name) ?? MUNICIPIOS[0];
}

/** Resumen público del comercio (join embebido de Supabase). */
export interface MerchantSummary {
  id: string;
  business_name: string;
  is_verified: boolean;
  is_active: boolean;
  is_suspended: boolean;
  category: Category;
  whatsapp: string;
  municipality: string;
  logo_thumb: string | null;
  rating_sum: number;
  rating_count: number;
}

export interface Profile {
  id: string;
  role: UserRole;
  business_name: string;
  category: Category;
  whatsapp: string;
  municipality: string;
  address_reference: string | null;
  lat: number | null;
  lng: number | null;
  credits: number;
  is_verified: boolean;
  is_active: boolean;
  is_suspended: boolean;
  logo_thumb: string | null;
  /** Datos de confianza para la auditoría IA del administrador (recomendados). */
  nit_or_cedula: string | null;
  social_or_maps_link: string | null;
  rating_sum: number;
  rating_count: number;
  accepted_terms_at: string;
  created_at: string;
}

export interface Offer {
  id: string;
  merchant_id: string;
  category: Category;
  title: string;
  description: string;
  emoji_icon: string;
  original_price: number | null;
  promo_price: number;
  total_quota: number;
  available_quota: number;
  municipality: string;
  lat: number;
  lng: number;
  expires_at: string;
  status: OfferStatus;
  views_count: number;
  image_thumb: string | null;
  delivery_type: DeliveryType;
  reports_count: number;
  created_at: string;
  /** Embebido al consultar con join (opcional según la consulta). */
  merchant?: MerchantSummary;
}

export interface Reservation {
  id: string;
  offer_id: string;
  merchant_id: string;
  customer_name: string;
  customer_phone: string;
  quantity: number;
  customer_note: string;
  reservation_code: string;
  status: ReservationStatus;
  is_rated: boolean;
  /** Trazabilidad forense (solo visible para el comercio y el admin). */
  client_ip: string | null;
  device_id: string | null;
  created_at: string;
}

/** Reserva como la ve el comerciante (con datos de la oferta embebidos). */
export interface MerchantReservation extends Reservation {
  offer?: Pick<Offer, 'id' | 'title' | 'emoji_icon' | 'promo_price'>;
}

/** Puntos de encuentro seguros para los pedidos de la comunidad. */
export type MeetingPoint = 'parque_principal' | 'local_comercio' | 'domicilio_urbano' | 'vereda';

export const MEETING_POINTS: readonly { id: MeetingPoint; label: string; emoji: string }[] = [
  { id: 'parque_principal', label: 'Parque Principal / Casco Urbano (Zona pública)', emoji: '🏛️' },
  { id: 'local_comercio', label: 'Recojo directamente en el local del comerciante', emoji: '🏪' },
  { id: 'domicilio_urbano', label: 'Domicilio en casco urbano (Pago contra entrega)', emoji: '🏠' },
  { id: 'vereda', label: 'Vereda (Solo con transportador o vecino conocido)', emoji: '🚜' },
] as const;

export function meetingPointMeta(id: string): { id: MeetingPoint; label: string; emoji: string } {
  return MEETING_POINTS.find((m) => m.id === id) ?? MEETING_POINTS[0];
}

export interface QuickRequest {
  id: string;
  customer_name: string;
  customer_whatsapp: string;
  municipality: string;
  category: Category;
  need_description: string;
  meeting_point: MeetingPoint;
  client_ip: string | null;
  device_id: string | null;
  expires_at: string;
  created_at: string;
}

/**
 * Ticket local del cliente (persistido en el dispositivo; el cliente
 * no requiere cuenta para apartar).
 */
export interface Ticket {
  reservationId: string;
  code: string;
  offerId: string;
  offerTitle: string;
  offerEmoji: string;
  promoPrice: number;
  quantity: number;
  customerName: string;
  merchantId: string;
  merchantName: string;
  merchantWhatsapp: string;
  status: ReservationStatus;
  isRated: boolean;
  createdAt: number;
}

/** Respuesta estructurada de la IA para el Creador Mágico. */
export interface ParsedPromo {
  category: Category;
  title: string;
  description: string;
  emoji_icon: string;
  original_price: number | null;
  promo_price: number;
  total_quota: number;
  duration_hours: number;
}

/** Formulario del Creador de Ofertas del comerciante. */
export interface OfferForm {
  emoji_icon: string;
  category: Category;
  title: string;
  description: string;
  original_price: string;
  promo_price: string;
  total_quota: string;
  duration_hours: number;
  /** Foto micro-WebP (< 20 KB) opcional, comprimida en el navegador. */
  image_thumb: string | null;
  delivery_type: DeliveryType;
}

export const DURATION_OPTIONS: readonly { hours: number; label: string }[] = [
  { hours: 0.5, label: '30 minutos (relámpago)' },
  { hours: 1, label: '1 hora' },
  { hours: 3, label: '3 horas' },
  { hours: 6, label: '6 horas' },
  { hours: 12, label: '12 horas' },
  { hours: 24, label: '24 horas (1 día)' },
  { hours: 48, label: '2 días' },
  { hours: 72, label: '3 días' },
  { hours: 96, label: '4 días' },
] as const;
