import { SchemaType } from '@google/generative-ai';
import { GEMINI_API_KEY, GEMINI_API_KEYS } from '../config/env';
import { getDeviceId } from './deviceFingerprint';
import type { Category, ParsedPromo } from '../types';
import { buildPaletteFromHexTriplet } from '../utils/colorPalette';
import type { ExtractedBrandPalette } from '../utils/colorPalette';
import { detectFraudSignals, SECURITY_BLOCK_MESSAGE } from '../utils/securityFilter';

const CATEGORY_IDS: Category[] = [
  'comida',
  'transporte_flete',
  'agro_mercado',
  'hoteles_turismo',
  'salud_belleza',
  'hogar_construccion',
  'servicios_comercios',
];

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

// ── Motor de IA V36.0 Ultra-Rápido (<2s): Autodescubrimiento + Circuit Breaker + Zero-Token Cache ──
// PRODUCCIÓN (Vercel): UNA sola petición a /api/gemini (model: 'auto') donde el servidor
// orquesta las 4+ llaves, el descubrimiento de modelos (TTL 60 min) y el circuit breaker en <50ms.
// DESARROLLO local / respaldo sin proxy: descubrimiento + circuit breaker + AbortController en cliente.

const FALLBACK_CLIENT_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
] as const;

const FORBIDDEN_MODEL_RE = /embedding|aqa|imagen|veo|tts|audio|live|bison|gecko|legacy|1\.0|1\.5/i;
const CLIENT_DISCOVERY_TTL_MS = 60 * 60 * 1000;
const CLIENT_TEXT_TIMEOUT_MS = 5_500;
const CLIENT_VISION_TIMEOUT_MS = 12_000;
const PROXY_TEXT_TIMEOUT_MS = 15_000;
const PROXY_VISION_TIMEOUT_MS = 24_000;
const LOCAL_CACHE_PREFIX = 'impulso_ai_cache_v36:';
const LOCAL_CACHE_TTL_MS = 30 * 60 * 1000;

export const AI_BUSY_FRIENDLY_MSG =
  'Nuestro motor de IA está atendiendo alta demanda en este instante. Intenta de nuevo en unos segundos.';

/** 🔄 V36.0 · Pool Multi-Key (4+ proyectos) deduplicado para rotación instantánea. */
const API_KEY_POOL: string[] = Array.from(
  new Set(
    [
      ...GEMINI_API_KEYS,
      GEMINI_API_KEY,
      typeof __APP_GEMINI_KEY__ === 'string' ? __APP_GEMINI_KEY__ : '',
      typeof __APP_GEMINI_KEY_1__ === 'string' ? __APP_GEMINI_KEY_1__ : '',
      typeof __APP_GEMINI_KEY_2__ === 'string' ? __APP_GEMINI_KEY_2__ : '',
      typeof __APP_GEMINI_KEY_3__ === 'string' ? __APP_GEMINI_KEY_3__ : '',
      typeof __APP_GEMINI_KEY_4__ === 'string' ? __APP_GEMINI_KEY_4__ : '',
    ]
      .map((k) => k.trim())
      .filter((k) => k.length >= 16),
  ),
);

let activeKeyIndex = 0;
let clientDiscoveredModels: string[] = [];
let clientDiscoveredAt = 0;
const clientDeadCombos = new Set<string>();
const clientDeadModels = new Set<string>();
const clientCooldownUntil = new Map<string, number>();
const clientMemoryCache = new Map<string, { at: number; text: string }>();

function fastCacheHash(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 16777619);
    h2 = Math.imul(h2 ^ ch, 2654435761);
  }
  return ((h1 >>> 0).toString(36) + (h2 >>> 0).toString(36)).slice(0, 16);
}

