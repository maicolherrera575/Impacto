import { supabase } from './supabase';
import { getDeviceId } from './deviceFingerprint';
import type { Category, QuickRequest } from '../types';

/** Pedidos activos de la comunidad (subasta inversa). */
export async function fetchActiveRequests(municipality?: string): Promise<QuickRequest[]> {
  let query = supabase
    .from('quick_requests')
    .select('*')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(50);

  if (municipality) {
    query = query.eq('municipality', municipality);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as QuickRequest[];
}

export interface CreateRequestInput {
  customerName: string;
  customerWhatsapp: string;
  municipality: string;
  category: Category;
  needDescription: string;
  /** Punto de encuentro seguro elegido por el cliente (obligatorio). */
  meetingPoint: string;
  /** Coordenadas silenciosas para el inspector forense (null si no hay GPS). */
  clientLat?: number | null;
  clientLng?: number | null;
}

/**
 * Publica un pedido: "¿Quién tiene...? / ¿Quién me lo lleva?". Siempre vía
 * RPC del servidor, que valida el teléfono, captura la IP, registra la
 * huella del dispositivo y aplica el candado anti-spam (máx. 2 activos).
 */
export async function createQuickRequest(input: CreateRequestInput): Promise<void> {
  const { error } = await supabase.rpc('create_quick_request_rpc', {
    p_category: input.category,
    p_customer_name: input.customerName,
    p_customer_whatsapp: input.customerWhatsapp,
    p_need_description: input.needDescription,
    p_meeting_point: input.meetingPoint,
    p_device_id: getDeviceId(),
    p_municipality: input.municipality,
    p_client_lat: input.clientLat ?? null,
    p_client_lng: input.clientLng ?? null,
  });
  if (error) throw error;
}
