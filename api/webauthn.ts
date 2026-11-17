import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * 🔐 V19.0 · Verificador Criptográfico WebAuthn / Passkeys (Node.js nativo).
 *
 * - Valida registro (navigator.credentials.create) y firma SPKI pública.
 * - Valida inicio de sesión (navigator.credentials.get) verificando:
 *     1) Reto aleatorio de un solo uso emitido y consumido en Supabase.
 *     2) Origen HTTPS exacto + rpIdHash == SHA-256(rpId).
 *     3) Banderas UP (User Present) y UV (User Verified = Huella/FaceID/PIN real).
 *     4) Monotonicidad de signCount (anti-clonación de autenticador).
 *     5) Firma criptográfica ECDSA P-256 / RS256 con `node:crypto`.
 * - Emite sesión real de Supabase mediante Admin MagicLink OTP (si existe
 *   SUPABASE_SERVICE_ROLE_KEY) o bóveda sellada AES-256-GCM en servidor
 *   (la contraseña jamás regresa al navegador).
 */

const MAX_BODY_BYTES = 64 * 1024;

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

function getEnvConfig() {
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const anonKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const vaultSecret = (
    process.env.WEBAUTHN_VAULT_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    ''
  ).trim();
  return { supabaseUrl, anonKey, serviceRoleKey, vaultSecret };
}

function b64UrlToBuffer(input: string): Buffer {
  const norm = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - (norm.length % 4)) % 4;
  return Buffer.from(norm + '='.repeat(pad), 'base64');
}

function bufferToB64Url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function firstHeader(headers: IncomingMessage['headers'], name: string): string {
  const v = headers[name.toLowerCase()];
  if (Array.isArray(v)) return v[0] ?? '';
  return typeof v === 'string' ? v : '';
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
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !isLocal) {
    throw new Error('WebAuthn requiere conexión segura HTTPS');
  }

  const allowedHosts = new Set<string>();
  const xfh = stripPort(firstHeader(req.headers, 'x-forwarded-host'));
  const host = stripPort(firstHeader(req.headers, 'host'));
  if (xfh) allowedHosts.add(xfh);
  if (host) allowedHosts.add(host);
  if (process.env.VERCEL_URL) allowedHosts.add(stripPort(process.env.VERCEL_URL));
  allowedHosts.add('impacto-tawny.vercel.app');
  allowedHosts.add('tuimpulso.vercel.app');

  if (allowedHosts.size > 0 && !allowedHosts.has(hostname)) {
    throw new Error(`Origen no autorizado para biometría (${hostname})`);
  }
  return hostname;
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
  const key = deriveVaultKey(secret, userId, credentialId);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(`${userId}:${credentialId}`, 'utf8'));
  const plain = Buffer.from(JSON.stringify({ email, password }), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [bufferToB64Url(iv), bufferToB64Url(tag), bufferToB64Url(encrypted)].join('.');
}

