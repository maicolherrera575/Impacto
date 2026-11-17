import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { GEMINI_API_KEY } from '../config/env';
import type { Category, ParsedPromo } from '../types';
import { buildPaletteFromHexTriplet } from '../utils/colorPalette';
import type { ExtractedBrandPalette } from '../utils/colorPalette';

const CATEGORY_IDS: Category[] = ['comida', 'transporte_flete', 'agro_mercado', 'servicios_comercios'];

const SYSTEM_PROMPT = `Eres el asistente comercial de Impulso, una plataforma de ofertas locales de Colombia (municipios rurales de Cundinamarca como Gachetá).
Tu trabajo: convertir el mensaje libre del comerciante (puede llegar dictado por voz, con errores y muletillas) en un JSON perfecto de promoción.

Reglas estrictas:
1. "category": clasifica en exactamente una de: comida, transporte_flete, agro_mercado, hoteles_turismo, salud_belleza, hogar_construccion, servicios_comercios.
2. "title": titular corto, sabroso y directo (máximo 90 caracteres, idealmente menos de 60). Sin comillas.
3. "description": texto apetitoso y claro (máximo 280 caracteres). Destaca cantidad, frescura y urgencia. Sin emojis dentro del texto.
4. "emoji_icon": UN solo emoji que represente el producto o servicio (ej: 🍽️ 🥐 🚚 🌱 🛠️ 💊).
5. "original_price": precio normal en pesos colombianos, número entero, o null si no se menciona ni se deduce.
6. "promo_price": precio de la oferta en pesos colombianos, número entero. Si el comerciante dice "a 12 mil", son 12000. Si no menciona precio, estima uno razonable y bajo para un pueblo rural.
7. "total_quota": cantidad total de unidades/cupos disponibles, número entero entre 1 y 500. Si dice "15 almuerzos", son 15. Si no lo menciona, usa 10.
8. "duration_hours": duración en horas, número entre 0.5 y 96. "3 horas" → 3; "esta tarde" → 6; "hoy" → 8; "mañana todo el día" → 24; "esta semana/3 días" → 72. Si no se menciona, usa 3 (oferta relámpago).
9. SEGURIDAD: si el mensaje pide transferencias o giros por adelantado, préstamos gota a gota, dinero fácil, servicios sexuales o encuentros en sitios despoblados sin local comercial identificado, NO generes la oferta: responde exactamente este JSON {"category":"servicios_comercios","title":"Contenido bloqueado","description":"Impulso protege a la comunidad: esta publicación no cumple las normas de seguridad local.","emoji_icon":"🛡️","original_price":null,"promo_price":1,"total_quota":1,"duration_hours":1}.
Responde ÚNICAMENTE con el objeto JSON.`;

// ── Motor de IA unificado (cero llave expuesta en producción) ──────────────
// PRODUCCIÓN (Vercel): TODO pasa por /api/gemini (serverless) donde vive la
// llave privada. DESARROLLO local: usa el SDK con VITE_GEMINI_API_KEY; si no
// existe, intenta /api/gemini (útil con `vercel dev`).

/** V20: cadena de modelos con reintento automático. SIEMPRE se intenta
 *  primero el mejor modelo disponible (2.5-flash); si devuelve 429/503/404
 *  (cuota o indisponibilidad) cae al instante a los siguientes (flash-lite →
 *  2.0 → 1.5) para que la respuesta JAMÁS se pierda y la app siempre funcione. */
const MODEL_CHAIN = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
] as const;
const MODEL_ID = MODEL_CHAIN[0];

/** HTTP codes que justifican reintentar con el siguiente modelo de la cadena. */
const RETRYABLE_STATUS = new Set([404, 408, 429, 500, 502, 503, 504]);

type SdkModel = ReturnType<GoogleGenerativeAI['getGenerativeModel']>;
type SdkRequest = Parameters<SdkModel['generateContent']>[0];

let sdkModel: SdkModel | null = null;

function getSdkModel(): SdkModel {
  if (!sdkModel) {
    sdkModel = new GoogleGenerativeAI(GEMINI_API_KEY).getGenerativeModel({ model: MODEL_ID });
  }
  return sdkModel;
}

interface GeminiCallOptions {
  systemInstruction?: string;
  prompt: string;
  /** Imagen inline base64 (sin el prefijo data:) para IA Vision. */
  image?: { mimeType: string; data: string };
  temperature: number;
  responseSchema?: Record<string, unknown>;
}

/** Payload compatible al 100% con el SDK y con la API REST de Gemini. */
function buildPayload(options: GeminiCallOptions): Record<string, unknown> {
  const parts: Record<string, unknown>[] = [];
  if (options.image) parts.push({ inlineData: options.image });
  parts.push({ text: options.prompt });
  return {
    ...(options.systemInstruction ? { systemInstruction: { parts: [{ text: options.systemInstruction }] } } : {}),
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: options.temperature,
      responseMimeType: 'application/json',
      ...(options.responseSchema ? { responseSchema: options.responseSchema } : {}),
    },
  };
}

/** Extrae el texto de la respuesta REST (candidates → content → parts). */
function extractRestText(rest: unknown): string {
  const candidates = (rest as { candidates?: { content?: { parts?: { text?: string }[] } }[] } | null)?.candidates;
  const parts = candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((p) => (typeof p?.text === 'string' ? p.text : ''))
    .join('')
    .trim();
}

/** Llama al proxy serverless /api/gemini recorriendo la cadena de modelos. */
async function callProxy(options: GeminiCallOptions): Promise<string> {
  let lastErr: Error = new Error('La IA no respondió');
  for (const model of MODEL_CHAIN) {
    let res: Response;
    try {
      res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, payload: buildPayload(options) }),
      });
    } catch {
      lastErr = new Error('No se pudo contactar la IA (revisa tu conexión a internet)');
      continue;
    }
    const rest: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = (rest as { error?: { message?: string } } | null)?.error?.message;
      lastErr = new Error(msg ? `La IA respondió con error: ${msg}` : `La IA respondió con error (HTTP ${res.status})`);
      // Cuota/indisponibilidad del modelo: reintenta AL INSTANTE con el siguiente.
      if (RETRYABLE_STATUS.has(res.status)) continue;
      throw lastErr;
    }
    const text = extractRestText(rest);
    if (!text) {
      lastErr = new Error('La IA no respondió con contenido. Intenta de nuevo');
      continue;
    }
    return text;
  }
  throw lastErr;
}

/** Llamada directa con el SDK (requiere GEMINI_API_KEY disponible). */
async function callSdk(options: GeminiCallOptions): Promise<string> {
  const { response } = await getSdkModel().generateContent(buildPayload(options) as unknown as SdkRequest);
  const text = response.text().trim();
  if (!text) throw new Error('La IA no respondió con contenido. Intenta de nuevo');
  return text;
}

/** Llamada directa REST a Gemini con la llave inyectada en build time. */
async function callDirect(options: GeminiCallOptions): Promise<string> {
  const key = (typeof __APP_GEMINI_KEY__ === 'string' ? __APP_GEMINI_KEY__ : '').trim();
  if (!key) throw new Error('El navegador no tiene llave de respaldo de IA');
  let lastErr: Error = new Error('El navegador no tiene llave de respaldo de IA');
  for (const model of MODEL_CHAIN) {
    let res: Response;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildPayload(options)),
        },
      );
    } catch {
      lastErr = new Error('No se pudo contactar la IA directamente (revisa tu conexión)');
      continue;
    }
    const rest: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = (rest as { error?: { message?: string } } | null)?.error?.message;
      lastErr = new Error(msg ? `La IA respondió con error: ${msg}` : `La IA respondió con error (HTTP ${res.status})`);
      if (RETRYABLE_STATUS.has(res.status)) continue;
      throw lastErr;
    }
    const text = extractRestText(rest);
    if (!text) {
      lastErr = new Error('La IA no respondió con contenido. Intenta de nuevo');
      continue;
    }
    return text;
  }
  throw lastErr;
}

/**
 * Punto único de llamada a Gemini (V11 · MOTOR INFALIBLE).
 * 1) Motor 1: proxy serverless /api/gemini con cadena de modelos (2.5 → 2.0 → 1.5).
 * 2) Motor 2: llamada DIRECTA a la API REST con __APP_GEMINI_KEY__ (build time).
 * 3) Motor 3 (desarrollo): SDK con GEMINI_API_KEY local.
 * Si todo falla propaga los motivos técnicos EXACTOS (el estudio sintetiza la
 * campaña localmente para que el usuario JAMÁS vea cajas vacías).
 */
async function callGemini(options: GeminiCallOptions): Promise<string> {
  const errors: string[] = [];
  try {
    return await callProxy(options);
  } catch (proxyErr) {
    errors.push(proxyErr instanceof Error ? proxyErr.message : String(proxyErr));
  }
  try {
    return await callDirect(options);
  } catch (directErr) {
    errors.push(directErr instanceof Error ? directErr.message : String(directErr));
  }
  if (GEMINI_API_KEY) return callSdk(options);
  throw new Error(errors.join(' · '));
}

/**
 * 🧼 Sanitizador robusto de JSON V11: Gemini a veces envuelve el JSON en
 * bloques Markdown (```json … ```) o añade texto antes/después. Este helper
 * extrae SIEMPRE desde el primer '{' hasta el último '}' antes de parsear.
 */
export function parseAiJson<T>(rawText: string): T {
  const firstBrace = rawText.indexOf('{');
  const lastBrace = rawText.lastIndexOf('}');
  const cleanJson = firstBrace !== -1 && lastBrace !== -1 ? rawText.slice(firstBrace, lastBrace + 1) : rawText;
  try {
    return JSON.parse(cleanJson) as T;
  } catch {
    throw new Error('La IA devolvió un JSON malformado (sanitizado sin éxito). Intenta de nuevo.');
  }
}

/** Esquema JSON del Creador Mágico (compatible SDK + REST). */
const PROMO_SCHEMA: Record<string, unknown> = {
  type: SchemaType.OBJECT,
  properties: {
    category: { type: SchemaType.STRING, format: 'enum', enum: CATEGORY_IDS },
    title: { type: SchemaType.STRING },
    description: { type: SchemaType.STRING },
    emoji_icon: { type: SchemaType.STRING },
    original_price: { type: SchemaType.NUMBER, nullable: true },
    promo_price: { type: SchemaType.NUMBER },
    total_quota: { type: SchemaType.NUMBER },
    duration_hours: { type: SchemaType.NUMBER },
  },
  required: ['category', 'title', 'description', 'emoji_icon', 'promo_price', 'total_quota', 'duration_hours'],
};

const EMOJI_FALLBACKS: Record<Category, string> = {
  comida: '🍽️',
  transporte_flete: '🚚',
  agro_mercado: '🌱',
  hoteles_turismo: '🏨',
  salud_belleza: '💄',
  hogar_construccion: '🏠',
  servicios_comercios: '🛠️',
};

/** Normaliza y valida la salida de la IA contra las reglas de la base de datos. */
function normalize(raw: Partial<ParsedPromo>): ParsedPromo {
  const category: Category = CATEGORY_IDS.includes(raw.category as Category)
    ? (raw.category as Category)
    : 'comida';

  const title = (raw.title ?? '').trim().slice(0, 90) || 'Oferta especial del día';
  const description = (raw.description ?? '').trim().slice(0, 280) || title;

  const promo = Math.max(0, Math.round(Number(raw.promo_price) || 0));
  const original = raw.original_price == null ? null : Math.max(0, Math.round(Number(raw.original_price)));

  let quota = Math.round(Number(raw.total_quota) || 10);
  quota = Math.min(500, Math.max(1, quota));

  let hours = Number(raw.duration_hours) || 3;
  hours = Math.min(96, Math.max(0.5, hours));

  const emoji =
    [...(raw.emoji_icon ?? '')].filter((ch) => /\p{Extended_Pictographic}/u.test(ch)).join('').slice(0, 4) ||
    EMOJI_FALLBACKS[category];

  return {
    category,
    title,
    description,
    emoji_icon: emoji,
    original_price: original,
    promo_price: promo,
    total_quota: quota,
    duration_hours: hours,
  };
}

/**
 * Creador Mágico: interpreta lenguaje natural (texto o voz dictada) del
 * comerciante y devuelve un objeto de promoción listo para publicar.
 */
export async function parsePromoFromText(freeText: string): Promise<ParsedPromo> {
  const text = freeText.trim();
  if (text.length < 8) {
    throw new Error('Cuéntame un poco más de tu promoción para crearla con IA ✨');
  }
  if (detectFraudSignals(text)) {
    throw new Error(FRAUD_MESSAGE);
  }

  const jsonText = await callGemini({
    systemInstruction: SYSTEM_PROMPT,
    prompt: `Mensaje del comerciante: """${text}"""`,
    temperature: 0.4,
    responseSchema: PROMO_SCHEMA,
  });

  try {
    return normalize(parseAiJson<Partial<ParsedPromo>>(jsonText));
  } catch {
    throw new Error('La IA no logró estructurar la promoción. Intenta describirla con precios y cantidad.');
  }
}

/**
 * Escudo local anti-fraude (corre SIEMPRE, con o sin IA): detecta intentos
 * de extorsión, gota a gota, giros anticipados o citas peligrosas en el
 * texto de una oferta o de un pedido de la comunidad.
 */
export const FRAUD_MESSAGE =
  '🛡️ Impulso protege a la comunidad: no se permiten giros de dinero por adelantado, préstamos gota a gota, dinero fácil ni encuentros en sitios despoblados. Publica productos y servicios reales de tu negocio.';

const FRAUD_PATTERNS: RegExp[] = [
  /gota\s*a\s*gota/i,
  /pr[eé]stamo/i,
  /financiaci[oó]n\s*inmediata/i,
  /giro[s]?\s*(por\s*)?(adelantad|anticipad)/i,
  /transferencia\s*(por\s*)?(adelantad|anticipad)/i,
  /abono|anticipo\s*obligatorio|pago\s*anticipado\s*obligatorio/i,
  /dinero\s*f[aá]cil|ganancia\s*f[aá]cil|inversi[oó]n\s*(f[aá]cil|segura)\s*duplic/i,
  /d[oó]lares\s*bitcoin|cripto|forex/i,
  /servicios?\s*(sexuale?s?|er[oó]ticos?)/i,
  /cita[s]?\s*(a\s*)?solas|encuentro\s*intimate?o|sitios?\s*despoblados?/i,
];

