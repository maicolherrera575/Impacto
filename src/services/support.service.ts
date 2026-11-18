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
 * Registra un ticket de soporte en Supabase (`admin_tickets` como tabla primaria V32,
 * con respaldo automático a `support_tickets` si la BD aún usa el esquema anterior).
 */
export async function submitSupportTicket(
  input: CreateSupportTicketInput,
): Promise<{ ticket: SupportTicket | null; persisted: boolean }> {
  const rpcPayload = {
    p_user_role: input.userRole,
    p_user_name: input.userName || 'Visitante',
    p_municipality: input.municipality || 'Gachetá',
    p_category: input.category,
    p_severity: input.severity,
    p_summary: input.summary.slice(0, 240),
    p_chat_transcript: input.chatTranscript,
    p_ai_analysis: input.aiAnalysis.slice(0, 800),
  };

  for (const rpcName of ['submit_admin_ticket_rpc', 'submit_support_ticket_rpc'] as const) {
    try {
      const { data, error } = await supabase.rpc(rpcName, rpcPayload);
      if (!error && data) {
        return { ticket: data as unknown as SupportTicket, persisted: true };
      }
    } catch {
      /* continuar al siguiente canal */
    }
  }

  const { data: userData } = await supabase.auth.getUser();
  const rowPayload = {
    user_id: userData.user?.id ?? null,
    user_role: input.userRole,
    user_name: (input.userName || 'Visitante').slice(0, 80),
    municipality: (input.municipality || 'Gachetá').slice(0, 60),
    category: input.category,
    severity: input.severity,
    summary: input.summary.slice(0, 240),
    chat_transcript: input.chatTranscript,
    ai_analysis: input.aiAnalysis.slice(0, 800),
  };

  for (const table of ['admin_tickets', 'support_tickets'] as const) {
    try {
      const { data, error } = await supabase
        .from(table)
        .insert(rowPayload)
        .select('*')
        .single();
      if (!error && data) {
        return { ticket: data as unknown as SupportTicket, persisted: true };
      }
    } catch {
      /* tabla pendiente de migración: probar respaldo */
    }
  }

  return { ticket: null, persisted: false };
}

/** Lista los tickets de soporte para la bandeja del administrador (`admin_tickets` + respaldo). */
export async function fetchAdminSupportTickets(): Promise<SupportTicket[]> {
  for (const rpcName of ['admin_tickets_list_rpc', 'admin_support_tickets_list_rpc'] as const) {
    try {
      const { data, error } = await supabase.rpc(rpcName);
      if (!error && Array.isArray(data) && data.length > 0) {
        return data as unknown as SupportTicket[];
      }
    } catch {
      /* continuar */
    }
  }

  for (const table of ['admin_tickets', 'support_tickets'] as const) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(80);
    if (!error && Array.isArray(data)) {
      return data as unknown as SupportTicket[];
    }
  }
  return [];
}

/** Actualiza el estado de un ticket desde el Súper Panel. */
export async function updateSupportTicketStatus(
  ticketId: string,
  status: SupportStatus,
): Promise<SupportTicket> {
  for (const rpcName of ['admin_update_ticket_status_rpc', 'admin_update_support_ticket_rpc'] as const) {
    try {
      const { data, error } = await supabase.rpc(rpcName, {
        p_ticket_id: ticketId,
        p_status: status,
      });
      if (!error && data) {
        return data as unknown as SupportTicket;
      }
    } catch {
      /* probar siguiente */
    }
  }

  let lastError: unknown = null;
  for (const table of ['admin_tickets', 'support_tickets'] as const) {
    const { data, error } = await supabase
      .from(table)
      .update({ status })
      .eq('id', ticketId)
      .select('*')
      .single();
    if (!error && data) return data as unknown as SupportTicket;
    lastError = error;
  }
  throw lastError instanceof Error ? lastError : new Error('No se pudo actualizar el ticket.');
}
