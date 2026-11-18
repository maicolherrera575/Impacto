import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * 🚀 V36.0 · Motor IA Ultra-Rápido (<2s), Autodescubrimiento, Circuit Breaker,
 * Caché Zero-Token y Rate Limiting Enterprise (Serverless Vercel).
 *
 * - Soporta 4+ llaves en pool (`GEMINI_API_KEY_1..5`, `GEMINI_API_KEY`, `GEMINI_API_KEYS`).
 * - Autodescubre modelos activos vía `/v1beta/models` (TTL 60 min) priorizando la familia
 *   Flash más reciente que soporte `generateContent` (jamás queda atascado en modelos 404).
 * - AbortController estricto: 5.5s para chat/ofertas/marketing, 12s para visión/comprobantes.
 * - Circuit Breaker: 404 bloquea `(key, model)` permanentemente en la instancia; 429 pone
 *   cooldown de 120s y rota en <50ms a la siguiente llave sana.
 * - Caché LRU en memoria (Zero-Token Reuse) para preguntas frecuentes y prompts repetidos.
 * - Rate Limiter por ventana deslizante (IP + Device Fingerprint) contra ataques DDoS/drenaje.
 */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_BODY_BYTES = 2_500_000;
const DISCOVERY_TTL_MS = 60 * 60 * 1000; // 60 minutos
const RATE_LIMIT_COOLDOWN_MS = 120_000; // 120 segundos en 429
const AUTH_ERROR_COOLDOWN_MS = 600_000; // 10 minutos en 401/403
const TEXT_ATTEMPT_TIMEOUT_MS = 5_500;
const VISION_ATTEMPT_TIMEOUT_MS = 12_000;
const TOTAL_TEXT_BUDGET_MS = 14_500;
const TOTAL_VISION_BUDGET_MS = 23_000;

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 min caché de respuestas repetidas
const CACHE_MAX_ENTRIES = 300;

const RL_WINDOW_MS = 60_000;
const RL_MAX_REQUESTS = 35;

const FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.5-pro',
] as const;

const FORBIDDEN_MODEL_RE = /embedding|aqa|imagen|veo|tts|audio|live|bison|gecko|legacy|1\.0|1\.5/i;

type VercelRes = ServerResponse & {
  status?: (code: number) => VercelRes;
  json?: (body: unknown) => void;
};

interface PayloadPart {
  text?: unknown;
  inlineData?: { mimeType?: unknown; data?: unknown };
}

interface GeminiPayload {
  contents?: { role?: unknown; parts?: PayloadPart[] }[];
  generationConfig?: Record<string, unknown>;
  systemInstruction?: unknown;
}

// ── Estado en memoria de la instancia serverless (caliente en Vercel) ────────
let activeServerKeyIndex = 0;
let discoveredModels: string[] = [];
let discoveredAt = 0;

/** Combos (keyIdx:model) marcados permanentemente como 404 / no soportados. */
const deadCombos = new Set<string>();
/** Modelos que devolvieron 404 en el servidor: se saltan al instante. */
const deadModels = new Set<string>();
/** Combos (keyIdx:model) o llaves (key:idx) en cooldown temporal tras 429 / 403. */
const cooldownUntil = new Map<string, number>();
/** Caché LRU de respuestas JSON exitosas de Gemini (Zero-Token Reuse). */
const responseCache = new Map<string, { at: number; body: unknown }>();
/** Rate limiter de ventana deslizante por IP + huella de dispositivo. */
const rateWindows = new Map<string, number[]>();

function sendJson(res: VercelRes, statusCode: number, body: unknown, extraHeaders?: Record<string, string>): void {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (extraHeaders) {
    for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v);
  }
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    const next = res.status(statusCode);
    if (typeof next.json === 'function') {
      next.json(body);
      return;
    }
  }
  res.statusCode = statusCode;
  res.end(JSON.stringify(body));
}

function firstHeader(headers: IncomingMessage['headers'], name: string): string {
  const v = headers[name.toLowerCase()];
  if (Array.isArray(v)) return v[0] ?? '';
  return typeof v === 'string' ? v : '';
}

function getClientIdentity(req: IncomingMessage): string {
  const xff = firstHeader(req.headers, 'x-forwarded-for').split(',')[0]?.trim();
  const ip = xff || firstHeader(req.headers, 'x-real-ip') || req.socket?.remoteAddress || 'unknown';
  const fp = firstHeader(req.headers, 'x-device-fingerprint').trim().slice(0, 48);
  return fp ? `${ip}:${fp}` : ip;
}