export function detectFraudSignals(text: string): boolean {
  return FRAUD_PATTERNS.some((p) => p.test(text));
}

/** Resultado del análisis de IA Vision sobre un comprobante de pago. */
export interface ReceiptVerification {
  looksReal: boolean;
  /** 🚨 true si la IA detecta señales de captura editada, reciclada o no pagada. */
  suspicious: boolean;
  amountCop: number | null;
  reference: string | null;
  note: string;
  /** 🔍 V18 · Forense: número/Llave de destino visible en el comprobante. */
  destinationDetected: string | null;
  /** 🔍 V18 · Forense: fecha del pago tal como aparece. */
  dateDetected: string | null;
  /** 🔍 V18 · true si el destino coincide con la cuenta oficial del Admin. */
  isValidDestination: boolean;
  /** 🔍 V18 · true solo si el estado es "Exitoso/Envío realizado/Aprobado". */
  statusOk: boolean;
}

/** Contexto para que la IA valide el destino (número/Llave oficial del Admin). */
export interface ReceiptContext {
  /** Número Nequi/Daviplata oficial, ej: 3158942112 */
  adminPhone: string;
  /** Llave Bre-B / Transfiya oficial, ej: @impulso3158942112 */
  adminKey: string;
}

const RECEIPT_PROMPT = `Eres el verificador forense de pagos de Impulso. Analiza la imagen de un comprobante de pago de Nequi, Daviplata, Transfiya o Bancolombia de Colombia.
Devuelve ÚNICAMENTE este JSON:
{"looks_real": true|false, "suspicious": true|false, "amount_cop": número entero del valor pagado o null, "reference": "código de referencia / número de transacción visible (máx 40 caracteres)" o null, "destination_detected": "número de celular o Llave al que se envió el dinero tal como aparece" o null, "date_detected": "fecha y hora del pago tal como aparecen" o null, "status_ok": true|false, "note": "frase corta en español describiendo lo que leíste"}

Criterios:
- looks_real: true solo si la imagen parece un comprobante real de Nequi/Daviplata/Transfiya/Bancolombia (pantalla de la app con monto y fecha). Si es un dibujo, un meme, un papel escrito a mano u otra cosa, false.
- suspicious: true si detectas ALGUNA señal de fraude:
  * texto o números que parecen pegados/editados (fuente distinta, caja desalineada)
  * la transacción dice "Pendiente", "Programada" o "En proceso" (NO cuenta como pagado)
  * valor en 0 o ilegible con el resto muy elaborado
  * la misma captura con fecha muy antigua (más de 3 días atrás)
  * parece foto de la pantalla de OTRO teléfono con reflejos o bordes del celular
  Si la captura se ve normal y directa de la app, false.
- amount_cop: el valor pagado en pesos (si dice $24.000, devuelve 24000).
- reference: la referencia, código de confirmación, número de transacción, "Id de operación" o "CUS" visible.
- destination_detected: el número de celular o Llave de DESTINO del dinero (a quién le llegó). Ej: "315 894 2112" o "@impulso3158942112". Si no se ve, null.
- date_detected: la fecha y hora visibles del pago (ej: "15/11/2026 14:32").
- status_ok: true SOLO si el comprobante dice "Envío realizado", "Exitoso", "Aprobado" o equivalente de pago completado; false si dice "Pendiente", "Rechazado", "En proceso" o no se entiende.
- note: descripción breve (máx 120 caracteres).`;

/**
 * 🤖 IA Vision forense anti-fraude: lee la miniatura del comprobante
 * Nequi/Daviplata/Llave, extrae valor, referencia, destino, fecha y estado
 * del pago, y marca señales de capturas editadas o no confirmadas.
 * El destino se valida contra la cuenta oficial del administrador.
 */
export async function verifyNequiReceiptWithAI(imageDataUrl: string, context?: ReceiptContext): Promise<ReceiptVerification> {
  const mimeType = imageDataUrl.startsWith('data:image/png')
    ? 'image/png'
    : imageDataUrl.startsWith('data:image/jpeg')
      ? 'image/jpeg'
      : 'image/webp';
  const base64 = imageDataUrl.split(',')[1] ?? '';
  if (base64.length < 100) {
    throw new Error('La captura no se pudo leer. Sube el comprobante de nuevo');
  }

  const jsonText = await callGemini({
    prompt: RECEIPT_PROMPT + (context ? `\nLa cuenta oficial de destino del dinero es el número ${context.adminPhone} o la Llave ${context.adminKey}. En tus criterios, un comprobante cuyo destination_detected no contenga esos dígitos debe marcar suspicious=true.` : ''),
    image: { mimeType, data: base64 },
    temperature: 0.1,
  });

  interface ParsedReceipt {
    looks_real?: boolean;
    suspicious?: boolean;
    amount_cop?: number | null;
    reference?: string | null;
    destination_detected?: string | null;
    date_detected?: string | null;
    status_ok?: boolean;
    note?: string | null;
  }
  const parsed = parseAiJson<ParsedReceipt>(jsonText);
  const dest = typeof parsed.destination_detected === 'string' ? parsed.destination_detected.trim().slice(0, 40) : null;
  const destDigits = dest?.replace(/\D/g, '') ?? '';
  const adminDigits = context?.adminPhone.replace(/\D/g, '') ?? '';
  const adminKeyClean = (context?.adminKey ?? '').replace(/[^a-zA-Z0-9@]/g, '').toLowerCase();
  const isValidDestination = Boolean(
    context &&
      dest &&
      ((adminDigits.length >= 7 && (destDigits.endsWith(adminDigits) || adminDigits.endsWith(destDigits))) ||
        (adminKeyClean && dest.toLowerCase().includes(adminKeyClean))),
  );
  return {
    looksReal: parsed.looks_real === true,
    suspicious: parsed.suspicious === true,
    amountCop: typeof parsed.amount_cop === 'number' ? Math.round(parsed.amount_cop) : null,
    reference: typeof parsed.reference === 'string' ? parsed.reference.trim().slice(0, 40) : null,
    destinationDetected: dest,
    dateDetected: typeof parsed.date_detected === 'string' ? parsed.date_detected.trim().slice(0, 40) : null,
    isValidDestination,
    statusOk: parsed.status_ok === true,
    note: typeof parsed.note === 'string' ? parsed.note.trim().slice(0, 160) : 'Comprobante analizado',
  };
}

/** Resultado del semáforo de confianza para el administrador. */
export interface MerchantTrustResult {
  level: 'green' | 'yellow';
  summary: string;
  warnings: string[];
}

/** Resultado de la auditoría forense Vision del expediente KYB. */
export interface KybForensicResult {
  /** 0–100: confianza de que el documento es real y coincide con el negocio. */
  score: number;
  docReadable: boolean;
  docType: string | null;
  nameMatch: boolean;
  summary: string;
  warnings: string[];
}

const KYB_PROMPT = `Eres el auditor forense de identidad de Impulso (Gachetá, Colombia). Analiza la imagen del DOCUMENTO de identidad de un comerciante (cédula colombiana, RUT o NIT) que envió para obtener el sello "Comercio Verificado".
Devuelve ÚNICAMENTE este JSON:
{"doc_readable": true|false, "doc_type": "cédula|RUT|NIT|otro|null", "name_detected": "nombres propios legibles del titular o del negocio tal como aparecen" o null, "document_number_digits": "últimos dígitos visibles del número de documento" o null, "edited_signals": true|false, "score": 0-100, "summary": "frase corta para el administrador (máx 140 caracteres)", "warnings": ["señal 1", "señal 2"]}

Criterios:
- doc_readable: true solo si es una foto nítida de un documento oficial donde se leen campos.
- edited_signals: true si detectas recortes extraños, texto re-escrito, letras con distinta fuente o brillo, o pantallas de otro teléfono.
- score: 0-100 de confianza. 90-100 si se lee claro y sin señales de edición; 60-89 si se lee parcialmente; 0-59 si es borroso, es otra cosa, o hay señales de manipulación.
- summary y warnings en español, sobrios y útiles para un administrador humano.`;

/**
 * 🤖 V21 · Auditoría IA forense del expediente KYB: cruza el texto del
 * documento con el nombre registrado del comercio y el NIT/cédula que el
 * comerciante declaró, y devuelve un Score de Confianza Forense (0–100)
 * para que el administrador apruebe o rechace con fundamento.
 */
export async function analyzeKybForensic(input: {
  docImageDataUrl: string;
  merchantName: string;
  declaredId?: string | null;
}): Promise<KybForensicResult> {
  const imageDataUrl = input.docImageDataUrl;
  const mimeType = imageDataUrl.startsWith('data:image/png')
    ? 'image/png'
    : imageDataUrl.startsWith('data:image/jpeg')
      ? 'image/jpeg'
      : 'image/webp';
  const base64 = imageDataUrl.split(',')[1] ?? '';
  if (base64.length < 100) {
    throw new Error('El documento no se pudo leer. Pide al comercio que lo suba de nuevo');
  }

  const context = [
    `Nombre del negocio registrado: ${input.merchantName}`,
    input.declaredId ? `NIT o cédula que el comercio declaró: ${input.declaredId}` : 'El comercio no declaró NIT/cédula (verifica coherencia solo con el nombre).',
  ].join('\n');

  const jsonText = await callGemini({
    prompt: KYB_PROMPT + `\nDatos del comercio para cruzar:\n${context}`,
    image: { mimeType, data: base64 },
    temperature: 0.1,
  });

  interface ParsedKyb {
    doc_readable?: boolean;
    doc_type?: string | null;
    name_detected?: string | null;
    document_number_digits?: string | null;
    edited_signals?: boolean;
    score?: number;
    summary?: string;
    warnings?: string[];
  }
  const parsed = parseAiJson<ParsedKyb>(jsonText);

  // Cruce de coherencia: el nombre detectado en el documento debe compartir
  // palabras con el nombre registrado (o con el titular declarado).
  const nameDetected = (parsed.name_detected ?? '').toLowerCase();
  const merchantWords = `${input.merchantName} ${input.declaredId ?? ''}`.toLowerCase().split(/\s+/).filter((w) => w.length >= 4);
  const nameMatch = nameDetected !== '' && merchantWords.some((w) => nameDetected.includes(w));
  const edited = parsed.edited_signals === true;
  let score = typeof parsed.score === 'number' ? Math.min(100, Math.max(0, Math.round(parsed.score))) : 50;
  if (!nameMatch && parsed.doc_readable === true) score = Math.min(score, 45);
  if (edited) score = Math.min(score, 30);

  return {
    score,
    docReadable: parsed.doc_readable === true,
    docType: typeof parsed.doc_type === 'string' ? parsed.doc_type.slice(0, 20) : null,
    nameMatch,
    summary:
      typeof parsed.summary === 'string' && parsed.summary.trim() !== ''
        ? parsed.summary.trim().slice(0, 180)
        : nameMatch
          ? 'Documento coherente con los datos del comercio'
          : 'Documento revisado: verifica el nombre contra el registro antes de aprobar',
    warnings: Array.isArray(parsed.warnings)
      ? parsed.warnings.filter((w): w is string => typeof w === 'string' && w.trim() !== '').slice(0, 4)
      : edited
        ? ['Señales de edición detectadas en la imagen']
        : [],
  };
}

const TRUST_PROMPT = `Eres el auditor de seguridad de Impulso, una plataforma de ofertas locales en municipios rurales de Colombia (Gachetá, Cundinamarca).
Evalúa si un negocio registrado es coherente y seguro para operar frente a la comunidad, o si requiere revisión manual antes de otorgar la insignia de "Verificado".

Datos que recibirás: nombre del negocio, categoría, WhatsApp, referencia de dirección, nit/cédula (si la dio), link de redes sociales o Google Maps (si lo dio) y títulos de sus ofertas publicadas.

Criterios:
- Riesgo alto: nombre sin relación con una actividad comercial real, ofertas que pidan dinero por adelantado, giros, préstamos gota a gota, servicios ambiguos o sexuales, precios absurdos tipo "gana dinero fácil", WhatsApp sospechoso (muchos 0s o repetidos), sin datos de contacto verificables.
- Riesgo medio: le faltan datos de confianza (nit/cédula o link social) pero sus ofertas parecen legítimas de un negocio local.
- Riesgo bajo: datos coherentes, ofertas propias de comercio local (comida, transporte, agro, etc.), medios de contacto verificables.

Responde ÚNICAMENTE con este JSON:
{"level":"green"|"yellow","summary":"fracción corta para el administrador","warnings":["razón 1","razón 2"]}`;

/**
 * 🤖 Auditoría de confianza con IA: evalúa los datos del comercio y sus
 * ofertas publicadas y devuelve un semáforo rápido para el admin.
 */
export async function analyzeMerchantTrust(input: {
  businessName: string;
  category: string;
  whatsapp: string;
  municipality: string;
  addressReference?: string | null;
  nitOrCedula?: string | null;
  socialOrMapsLink?: string | null;
  offerTitles: string[];
}): Promise<MerchantTrustResult> {  const facts = [
    `Negocio: ${input.businessName}`,
    `Categoría: ${input.category}`,
    `WhatsApp: ${input.whatsapp}`,
    `Municipio: ${input.municipality}`,
    `Dirección/referencia: ${input.addressReference ?? '(no la dio)'}`,
    `NIT o cédula: ${input.nitOrCedula ?? '(no la dio)'}`,
    `Red social o Maps: ${input.socialOrMapsLink ?? '(no la dio)'}`,
    `Ofertas publicadas: ${input.offerTitles.length > 0 ? input.offerTitles.slice(0, 10).join(' | ') : '(ninguna aún)'}`,
  ].join('\n');

  const jsonText = await callGemini({
    systemInstruction: TRUST_PROMPT,
    prompt: facts,
    temperature: 0.2,
  });

  const parsed = parseAiJson<Partial<MerchantTrustResult>>(jsonText);
  const level = parsed.level === 'green' ? 'green' : 'yellow';
  return {
    level,
    summary: typeof parsed.summary === 'string' && parsed.summary.trim() !== '' ? parsed.summary.trim() : 'Revisión completada',
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings.filter((w): w is string => typeof w === 'string' && w.trim() !== '') : [],
  };
}

