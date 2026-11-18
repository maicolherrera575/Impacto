import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * 🛡️ V20.0 · Verificador Forense de Pagos Nequi/Llave en Servidor (Anti-Tampering).
 *
 * Todo el flujo sensible corre exclusivamente del lado del servidor:
 *   1. Validación estricta de sesión JWT del comerciante en Supabase Auth.
 *   2. Cálculo criptográfico real de huella SHA-256 de la imagen del comprobante (`node:crypto`).
 *   3. Lectura directa en servidor del Nequi oficial (`3158942112` / `get_payment_config_rpc`)
 *      y tarifas canónicas de paquetes (`arranque`, `activo`, `dominio`).
 *   4. Auditoría OCR + Gemini 2.5 Flash Vision en servidor (sin confiar en datos de IA del cliente).
 *   5. Verificación anti-reutilización, inserción (`submit_credit_order_rpc`) y auto-aprobación
 *      (`auto_approve_credit_order_rpc`) ejecutadas servidor-a-servidor.
 */

const OFFICIAL_ADMIN_NEQUI = '3158942112';
const OFFICIAL_ADMIN_LLAVE = '@impulso3158942112';
const MAX_BODY_BYTES = 512 * 1024;
const MODEL_CHAIN = ['gemini-1.5-pro-latest', 'gemini-1.5-flash-latest', 'gemini-2.0-flash', 'gemini-1.5-flash'] as const;
const RETRYABLE_STATUS = new Set([404, 408, 429, 500, 502, 503, 504]);
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

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

function sendJson(res: VercelRes, statusCode: number, body: unknown): void {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
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

function getEnv() {
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const anonKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
  const geminiKey = (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '').trim();
  return { supabaseUrl, anonKey, geminiKey };
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
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${rpcName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${userJwt}`,
    },
    body: JSON.stringify(params ?? {}),
  });
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
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: 'GET',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${userJwt}`,
    },
  });
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
): Promise<ServerReceiptAudit> {
  if (!geminiKey) {
    throw new Error('El servidor no tiene configurada GEMINI_API_KEY.');
  }

  const prompt = `${RECEIPT_VISION_PROMPT}\nLa cuenta oficial autorizada de recaudo es el Nequi ${adminPhone} (principal oficial: ${OFFICIAL_ADMIN_NEQUI}) o la Llave ${adminKey}.`;
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

  let rawText = '';
  let lastErr = new Error('La IA no respondió');
  for (const model of MODEL_CHAIN) {
    try {
      const upstream = await fetch(`${GEMINI_BASE}/${model}:generateContent?key=${encodeURIComponent(geminiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json: unknown = await upstream.json().catch(() => null);
      if (!upstream.ok) {
        const msg = (json as { error?: { message?: string } } | null)?.error?.message;
        lastErr = new Error(msg || `Gemini HTTP ${upstream.status}`);
        if (RETRYABLE_STATUS.has(upstream.status)) continue;
        throw lastErr;
      }
      const candidates = (json as { candidates?: { content?: { parts?: { text?: string }[] } }[] } | null)?.candidates;
      const parts = candidates?.[0]?.content?.parts ?? [];
      rawText = parts.map((p) => (typeof p?.text === 'string' ? p.text : '')).join('').trim();
      if (rawText) break;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
    }
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
  const isValidDestination = Boolean(
    dest &&
      ((dest10.length === 10 && (dest10 === admin10 || dest10 === OFFICIAL_ADMIN_NEQUI)) ||
        (keyClean && dest.toLowerCase().includes(keyClean))),
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
    // Huella SHA-256 calculada ESTRICTAMENTE en servidor sobre los bytes reales
    const receiptHash = crypto.createHash('sha256').update(image.bytes).digest('hex');

    const cfgRaw = (await callSupabaseRpc(env.supabaseUrl, env.anonKey, userJwt, 'get_payment_config_rpc')) as {
      nequiPhone?: string;
      llave?: string;
      autoApprove?: boolean;
    } | null;

    const adminPhone = last10Digits(cfgRaw?.nequiPhone || OFFICIAL_ADMIN_NEQUI) || OFFICIAL_ADMIN_NEQUI;
    const adminKey = cfgRaw?.llave?.trim() || OFFICIAL_ADMIN_LLAVE;
    const autoApproveOn = cfgRaw?.autoApprove === true;

    let audit: ServerReceiptAudit | null = null;
    try {
      audit = await analyzeReceiptWithGeminiServer(env.geminiKey, image, adminPhone, adminKey);
    } catch (aiErr) {
      if (action === 'verify') {
        throw aiErr;
      }
      // En envío manual de respaldo si la IA no está disponible, jamás permite auto-aprobación
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
          message: `🚨 El comprobante indica destino ${audit.destinationDetected}, distinto a la cuenta oficial ${adminPhone}.`,
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

    const note = audit
      ? [
          audit.looksReal ? 'Comprobante válido (servidor)' : 'IA no lo reconoce',
          audit.suspicious ? '🚨 POSIBLE FRAUDE (captura editada/pendiente)' : '',
          audit.amountCop ? `monto leído ${audit.amountCop}` : 'monto no legible',
          audit.destinationDetected ? `destino ${audit.destinationDetected}` : 'destino no legible',
          audit.isValidDestination ? `✅ destino oficial ${adminPhone} confirmado` : '⚠️ destino no confirmado',
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
      }
    }

    sendJson(res, 200, {
      ok: true,
      order,
      receiptHash,
      iaStatusOk,
      autoApproved,
      approvedCredits,
      verification: audit,
    });
  } catch (err) {
    sendJson(res, 400, {
      error: { message: err instanceof Error ? err.message : 'No se pudo procesar el comprobante en servidor' },
    });
  }
}