function openPassword(secret: string, userId: string, credentialId: string, sealed: string): { email: string; password: string } {
  const parts = sealed.split('.');
  if (parts.length !== 3) throw new Error('Bóveda biométrica inválida');
  const [ivB64, tagB64, encB64] = parts;
  const key = deriveVaultKey(secret, userId, credentialId);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, b64UrlToBuffer(ivB64));
  decipher.setAAD(Buffer.from(`${userId}:${credentialId}`, 'utf8'));
  decipher.setAuthTag(b64UrlToBuffer(tagB64));
  const plain = Buffer.concat([decipher.update(b64UrlToBuffer(encB64)), decipher.final()]).toString('utf8');
  const parsed = JSON.parse(plain) as { email?: unknown; password?: unknown };
  if (typeof parsed.email !== 'string' || typeof parsed.password !== 'string') {
    throw new Error('Bóveda biométrica corrupta');
  }
  return { email: parsed.email, password: parsed.password };
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
    if (action === 'register') {
      const authHeader = firstHeader(req.headers, 'authorization');
      const userJwt = authHeader.replace(/^Bearer\s+/i, '').trim();
      if (!userJwt) {
        sendJson(res, 401, { error: { message: 'Sesión requerida para registrar biometría' } });
        return;
      }

      const challengeId = String(body.challengeId ?? '');
      const expectedChallenge = String(body.expectedChallenge ?? '');
      const credentialId = String(body.credentialId ?? '');
      const publicKeySpki = String(body.publicKeySpki ?? '');
      const algorithm = Number(body.algorithm ?? -7);
      const transports = Array.isArray(body.transports) ? body.transports.map(String) : [];
      const deviceLabel = String(body.deviceLabel ?? 'Dispositivo biométrico');
      const clientDataJSONB64 = String(body.clientDataJSON ?? '');
      const authenticatorDataB64 = String(body.authenticatorData ?? '');
      const vaultPassword = typeof body.vaultPassword === 'string' ? body.vaultPassword : '';
      const userEmail = typeof body.email === 'string' ? body.email : '';
      const userId = typeof body.userId === 'string' ? body.userId : '';

      const clientDataBuf = b64UrlToBuffer(clientDataJSONB64);
      const clientData = JSON.parse(clientDataBuf.toString('utf8')) as {
        type?: string;
        challenge?: string;
        origin?: string;
      };
      if (clientData.type !== 'webauthn.create') {
        throw new Error('Ceremonia WebAuthn de registro inválida');
      }
      if (!clientData.challenge || clientData.challenge !== expectedChallenge) {
        throw new Error('El reto criptográfico de registro no coincide');
      }
      const rpId = assertValidOrigin(req, clientData.origin ?? '');

      if (authenticatorDataB64) {
        const authDataBuf = b64UrlToBuffer(authenticatorDataB64);
        const parsedAuth = parseAuthenticatorData(authDataBuf);
        const expectedRpHash = crypto.createHash('sha256').update(rpId, 'utf8').digest();
        if (!crypto.timingSafeEqual(parsedAuth.rpIdHash, expectedRpHash)) {
          throw new Error('rpIdHash inválido en el registro');
        }
        if (!parsedAuth.userPresent || !parsedAuth.userVerified) {
          throw new Error('Se requiere verificación biométrica real del usuario (UV)');
        }
      }

      // Valida que la clave pública SPKI DER sea criptográficamente legítima antes de persistir
      const keyObj = crypto.createPublicKey({
        key: Buffer.from(publicKeySpki, 'base64'),
        format: 'der',
        type: 'spki',
      });
      if (keyObj.type !== 'public') {
        throw new Error('Clave pública inválida');
      }

      const regResult = (await callSupabaseRpc(
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

      let sealedVault: string | null = null;
      if (!env.serviceRoleKey && env.vaultSecret && vaultPassword && userId && userEmail) {
        sealedVault = sealPassword(env.vaultSecret, userId, credentialId, userEmail, vaultPassword);
      }

      sendJson(res, 200, { ok: true, mode, ...regResult, sealedVault });
      return;
    }

    if (action === 'verify-login') {
      const challengeId = String(body.challengeId ?? '');
      const credentialId = String(body.credentialId ?? '');
      const clientDataJSONB64 = String(body.clientDataJSON ?? '');
      const authenticatorDataB64 = String(body.authenticatorData ?? '');
      const signatureB64 = String(body.signature ?? '');
      const sealedVault = typeof body.sealedVault === 'string' ? body.sealedVault : '';

      if (!challengeId || !credentialId || !clientDataJSONB64 || !authenticatorDataB64 || !signatureB64) {
        sendJson(res, 400, { error: { message: 'Faltan parámetros criptográficos WebAuthn' } });
        return;
      }

      // 1. Consumir el reto de un solo uso y obtener la clave pública almacenada en BD
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
      const receivedChalBuf = Buffer.from(clientData.challenge ?? '', 'utf8');
      const expectedChalBuf = Buffer.from(material.challenge, 'utf8');
      if (receivedChalBuf.length !== expectedChalBuf.length || !crypto.timingSafeEqual(receivedChalBuf, expectedChalBuf)) {
        throw new Error('El reto firmado no coincide con el reto del servidor');
      }
      const rpId = assertValidOrigin(req, clientData.origin ?? '');

      // 3. Validar authenticatorData (rpIdHash, UP, UV, signCount anti-clonación)
      const authDataBuf = b64UrlToBuffer(authenticatorDataB64);
      const parsedAuth = parseAuthenticatorData(authDataBuf);
      const expectedRpHash = crypto.createHash('sha256').update(rpId, 'utf8').digest();
      if (!crypto.timingSafeEqual(parsedAuth.rpIdHash, expectedRpHash)) {
        throw new Error('El dominio del autenticador (rpIdHash) no coincide');
      }
      if (!parsedAuth.userPresent || !parsedAuth.userVerified) {
        throw new Error('La verificación biométrica del dispositivo (User Verification) no se completó');
      }
      if (material.signCount > 0 && parsedAuth.signCount <= material.signCount) {
        throw new Error('Alerta de seguridad: posible credencial clonada (signCount inválido)');
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

      // 6A. Modo Admin OTP sin contraseña (si SUPABASE_SERVICE_ROLE_KEY está configurada)
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

      // 6B. Modo Bóveda Sellada en servidor (solo tras firma criptográfica válida)
      if (env.vaultSecret && sealedVault) {
        const creds = openPassword(env.vaultSecret, material.userId, credentialId, sealedVault);
        if (creds.email.trim().toLowerCase() !== material.email.trim().toLowerCase()) {
          throw new Error('Credencial biométrica no corresponde a esta cuenta');
        }
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
          throw new Error(
            sessionJson?.error_description ||
              sessionJson?.msg ||
              'La contraseña de la cuenta cambió. Inicia sesión con tu contraseña y re-vincula este dispositivo.',
          );
        }
        sendJson(res, 200, {
          ok: true,
          mode: 'session',
          accessToken: sessionJson.access_token,
          refreshToken: sessionJson.refresh_token,
        });
        return;
      }

      sendJson(res, 428, {
        error: {
          message:
            'Firma biométrica verificada, pero este dispositivo no tiene bóveda local ni SUPABASE_SERVICE_ROLE_KEY en el servidor. Inicia sesión con tu contraseña y vuelve a registrar este dispositivo.',
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