function checkRateLimit(identity: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const prev = rateWindows.get(identity) ?? [];
  const fresh = prev.filter((ts) => now - ts < RL_WINDOW_MS);
  if (fresh.length >= RL_MAX_REQUESTS) {
    const oldest = fresh[0] ?? now;
    const retryAfterSec = Math.max(1, Math.ceil((RL_WINDOW_MS - (now - oldest)) / 1000));
    rateWindows.set(identity, fresh);
    return { allowed: false, retryAfterSec };
  }
  fresh.push(now);
  rateWindows.set(identity, fresh);
  // Poda ligera para evitar crecimiento infinito en instancias muy longevas
  if (rateWindows.size > 1500) {
    for (const [k, list] of rateWindows) {
      if (list.length === 0 || now - list[list.length - 1] > RL_WINDOW_MS) rateWindows.delete(k);
    }
  }
  return { allowed: true, retryAfterSec: 0 };
}

function getServerGeminiKeyPool(): string[] {
  const csvKeys = [process.env.GEMINI_API_KEYS, process.env.VITE_GEMINI_API_KEYS]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .flatMap((v) => v.split(/[\s,;]+/));

  return Array.from(
    new Set(
      [
        process.env.GEMINI_API_KEY_1,
        process.env.GEMINI_API_KEY_2,
        process.env.GEMINI_API_KEY_3,
        process.env.GEMINI_API_KEY_4,
        process.env.GEMINI_API_KEY_5,
        process.env.GEMINI_API_KEY,
        ...csvKeys,
        process.env.VITE_GEMINI_API_KEY_1,
        process.env.VITE_GEMINI_API_KEY_2,
        process.env.VITE_GEMINI_API_KEY_3,
        process.env.VITE_GEMINI_API_KEY_4,
        process.env.VITE_GEMINI_API_KEY,
      ]
        .map((k) => (k ?? '').trim())
        .filter((k) => k.length >= 16),
    ),
  );
}

/** Puntúa modelos de Google AI Studio priorizando la familia Flash más reciente y rápida. */
function scoreModelName(name: string, preferVision: boolean): number {
  const lower = name.toLowerCase();
  if (!lower.startsWith('gemini-') || FORBIDDEN_MODEL_RE.test(lower)) return -1;
  if (/thinking|exp-\d{4}|preview-tts|computer-use|robotics|deep-research/i.test(lower)) return -1;

  const verMatch = /gemini-(\d+)(?:\.(\d+))?/i.exec(lower);
  const major = verMatch ? Number(verMatch[1]) : 0;
  const minor = verMatch && verMatch[2] ? Number(verMatch[2]) : 0;
  const versionScore = major * 100 + minor * 10;

  let familyBonus = 0;
  if (lower.includes('flash-lite')) familyBonus = preferVision ? 55 : 75;
  else if (lower.includes('flash')) familyBonus = 95;
  else if (lower.includes('pro')) familyBonus = preferVision ? 45 : 35;

  // Preferir versiones estables sobre preview/exp cuando empatan
  const stabilityBonus = /preview|exp/i.test(lower) ? -8 : 12;
  return versionScore + familyBonus + stabilityBonus;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Autodescubre modelos disponibles en la cuenta (caché 60 min) ordenados por velocidad y generación. */
async function discoverAvailableModels(keyPool: string[], preferVision: boolean): Promise<string[]> {
  const now = Date.now();
  if (discoveredModels.length > 0 && now - discoveredAt < DISCOVERY_TTL_MS) {
    return discoveredModels.filter((m) => !deadModels.has(m));
  }

  for (let i = 0; i < Math.min(keyPool.length, 2); i += 1) {
    const key = keyPool[(activeServerKeyIndex + i) % keyPool.length];
    try {
      const res = await fetchWithTimeout(
        `${GEMINI_BASE}?key=${encodeURIComponent(key)}&pageSize=100`,
        { method: 'GET', headers: { Accept: 'application/json' } },
        3_200,
      );
      if (!res.ok) continue;
      const json = (await res.json().catch(() => null)) as {
        models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
      } | null;
      const rawModels = Array.isArray(json?.models) ? json.models : [];
      const ranked = rawModels
        .filter((m) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
        .map((m) => String(m.name ?? '').replace(/^models\//, '').trim())
        .filter((name) => scoreModelName(name, preferVision) > 0 && !deadModels.has(name))
        .sort((a, b) => scoreModelName(b, preferVision) - scoreModelName(a, preferVision));

      const unique = Array.from(new Set(ranked)).slice(0, 6);
      if (unique.length > 0) {
        discoveredModels = unique;
        discoveredAt = now;
        return unique;
      }
    } catch {
      /* falla silenciosa: intenta siguiente llave o usa semilla estable */
    }
  }

  return FALLBACK_MODELS.filter((m) => !deadModels.has(m));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    let data = '';
    req.on('data', (chunk: Buffer | string) => {
      const s = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
      size += Buffer.byteLength(s, 'utf8');
      if (size > MAX_BODY_BYTES) {
        reject(new Error('PAYLOAD_TOO_LARGE'));
        return;
      }
      data += s;
    });
    req.on('end', () => resolve(data));
    req.on('error', (err) => reject(err));
  });
}

function validPayload(raw: unknown): GeminiPayload | null {
  if (raw == null || typeof raw !== 'object') return null;
  const p = raw as GeminiPayload;
  if (!Array.isArray(p.contents) || p.contents.length === 0) return null;
  for (const content of p.contents) {
    if (!Array.isArray(content.parts) || content.parts.length === 0) return null;
    for (const part of content.parts) {
      const hasText = typeof part.text === 'string';
      const hasImage =
        part.inlineData != null &&
        typeof part.inlineData === 'object' &&
        typeof part.inlineData.mimeType === 'string' &&
        typeof part.inlineData.data === 'string';
      if (!hasText && !hasImage) return null;
    }
  }
  return p;
}

function hasInlineImage(payload: GeminiPayload): boolean {
  return Boolean(
    payload.contents?.some((c) => c.parts?.some((part) => part.inlineData != null)),
  );
}

function isQuotaError(status: number, json: unknown): boolean {
  if (status === 429) return true;
  const errObj = (json as { error?: { status?: string; message?: string; code?: number } } | null)?.error;
  const msg = `${errObj?.status ?? ''} ${errObj?.message ?? ''}`;
  return /\b429\b|RESOURCE_EXHAUSTED|Too Many Requests|rate[_\s-]*limit|quota|exceeded/i.test(msg);
}

function isModelUnavailableError(status: number, json: unknown): boolean {
  if (status === 404) return true;
  const errObj = (json as { error?: { status?: string; message?: string } } | null)?.error;
  const msg = `${errObj?.status ?? ''} ${errObj?.message ?? ''}`;
  return /NOT_FOUND|is not found for API version|not supported for generateContent|deprecated/i.test(msg);
}

function getCacheKey(payload: GeminiPayload): string | null {
  // No cacheamos payloads con imágenes grandes ni prompts de alta temperatura creativa (>0.75)
  if (hasInlineImage(payload)) return null;
  const temp = Number(payload.generationConfig?.temperature ?? 0.5);
  if (Number.isFinite(temp) && temp > 0.72) return null;
  const serialized = JSON.stringify({
    s: payload.systemInstruction ?? null,
    c: payload.contents,
    g: payload.generationConfig ?? null,
  });
  if (serialized.length > 16_000) return null;
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

function readCache(key: string): unknown | null {
  const hit = responseCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    responseCache.delete(key);
    return null;
  }
  // LRU bump
  responseCache.delete(key);
  responseCache.set(key, hit);
  return hit.body;
}

function writeCache(key: string, body: unknown): void {
  if (responseCache.size >= CACHE_MAX_ENTRIES) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey) responseCache.delete(oldestKey);
  }
  responseCache.set(key, { at: Date.now(), body });
}

