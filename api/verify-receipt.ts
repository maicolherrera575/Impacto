import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * 🛡️ V36.0 · Verificador Forense de Pagos Nequi/Llave en Servidor (Anti-Tampering).
 *
 * - Soporta pool de 4+ llaves Gemini (`GEMINI_API_KEY_1..5` + `GEMINI_API_KEY` + `GEMINI_API_KEYS`).
 * - Model Discovery Cache (TTL 60 min) + Circuit Breaker (404 permanente / 429 cooldown 120s).
 * - AbortController estricto (12s por intento de visión) — cero cuelgues.
 * - Rate Limiting por ventana deslizante (IP + Fingerprint) contra abuso.
 * - Validación estricta de sesión JWT + huella SHA-256 + destino oficial 3158942112.
 */

const OFFICIAL_ADMIN_NEQUI = '3158942112';
const OFFICIAL_ADMIN_LLAVE = '@impulso3158942112';
const MAX_BODY_BYTES = 512 * 1024;
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DISCOVERY_TTL_MS = 60 * 60 * 1000;
const VISION_TIMEOUT_MS = 12_000;
const TOTAL_VISION_BUDGET_MS = 24_000;
const RL_WINDOW_MS = 60_000;
const RL_MAX_REQUESTS = 12;

const FALLBACK_VISION_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.5-pro',
] as const;

const FORBIDDEN_MODEL_RE = /embedding|aqa|imagen|veo|tts|audio|live|bison|gecko|legacy|1\.0|1\.5/i;

const CANONICAL_PACKAGES = {
  arranque: { name: 'Plan Arranque', credits: 5, priceCop: 10000 },
  activo: { name: 'Plan Negocio Activo', credits: 15, priceCop: 24000 },
  dominio: { name: 'Plan Dominio Municipal', credits: 35, priceCop: 45000 },
} as const;

type PackageId = keyof typeof CANONICAL_PACKAGES;

type VercelRes = ServerResponse & {
  status?: (code: number) => VercelRes;
  json?: (body: unknown) => void;
};

let activeVerifyKeyIdx = 0;
let discoveredVisionModels: string[] = [];
let discoveredVisionAt = 0;
const deadVisionModels = new Set<string>();
const verifyCooldownUntil = new Map<string, number>();
const verifyRateWindows = new Map<string, number[]>();

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

function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let size = 0;
    let raw = '';
    req.on('data', (chunk: Buffer | string) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('PAYLOAD_TOO_LARGE'));
        return;
      }
      raw += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    });
    req.on('end', () => {
      try {
        resolve(raw ? (JSON.parse(raw) as Record<string, unknown>) : {});
      } catch {
        reject(new Error('INVALID_JSON'));
      }
    });
    req.on('error', reject);
  });
}

function firstHeader(headers: IncomingMessage['headers'], name: string): string {
  const v = headers[name.toLowerCase()];
  if (Array.isArray(v)) return v[0] ?? '';
  return typeof v === 'string' ? v : '';
}

function checkRateLimit(req: IncomingMessage): { allowed: boolean; retryAfterSec: number } {
  const xff = firstHeader(req.headers, 'x-forwarded-for').split(',')[0]?.trim();
  const ip = xff || firstHeader(req.headers, 'x-real-ip') || req.socket?.remoteAddress || 'unknown';
  const fp = firstHeader(req.headers, 'x-device-fingerprint').trim().slice(0, 48);
  const id = fp ? `${ip}:${fp}` : ip;
  const now = Date.now();
  const prev = verifyRateWindows.get(id) ?? [];
  const fresh = prev.filter((ts) => now - ts < RL_WINDOW_MS);
  if (fresh.length >= RL_MAX_REQUESTS) {
    const retryAfterSec = Math.max(1, Math.ceil((RL_WINDOW_MS - (now - (fresh[0] ?? now))) / 1000));
    verifyRateWindows.set(id, fresh);
    return { allowed: false, retryAfterSec };
  }
  fresh.push(now);
  verifyRateWindows.set(id, fresh);
  return { allowed: true, retryAfterSec: 0 };
}

