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

let modelInstance: ReturnType<GoogleGenerativeAI['getGenerativeModel']> | null = null;

function getModel() {
  if (!modelInstance) {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    modelInstance = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        temperature: 0.4,
        responseMimeType: 'application/json',
        responseSchema: {
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
        },
      },
    });
  }
  return modelInstance;
}

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

  const { response } = await getModel().generateContent(`Mensaje del comerciante: """${text}"""`);
  const jsonText = response.text().trim();

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
  amountCop: number | null;
  reference: string | null;
  note: string;
}

const RECEIPT_PROMPT = `Eres el verificador de pagos de Impulso. Analiza la imagen (captura de pantalla) de un comprobante de pago de Nequi, Daviplata o Bancolombia de Colombia.
Devuelve ÚNICAMENTE este JSON:
{"looks_real": true|false, "amount_cop": número entero del valor pagado o null, "reference": "código de referencia / número de transacción visible (máx 40 caracteres)" o null, "note": "fracción corta en español describiendo lo que leíste"}

Criterios:
- looks_real: true solo si la imagen parece un comprobante real de Nequi/Daviplata/Bancolombia (pantalla de la app con monto y fecha). Si es un dibujo, un meme, otra cosa o no se entiende, false.
- amount_cop: el valor pagado en pesos (si dice $24.000, devuelve 24000).
- reference: la referencia, código de confirmación, número de transacción o "Id de operación" visible.
- note: descripción breve (máx 120 caracteres).`;

/**
 * 🤖 IA Vision: lee la miniatura del comprobante Nequi/Daviplata y extrae
 * el valor pagado y la referencia en ~2 segundos, sin pasarela de pago.
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

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
  });

  const { response } = await model.generateContent([
    { inlineData: { mimeType, data: base64 } },
    { text: RECEIPT_PROMPT },
  ]);
  const jsonText = response.text().trim();

  const parsed = JSON.parse(jsonText) as {
    looks_real?: boolean;
    amount_cop?: number | null;
    reference?: string | null;
    note?: string | null;
  };
  return {
    looksReal: parsed.looks_real === true,
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

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: TRUST_PROMPT,
    generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
  });

  const { response } = await model.generateContent(facts);
  const jsonText = response.text().trim();

  const parsed = JSON.parse(jsonText) as Partial<MerchantTrustResult>;
  const level = parsed.level === 'green' ? 'green' : 'yellow';
  return {
    level,
    summary: typeof parsed.summary === 'string' && parsed.summary.trim() !== '' ? parsed.summary.trim() : 'Revisión completada',
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings.filter((w): w is string => typeof w === 'string' && w.trim() !== '') : [],
  };
}