function isComboOnCooldown(keyIdx: number, model: string, now: number): boolean {
  const keyUntil = cooldownUntil.get(`key:${keyIdx}`) ?? 0;
  if (now < keyUntil) return true;
  const comboUntil = cooldownUntil.get(`${keyIdx}:${model}`) ?? 0;
  return now < comboUntil;
}

export default async function handler(req: IncomingMessage, res: VercelRes): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: { message: 'Método no permitido' } });
    return;
  }

  // 🛡️ Rate Limiting por ventana deslizante (IP + Fingerprint)
  const rl = checkRateLimit(getClientIdentity(req));
  if (!rl.allowed) {
    sendJson(
      res,
      429,
      { error: { message: 'Demasiadas consultas seguidas. Espera unos segundos e intenta de nuevo.' } },
      { 'Retry-After': String(rl.retryAfterSec) },
    );
    return;
  }

  const keyPool = getServerGeminiKeyPool();
  if (keyPool.length === 0) {
    sendJson(res, 500, {
      error: { message: 'El servidor no tiene configurada la llave de IA. Configura GEMINI_API_KEY_1..4 en Vercel.' },
    });
    return;
  }

  let rawBody = '';
  try {
    rawBody = await readBody(req);
  } catch (err) {
    if (err instanceof Error && err.message === 'PAYLOAD_TOO_LARGE') {
      sendJson(res, 413, { error: { message: 'El archivo es demasiado grande. Intenta con una captura más liviana.' } });
    } else {
      sendJson(res, 400, { error: { message: 'No se pudo leer la petición' } });
    }
    return;
  }

  let parsed: { model?: unknown; mode?: unknown; payload?: unknown };
  try {
    parsed = JSON.parse(rawBody) as { model?: unknown; mode?: unknown; payload?: unknown };
  } catch {
    sendJson(res, 400, { error: { message: 'Petición inválida' } });
    return;
  }

  const payload = validPayload(parsed.payload);
  if (!payload) {
    sendJson(res, 400, { error: { message: 'El contenido de la petición de IA no es válido' } });
    return;
  }

  // ⚡ Caché Zero-Token en servidor
  const cacheKey = getCacheKey(payload);
  if (cacheKey) {
    const cached = readCache(cacheKey);
    if (cached) {
      sendJson(res, 200, cached, { 'X-Impulso-AI-Cache': 'HIT' });
      return;
    }
  }

  const isVision = parsed.mode === 'vision' || hasInlineImage(payload);
  const perAttemptTimeoutMs = isVision ? VISION_ATTEMPT_TIMEOUT_MS : TEXT_ATTEMPT_TIMEOUT_MS;
  const totalBudgetMs = isVision ? TOTAL_VISION_BUDGET_MS : TOTAL_TEXT_BUDGET_MS;
  const deadline = Date.now() + totalBudgetMs;

  // Lista blanca + Autodescubrimiento de modelos
  const requestedModel = typeof parsed.model === 'string' ? parsed.model.trim() : 'auto';
  const discovered = await discoverAvailableModels(keyPool, isVision);
  const modelQueue: string[] = [];

  if (
    requestedModel &&
    requestedModel !== 'auto' &&
    /^gemini-[\w.-]{3,40}$/i.test(requestedModel) &&
    !FORBIDDEN_MODEL_RE.test(requestedModel) &&
    !deadModels.has(requestedModel)
  ) {
    modelQueue.push(requestedModel);
  }
  for (const m of discovered) {
    if (!modelQueue.includes(m)) modelQueue.push(m);
  }
  for (const m of FALLBACK_MODELS) {
    if (!deadModels.has(m) && !modelQueue.includes(m)) modelQueue.push(m);
  }

  let lastStatus = 503;
  let lastJson: unknown = {
    error: { message: 'El motor de IA está momentáneamente saturado. Intenta en unos segundos.' },
  };

  for (const model of modelQueue.slice(0, 4)) {
    if (Date.now() >= deadline) break;
    if (deadModels.has(model)) continue;

    let all404ForModel = true;
    let triedAnyKey = false;

    for (let attempt = 0; attempt < keyPool.length; attempt += 1) {
      if (Date.now() >= deadline) break;
      const keyIdx = (activeServerKeyIndex + attempt) % keyPool.length;
      const comboId = `${keyIdx}:${model}`;
      const now = Date.now();

      if (deadCombos.has(comboId) || isComboOnCooldown(keyIdx, model, now)) {
        continue;
      }

      triedAnyKey = true;
      const apiKey = keyPool[keyIdx];
      const remainingMs = Math.max(1_500, Math.min(perAttemptTimeoutMs, deadline - now));

      try {
        const upstream = await fetchWithTimeout(
          `${GEMINI_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          },
          remainingMs,
        );
        const json: unknown = await upstream.json().catch(() => ({ error: { message: 'Respuesta ilegible de la IA' } }));
        lastStatus = upstream.status;
        lastJson = json;

        if (upstream.ok) {
          activeServerKeyIndex = keyIdx;
          if (cacheKey) writeCache(cacheKey, json);
          sendJson(res, 200, json, { 'X-Impulso-AI-Model': model, 'X-Impulso-AI-Cache': 'MISS' });
          return;
        }

        if (isModelUnavailableError(upstream.status, json)) {
          deadCombos.add(comboId);
          // Modelo muerto: salir inmediatamente del ciclo de llaves y probar siguiente modelo
          break;
        }

        all404ForModel = false;

        if (isQuotaError(upstream.status, json)) {
          // Circuit breaker 120s en (keyIdx, model) y rotación inmediata (<50ms) a la siguiente llave
          cooldownUntil.set(comboId, Date.now() + RATE_LIMIT_COOLDOWN_MS);
          activeServerKeyIndex = (keyIdx + 1) % keyPool.length;
          continue;
        }

        if (upstream.status === 401 || upstream.status === 403) {
          cooldownUntil.set(`key:${keyIdx}`, Date.now() + AUTH_ERROR_COOLDOWN_MS);
          activeServerKeyIndex = (keyIdx + 1) % keyPool.length;
          continue;
        }

        if (upstream.status >= 500 || upstream.status === 408) {
          activeServerKeyIndex = (keyIdx + 1) % keyPool.length;
          continue;
        }

        // Error 400 de esquema/payload: no reintentar en todas las llaves
        sendJson(res, upstream.status, json);
        return;
      } catch {
        all404ForModel = false;
        // Timeout o fallo de red: rotar de inmediato a la siguiente llave
        activeServerKeyIndex = (keyIdx + 1) % keyPool.length;
        continue;
      }
    }

    if (triedAnyKey && all404ForModel) {
      deadModels.add(model);
    }
  }

  sendJson(res, lastStatus, lastJson);
}