function getGeminiKeyPool(): string[] {
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

function getEnv() {
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const anonKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
  const keyPool = getGeminiKeyPool();
  const geminiKey = keyPool[activeVerifyKeyIdx % Math.max(1, keyPool.length)] ?? '';
  return { supabaseUrl, anonKey, geminiKey, keyPool };
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

function scoreVisionModel(name: string): number {
  const lower = name.toLowerCase();
  if (!lower.startsWith('gemini-') || FORBIDDEN_MODEL_RE.test(lower)) return -1;
  if (/thinking|exp-\d{4}|preview-tts|computer-use|robotics|deep-research/i.test(lower)) return -1;
  const m = /gemini-(\d+)(?:\.(\d+))?/i.exec(lower);
  const ver = (m ? Number(m[1]) : 0) * 100 + (m && m[2] ? Number(m[2]) : 0) * 10;
  const fam = lower.includes('flash-lite') ? 55 : lower.includes('flash') ? 95 : lower.includes('pro') ? 50 : 0;
  const stab = /preview|exp/i.test(lower) ? -8 : 12;
  return ver + fam + stab;
}

async function discoverVisionModels(keyPool: string[]): Promise<string[]> {
  const now = Date.now();
  if (discoveredVisionModels.length > 0 && now - discoveredVisionAt < DISCOVERY_TTL_MS) {
    return discoveredVisionModels.filter((m) => !deadVisionModels.has(m));
  }
  for (let i = 0; i < Math.min(keyPool.length, 2); i += 1) {
    const key = keyPool[(activeVerifyKeyIdx + i) % keyPool.length];
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
      const list = (json?.models ?? [])
        .filter((m) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
        .map((m) => String(m.name ?? '').replace(/^models\//, '').trim())
        .filter((name) => scoreVisionModel(name) > 0 && !deadVisionModels.has(name))
        .sort((a, b) => scoreVisionModel(b) - scoreVisionModel(a));
      const unique = Array.from(new Set(list)).slice(0, 5);
      if (unique.length > 0) {
        discoveredVisionModels = unique;
        discoveredVisionAt = now;
        return unique;
      }
    } catch {
      /* fallback */
    }
  }
  return FALLBACK_VISION_MODELS.filter((m) => !deadVisionModels.has(m));
}

function parseDataUrlImage(dataUrl: string): { mimeType: string; base64: string; bytes: Buffer } {
  const match = /^data:(image\/(?:webp|png|jpeg|jpg));base64,([A-Za-z0-9+/=]+)$/i.exec(dataUrl.trim());
  if (!match) {
    throw new Error('La captura debe llegar como imagen válida (WebP, PNG o JPEG).');
  }
  if (dataUrl.length > 35_000) {
    throw new Error('El comprobante supera el tamaño permitido (35 KB comprimido).');
  }
  const mimeType = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase();
  const base64 = match[2];
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length < 120) {
    throw new Error('La captura está corrupta o vacía. Súbela de nuevo.');
  }
  return { mimeType, base64, bytes };
}

async function callSupabaseRpc(
  supabaseUrl: string,
  anonKey: string,
  userJwt: string,
  rpcName: string,
  params?: Record<string, unknown>,
): Promise<unknown> {
  const res = await fetchWithTimeout(
    `${supabaseUrl}/rest/v1/rpc/${rpcName}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${userJwt}`,
      },
      body: JSON.stringify(params ?? {}),
    },
    8_000,
  );
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      json && typeof json === 'object' && typeof (json as { message?: unknown }).message === 'string'
        ? (json as { message: string }).message
        : `Error RPC (${res.status})`;
    throw new Error(msg);
  }
  return json;
}

