import { supabase } from './supabase';

export type SupportRole = 'client' | 'merchant' | 'admin';
export type SupportCategory = 'usage' | 'technical' | 'bug' | 'billing' | 'abuse';
export type SupportSeverity = 'low' | 'medium' | 'high' | 'critical';
export type SupportStatus = 'open' | 'in_progress' | 'resolved';

export interface SupportChatMessage {
  role: 'user' | 'assistant';
  text: string;
  at: string;
}

export interface SupportTicket {
  id: string;
  user_id: string | null;
  user_role: SupportRole;
  user_name: string;
  municipality: string;
  category: SupportCategory;
  severity: SupportSeverity;
  summary: string;
  chat_transcript: SupportChatMessage[];
  ai_analysis: string;
  status: SupportStatus;
  created_at: string;
}

export interface CreateSupportTicketInput {
  userRole: SupportRole;
  userName: string;
  municipality: string;
  category: SupportCategory;
  severity: SupportSeverity;
  summary: string;
  chatTranscript: SupportChatMessage[];
  aiAnalysis: string;
}

/**
 * Registra un ticket de soporte en Supabase (`support_tickets`).
 * Usa la RPC `submit_support_ticket_rpc` y cae graciosamente a insert directo si hace falta.
 */
export async function submitSupportTicket(
  input: CreateSupportTicketInput,
): Promise<{ ticket: SupportTicket | null; persisted: boolean }> {
  try {
    const { data, error } = await supabase.rpc('submit_support_ticket_rpc', {
      p_user_role: input.userRole,
      p_user_name: input.userName || 'Visitante',
      p_municipality: input.municipality || 'Gachetá',
      p_category: input.category,
      p_severity: input.severity,
      p_summary: input.summary.slice(0, 240),
      p_chat_transcript: input.chatTranscript,
      p_ai_analysis: input.aiAnalysis.slice(0, 800),
    });
    if (!error && data) {
      return { ticket: data as unknown as SupportTicket, persisted: true };
    }
  } catch {
    /* continuar a inserción directa en tabla */
  }

  try {
    const { data: userData } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('support_tickets')
      .insert({
        user_id: userData.user?.id ?? null,
        user_role: input.userRole,
        user_name: (input.userName || 'Visitante').slice(0, 80),
        municipality: (input.municipality || 'Gachetá').slice(0, 60),
        category: input.category,
        severity: input.severity,
        summary: input.summary.slice(0, 240),
        chat_transcript: input.chatTranscript,
        ai_analysis: input.aiAnalysis.slice(0, 800),
      })
      .select('*')
      .single();
    if (!error && data) {
      return { ticket: data as unknown as SupportTicket, persisted: true };
    }
  } catch {
    /* tabla pendiente de migración: respuesta amable sin romper UI */
  }

  return { ticket: null, persisted: false };
}

/** Lista los tickets de soporte para la bandeja del administrador. */
export async function fetchAdminSupportTickets(): Promise<SupportTicket[]> {
  try {
    const { data, error } = await supabase.rpc('admin_support_tickets_list_rpc');
    if (!error && Array.isArray(data)) {
      return data as unknown as SupportTicket[];
    }
  } catch {
    /* fallback a select directo */
  }

  const { data, error } = await supabase
    .from('support_tickets')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(80);
  if (error) return [];
  return (data ?? []) as unknown as SupportTicket[];
}

/** Actualiza el estado de un ticket desde el Súper Panel. */
export async function updateSupportTicketStatus(
  ticketId: string,
  status: SupportStatus,
): Promise<SupportTicket> {
  try {
    const { data, error } = await supabase.rpc('admin_update_support_ticket_rpc', {
      p_ticket_id: ticketId,
      p_status: status,
    });
    if (!error && data) {
      return data as unknown as SupportTicket;
    }
  } catch {
    /* fallback a update directo */
  }

  const { data, error } = await supabase
    .from('support_tickets')
    .update({ status })
    .eq('id', ticketId)
    .select('*')
    .single();
  if (error) throw error;
  return data as unknown as SupportTicket;
}
