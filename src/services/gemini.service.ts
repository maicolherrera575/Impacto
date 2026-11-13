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
/** true cuando el bundle es de producción (build de Vercel). */
const IS_PROD = import.meta.env.PROD === true;

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

/** Punto único de llamada a Gemini para toda la app. */
async function callGemini(options: GeminiCallOptions): Promise<string> {
  // Producción: SIEMPRE por el proxy. La llave jamás toca el navegador.
  if (IS_PROD) return callProxy(options);

  // Desarrollo local con llave en .env: SDK directo (rápido, sin proxy).
  if (GEMINI_API_KEY) {
    const { response } = await getSdkModel().generateContent(buildPayload(options) as unknown as SdkRequest);
    const text = response.text().trim();
    if (text) return text;
    throw new Error('La IA no respondió con contenido. Intenta de nuevo');
  }

  // Desarrollo sin llave en el .env: intenta el proxy (ej: `vercel dev`).
  return callProxy(options);
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
// 🚀 AGENCIA IA — Campaña estratégica 360° (hooks, estados, copy, reel, cierre)
// ═══════════════════════════════════════════════════════════════════════════

export interface MarketingVisualHooks {
  slide1_hook: string;
  slide1_sub: string;
  slide2_headline: string;
  slide2_bullets: string[];
  slide3_cta: string;
}

export interface MarketingCampaign {
  visualHooks: MarketingVisualHooks;
  whatsappStatusSequence: { status1: string; status2: string; status3: string };
  socialMediaCopy: { pas: string; aida: string };
  videoReelScript: { t0_3: string; t3_10: string; t10_15: string };
  salesClosingTemplates: { priceReply: string; hesitantReply: string; dispatchUpsell: string };
}

export interface CampaignInput {
  businessName: string;
  slogan: string;
  product: string;
  normalPrice: number | null;
  promoPrice: number | null;
  address: string;
  municipality: string;
  targetUrl: string;
}

const CAMPAIGN_PROMPT = `Eres el director creativo y estratega de growth de una agencia de marketing digital experta en municipios rurales de Colombia (Cundinamarca: Gachetá, Guatavita, Ubaté).
Escribes con psicología de compra local: cercanía del pueblo, frescura, confianza, escasez honesta y venta por WhatsApp.

Recibirás datos del negocio. Devuelve ÚNICAMENTE un JSON con esta estructura exacta:
{
 "visualHooks": {
   "slide1_hook": "titular magnético de 4 a 7 palabras que detiene el scroll (pregunta o afirmación provocadora)",
   "slide1_sub": "subtítulo provocador corto",
   "slide2_headline": "promesa de valor + beneficio irresistible (máx 10 palabras)",
   "slide2_bullets": ["beneficio corto con emoji", "beneficio corto con emoji", "beneficio corto con emoji"],
   "slide3_cta": "llamado a la acción urgente con gatillo de escasez"
 },
 "whatsappStatusSequence": {
   "status1": "Estado de WhatsApp de la mañana: curiosidad o problema (máx 2 líneas)",
   "status2": "texto que acompaña la imagen de la oferta: revelación + precio (máx 3 líneas)",
   "status3": "Estado de la tarde/noche: escasez + prueba social + 👉 link"
 },
 "socialMediaCopy": {
   "pas": "fórmula PAS (Problema - Agitación - Solución) para Facebook/Instagram del municipio, máx 5 líneas, con emojis",
   "aida": "fórmula AIDA flash (Atención - Interés - Deseo - Acción) para grupos de WhatsApp y clasificados, máx 5 líneas, con emojis"
 },
 "videoReelScript": {
   "t0_3": "segundos 0-3: plano visual exacto y frase gancho hablada",
   "t3_10": "segundos 3-10: demostración del producto + beneficio",
   "t10_15": "segundos 10-15: llamado a la acción mostrando dirección y WhatsApp"
 },
 "salesClosingTemplates": {
   "priceReply": "respuesta lista cuando el cliente pregunta ¿precio?: da el precio y ofrece combo o domicilio",
   "hesitantReply": "respuesta para clientes indecisos con escasez o garantía",
   "dispatchUpsell": "confirmación de despacho + venta cruzada (upsell) natural"
 }
}
Todo en español colombiano cercano y honesto. Si no hay precio promo, no inventes precios.`;

/** Normaliza la respuesta de la IA contra el contrato de la campaña. */
function normalizeCampaign(raw: Partial<MarketingCampaign>): MarketingCampaign {
  const vh = (raw.visualHooks ?? {}) as Partial<MarketingVisualHooks>;
  const ws = (raw.whatsappStatusSequence ?? {}) as Partial<MarketingCampaign['whatsappStatusSequence']>;
  const sc = (raw.socialMediaCopy ?? {}) as Partial<MarketingCampaign['socialMediaCopy']>;
  const vr = (raw.videoReelScript ?? {}) as Partial<MarketingCampaign['videoReelScript']>;
  const cl = (raw.salesClosingTemplates ?? {}) as Partial<MarketingCampaign['salesClosingTemplates']>;
  return {
    visualHooks: {
      slide1_hook: (vh.slide1_hook ?? '').trim() || '¿Lo más rico del pueblo HOY?',
      slide1_sub: (vh.slide1_sub ?? '').trim() || 'Fresquito y recién hecho',
      slide2_headline: (vh.slide2_headline ?? '').trim() || 'El favorito del municipio',
      slide2_bullets:
        Array.isArray(vh.slide2_bullets) && vh.slide2_bullets.length > 0
          ? vh.slide2_bullets.filter((b): b is string => typeof b === 'string' && b.trim() !== '').slice(0, 3)
          : ['🥇 Calidad garantizada', '🚚 Domicilio disponible', '⏰ Solo por HOY'],
      slide3_cta: (vh.slide3_cta ?? '').trim() || '¡Pide el tuyo HOY! Toca y escríbenos 👉',
    },
    whatsappStatusSequence: {
      status1: (ws.status1 ?? '').trim() || '👀 ¿Ya sabes qué vas a almorzar hoy? Te va a encantar esto…',
      status2: (ws.status2 ?? '').trim() || '🔥 Hoy lo tienes a precio de amigo. Escríbenos y te lo apartamos 👉',
      status3: (ws.status3 ?? '').trim() || '🚨 ¡Últimas unidades! El pueblo ya está apartando. Escríbenos aquí 👉',
    },
    socialMediaCopy: {
      pas: (sc.pas ?? '').trim() || '¿Se te antoja algo rico y no quieres cocinar? 😩 Todos los días pasa igual… pero hoy tienes la solución a un mensaje de distancia. Escríbenos por WhatsApp 👉',
      aida: (sc.aida ?? '').trim() || '🔥 ATENCIÓN: salió lo que estabas esperando. 👀 Interésate: es fresquito y del pueblo. 😍 Desea: pídelo sin salir de casa. ⚡ Acción: escríbenos YA 👉',
    },
    videoReelScript: {
      t0_3: (vr.t0_3 ?? '').trim() || 'Plano cercano del producto humeando + voz: "¿Esto te lo imaginas en tu mesa hoy?"',
      t3_10: (vr.t3_10 ?? '').trim() || 'Demostración: muestra el producto, la porción y la frescura + voz: "recién hecho, como en casa"',
      t10_15: (vr.t10_15 ?? '').trim() || 'Plano del local o la moto del domicilio + voz: "escríbenos por WhatsApp y te lo llevamos hoy 👉"',
    },
    salesClosingTemplates: {
      priceReply: (cl.priceReply ?? '').trim() || '¡Claro que sí! 😊 El valor es $X. Si pides 2 te incluyo domicilio en el pueblo. ¿Te lo aparto?',
      hesitantReply: (cl.hesitantReply ?? '').trim() || 'Te entiendo 👍 Hoy solo nos quedan unas pocas unidades y mañana ya no hay. Por eso te las estoy apartando con tu nombre — ¿confirmamos?',
      dispatchUpsell: (cl.dispatchUpsell ?? '').trim() || '¡Listo, tu pedido va en camino 🛵! ¿Te incluyo una bebida bien fría por solo $X más?',
    },
  };
}

/** Fallback local ultra-completo: el estudio JAMÁS se queda sin campaña. */
function localCampaignFallback(input: CampaignInput): MarketingCampaign {
  const prod = input.product.trim() || `lo mejor de ${input.businessName || 'nuestro negocio'}`;
  const biz = input.businessName.trim() || 'nuestro negocio';
  const place = input.municipality.trim() || 'el pueblo';
  const price = input.promoPrice != null ? `$${input.promoPrice.toLocaleString('es-CO')}` : '';
  const priceTxt = price ? ` a solo ${price}` : '';
  const before = input.normalPrice != null && input.promoPrice != null ? ` (antes $${input.normalPrice.toLocaleString('es-CO')})` : '';
  const link = input.targetUrl || '👇 escríbenos por WhatsApp';

  return normalizeCampaign({
    visualHooks: {
      slide1_hook: `¿Ya probaste ${prod}?`,
      slide1_sub: `${biz} · ${place} · fresquito HOY`,
      slide2_headline: price ? `${prod}${priceTxt}${before}` : `${prod}: el favorito de ${place}`,
      slide2_bullets: ['🥇 Calidad garantizada', '🚚 Domicilio disponible', '⏰ Solo por HOY'],
      slide3_cta: price ? `¡Pide el tuyo HOY${priceTxt}! Escríbenos 👉` : '¡Aparta el tuyo HOY! Escríbenos 👉',
    },
    whatsappStatusSequence: {
      status1: `👀 ¿Se te antojó ${prod} hoy? Mira esto…`,
      status2: `🔥 ${prod} en ${biz}${priceTxt}. Escríbenos y te lo apartamos ${link}`,
      status3: `🚨 ¡Últimas unidades de ${prod}! El pueblo ya está apartando. ${link}`,
    },
    socialMediaCopy: {
      pas: `¿Se te antoja ${prod} y no quieres desplazarte? 😩 En ${place} pasa todos los días… Hoy tienes la solución a un mensaje: ${biz} te lo lleva fresco${priceTxt}. Escríbenos 👉 ${link}`,
      aida: `🔥 ATENCIÓN ${place}: ${prod} disponible HOY.\n👀 Interés: recién hecho, de confianza.\n😍 Deseo: pídelo sin salir de casa${priceTxt}.\n⚡ Acción: escríbenos YA ${link}`,
    },
    videoReelScript: {
      t0_3: `Segundos 0-3: plano cercano del producto + voz: "¿Esto te lo imaginas en tu mesa hoy?"`,
      t3_10: `Segundos 3-10: muestra ${prod} bien servido + voz: "en ${biz} es fresquito, como en casa"`,
      t10_15: `Segundos 10-15: plano del local o la moto + voz: "escríbenos por WhatsApp y te lo llevamos hoy ${input.address || place}"`,
    },
    salesClosingTemplates: {
      priceReply: price
        ? `¡Claro que sí! 😊 ${prod} está en ${price}${before}. Si pides 2 te incluyo el domicilio en ${place}. ¿Te lo aparto?`
        : `¡Claro que sí! 😊 Cuéntame cuántos necesitas y te paso el valor al toque. ¿Te aparto uno ya?`,
      hesitantReply: `Te entiendo 👍 Hoy solo nos quedan unas pocas unidades y mañana ya no hay — por eso te lo estoy apartando con tu nombre. ¿Confirmamos?`,
      dispatchUpsell: `¡Listo, tu pedido va en camino 🛵! ¿Te incluyo una bebida bien fría o un extra por un poquito más?`,
    },
  });
}

const CAMPAIGN_SCHEMA: Record<string, unknown> = {
  type: SchemaType.OBJECT,
  properties: {
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
  required: ['visualHooks', 'whatsappStatusSequence', 'socialMediaCopy', 'videoReelScript', 'salesClosingTemplates'],
};

/**
 * Genera la campaña estratégica completa de un negocio: hooks para las 3
 * piezas gráficas, secuencia de Estados de WhatsApp, copy PAS/AIDA, guion
 * de Reel cámara por cámara y plantillas de cierre de venta.
 * Con fallback local: si la IA falla, SIEMPRE devuelve una campaña usable.
 */
export async function generateFullMarketingCampaign(input: CampaignInput): Promise<MarketingCampaign> {
  const facts = [
    `Negocio/marca: ${input.businessName}`,
    `Eslogan o rubro: ${input.slogan || '(no hay)'}`,
    `Producto/promoción estrella: ${input.product || '(no hay, elige un enfoque)'}`,
    `Precio normal: ${input.normalPrice != null ? `$${input.normalPrice.toLocaleString('es-CO')}` : '(no aplica)'}`,
    `Precio promoción: ${input.promoPrice != null ? `$${input.promoPrice.toLocaleString('es-CO')}` : '(no aplica)'}`,
    `Dirección o referencia: ${input.address || '(no hay)'}`,
    `Municipio: ${input.municipality}`,
    `Enlace/WhatsApp de destino: ${input.targetUrl}`,
  ].join('\n');

  try {
    const jsonText = await callGemini({
      systemInstruction: CAMPAIGN_PROMPT,
      prompt: facts,
      temperature: 0.85,
      responseSchema: CAMPAIGN_SCHEMA,
    });
    return normalizeCampaign(JSON.parse(jsonText) as Partial<MarketingCampaign>);
  } catch {
    // Sin conexión o IA caída: campaña local de nivel agencia (jamás falla).
    return localCampaignFallback(input);
  }
}