async function assertAuthenticatedUser(supabaseUrl: string, anonKey: string, userJwt: string): Promise<string> {
  const res = await fetchWithTimeout(
    `${supabaseUrl}/auth/v1/user`,
    {
      method: 'GET',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${userJwt}`,
      },
    },
    6_000,
  );
  if (!res.ok) {
    throw new Error('Tu sesión expiró. Vuelve a iniciar sesión para recargar.');
  }
  const user = (await res.json().catch(() => null)) as { id?: string } | null;
  if (!user?.id) throw new Error('Sesión de usuario inválida.');
  return user.id;
}

interface ServerReceiptAudit {
  looksReal: boolean;
  suspicious: boolean;
  amountCop: number | null;
  reference: string | null;
  destinationDetected: string | null;
  dateDetected: string | null;
  isValidDestination: boolean;
  statusOk: boolean;
  note: string;
}

const RECEIPT_VISION_PROMPT = `Eres el auditor forense de pagos de Impulso en servidor. Analiza esta captura de Nequi, Daviplata, Transfiya o Bancolombia de Colombia mediante OCR y visión forense.
Devuelve ÚNICAMENTE este JSON exacto:
{"looks_real": true|false, "suspicious": true|false, "amount_cop": entero o null, "reference": "referencia/CUS/Id de operación visible (máx 40 chars)" o null, "destination_detected": "celular o Llave destino tal como aparece" o null, "date_detected": "fecha y hora visibles" o null, "status_ok": true|false, "note": "resumen corto en español (máx 120 chars)"}

Reglas estrictas anti-fraude:
- looks_real: true SOLO si es pantalla auténtica de pago de Nequi/Daviplata/Bancolombia/Transfiya.
- suspicious: true si detectas fuentes distintas, textos pegados, foto de otro celular, pago Pendiente/Programado, o si el destino no coincide con la cuenta oficial autorizada.
- status_ok: true SOLO si indica "Envío realizado", "Exitoso" o "Aprobado".
- amount_cop: monto pagado en COP (ej: $24.000 -> 24000).`;

function parseAiJson<T>(rawText: string): T {
  const first = rawText.indexOf('{');
  const last = rawText.lastIndexOf('}');
  const clean = first !== -1 && last !== -1 ? rawText.slice(first, last + 1) : rawText;
  return JSON.parse(clean) as T;
}

function last10Digits(value: string): string {
  const d = value.replace(/\D/g, '');
  return d.length >= 10 ? d.slice(-10) : d;
}

async function analyzeReceiptWithGeminiServer(
  geminiKey: string,
  image: { mimeType: string; base64: string },
  adminPhone: string,
  adminKey: string,
  daviplataPhone?: string,
): Promise<ServerReceiptAudit> {
  const keyPool = getGeminiKeyPool();
  const effectivePool = keyPool.length > 0 ? keyPool : geminiKey ? [geminiKey] : [];
  if (effectivePool.length === 0) {
    throw new Error('El servidor no tiene configurada GEMINI_API_KEY.');
  }

  const davi10 = last10Digits(daviplataPhone || '');
  const daviNote = davi10.length === 10 && davi10 !== adminPhone ? `, Daviplata oficial ${davi10}` : '';
  const prompt = `${RECEIPT_VISION_PROMPT}\nLas cuentas oficiales autorizadas de recaudo son: Nequi ${adminPhone} (principal: ${OFFICIAL_ADMIN_NEQUI})${daviNote} o la Llave ${adminKey}.`;
  const payload = {
    contents: [
      {
        role: 'user',
        parts: [{ inlineData: { mimeType: image.mimeType, data: image.base64 } }, { text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
  };

  const models = await discoverVisionModels(effectivePool);
  const deadline = Date.now() + TOTAL_VISION_BUDGET_MS;
  let rawText = '';
  let lastErr = new Error('La IA de verificación no respondió a tiempo');

  for (const model of models.slice(0, 4)) {
    if (Date.now() >= deadline || deadVisionModels.has(model)) break;
    let all404 = true;

    for (let attempt = 0; attempt < effectivePool.length; attempt += 1) {
      const now = Date.now();
      if (now >= deadline) break;
      const idx = (activeVerifyKeyIdx + attempt) % effectivePool.length;
      const comboId = `${idx}:${model}`;
      if ((verifyCooldownUntil.get(comboId) ?? 0) > now || (verifyCooldownUntil.get(`key:${idx}`) ?? 0) > now) {
        continue;
      }

      const activeKey = effectivePool[idx];
      const timeoutMs = Math.max(3_000, Math.min(VISION_TIMEOUT_MS, deadline - now));
      try {
        const upstream = await fetchWithTimeout(
          `${GEMINI_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(activeKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          },
          timeoutMs,
        );
        const json: unknown = await upstream.json().catch(() => null);
        if (!upstream.ok) {
          const msg = (json as { error?: { message?: string } } | null)?.error?.message;
          lastErr = new Error(msg || `Gemini HTTP ${upstream.status}`);
          if (upstream.status === 404) {
            break;
          }
          all404 = false;
          if (upstream.status === 429) {
            verifyCooldownUntil.set(comboId, Date.now() + 120_000);
            activeVerifyKeyIdx = (idx + 1) % effectivePool.length;
            continue;
          }
          if (upstream.status === 401 || upstream.status === 403) {
            verifyCooldownUntil.set(`key:${idx}`, Date.now() + 600_000);
            activeVerifyKeyIdx = (idx + 1) % effectivePool.length;
            continue;
          }
          if (upstream.status >= 500 || upstream.status === 408) {
            activeVerifyKeyIdx = (idx + 1) % effectivePool.length;
            continue;
          }
          throw lastErr;
        }
        all404 = false;
        activeVerifyKeyIdx = idx;
        const candidates = (json as { candidates?: { content?: { parts?: { text?: string }[] } }[] } | null)?.candidates;
        const parts = candidates?.[0]?.content?.parts ?? [];
        rawText = parts.map((p) => (typeof p?.text === 'string' ? p.text : '')).join('').trim();
        if (rawText) break;
      } catch (err) {
        all404 = false;
        lastErr = err instanceof Error ? err : new Error(String(err));
        activeVerifyKeyIdx = (idx + 1) % effectivePool.length;
      }
    }
    if (all404) deadVisionModels.add(model);
    if (rawText) break;
  }

  if (!rawText) throw lastErr;

  const parsed = parseAiJson<{
    looks_real?: boolean;
    suspicious?: boolean;
    amount_cop?: number | null;
    reference?: string | null;
    destination_detected?: string | null;
    date_detected?: string | null;
    status_ok?: boolean;
    note?: string | null;
  }>(rawText);

  const dest = typeof parsed.destination_detected === 'string' ? parsed.destination_detected.trim().slice(0, 40) : null;
  const dest10 = last10Digits(dest ?? '');
  const admin10 = last10Digits(adminPhone || OFFICIAL_ADMIN_NEQUI);
  const keyClean = adminKey.replace(/[^a-zA-Z0-9@]/g, '').toLowerCase();
  const keyBare = keyClean.replace(/^@+/, '');
  const destClean = (dest ?? '').replace(/[^a-zA-Z0-9@]/g, '').toLowerCase();
  const isValidDestination = Boolean(
    dest &&
      ((dest10.length === 10 && (dest10 === admin10 || dest10 === OFFICIAL_ADMIN_NEQUI || (davi10.length === 10 && dest10 === davi10))) ||
        (keyClean && destClean.includes(keyClean)) ||
        (keyBare.length >= 6 && destClean.includes(keyBare))),
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
    note: typeof parsed.note === 'string' ? parsed.note.trim().slice(0, 160) : 'Comprobante auditado en servidor',
  };
}

