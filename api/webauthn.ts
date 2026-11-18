import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * 🔐 V36.0 · Verificador Criptográfico WebAuthn / Passkeys (Reparación de Raíz).
 *
 * Correcciones críticas de producción:
 *  1. Normalización estricta Base64URL sin padding (`=`) en `credentialId`.
 *  2. Validación consistente de `origin` y `rpId` (acepta `tuimpulso.vercel.app`,
 *     `www.tuimpulso.vercel.app`, `impacto-tawny.vercel.app`, `VERCEL_URL` y `localhost`).
 *  3. Compatibilidad W3C WebAuthn Level 3 con Passkeys sincronizadas en Android/iOS
 *     (manejo seguro de `signCount === 0` sin falsos positivos de clonación).
 *  4. Eliminación de la fragilidad de `localStorage`: la bóveda AES-256-GCM se persiste
 *     cifrada en servidor (`sealed_vault` en Supabase) y admite rotación multi-secreto
 *     + auto-sanación transparente (`action: 'sync-vault'`) al iniciar sesión con contraseña.
 *  5. Soporte completo para login Discoverable (sin correo previo) y con correo.
 *  6. Rate Limiting deslizante por IP + Fingerprint contra fuerza bruta.
 */

const MAX_BODY_BYTES = 64 * 1024;
const RL_WINDOW_MS = 60_000;
const RL_MAX_REQUESTS = 20;

const authRateWindows = new Map<string, number[]>();

type VercelRes = ServerResponse & {
  status?: (code: number) => VercelRes;
  json?: (body: unknown) => void;
};

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
  const key = fp ? `${ip}:${fp}` : ip;
  const now = Date.now();
  const prev = authRateWindows.get(key) ?? [];
  const fresh = prev.filter((ts) => now - ts < RL_WINDOW_MS);
  if (fresh.length >= RL_MAX_REQUESTS) {
    const retryAfterSec = Math.max(1, Math.ceil((RL_WINDOW_MS - (now - (fresh[0] ?? now))) / 1000));
    authRateWindows.set(key, fresh);
    return { allowed: false, retryAfterSec };
  }
  fresh.push(now);
  authRateWindows.set(key, fresh);
  return { allowed: true, retryAfterSec: 0 };
}

function getEnvConfig() {
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const anonKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  // Pool ordenado de secretos de bóveda: prioriza secreto dedicado o estable
  // y conserva llaves previas para descifrar bóvedas selladas antes de rotar Gemini API Keys.
  const vaultSecrets = Array.from(
    new Set(
      [
        process.env.WEBAUTHN_VAULT_SECRET,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        process.env.GEMINI_API_KEY,
        process.env.GEMINI_API_KEY_1,
        process.env.GEMINI_API_KEY_2,
        process.env.GEMINI_API_KEY_3,
        process.env.GEMINI_API_KEY_4,
        process.env.VITE_GEMINI_API_KEY,
        anonKey ? `impulso-vault-v36:${anonKey}` : '',
      ]
        .map((s) => (s ?? '').trim())
        .filter((s) => s.length >= 16),
    ),
  );
  const vaultSecret = vaultSecrets[0] ?? '';
  return { supabaseUrl, anonKey, serviceRoleKey, vaultSecret, vaultSecrets };
}

function normalizeBase64Url(input: string): string {
  return input.trim().replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function b64UrlToBuffer(input: string): Buffer {
  const norm = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - (norm.length % 4)) % 4;
  return Buffer.from(norm + '='.repeat(pad), 'base64');
}

function bufferToB64Url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function stripPort(host: string): string {
  return host.split(',')[0]?.trim().replace(/:\d+$/, '').toLowerCase() ?? '';
}