/** 🔍 V20.0 · Resultado de auditoría forense IA sobre una denuncia comunitaria. */
export interface ReportFraudAuditResult {
  /** 1 = denuncia real crítica; 10 = ataque falso / reporte por envidia casi seguro. */
  fraudScore: number;
  classification: 'fake_envy' | 'suspicious' | 'real_alert';
  conclusion: string;
  signals: string[];
  recommendedAction: string;
}

const REPORT_AUDIT_PROMPT = `Eres el Auditor Forense Antifraude de Impulso (Colombia). Analizas denuncias comunitarias contra ofertas locales para distinguir si es un ataque por envidia de competencia/troll o si el usuario reporta una estafa/incumplimiento real.

Devuelve ÚNICAMENTE este JSON exacto:
{
  "fraud_score": entero del 1 al 10 (10 = altísima probabilidad de reporte FALSO/envidia/ataque coordinado; 5 = dudoso; 1 = denuncia REAL CRÍTICA con evidencia concreta de estafa/peligro),
  "classification": "fake_envy" | "suspicious" | "real_alert",
  "conclusion": "dictamen ejecutivo en español (máx 180 chars, ej: 'Alta probabilidad de reporte falso por envidia (IP duplicada, lenguaje genérico)' o 'Alerta crítica: El usuario detalla un intento de estafa real')",
  "signals": ["señal forense 1", "señal forense 2", "señal forense 3"],
  "recommended_action": "acción sugerida al admin (ej: 'Absolver y limpiar denuncia' o 'Suspender oferta y revisar comercio')"
}

Criterios forenses clave:
- Señales de REPORTE FALSO / ENVIDIA (fraud_score 7 a 10): visitante sin reserva previa, IP o device_id repetido en múltiples reportes, redacción vaga/genérica sin hechos verificables ("es estafa", "malísimo", "no compren"), comercio verificado sin quejas previas.
- Señales de ALERTA REAL (fraud_score 1 a 4): comprador real verificado con reserva previa, relato específico con montos/platos/fechas/ubicaciones o pedidos de giros anticipados, lenguaje coherente de víctima.`;

/**
 * 🧠 V20.0 · Envía texto del reporte, IP, historial de reservas y datos de la oferta
 * a Gemini 2.5 Flash (/api/gemini) y devuelve Score de Fraude (1–10) + dictamen.
 */
