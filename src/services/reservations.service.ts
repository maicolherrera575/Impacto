import { supabase } from './supabase';
import { getDeviceId } from './deviceFingerprint';
import type { MerchantReservation, Offer, Profile, Reservation, ReservationStatus } from '../types';

export interface ReserveResult {
  reservation: Reservation;
  offer: Offer;
  merchant: Profile;
}

export interface ReserveInput {
  offerId: string;
  customerName: string;
  customerPhone: string;
  quantity: number;
  customerNote: string;
}

/**
 * Aparta una oferta vía RPC transaccional: bloqueo pesimista de fila,
 * descuento atómico de cupos, generación del código de ticket y trazabilidad
 * forense (la IP la captura el servidor; la huella del dispositivo viaja aquí).
 */
export async function reserveOffer(input: ReserveInput): Promise<ReserveResult> {
  const { data, error } = await supabase.rpc('reserve_offer_rpc', {
    p_offer_id: input.offerId,
    p_customer_name: input.customerName,
    p_customer_phone: input.customerPhone,
    p_quantity: input.quantity,
    p_customer_note: input.customerNote,
    p_device_id: getDeviceId(),
  });
  if (error) throw error;
  return data as unknown as ReserveResult;
}

/** Reservas del comerciante con los datos de su oferta embebidos. */
export async function fetchMerchantReservations(merchantId: string): Promise<MerchantReservation[]> {
  const { data, error } = await supabase
    .from('reservations')
    .select('*, offer:offer_id (id, title, emoji_icon, promo_price)')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as unknown as MerchantReservation[];
}

/** El comerciante marca como entregada o libera el stock (cliente no asistió). */
export async function updateReservation(
  reservationId: string,
  action: 'completed' | 'released'
): Promise<Reservation> {
  const { data, error } = await supabase.rpc('merchant_update_reservation_rpc', {
    p_reservation_id: reservationId,
    p_action: action,
  });
  if (error) throw error;
  const payload = data as unknown as { reservation: Reservation };
  return payload.reservation;
}

/** Calificación con estrellas del cliente (sin cuenta, vía código de ticket). */
export async function rateReservation(reservationId: string, code: string, stars: number): Promise<void> {
  const { error } = await supabase.rpc('rate_reservation_rpc', {
    p_reservation_id: reservationId,
    p_code: code,
    p_stars: stars,
  });
  if (error) throw error;
}

/**
 * Cancela un apartado pendiente (el cliente cambió de opinión): la RPC
 * verifica id + código y devuelve el stock al comerciante automáticamente.
 */
export async function cancelMyReservation(
  reservationId: string,
  code: string
): Promise<{ reservation: Reservation; offer: Offer | null }> {
  const { data, error } = await supabase.rpc('cancel_my_reservation_rpc', {
    p_reservation_id: reservationId,
    p_reservation_code: code,
  });
  if (error) throw error;
  return data as unknown as { reservation: Reservation; offer: Offer | null };
}

export interface TicketStatusRow {
  id: string;
  status: ReservationStatus;
  is_rated: boolean;
}

/**
 * Estado en vivo de los tickets del dispositivo: cómo los tickets viven
 * en localStorage y el cliente no tiene cuenta, consultamos por lotes
 * con un RPC de solo lectura (equivalente a Realtime para anónimos).
 */
export async function fetchTicketStatuses(reservationIds: string[]): Promise<TicketStatusRow[]> {
  if (reservationIds.length === 0) return [];
  const { data, error } = await supabase.rpc('check_reservation_status_rpc', {
    p_ids: reservationIds,
  });
  if (error) throw error;
  return (data ?? []) as unknown as TicketStatusRow[];
}

/** El comerciante bloquea a un cliente que sabotea sus ofertas. */
export async function blockAbusiveClient(input: {
  deviceId?: string | null;
  clientIp?: string | null;
  phone?: string | null;
  reason?: string;
}): Promise<void> {
  const { error } = await supabase.rpc('merchant_block_client_rpc', {
    p_device_id: input.deviceId ?? null,
    p_client_ip: input.clientIp ?? null,
    p_phone: input.phone ?? null,
    p_reason: input.reason ?? 'Reserva abusiva',
  });
  if (error) throw error;
}

export type { ReservationStatus };
