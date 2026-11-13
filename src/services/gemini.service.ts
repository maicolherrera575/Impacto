import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { GEMINI_API_KEY } from '../config/env';
import type { Category, ParsedPromo } from '../types';

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

const MODEL_ID = 'gemini-2.5-flash';

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

/** Llama al proxy serverless /api/gemini con mensajes de error claros. */
async function callProxy(options: GeminiCallOptions): Promise<string> {
  let res: Response;
  try {
    res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL_ID, payload: buildPayload(options) }),
    });
  } catch {
    throw new Error('No se pudo contactar la IA (revisa tu conexión a internet)');
  }
  const rest: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (rest as { error?: { message?: string } } | null)?.error?.message;
    throw new Error(msg ? `La IA respondió con error: ${msg}` : `La IA respondió con error (HTTP ${res.status})`);
  }
  const text = extractRestText(rest);
  if (!text) throw new Error('La IA no respondió con contenido. Intenta de nuevo');
  return text;
}

/** Llamada directa con el SDK (requiere GEMINI_API_KEY disponible). */
async function callSdk(options: GeminiCallOptions): Promise<string> {
  const { response } = await getSdkModel().generateContent(buildPayload(options) as unknown as SdkRequest);
  const text = response.text().trim();
  if (!text) throw new Error('La IA no respondió con contenido. Intenta de nuevo');
  return text;
}

/**
 * Punto único de llamada a Gemini para toda la app (V8).
 * 1) Intenta SIEMPRE el proxy serverless /api/gemini (la llave privada vive en Vercel).
 * 2) Si el proxy falla y existe una llave VITE_GEMINI_API_KEY disponible, reintenta
 *    directo con el SDK para que la respuesta sea SIEMPRE de Gemini real.
 * 3) Si ambos fallan, propaga el error técnico EXACTO (lo muestra el toast).
 */
async function callGemini(options: GeminiCallOptions): Promise<string> {
  try {
    return await callProxy(options);
  } catch (proxyErr) {
    if (GEMINI_API_KEY) return callSdk(options);
    throw proxyErr;
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
    return normalize(JSON.parse(jsonText) as Partial<ParsedPromo>);
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
}

const RECEIPT_PROMPT = `Eres el verificador de pagos de Impulso. Analiza la imagen de un comprobante de pago de Nequi, Daviplata o Bancolombia de Colombia.
Devuelve ÚNICAMENTE este JSON:
{"looks_real": true|false, "suspicious": true|false, "amount_cop": número entero del valor pagado o null, "reference": "código de referencia / número de transacción visible (máx 40 caracteres)" o null, "note": "frase corta en español describiendo lo que leíste"}

Criterios:
- looks_real: true solo si la imagen parece un comprobante real de Nequi/Daviplata/Bancolombia (pantalla de la app con monto y fecha). Si es un dibujo, un meme, un papel escrito a mano u otra cosa, false.
- suspicious: true si detectas ALGUNA señal de fraude:
  * texto o números que parecen pegados/editados (fuente distinta, caja desalineada)
  * la transacción dice "Pendiente", "Programada" o "En proceso" (NO cuenta como pagado)
  * valor en 0 o ilegible con el resto muy elaborado
  * la misma captura con fecha muy antigua (más de 3 días atrás)
  * parece foto de la pantalla de OTRO teléfono con reflejos o bordes del celular
  Si la captura se ve normal y directa de la app, false.
- amount_cop: el valor pagado en pesos (si dice $24.000, devuelve 24000).
- reference: la referencia, código de confirmación, número de transacción o "Id de operación" visible.
- note: descripción breve (máx 120 caracteres).`;

/**
 * 🤖 IA Vision anti-fraude: lee la miniatura del comprobante Nequi/Daviplata,
 * extrae el valor pagado y la referencia en ~2 segundos, y marca señales de
 * capturas editadas, recicladas o de pagos no confirmados.
 */
export async function verifyNequiReceiptWithAI(imageDataUrl: string): Promise<ReceiptVerification> {
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
    prompt: RECEIPT_PROMPT,
    image: { mimeType, data: base64 },
    temperature: 0.1,
  });

  const parsed = JSON.parse(jsonText) as {
    looks_real?: boolean;
    suspicious?: boolean;
    amount_cop?: number | null;
    reference?: string | null;
    note?: string | null;
  };
  return {
    looksReal: parsed.looks_real === true,
    suspicious: parsed.suspicious === true,
    amountCop: typeof parsed.amount_cop === 'number' ? Math.round(parsed.amount_cop) : null,
    reference: typeof parsed.reference === 'string' ? parsed.reference.trim().slice(0, 40) : null,
    note: typeof parsed.note === 'string' ? parsed.note.trim().slice(0, 160) : 'Comprobante analizado',
  };
}

