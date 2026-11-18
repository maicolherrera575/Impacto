import { supabase } from './supabase';
import { pruneStorageUrls } from './storagePruning.service';
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

/** Kill-switch: borra al instante una oferta peligrosa o fraudulenta y limpia su imagen en Storage. */
export async function adminDeleteOffer(offerId: string): Promise<void> {
  let assetUrl: string | null = null;
  try {
    const { data: row } = await supabase.from('offers').select('image_thumb').eq('id', offerId).maybeSingle();
    assetUrl = (row as { image_thumb?: string | null } | null)?.image_thumb ?? null;
  } catch {
    /* continuar con el borrado atómico en BD */
  }
  const { data, error } = await supabase.rpc('admin_delete_offer_rpc', { p_offer_id: offerId });
  if (error) throw error;
  void data;
  if (assetUrl) void pruneStorageUrls([assetUrl]);
}

/** 🪪 V20 · Expediente KYB pendiente de auditoría visual del administrador. */
export interface KybVerification {
  merchant_id: string;
  doc_image: string;
  face_image: string;
  doc_hash: string;
  face_hash: string;
  status: string;
  submitted_at: string;
}

/** Expedientes KYB en estado 'pending' (la RLS solo los deja ver el admin). */
export async function fetchKybPending(): Promise<KybVerification[]> {
  const { data, error } = await supabase
    .from('kyb_verifications')
    .select('merchant_id, doc_image, face_image, doc_hash, face_hash, status, submitted_at')
    .eq('status', 'pending')
    .order('submitted_at', { ascending: true })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as unknown as KybVerification[];
}

/** Aprueba (is_verified=true) o rechaza (libera las imágenes) un expediente KYB. */
export async function reviewKyb(merchantId: string, approve: boolean): Promise<void> {
  const { error } = await supabase.rpc('admin_kyb_review_rpc', {
    p_merchant_id: merchantId,
    p_approve: approve,
  });
  if (error) throw error;
}

/** 🧹 V20/V33 · Optimización extrema de la BD gratuita + poda de Storage en ofertas vencidas. */
export async function cleanupExpiredData(): Promise<{ offers_deleted: number; receipts_cleared: number }> {
  try {
    const { data: staleOffers } = await supabase
      .from('offers')
      .select('image_thumb')
      .lt('expires_at', new Date(Date.now() - 30 * 86_400_000).toISOString())
      .not('image_thumb', 'is', null)
      .limit(100);
    if (Array.isArray(staleOffers) && staleOffers.length > 0) {
      await pruneStorageUrls(staleOffers.map((o) => (o as { image_thumb?: string | null }).image_thumb));
    }
  } catch {
    /* best-effort Storage cleanup */
  }
  const { data, error } = await supabase.rpc('cleanup_expired_data_rpc');
  if (error) throw error;
  return data as unknown as { offers_deleted: number; receipts_cleared: number };
}

/** Purga TODAS las ofertas vencidas y sus imágenes asociadas (admin). */
export async function adminCleanupExpired(): Promise<number> {
  try {
    const { data: expiredOffers } = await supabase
      .from('offers')
      .select('image_thumb')
      .lt('expires_at', new Date().toISOString())
      .not('image_thumb', 'is', null)
      .limit(150);
    if (Array.isArray(expiredOffers) && expiredOffers.length > 0) {
      await pruneStorageUrls(expiredOffers.map((o) => (o as { image_thumb?: string | null }).image_thumb));
    }
  } catch {
    /* best-effort Storage cleanup */
  }
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
  merchant_id?: string | null;
  merchant_verified?: boolean;
  reason: string;
  detail: string | null;
  merchant_name: string | null;
  device_id: string | null;
  client_ip: string | null;
  is_verified_buyer?: boolean;
  trust_weight?: number;
  created_at: string;
}

/** Últimos 30 reportes con motivo + trazabilidad para el panel admin.
 *  🛡️ V19 · Resiliente: si la RPC aún no existe en el caché de PostgREST
 *  (error PGRST202 "Could not find the function..."), JAMÁS se muestra un
 *  toast rojo: cae silenciosamente a una consulta directa sobre la tabla
 *  offers (reportes acumulados) para que el panel siga funcionando hoy. */
export async function fetchRecentReports(): Promise<OfferReport[]> {
  const { data, error } = await supabase.rpc('admin_reports_list_rpc');
  if (!error) return (data ?? []) as unknown as OfferReport[];
  const errCode = (error as { code?: string }).code ?? '';
  const isMissingRpc =
    errCode === 'PGRST202' || /could not find the function/i.test(error.message ?? '');
  if (!isMissingRpc) throw error;
  try {
    const { data: rows, error: fbError } = await supabase
      .from('offers')
      .select('id, title, status, reports_count, updated_at')
      .gt('reports_count', 0)
      .order('reports_count', { ascending: false })
      .limit(30);
    if (fbError) return [];
    return (rows ?? []).map((o) => ({
      id: o.id,
      offer_id: o.id,
      offer_title: o.title,
      offer_status: o.status,
      reason: `⚠️ ${o.reports_count} reportes de la comunidad`,
      detail: null,
      merchant_name: null,
      device_id: null,
      client_ip: null,
      created_at: o.updated_at,
    })) as unknown as OfferReport[];
  } catch {
    return [];
  }
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

/** 🧹 V19.0 · Desestima una denuncia falsa/por envidia y restaura la oferta si fue pausada. */
export async function dismissReport(
  reportId: string,
  restoreOffer = true,
): Promise<{ remaining: number; restored: boolean }> {
  const { data, error } = await supabase.rpc('admin_dismiss_report_rpc', {
    p_report_id: reportId,
    p_restore_offer: restoreOffer,
  });
  if (error) throw error;
  return data as unknown as { remaining: number; restored: boolean };
}

/** 🧹 V19.0 · Borra TODAS las denuncias de un local y reactiva sus ofertas vigentes. */
export async function clearMerchantReports(
  merchantId: string,
  restoreOffers = true,
): Promise<{ deleted: number; offersUpdated: number }> {
  const { data, error } = await supabase.rpc('admin_clear_merchant_reports_rpc', {
    p_merchant_id: merchantId,
    p_restore_offers: restoreOffers,
  });
  if (error) throw error;
  return data as unknown as { deleted: number; offersUpdated: number };
}

/** 🧹 V19.0 · Borra todas las denuncias de una oferta específica y la restaura. */
export async function clearOfferReports(
  offerId: string,
  restoreOffer = true,
): Promise<{ deleted: number }> {
  const { data, error } = await supabase.rpc('admin_clear_offer_reports_rpc', {
    p_offer_id: offerId,
    p_restore_offer: restoreOffer,
  });
  if (error) throw error;
  return data as unknown as { deleted: number };
}
