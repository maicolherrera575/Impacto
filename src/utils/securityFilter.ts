/**
 * 🛡️ BLINDAJE ANTI-ESTAFAS UNIVERSAL (V29.0)
 *
 * Única fuente de verdad para validar publicaciones manuales y asistidas por IA
 * antes de enviarse a Supabase. Detecta frases completas de riesgo (préstamos
 * gota a gota, dinero por adelantado, pirámides o citas en despoblado) sin
 * generar falsos positivos con palabras agrícolas o comerciales inocentes
 * como "abono orgánico", "abono para café", "cuota inicial", etc.
 */

export const SECURITY_BLOCK_MESSAGE =
  'Por seguridad de la comunidad, no se permiten publicaciones que ofrezcan préstamos rápidos o soliciten dinero por adelantado.';

export const SECURITY_FRAUD_PATTERNS: RegExp[] = [
  /\bgota\s*a\s*gota\b/i,
  /\bpr[eé]stamo[s]?\s+(f[aá]cil(es)?|r[aá]pido[s]?|inmediato[s]?|express|al\s+instante|sin\s*(requisitos|papeleo|fiador|codeudor))\b/i,
  /\bcr[eé]dito[s]?\s+(r[aá]pido[s]?|inmediato[s]?|express|sin\s*(requisitos|papeleo|fiador|datacredito))\b/i,
  /\bfinanciaci[oó]n\s+(inmediata|r[aá]pida|sin\s+requisitos)\b/i,
  /\b(dinero|giro[s]?|transferencia[s]?|consignaci[oó]n|pago|env[ií]o)\s+(por\s+adelantado|anticipado\s+obligatorio)\b/i,
  /\b(solicito|solicitamos|pide|pedimos|requiere|env[ií]a|enviar|consigna|consignar|paga|pagar)\s+(dinero|pago|transferencia|consignaci[oó]n|abono|anticipo)\s+(por\s+adelantado|anticipado|antes\s+de\s+entregar|primero)\b/i,
  /\bconsign(a|ar|e)\s+primero\b|\bconsignaci[oó]n\s+previa\b|\bpaga\s+primero\b/i,
  /\b(abono|anticipo)\s+(por\s+adelantado|anticipado|obligatorio|previo\s+para\s+(reservar|entregar|enviar))\b/i,
  /\b(dinero|ganancia[s]?)\s+f[aá]cil(es)?\b|\bduplica\s+tu\s+dinero\b|\binversi[oó]n\s+(f[aá]cil|segura)\s+duplic/i,
  /\b(pir[aá]mide\s+financiera|d[oó]lares\s+bitcoin|trading\s+garantizado)\b/i,
  /\bservicios?\s+(sexuale?s?|er[oó]ticos?)\b/i,
  /\b(cita[s]?\s+a\s+solas|encuentro\s+[ií]ntimo|sitios?\s+despoblados?)\b/i,
];

export function detectFraudSignals(text: string): boolean {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return false;
  return SECURITY_FRAUD_PATTERNS.some((pattern) => pattern.test(normalized));
}

export type OfferSecurityValidation =
  | { ok: true }
  | { ok: false; reason: string };

export function validateOfferSecurity(text: string): OfferSecurityValidation {
  if (detectFraudSignals(text)) {
    return { ok: false, reason: SECURITY_BLOCK_MESSAGE };
  }
  return { ok: true };
}
