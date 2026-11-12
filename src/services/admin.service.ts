import { supabase } from './supabase';
import type { Profile } from '../types';

/**
 * Directorio completo de cuentas para el panel del administrador:
 * incluye comercios Y la propia cuenta admin (👑 primero), para que el
 * administrador pueda recargarse créditos y probar el flujo completo.
 */
export async function fetchMerchants(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('business_name', { ascending: true });
  if (error) throw error;
  const list = (data ?? []) as unknown as Profile[];
  // La cuenta admin siempre de primero con su corona
  return [...list].sort((a, b) => Number(b.role === 'admin') - Number(a.role === 'admin'));
}

export interface AdminStats {
  merchants: number;
  activeOffers: number;
  pendingReservations: number;
}

/** Métricas en vivo del ecosistema para la cabecera del panel. */
export async function fetchAdminStats(): Promise<AdminStats> {
  const [merchantsRes, offersRes, reservationsRes] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'merchant'),
    supabase
      .from('offers')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString()),
    supabase.from('reservations').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);

  return {
    merchants: merchantsRes.count ?? 0,
    activeOffers: offersRes.count ?? 0,
    pendingReservations: reservationsRes.count ?? 0,
  };
}

/** Recarga créditos, verifica o suspende comercios (RPC exclusiva admin). */
export async function manageMerchant(
  merchantId: string,
  addCredits: number,
  verify: boolean | null,
  active: boolean | null = null
): Promise<Profile> {
  const { data, error } = await supabase.rpc('admin_manage_merchant_rpc', {
    p_merchant_id: merchantId,
    p_add_credits: addCredits,
    p_verify: verify,
    p_active: active,
  });
  if (error) throw error;
  const payload = data as unknown as { profile: Profile };
  return payload.profile;
}

/** Kill-switch: borra al instante una oferta peligrosa o fraudulenta (admin). */
export async function adminDeleteOffer(offerId: string): Promise<void> {
  const { data, error } = await supabase.rpc('admin_delete_offer_rpc', { p_offer_id: offerId });
  if (error) throw error;
  void data;
}

/** Purga TODAS las ofertas vencidas para mantener la base liviana (admin). */
export async function adminCleanupExpired(): Promise<number> {
  const { data, error } = await supabase.rpc('admin_cleanup_expired_rpc');
  if (error) throw error;
  const payload = data as unknown as { deleted: number };
  return payload.deleted;
}

/**
 * Métricas reales del ecosistema vía RPC security definer (cruza el RLS
 * del admin para contar reservas de TODOS los comercios).
 */
export async function fetchAdminStatsRpc(): Promise<AdminStats & { verifiedMerchants: number; reservationsToday: number; openReports: number }> {
  const { data, error } = await supabase.rpc('admin_stats_rpc');
  if (error) throw error;
  return data as unknown as AdminStats & { verifiedMerchants: number; reservationsToday: number; openReports: number };
}

/** Fila de trazabilidad forense para la pestaña de Moderación. */
export interface ForensicReservation {
  id: string;
  offer_id: string;
  merchant_id: string;
  merchant_name: string | null;
  customer_name: string;
  customer_phone: string;
  quantity: number;
  reservation_code: string;
  status: string;
  client_ip: string | null;
  device_id: string | null;
  /** Coordenadas GPS silenciosas (null si el usuario no compartió ubicación). */
  client_lat: number | null;
  client_lng: number | null;
  created_at: string;
}

/** Bloqueo registrado en la lista negra. */
export interface BlockedClient {
  id: string;
  device_id: string | null;
  client_ip: string | null;
  phone: string | null;
  reason: string;
  created_at: string;
}

/** Últimas 30 reservas con IP/dispositivo/teléfono para el panel admin. */
export async function fetchRecentReservations(): Promise<ForensicReservation[]> {
  const { data, error } = await supabase.rpc('admin_recent_reservations_rpc');
  if (error) throw error;
  return (data ?? []) as unknown as ForensicReservation[];
}

/** Lista negra vigente (máximo 100 registros recientes). */
export async function fetchBlockedClients(): Promise<BlockedClient[]> {
  const { data, error } = await supabase.rpc('admin_blocked_list_rpc');
  if (error) throw error;
  return (data ?? []) as unknown as BlockedClient[];
}

/** Reporte comunitario con el motivo que eligió el vecino. */
export interface OfferReport {
  id: string;
  offer_id: string;
  offer_title: string;
  offer_status: string;
  reason: string;
  detail: string | null;
  merchant_name: string | null;
  device_id: string | null;
  client_ip: string | null;
  created_at: string;
}

/** Últimos 30 reportes con motivo + trazabilidad para el panel admin. */
export async function fetchRecentReports(): Promise<OfferReport[]> {
  const { data, error } = await supabase.rpc('admin_reports_list_rpc');
  if (error) throw error;
  return (data ?? []) as unknown as OfferReport[];
}

/** 🚫 Bloquea dispositivo / IP / teléfono (al menos un identificador). */
export async function adminBlockClient(input: {
  deviceId?: string | null;
  clientIp?: string | null;
  phone?: string | null;
  reason?: string;
}): Promise<void> {
  const { error } = await supabase.rpc('admin_block_client_rpc', {
    p_device_id: input.deviceId ?? null,
    p_client_ip: input.clientIp ?? null,
    p_phone: input.phone ?? null,
    p_reason: input.reason ?? 'Conducta abusiva',
  });
  if (error) throw error;
}

/** Quita un bloqueo de la lista negra. */
export async function adminUnblockClient(blockId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_unblock_client_rpc', { p_block_id: blockId });
  if (error) throw error;
}