function readClientAiCache(key: string): string | null {
  const now = Date.now();
  const mem = clientMemoryCache.get(key);
  if (mem && now - mem.at < LOCAL_CACHE_TTL_MS) return mem.text;
  try {
    const raw = localStorage.getItem(`${LOCAL_CACHE_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at?: number; text?: string };
    if (parsed.text && typeof parsed.at === 'number' && now - parsed.at < LOCAL_CACHE_TTL_MS) {
      clientMemoryCache.set(key, { at: parsed.at, text: parsed.text });
      return parsed.text;
    }
    localStorage.removeItem(`${LOCAL_CACHE_PREFIX}${key}`);
  } catch {
    /* localStorage no disponible */
  }
  return null;
}

function writeClientAiCache(key: string, text: string): void {
  const entry = { at: Date.now(), text };
  if (clientMemoryCache.size > 120) {
    const firstKey = clientMemoryCache.keys().next().value;
    if (firstKey) clientMemoryCache.delete(firstKey);
  }
  clientMemoryCache.set(key, entry);
  try {
    localStorage.setItem(`${LOCAL_CACHE_PREFIX}${key}`, JSON.stringify(entry));
  } catch {
    /* cuota localStorage llena: mantiene en memoria */
  }
}

function isRateLimitError(status?: number, errOrPayload?: unknown): boolean {
  if (status === 429) return true;
  if (errOrPayload && typeof errOrPayload === 'object') {
    const errObj = (errOrPayload as { error?: { status?: string; message?: string; code?: number } }).error;
    if (errObj?.code === 429) return true;
    const nested = `${errObj?.status ?? ''} ${errObj?.message ?? ''}`;
    if (/\b429\b|Too Many Requests|RESOURCE_EXHAUSTED|rate[_\s-]*limit|quota/i.test(nested)) {
      return true;
    }
  }
  const msg = errOrPayload instanceof Error ? errOrPayload.message : typeof errOrPayload === 'string' ? errOrPayload : '';
  return /\b429\b|Too Many Requests|RESOURCE_EXHAUSTED|rate[_\s-]*limit|quota/i.test(msg);
}

function isModelNotFoundError(status?: number, payload?: unknown): boolean {
  if (status === 404) return true;
  const errObj = (payload as { error?: { status?: string; message?: string } } | null)?.error;
  const msg = `${errObj?.status ?? ''} ${errObj?.message ?? ''}`;
  return /NOT_FOUND|is not found for API version|not supported for generateContent|deprecated/i.test(msg);
}

async function fetchWithAbort(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

function scoreClientModel(name: string): number {
  const lower = name.toLowerCase();
  if (!lower.startsWith('gemini-') || FORBIDDEN_MODEL_RE.test(lower)) return -1;
  if (/thinking|exp-\d{4}|preview-tts|computer-use|robotics|deep-research/i.test(lower)) return -1;
  const verMatch = /gemini-(\d+)(?:\.(\d+))?/i.exec(lower);
  const ver = (verMatch ? Number(verMatch[1]) : 0) * 100 + (verMatch && verMatch[2] ? Number(verMatch[2]) : 0) * 10;
  const fam = lower.includes('flash-lite') ? 75 : lower.includes('flash') ? 95 : lower.includes('pro') ? 35 : 0;
  const stab = /preview|exp/i.test(lower) ? -8 : 12;
  return ver + fam + stab;
}

async function discoverClientModels(): Promise<string[]> {
  const now = Date.now();
  if (clientDiscoveredModels.length > 0 && now - clientDiscoveredAt < CLIENT_DISCOVERY_TTL_MS) {
    return clientDiscoveredModels.filter((m) => !clientDeadModels.has(m));
  }
  if (API_KEY_POOL.length === 0) return FALLBACK_CLIENT_MODELS.filter((m) => !clientDeadModels.has(m));
  const key = API_KEY_POOL[activeKeyIndex % API_KEY_POOL.length];
  try {
    const res = await fetchWithAbort(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=100`,
      { method: 'GET', headers: { Accept: 'application/json' } },
      3_000,
    );
    if (res.ok) {
      const json = (await res.json().catch(() => null)) as {
        models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
      } | null;
      const ranked = (json?.models ?? [])
        .filter((m) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
        .map((m) => String(m.name ?? '').replace(/^models\//, '').trim())
        .filter((name) => scoreClientModel(name) > 0 && !clientDeadModels.has(name))
        .sort((a, b) => scoreClientModel(b) - scoreClientModel(a));
      const unique = Array.from(new Set(ranked)).slice(0, 5);
      if (unique.length > 0) {
        clientDiscoveredModels = unique;
        clientDiscoveredAt = now;
        return unique;
      }
    }
  } catch {
    /* usa semilla estable */
  }
  return FALLBACK_CLIENT_MODELS.filter((m) => !clientDeadModels.has(m));
}

export interface GeminiConversationTurn {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

interface GeminiCallOptions {
  systemInstruction?: string;
  prompt: string;
  /** Historial multi-turno real para Radar conversacional con memoria. */
  conversationContents?: GeminiConversationTurn[];
  /** Imagen inline base64 (sin el prefijo data:) para IA Vision. */
  image?: { mimeType: string; data: string };
  temperature: number;
  responseSchema?: Record<string, unknown>;
  /** Habilita caché Zero-Token en cliente para consultas deterministas / FAQ. */
  cacheKeyHint?: string;
}

/** Construye payload compatible con REST (soporta historial multi-turno). */
function buildPayload(options: GeminiCallOptions): Record<string, unknown> {
  const parts: Record<string, unknown>[] = [];
  if (options.image) parts.push({ inlineData: options.image });
  if (options.prompt) parts.push({ text: options.prompt });

  const contents =
    options.conversationContents && options.conversationContents.length > 0
      ? options.conversationContents
      : [{ role: 'user', parts }];

  return {
    ...(options.systemInstruction ? { systemInstruction: { parts: [{ text: options.systemInstruction }] } } : {}),
    contents,
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

/**
 * 1) Llama UNA sola vez al proxy serverless `/api/gemini` (`model: 'auto'`).
 *    El servidor maneja las 4+ llaves, el descubrimiento y el circuit breaker en <50ms.
 */
async function callProxyAuto(options: GeminiCallOptions): Promise<{ ok: true; text: string } | { ok: false; proxyUnavailable: boolean }> {
  const isVision = Boolean(options.image);
  try {
    const res = await fetchWithAbort(
      '/api/gemini',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Fingerprint': getDeviceId(),
        },
        body: JSON.stringify({
          model: 'auto',
          mode: isVision ? 'vision' : 'chat',
          payload: buildPayload(options),
        }),
      },
      isVision ? PROXY_VISION_TIMEOUT_MS : PROXY_TEXT_TIMEOUT_MS,
    );
    if (res.status === 404 || res.status === 405) {
      return { ok: false, proxyUnavailable: true };
    }
    const rest: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      // Si el servidor no tiene llaves configuradas (500) o falló red, permite respaldo directo local
      return { ok: false, proxyUnavailable: res.status === 500 || res.status === 502 };
    }
    const text = extractRestText(rest);
    if (!text) return { ok: false, proxyUnavailable: false };
    return { ok: true, text };
  } catch {
    return { ok: false, proxyUnavailable: true };
  }
}

/** 2) Respaldo directo REST (solo cuando /api/gemini no está disponible en local) con Circuit Breaker y AbortController. */
async function callDirectResilient(options: GeminiCallOptions): Promise<string> {
  if (API_KEY_POOL.length === 0) throw new Error(AI_BUSY_FRIENDLY_MSG);
  const isVision = Boolean(options.image);
  const perAttemptMs = isVision ? CLIENT_VISION_TIMEOUT_MS : CLIENT_TEXT_TIMEOUT_MS;
  const deadline = Date.now() + (isVision ? 20_000 : 12_000);
  const models = await discoverClientModels();
  const payloadStr = JSON.stringify(buildPayload(options));

  for (const model of models.slice(0, 3)) {
    if (Date.now() >= deadline || clientDeadModels.has(model)) continue;
    let all404 = true;

    for (let attempt = 0; attempt < API_KEY_POOL.length; attempt += 1) {
      const now = Date.now();
      if (now >= deadline) break;
      const idx = (activeKeyIndex + attempt) % API_KEY_POOL.length;
      const comboId = `${idx}:${model}`;
      if (clientDeadCombos.has(comboId) || (clientCooldownUntil.get(comboId) ?? 0) > now) continue;

      const apiKey = API_KEY_POOL[idx];
      try {
        const res = await fetchWithAbort(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payloadStr,
          },
          Math.max(1_500, Math.min(perAttemptMs, deadline - now)),
        );
        const rest: unknown = await res.json().catch(() => null);
        if (res.ok) {
          const text = extractRestText(rest);
          if (text) {
            activeKeyIndex = idx;
            return text;
          }
          all404 = false;
          continue;
        }
        if (isModelNotFoundError(res.status, rest)) {
          clientDeadCombos.add(comboId);
          break;
        }
        all404 = false;
        if (isRateLimitError(res.status, rest)) {
          clientCooldownUntil.set(comboId, Date.now() + 120_000);
          activeKeyIndex = (idx + 1) % API_KEY_POOL.length;
          continue;
        }
        activeKeyIndex = (idx + 1) % API_KEY_POOL.length;
      } catch {
        all404 = false;
        activeKeyIndex = (idx + 1) % API_KEY_POOL.length;
      }
    }
    if (all404) clientDeadModels.add(model);
  }
  throw new Error(AI_BUSY_FRIENDLY_MSG);
}

/**
 * Wrapper unificado V36.0 (<2s promedio, tope máximo 15s, 0 cuelgues):
 *  0) Zero-Token Cache en cliente (si `cacheKeyHint` aplica).
 *  1) Proxy serverless `/api/gemini` en 1 sola llamada (`model: 'auto'`).
 *  2) Respaldo directo REST solo si el proxy no está disponible y hay llaves locales.
 */
async function callGemini(options: GeminiCallOptions): Promise<string> {
  const cacheKey =
    options.cacheKeyHint && !options.image
      ? fastCacheHash(options.cacheKeyHint)
      : null;

  if (cacheKey) {
    const cached = readClientAiCache(cacheKey);
    if (cached) return cached;
  }

  const proxyResult = await callProxyAuto(options);
  if (proxyResult.ok) {
    if (cacheKey) writeClientAiCache(cacheKey, proxyResult.text);
    return proxyResult.text;
  }

  if (proxyResult.proxyUnavailable && API_KEY_POOL.length > 0) {
    const directText = await callDirectResilient(options);
    if (cacheKey) writeClientAiCache(cacheKey, directText);
    return directText;
  }

  throw new Error(AI_BUSY_FRIENDLY_MSG);
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

/** Respaldo determinista instantáneo (<2ms) si todas las llaves IA estuvieran saturadas. */
function synthesizeLocalOfferFromText(freeText: string): ParsedPromo {
  const lower = freeText.toLowerCase();
  let category: Category = 'servicios_comercios';
  let emoji = '🔥';
  if (/almuerz|trucha|pollo|carne|asado|pan\b|pandebono|croissant|caf[eé]|desayun|arepa|pizza|comida|restaurante|postre|torta/i.test(lower)) {
    category = 'comida';
    emoji = /pan|croissant|torta|postre/i.test(lower) ? '🥐' : '🍽️';
  } else if (/abono|agro|campo|finca|semilla|concentrado|ganado|fertiliz|bulto|cultivo/i.test(lower)) {
    category = 'agro_mercado';
    emoji = '🌱';
  } else if (/flete|cami[oó]n|mudanza|transporte|domicilio|carga|viaje/i.test(lower)) {
    category = 'transporte_flete';
    emoji = '🚚';
  } else if (/hotel|caba[nñ]|piscina|hospedaje|glamping|turismo/i.test(lower)) {
    category = 'hoteles_turismo';
    emoji = '🏨';
  } else if (/droguer|salud|m[eé]dic|belleza|peluquer|barber|u[nñ]as|spa|odont/i.test(lower)) {
    category = 'salud_belleza';
    emoji = '💄';
  } else if (/ferreter|herramienta|cemento|pintura|obra|construcci|hogar|mueble/i.test(lower)) {
    category = 'hogar_construccion';
    emoji = '🛠️';
  }

  // Extrae precios tipo "a 12 mil", "$15.000", "20000"
  const milMatches = [...lower.matchAll(/(\d{1,3}(?:[.,]\d)?)\s*(?:mil|k)\b/gi)].map((m) =>
    Math.round(Number(m[1].replace(',', '.')) * 1000),
  );
  const exactMatches = [...lower.matchAll(/\$?\s*(\d{1,3}(?:\.\d{3})+|\d{4,7})\b/g)].map((m) =>
    Math.round(Number(m[1].replace(/\./g, ''))),
  );
  const allPrices = [...milMatches, ...exactMatches].filter((n) => Number.isFinite(n) && n >= 500 && n <= 50_000_000);
  const promoPrice = allPrices.length > 0 ? Math.min(...allPrices) : 15000;
  const originalPrice = allPrices.length > 1 ? Math.max(...allPrices) : null;

  // Extrae cupos tipo "15 almuerzos", "20 cupos", "10 unidades"
  const quotaMatch = /\b(\d{1,3})\s*(?:almuerz|cupo|unidad|plato|bulto|pan|docena|combo|kit|servicio|turno|paquete)/i.exec(lower);
  const totalQuota = quotaMatch ? Math.min(500, Math.max(1, Number(quotaMatch[1]))) : 10;

  // Extrae duración
  let durationHours = 4;
  const hrsMatch = /(\d+(?:[.,]\d)?)\s*hora/i.exec(lower);
  const daysMatch = /(\d+)\s*d[ií]a/i.exec(lower);
  if (hrsMatch) durationHours = Math.min(96, Math.max(0.5, Number(hrsMatch[1].replace(',', '.'))));
  else if (daysMatch) durationHours = Math.min(96, Math.max(1, Number(daysMatch[1]) * 24));
  else if (/hoy|tarde/i.test(lower)) durationHours = 6;
  else if (/ma[nñ]ana/i.test(lower)) durationHours = 24;

  const cleaned = freeText.replace(/\s+/g, ' ').trim();
  const title = cleaned.slice(0, 68).replace(/[.,;:]+$/, '') || 'Oferta relámpago de hoy';
  const description = cleaned.slice(0, 260) || title;

  return normalize({
    category,
    title: title.charAt(0).toUpperCase() + title.slice(1),
    description: description.charAt(0).toUpperCase() + description.slice(1),
    emoji_icon: emoji,
    original_price: originalPrice && originalPrice > promoPrice ? originalPrice : null,
    promo_price: promoPrice,
    total_quota: totalQuota,
    duration_hours: durationHours,
  });
}

/**
 * Creador Mágico: interpreta lenguaje natural (texto o voz dictada) del
 * comerciante y devuelve un objeto de promoción listo para publicar (<2s).
 */
export async function parsePromoFromText(freeText: string): Promise<ParsedPromo> {
  const text = freeText.trim();
  if (text.length < 8) {
    throw new Error('Cuéntame un poco más de tu promoción para crearla con IA ✨');
  }
  if (detectFraudSignals(text)) {
    throw new Error(FRAUD_MESSAGE);
  }

  try {
    const jsonText = await callGemini({
      systemInstruction: SYSTEM_PROMPT,
      prompt: `Mensaje del comerciante: """${text}"""`,
      temperature: 0.35,
      responseSchema: PROMO_SCHEMA,
      cacheKeyHint: `promo:${text.toLowerCase()}`,
    });
    return normalize(parseAiJson<Partial<ParsedPromo>>(jsonText));
  } catch {
    return synthesizeLocalOfferFromText(text);
  }
}

/**
 * Escudo local anti-fraude (corre SIEMPRE, con o sin IA): detecta intentos
 * de extorsión, gota a gota, giros anticipados o citas peligrosas en el
 * texto de una oferta o de un pedido de la comunidad.
 */
export const FRAUD_MESSAGE = SECURITY_BLOCK_MESSAGE;
export { detectFraudSignals };

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
const TYPOGRAPHY_PAIR_IDS = ['impacto', 'lujo', 'tech', 'anton', 'gruesa', 'marcador', 'suiza', 'pop'] as const;
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
  /** Par tipográfico editorial elegido por la IA (rotación obligatoria). */
  typographyPair: string;
  /** Nombre comercial deducido del brief por la IA. */
  brandName: string;
  /** Título del servicio/producto estrella deducido del brief. */
  productTitle: string;
  /** Rubro/categoría COMERCIAL visible deducida del brief (NUNCA genérica). */
  categoryLabel: string;
  /** Tagline / sello superior corto (3-5 palabras) generado dinámicamente del brief. */
  dynamicTagline: string;
  valueProposition: string;
  imagePromptEn: string;
}

export interface MarketingCampaign {
  industryType: IndustryType;
  themeId: string;
  layoutId: string;
  /** Promesa comercial de alto calibre (reescritura del brief por la IA). */
  valueProposition: string;
  /** Sello superior sugerido para el afiche generado dinámicamente del brief. */
  badgeText: string;
  /** Tagline dinámico generado directamente del brief del negocio. */
  dynamicTagline: string;
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
  /** Tema/layout/tipografía de la generación anterior: la IA debe variarlos SIEMPRE. */
  previousThemeId?: string;
  previousLayoutId?: string;
  previousFontId?: string;
}

/** Normaliza espacios: NUNCA dos palabras pegadas, NUNCA bordes sucios. */
export function normSpaces(v: unknown): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '';
}

/** Directivas psicológicas reales por enfoque (aplicadas en IA y motor sintético). */
export const FOCUS_DIRECTIVES: Record<
  CampaignFocus,
  {
    prompt: string;
    badges: string[];
    serviceBadges: string[];
    ctas: string[];
    serviceCtas: string[];
    preferredThemes: readonly string[];
    preferredLayouts: readonly string[];
    headlineFor: (
      product: string,
      brand: string,
      place: string,
      isService?: boolean,
      industry?: IndustryType,
    ) => Array<[string, string]>;
    subPrefix: string;
    serviceSubPrefix: string;
  }
> = {
  remate: {
    prompt:
      'ENFOQUE PSICOLÓGICO — URGENCIA / ACCIÓN INMEDIATA: Tono eléctrico de acción inmediata, escasez real y oportunidad límite de hoy (para productos: "SOLO POR HOY", "ÚLTIMOS CUPOS"; para servicios/agencias/profesionales: "AGENDA ABIERTA HOY", "CUPOS LIMITADOS", PROHIBIDO escribir "en remate" si el brief es una agencia, servicio profesional o plataforma digital). Empuja al cierre inmediato sin rodeos.',
    badges: ['SOLO POR HOY', 'ÚLTIMOS CUPOS', 'OFERTA RELÁMPAGO', 'CIERRE DE HOY'],
    serviceBadges: ['AGENDA ABIERTA HOY', 'CUPOS LIMITADOS', 'IMPULSO INMEDIATO', 'ATENCIÓN PRIORITARIA'],
    ctas: ['ESCANEA Y APARTA HOY', 'RESERVA HOY EN IMPULSO'],
    serviceCtas: ['ESCANEA Y AGENDA HOY', 'SOLICITA TU ASESORÍA HOY'],
    preferredThemes: ['obsidian', 'ember', 'pop', 'vino', 'carbon'],
    preferredLayouts: ['diagonal', 'diagx', 'immersive', 'split', 'portal'],
    headlineFor: (product, brand, place, isService = false, industry) => {
      const treatAsService =
        isService ||
        industry === 'digital_tech' ||
        industry === 'servicios_profesionales' ||
        industry === 'salud_belleza';
      if (treatAsService) {
        return [
          ['Activa hoy tus resultados con', product],
          [`Cupos limitados esta semana en`, brand],
          ['Acelera hoy tu crecimiento con', product],
        ];
      }
      return [
        [`Solo por hoy en ${place}:`, `${product} a precio especial`],
        ['Últimos cupos de hoy para', `llevar ${product} YA`],
        ['Aprovecha antes del cierre:', `${product} hoy mismo`],
      ];
    },
    subPrefix: 'Oportunidad por tiempo limitado:',
    serviceSubPrefix: 'Agenda prioritaria abierta hoy:',
  },
  prestigio: {
    prompt:
      'ENFOQUE PSICOLÓGICO — PRESTIGIO / LUJO: Tono editorial sofisticado, exclusividad, maestría y alto nivel (claves: "EDICIÓN EXCLUSIVA", "SELECCIÓN PREMIUM", "EXPERIENCIA SUPERIOR"). PROHIBIDO sonar a remate barato.',
    badges: ['EDICIÓN EXCLUSIVA', 'SELECCIÓN PREMIUM', 'ALTO NIVEL', 'CALIDAD SUPERIOR'],
    serviceBadges: ['ESTUDIO DE ÉLITE', 'ESTRATEGIA PREMIUM', 'ALTO IMPACTO', 'ASESORÍA EXCLUSIVA'],
    ctas: ['ESCANEA PARA ATENCIÓN VIP', 'RESERVA EXPERIENCIA EXCLUSIVA'],
    serviceCtas: ['ESCANEA Y AGENDA ASESORÍA VIP', 'CONOCE NUESTRO PORTAFOLIO'],
    preferredThemes: ['marble', 'obsidian', 'vino', 'arena', 'slate'],
    preferredLayouts: ['swiss', 'zen', 'immersive', 'magazine', 'portal'],
    headlineFor: (product, brand, _place, isService = false, industry) => {
      if (isService || industry === 'digital_tech' || industry === 'servicios_profesionales') {
        return [
          ['Dirección y estrategia superior en', product],
          [`${brand}: excelencia diseñada para`, 'marcas que lideran'],
          ['Eleva el nivel de tu negocio con', product],
        ];
      }
      return [
        ['Exclusividad y alto nivel en', product],
        [`${brand}: pensado para quienes`, 'exigen lo mejor'],
        ['Selección premium creada para', `destacar con ${product}`],
      ];
    },
    subPrefix: 'Experiencia superior:',
    serviceSubPrefix: 'Estándar ejecutivo de agencia:',
  },
  confianza: {
    prompt:
      'ENFOQUE PSICOLÓGICO — CONFIANZA / TRADICIÓN: Tono cercano, honesto, respaldo comprobado y trato directo en el municipio (claves: "RESPALDO REAL", "GARANTÍA DIRECTA", "TRATO HONESTO"). Transmite seguridad total.',
    badges: ['RESPALDO GARANTIZADO', 'CONFIANZA LOCAL', 'ATENCIÓN DIRECTA', 'COMPRA SEGURA'],
    serviceBadges: ['RESPALDO PROFESIONAL', 'RESULTADOS REALES', 'ASESORÍA DIRECTA', 'ALIADO DE CONFIANZA'],
    ctas: ['ESCANEA Y COTIZA DIRECTO', 'ESCRÍBENOS CON CONFIANZA'],
    serviceCtas: ['ESCANEA PARA DIAGNÓSTICO', 'HABLA DIRECTO CON UN EXPERTO'],
    preferredThemes: ['emerald', 'wood', 'slate', 'clinic', 'kraft'],
    preferredLayouts: ['magazine', 'bento', 'collage', 'immersive', 'orbits'],
    headlineFor: (product, brand, place, isService = false, industry) => {
      if (isService || industry === 'digital_tech' || industry === 'servicios_profesionales') {
        return [
          ['Resultados claros y respaldo real en', product],
          [`${brand}: tu aliado estratégico`, `de confianza en ${place}`],
          ['Acompañamiento directo y medible en', product],
        ];
      }
      return [
        ['Calidad real y garantizada en', product],
        [`La confianza de ${place} está`, `en ${brand} cada día`],
        ['Cero sorpresas y trato directo:', `elige ${product}`],
      ];
    },
    subPrefix: 'Respaldo directo y transparente:',
    serviceSubPrefix: 'Acompañamiento real paso a paso:',
  },
  viral: {
    prompt:
      'ENFOQUE PSICOLÓGICO — VIRAL / CURIOSIDAD: Tono disruptivo, conversacional y magnético que detiene el scroll en TikTok, Reels y Estados (contraste inesperado, pregunta gancho o prueba social masiva).',
    badges: ['TENDENCIA HOY', 'LO MÁS BUSCADO', 'NO TE LO PIERDAS', 'VIRAL EN REDES'],
    serviceBadges: ['CRECIMIENTO IMPARABLE', 'TENDENCIA DIGITAL', 'IDEAS QUE VENDEN', 'IMPACTO REAL'],
    ctas: ['ESCANEA Y DESCUBRE CÓMO', 'ESCANEA Y CONOCE MÁS HOY'],
    serviceCtas: ['ESCANEA Y TRANSFORMA TU MARCA', 'DESCUBRE EL MÉTODO AQUÍ'],
    preferredThemes: ['cyber', 'aurora', 'oceano', 'pop', 'carbon'],
    preferredLayouts: ['orbits', 'bleed', 'immersive', 'diagx', 'float'],
    headlineFor: (product, brand, place, isService = false, industry) => {
      if (isService || industry === 'digital_tech' || industry === 'servicios_profesionales') {
        return [
          ['Haz que todos en redes hablen', `de tu marca con ${brand}`],
          ['¿Listo para destacar hoy con', `${product}?`],
          ['Convierte miradas en clientes con', product],
        ];
      }
      return [
        [`Todos en ${place} están hablando`, `hoy de ${product}`],
        ['¿Por qué todos eligen ahora', `${product} por encima del resto?`],
        ['El secreto mejor guardado para', `disfrutar ${product}`],
      ];
    },
    subPrefix: 'Tendencia imparable hoy:',
    serviceSubPrefix: 'La fórmula que destaca en redes:',
  },
};

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
 "dynamic_tagline": "tagline o sello superior CORTO en MAYÚSCULAS (2 a 4 palabras, SIN emojis) que resuma la esencia o ventaja única del brief (ej: 'VENTAS QUE ESCALAN', 'SABOR DE LA REGIÓN', 'DESPACHO EN MINUTOS'). PROHIBIDO clichés genéricos como 'CRECE CON EXPERTOS' o 'CALIDAD GARANTIZADA'",
 "theme_id": uno de [wood, marble, cyber, kraft, ember, emerald, obsidian, clinic, terracotta, pop, aurora, slate, arena, vino, oceano, carbon]. Varía libremente entre paletas y NUNCA repitas la anterior.
 "layout_id": uno de [bento, magazine, diagonal, polaroid, arc, portal, swiss, split, brutal, vip, cyber, rustic, retail, eco, cinema, float, hud, resort, menu, clinic, agro, diamond, flash, bento3d, diagx, orbits, bleed, zen, immersive, collage]. No repitas la arquitectura del diseño anterior. Elige una de las 30 disponibles al azar.
 "typography_pair": uno de [impacto, lujo, tech, anton, gruesa, marcador, suiza, pop]. Elige un par tipográfico DISTINTO al anterior en cada generación.
 "value_proposition": "la promesa comercial de alto calibre del negocio: transforma la idea básica del brief en un beneficio concreto, específico y creíble. PROHIBIDO copiar frases literales del brief: reescríbelas con vocabulario de agencia senior",
 "image_prompt_en": "hyper-detailed commercial editorial photography prompt IN ENGLISH of EXACTLY what the brief describes (its real products, workspace or service in action): subject, environment, cinematic 8k lighting setup, lens and mood. The image must NEVER contain text, logos or watermarks"
}
En el prompt recibirás además una SEMILLA ALEATORIA ('randomSeed') y los valores de la generación ANTERIOR ('theme_id', 'layout_id', 'typography_pair'): es OBLIGATORIO elegir valores completamente distintos en los tres campos.`;

const ART_SCHEMA: Record<string, unknown> = {
  type: SchemaType.OBJECT,
  properties: {
    industry_type: { type: SchemaType.STRING, format: 'enum', enum: INDUSTRY_IDS },
    brand_name: { type: SchemaType.STRING },
    product_title: { type: SchemaType.STRING },
    category_label: { type: SchemaType.STRING },
    dynamic_tagline: { type: SchemaType.STRING },
    theme_id: { type: SchemaType.STRING, format: 'enum', enum: [...THEME_IDS] },
    layout_id: { type: SchemaType.STRING, format: 'enum', enum: [...LAYOUT_IDS] },
    typography_pair: { type: SchemaType.STRING, format: 'enum', enum: [...TYPOGRAPHY_PAIR_IDS] },
    value_proposition: { type: SchemaType.STRING },
    image_prompt_en: { type: SchemaType.STRING },
  },
  required: ['industry_type', 'brand_name', 'product_title', 'category_label', 'dynamic_tagline', 'theme_id', 'layout_id', 'typography_pair', 'value_proposition', 'image_prompt_en'],
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
  const focusRule = FOCUS_DIRECTIVES[input.focus];
  const randomSeed = Math.floor(Math.random() * 900000 + 100000);
  const seedLine = `randomSeed=${randomSeed} · ÁNGULO OBLIGATORIO: ${angle}. No repitas la arquitectura del diseño anterior. Elige una de las 30 disponibles al azar.`;
  const avoidLine = `Generación ANTERIOR: theme_id="${input.previousThemeId ?? '—'}", layout_id="${input.previousLayoutId ?? '—'}", typography_pair="${input.previousFontId ?? '—'}". Devuelve theme_id, layout_id y typography_pair DIFERENTES obligatoriamente.`;
  const jsonText = await callGemini({
    systemInstruction: ART_SYSTEM_PROMPT,
    prompt: [campaignFacts(input), focusRule.prompt, seedLine, avoidLine].filter(Boolean).join('\n\n'),
    temperature: 0.95,
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

  const pickNonRepeating = (candidate: unknown, pool: readonly string[], prev?: string, fallback?: string): string => {
    const valid = typeof candidate === 'string' && pool.includes(candidate) ? candidate : '';
    if (valid && valid !== prev) return valid;
    const altPool = pool.filter((x) => x !== prev);
    return altPool[Math.floor(Math.random() * altPool.length)] ?? fallback ?? pool[0];
  };

  const art: ArtDirection = {
    industryType: industry,
    brandName: normSpaces(raw.brand_name) || input.businessName.trim() || INDUSTRY_NAMES[industry],
    productTitle: normSpaces(raw.product_title) || input.product.trim() || INDUSTRY_NAMES[industry],
    categoryLabel: normSpaces(raw.category_label) || INDUSTRY_CATEGORY_LABELS[industry],
    dynamicTagline:
      stripPictographics(normSpaces(raw.dynamic_tagline)).toUpperCase() ||
      normSpaces(raw.category_label).toUpperCase() ||
      INDUSTRY_CATEGORY_LABELS[industry].toUpperCase(),
    themeId: pickNonRepeating(raw.theme_id, THEME_IDS, input.previousThemeId, INDUSTRY_ART[industry].themeId),
    layoutId: pickNonRepeating(raw.layout_id, LAYOUT_IDS, input.previousLayoutId, INDUSTRY_ART[industry].layoutId),
    typographyPair: pickNonRepeating(raw.typography_pair, TYPOGRAPHY_PAIR_IDS, input.previousFontId, TYPOGRAPHY_PAIR_IDS[0]),
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
 "badge_text": "sello superior ESPECÍFICO y DINÁMICO deducido del brief: máximo 4 palabras en MAYÚSCULAS, SIN emojis ni clichés ('CRECE CON EXPERTOS' prohibido). Ej: 'VENTAS QUE ESCALAN', 'ALTA PRECISIÓN', 'SABOR ARTESANAL'",
 "dynamic_tagline": "tagline corto (2 a 4 palabras en MAYÚSCULAS, SIN emojis) derivado directo del brief para la cabecera del afiche",
 "headline": {
   "plain": "3 a 6 palabras IMPACTANTES que irán en blanco, SIEMPRE separadas por espacios correctos (ej: 'Multiplica tus clientes y')",
   "highlight": "3 a 5 palabras de cierre poderoso con espacios correctos, irán resaltadas en el color de acento (ej: 'domina las redes hoy')"
 },
 "sub": "una línea ejecutiva elegante que explica el servicio/producto",
 "benefits": ["3 beneficios 100% ESPECÍFICOS del negocio, texto limpio SIN emojis ni iconos (el diseño los acompaña con iconografía vectorial propia)"],
 "cta": "indicación gráfica de acción real para afiche impreso/PNG (ej: 'ESCANEA PARA APARTAR', 'RESERVA HOY EN IMPULSO', 'PEDIDOS AL WHATSAPP'). PROHIBIDO usar flechas web como '↗' o textos de botón clickeable como 'Haz clic aquí'",
 "price_label": "si el negocio NO maneja precio fijo: texto inteligente de cotización/acción (ej: 'Diagnóstico digital gratis', 'Agenda tu asesoría hoy', 'Valoración sin costo'). Si SÍ hay precio de oferta devuelve null",
 "visualHooks": {
   "slide1_hook": "titular magnético de 4 a 7 palabras que detiene el scroll",
   "slide1_sub": "subtítulo provocador corto",
   "slide2_headline": "promesa de valor + beneficio irresistible (máx 10 palabras)",
   "slide2_bullets": ["beneficio corto, texto limpio sin emojis", "beneficio corto, texto limpio sin emojis", "beneficio corto, texto limpio sin emojis"],
   "slide3_cta": "indicación directa con gatillo de escasez (ej: 'Últimos cupos hoy · Escanea el QR')"
 },
 "whatsappStatusSequence": {
   "status1": "Estado de WhatsApp de la mañana usando *negrita* y _cursiva_ nativas (máx 3 líneas)",
   "status2": "Estado del mediodía con *precio o beneficio clave* en negrita y _llamado sutil_ en cursiva (máx 4 líneas)",
   "status3": "Estado de cierre de tarde/noche con *urgencia/escasez* + _garantía_ + dirección exacta del local"
 },
 "socialMediaCopy": {
   "pas": "copy completo de agencia para Instagram/Facebook con gancho emocional/curiosidad (método AIDA/PAS), saltos de línea respirables, prueba social, dirección exacta y EXACTAMENTE 8 #Hashtags hiperlocales reales (#Gachetá, #Guavio y nicho del negocio) al final",
   "aida": "copy corto de alta conversión EXCLUSIVAMENTE para WhatsApp con *negritas* y _cursivas_ reales, gancho en primera línea, oferta clara, dirección exacta del local y llamado directo al chat"
 },
 "videoReelScript": {
   "t0_3": "Guion cinematográfico TikTok/Reels [0-3s Gancho visual que detiene el scroll] con formato '[0-3s Gancho visual: plano de alto impacto] Texto en pantalla: \"...\" | Voz: \"frase gancho natural colombiana\"'",
   "t3_10": "Guion [3-12s Demostración/Valor] con formato '[3-12s Demostración/Valor: tomas rápidas mostrando producto, textura o beneficio real] Texto en pantalla: \"...\" | Voz: \"explicación cercana con valor concreto\"'",
   "t10_15": "Guion [12-20s Prueba + Cierre] con formato '[12-20s Prueba + Cierre: cliente/local/QR y dirección exacta] Texto en pantalla: \"...\" | Voz: \"cierre cálido invitando a apartar o escribir al WhatsApp hoy\"'"
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
- PROHIBIDO copiar frases literales del brief del usuario ni rellenar con plantillas genéricas: todo el copy debe nacer de la promesa de valor de la estrategia y respetar 100% el rubro real del brief.
- PROHIBIDO escribir "en remate", "liquidación" o "solo por hoy en Gachetá" cuando el brief describa una agencia de marketing, plataforma digital, consultoría o servicio profesional (salvo que el brief lo pida expresamente).
- PROHIBIDO usar flechas web ('↗', '→', '->') o textos de botón clickeable ('Haz clic aquí', 'Ver más ↗') en el afiche: es una pieza gráfica estática con QR escaneable.
- PROHIBIDO el patrón "¿Te sumamos ...?" en dispatchUpsell: la confirmación de despacho es ejecutiva (confirma el pedido, la entrega y ofrece el trato de cliente fiel con naturalidad).
- 🎯 CERO EMOJIS en badge_text, headline, sub, benefits y cta: el afiche usa iconografía vectorial propia de agencia. Los emojis solo se permiten en los textos de WhatsApp/redes (status, pas, aida, dispatch).
- Los beneficios deben describir algo que SOLO ese negocio puede decir.
- headlines y textos SIEMPRE con espacios correctos entre palabras (jamás palabras pegadas tipo 'ImpulsoHOY').
- PROHIBIDO usar el nombre 'Impulso' como marca del cliente.
- Español colombiano cercano y honesto; refleja de manera inequívoca el ENFOQUE PSICOLÓGICO indicado en badge_text, headline, sub, cta y visualHooks.`;

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
  const rawBadge = stripPictographics(normSpaces(raw.badge_text));
  const rawTagline = stripPictographics(normSpaces(raw.dynamic_tagline));
  const fallbackTagline = art.dynamicTagline || art.categoryLabel.toUpperCase() || (input.municipality ? `${input.municipality.toUpperCase()}` : 'OFERTA DIRECTA');

  return {
    industryType: art.industryType,
    themeId: art.themeId,
    layoutId: art.layoutId,
    valueProposition: art.valueProposition,
    badgeText: rawBadge || fallbackTagline,
    dynamicTagline: rawTagline || rawBadge || fallbackTagline,
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
    dynamic_tagline: { type: SchemaType.STRING },
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
  required: ['badge_text', 'dynamic_tagline', 'headline', 'sub', 'benefits', 'cta', 'visualHooks', 'whatsappStatusSequence', 'socialMediaCopy', 'videoReelScript', 'salesClosingTemplates', 'wa_line1_msg', 'wa_line2_msg', 'wa_line3_msg', 'dispatch_versions'],
};