function assertValidOrigin(req: IncomingMessage, clientOrigin: string): string {
  let url: URL;
  try {
    url = new URL(clientOrigin);
  } catch {
    throw new Error('Origen WebAuthn inválido');
  }
  const hostname = url.hostname.toLowerCase();
  const bareHost = hostname.replace(/^www\./, '');
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !isLocal) {
    throw new Error('La biometría requiere conexión segura HTTPS');
  }

  const allowedHosts = new Set<string>();
  const addHost = (h: string) => {
    const clean = stripPort(h);
    if (!clean) return;
    allowedHosts.add(clean);
    allowedHosts.add(clean.replace(/^www\./, ''));
    allowedHosts.add(`www.${clean.replace(/^www\./, '')}`);
  };

  addHost(firstHeader(req.headers, 'x-forwarded-host'));
  addHost(firstHeader(req.headers, 'host'));
  if (process.env.VERCEL_URL) addHost(process.env.VERCEL_URL);
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) addHost(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  addHost('impacto-tawny.vercel.app');
  addHost('tuimpulso.vercel.app');

  const isAllowed = allowedHosts.has(hostname) || allowedHosts.has(bareHost) || isLocal;
  if (allowedHosts.size > 0 && !isAllowed) {
    throw new Error(`Dominio no autorizado para biometría (${hostname})`);
  }
  return hostname;
}

function verifyRpIdHash(rpIdHash: Buffer, hostname: string): boolean {
  const candidates = Array.from(new Set([hostname, hostname.replace(/^www\./, '')]));
  for (const cand of candidates) {
    const expected = crypto.createHash('sha256').update(cand, 'utf8').digest();
    if (rpIdHash.length === expected.length && crypto.timingSafeEqual(rpIdHash, expected)) {
      return true;
    }
  }
  return false;
}

function parseAuthenticatorData(authData: Buffer) {
  if (authData.length < 37) {
    throw new Error('authenticatorData corrupto o incompleto');
  }
  const rpIdHash = authData.subarray(0, 32);
  const flags = authData[32] ?? 0;
  const userPresent = (flags & 0x01) !== 0;
  const userVerified = (flags & 0x04) !== 0;
  const signCount = authData.readUInt32BE(33);
  return { rpIdHash, userPresent, userVerified, signCount };
}

function deriveVaultKey(secret: string, userId: string, credentialId: string): Buffer {
  const key = crypto.hkdfSync(
    'sha256',
    Buffer.from(secret, 'utf8'),
    Buffer.from(`${userId}:${credentialId}`, 'utf8'),
    Buffer.from('impulso-passkey-vault-v1', 'utf8'),
    32,
  );
  return Buffer.from(key);
}

function sealPassword(secret: string, userId: string, credentialId: string, email: string, password: string): string {
  const normCred = normalizeBase64Url(credentialId);
  const key = deriveVaultKey(secret, userId, normCred);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(`${userId}:${normCred}`, 'utf8'));
  const plain = Buffer.from(JSON.stringify({ email, password }), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [bufferToB64Url(iv), bufferToB64Url(tag), bufferToB64Url(encrypted)].join('.');
}

function openPasswordWithPool(
  secrets: string[],
  userId: string,
  credentialId: string,
  sealed: string,
): { email: string; password: string } | null {
  const parts = sealed.split('.');
  if (parts.length !== 3) return null;
  const [ivB64, tagB64, encB64] = parts;
  const normCred = normalizeBase64Url(credentialId);
  const credVariants = Array.from(new Set([normCred, credentialId.trim()]));

  for (const secret of secrets) {
    for (const cid of credVariants) {
      try {
        const key = deriveVaultKey(secret, userId, cid);
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, b64UrlToBuffer(ivB64));
        decipher.setAAD(Buffer.from(`${userId}:${cid}`, 'utf8'));
        decipher.setAuthTag(b64UrlToBuffer(tagB64));
        const plain = Buffer.concat([decipher.update(b64UrlToBuffer(encB64)), decipher.final()]).toString('utf8');
        const parsed = JSON.parse(plain) as { email?: unknown; password?: unknown };
        if (typeof parsed.email === 'string' && typeof parsed.password === 'string') {
          return { email: parsed.email, password: parsed.password };
        }
      } catch {
        /* intentar siguiente secreto del pool */
      }
    }
  }
  return null;
}

