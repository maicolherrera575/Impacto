import { supabase } from './supabase';
import type { PaymentMethod, PaymentType } from '../types';

/**
 * 💳 Métodos de pago del comercio (Nequi, Daviplata, Bancolombia, efectivo).
 * La validación REAL vive en el servidor (`save_payment_method_rpc`): formato
 * por tipo + unicidad GLOBAL en toda la plataforma + RLS sin INSERT/UPDATE
 * directos. Aquí además pre-validamos en vivo para dar feedback instantáneo.
 */

/** Normaliza a dígitos y quita el prefijo internacional 57 (573xx… → 3xx…). */
export function normalizePaymentNumber(raw: string): string {
  let digits = (raw ?? '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('57')) digits = digits.slice(2);
  return digits;
}

/**
 * Valida el formato de un número según el tipo ANTES de enviarlo al servidor.
 * Devuelve null si es válido, o el mensaje de error para mostrar en vivo.
 */
export function validatePaymentNumber(type: PaymentType, raw: string): string | null {
  const digits = normalizePaymentNumber(raw);
  if (type === 'efectivo') return null; // no lleva número
  if (digits.length === 0) return 'Escribe el número de la cuenta';
  if (type === 'nequi' || type === 'daviplata') {
    if (digits.length !== 10) return `Faltan dígitos: lleva ${digits.length} de 10`;
    if (!digits.startsWith('3')) return 'Debe ser un celular que empiece por 3 (ej: 3201234567)';
    return null;
  }
  // bancolombia
  if (digits.length < 9) return `Faltan dígitos: lleva ${digits.length} de 9`;
  if (digits.length > 17) return 'No puede pasar de 17 dígitos';
  return null;
}

/** Métodos de pago ACTIVOS de un comercio (lectura pública del perfil). */
export async function fetchMerchantPaymentMethods(merchantId: string): Promise<PaymentMethod[]> {
  const { data, error } = await supabase
    .from('payment_methods')
    .select('*')
    .eq('merchant_id', merchantId)
    .eq('is_active', true)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as PaymentMethod[];
}

/**
 * Guarda (o actualiza) el método de pago del comercio autenticado vía RPC.
 * El servidor rechaza: formato inválido y números ya registrados por otro
 * comercio (DUPLICADO) — el error llega traducido y amable.
 */
export async function saveMyPaymentMethod(
  type: PaymentType,
  number: string,
  holderName?: string,
): Promise<PaymentMethod> {
  const digits = type === 'efectivo' ? '' : normalizePaymentNumber(number);
  const { data, error } = await supabase.rpc('save_payment_method_rpc', {
    p_method_type: type,
    p_account_number: digits,
    p_holder_name: holderName ?? null,
  });
  if (error) throw error;
  return data as unknown as PaymentMethod;
}

/** Elimina el método de pago propio del tipo indicado. */
export async function deleteMyPaymentMethod(type: PaymentType): Promise<void> {
  const { error } = await supabase.rpc('delete_payment_method_rpc', { p_method_type: type });
  if (error) throw error;
}