export async function auditCommunityReportWithAI(input: {
  reason: string;
  detail: string | null;
  clientIp: string | null;
  deviceId: string | null;
  isVerifiedBuyer: boolean;
  sameIpReportsCount: number;
  sameDeviceReportsCount: number;
  reservationsHistorySummary: string[];
  offerTitle: string;
  offerDescription?: string;
  offerPromoPrice?: number;
  merchantName: string | null;
  merchantVerified?: boolean;
  totalOfferReports: number;
}): Promise<ReportFraudAuditResult> {
  const dossier = [
    `Motivo seleccionado: ${input.reason}`,
    `Detalle escrito por el reportante: ${input.detail ? `"${input.detail}"` : '(sin detalle)'}`,
    `Comprador con reserva verificada: ${input.isVerifiedBuyer ? 'SÍ (tiene reserva real)' : 'NO (visitante anónimo sin reserva)'}`,
    `IP del reportante: ${input.clientIp ?? '(desconocida)'} · Reportes recientes desde esa IP: ${input.sameIpReportsCount}`,
    `Dispositivo: ${input.deviceId ?? '(desconocido)'} · Reportes recientes desde ese dispositivo: ${input.sameDeviceReportsCount}`,
    `Historial de reservas ligado al dispositivo/IP: ${input.reservationsHistorySummary.length > 0 ? input.reservationsHistorySummary.join(' | ') : 'Ninguna reserva asociada'}`,
    `Oferta denunciada: "${input.offerTitle}"${input.offerPromoPrice != null ? ` ($${input.offerPromoPrice.toLocaleString('es-CO')})` : ''}`,
    input.offerDescription ? `Descripción de la oferta: "${input.offerDescription}"` : '',
    `Comercio: ${input.merchantName ?? 'Desconocido'} (${input.merchantVerified ? 'Verificado KYB' : 'No verificado'}) · Reportes totales en oferta: ${input.totalOfferReports}`,
  ]
    .filter(Boolean)
    .join('\n');

  const jsonText = await callGemini({
    systemInstruction: REPORT_AUDIT_PROMPT,
    prompt: dossier,
    temperature: 0.15,
  });

  const parsed = parseAiJson<{
    fraud_score?: number;
    classification?: string;
    conclusion?: string;
    signals?: string[];
    recommended_action?: string;
  }>(jsonText);

  const score = Math.min(10, Math.max(1, Math.round(Number(parsed.fraud_score) || 5)));
  const classification: ReportFraudAuditResult['classification'] =
    parsed.classification === 'fake_envy' || parsed.classification === 'suspicious' || parsed.classification === 'real_alert'
      ? parsed.classification
      : score >= 7
        ? 'fake_envy'
        : score <= 4
          ? 'real_alert'
          : 'suspicious';

  return {
    fraudScore: score,
    classification,
    conclusion:
      typeof parsed.conclusion === 'string' && parsed.conclusion.trim() !== ''
        ? parsed.conclusion.trim().slice(0, 220)
        : score >= 7
          ? 'Alta probabilidad de reporte falso por envidia.'
          : score <= 4
            ? 'Alerta crítica: posible incumplimiento o riesgo real.'
            : 'Caso dudoso: revisar evidencia antes de decidir.',
    signals: Array.isArray(parsed.signals)
      ? parsed.signals.filter((s): s is string => typeof s === 'string' && s.trim() !== '').slice(0, 4)
      : [],
    recommendedAction:
      typeof parsed.recommended_action === 'string' && parsed.recommended_action.trim() !== ''
        ? parsed.recommended_action.trim().slice(0, 100)
        : score >= 7
          ? 'Borrar denuncia y absolver oferta'
          : 'Verificar con comercio o pausar oferta',
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 🚀 AGENCIA IA V8 — Pipeline multi-pasada: PASADA 1 (estrategia y dirección
// de arte) → PASADA 2 (copywriting senior). PROHIBIDO el fallback tonto:
// si la IA falla se lanza un error con el motivo técnico EXACTO (el estudio
// lo muestra en un toast). Jamás se fabrica una campaña pegando el brief del
// usuario dentro de plantillas prefabricadas.
// ═══════════════════════════════════════════════════════════════════════════

export interface MarketingVisualHooks {
  slide1_hook: string;
  slide1_sub: string;
  slide2_headline: string;
  slide2_bullets: string[];
  slide3_cta: string;
}

export interface CampaignHeadline {
  /** Palabras del titular que van en blanco puro. */
  plain: string;
  /** Palabras clave del titular que van resaltadas en el color de acento. */
  highlight: string;
}

export type PriceMode = 'precio' | 'servicio';
export type CampaignFocus = 'remate' | 'prestigio' | 'confianza' | 'viral';

/** Rubros que la IA detecta en el brief (dirigen tema, layout y foto). */
export type IndustryType =
  | 'digital_tech'
  | 'gastronomia'
  | 'salud_belleza'
  | 'turismo_hospedaje'
  | 'agro_campo'
  | 'transporte_logistica'
  | 'comercio_retail'
  | 'servicios_profesionales'
  | 'construccion_hogar';

const INDUSTRY_IDS: IndustryType[] = [
  'digital_tech',
  'gastronomia',
  'salud_belleza',
  'turismo_hospedaje',
  'agro_campo',
  'transporte_logistica',
  'comercio_retail',
  'servicios_profesionales',
  'construccion_hogar',
];

const THEME_IDS = ['wood', 'marble', 'cyber', 'kraft', 'ember', 'emerald', 'obsidian', 'clinic', 'terracotta', 'pop', 'aurora', 'slate', 'arena', 'vino', 'oceano', 'carbon'] as const;
const LAYOUT_IDS = [
  'bento', 'magazine', 'diagonal', 'polaroid', 'arc', 'portal', 'swiss', 'split',
  'brutal', 'vip', 'cyber', 'rustic', 'retail', 'eco', 'cinema', 'float',
  // 🚀 V19 · futuristas (17–24)
  'hud', 'resort', 'menu', 'clinic', 'agro', 'diamond', 'flash', 'bento3d',
  // 💥 V21/V22 · asimétricos y orgánicos (25–30)
  'diagx', 'orbits', 'bleed', 'zen', 'immersive', 'collage',
] as const;

/** Dirección de arte por defecto de cada rubro (nunca siempre el mismo tema). */
export const INDUSTRY_ART: Record<IndustryType, { themeId: string; layoutId: string }> = {
  digital_tech: { themeId: 'cyber', layoutId: 'diagonal' },
  gastronomia: { themeId: 'wood', layoutId: 'bento' },
  salud_belleza: { themeId: 'marble', layoutId: 'swiss' },
  turismo_hospedaje: { themeId: 'emerald', layoutId: 'eco' },
  agro_campo: { themeId: 'emerald', layoutId: 'swiss' },
  transporte_logistica: { themeId: 'slate', layoutId: 'bento' },
  comercio_retail: { themeId: 'terracotta', layoutId: 'bento' },
  servicios_profesionales: { themeId: 'obsidian', layoutId: 'swiss' },
  construccion_hogar: { themeId: 'slate', layoutId: 'diagonal' },
};

/** Prompt fotográfico editorial curado por rubro (en inglés, sin texto). */
export const INDUSTRY_PHOTO_PROMPTS: Record<IndustryType, string> = {
  digital_tech:
    'modern digital marketing agency workspace, laptops with glowing analytics dashboards, neon indigo and violet rim light, cinematic depth of field, 8k commercial photography, no text, no logos',
  gastronomia:
    'gourmet dish hero shot on rustic wooden table, warm ember lighting, steam rising, shallow depth of field, 8k editorial food photography, no text, no logos',
  salud_belleza:
    'bright modern clinic interior, cyan and white palette, soft clinical daylight, professional dental and beauty equipment, 8k commercial photography, no text, no logos',
  agro_campo:
    'golden hour over green andean farmland, farmer hands holding fresh produce, cinematic warm light, 8k editorial photography, no text, no logos',
  turismo_hospedaje:
    'cozy wooden cabin with warm lights beside a mountain pool at dusk, lush andean greenery, mirror-like water reflections, cinematic 8k hospitality editorial photography, no text, no logos',
  transporte_logistica:
    'reliable cargo truck on a rural highway at dawn, graphite tones with subtle lime accents, cinematic wide shot, 8k commercial photography, no text, no logos',
  comercio_retail:
    'vibrant local storefront with fresh products and warm welcoming light, emerald green accents, 8k retail editorial photography, no text, no logos',
  servicios_profesionales:
    'elegant professional consulting meeting, obsidian and champagne gold tones, dramatic soft lighting, 8k corporate photography, no text, no logos',
  construccion_hogar:
    'professional construction site with tools and blueprints, graphite palette with lime accents, dramatic side light, 8k commercial photography, no text, no logos',
};

/** Estrategia visual devuelta por la PASADA 1. */
export interface ArtDirection {
  industryType: IndustryType;
  themeId: string;
  layoutId: string;
  /** Nombre comercial deducido del brief por la IA. */
  brandName: string;
  /** Título del servicio/producto estrella deducido del brief. */
  productTitle: string;
  /** Rubro/categoría COMERCIAL visible deducida del brief (NUNCA genérica). */
  categoryLabel: string;
  valueProposition: string;
  imagePromptEn: string;
}

export interface MarketingCampaign {
  industryType: IndustryType;
  themeId: string;
  layoutId: string;
  /** Promesa comercial de alto calibre (reescritura del brief por la IA). */
  valueProposition: string;
  /** Sello superior sugerido para el afiche (ej: "💎 ALTA PRECISIÓN"). */
  badgeText: string;
  /** Titular de agencia a dos tonos (blanco + palabras clave en acento). */
  headline: CampaignHeadline;
  sub: string;
  /** 3 beneficios ultra persuasivos con emoji incluido. */
  benefits: string[];
  cta: string;
  /** Texto del bloque de precio cuando el negocio no maneja precio fijo. */
  priceLabel: string | null;
  /** Prompt fotográfico comercial EN INGLÉS para generar la imagen ideal. */
  imagePromptEn: string;
  visualHooks: MarketingVisualHooks;
  whatsappStatusSequence: { status1: string; status2: string; status3: string };
  socialMediaCopy: { pas: string; aida: string };
  videoReelScript: { t0_3: string; t3_10: string; t10_15: string };
  salesClosingTemplates: { priceReply: string; hesitantReply: string; dispatchUpsell: string };
  /** Mensaje que escribirá el CLIENTE al tocar el enlace de la línea 1 (ventas). */
  waLine1Msg: string;
  /** Mensaje del cliente para la línea de domicilios/cotizaciones. */
  waLine2Msg: string;
  /** Mensaje del cliente para planes especiales/eventos/alianzas. */
  waLine3Msg: string;
  /** 4 mensajes de difusión 100% redactados por IA al giro del negocio. */
  dispatchVersions: string[];
}

export interface CampaignInput {
  businessName: string;
  slogan: string;
  /** 🧠 Brief libre: qué hace el negocio, qué servicio promociona, público, etc. */
  brief: string;
  product: string;
  /** 💰 precio exacto vs 💬 servicio/cotización. */
  priceMode: PriceMode;
  normalPrice: number | null;
  promoPrice: number | null;
  /** Texto personalizado de cotización (ej: "Valoración Sin Costo"). */
  priceLabel: string;
  address: string;
  municipality: string;
  /** Enfoque psicológico del anuncio. */
  focus: CampaignFocus;
  targetUrl: string;
  /** Categoría del comercio registrado (ayuda a la PASADA 1 a clasificar). */
  categoryHint?: string;
  /** Tema/layout de la generación anterior: la IA debe variarlos SIEMPRE. */
  previousThemeId?: string;
  previousLayoutId?: string;
}

/** Normaliza espacios: NUNCA dos palabras pegadas, NUNCA bordes sucios. */
export function normSpaces(v: unknown): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '';
}

/** Mapea la categoría del comercio a un rubro de agencia. */
export function industryFromHint(categoryHint?: string): IndustryType {
  switch (categoryHint) {
    case 'comida':
      return 'gastronomia';
    case 'transporte_flete':
      return 'transporte_logistica';
    case 'agro_mercado':
      return 'agro_campo';
    case 'hoteles_turismo':
      return 'comercio_retail';
    case 'salud_belleza':
      return 'salud_belleza';
    case 'hogar_construccion':
      return 'construccion_hogar';
    case 'servicios_comercios':
      return 'servicios_profesionales';
    default:
      return 'comercio_retail';
  }
}

/** Ficha de hechos del negocio (fuente única para las 2 pasadas). */
function campaignFacts(input: CampaignInput): string {
  return [
    `Negocio/marca: ${input.businessName}`,
    `Eslogan o rubro: ${input.slogan || '(no hay)'}`,
    `🧠 BRIEF LIBRE del negocio (analízalo en profundidad, NO lo copies literal): ${input.brief || '(no hay brief, deduce del producto)'}`,
    `Producto/promoción estrella: ${input.product || '(no hay, elige un enfoque del brief)'}`,
    `Categoría registrada: ${input.categoryHint ?? '(no hay)'}`,
    `Modalidad de precio: ${input.priceMode === 'servicio' ? 'SERVICIO/COTIZACIÓN (no inventes precios tachados, genera price_label)' : 'PRECIO DE OFERTA exacto'}`,
    input.priceMode === 'servicio' && input.priceLabel.trim() ? `Etiqueta de precio personalizada del admin: "${input.priceLabel.trim()}"` : '',
    `Precio normal: ${input.normalPrice != null ? `$${input.normalPrice.toLocaleString('es-CO')}` : '(no aplica)'}`,
    `Precio promoción: ${input.promoPrice != null ? `$${input.promoPrice.toLocaleString('es-CO')}` : '(no aplica)'}`,
    `Dirección o referencia: ${input.address || '(no hay)'}`,
    `Municipio: ${input.municipality}`,
    `Enfoque psicológico del anuncio: ${input.focus}`,
    `Enlace/WhatsApp de destino: ${input.targetUrl}`,
  ]
    .filter(Boolean)
    .join('\n');
}

// ── PASADA 1 · Análisis estratégico y dirección de arte ────────────────────

const ART_SYSTEM_PROMPT = `Eres el Director de Arte y Estratega de Growth de una agencia de publicidad de alto nivel especializada en municipios rurales de Colombia (Cundinamarca).
El BRIEF del negocio es tu FUENTE MAESTRA ABSOLUTA: de él deduces el nombre, el producto/servicio estrella, el rubro, la promesa y la fotografía (aunque sea una sola frase como "Es un servicio de marketing digital nuevo" o "Vendemos trucha arcoíris y almuerzos campestres").
Analizarás el brief y definirás la ESTRATEGIA VISUAL y COMERCIAL. Devuelve ÚNICAMENTE un JSON exacto:
{
 "industry_type": uno de [digital_tech, gastronomia, salud_belleza, turismo_hospedaje, agro_campo, transporte_logistica, comercio_retail, servicios_profesionales, construccion_hogar],
 "brand_name": "nombre comercial corto y potente del negocio (1 a 3 palabras): si el brief ya lo da, devuélvelo limpio; si NO lo da, crea uno creíble y memorable para el giro deducido. PROHIBIDO usar la palabra 'Impulso'",
 "product_title": "título del servicio o producto estrella DEDUCIDO del brief (máx 6 palabras, reescrito con vocabulario de agencia, no literal)",
 "category_label": "rubro/categoría COMERCIAL y VISIBLE del afiche en español (2 a 5 palabras, específico del giro, ej: 'Marketing Digital & Ventas', 'Comida Rápida Casera', 'Odontología Moderna', 'Insumos Agropecuarios'). PROHIBIDO genéricos tipo 'Servicios' o 'Comercio'",
 "theme_id": uno de [wood, marble, cyber, kraft, ember, emerald, obsidian, clinic, terracotta, pop, aurora, slate, arena, vino, oceano, carbon]. Varía entre las 4 familias estéticas (Neón Cyber: cyber/aurora/oceano; Editorial Minimalista: marble/clinic/slate/arena; Rústico Gourmet: wood/kraft/ember/terracotta/emerald; Lujo Dorado: obsidian/vino/pop) según el brief y NUNCA repitas el anterior.
 "layout_id": uno de [bento, magazine, diagonal, polaroid, arc, portal, swiss, split, brutal, vip, cyber, rustic, retail, eco, cinema, float, hud, resort, menu, clinic, agro, diamond, flash, bento3d, diagx, orbits, bleed, zen, immersive, collage]. Prioriza composiciones orgánicas y asimétricas (immersive, collage, diagx, orbits, bleed, magazine, float, bento3d, zen, diamond, diagonal, split, portal) y NUNCA repitas el anterior.
 "value_proposition": "la promesa comercial de alto calibre del negocio: transforma la idea básica del brief en un beneficio concreto, específico y creíble. PROHIBIDO copiar frases literales del brief: reescríbelas con vocabulario de agencia senior",
 "image_prompt_en": "hyper-detailed commercial editorial photography prompt IN ENGLISH of EXACTLY what the brief describes (its real products, workspace or service in action): subject, environment, cinematic 8k lighting setup, lens and mood. The image must NEVER contain text, logos or watermarks"
}
En el prompt recibirás además una SEMILLA CREATIVA y el tema/layout de la generación ANTERIOR: usa un ángulo creativo fresco y NUNCA repitas ese tema ni ese layout.`;

const ART_SCHEMA: Record<string, unknown> = {
  type: SchemaType.OBJECT,
  properties: {
    industry_type: { type: SchemaType.STRING, format: 'enum', enum: INDUSTRY_IDS },
    brand_name: { type: SchemaType.STRING },
    product_title: { type: SchemaType.STRING },
    category_label: { type: SchemaType.STRING },
    theme_id: { type: SchemaType.STRING, format: 'enum', enum: [...THEME_IDS] },
    layout_id: { type: SchemaType.STRING, format: 'enum', enum: [...LAYOUT_IDS] },
    value_proposition: { type: SchemaType.STRING },
    image_prompt_en: { type: SchemaType.STRING },
  },
  required: ['industry_type', 'brand_name', 'product_title', 'category_label', 'theme_id', 'layout_id', 'value_proposition', 'image_prompt_en'],
};

/** Nombres de marca de reserva por rubro (solo si la IA omite brand_name). */
const INDUSTRY_NAMES: Record<IndustryType, string> = {
  digital_tech: 'Agencia Pro',
  gastronomia: 'Sabor del Pueblo',
  salud_belleza: 'Vitalidad',
  turismo_hospedaje: 'Refugio del Valle',
  agro_campo: 'Tierra Viva',
  transporte_logistica: 'Ruta Segura',
  comercio_retail: 'El Almacén',
  servicios_profesionales: 'Primera Clase',
  construccion_hogar: 'Obra Maestra',
};

/** Etiquetas de categoría visibles de reserva (solo si la IA omite category_label). */
const INDUSTRY_CATEGORY_LABELS: Record<IndustryType, string> = {
  digital_tech: 'Marketing Digital & Ventas',
  gastronomia: 'Comida & Sabor Casero',
  salud_belleza: 'Salud & Belleza',
  turismo_hospedaje: 'Turismo, Cabañas & Piscinas',
  agro_campo: 'Agro & Campo',
  transporte_logistica: 'Transporte & Domicilios',
  comercio_retail: 'Tienda & Comercio Local',
  servicios_profesionales: 'Servicios Profesionales',
  construccion_hogar: 'Construcción & Hogar',
};

/** 🧠 PASADA 1: analiza el brief (fuente maestra) y devuelve rubro + marca +
 *  producto + tema + layout + promesa. Con semilla creativa, rotación de ángulo
 *  comercial y evitación del tema/layout anterior para que CADA clic sea único. */
const CREATIVE_ANGLES = [
  'Contraste radical e impacto inmediato de escasez (urgencia limpia, sin gritar)',
  'Editorial aspiracional de lujo local y exclusividad artesanal',
  'Cercanía humana y orgullo del territorio con beneficio tangible al instante',
  'Disrupción tecnológica/moderna y rapidez en 1 clic sin complicaciones',
  'Prueba social y autoridad de experto número 1 en el municipio',
] as const;

export async function generateArtDirection(input: CampaignInput): Promise<ArtDirection> {
  const angle = CREATIVE_ANGLES[Math.floor(Math.random() * CREATIVE_ANGLES.length)];
  const seedLine = `SEMILLA CREATIVA #${Math.floor(Math.random() * 9000 + 1000)} · ÁNGULO OBLIGATORIO: ${angle}. Usa una metáfora, un titular y una composición totalmente nuevas.`;
  const avoidLine =
    input.previousThemeId || input.previousLayoutId
      ? `La generación ANTERIOR usó tema "${input.previousThemeId ?? '—'}" y layout "${input.previousLayoutId ?? '—'}": ELIGE tema y layout DIFERENTES esta vez.`
      : '';
  const jsonText = await callGemini({
    systemInstruction: ART_SYSTEM_PROMPT,
    prompt: [campaignFacts(input), seedLine, avoidLine].filter(Boolean).join('\n\n'),
    temperature: 0.85,
    responseSchema: ART_SCHEMA,
  });
  let raw: Record<string, unknown>;
  try {
    raw = parseAiJson<Record<string, unknown>>(jsonText);
  } catch {
    throw new Error('La IA (pasada 1) no devolvió un JSON de estrategia válido. Intenta de nuevo.');
  }
  const industry: IndustryType = INDUSTRY_IDS.includes(raw.industry_type as IndustryType)
    ? (raw.industry_type as IndustryType)
    : industryFromHint(input.categoryHint);
  const art: ArtDirection = {
    industryType: industry,
    brandName: normSpaces(raw.brand_name) || input.businessName.trim() || INDUSTRY_NAMES[industry],
    productTitle: normSpaces(raw.product_title) || input.product.trim() || INDUSTRY_NAMES[industry],
    categoryLabel: normSpaces(raw.category_label) || INDUSTRY_CATEGORY_LABELS[industry],
    themeId: THEME_IDS.includes(raw.theme_id as (typeof THEME_IDS)[number])
      ? (raw.theme_id as string)
      : INDUSTRY_ART[industry].themeId,
    layoutId: LAYOUT_IDS.includes(raw.layout_id as (typeof LAYOUT_IDS)[number])
      ? (raw.layout_id as string)
      : INDUSTRY_ART[industry].layoutId,
    valueProposition: normSpaces(raw.value_proposition),
    imagePromptEn:
      normSpaces(raw.image_prompt_en) || INDUSTRY_PHOTO_PROMPTS[industry],
  };
  if (!art.valueProposition) {
    throw new Error('La IA (pasada 1) no definió la promesa de valor. Pulsa ✨ de nuevo.');
  }
  return art;
}

// ── PASADA 2 · Copywriting senior de agencia con la estrategia de la 1 ──────

const COPY_SYSTEM_PROMPT = `Eres el Copywriter Senior y Director Creativo de una agencia de publicidad experta en municipios rurales de Colombia (Gachetá, Cundinamarca).
Recibirás la ESTRATEGIA de la campaña (rubro, promesa de valor, tema y layout) y los datos del negocio. Escribes la campaña completa. Devuelve ÚNICAMENTE un JSON con esta estructura exacta:
{
 "badge_text": "sello superior ESPECÍFICO del giro: máximo 4 palabras en MAYÚSCULAS, SIN emojis ni iconos (el diseño dibuja su propio icono vectorial de agencia). Ej: 'IMPULSA TUS VENTAS', 'ALTA PRECISIÓN', 'SABOR ARTESANAL'",
 "headline": {
   "plain": "3 a 6 palabras IMPACTANTES que irán en blanco, SIEMPRE separadas por espacios correctos (ej: 'Multiplica tus clientes y')",
   "highlight": "3 a 5 palabras de cierre poderoso con espacios correctos, irán resaltadas en el color de acento (ej: 'domina las redes hoy')"
 },
 "sub": "una línea ejecutiva elegante que explica el servicio/producto",
 "benefits": ["3 beneficios 100% ESPECÍFICOS del negocio, texto limpio SIN emojis ni iconos (el diseño los acompaña con iconografía vectorial propia)"],
 "cta": "llamado a la acción urgente y claro",
 "price_label": "si el negocio NO maneja precio fijo: texto inteligente de cotización/acción (ej: 'Diagnóstico digital gratis', 'Agenda tu asesoría hoy', 'Valoración sin costo'). Si SÍ hay precio de oferta devuelve null",
 "visualHooks": {
   "slide1_hook": "titular magnético de 4 a 7 palabras que detiene el scroll",
   "slide1_sub": "subtítulo provocador corto",
   "slide2_headline": "promesa de valor + beneficio irresistible (máx 10 palabras)",
   "slide2_bullets": ["beneficio corto, texto limpio sin emojis", "beneficio corto, texto limpio sin emojis", "beneficio corto, texto limpio sin emojis"],
   "slide3_cta": "llamado a la acción urgente con gatillo de escasez"
 },
 "whatsappStatusSequence": {
   "status1": "Estado de WhatsApp de la mañana usando *negrita* y _cursiva_ nativas (máx 3 líneas)",
   "status2": "Estado del mediodía con *precio o beneficio clave* en negrita y _llamado sutil_ en cursiva (máx 4 líneas)",
   "status3": "Estado de cierre de tarde/noche con *urgencia/escasez* + _garantía_ + 👉 link"
 },
 "socialMediaCopy": {
   "pas": "copy completo y persuasivo para Instagram/Facebook con fórmula PAS, SALTOS DE LÍNEA LIMPIOS entre párrafos, y una nube de 6 a 10 #Hashtags locales (ej: #Gachetá, #Guavio, municipio del negocio, rubro y producto) al final",
   "aida": "copy optimizado EXCLUSIVAMENTE para WhatsApp usando sintaxis real (*negrita*, _cursiva_), saltos limpios y llamado directo al chat"
 },
 "videoReelScript": {
   "t0_3": "EXACTAMENTE con formato '[Cámara: indicación visual/plano de cámara] Texto: \"frase exacta de gancho para decir a cámara\"' (segundos 0-3)",
   "t3_10": "EXACTAMENTE con formato '[Cámara: indicación visual mostrando producto/servicio] Texto: \"demostración y beneficio clave\"' (segundos 3-10)",
   "t10_15": "EXACTAMENTE con formato '[Cámara: plano final del local/logo/contacto] Texto: \"cierre urgente con ubicación y llamado a WhatsApp\"' (segundos 10-15)"
 },
 "salesClosingTemplates": {
   "priceReply": "respuesta lista cuando el cliente pregunta ¿precio?: da el precio o invita a cotizar y ofrece combo/domicilio",
   "hesitantReply": "respuesta para clientes indecisos con escasez o garantía",
   "dispatchUpsell": "confirmación de despacho ejecutiva y elegante, con venta cruzada SUTIL y trato de cliente fiel (PROHIBIDO el patrón ¿Te sumamos X?: no ofrezcas beneficios sueltos como si fueran adornos)"
 },
 "wa_line1_msg": "mensaje EXACTO que escribirá el CLIENTE interesado al tocar el enlace de VENTAS, redactado a la medida del giro real (ej. marketing digital: '¡Hola! Vi su publicidad de marketing digital y quiero impulsar las ventas de mi negocio. ¿Me brindan una asesoría?')",
 "wa_line2_msg": "mensaje del CLIENTE para la línea de DOMICILIOS/COTIZACIONES, redactado a la medida del giro",
 "wa_line3_msg": "mensaje del CLIENTE para PLANES ESPECIALES/eventos/alianzas, redactado a la medida del giro",
 "dispatch_versions": [
  "4 mensajes COMPLETOS, CREATIVOS y DIFERENTES entre sí (cada uno con gancho propio, el producto/servicio real, y llamado a la acción) para que el comerciante difunda en GRUPOS y ESTADOS de WhatsApp, 100% adaptados al giro del negocio. PROHIBIDO usar frases fijas tipo 'El pueblo ya está apartando' o 'Necesito {producto} en cantidad para un evento': todo debe sonar escrito por un publicista para ESTE negocio"
 ]
}
REGLAS DE ORO:
- PROHIBIDO copiar frases literales del brief del usuario ni rellenar con plantillas genéricas: todo el copy debe nacer de la promesa de valor de la estrategia.
- PROHIBIDO el patrón "¿Te sumamos ...?" en dispatchUpsell: la confirmación de despacho es ejecutiva (confirma el pedido, la entrega y ofrece el trato de cliente fiel con naturalidad).
- 🎯 CERO EMOJIS en badge_text, headline, sub, benefits y cta: el afiche usa iconografía vectorial propia de agencia. Los emojis solo se permiten en los textos de WhatsApp/redes (status, pas, aida, dispatch).
- Los beneficios deben describir algo que SOLO ese negocio puede decir.
- headlines y textos SIEMPRE con espacios correctos entre palabras (jamás palabras pegadas tipo 'ImpulsoHOY').
- PROHIBIDO usar el nombre 'Impulso' como marca del cliente.
- Español colombiano cercano y honesto; adapta el tono al enfoque psicológico indicado.`;

/** 🎯 V21 · Estética de agencia: elimina CUALQUIER pictográfico/emoji de un
 *  texto del afiche (los iconos los dibuja el sistema con SVG vectorial). */
function stripPictographics(text: string): string {
  return text
    .replace(/\p{Extended_Pictographic}[\uFE0F\u200D]?/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Normaliza la respuesta de la PASADA 2 contra el contrato V8. */
function normalizeCampaign(raw: Partial<MarketingCampaign> & Record<string, unknown>, input: CampaignInput, art: ArtDirection): MarketingCampaign {
  const vh = (raw.visualHooks ?? {}) as Partial<MarketingVisualHooks>;
  const ws = (raw.whatsappStatusSequence ?? {}) as Partial<MarketingCampaign['whatsappStatusSequence']>;
  const sc = (raw.socialMediaCopy ?? {}) as Partial<MarketingCampaign['socialMediaCopy']>;
  const vr = (raw.videoReelScript ?? {}) as Partial<MarketingCampaign['videoReelScript']>;
  const cl = (raw.salesClosingTemplates ?? {}) as Partial<MarketingCampaign['salesClosingTemplates']>;
  const hl = (raw.headline ?? {}) as Partial<CampaignHeadline>;
  const isService = input.priceMode === 'servicio';

  const plain = normSpaces(hl.plain);
  const highlight = normSpaces(hl.highlight);
  if (!plain || !highlight) {
    throw new Error('La IA (pasada 2) no devolvió un titular completo. Pulsa ✨ de nuevo.');
  }
  const benefits = Array.isArray(raw.benefits)
    ? (raw.benefits as unknown[])
        .filter((b): b is string => typeof b === 'string' && b.trim() !== '')
        .map((b) => stripPictographics(b))
        .filter((b) => b !== '')
        .slice(0, 3)
    : [];
  if (benefits.length < 3) {
    throw new Error('La IA (pasada 2) no devolvió los 3 beneficios del negocio. Pulsa ✨ de nuevo.');
  }
  const customLabel = input.priceLabel.trim();
  const listStr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').slice(0, 3) : [];
  const dv = Array.isArray(raw.dispatch_versions)
    ? (raw.dispatch_versions as unknown[]).filter((x): x is string => typeof x === 'string' && x.trim() !== '').slice(0, 4)
    : [];
  const prod = input.product.trim() || 'su promoción';
  const biz = input.businessName.trim() || 'el negocio';

  return {
    industryType: art.industryType,
    themeId: art.themeId,
    layoutId: art.layoutId,
    valueProposition: art.valueProposition,
    badgeText: stripPictographics(normSpaces(raw.badge_text)) || (input.municipality ? `${input.municipality.toUpperCase()}` : 'NEGOCIO DESTACADO'),
    headline: { plain, highlight },
    sub: normSpaces(raw.sub) || art.valueProposition,
    benefits,
    cta: normSpaces(raw.cta) || (isService ? '💬 Escríbenos por WhatsApp' : '👉 Escríbenos por WhatsApp'),
    priceLabel: customLabel || normSpaces(raw.price_label) || (input.promoPrice == null ? '💬 Escríbenos por WhatsApp' : null),
    imagePromptEn: art.imagePromptEn,
    visualHooks: {
      slide1_hook: normSpaces(vh.slide1_hook),
      slide1_sub: normSpaces(vh.slide1_sub),
      slide2_headline: normSpaces(vh.slide2_headline),
      slide2_bullets: listStr(vh.slide2_bullets),
      slide3_cta: normSpaces(vh.slide3_cta),
    },
    whatsappStatusSequence: {
      status1: normSpaces(ws.status1),
      status2: normSpaces(ws.status2),
      status3: normSpaces(ws.status3),
    },
    socialMediaCopy: {
      pas: normSpaces(sc.pas),
      aida: normSpaces(sc.aida),
    },
    videoReelScript: {
      t0_3: normSpaces(vr.t0_3),
      t3_10: normSpaces(vr.t3_10),
      t10_15: normSpaces(vr.t10_15),
    },
    salesClosingTemplates: {
      priceReply: normSpaces(cl.priceReply),
      hesitantReply: normSpaces(cl.hesitantReply),
      dispatchUpsell: normSpaces(cl.dispatchUpsell),
    },
    waLine1Msg: normSpaces(raw.wa_line1_msg) || `¡Hola! Vi la publicidad de ${prod} en ${biz} y me interesa 🙌 ¿Me dan más información?`,
    waLine2Msg: normSpaces(raw.wa_line2_msg) || `¡Hola! Quiero pedir/cotizar ${prod} a domicilio 🛵 Mi dirección es:`,
    waLine3Msg: normSpaces(raw.wa_line3_msg) || `¡Hola! Me interesan los planes especiales de ${biz} 📦 ¿Me cuentan opciones?`,
    dispatchVersions: dv,
  };
}

const CAMPAIGN_SCHEMA: Record<string, unknown> = {
  type: SchemaType.OBJECT,
  properties: {
    badge_text: { type: SchemaType.STRING },
    headline: {
      type: SchemaType.OBJECT,
      properties: { plain: { type: SchemaType.STRING }, highlight: { type: SchemaType.STRING } },
      required: ['plain', 'highlight'],
    },
    sub: { type: SchemaType.STRING },
    benefits: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    cta: { type: SchemaType.STRING },
    price_label: { type: SchemaType.STRING, nullable: true },
    visualHooks: {
      type: SchemaType.OBJECT,
      properties: {
        slide1_hook: { type: SchemaType.STRING },
        slide1_sub: { type: SchemaType.STRING },
        slide2_headline: { type: SchemaType.STRING },
        slide2_bullets: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        slide3_cta: { type: SchemaType.STRING },
      },
      required: ['slide1_hook', 'slide1_sub', 'slide2_headline', 'slide2_bullets', 'slide3_cta'],
    },
    whatsappStatusSequence: {
      type: SchemaType.OBJECT,
      properties: {
        status1: { type: SchemaType.STRING },
        status2: { type: SchemaType.STRING },
        status3: { type: SchemaType.STRING },
      },
      required: ['status1', 'status2', 'status3'],
    },
    socialMediaCopy: {
      type: SchemaType.OBJECT,
      properties: { pas: { type: SchemaType.STRING }, aida: { type: SchemaType.STRING } },
      required: ['pas', 'aida'],
    },
    videoReelScript: {
      type: SchemaType.OBJECT,
      properties: { t0_3: { type: SchemaType.STRING }, t3_10: { type: SchemaType.STRING }, t10_15: { type: SchemaType.STRING } },
      required: ['t0_3', 't3_10', 't10_15'],
    },
    salesClosingTemplates: {
      type: SchemaType.OBJECT,
      properties: { priceReply: { type: SchemaType.STRING }, hesitantReply: { type: SchemaType.STRING }, dispatchUpsell: { type: SchemaType.STRING } },
      required: ['priceReply', 'hesitantReply', 'dispatchUpsell'],
    },
    wa_line1_msg: { type: SchemaType.STRING },
    wa_line2_msg: { type: SchemaType.STRING },
    wa_line3_msg: { type: SchemaType.STRING },
    dispatch_versions: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
  },
  required: ['badge_text', 'headline', 'sub', 'benefits', 'cta', 'visualHooks', 'whatsappStatusSequence', 'socialMediaCopy', 'videoReelScript', 'salesClosingTemplates', 'wa_line1_msg', 'wa_line2_msg', 'wa_line3_msg', 'dispatch_versions'],
};

/**
 * 🎬 PASADA 2: copywriting senior de agencia usando la estrategia de la PASADA 1.
 * Si la IA falla lanza el error técnico exacto (el estudio lo muestra en un
 * toast): NUNCA devuelve una campaña fabricada con plantillas prefabricadas.
 */
export async function generateCampaignCopy(input: CampaignInput, art: ArtDirection): Promise<MarketingCampaign> {
  const strategy = [
    `ESTRATEGIA DE LA PASADA 1 (úsala como eje de TODO el copy):`,
    `· Rubro detectado: ${art.industryType}`,
    `· Categoría visible del afiche: ${art.categoryLabel}`,
    `· Nombre de marca: ${art.brandName}`,
    `· Producto/servicio estrella deducido: ${art.productTitle}`,
    `· Promesa de valor central: ${art.valueProposition}`,
    `· Tema visual: ${art.themeId} · Layout: ${art.layoutId}`,
    '',
    campaignFacts(input),
  ].join('\n');
  const jsonText = await callGemini({
    systemInstruction: COPY_SYSTEM_PROMPT,
    prompt: strategy,
    temperature: 0.9,
    responseSchema: CAMPAIGN_SCHEMA,
  });
  let raw: Partial<MarketingCampaign> & Record<string, unknown>;
  try {
    raw = parseAiJson<Partial<MarketingCampaign> & Record<string, unknown>>(jsonText);
  } catch {
    throw new Error('La IA (pasada 2) no devolvió un JSON de campaña válida. Intenta de nuevo.');
  }
  return normalizeCampaign(raw, input, art);
}

// ═══════════════════════════════════════════════════════════════════════════
// 🧠 MOTOR SINTÉTICO V11 · synthesizeSmartCampaignFromBrief
// Si la API de Gemini falla (cuota, red, timeout) está PROHIBIDO abortar o
// dejar cajas vacías: este motor analiza el brief PALABRA POR PALABRA, detecta
// entre 20+ giros de negocio y construye una campaña completa localmente, con
// decenas de combinaciones creativas rotadas por semilla en cada clic.
// ═══════════════════════════════════════════════════════════════════════════

interface Niche {
  id: string;
  re: RegExp;
  industry: IndustryType;
  labels: string[];
  names: string[];
  products: string[];
  /** Titulares creativos [parte blanca, palabras de acento]. */
  headlines: Array<[string, string]>;
  subs: string[];
  badges: string[];
  benefits: string[];
  wa: [string, string, string];
  /** Gancho editorial para el copy largo (PAS, AIDA, estados, reel). */
  hook: string;
  theme: string;
  layout: string;
}

const NICHES: Niche[] = [
  {
    id: 'marketing', re: /marketing|publicidad|redes|agencia|social|anuncio|branding|seo|emprendimien|digital/,
    industry: 'digital_tech', labels: ['Marketing Digital & Ventas', 'Agencia de Crecimiento Digital'],
    names: ['Agencia Pro', 'Impulsa Digital', 'Conexión Creativa'],
    products: ['Impulso de ventas digitales', 'Gestión profesional de redes', 'Campañas que venden'],
    headlines: [
      ['Multiplica tus clientes', 'con marketing digital'],
      ['Tu negocio en la cima', 'de las redes sociales'],
      ['Más ventas cada mes', 'con publicidad experta'],
    ],
    subs: ['Estrategia, diseño y pauta publicitaria hecha por expertos', 'Convertimos tu WhatsApp en una máquina de ventas'],
    badges: ['🚀 IMPULSA TUS VENTAS', '📈 CRECE CON EXPERTOS'],
    benefits: ['📈 Más clientes cada semana', '🎯 Publicidad dirigida a tu gente', '📱 Redes profesionales que venden', '🕒 Ahorra horas de trabajo', '💬 Soporte y asesoría directa', '📊 Reportes claros de resultados'],
    wa: ['¡Hola! Vi su publicidad de marketing digital y quiero impulsar las ventas de mi negocio 🙌 ¿Me brindan una asesoría?', '¡Hola! Quiero cotizar el plan de publicidad para mi negocio 📱 ¿Me cuentan precios?', '¡Hola! Me interesan los planes especiales y alianzas de la agencia 🚀 ¿Me dan más detalles?'],
    hook: 'un negocio que se ve profesional vende el doble',
    theme: 'cyber', layout: 'diagonal',
  },
  {
    id: 'web', re: /web|p[aá]gina|software|sistema|programa|app|datos/,
    industry: 'digital_tech', labels: ['Webs & Sistemas a Medida', 'Tecnología para tu Negocio'],
    names: ['WebStudio', 'Códigos del Pueblo', 'Nexo Tech'],
    products: ['Tu página web profesional', 'Sistemas que ordenan tu negocio', 'Presencia digital completa'],
    headlines: [
      ['Tu negocio online', 'con página web propia'],
      ['Ordena tu negocio', 'con sistemas a medida'],
      ['Vende en internet', 'las 24 horas del día'],
    ],
    subs: ['Diseño web moderno, dominio propio y soporte permanente', 'De la idea al sistema funcionando, sin dolores de cabeza'],
    badges: ['💻 TECNOLOGÍA DE VERDAD', '🌐 TU NEGOCIO ONLINE'],
    benefits: ['🌐 Página web profesional', '📱 Se ve perfecta en celulares', '🔒 Datos de tu negocio seguros', '⚡ Entrega rápido y con soporte', '🧭 Capacitación incluida', '💸 Pagos cómodos por cuotas'],
    wa: ['¡Hola! Vi su servicio de páginas web y quiero una para mi negocio 🙌 ¿Me dan precio y tiempos?', '¡Hola! Quiero cotizar un sistema para administrar mi negocio 💻 ¿Me asesoran?', '¡Hola! Me interesan los planes de mantenimiento y soporte web 🛠️ ¿Me cuentan?'],
    hook: 'tu mejor vendedor trabaja 24/7: tu página web',
    theme: 'cyber', layout: 'swiss',
  },
  {
    id: 'restaurante', re: /restaurante|almuerzo|men[uú]|corrientazo|gastronom|saz[oó]n|comida/,
    industry: 'gastronomia', labels: ['Comida Casera & Almuerzos', 'Restaurante de Sazón Auténtica'],
    names: ['Sabor del Pueblo', 'La Casona', 'Fuego Lento'],
    products: ['Almuerzo ejecutivo del día', 'Menú completo con sopa y jugo', 'Comida casera a domicilio'],
    headlines: [
      ['El sabor de casa', 'en cada almuerzo'],
      ['Almuerzos completos', 'a precio de pueblo'],
      ['Comida rica y fresca', 'todos los días'],
    ],
    subs: ['Sopa, seco, jugo natural y ensalada · servicio a domicilio', 'Ingredientes frescos del mercado y sazón de abuela'],
    badges: ['🍽️ SABOR ARTESANAL', '🥘 HECHO CON AMOR'],
    benefits: ['🥘 Sazón casera de verdad', '🥗 Ingredientes frescos cada día', '🛵 Domicilio caliente y puntual', '💰 Porciones generosas', '⏰ Sirve desde temprano', '🎉 Platos para eventos y reuniones'],
    wa: ['¡Hola! ¿Qué trae el almuerzo de hoy? Quiero pedir uno a domicilio 🍱 Mi dirección es:', '¡Hola! Quiero encargar almuerzos para mi oficina 🍽️ ¿Me dan precios y menú?', '¡Hola! Quiero cotizar el servicio de comida para un evento 🎉 ¿Me cuentan opciones?'],
    hook: 'una mesa bien servida reúne a todo el pueblo',
    theme: 'wood', layout: 'bento',
  },
  {
    id: 'asadero', re: /asado|parrilla|carne|pollo|chuzo|costilla|brasa|asadero/,
    industry: 'gastronomia', labels: ['Asados & Parrilla Gourmet', 'Brasa, Carbón y Sabor'],
    names: ['El Roble', 'Brasa Viva', 'Parrilla del Pueblo'],
    products: ['Costillas BBQ a la brasa', 'Pollo asado entero', 'Chuzos y parrilladas'],
    headlines: [
      ['Sabor a brasa', 'y carbón de verdad'],
      ['Las mejores costillas', 'del municipio'],
      ['Parrilladas VIP', 'para tu reunión'],
    ],
    subs: ['Carnes maduradas, fuego lento y salsas de la casa', 'Pedidos por encargo para reuniones y eventos'],
    badges: ['🔥 FUEGO Y SABOR', '🥩 BRASA GOURMET'],
    benefits: ['🥩 Carnes frescas certificadas', '🔥 Asadas al carbón, nunca microondas', '🛵 Domicilio en cajas térmicas', '🍋 Salsas de la casa incluidas', '📦 Pedidos grandes por encargo', '⏱️ Listo a la hora que prometemos'],
    wa: ['¡Hola! Quiero pedir costillas/pollo asado para hoy 🔥 Mi dirección es:', '¡Hola! Quiero cotizar una parrillada para una reunión de personas 🥩 ¿Precios?', '¡Hola! Me interesan los combos familiares y encargos especiales 📦 ¿Me cuentan?'],
    hook: 'el olor a brasa hace fila en la puerta',
    theme: 'ember', layout: 'bento',
  },
  {
    id: 'panaderia', re: /panader|pan\b|pastel|postre|dulce|reposter|torta|bolo|caf[eé]|desayun/,
    industry: 'gastronomia', labels: ['Panadería & Pastelería Artesanal', 'Café, Pan y Dulces Frescos'],
    names: ['Pan de Mi Tierra', 'Dulce Manjar', 'Horno Artesanal'],
    products: ['Pan fresco de cada día', 'Tortas y postres por encargo', 'Desayunos con café recién molido'],
    headlines: [
      ['Pan recién horneado', 'cada mañana'],
      ['La torta perfecta', 'para tu celebración'],
      ['Café y pan dulce', 'para empezar bien'],
    ],
    subs: ['Horneamos desde la madrugada con recetas de familia', 'Encarga tu torta con diseño personalizado'],
    badges: ['🥐 RECETA DE FAMILIA', '☕ FRESCO CADA DÍA'],
    benefits: ['🥖 Horneado fresco cada mañana', '🎂 Tortas personalizadas por encargo', '☕ Café de calidad al lado', '🛵 Domicilio en el pueblo', '🧁 Postres para toda ocasión', '💰 Precios justos de barrio'],
    wa: ['¡Hola! ¿Qué pan sale hoy? Quiero apartar encargo para mañana 🥖', '¡Hola! Quiero cotizar una torta para el cumpleaños de mi hijo 🎂 Tamaño y diseño:', '¡Hola! Me interesan los desayunos y pedidos por docenas para una reunión ☕'],
    hook: 'el pan de la madrugada huele a hogar',
    theme: 'kraft', layout: 'bento',
  },
  {
    id: 'odontologia', re: /odont|diente|dental|brackets|blanqueamien/,
    industry: 'salud_belleza', labels: ['Odontología Moderna', 'Salud Dental de Primera'],
    names: ['Sonrisas Pro', 'OdontoVital', 'Clínica Dental Sonríe'],
    products: ['Consulta y valoración dental', 'Limpieza y blanqueamiento', 'Ortodoncia y brackets'],
    headlines: [
      ['Tu mejor sonrisa', 'está aquí'],
      ['Odontología moderna', 'sin dolor'],
      ['Recupera tu sonrisa', 'hoy mismo'],
    ],
    subs: ['Consulta, diagnóstico digital y plan de tratamiento claro', 'Técnicas modernas, bioseguridad garantizada'],
    badges: ['🦷 ALTA PRECISIÓN', '⭐ ODONTOLOGÍA MODERNA'],
    benefits: ['🦷 Profesionales certificados', '💙 Atención sin dolor', '🧼 Bioseguridad total', '📅 Citas puntuales', '💳 Facilidades de pago', '👶 Atención para toda la familia'],
    wa: ['¡Hola! Quiero agendar una valoración dental 🦷 ¿Qué horarios tienen disponibles?', '¡Hola! Me interesa el precio de limpieza + blanqueamiento 💙 ¿Me informan?', '¡Hola! Quiero consultar por brackets y facilidades de pago 😁'],
    hook: 'una sonrisa sana abre puertas',
    theme: 'marble', layout: 'swiss',
  },
  {
    id: 'salud', re: /salud|m[eé]dico|doctor|cl[ií]nica|farmacia|droguer|vacuna|enfermer|medicament/,
    industry: 'salud_belleza', labels: ['Salud & Droguería', 'Atención Médica Cercana'],
    names: ['Vitalidad', 'Salud del Pueblo', 'Bienestar Total'],
    products: ['Consulta médica general', 'Medicamentos con domicilio', 'Jornada de vacunación'],
    headlines: [
      ['Tu salud', 'en buenas manos'],
      ['Medicamentos originales', 'con domicilio'],
      ['Cuida tu familia', 'con expertos'],
    ],
    subs: ['Atención humana, precios claros y entrega rápida', 'Droguería con surtido completo y asesoría farmacéutica'],
    badges: ['🩺 SALUD CERTIFICADA', '💊 ATENCIÓN INMEDIATA'],
    benefits: ['🩺 Personal calificado', '💊 Medicamentos originales', '🛵 Domicilio de droguería', '💉 Vacunación y control', '💳 Precios accesibles', '🕐 Atención de emergencia'],
    wa: ['¡Hola! Necesito asesoría médica, ¿tienen cita disponible para hoy? 🩺', '¡Hola! Necesito pedir unos medicamentos a domicilio 💊 Mi fórmula dice:', '¡Hola! Quiero información sobre la jornada de vacunación y precios 💉'],
    hook: 'la salud de tu familia no puede esperar',
    theme: 'clinic', layout: 'swiss',
  },
  {
    id: 'belleza', re: /belleza|peluquer|spa|est[eé]tica|u[nñ]as|masaje|cosm[eé]tic|maquillaje|barber/,
    industry: 'salud_belleza', labels: ['Belleza, Spa & Estilo', 'Tu Mejor Versión Empieza Aquí'],
    names: ['Bella Esencia', 'Estilo Único', 'Glam Studio'],
    products: ['Corte, color y styling', 'Spa facial y corporal', 'Uñas, maquillaje y peinados'],
    headlines: [
      ['Luce espectacular', 'en nuestras manos'],
      ['Belleza y relax', 'en un solo lugar'],
      ['El estilo que mereces', 'a tu alcance'],
    ],
    subs: ['Profesionales del estilo con productos de primera', 'Cita previa y atención 100% personalizada'],
    badges: ['✨ EXPERTAS EN ESTILO', '💎 BELLEZA PROFESIONAL'],
    benefits: ['✂️ Estilistas con experiencia', '🧴 Productos de primera calidad', '💆‍♀️ Ambiente relajante', '📅 Agenda tu cita fácil', '🎁 Paquetes para novias y eventos', '💰 Promos cada mes'],
    wa: ['¡Hola! Quiero agendar cita para corte y color ✂️ ¿Qué disponibilidad tienen?', '¡Hola! Me interesa el paquete de spa facial 💆‍♀️ ¿Precios y duración?', '¡Hola! Quiero cotizar peinado y maquillaje para un evento 💄 ¿Me cuentan?'],
    hook: 'verse bien se siente bien',
    theme: 'aurora', layout: 'polaroid',
  },
  {
    // V13: el matcher de turismo va ANTES que el de agro (que ya captura "finca").
    id: 'turismo', re: /caba[nñ]|piscina|balneario|glamping|turismo|tur[íi]stic|hospedaje|alojamiento|hotel|hostal|mirador|paseo|finca de recreo|descanso|pozo|trucha\s*de|campestre/,
    industry: 'turismo_hospedaje', labels: ['Turismo, Cabañas & Piscinas', 'Hospedaje & Descanso Campestre'],
    names: ['Refugio del Valle', 'Cabañas La Luna', 'Paraíso Campestre'],
    products: ['Plan de día de piscina y asado', 'Cabaña con piscina para tu familia', 'Finca de recreo con mirador'],
    headlines: [
      ['Tu día de descanso', 'entre cabañas y piscina'],
      ['Escápate al campo', 'sin salir de tu pueblo'],
      ['Cabañas con piscina', 'para desconectarse'],
    ],
    subs: ['Cabañas equipadas, piscina y asado · reservas por WhatsApp', 'Piscina, kiosco, mirador y zonas verdes para toda la familia'],
    badges: ['🏔️ ESCAPADA CAMPESTRE', '🏊 PISCINA TODO EL AÑO'],
    benefits: ['🏊 Piscina y zonas verdes amplias', '🛖 Cabañas equipadas y cómodas', '🍖 Zona de asado y kiosco', '🎉 Ideal para planes y cumpleaños', '📍 A minutos del pueblo', '🅿️ Parqueadero y seguridad'],
    wa: ['¡Hola! Vi su publicidad de cabañas y quiero apartar un plan con piscina para este fin de semana 🏊 ¿Qué planes tienen y precios?', '¡Hola! Quiero cotizar la cabaña para un grupo de personas 🎉 ¿Capacidad y tarifa?', '¡Hola! Me interesan los planes especiales para cumpleaños/reuniones 🎂 ¿Me cuentan opciones?'],
    hook: 'el descanso que tu familia se merece está a minutos',
    theme: 'emerald', layout: 'eco',
  },
  {
    id: 'agro', re: /agro|ganado|finca|cultivo|semilla|concentrado|abono|campo|siembra|fertilizante|trucha/,
    industry: 'agro_campo', labels: ['Insumos Agropecuarios', 'Todo para el Campo'],
    names: ['Tierra Viva', 'El Semillero', 'AgroCampestre'],
    products: ['Concentrado y sal al por mayor', 'Jornada de vacunación animal', 'Semillas y fertilizantes'],
    headlines: [
      ['Tu campo', 'produce más'],
      ['Insumos de calidad', 'a precio de mayorista'],
      ['Ganado sano', 'negocio próspero'],
    ],
    subs: ['Concentrados, veterinaria y asesoría técnica a la finca', 'Domicilios a veredas con despacho puntual'],
    badges: ['🌱 ALIADO DEL CAMPO', '🚜 INSUMOS DE VERDAD'],
    benefits: ['🌱 Concentrados de alta calidad', '🐄 Asesoría veterinaria incluida', '🛻 Domicilio a veredas', '💰 Precios por mayor', '📦 Surtido completo', '🤝 Crédito para clientes fieles'],
    wa: ['¡Hola! Quiero pedir concentrado al por mayor con domicilio a la finca 🌾 Mi vereda es:', '¡Hola! Me interesa la jornada de vacunación para mi ganado 💉 ¿Fecha y precios?', '¡Hola! Quiero cotizar semillas y fertilizantes para siembra 🌱 ¿Me asesoran?'],
    hook: 'una finca bien alimentada da mejores frutos',
    theme: 'emerald', layout: 'swiss',
  },
  {
    id: 'veterinaria', re: /veterinar|perro|mascota|gato|canino|felino/,
    industry: 'agro_campo', labels: ['Veterinaria & Mascotas', 'Cuidado Animal Profesional'],
    names: ['Patitas', 'VeteAmigo', 'Huella Feliz'],
    products: ['Consulta veterinaria general', 'Vacunación y desparasitación', 'Baño y peluquería canina'],
    headlines: [
      ['Tu mejor amigo', 'merece lo mejor'],
      ['Mascotas felices', 'y saludables'],
      ['Cuidado experto', 'para tu peludito'],
    ],
    subs: ['Consulta, vacunas, cirugías menores y estética animal', 'Amor por los animales y ciencia al servicio de ellos'],
    badges: ['🐾 CUIDADO EXPERTO', '🐶 AMOR ANIMAL'],
    benefits: ['🐾 Veterinarios amantes de los animales', '💉 Vacunas y desparasitación', '🛁 Estética canina y felina', '🏥 Urgencias atendidas', '📋 Historia clínica completa', '🛵 Domicilio veterinario'],
    wa: ['¡Hola! Quiero agendar consulta para mi peludito 🐶 ¿Qué horarios manejan?', '¡Hola! Necesito vacunar a mi mascota 💉 ¿Precio y fechas?', '¡Hola! Quiero información del baño y corte de pelo 🛁 ¿Me cuentan?'],
    hook: 'un peludito sano es un hogar feliz',
    theme: 'emerald', layout: 'portal',
  },
  {
    id: 'ferreteria', re: /ferreter|construcci[oó]n|obra|alba[nñ]il|electricis|plomero|materiales|herramienta|remodela|pintura/,
    industry: 'construccion_hogar', labels: ['Ferretería & Construcción', 'Materiales para tu Obra'],
    names: ['Obra Maestra', 'El Tornillo', 'ConstruPueblo'],
    products: ['Materiales de construcción a domicilio', 'Herramientas eléctricas', 'Asesoría técnica para tu obra'],
    headlines: [
      ['Tu obra', 'sin demoras'],
      ['Materiales de calidad', 'a tu puerta'],
      ['Construye mejor', 'y más barato'],
    ],
    subs: ['Cemento, hierro, eléctricos y asesoría de expertos', 'Despachos al día siguiente en todo el municipio'],
    badges: ['🛠️ TODO PARA TU OBRA', '🏗️ CALIDAD GARANTIZADA'],
    benefits: ['🛠️ Surtido completo de ferretería', '🚚 Domicilio de materiales', '👷 Asesoría de maestros', '💰 Precios por mayor', '⚡ Herramientas eléctricas', '📋 Presupuestos sin costo'],
    wa: ['¡Hola! Quiero cotizar materiales para una obra 🏗️ La lista es:', '¡Hola! Necesito una herramienta a domicilio, ¿tienen disponibilidad? 🛠️', '¡Hola! Me interesan los precios por mayor para maestros 🧱 ¿Me cuentan?'],
    hook: 'obra bien hecha empieza con buenos materiales',
    theme: 'slate', layout: 'diagonal',
  },
  {
    id: 'transporte', re: /transporte|flete|camion|domicilio|despacho|log[ií]stica|camioneta|carga|mudanza|expreso|moto|taxi/,
    industry: 'transporte_logistica', labels: ['Transporte & Domicilios', 'Fletes y Express del Pueblo'],
    names: ['Ruta Segura', 'Express Local', 'Fletes Confiables'],
    products: ['Fletes y mudanzas', 'Domicilios express', 'Transporte de carga a veredas'],
    headlines: [
      ['Tu carga', 'llega seguro'],
      ['Fletes rápidos', 'a cualquier vereda'],
      ['Mudanzas sin estrés', 'con nosotros'],
    ],
    subs: ['Vehículos adecuados, tarifa clara y puntualidad garantizada', 'Cobertura total del municipio y municipios vecinos'],
    badges: ['🛻 PUNTUALIDAD GARANTIZADA', '📦 TU CARGA SEGURA'],
    benefits: ['🛻 Vehículo para cada carga', '⏱️ Puntualidad de reloj', '🗺️ Llegamos a todas las veredas', '💰 Tarifas claras y justas', '📦 Carga asegurada', '🕐 Servicio también fines de semana'],
    wa: ['¡Hola! Necesito un flete para mover unas cosas 📦 Desde: hasta: ¿precio?', '¡Hola! Quiero un domicilio express para hoy 🛵 ¿Me confirman tarifa?', '¡Hola! Necesito transporte de carga a una vereda 🚚 ¿Qué tipo de vehículo tienen?'],
    hook: 'lo prometido llega: ni una hora de retraso',
    theme: 'slate', layout: 'bento',
  },
  {
    id: 'moda', re: /ropa|moda|boutique|calzado|vestido|tienda|almac[eé]n|supermercado|comercio|regalo/,
    industry: 'comercio_retail', labels: ['Moda & Comercio Local', 'Estilo que Se Nota'],
    names: ['El Armario', 'Moda & Cía', 'El Almacén'],
    products: ['Nueva colección de temporada', 'Ofertas de liquidación', 'Tendencias para toda la familia'],
    headlines: [
      ['Vístete con estilo', 'sin gastar de más'],
      ['Lo último de moda', 'ya está aquí'],
      ['Renueva tu clóset', 'hoy mismo'],
    ],
    subs: ['Ropa de calidad, tallas para todos y novedades cada semana', 'Atención amable y cambios sin problema'],
    badges: ['🛍️ NUEVA COLECCIÓN', '⚡ MODA AL INSTANTE'],
    benefits: ['🛍️ Novedades cada semana', '📐 Tallas para todos', '💳 Paga como prefieras', '🔁 Cambios sin líos', '🎁 Regalos para toda ocasión', '💥 Ofertas reales'],
    wa: ['¡Hola! ¿Qué novedades tienen de talla ? 👕 ¿Me mandan fotos?', '¡Hola! Quiero apartar una prenda que vi en su anuncio 🛍️ ¿Está disponible?', '¡Hola! Me interesan los precios por docena para revender 📦 ¿Me cuentan?'],
    hook: 'la primera impresión se viste',
    theme: 'terracotta', layout: 'magazine',
  },
  {
    id: 'gym', re: /gimnasio|fitness|gym|entrenamien|ejercicio|crossfit|musculaci[oó]n|yoga/,
    industry: 'servicios_profesionales', labels: ['Gimnasio & Entrenamiento', 'Transforma tu Cuerpo'],
    names: ['Corporación Fitness', 'Fuerza Andina', 'PowerGym'],
    products: ['Plan de entrenamiento mensual', 'Clases grupales', 'Acompañamiento de un entrenador'],
    headlines: [
      ['Transforma tu cuerpo', 'en 90 días'],
      ['Entrena fuerte', 'y con guía experta'],
      ['Tu mejor versión', 'empieza hoy'],
    ],
    subs: ['Rutinas personalizadas, nutrición y seguimiento real', 'Horarios flexibles de mañana y noche'],
    badges: ['💪 RESULTADOS REALES', '🏋️ ENTRENA CON EXPERTOS'],
    benefits: ['🏋️ Entrenadores certificados', '📋 Plan según tu objetivo', '🥗 Guía de alimentación', '🕐 Horarios flexibles', '👥 Comunidad que motiva', '📈 Medición de progreso'],
    wa: ['¡Hola! Quiero información del plan mensual del gimnasio 💪 ¿Precio y horarios?', '¡Hola! Me interesa el plan con entrenador personal 🏋️ ¿Me cuentan?', '¡Hola! Quiero inscribirme a las clases grupales 🥊 ¿Cuándo empiezan?'],
    hook: 'el cuerpo que quieres se construye con constancia',
    theme: 'pop', layout: 'diagonal',
  },
  {
    id: 'educacion', re: /curso|clase|educaci[oó]n|escuela|academia|refuerzo|ingl[eé]s|tutor[ií]a|capacitaci[oó]n/,
    industry: 'servicios_profesionales', labels: ['Educación & Cursos', 'Aprende con Expertos'],
    names: ['Aprende Ya', 'Academia del Saber', 'Saber Extra'],
    products: ['Curso de inglés práctico', 'Refuerzo escolar', 'Capacitación técnica'],
    headlines: [
      ['Aprende rápido', 'con quien sabe'],
      ['Refuerzo escolar', 'que da resultados'],
      ['Tu futuro', 'empieza estudiando'],
    ],
    subs: ['Docentes pacientes, horarios cómodos y certificado al finalizar', 'Grupos pequeños para aprender de verdad'],
    badges: ['🎓 APRENDE CON EXPERTOS', '📚 CERTIFICADO REAL'],
    benefits: ['🎓 Docentes calificados', '📚 Material incluido', '🕐 Horarios cómodos', '👥 Grupos pequeños', '📜 Certificado al finalizar', '💰 Precios accesibles'],
    wa: ['¡Hola! Quiero información sobre el curso 📚 ¿Costo, horario y cómo inscribirme?', '¡Hola! Me interesa el refuerzo escolar para mi hijo/a ✏️ ¿Qué niveles atienden?', '¡Hola! Quiero cotizar una capacitación para un grupo 🎓 ¿Me cuentan?'],
    hook: 'lo que aprendes hoy te abre puertas mañana',
    theme: 'marble', layout: 'swiss',
  },
  {
    id: 'hogar', re: /inmobiliar|arriendo|casa|apartament|lote|mueble|decoraci[oó]n|hogar/,
    industry: 'construccion_hogar', labels: ['Hogar & Bienes Raíces', 'Tu Próxima Casa Existe'],
    names: ['Casas del Pueblo', 'Hogar & Cía', 'Mi Techo'],
    products: ['Arriendo de casa familiar', 'Muebles y decoración', 'Asesoría inmobiliaria'],
    headlines: [
      ['Encuentra tu casa', 'soñada aquí'],
      ['Muebles que abrazan', 'tu hogar'],
      ['Tu hogar nuevo', 'te está esperando'],
    ],
    subs: ['Opciones verificadas, trámites claros y acompañamiento total', 'Visita los inmuebles sin compromiso'],
    badges: ['🏠 HOGAR DULCE HOGAR', '🔑 LLAVES EN TU MANO'],
    benefits: ['🏠 Inmuebles verificados', '🔑 Trámites sin enredos', '📍 Zonas tranquilas', '🛋️ Muebles de calidad', '🤝 Acompañamiento en todo', '📄 Contratos claros'],
    wa: ['¡Hola! Busco casa en arriendo, ¿qué opciones tienen? 🏠 Presupuesto aproximado:', '¡Hola! Quiero agendar visita a un inmueble que vi 🔑 ¿Cuándo puedo ir?', '¡Hola! Me interesan los muebles del catálogo 🛋️ ¿Precios y entrega?'],
    hook: 'un buen hogar cambia todo lo demás',
    theme: 'kraft', layout: 'magazine',
  },
  {
    id: 'eventos', re: /evento|fiesta|cumplea[nñ]os|quince|boda|catering|sal[oó]n/,
    industry: 'comercio_retail', labels: ['Eventos & Celebraciones', 'Fiestas Inolvidables'],
    names: ['Momentos Mágicos', 'Fiesta Total', 'Celebraciones Pro'],
    products: ['Decoración para eventos', 'Salón de fiestas completo', 'Catering y banquetería'],
    headlines: [
      ['Tu fiesta', 'perfecta y sin estrés'],
      ['Celebraciones', 'que nadie olvida'],
      ['Todo tu evento', 'en un solo lugar'],
    ],
    subs: ['Decoración, sonido, banquete y coordinación completa', 'Cotizamos según tu fecha y presupuesto'],
    badges: ['🎉 FIESTAS INOLVIDABLES', '🎈 TODO INCLUIDO'],
    benefits: ['🎉 Decoración temática', '🔊 Sonido e iluminación', '🍰 Banquete a tu medida', '📸 Recuerdos de calidad', '📅 Agenda tu fecha ya', '💰 Paquetes a tu presupuesto'],
    wa: ['¡Hola! Quiero cotizar la decoración para un evento 🎈 Fecha aproximada:', '¡Hola! Me interesa el salón completo para una celebración 🎉 ¿Qué incluye?', '¡Hola! Quiero información del catering para personas 🍰 ¿Precios?'],
    hook: 'los mejores recuerdos nacen de buenas fiestas',
    theme: 'aurora', layout: 'arc',
  },
  {
    id: 'profesional', re: /abogad|jur[ií]dic|notar[ií]|contab|contador|impuesto|asesor|consultor|profesional|arquitecto|gestor[ií]a|tr[aá]mite|dise[nñ]o/,
    industry: 'servicios_profesionales', labels: ['Servicios Profesionales', 'Expertos a tu Servicio'],
    names: ['Primera Clase', 'Soluciones Expertas', 'Aliados Pro'],
    products: ['Asesoría profesional personalizada', 'Trámites y consultoría', 'Diseño y soluciones a medida'],
    headlines: [
      ['Expertos reales', 'a tu servicio'],
      ['Resolvemos tu caso', 'con experiencia'],
      ['Tu aliado experto', 'en cada trámite'],
    ],
    subs: ['Experiencia comprobada, confidencialidad y resultados', 'Primera consulta sin costo para que decidas tranquilo'],
    badges: ['💼 EXPERTOS CERTIFICADOS', '⭐ CONFIANZA Y SERIEDAD'],
    benefits: ['💼 Experiencia comprobada', '🔒 Total confidencialidad', '📋 Casos resueltos con orden', '🕐 Puntualidad y claridad', '💬 Comunicación directa', '📄 Documentación impecable'],
    wa: ['¡Hola! Necesito asesoría profesional, ¿puedo agendar una consulta? 💼 Mi caso es:', '¡Hola! Quiero cotizar un trámite/consultoría 📄 ¿Qué documentos necesito?', '¡Hola! Me interesan los planes de acompañamiento profesional 🤝 ¿Me cuentan?'],
    hook: 'los problemas serios se resuelven con expertos',
    theme: 'obsidian', layout: 'swiss',
  },
];

const FALLBACK_NICHE: Niche = {
  id: 'generico', re: /.*/,
  industry: 'comercio_retail', labels: ['Tu Negocio de Confianza', 'Calidad y Buen Trato'],
  names: ['El Buen Precio', 'Casa Central', 'Punto de Encuentro'],
  products: ['Lo mejor del pueblo', 'Productos y servicios de primera', 'Tu promoción estrella'],
  headlines: [
    ['Calidad y buen trato', 'en tu pueblo'],
    ['Lo mejor para ti', 'está aquí'],
    ['Descubre lo nuevo', 'que tenemos para ti'],
  ],
  subs: ['Atención amable, precios justos y productos de primera', 'Tu negocio de confianza, cerca de ti'],
  badges: ['⭐ NEGOCIO DESTACADO', '💎 CALIDAD GARANTIZADA'],
  benefits: ['🥇 Calidad garantizada', '⚡ Atención inmediata', '📍 Cerca de ti en el pueblo', '💰 Precios justos', '🤝 Trato amable y honesto', '🎁 Promociones frecuentes'],
  wa: ['¡Hola! Vi su anuncio y me interesa 🙌 ¿Me dan más información?', '¡Hola! Quiero pedir/cotizar a domicilio 🛵 Mi dirección es:', '¡Hola! Me interesan los planes especiales 📦 ¿Me cuentan opciones?'],
  hook: 'un buen negocio se conoce por su gente',
  theme: 'wood', layout: 'bento',
};

/** Rotea un arreglo con una semilla (cada clic = combinación distinta). */
function rotate<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

/** Detecta el giro del negocio analizando el brief palabra por palabra. */
function detectNiche(brief: string, categoryHint?: string): Niche {
  const t = brief.toLowerCase();
  for (const n of NICHES) if (n.re.test(t)) return n;
  if (categoryHint) {
    const h = categoryHint.toLowerCase();
    for (const n of NICHES) if (n.re.test(h)) return n;
  }
  return FALLBACK_NICHE;
}

/**
 * 🧠 Motor sintético · PASADA 1: dirección de arte completa desde el brief.
 */
export function synthesizeArtDirection(
  input: CampaignInput,
  opts?: { previousThemeId?: string; previousLayoutId?: string; seed?: number },
): ArtDirection {
  const seed = opts?.seed ?? Math.floor(Math.random() * 100000);
  const niche = detectNiche(`${input.brief} ${input.slogan} ${input.product} ${input.businessName}`, input.categoryHint);
  const industry = niche.industry;

  // V20.0 Aleatoriedad Forzada: excluye el tema y layout anteriores y rota entre familias visuales élite
  const dynamicLayouts = [
    'diagx', 'orbits', 'bleed', 'magazine', 'float', 'bento3d', 'zen', 'diamond',
    'diagonal', 'split', 'portal', 'hud', 'menu', 'arc', 'polaroid', 'swiss', 'bento',
  ];
  const candidateThemes = THEME_IDS.filter((id) => id !== opts?.previousThemeId);
  const pickedTheme =
    candidateThemes[Math.floor(Math.random() * candidateThemes.length)] || niche.theme;
  const candidateLayouts = dynamicLayouts.filter((id) => id !== opts?.previousLayoutId);
  const pickedLayout =
    candidateLayouts[Math.floor(Math.random() * candidateLayouts.length)] || niche.layout;

  return {
    industryType: industry,
    brandName: input.businessName.trim() || rotate(niche.names, seed),
    productTitle: input.product.trim() || rotate(niche.products, seed),
    categoryLabel: rotate(niche.labels, Math.floor(seed / 7)),
    themeId: pickedTheme,
    layoutId: pickedLayout,
    valueProposition: rotate(niche.subs, Math.floor(seed / 3)),
    imagePromptEn: INDUSTRY_PHOTO_PROMPTS[industry],
  };
}

/**
 * 🧠 Motor sintético · PASADA 2: campaña completa (titular, beneficios, copy
 * de las 5 pestañas, mensajes de WhatsApp y 4 versiones de difusión).
 */
export function synthesizeCampaign(input: CampaignInput, art: ArtDirection): MarketingCampaign {
  const seed = Math.floor(Math.random() * 100000);
  const niche = detectNiche(`${input.brief} ${input.slogan} ${input.product} ${input.businessName}`, input.categoryHint);
  const isService = input.priceMode === 'servicio';
  const brand = input.businessName.trim() || art.brandName;
  const product = input.product.trim() || art.productTitle;
  const addr = input.address.trim() || input.municipality;
  const place = input.municipality || 'Gachetá';
  const [plain, highlight] = rotate(niche.headlines, seed);
  const price =
    !isService && input.promoPrice != null
      ? ` a SOLO $${input.promoPrice.toLocaleString('es-CO')}`
      : '';
  const normalTxt =
    !isService && input.normalPrice != null && input.promoPrice != null && input.normalPrice > input.promoPrice
      ? ` (antes $${input.normalPrice.toLocaleString('es-CO')})`
      : '';

  const b0 = rotate(niche.benefits, seed);
  const b1 = rotate(niche.benefits, seed + 2);
  const b2 = rotate(niche.benefits, seed + 4);
  const hook = niche.hook;

  const hashtags = [
    `#${place.replace(/\s+/g, '')}`,
    '#Guavio',
    '#Cundinamarca',
    '#ComprasLocales',
    '#ApoyaLoNuestro',
    `#${brand.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 18) || 'NegocioLocal'}`,
    '#PromocionHoy',
  ].join(' ');

  return {
    industryType: art.industryType,
    themeId: art.themeId,
    layoutId: art.layoutId,
    valueProposition: art.valueProposition,
    badgeText: stripPictographics(rotate(niche.badges, Math.floor(seed / 11))) || 'NEGOCIO DESTACADO',
    headline: { plain, highlight },
    sub: rotate(niche.subs, Math.floor(seed / 5)),
    // 🎯 V21 · Cero emojis en el afiche: el motor sintético limpia los
    // pictográficos de nicho (los íconos los dibuja el sistema vectorial).
    benefits: [stripPictographics(b0), stripPictographics(b1), stripPictographics(b2)],
    cta: isService ? 'Agenda hoy por WhatsApp' : 'Pide el tuyo HOY por WhatsApp',
    priceLabel: isService
      ? input.priceLabel.trim() || `${art.productTitle} · Cotiza sin compromiso`
      : null,
    imagePromptEn: art.imagePromptEn,
    visualHooks: {
      slide1_hook: `${product}${price ? ' con oferta de hoy' : ''}: ${hook.charAt(0).toUpperCase()}${hook.slice(1)}`,
      slide1_sub: `Conoce por qué en ${place} ya lo están eligiendo`,
      slide2_headline: `${b0.replace(/^[^\p{L}\p{N}]+/u, '')} y ${b1.replace(/^[^\p{L}\p{N}]+/u, '').toLowerCase()}`,
      slide2_bullets: [stripPictographics(b0), stripPictographics(b1), stripPictographics(b2)],
      slide3_cta: `Últimos cupos de hoy 👉 Escríbenos al WhatsApp de ${brand}`,
    },
    whatsappStatusSequence: {
      status1: `🔥 *HOY en ${brand} (${place}):* ${product}${price}.\n_${hook.charAt(0).toUpperCase()}${hook.slice(1)}._\n📲 Escríbenos ahora y pregunta por tu cupo`,
      status2: `*${plain.toUpperCase()} ${highlight.toUpperCase()}*${price}${normalTxt}\n\n✅ *${b0.replace(/^[^\p{L}\p{N}]+/u, '')}*\n✅ *${b2.replace(/^[^\p{L}\p{N}]+/u, '')}*\n\n📍 _${addr}_`,
      status3: `⏳ *Últimas horas hoy en ${brand}* (${place}).\n_${b1.replace(/^[^\p{L}\p{N}]+/u, '')}_ — escribe ya antes que se acabe 📲`,
    },
    socialMediaCopy: {
      pas: `✨ ${plain} ${highlight}${price}${normalTxt}\n\n${hook.charAt(0).toUpperCase()}${hook.slice(1)} en *${brand}*.\n\n• ${b0.replace(/^[^\p{L}\p{N}]+/u, '')}\n• ${b1.replace(/^[^\p{L}\p{N}]+/u, '')}\n• ${b2.replace(/^[^\p{L}\p{N}]+/u, '')}\n\n📍 ${addr} · ${place}\n📲 ${isService ? 'Cotiza hoy sin costo por WhatsApp' : 'Aparta el tuyo HOY por WhatsApp'}\n\n${hashtags}`,
      aida: `⚡ *${plain.toUpperCase()} ${highlight.toUpperCase()}*${price}${normalTxt}\n\n_${hook.charAt(0).toUpperCase()}${hook.slice(1)}._\n✅ *${b0.replace(/^[^\p{L}\p{N}]+/u, '')}*\n✅ *${b1.replace(/^[^\p{L}\p{N}]+/u, '')}*\n\n📍 ${addr}\n👉 *Escríbenos AHORA a WhatsApp* y aparta hoy mismo`,
    },
    videoReelScript: {
      t0_3: `[Cámara: Primer plano dinámico del producto con buena luz] Texto: "¿Buscas ${product.toLowerCase()} de verdad en ${place}? Mira esto que llegó hoy a ${brand}…"`,
      t3_10: `[Cámara: Plano medio mostrando textura, detalle y uso] Texto: "En ${brand} tienes ${b0.replace(/^[^\p{L}\p{N}]+/u, '').toLowerCase()} y ${b2.replace(/^[^\p{L}\p{N}]+/u, '').toLowerCase()}${price}."`,
      t10_15: `[Cámara: Cierre frente al local o señalando el enlace abajo] Texto: "${plain} ${highlight}. Escríbenos ya al WhatsApp de ${brand} o encuéntranos en ${addr}."`,
    },
    salesClosingTemplates: {
      priceReply: isService
        ? `¡Hola! 😊 La cotización depende de lo que necesites. ${product}: ${b0.replace(/^[^\p{L}\p{N}]+/u, '').toLowerCase()}. Cuéntame tu caso y te envío el presupuesto hoy mismo 👉`
        : `¡Hola! 😊 ${product} queda en $${(input.promoPrice ?? 0).toLocaleString('es-CO')}${normalTxt}. Con domicilio disponible en ${place} 🛵 ¿Te lo aparto?`,
      hesitantReply: `Te entiendo 👌 Por eso te cuento: ${b2.replace(/^[^\p{L}\p{N}]+/u, '')} y si no te convence, conversamos sin compromiso. Hoy tenemos cupos limitados, ¿te guardo uno?`,
      dispatchUpsell: `¡Perfecto, confirmado! 🧾 Tu ${product.toLowerCase()} queda apartado y llega a ${addr}. Si necesitas algo más, escríbeme por aquí y como cliente fiel te doy precio especial 😉`,
    },
    waLine1Msg: niche.wa[0],
    waLine2Msg: niche.wa[1],
    waLine3Msg: niche.wa[2],
    dispatchVersions: [
      `*${plain} ${highlight}*${price}${normalTxt}\n_${hook.charAt(0).toUpperCase()}${hook.slice(1)} en ${brand}._\n✅ ${b0}\n✅ ${b2}\n📍 ${addr} · *Pide por WhatsApp*`,
      `🚀 *${product}*${price} en _${place}_.\n${b1}\n${b2}\n⏳ *Cupos limitados hoy* — escribe YA 👉 WhatsApp`,
      `👀 ¿Ya conociste *${brand}*?\n_${b0.replace(/^[^\p{L}\p{N}]+/u, '')}_ y atención de primera.\n📍 ${addr} · 👉 *Escríbenos*`,
      `🔥 *RECOMENDADO EN ${place.toUpperCase()}:* ${product}${price}${normalTxt}.\n_${b2}_\n📍 ${addr} · 👉 *WhatsApp directo*`,
    ],
  };
}

/** Conveniencia: dirección de arte + campaña sintética en una sola llamada. */
export function synthesizeSmartCampaignFromBrief(
  input: CampaignInput,
  opts?: { previousThemeId?: string; previousLayoutId?: string; seed?: number },
): { art: ArtDirection; campaign: MarketingCampaign } {
  const art = synthesizeArtDirection(input, opts);
  const campaign = synthesizeCampaign(input, art);
  return { art, campaign };
}

/**
 * 🎨 V22.0 · Extracción cromática de marca con Gemini Vision (opcional / respaldo CORS):
 * Deducirá exactamente los 3 colores hexadecimales principales del logo o imagen del comercio.
 */
const PALETTE_SCHEMA: Record<string, unknown> = {
  type: SchemaType.OBJECT,
  properties: {
    colors: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
  },
  required: ['colors'],
};

export async function extractBrandPaletteWithAI(
  imageDataUrl: string,
  source: 'logo' | 'photo' = 'logo',
): Promise<ExtractedBrandPalette | null> {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(imageDataUrl.trim());
  if (!m) return null;
  try {
    const raw = await callGemini({
      prompt:
        'Analiza este logo o fotografía de marca y extrae EXACTAMENTE los 3 colores hexadecimales más representativos (#RRGGBB) ordenados así: [primario_estructural, acento_vibrante, secundario_complementario]. Evita blanco puro (#ffffff) o negro puro (#000000) salvo que sean únicos.',
      image: { mimeType: m[1], data: m[2] },
      temperature: 0.15,
      responseSchema: PALETTE_SCHEMA,
    });
    const parsed = parseAiJson<{ colors?: string[] }>(raw);
    return Array.isArray(parsed.colors) ? buildPaletteFromHexTriplet(parsed.colors, source) : null;
  } catch {
    return null;
  }
}