async function callSupabaseRpc(
  supabaseUrl: string,
  apiKey: string,
  rpcName: string,
  params: Record<string, unknown>,
  bearerToken?: string,
): Promise<unknown> {
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${rpcName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: apiKey,
      Authorization: `Bearer ${bearerToken || apiKey}`,
    },
    body: JSON.stringify(params),
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

export default async function handler(req: IncomingMessage, res: VercelRes): Promise<void> {
  const env = getEnvConfig();
  const mode = env.serviceRoleKey ? 'admin-otp' : env.vaultSecret ? 'sealed-vault' : 'unconfigured';

  if (req.method === 'GET') {
    sendJson(res, 200, { ok: mode !== 'unconfigured', mode });
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: { message: 'Método no permitido' } });
    return;
  }

  const rl = checkRateLimit(req);
  if (!rl.allowed) {
    sendJson(
      res,
      429,
      { error: { message: 'Demasiados intentos biométricos. Espera unos segundos e intenta de nuevo.' } },
      { 'Retry-After': String(rl.retryAfterSec) },
    );
    return;
  }

  if (!env.supabaseUrl || !env.anonKey) {
    sendJson(res, 500, { error: { message: 'Faltan variables SUPABASE_URL o SUPABASE_ANON_KEY en el servidor' } });
    return;
  }

  let body: Record<string, unknown>;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    sendJson(res, 400, { error: { message: err instanceof Error ? err.message : 'Cuerpo JSON inválido' } });
    return;
  }

  const action = typeof body.action === 'string' ? body.action : '';

  if (action === 'status') {
    sendJson(res, 200, { ok: mode !== 'unconfigured', mode });
    return;
  }

  try {
    // ── ACCIÓN 1: Registro criptográfico de nueva huella/Passkey ─────────────
    if (action === 'register') {
      const authHeader = firstHeader(req.headers, 'authorization');
      const userJwt = authHeader.replace(/^Bearer\s+/i, '').trim();
      if (!userJwt) {
        sendJson(res, 401, { error: { message: 'Sesión requerida para registrar biometría' } });
        return;
      }

      const challengeId = String(body.challengeId ?? '');
      const expectedChallenge = normalizeBase64Url(String(body.expectedChallenge ?? ''));
      const credentialId = normalizeBase64Url(String(body.credentialId ?? ''));
      const publicKeySpki = String(body.publicKeySpki ?? '').trim();
      const algorithm = Number(body.algorithm ?? -7);
      const transports = Array.isArray(body.transports) ? body.transports.map(String) : [];
      const deviceLabel = String(body.deviceLabel ?? 'Dispositivo biométrico');
      const clientDataJSONB64 = String(body.clientDataJSON ?? '');
      const authenticatorDataB64 = String(body.authenticatorData ?? '');
      const vaultPassword = typeof body.vaultPassword === 'string' ? body.vaultPassword : '';
      const userEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const userId = typeof body.userId === 'string' ? body.userId.trim() : '';

      const clientDataBuf = b64UrlToBuffer(clientDataJSONB64);
      const clientData = JSON.parse(clientDataBuf.toString('utf8')) as {
        type?: string;
        challenge?: string;
        origin?: string;
      };
      if (clientData.type !== 'webauthn.create') {
        throw new Error('Ceremonia WebAuthn de registro inválida');
      }
      if (!clientData.challenge || normalizeBase64Url(clientData.challenge) !== expectedChallenge) {
        throw new Error('El reto criptográfico de registro no coincide');
      }
      const hostname = assertValidOrigin(req, clientData.origin ?? '');

      if (authenticatorDataB64) {
        const authDataBuf = b64UrlToBuffer(authenticatorDataB64);
        const parsedAuth = parseAuthenticatorData(authDataBuf);
        if (!verifyRpIdHash(parsedAuth.rpIdHash, hostname)) {
          throw new Error('rpIdHash inválido en el registro');
        }
        if (!parsedAuth.userPresent || !parsedAuth.userVerified) {
          throw new Error('Se requiere verificación biométrica real del usuario (UV)');
        }
      }

      const keyObj = crypto.createPublicKey({
        key: Buffer.from(publicKeySpki, 'base64'),
        format: 'der',
        type: 'spki',
      });
      if (keyObj.type !== 'public') {
        throw new Error('Clave pública inválida');
      }

      let sealedVault: string | null = null;
      if (env.vaultSecret && vaultPassword && userId && userEmail) {
        sealedVault = sealPassword(env.vaultSecret, userId, credentialId, userEmail, vaultPassword);
      }

      // Intentamos firma extendida (con p_sealed_vault en Supabase) y fallback retrocompatible
      let regResult: Record<string, unknown>;
      try {
        regResult = (await callSupabaseRpc(
          env.supabaseUrl,
          env.anonKey,
          'webauthn_complete_register_rpc',
          {
            p_challenge_id: challengeId,
            p_credential_id: credentialId,
            p_public_key_spki: publicKeySpki,
            p_algorithm: algorithm,
            p_transports: transports,
            p_device_label: deviceLabel,
            p_sealed_vault: sealedVault,
          },
          userJwt,
        )) as Record<string, unknown>;
      } catch {
        regResult = (await callSupabaseRpc(
          env.supabaseUrl,
          env.anonKey,
          'webauthn_complete_register_rpc',
          {
            p_challenge_id: challengeId,
            p_credential_id: credentialId,
            p_public_key_spki: publicKeySpki,
            p_algorithm: algorithm,
            p_transports: transports,
            p_device_label: deviceLabel,
          },
          userJwt,
        )) as Record<string, unknown>;
        if (sealedVault) {
          await callSupabaseRpc(
            env.supabaseUrl,
            env.anonKey,
            'webauthn_sync_vault_rpc',
            { p_credential_id: credentialId, p_sealed_vault: sealedVault },
            userJwt,
          ).catch(() => undefined);
        }
      }

      sendJson(res, 200, { ok: true, mode, ...regResult, sealedVault });
      return;
    }

    // ── ACCIÓN 2: Auto-sanación transparente de bóvedas tras login por contraseña ──
    if (action === 'sync-vault') {
      const authHeader = firstHeader(req.headers, 'authorization');
      const userJwt = authHeader.replace(/^Bearer\s+/i, '').trim();
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const password = typeof body.password === 'string' ? body.password : '';
      if (!userJwt || !email || !password || !env.vaultSecret) {
        sendJson(res, 200, { ok: true, synced: 0, vaults: {} });
        return;
      }

      const userRes = await fetch(`${env.supabaseUrl}/auth/v1/user`, {
        method: 'GET',
        headers: { apikey: env.anonKey, Authorization: `Bearer ${userJwt}` },
      });
      if (!userRes.ok) {
        sendJson(res, 401, { error: { message: 'Sesión inválida' } });
        return;
      }
      const userJson = (await userRes.json().catch(() => null)) as { id?: string; email?: string } | null;
      if (!userJson?.id || (userJson.email ?? '').toLowerCase() !== email) {
        sendJson(res, 401, { error: { message: 'Usuario no coincide' } });
        return;
      }

      const listRaw = await callSupabaseRpc(
        env.supabaseUrl,
        env.anonKey,
        'webauthn_list_my_passkeys_rpc',
        {},
        userJwt,
      ).catch(() => []);
      const list = Array.isArray(listRaw) ? (listRaw as Array<{ credential_id?: string }>) : [];
      const vaults: Record<string, string> = {};
      let synced = 0;

      for (const pk of list) {
        const cid = normalizeBase64Url(String(pk.credential_id ?? ''));
        if (!cid) continue;
        const sealed = sealPassword(env.vaultSecret, userJson.id, cid, email, password);
        vaults[cid] = sealed;
        synced += 1;
        await callSupabaseRpc(
          env.supabaseUrl,
          env.anonKey,
          'webauthn_sync_vault_rpc',
          { p_credential_id: cid, p_sealed_vault: sealed },
          userJwt,
        ).catch(() => undefined);
      }

      sendJson(res, 200, { ok: true, synced, vaults });
      return;
    }

    // ── ACCIÓN 3: Verificación criptográfica de login (con correo o Discoverable) ──
    if (action === 'verify-login') {
      const challengeId = String(body.challengeId ?? '');
      const credentialId = normalizeBase64Url(String(body.credentialId ?? ''));
      const clientDataJSONB64 = String(body.clientDataJSON ?? '');
      const authenticatorDataB64 = String(body.authenticatorData ?? '');
      const signatureB64 = String(body.signature ?? '');
      const clientSealedVault = typeof body.sealedVault === 'string' ? body.sealedVault.trim() : '';

      if (!challengeId || !credentialId || !clientDataJSONB64 || !authenticatorDataB64 || !signatureB64) {
        sendJson(res, 400, { error: { message: 'Faltan parámetros criptográficos WebAuthn' } });
        return;
      }

      // 1. Consumir el reto de un solo uso y obtener la clave pública (+ sealedVault en BD si existe)
      const material = (await callSupabaseRpc(env.supabaseUrl, env.anonKey, 'webauthn_consume_login_challenge_rpc', {
        p_challenge_id: challengeId,
        p_credential_id: credentialId,
      })) as {
        challenge: string;
        userId: string;
        email: string;
        publicKeySpki: string;
        algorithm: number;
        signCount: number;
        sealedVault?: string | null;
      };

      // 2. Validar clientDataJSON (type, challenge constante, origin)
      const clientDataBuf = b64UrlToBuffer(clientDataJSONB64);
      const clientData = JSON.parse(clientDataBuf.toString('utf8')) as {
        type?: string;
        challenge?: string;
        origin?: string;
      };
      if (clientData.type !== 'webauthn.get') {
        throw new Error('Tipo de ceremonia WebAuthn inválido');
      }
      const receivedChalBuf = Buffer.from(normalizeBase64Url(clientData.challenge ?? ''), 'utf8');
      const expectedChalBuf = Buffer.from(normalizeBase64Url(material.challenge), 'utf8');
      if (receivedChalBuf.length !== expectedChalBuf.length || !crypto.timingSafeEqual(receivedChalBuf, expectedChalBuf)) {
        throw new Error('El reto firmado no coincide con el reto del servidor');
      }
      const hostname = assertValidOrigin(req, clientData.origin ?? '');

      // 3. Validar authenticatorData (rpIdHash, UP, UV, signCount compatible con Passkeys sincronizadas)
      const authDataBuf = b64UrlToBuffer(authenticatorDataB64);
      const parsedAuth = parseAuthenticatorData(authDataBuf);
      if (!verifyRpIdHash(parsedAuth.rpIdHash, hostname)) {
        throw new Error('El dominio del autenticador (rpIdHash) no coincide');
      }
      if (!parsedAuth.userPresent || !parsedAuth.userVerified) {
        throw new Error('La verificación biométrica del dispositivo no se completó');
      }
      // W3C WebAuthn L3: Passkeys sincronizadas en Android/iOS envían signCount = 0; solo rechazamos retroceso real (>0)
      if (parsedAuth.signCount > 0 && material.signCount > 0 && parsedAuth.signCount <= material.signCount) {
        throw new Error('Alerta de seguridad: contador de firma biométrica inconsistente');
      }

      // 4. Verificación criptográfica REAL de la firma (ECDSA P-256 / RS256)
      const clientDataHash = crypto.createHash('sha256').update(clientDataBuf).digest();
      const signedPayload = Buffer.concat([authDataBuf, clientDataHash]);
      const publicKey = crypto.createPublicKey({
        key: Buffer.from(material.publicKeySpki, 'base64'),
        format: 'der',
        type: 'spki',
      });
      const sigBuf = b64UrlToBuffer(signatureB64);
      const validSignature = crypto.verify('sha256', signedPayload, publicKey, sigBuf);

      if (!validSignature) {
        sendJson(res, 401, {
          error: { message: 'Firma biométrica inválida criptográficamente. Acceso denegado.' },
        });
        return;
      }

      // 5. Registrar nuevo signCount y último uso en BD
      await callSupabaseRpc(env.supabaseUrl, env.anonKey, 'webauthn_commit_login_usage_rpc', {
        p_challenge_id: challengeId,
        p_credential_id: credentialId,
        p_new_sign_count: parsedAuth.signCount,
      });

      // 6A. Modo Admin OTP sin contraseña (Tier 1: SUPABASE_SERVICE_ROLE_KEY)
      if (env.serviceRoleKey) {
        const linkRes = await fetch(`${env.supabaseUrl}/auth/v1/admin/generate_link`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: env.serviceRoleKey,
            Authorization: `Bearer ${env.serviceRoleKey}`,
          },
          body: JSON.stringify({ type: 'magiclink', email: material.email }),
        });
        const linkJson = (await linkRes.json().catch(() => null)) as {
          properties?: { hashed_token?: string };
          hashed_token?: string;
          msg?: string;
        } | null;
        const tokenHash = linkJson?.properties?.hashed_token || linkJson?.hashed_token;
        if (!linkRes.ok || !tokenHash) {
          throw new Error(linkJson?.msg || 'No se pudo emitir el token de sesión biométrica');
        }
        sendJson(res, 200, {
          ok: true,
          mode: 'admin-otp',
          email: material.email,
          tokenHash,
        });
        return;
      }

      // 6B. Modo Bóveda Sellada en servidor (prioriza bóveda en Supabase, respaldo localStorage, multi-secreto)
      const vaultCandidates = [material.sealedVault?.trim() || '', clientSealedVault].filter(Boolean);
      for (const candidateVault of vaultCandidates) {
        const creds = openPasswordWithPool(env.vaultSecrets, material.userId, credentialId, candidateVault);
        if (!creds) continue;
        if (creds.email.trim().toLowerCase() !== material.email.trim().toLowerCase()) continue;

        const authRes = await fetch(`${env.supabaseUrl}/auth/v1/token?grant_type=password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: env.anonKey,
          },
          body: JSON.stringify({ email: material.email, password: creds.password }),
        });
        const sessionJson = (await authRes.json().catch(() => null)) as {
          access_token?: string;
          refresh_token?: string;
          error_description?: string;
          msg?: string;
        } | null;
        if (!authRes.ok || !sessionJson?.access_token || !sessionJson?.refresh_token) {
          sendJson(res, 428, {
            error: {
              code: 'PASSWORD_CHANGED',
              message:
                'Tu contraseña cambió recientemente. Inicia sesión una vez con tu nueva contraseña y tu huella se actualizará automáticamente sin tener que borrarla.',
            },
          });
          return;
        }

        // Re-sellar con el secreto primario actual si veníamos de un secreto legacy
        const refreshedVault = env.vaultSecret
          ? sealPassword(env.vaultSecret, material.userId, credentialId, material.email, creds.password)
          : null;
        if (refreshedVault && refreshedVault !== material.sealedVault) {
          await callSupabaseRpc(
            env.supabaseUrl,
            env.anonKey,
            'webauthn_sync_vault_rpc',
            { p_credential_id: credentialId, p_sealed_vault: refreshedVault },
            sessionJson.access_token,
          ).catch(() => undefined);
        }

        sendJson(res, 200, {
          ok: true,
          mode: 'session',
          email: material.email,
          accessToken: sessionJson.access_token,
          refreshToken: sessionJson.refresh_token,
          ...(refreshedVault ? { refreshedVault, credentialId } : {}),
        });
        return;
      }

      sendJson(res, 428, {
        error: {
          code: 'VAULT_RESYNC_REQUIRED',
          message:
            'Tu huella fue reconocida correctamente, pero requiere una única sincronización segura: inicia sesión una sola vez con tu contraseña y tu huella quedará lista automáticamente (no necesitas borrarla ni volver a crearla).',
        },
      });
      return;
    }

    sendJson(res, 400, { error: { message: 'Acción WebAuthn no reconocida' } });
  } catch (err) {
    sendJson(res, 401, {
      error: { message: err instanceof Error ? err.message : 'Fallo en verificación WebAuthn' },
    });
  }
}