/**
 * 🎬 PASADA 2: copywriting senior de agencia usando la estrategia de la PASADA 1.
 * Si la IA falla lanza el error técnico exacto (el estudio lo muestra en un
 * toast): NUNCA devuelve una campaña fabricada con plantillas prefabricadas.
 */
export async function generateCampaignCopy(input: CampaignInput, art: ArtDirection): Promise<MarketingCampaign> {
  const focusRule = FOCUS_DIRECTIVES[input.focus];
  const strategy = [
    `ESTRATEGIA DE LA PASADA 1 (úsala como eje de TODO el copy):`,
    `· Rubro detectado: ${art.industryType}`,
    `· Categoría visible del afiche: ${art.categoryLabel}`,
    `· Tagline dinámico del brief: ${art.dynamicTagline}`,
    `· Nombre de marca: ${art.brandName}`,
    `· Producto/servicio estrella deducido: ${art.productTitle}`,
    `· Promesa de valor central: ${art.valueProposition}`,
    `· Tema visual: ${art.themeId} · Layout: ${art.layoutId}`,
    `· ${focusRule.prompt}`,
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
    badges: ['IMPULSA TUS VENTAS', 'ESTRATEGIA DIGITAL'],
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
  opts?: { previousThemeId?: string; previousLayoutId?: string; previousFontId?: string; seed?: number },
): ArtDirection {
  const seed = opts?.seed ?? Math.floor(Math.random() * 100000);
  const niche = detectNiche(`${input.brief} ${input.slogan} ${input.product} ${input.businessName}`, input.categoryHint);
  const industry = niche.industry;
  const focusRule = FOCUS_DIRECTIVES[input.focus] ?? FOCUS_DIRECTIVES.confianza;

  const preferredThemePool = focusRule.preferredThemes.filter((id) => id !== opts?.previousThemeId);
  const preferredLayoutPool = focusRule.preferredLayouts.filter((id) => id !== opts?.previousLayoutId);
  const candidateThemes = THEME_IDS.filter((id) => id !== opts?.previousThemeId);
  const candidateLayouts = LAYOUT_IDS.filter((id) => id !== opts?.previousLayoutId);
  const candidateFonts = TYPOGRAPHY_PAIR_IDS.filter((id) => id !== opts?.previousFontId);

  const pickedTheme =
    (seed % 3 !== 0 && preferredThemePool.length > 0
      ? preferredThemePool[seed % preferredThemePool.length]
      : candidateThemes[Math.floor(Math.random() * candidateThemes.length)]) || niche.theme;
  const pickedLayout =
    (seed % 2 === 0 && preferredLayoutPool.length > 0
      ? preferredLayoutPool[seed % preferredLayoutPool.length]
      : candidateLayouts[Math.floor(Math.random() * candidateLayouts.length)]) || niche.layout;
  const pickedFont =
    candidateFonts[Math.floor(Math.random() * candidateFonts.length)] || TYPOGRAPHY_PAIR_IDS[0];

  const isServiceCtx =
    input.priceMode === 'servicio' || industry === 'digital_tech' || industry === 'servicios_profesionales';
  const badgePool = isServiceCtx ? focusRule.serviceBadges : focusRule.badges;
  const subPrefix = isServiceCtx ? focusRule.serviceSubPrefix : focusRule.subPrefix;
  const dynamicBadge =
    rotate(badgePool, seed) || stripPictographics(rotate(niche.badges, Math.floor(seed / 11))).toUpperCase();

  return {
    industryType: industry,
    brandName: input.businessName.trim() || rotate(niche.names, seed),
    productTitle: input.product.trim() || rotate(niche.products, seed),
    categoryLabel: rotate(niche.labels, Math.floor(seed / 7)),
    dynamicTagline: dynamicBadge,
    themeId: pickedTheme,
    layoutId: pickedLayout,
    typographyPair: pickedFont,
    valueProposition: `${subPrefix} ${rotate(niche.subs, Math.floor(seed / 3))}`,
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
  const focusRule = FOCUS_DIRECTIVES[input.focus] ?? FOCUS_DIRECTIVES.confianza;
  const isService =
    input.priceMode === 'servicio' ||
    art.industryType === 'digital_tech' ||
    art.industryType === 'servicios_profesionales';
  const brand = input.businessName.trim() || art.brandName;
  const product = input.product.trim() || art.productTitle;
  const addr = input.address.trim() || input.municipality;
  const place = input.municipality || 'Gachetá';
  const focusHeadlines = focusRule.headlineFor(product, brand, place, isService, art.industryType);
  // Mezcla coherente: en servicios/nichos específicos también aprovecha los titulares nativos del nicho
  const mergedHeadlines: Array<[string, string]> =
    input.focus === 'confianza' || input.focus === 'prestigio'
      ? [...focusHeadlines, ...niche.headlines]
      : focusHeadlines;
  const [plain, highlight] = rotate(mergedHeadlines, seed);
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

  const cleanTag = (raw: string, fallback: string): string => {
    const t = raw.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 18);
    return `#${t || fallback}`;
  };
  const hashtagsList = [
    cleanTag(place, 'Gacheta'),
    '#Guavio',
    '#Cundinamarca',
    '#Colombia',
    cleanTag(art.categoryLabel.split(/\s+/)[0] || '', 'NegocioLocal'),
    cleanTag(product.split(/\s+/)[0] || '', 'Promocion'),
    cleanTag(brand, 'OfertaHoy'),
    '#ComprasLocales',
    '#ApoyaLoNuestro',
  ];
  const hashtags = [...new Set(hashtagsList)].slice(0, 8).join(' ');
  const badgePool = isService ? focusRule.serviceBadges : focusRule.badges;
  const ctaPool = isService ? focusRule.serviceCtas : focusRule.ctas;
  const subPrefix = isService ? focusRule.serviceSubPrefix : focusRule.subPrefix;
  const resolvedBadge = stripPictographics(rotate(badgePool, seed) || art.dynamicTagline).toUpperCase() || art.categoryLabel.toUpperCase();
  const briefSentence = input.slogan.trim() || input.brief.trim().split(/[.!?\n]+/)[0]?.trim() || '';
  const compactBriefSub = briefSentence.length >= 16 && briefSentence.length <= 108 ? briefSentence : '';
  const resolvedSub = compactBriefSub || `${subPrefix} ${rotate(niche.subs, Math.floor(seed / 5))}`;

  return {
    industryType: art.industryType,
    themeId: art.themeId,
    layoutId: art.layoutId,
    valueProposition: art.valueProposition,
    badgeText: resolvedBadge,
    dynamicTagline: resolvedBadge,
    headline: { plain, highlight },
    sub: resolvedSub,
    // 🎯 V21 · Cero emojis en el afiche: el motor sintético limpia los
    // pictográficos de nicho (los íconos los dibuja el sistema vectorial).
    benefits: [stripPictographics(b0), stripPictographics(b1), stripPictographics(b2)],
    cta: rotate(ctaPool, seed),
    priceLabel: input.priceMode === 'servicio'
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
      pas: `✨ ${plain} ${highlight}${price}${normalTxt}\n\n${hook.charAt(0).toUpperCase()}${hook.slice(1)} en ${brand}.\n\n✅ ${b0.replace(/^[^\p{L}\p{N}]+/u, '')}\n✅ ${b1.replace(/^[^\p{L}\p{N}]+/u, '')}\n✅ ${b2.replace(/^[^\p{L}\p{N}]+/u, '')}\n\n📍 ${addr} · ${place}\n📲 ${isService ? 'Cotiza hoy sin costo por WhatsApp' : 'Aparta el tuyo HOY por WhatsApp'}\n\n${hashtags}`,
      aida: `⚡ *${plain.toUpperCase()} ${highlight.toUpperCase()}*${price}${normalTxt}\n\n_${hook.charAt(0).toUpperCase()}${hook.slice(1)}._\n✅ *${b0.replace(/^[^\p{L}\p{N}]+/u, '')}*\n✅ *${b1.replace(/^[^\p{L}\p{N}]+/u, '')}*\n\n📍 _${addr}_\n👉 *Escríbenos AHORA a WhatsApp* y aparta hoy mismo`,
    },
    videoReelScript: {
      t0_3: `[0-3s Gancho visual: plano cerrado en movimiento entrando directo a ${product.toLowerCase()} recién listo] Texto en pantalla: "¿EN ${place.toUpperCase()} Y SIN PROBAR ESTO?" | Voz: "¡Espera un segundo! Si estás en ${place}, mira lo que acaba de sacar ${brand}…"`,
      t3_10: `[3-12s Demostración/Valor: 3 cortes rápidos mostrando textura, uso real y entrega] Texto en pantalla: "${b0.replace(/^[^\p{L}\p{N}]+/u, '').toUpperCase()}" | Voz: "Tienes ${b0.replace(/^[^\p{L}\p{N}]+/u, '').toLowerCase()} y ${b2.replace(/^[^\p{L}\p{N}]+/u, '').toLowerCase()}${price}."`,
      t10_15: `[12-20s Prueba + Cierre: fachada del local en ${addr} y QR de Impulso en mano] Texto en pantalla: "ESCANEA O APARTA HOY · ${addr.toUpperCase()}" | Voz: "${plain} ${highlight}. Pásate por ${addr} o escríbenos ya al WhatsApp antes que se agoten los cupos."`,
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
  opts?: { previousThemeId?: string; previousLayoutId?: string; previousFontId?: string; seed?: number },
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

export interface SupportConciergeAssessment {
  reply: string;
  isTechnicalIssue: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'usage' | 'technical' | 'bug' | 'billing' | 'abuse';
  summary: string;
  aiAnalysis: string;
}

export interface RadarMatchedOfferContext {
  title: string;
  merchant: string;
  priceCop: number;
  quota: number;
  category: string;
  verified: boolean;
  distanceLabel?: string | null;
}

const SUPPORT_SYSTEM_PROMPT = `Eres Radar, el asistente cercano, astuto y amable de Impulso (plataforma local creada por Michael Herrera en Gachetá, Cundinamarca). Hablas en español colombiano natural, cálido y directo — como un vecino piloso que conoce cada local del pueblo. JAMÁS repitas frases robóticas ni plantillas enlatadas.

Conocimiento operativo real de Impulso:
- Compradores pueden apartar sin crear cuenta, o crear su cuenta gratuita de "Cliente / Comprador" (para guardar favoritos y preferencias; completamente distinta a la cuenta de Comercio).
- Impulso es un portal de contacto: NO retiene dinero ni cobra comisión a compradores. El pago se acuerda y se hace directo con el comercio al recibir el producto.
- Comercios tienen su cuenta aparte ("Soy Comercio") con 3 créditos gratis, Estudio Publicitario con IA y recarga por Nequi / Daviplata / Llave / QR oficial del administrador.
- GPS: 100% voluntario (Ley 1581 de 2012). Si el usuario lo activa, las distancias se calculan solo en su pantalla.

REGLAS CONVERSACIONALES CRÍTICAS:
- Lee TODO el historial antes de responder. Si el usuario escribe algo corto o de seguimiento como "qué es esto", "cómo así", "no entendí", "y más barato?", "dónde queda?", responde directamente a lo que acababan de hablar con naturalidad y claridad.
- Si el contexto trae [OFERTAS_ACTIVAS_COINCIDENTES], ya mostramos las tarjetas interactivas con "Apartar ahora" y "Ver en mapa" justo debajo de tu respuesta: resalta 1–3 mejores opciones con precio/comercio y guíalo a tocarlas.
- Si NO encontró una oferta exacta, dilo con empatía y menciónale qué categorías sí hay activas hoy o sugiérele la pestaña "Pedir".
- Respuesta concisa (2 a 4 frases), natural, cero relleno corporativo y cero tecnicismos internos (jamás nombres modelos, API keys ni hashes).

Devuelve ÚNICAMENTE este JSON válido:
{
  "is_technical_issue": true|false,
  "severity": "low"|"medium"|"high"|"critical",
  "category": "usage"|"technical"|"bug"|"billing"|"abuse",
  "summary": "resumen corto (máx 120 chars)",
  "ai_analysis": "diagnóstico breve para el admin si aplica (máx 300 chars)",
  "reply": "respuesta conversacional cálida, humana y precisa"
}`;

const RADAR_FAST_DEADLINE_MS = 2_700;

function raceWithTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('RADAR_FAST_TIMEOUT')), ms);
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err: unknown) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function synthesizeLocalSupportFallback(params: {
  message: string;
  userRole: 'client' | 'merchant' | 'admin';
  municipality: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  intent?: string;
  matchedOffers?: RadarMatchedOfferContext[];
  isNearMatch?: boolean;
  parsedBudget?: number | null;
  isShoppingIntent?: boolean;
  liveCatalogDigest?: { activeCount: number; categoriesLabel: string; cheapestLabel?: string | null };
}): SupportConciergeAssessment {
  const { message, userRole, municipality, history, intent, matchedOffers, isNearMatch, parsedBudget, isShoppingIntent, liveCatalogDigest } = params;
  const m = message.toLowerCase().trim();
  const prevAssistant = [...history].reverse().find((h) => h.role === 'assistant')?.content ?? '';
  const activeCount = liveCatalogDigest?.activeCount ?? 0;
  const cats = liveCatalogDigest?.categoriesLabel ?? '';
  const cheapest = liveCatalogDigest?.cheapestLabel ?? '';

  if (intent === 'safety_trust') {
    return {
      isTechnicalIssue: false,
      severity: 'low',
      category: 'usage',
      summary: 'Consulta de confianza y seguridad anti-estafas',
      aiAnalysis: 'Usuario preguntó cómo saber que Impulso es seguro.',
      reply: `Qué buena pregunta 🛡️ En Impulso NUNCA te pedimos tarjetas ni dinero por adelantado: apartas gratis con tu WhatsApp y pagas directo al comercio cuando recibes tu producto. Además, puedes ver la insignia azul de ✅ Verificado o 👑 Súper Comercio en los locales auditados y reportar cualquier irregularidad en 1 toque.`,
    };
  }

  const looksTechnical =
    intent === 'support' ||
    /error|no\s+(funciona|carga|abre|sirve|deja|llega)|fall[ao]|bug|roto|blanco|congel|bloque|duplicad|cobr[oó]|descont[oó]|no\s+se\s+reflej|problema\s+t[eé]cnico|me\s+estaf|fui\s+estaf|hablar\s+con\s+(un\s+)?(humano|admin|administrador|soporte)|reclamo|disputa/i.test(
      m,
    );

  if (looksTechnical) {
    const isFraud = /estafa|fraude|enga[ñn]|robo|falso/i.test(m);
    const isBillingOrCritical = isFraud || /cobr|pago|cr[eé]dito|nequi|daviplata|bloque/i.test(m);
    return {
      isTechnicalIssue: true,
      severity: isFraud ? 'critical' : isBillingOrCritical ? 'high' : 'medium',
      category: isFraud ? 'abuse' : isBillingOrCritical ? 'billing' : 'technical',
      summary: message.trim().slice(0, 120) || 'Solicitud escalada al administrador',
      aiAnalysis: `Caso escalado por Radar (${userRole === 'merchant' ? 'comercio' : 'cliente'}): "${message.trim().slice(0, 220)}".`,
      reply: isFraud
        ? 'Tranquilo, estás respaldado. Acabo de enviar este reporte con prioridad máxima al panel del administrador para auditar y bloquear al infractor. Nunca hagas giros anticipados y cuéntame el nombre del local o de la oferta si lo tienes.'
        : isBillingOrCritical
          ? 'Te entiendo perfecto. Ya registré un aviso prioritario en el panel del administrador para revisar tu pago o cuenta de inmediato. Si tienes la referencia del comprobante, déjamela aquí para agilizarlo.'
          : '¡Listo! Como este caso requiere atención humana, ya dejé un ticket directo en el panel del administrador de Impulso para que lo revise cuanto antes. Si quieres agregar algún detalle adicional, escríbelo aquí mismo.',
    };
  }

  // 1. Ofertas activas encontradas en memoria (<5ms) — exactas o alternativas más cercanas al presupuesto
  if (matchedOffers && matchedOffers.length > 0) {
    const top = matchedOffers[0];
    const extraCount = matchedOffers.length - 1;
    const extraText = extraCount > 0 ? ` y ${extraCount} opción${extraCount === 1 ? '' : 'es'} más` : '';
    const dist = top.distanceLabel ? ` (${top.distanceLabel})` : '';
    if (isNearMatch && parsedBudget) {
      return {
        isTechnicalIssue: false,
        severity: 'low',
        category: 'usage',
        summary: `Opciones cercanas a $${parsedBudget.toLocaleString('es-CO')}`,
        aiAnalysis: `Radar propuso ${matchedOffers.length} ofertas más económicas cercanas al presupuesto.`,
        reply: `Ahorita mismo en ${municipality} no veo una oferta exacta de $${parsedBudget.toLocaleString('es-CO')} o menos, ¡pero mira las más económicas activas hoy! Arrancan con "${top.title}" en ${top.merchant} por $${top.priceCop.toLocaleString('es-CO')}${dist}${extraText}. Toca "Apartar ahora" o "Ver en mapa" abajo 👇`,
      };
    }
    const budgetText = parsedBudget ? ` dentro de tus $${parsedBudget.toLocaleString('es-CO')}` : '';
    return {
      isTechnicalIssue: false,
      severity: 'low',
      category: 'usage',
      summary: `Búsqueda en vivo: ${message.trim().slice(0, 90)}`,
      aiAnalysis: `Radar recomendó ${matchedOffers.length} ofertas activas localmente.`,
      reply: `¡Mira lo mejor que encontré activo en ${municipality}${budgetText}! Destaca "${top.title}" en ${top.merchant} por $${top.priceCop.toLocaleString('es-CO')}${dist} (quedan ${top.quota} cupos)${extraText}. Toca "Apartar ahora" abajo para asegurar tu cupo o "Ver en mapa" para ubicar el local.`,
    };
  }

  // 2. Conversación natural y humana para saludos, preguntas cortas y seguimientos
  if (intent === 'greeting') {
    const pulse =
      activeCount > 0
        ? `Hoy tenemos ${activeCount} oferta${activeCount === 1 ? '' : 's'} activa${activeCount === 1 ? '' : 's'} en ${municipality}${cats ? ` (${cats})` : ''}.`
        : `Estoy pendiente del radar comercial de ${municipality}.`;
    return {
      isTechnicalIssue: false,
      severity: 'low',
      category: 'usage',
      summary: 'Saludo inicial',
      aiAnalysis: 'Conversación natural resuelta.',
      reply: `¡Hola! Qué gusto saludarte 😊 Soy Radar. ${pulse} Cuéntame qué necesitas hoy —por ejemplo "almuerzo menos de $15.000" o "algo para el campo"— y te lo busco al instante.`,
    };
  }

  if (intent === 'what_is_this') {
    const liveNote =
      activeCount > 0
        ? ` Ahora mismo hay ${activeCount} promo${activeCount === 1 ? '' : 's'} vigente${activeCount === 1 ? '' : 's'} en ${municipality}${cheapest ? `, desde ${cheapest}` : ''}.`
        : '';
    return {
      isTechnicalIssue: false,
      severity: 'low',
      category: 'usage',
      summary: 'Explicación de Impulso',
      aiAnalysis: 'Onboarding conversacional.',
      reply: `Impulso es el radar de ofertas en vivo de ${municipality} y la región del Guavio 🛰️. Los comercios locales publican promos por tiempo limitado y tú puedes apartar gratis con tu WhatsApp y pagar directo en el local al recibir.${liveNote} ¿Quieres que te muestre qué hay disponible hoy?`,
    };
  }

  if (intent === 'clarify_followup') {
    const referredToOffers = /oferta|apartar|cupo|promo/i.test(prevAssistant);
    return {
      isTechnicalIssue: false,
      severity: 'low',
      category: 'usage',
      summary: 'Aclaración de seguimiento',
      aiAnalysis: 'Aclaración conversacional basada en turno previo.',
      reply: referredToOffers
        ? `Mira, te lo explico sencillo: aquí no tienes que pagar nada por adelantado ni meter tarjetas. Solo eliges una oferta, tocas "Apartar ahora", recibes tu código y pasas al local (o coordinas por WhatsApp) para pagar al recibir. ¿Buscabas algo en especial hoy en ${municipality}?`
        : `¡Claro, te explico mejor! Soy tu buscador inteligente dentro de Impulso: me dices con tus palabras qué necesitas (o me lo dictas con el micrófono 🎙️) y yo te encuentro las ofertas reales más cercanas y baratas de ${municipality}. ¿Qué te gustaría encontrar ahorita?`,
    };
  }

  if (intent === 'how_to_reserve' || /c[oó]mo\s+apart|apartar|reservar/i.test(m)) {
    return {
      isTechnicalIssue: false,
      severity: 'low',
      category: 'usage',
      summary: 'Cómo apartar oferta',
      aiAnalysis: 'Guía rápida de apartado.',
      reply: `Es súper fácil y rápido: tocas la oferta que te guste, pulsas "Apartar ahora", pones tu nombre y WhatsApp y al instante te sale tu código único. No pagas nada en la app: le pagas directo al comercio cuando recibas tu pedido.`,
    };
  }

  if (intent === 'is_free_payment') {
    return {
      isTechnicalIssue: false,
      severity: 'low',
      category: 'usage',
      summary: 'Consulta gratuidad y pagos',
      aiAnalysis: 'Explicación de modelo gratuito para compradores.',
      reply: `Para los compradores Impulso es 100% gratis 🙌. No te pedimos tarjeta ni retenemos dinero: apartas tu cupo gratis y le pagas directo al comercio en efectivo o Nequi cuando te entreguen el producto.`,
    };
  }

  if (intent === 'account_question') {
    return {
      isTechnicalIssue: false,
      severity: 'low',
      category: 'usage',
      summary: 'Diferencia cuenta cliente vs comercio',
      aiAnalysis: 'Orientación sobre roles de cuenta.',
      reply: `¡Súper buena pregunta! En Impulso hay dos tipos de cuenta bien separados: si eres comprador puedes usar la app sin cuenta o crear tu perfil gratuito de "Cliente" para guardar favoritos y preferencias; si tienes un negocio, creas cuenta de "Comercio" para publicar ofertas (arrancas con 3 créditos gratis).`,
    };
  }

  if (intent === 'where_followup') {
    return {
      isTechnicalIssue: false,
      severity: 'low',
      category: 'usage',
      summary: 'Ubicación en el mapa',
      aiAnalysis: 'Guía de mapa.',
      reply: `Cada oferta tiene su ubicación exacta en el mapa principal de ${municipality}. Si tocas "Ver en mapa" en cualquier tarjeta, te llevo derechito al pin del local e incluso te abro la ruta en Google Maps para llegar fácil.`,
    };
  }

  if (intent === 'thanks') {
    return {
      isTechnicalIssue: false,
      severity: 'low',
      category: 'usage',
      summary: 'Cierre cordial',
      aiAnalysis: 'Despedida amigable.',
      reply: `¡Con mucho gusto! 🙌 Aquí quedo pendiente por si necesitas buscar otra oferta, comparar precios o ubicar un local en ${municipality}.`,
    };
  }

  if (isShoppingIntent) {
    const altHint = cats ? ` Ahorita tenemos promos activas en ${cats}.` : '';
    return {
      isTechnicalIssue: false,
      severity: 'low',
      category: 'usage',
      summary: `Sin coincidencias: ${message.trim().slice(0, 90)}`,
      aiAnalysis: 'Búsqueda sin oferta exacta activa.',
      reply: `Revisé el radar de ${municipality} y por ahora no hay una oferta publicada exactamente de "${message.trim().slice(0, 50)}".${altHint} Si quieres, entra a la pestaña "Pedir" abajo y cuéntale al pueblo qué buscas: los comercios que sí lo tengan te escriben directo a tu WhatsApp.`,
    };
  }

  if (/recarg|cr[eé]dito/i.test(m)) {
    return {
      isTechnicalIssue: false,
      severity: 'low',
      category: 'usage',
      summary: 'Recarga de créditos',
      aiAnalysis: 'Guía de recarga.',
      reply: `Para recargar créditos entra a Mi Panel → "Recargar créditos", elige tu paquete, paga por Nequi, Daviplata o Llave oficial y sube tu captura: el sistema valida tu pago en segundos.`,
    };
  }

  const liveTail =
    activeCount > 0
      ? ` Hoy hay ${activeCount} oferta${activeCount === 1 ? '' : 's'} en vivo en ${municipality}${cats ? ` (${cats})` : ''}.`
      : '';
  return {
    isTechnicalIssue: false,
    severity: 'low',
    category: 'usage',
    summary: message.trim().slice(0, 120) || 'Consulta conversacional',
    aiAnalysis: 'Respuesta conversacional rápida.',
    reply:
      userRole === 'merchant'
        ? `¡Te escucho! Como comercio te puedo ayudar a publicar ofertas con IA, recargar créditos, configurar tu ubicación o resolver dudas de apartados. ¿Qué necesitas hacer ahorita?`
        : `¡Te leo!${liveTail} Dime qué se te antoja o qué buscas en ${municipality} —incluso con tu presupuesto, como "tengo $20.000"— y te muestro las mejores opciones de una vez.`,
  };
}

