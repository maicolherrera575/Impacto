import { supabase } from './supabase';
import type { CreditOrder } from '../types';

export interface SubmitCreditOrderInput {
  packageName: string;
  creditsRequested: number;
  amountCop: number;
  referenceCode: string;
  paymentMethod: 'Nequi' | 'Daviplata' | 'Bancolombia';
  receiptThumb: string | null;
  aiNote: string | null;
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
  });
  if (error) throw error;
  return data as unknown as CreditOrder;
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