/** Resultado del semáforo de confianza para el administrador. */
export interface MerchantTrustResult {
  level: 'green' | 'yellow';
  summary: string;
  warnings: string[];
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
}): Promise<MerchantTrustResult> {
  const facts = [
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

  const parsed = JSON.parse(jsonText) as Partial<MerchantTrustResult>;
  const level = parsed.level === 'green' ? 'green' : 'yellow';
  return {
    level,
    summary: typeof parsed.summary === 'string' && parsed.summary.trim() !== '' ? parsed.summary.trim() : 'Revisión completada',
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings.filter((w): w is string => typeof w === 'string' && w.trim() !== '') : [],
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
  | 'agro_campo'
  | 'transporte_logistica'
  | 'comercio_retail'
  | 'servicios_profesionales'
  | 'construccion_hogar';

const INDUSTRY_IDS: IndustryType[] = [
  'digital_tech',
  'gastronomia',
  'salud_belleza',
  'agro_campo',
  'transporte_logistica',
  'comercio_retail',
  'servicios_profesionales',
  'construccion_hogar',
];

const THEME_IDS = ['cyber', 'obsidian', 'brasa', 'clinic', 'emerald', 'terra', 'sunset', 'titanium'] as const;
const LAYOUT_IDS = ['bento', 'magazine', 'diagonal', 'swiss', 'split', 'showcase', 'poster', 'strip'] as const;

/** Dirección de arte por defecto de cada rubro (nunca siempre el mismo tema). */
export const INDUSTRY_ART: Record<IndustryType, { themeId: string; layoutId: string }> = {
  digital_tech: { themeId: 'cyber', layoutId: 'diagonal' },
  gastronomia: { themeId: 'brasa', layoutId: 'bento' },
  salud_belleza: { themeId: 'clinic', layoutId: 'swiss' },
  agro_campo: { themeId: 'terra', layoutId: 'swiss' },
  transporte_logistica: { themeId: 'titanium', layoutId: 'bento' },
  comercio_retail: { themeId: 'emerald', layoutId: 'bento' },
  servicios_profesionales: { themeId: 'obsidian', layoutId: 'swiss' },
  construccion_hogar: { themeId: 'titanium', layoutId: 'diagonal' },
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
 "industry_type": uno de [digital_tech, gastronomia, salud_belleza, agro_campo, transporte_logistica, comercio_retail, servicios_profesionales, construccion_hogar],
 "brand_name": "nombre comercial corto y potente del negocio (1 a 3 palabras): si el brief ya lo da, devuélvelo limpio; si NO lo da, crea uno creíble y memorable para el giro deducido",
 "product_title": "título del servicio o producto estrella DEDUCIDO del brief (máx 6 palabras, reescrito con vocabulario de agencia, no literal)",
 "theme_id": uno de [cyber, obsidian, brasa, clinic, emerald, terra, sunset, titanium]. Elige el que mejor pegue con el giro y VARÍA entre generaciones: tecnología/marketing/IA → cyber; servicios premium/abogados/finanzas → obsidian; comida/asaderos → brasa; salud/odontología/estética → clinic; comercio local/turismo → emerald; agro/veterinaria/transporte de campo → terra; promociones virales/moda/belleza → sunset; construcción/logística/industrial → titanium. NUNCA elijas siempre el mismo.
 "layout_id": uno de [bento, magazine, diagonal, swiss, split, showcase, poster, strip]. Rota la composición según el giro para que cada generación sea visualmente única.
 "value_proposition": "la promesa comercial de alto calibre del negocio: transforma la idea básica del brief en un beneficio concreto, específico y creíble. PROHIBIDO copiar frases literales del brief: reescríbelas con vocabulario de agencia senior",
 "image_prompt_en": "hyper-detailed commercial editorial photography prompt IN ENGLISH: subject, environment, cinematic 8k lighting setup, lens and mood, derivado del rubro deducido del brief. The image must NEVER contain text, logos or watermarks"
}
En el prompt recibirás además una SEMILLA CREATIVA y el tema/layout de la generación ANTERIOR: usa un ángulo creativo fresco y NUNCA repitas ese tema ni ese layout.`;

const ART_SCHEMA: Record<string, unknown> = {
  type: SchemaType.OBJECT,
  properties: {
    industry_type: { type: SchemaType.STRING, format: 'enum', enum: INDUSTRY_IDS },
    brand_name: { type: SchemaType.STRING },
    product_title: { type: SchemaType.STRING },
    theme_id: { type: SchemaType.STRING, format: 'enum', enum: [...THEME_IDS] },
    layout_id: { type: SchemaType.STRING, format: 'enum', enum: [...LAYOUT_IDS] },
    value_proposition: { type: SchemaType.STRING },
    image_prompt_en: { type: SchemaType.STRING },
  },
  required: ['industry_type', 'brand_name', 'product_title', 'theme_id', 'layout_id', 'value_proposition', 'image_prompt_en'],
};

/** Nombres de marca de reserva por rubro (solo si la IA omite brand_name). */
const INDUSTRY_NAMES: Record<IndustryType, string> = {
  digital_tech: 'Impulso Digital',
  gastronomia: 'Sabor del Pueblo',
  salud_belleza: 'Vitalidad',
  agro_campo: 'Tierra Viva',
  transporte_logistica: 'Ruta Segura',
  comercio_retail: 'El Almacén',
  servicios_profesionales: 'Primera Clase',
  construccion_hogar: 'Obra Maestra',
};

/** 🧠 PASADA 1: analiza el brief (fuente maestra) y devuelve rubro + marca +
 *  producto + tema + layout + promesa. Con semilla creativa y evitación del
 *  tema/layout anterior para que CADA clic genere algo 100% diferente. */
export async function generateArtDirection(input: CampaignInput): Promise<ArtDirection> {
  const seedLine = `SEMILLA CREATIVA #${Math.floor(Math.random() * 9000 + 1000)}: usa un ángulo creativo, una metáfora y una composición totalmente nuevas en esta generación.`;
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
    raw = JSON.parse(jsonText) as Record<string, unknown>;
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
 "badge_text": "sello superior ESPECÍFICO del giro: máximo 4 palabras en MAYÚSCULAS con 1 emoji al inicio (ej: '🚀 IMPULSA TUS VENTAS', '💎 ALTA PRECISIÓN', '🔥 SABOR ARTESANAL')",
 "headline": {
   "plain": "3 a 6 palabras IMPACTANTES que irán en blanco, SIEMPRE separadas por espacios correctos (ej: 'Multiplica tus clientes y')",
   "highlight": "3 a 5 palabras de cierre poderoso con espacios correctos, irán resaltadas en el color de acento (ej: 'domina las redes hoy')"
 },
 "sub": "una línea ejecutiva elegante que explica el servicio/producto",
 "benefits": ["3 beneficios 100% ESPECÍFICOS del negocio, cada uno empieza con 1 emoji ideal del rubro (nada genérico)"],
 "cta": "llamado a la acción urgente y claro",
 "price_label": "si el negocio NO maneja precio fijo: texto inteligente de cotización/acción (ej: 'Diagnóstico digital gratis', 'Agenda tu asesoría hoy', 'Valoración sin costo'). Si SÍ hay precio de oferta devuelve null",
 "visualHooks": {
   "slide1_hook": "titular magnético de 4 a 7 palabras que detiene el scroll",
   "slide1_sub": "subtítulo provocador corto",
   "slide2_headline": "promesa de valor + beneficio irresistible (máx 10 palabras)",
   "slide2_bullets": ["beneficio corto con emoji", "beneficio corto con emoji", "beneficio corto con emoji"],
   "slide3_cta": "llamado a la acción urgente con gatillo de escasez"
 },
 "whatsappStatusSequence": {
   "status1": "Estado de WhatsApp de la mañana: curiosidad o problema (máx 2 líneas)",
   "status2": "texto que acompaña la imagen de la oferta: revelación + precio o servicio (máx 3 líneas)",
   "status3": "Estado de la tarde/noche: escasez + prueba social + 👉 link"
 },
 "socialMediaCopy": {
   "pas": "fórmula PAS (Problema - Agitación - Solución) para Facebook/Instagram del municipio, máx 5 líneas, con emojis",
   "aida": "fórmula AIDA flash (Atención - Interés - Deseo - Acción) para grupos de WhatsApp y clasificados, máx 5 líneas, con emojis"
 },
 "videoReelScript": {
   "t0_3": "segundos 0-3: plano visual exacto y frase gancho hablada",
   "t3_10": "segundos 3-10: demostración del producto o servicio + beneficio",
   "t10_15": "segundos 10-15: llamado a la acción mostrando dirección y WhatsApp"
 },
 "salesClosingTemplates": {
   "priceReply": "respuesta lista cuando el cliente pregunta ¿precio?: da el precio o invita a cotizar y ofrece combo/domicilio",
   "hesitantReply": "respuesta para clientes indecisos con escasez o garantía",
   "dispatchUpsell": "confirmación de despacho + venta cruzada (upsell) natural"
 }
}
REGLAS DE ORO:
- PROHIBIDO copiar frases literales del brief del usuario ni rellenar con plantillas genéricas: todo el copy debe nacer de la promesa de valor de la estrategia.
- Los beneficios deben describir algo que SOLO ese negocio puede decir.
- headliness y textos SIEMPRE con espacios correctos entre palabras.
- Español colombiano cercano y honesto; adapta el tono al enfoque psicológico indicado.`;

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
    ? (raw.benefits as unknown[]).filter((b): b is string => typeof b === 'string' && b.trim() !== '').slice(0, 3)
    : [];
  if (benefits.length < 3) {
    throw new Error('La IA (pasada 2) no devolvió los 3 beneficios del negocio. Pulsa ✨ de nuevo.');
  }
  const customLabel = input.priceLabel.trim();
  const listStr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').slice(0, 3) : [];

  return {
    industryType: art.industryType,
    themeId: art.themeId,
    layoutId: art.layoutId,
    valueProposition: art.valueProposition,
    badgeText: normSpaces(raw.badge_text) || `⭐ ${input.municipality ? `${input.municipality.toUpperCase()}` : 'NEGOCIO DESTACADO'}`,
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
  },
  required: ['badge_text', 'headline', 'sub', 'benefits', 'cta', 'visualHooks', 'whatsappStatusSequence', 'socialMediaCopy', 'videoReelScript', 'salesClosingTemplates'],
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
    raw = JSON.parse(jsonText) as Partial<MarketingCampaign> & Record<string, unknown>;
  } catch {
    throw new Error('La IA (pasada 2) no devolvió un JSON de campaña válido. Intenta de nuevo.');
  }
  return normalizeCampaign(raw, input, art);
}