export default async function handler(req: IncomingMessage, res: VercelRes): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: { message: 'Método no permitido' } });
    return;
  }

  const rl = checkRateLimit(req);
  if (!rl.allowed) {
    sendJson(
      res,
      429,
      { error: { message: 'Demasiados intentos de verificación. Espera un minuto y vuelve a intentarlo.' } },
      { 'Retry-After': String(rl.retryAfterSec) },
    );
    return;
  }

  const env = getEnv();
  if (!env.supabaseUrl || !env.anonKey) {
    sendJson(res, 500, { error: { message: 'Configuración de Supabase incompleta en el servidor' } });
    return;
  }

  const userJwt = firstHeader(req.headers, 'authorization').replace(/^Bearer\s+/i, '').trim();
  if (!userJwt) {
    sendJson(res, 401, { error: { message: 'Autenticación requerida' } });
    return;
  }

  let body: Record<string, unknown>;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    sendJson(res, 400, { error: { message: err instanceof Error ? err.message : 'Cuerpo inválido' } });
    return;
  }

  try {
    await assertAuthenticatedUser(env.supabaseUrl, env.anonKey, userJwt);

    const action = typeof body.action === 'string' ? body.action : 'verify';
    const imageDataUrl = typeof body.imageDataUrl === 'string' ? body.imageDataUrl : '';
    const image = parseDataUrlImage(imageDataUrl);
    const receiptHash = crypto.createHash('sha256').update(image.bytes).digest('hex');

    const cfgRaw = (await callSupabaseRpc(env.supabaseUrl, env.anonKey, userJwt, 'get_payment_config_rpc')) as {
      nequiPhone?: string;
      daviplataPhone?: string;
      llave?: string;
      autoApprove?: boolean;
    } | null;

    const adminPhone = last10Digits(cfgRaw?.nequiPhone || OFFICIAL_ADMIN_NEQUI) || OFFICIAL_ADMIN_NEQUI;
    const daviplataPhone = last10Digits(cfgRaw?.daviplataPhone || '') || adminPhone;
    const adminKey = cfgRaw?.llave?.trim() || OFFICIAL_ADMIN_LLAVE;
    const autoApproveOn = cfgRaw?.autoApprove === true;

    let audit: ServerReceiptAudit | null = null;
    try {
      audit = await analyzeReceiptWithGeminiServer(env.geminiKey, image, adminPhone, adminKey, daviplataPhone);
    } catch (aiErr) {
      if (action === 'verify') {
        throw aiErr;
      }
      audit = null;
    }

    const rawRef = typeof body.referenceCode === 'string' ? body.referenceCode.trim() : '';
    const qrPayload = typeof body.qrPayload === 'string' ? body.qrPayload.trim().slice(0, 60) : null;
    const chosenRef = (rawRef || audit?.reference || qrPayload?.replace(/[^A-Za-z0-9.\-]/g, '') || '').slice(0, 40);

    const dupCheck = (await callSupabaseRpc(env.supabaseUrl, env.anonKey, userJwt, 'check_receipt_already_used_rpc', {
      p_raw_reference: chosenRef,
      p_receipt_hash: receiptHash,
    })) as { used?: boolean; reason?: string } | null;

    if (action === 'verify') {
      sendJson(res, 200, {
        ok: true,
        receiptHash,
        alreadyUsed: dupCheck?.used === true,
        usedReason: dupCheck?.reason ?? '',
        verification: audit,
        officialNequi: adminPhone,
      });
      return;
    }

    if (action !== 'submit') {
      sendJson(res, 400, { error: { message: 'Acción no válida' } });
      return;
    }

    if (dupCheck?.used === true) {
      sendJson(res, 409, {
        error: {
          message:
            dupCheck.reason ||
            '🚫 CÓDIGO O COMPROBANTE YA UTILIZADO: esta captura o referencia ya fue canjeada.',
        },
      });
      return;
    }

    const packageId = typeof body.packageId === 'string' ? (body.packageId as PackageId) : 'activo';
    const pkg = CANONICAL_PACKAGES[packageId];
    if (!pkg) {
      sendJson(res, 400, { error: { message: 'Paquete de créditos inválido' } });
      return;
    }

    const paymentMethod =
      body.paymentMethod === 'Daviplata' || body.paymentMethod === 'Bancolombia' || body.paymentMethod === 'Llave'
        ? body.paymentMethod
        : 'Nequi';

    if (chosenRef.length < 4) {
      sendJson(res, 400, {
        error: { message: 'Escribe o escanea el código de referencia de tu pago (mínimo 4 caracteres).' },
      });
      return;
    }

    if (audit && audit.destinationDetected && !audit.isValidDestination) {
      sendJson(res, 400, {
        error: {
          message: `🚨 El comprobante indica destino ${audit.destinationDetected}, distinto a las cuentas oficiales autorizadas de Impulso (${adminPhone}${daviplataPhone !== adminPhone ? ` / ${daviplataPhone}` : ''}).`,
        },
      });
      return;
    }

    if (audit && audit.amountCop != null && audit.amountCop > 0 && audit.amountCop !== pkg.priceCop) {
      sendJson(res, 400, {
        error: {
          message: `⚠️ El valor del comprobante ($${audit.amountCop.toLocaleString('es-CO')}) no coincide con el paquete elegido ($${pkg.priceCop.toLocaleString('es-CO')}). Selecciona el plan exacto que pagaste.`,
        },
      });
      return;
    }

    const iaStatusOk = Boolean(
      audit &&
        audit.looksReal &&
        !audit.suspicious &&
        audit.statusOk &&
        audit.isValidDestination &&
        audit.amountCop === pkg.priceCop,
    );

    let reviewReason: string | null = null;
    if (!iaStatusOk) {
      if (!audit) reviewReason = 'Revisión manual del administrador (lectura automática no disponible).';
      else if (audit.suspicious) reviewReason = 'Requiere verificación manual prioritaria por el administrador.';
      else if (!audit.statusOk) reviewReason = 'Pendiente de confirmación de estado exitoso por el administrador.';
      else if (!audit.isValidDestination) reviewReason = 'Pendiente de confirmar cuenta destino en revisión manual.';
      else if (audit.amountCop == null) reviewReason = 'Monto poco legible en la imagen: pasó a verificación manual.';
      else reviewReason = 'Tu pago pasó a verificación manual del administrador.';
    } else if (!autoApproveOn) {
      reviewReason = 'Comprobante validado. El administrador confirmará y activará tus créditos en minutos.';
    }

    const note = audit
      ? [
          audit.looksReal ? 'Comprobante válido (servidor)' : 'IA no lo reconoce',
          audit.suspicious ? '🚨 POSIBLE FRAUDE (captura editada/pendiente)' : '',
          audit.amountCop ? `monto leído ${audit.amountCop}` : 'monto no legible',
          audit.destinationDetected ? `destino ${audit.destinationDetected}` : 'destino no legible',
          audit.isValidDestination ? `✅ destino oficial confirmado (${paymentMethod})` : '⚠️ destino no confirmado',
          audit.statusOk ? '✅ pago exitoso' : '⚠️ estado no confirmado',
          audit.dateDetected ? `fecha ${audit.dateDetected}` : '',
          audit.note,
        ]
          .filter(Boolean)
          .join(' · ')
      : 'Envío manual pendiente de revisión por el administrador';

    const order = (await callSupabaseRpc(env.supabaseUrl, env.anonKey, userJwt, 'submit_credit_order_rpc', {
      p_package_name: pkg.name,
      p_credits_requested: pkg.credits,
      p_amount_cop: pkg.priceCop,
      p_reference_code: chosenRef,
      p_payment_method: paymentMethod,
      p_receipt_thumb: imageDataUrl,
      p_ai_note: note,
      p_receipt_hash: receiptHash,
      p_destination_detected: audit?.destinationDetected ?? null,
      p_qr_payload: qrPayload,
      p_ia_status_ok: iaStatusOk,
    })) as { id: string };

    let autoApproved = false;
    let approvedCredits = 0;

    if (iaStatusOk && autoApproveOn && order?.id) {
      const autoRes = (await callSupabaseRpc(
        env.supabaseUrl,
        env.anonKey,
        userJwt,
        'auto_approve_credit_order_rpc',
        { p_order_id: order.id },
      )) as { approved?: boolean; credits?: number } | null;
      if (autoRes?.approved === true) {
        autoApproved = true;
        approvedCredits = Number(autoRes.credits ?? pkg.credits);
        reviewReason = null;
      }
    }

    sendJson(res, 200, {
      ok: true,
      order,
      receiptHash,
      iaStatusOk,
      autoApproved,
      approvedCredits,
      reviewReason,
      verification: audit,
    });
  } catch (err) {
    sendJson(res, 400, {
      error: { message: err instanceof Error ? err.message : 'No se pudo procesar el comprobante en servidor' },
    });
  }
}
