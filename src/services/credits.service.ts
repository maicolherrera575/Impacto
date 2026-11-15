import { supabase } from './supabase';
import type { CreditOrder, PaymentConfig } from '../types';

export interface SubmitCreditOrderInput {
  packageName: string;
  creditsRequested: number;
  amountCop: number;
  referenceCode: string;
  paymentMethod: 'Nequi' | 'Daviplata' | 'Bancolombia' | 'Llave';
  receiptThumb: string | null;
  aiNote: string | null;
  /** 🔍 V18 · Forense: huella SHA-256 de la imagen y dictamen del escáner. */
  receiptHash?: string | null;
  destinationDetected?: string | null;
  qrPayload?: string | null;
  iaStatusOk?: boolean;
}

/** El comerciante envía su comprobante para activación (anti-doble cobro incluido). */
export async function submitCreditOrder(input: SubmitCreditOrderInput): Promise<CreditOrder> {
  const { data, error } = await supabase.rpc('submit_credit_order_rpc', {
    p_package_name: input.packageName,
    p_credits_requested: input.creditsRequested,
    p_amount_cop: input.amountCop,
    p_reference_code: input.referenceCode,
    p_payment_method: input.paymentMethod,
    p_receipt_thumb: input.receiptThumb,
    p_ai_note: input.aiNote,
    p_receipt_hash: input.receiptHash ?? null,
    p_destination_detected: input.destinationDetected ?? null,
    p_qr_payload: input.qrPayload ?? null,
    p_ia_status_ok: input.iaStatusOk ?? false,
  });
  if (error) throw error;
  return data as unknown as CreditOrder;
}

/**
 * 🔍 V18 · Verificación INSTANTÁNEA de no-reutilización (solo lectura):
 * responde { used, reason } sin escribir nada en la base de datos.
 */
export async function checkReceiptAlreadyUsed(
  rawReference: string,
  receiptHash?: string | null,
): Promise<{ used: boolean; reason: string }> {
  const { data, error } = await supabase.rpc('check_receipt_already_used_rpc', {
    p_raw_reference: rawReference,
    p_receipt_hash: receiptHash ?? null,
  });
  if (error) return { used: false, reason: '' };
  const r = data as unknown as { used?: boolean; reason?: string } | null;
  return { used: r?.used === true, reason: r?.reason ?? '' };
}

/**
 * ⚡ V18 · Aprobación automática instantánea: si el switch del Admin está ON
 * y el servidor confirma destino + monto exacto + unicidad, acredita al acto.
 */
export async function autoApproveCreditOrder(orderId: string): Promise<{ approved: boolean; reason?: string; credits?: number }> {
  const { data, error } = await supabase.rpc('auto_approve_credit_order_rpc', { p_order_id: orderId });
  if (error) throw error;
  const r = data as unknown as { approved?: boolean; reason?: string; credits?: number } | null;
  return { approved: r?.approved === true, reason: r?.reason, credits: r?.credits };
}

/** 💳 V18 · Configuración completa de recaudo del Admin (Nequi/Llave/QR/auto). */
export async function fetchPaymentConfig(): Promise<PaymentConfig | null> {
  const { data, error } = await supabase.rpc('get_payment_config_rpc');
  if (error) return null;
  return (data as unknown as PaymentConfig) ?? null;
}

/** 👑 Solo admin: guarda Nequi, Llave, titular, QR y el switch de auto-aprobación. */
export async function setPaymentConfig(input: {
  nequiPhone: string;
  llave?: string | null;
  holderName?: string | null;
  qrThumb?: string | null;
  autoApprove?: 'on' | 'off' | null;
}): Promise<{ nequiPhone: string; autoApprove: boolean }> {
  const { data, error } = await supabase.rpc('admin_set_payment_contact_rpc', {
    p_nequi_phone: input.nequiPhone,
    p_payment_llave: input.llave ?? null,
    p_holder_name: input.holderName ?? null,
    p_qr_thumb: input.qrThumb ?? null,
    p_auto_approve: input.autoApprove ?? null,
  });
  if (error) throw error;
  return data as unknown as { nequiPhone: string; autoApprove: boolean };
}

/** Bandeja de cobros del administrador (últimas 50 órdenes). */
export async function fetchCreditOrders(): Promise<CreditOrder[]> {
  const { data, error } = await supabase.rpc('admin_credit_orders_list_rpc');
  if (error) throw error;
  return (data ?? []) as unknown as CreditOrder[];
}

/**
 * ✅ Aprobar: acredita los créditos al instante y borra el comprobante
 * (cero bytes muertos). ❌ Rechazar: queda con su miniatura 30 días.
 */
export async function resolveCreditOrder(orderId: string, action: 'approved' | 'rejected'): Promise<CreditOrder> {
  const { data, error } = await supabase.rpc('admin_resolve_credit_order_rpc', {
    p_order_id: orderId,
    p_action: action,
  });
  if (error) throw error;
  return data as unknown as CreditOrder;
}

/**
 * 📱 Número oficial de Nequi/WhatsApp del administrador (protegido en la
 * base de datos, editable desde el Panel Admin). Solo para usuarios
 * autenticados; ante cualquier error devuelve null y el frontend usa el
 * fallback de variables de entorno.
 */
export async function fetchPaymentContact(): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_payment_contact_rpc');
  if (error) return null;
  return typeof data === 'string' && data.trim() !== '' ? data.trim() : null;
}

/** 👑 Solo admin: guarda el número oficial de recargas (10–13 dígitos). */
export async function setPaymentContact(whatsapp: string): Promise<string> {
  const { data, error } = await supabase.rpc('admin_set_payment_contact_rpc', { p_whatsapp: whatsapp });
  if (error) throw error;
  return data as unknown as string;
}