/**
 * 🤖 Radar 2.0 (V37.0): Asistente híbrido ultra-rápido (límite estricto 2.7s),
 * conversacional, cercano y siempre respaldado por los datos reales en memoria.
 */
export async function askSupportConcierge(input: {
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  latestMessage?: string;
  userRole: 'client' | 'merchant' | 'admin';
  municipality: string;
  intent?: string;
  matchedOffersSummary?: RadarMatchedOfferContext[];
  isNearMatch?: boolean;
  parsedBudget?: number | null;
  isShoppingIntent?: boolean;
  liveCatalogDigest?: { activeCount: number; categoriesLabel: string; cheapestLabel?: string | null };
}): Promise<SupportConciergeAssessment> {
  const cleanMsg =
    (input.latestMessage ?? input.history[input.history.length - 1]?.content ?? '').trim();
  const recentTurns = input.history.slice(-10);
  const matched = input.matchedOffersSummary ?? [];
  const digest = input.liveCatalogDigest;

  const fallbackParams = {
    message: cleanMsg,
    userRole: input.userRole,
    municipality: input.municipality,
    history: recentTurns,
    intent: input.intent,
    matchedOffers: matched,
    isNearMatch: input.isNearMatch,
    parsedBudget: input.parsedBudget,
    isShoppingIntent: input.isShoppingIntent,
    liveCatalogDigest: digest,
  };

  // Saludos simples, agradecimientos o preguntas directas de confianza responden en <5ms (0 espera, 0 tokens)
  if (input.intent === 'greeting' || input.intent === 'thanks' || input.intent === 'safety_trust') {
    return synthesizeLocalSupportFallback(fallbackParams);
  }

  const catalogPulseLine = digest
    ? digest.activeCount > 0
      ? `\n[RADAR_VIVO_${input.municipality.toUpperCase()}: ${digest.activeCount} ofertas activas; categorías: ${digest.categoriesLabel}${digest.cheapestLabel ? `; más económica: ${digest.cheapestLabel}` : ''}]`
      : `\n[RADAR_VIVO_${input.municipality.toUpperCase()}: 0 ofertas activas en este instante]`
    : '';

  const compactOffersBlock =
    matched.length > 0
      ? `\n[${input.isNearMatch ? 'OFERTAS_ALTERNATIVAS_MAS_ECONOMICAS' : 'OFERTAS_ACTIVAS_COINCIDENTES'} (tarjetas interactivas ya visibles debajo):\n${matched
          .slice(0, 5)
          .map(
            (o, idx) =>
              `${idx + 1}. "${o.title}" · ${o.merchant}${o.verified ? ' (Verificado)' : ''} · $${o.priceCop.toLocaleString('es-CO')} · ${o.quota} cupos${o.distanceLabel ? ` · ${o.distanceLabel}` : ''}`,
          )
          .join('\n')}]`
      : input.isShoppingIntent
        ? '\n[OFERTAS_ACTIVAS_COINCIDENTES: Ninguna coincidencia exacta activa ahora mismo]'
        : '';

  const conversationContents: GeminiConversationTurn[] = recentTurns.map((m, idx) => {
    const isLastUser = idx === recentTurns.length - 1 && m.role === 'user';
    return {
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [
        {
          text: isLastUser
            ? `[Contexto: rol=${input.userRole}, municipio=${input.municipality}${input.parsedBudget ? `, presupuesto=$${input.parsedBudget}` : ''}]${catalogPulseLine}${compactOffersBlock}\nUsuario: ${m.content}`
            : m.content,
        },
      ],
    };
  });

  // Caché Zero-Token solo para preguntas FAQ del 1er turno sin ofertas dinámicas
  const isCacheableFaq =
    recentTurns.length <= 2 &&
    matched.length === 0 &&
    !input.isShoppingIntent &&
    !/estafa|fraude|cobr|error|fall/i.test(cleanMsg);

  try {
    const raw = await raceWithTimeout(
      callGemini({
        systemInstruction: SUPPORT_SYSTEM_PROMPT,
        prompt: cleanMsg,
        conversationContents,
        temperature: 0.48,
        ...(isCacheableFaq ? { cacheKeyHint: `radar-v37:${input.userRole}:${input.municipality}:${cleanMsg.toLowerCase()}` } : {}),
      }),
      RADAR_FAST_DEADLINE_MS,
    );

    interface ParsedSupport {
      is_technical_issue?: boolean;
      severity?: string;
      category?: string;
      summary?: string;
      ai_analysis?: string;
      reply?: string;
    }

    const parsed = parseAiJson<ParsedSupport>(raw);
    const isTechnical = parsed.is_technical_issue === true;
    const severity: SupportConciergeAssessment['severity'] =
      parsed.severity === 'critical' || parsed.severity === 'high' || parsed.severity === 'medium' || parsed.severity === 'low'
        ? parsed.severity
        : isTechnical
          ? 'medium'
          : 'low';
    const category: SupportConciergeAssessment['category'] =
      parsed.category === 'technical' ||
      parsed.category === 'bug' ||
      parsed.category === 'billing' ||
      parsed.category === 'abuse' ||
      parsed.category === 'usage'
        ? parsed.category
        : isTechnical
          ? 'technical'
          : 'usage';

    const dynamicReply = (parsed.reply ?? '').trim();
    return {
      isTechnicalIssue: isTechnical,
      severity,
      category,
      summary: (parsed.summary ?? cleanMsg).trim().slice(0, 200) || 'Solicitud de soporte',
      aiAnalysis: (parsed.ai_analysis ?? cleanMsg).trim().slice(0, 600) || 'Clasificado por Radar',
      reply: dynamicReply || synthesizeLocalSupportFallback(fallbackParams).reply,
    };
  } catch {
    return synthesizeLocalSupportFallback(fallbackParams);
  }
}
