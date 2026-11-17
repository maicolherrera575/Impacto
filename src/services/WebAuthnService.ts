import { supabase } from './supabase';

/**
 * 🔐 V19.0 · WebAuthnService — Autenticación Biométrica Criptográfica Real (Passkeys).
 *
 * - Registro: `navigator.credentials.create()` genera un par de claves ligado al hardware
 *   (Huella / FaceID / Windows Hello) y guarda la clave pública SPKI en `auth.user_passkeys`.
 * - Login: `navigator.credentials.get()` firma un reto aleatorio emitido por el servidor;
 *   `/api/webauthn` verifica la firma criptográficamente antes de conceder sesión.
 * - Si el usuario cambia de celular, este dispositivo no tendrá la llave privada vinculada
 *   y deberá iniciar sesión con contraseña para registrar el nuevo dispositivo.
 */

export interface PasskeyDevice {
  id: string;
  credential_id: string;
  device_label: string;
  algorithm: number;
  created_at: string;
  last_used_at: string | null;
}

export type WebAuthnServerMode = 'admin-otp' | 'sealed-vault' | 'unconfigured';

const VAULT_STORAGE_PREFIX = 'impulso_pk_vault_v1:';

// ── Utilidades Base64 / Base64URL ──────────────────────────────────────────

function bufferToBase64Url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function bufferToBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}

function base64UrlToUint8Array(input: string): Uint8Array {
  const norm = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - (norm.length % 4)) % 4;
  const bin = atob(norm + '='.repeat(pad));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

// ── Decodificador mínimo CBOR / COSE (respaldo si falta getPublicKey()) ───

function readCbor(bytes: Uint8Array, offset: number): { value: unknown; next: number } {
  const head = bytes[offset];
  if (head === undefined) throw new Error('CBOR truncado');
  const major = head >> 5;
  const info = head & 0x1f;
  let pos = offset + 1;

  const readUint = (): number => {
    if (info < 24) return info;
    if (info === 24) {
      const v = bytes[pos];
      pos += 1;
      return v;
    }
    if (info === 25) {
      const v = (bytes[pos] << 8) | bytes[pos + 1];
      pos += 2;
      return v;
    }
    if (info === 26) {
      const v = ((bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3]) >>> 0;
      pos += 4;
      return v;
    }
    throw new Error('Longitud CBOR no soportada');
  };

  if (major === 0) return { value: readUint(), next: pos };
  if (major === 1) return { value: -1 - readUint(), next: pos };
  if (major === 2) {
    const len = readUint();
    const slice = bytes.slice(pos, pos + len);
    return { value: slice, next: pos + len };
  }
  if (major === 3) {
    const len = readUint();
    const slice = bytes.slice(pos, pos + len);
    return { value: new TextDecoder().decode(slice), next: pos + len };
  }
  if (major === 4) {
    const len = readUint();
    const arr: unknown[] = [];
    for (let i = 0; i < len; i += 1) {
      const item = readCbor(bytes, pos);
      arr.push(item.value);
      pos = item.next;
    }
    return { value: arr, next: pos };
  }
  if (major === 5) {
    const len = readUint();
    const map = new Map<unknown, unknown>();
    for (let i = 0; i < len; i += 1) {
      const k = readCbor(bytes, pos);
      const v = readCbor(bytes, k.next);
      map.set(k.value, v.value);
      pos = v.next;
    }
    return { value: map, next: pos };
  }
  throw new Error('Tipo CBOR no soportado');
}

function ec2P256ToSpkiBase64(x: Uint8Array, y: Uint8Array): string {
  if (x.length !== 32 || y.length !== 32) {
    throw new Error('Coordenadas EC P-256 inválidas');
  }
  // Cabecera ASN.1 DER SPKI fija para id-ecPublicKey + prime256v1 (26 bytes) + 0x04 || X || Y (65 bytes)
  const spkiPrefix = new Uint8Array([
    0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a,
    0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03, 0x42, 0x00, 0x04,
  ]);
  const full = new Uint8Array(spkiPrefix.length + 64);
  full.set(spkiPrefix, 0);
  full.set(x, spkiPrefix.length);
  full.set(y, spkiPrefix.length + 32);
  return bufferToBase64(full);
}

function extractAuthDataFromAttestation(attestationObject: ArrayBuffer): {
  authData: Uint8Array;
  fallbackSpkiBase64: string | null;
  fallbackAlg: number;
} {
  const { value } = readCbor(new Uint8Array(attestationObject), 0);
  if (!(value instanceof Map)) throw new Error('attestationObject inválido');
  const authData = value.get('authData');
  if (!(authData instanceof Uint8Array) || authData.length < 55) {
    throw new Error('authData ausente en attestationObject');
  }
  const flags = authData[32] ?? 0;
  const hasAttestedCred = (flags & 0x40) !== 0;
  if (!hasAttestedCred) {
    return { authData, fallbackSpkiBase64: null, fallbackAlg: -7 };
  }
  const credIdLen = (authData[53] << 8) | authData[54];
  const coseOffset = 55 + credIdLen;
  const coseRes = readCbor(authData, coseOffset);
  if (!(coseRes.value instanceof Map)) {
    return { authData, fallbackSpkiBase64: null, fallbackAlg: -7 };
  }
  const alg = Number(coseRes.value.get(3) ?? -7);
  const kty = Number(coseRes.value.get(1) ?? 0);
  if (kty === 2 && alg === -7) {
    const x = coseRes.value.get(-2);
    const y = coseRes.value.get(-3);
    if (x instanceof Uint8Array && y instanceof Uint8Array) {
      return { authData, fallbackSpkiBase64: ec2P256ToSpkiBase64(x, y), fallbackAlg: -7 };
    }
  }
  return { authData, fallbackSpkiBase64: null, fallbackAlg: alg };
}

// ── Detección de capacidades y utilidades de dispositivo ───────────────────

export function isWebAuthnSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof navigator.credentials?.create === 'function' &&
    typeof navigator.credentials?.get === 'function'
  );
}

export async function isPlatformAuthenticatorReady(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  try {
    if (typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }
    return true;
  } catch {
    return false;
  }
}

export function detectDeviceLabel(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  if (/iPhone/i.test(ua)) return 'iPhone (FaceID / TouchID)';
  if (/iPad/i.test(ua)) return 'iPad (FaceID / TouchID)';
  if (/Android/i.test(ua)) return 'Android (Huella / Biometría)';
  if (/Windows/i.test(ua)) return 'Windows (Windows Hello)';
  if (/Macintosh|Mac OS/i.test(ua)) return 'Mac (TouchID)';
  return 'Dispositivo biométrico';
}

export async function getWebAuthnServerMode(): Promise<WebAuthnServerMode> {
  try {
    const res = await fetch('/api/webauthn', { method: 'GET', cache: 'no-store' });
    if (!res.ok) return 'unconfigured';
    const json = (await res.json().catch(() => null)) as { mode?: WebAuthnServerMode } | null;
    return json?.mode ?? 'unconfigured';
  } catch {
    return 'unconfigured';
  }
}

// ── Gestión de llaves del comerciante autenticado ──────────────────────────

export async function listMyPasskeys(): Promise<PasskeyDevice[]> {
  const { data, error } = await supabase.rpc('webauthn_list_my_passkeys_rpc');
  if (error) throw error;
  return Array.isArray(data) ? (data as unknown as PasskeyDevice[]) : [];
}

export async function revokePasskey(passkeyId: string, credentialId?: string): Promise<void> {
  const { error } = await supabase.rpc('webauthn_revoke_passkey_rpc', { p_passkey_id: passkeyId });
  if (error) throw error;
  if (credentialId) {
    try {
      localStorage.removeItem(`${VAULT_STORAGE_PREFIX}${credentialId}`);
    } catch {
      /* almacenamiento no disponible */
    }
  }
}

export interface PasskeyBeginRegisterData {
  challengeId: string;
  challenge: string;
  userId: string;
  email: string;
  businessName: string;
  excludeCredentialIds: string[];
}

export interface PreparedPasskeyEnrollment {
  accessToken: string;
  email: string;
  vaultPassword: string;
  hasPlatformAuthenticator: boolean;
  begin: PasskeyBeginRegisterData;
}

export const PASSKEY_LINKED_SUCCESS_MSG =
  'Huella vinculada exitosamente a este dispositivo. Si cambias de equipo, inicia sesión con tu contraseña para vincular el nuevo.';

export const WEBAUTHN_CANCELLED_MSG = 'Autenticación cancelada. Puedes seguir usando tu contraseña.';

// ── Validación de contraseña previa + registro WebAuthn (navigator.credentials.create) ───

/**
 * 1) Valida la contraseña actual contra Supabase (`signInWithPassword`) ANTES de
 *    pedir la biometría al hardware y genera el reto en el servidor.
 */
export async function verifyPasswordAndPreparePasskey(
  currentPassword: string,
): Promise<PreparedPasskeyEnrollment> {
  if (!isWebAuthnSupported()) {
    throw new Error('Este navegador o conexión no soporta biometría WebAuthn (requiere HTTPS).');
  }
  if (!currentPassword || currentPassword.length < 6) {
    throw new Error('Escribe tu contraseña actual (mínimo 6 caracteres) para validar tu identidad.');
  }

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  const userEmail = userData.user?.email?.trim().toLowerCase();
  if (userErr || !userEmail) {
    throw new Error('Debes iniciar sesión primero para activar la biometría.');
  }

  const { data: authData, error: pwdErr } = await supabase.auth.signInWithPassword({
    email: userEmail,
    password: currentPassword,
  });
  if (pwdErr || !authData.session?.access_token) {
    throw new Error('Contraseña incorrecta. Verifica tu clave actual antes de vincular tu huella.');
  }

  const [{ data: beginRaw, error: beginErr }, hasPlatformAuthenticator] = await Promise.all([
    supabase.rpc('webauthn_begin_register_rpc'),
    isPlatformAuthenticatorReady(),
  ]);
  if (beginErr) throw beginErr;

  return {
    accessToken: authData.session.access_token,
    email: userEmail,
    vaultPassword: currentPassword,
    hasPlatformAuthenticator,
    begin: beginRaw as unknown as PasskeyBeginRegisterData,
  };
}

/**
 * 2) Dispara `navigator.credentials.create()` con un reto ya autorizado y
 *    registra la clave pública en el servidor (`/api/webauthn`).
 */
export async function completePreparedPasskeyEnrollment(
  prepared: PreparedPasskeyEnrollment,
  options?: { deviceLabel?: string },
): Promise<{ id: string; credentialId: string; deviceLabel: string }> {
  const { begin, accessToken, vaultPassword, hasPlatformAuthenticator } = prepared;
  const rpId = window.location.hostname;
  const userIdBytes = new TextEncoder().encode(begin.userId);

  let cred: Credential | null;
  try {
    cred = await navigator.credentials.create({
      publicKey: {
        challenge: toArrayBuffer(base64UrlToUint8Array(begin.challenge)),
        rp: {
          name: 'Impulso',
          id: rpId,
        },
        user: {
          id: toArrayBuffer(userIdBytes),
          name: begin.email || begin.businessName,
          displayName: begin.businessName || begin.email,
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256 (ECDSA P-256)
          { type: 'public-key', alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          ...(hasPlatformAuthenticator ? { authenticatorAttachment: 'platform' as const } : {}),
          residentKey: 'preferred',
          userVerification: 'required',
        },
        timeout: 60_000,
        attestation: 'none',
        excludeCredentials: (begin.excludeCredentialIds ?? []).map((id) => ({
          type: 'public-key' as const,
          id: toArrayBuffer(base64UrlToUint8Array(id)),
        })),
      },
    });
  } catch (err) {
    if (err instanceof DOMException) {
      if (err.name === 'NotAllowedError') {
        throw new Error('GESTURE_OR_CANCELLED');
      }
      if (err.name === 'InvalidStateError') {
        throw new Error('Este dispositivo ya tiene registrada una llave biométrica para tu cuenta.');
      }
    }
    throw err;
  }

  if (!(cred instanceof PublicKeyCredential)) {
    throw new Error('No se recibió credencial biométrica del dispositivo.');
  }

  const response = cred.response as AuthenticatorAttestationResponse;
  const credentialId = bufferToBase64Url(cred.rawId);
  const transports = typeof response.getTransports === 'function' ? response.getTransports() : ['internal'];

  const extracted = extractAuthDataFromAttestation(response.attestationObject);
  const nativeSpki = typeof response.getPublicKey === 'function' ? response.getPublicKey() : null;
  const nativeAlg = typeof response.getPublicKeyAlgorithm === 'function' ? response.getPublicKeyAlgorithm() : null;

  const publicKeySpki = nativeSpki ? bufferToBase64(nativeSpki) : extracted.fallbackSpkiBase64;
  const algorithm = nativeAlg ?? extracted.fallbackAlg;

  if (!publicKeySpki) {
    throw new Error('No se pudo extraer la clave pública criptográfica del dispositivo.');
  }

  const verifyRes = await fetch('/api/webauthn', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      action: 'register',
      challengeId: begin.challengeId,
      expectedChallenge: begin.challenge,
      credentialId,
      publicKeySpki,
      algorithm,
      transports,
      deviceLabel: options?.deviceLabel || detectDeviceLabel(),
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
      authenticatorData: bufferToBase64Url(extracted.authData),
      vaultPassword,
      email: begin.email,
      userId: begin.userId,
    }),
  });

  const payload = (await verifyRes.json().catch(() => null)) as {
    ok?: boolean;
    id?: string;
    credentialId?: string;
    deviceLabel?: string;
    sealedVault?: string | null;
    error?: { message?: string };
  } | null;

  if (!verifyRes.ok || !payload?.ok) {
    throw new Error(payload?.error?.message || 'No se pudo validar el registro biométrico en el servidor.');
  }

  if (payload.sealedVault) {
    try {
      localStorage.setItem(`${VAULT_STORAGE_PREFIX}${credentialId}`, payload.sealedVault);
    } catch {
      /* almacenamiento bloqueado */
    }
  }

  return {
    id: String(payload.id ?? ''),
    credentialId: String(payload.credentialId ?? credentialId),
    deviceLabel: String(payload.deviceLabel ?? detectDeviceLabel()),
  };
}

export async function registerDevicePasskey(options: {
  password: string;
  deviceLabel?: string;
}): Promise<{ id: string; credentialId: string; deviceLabel: string }> {
  const prepared = await verifyPasswordAndPreparePasskey(options.password);
  try {
    return await completePreparedPasskeyEnrollment(prepared, { deviceLabel: options.deviceLabel });
  } catch (err) {
    if (err instanceof Error && err.message === 'GESTURE_OR_CANCELLED') {
      throw new Error('Registro biométrico cancelado o sin verificación en el dispositivo.');
    }
    throw err;
  }
}

// ── Inicio de Sesión criptográfico (navigator.credentials.get) ─────────────

export async function authenticateWithPasskey(email: string): Promise<void> {
  if (!isWebAuthnSupported()) {
    throw new Error('Este navegador o conexión no soporta biometría WebAuthn (requiere HTTPS).');
  }

  const cleanEmail = email.trim().toLowerCase();
  if (!/.+@.+\..+/.test(cleanEmail)) {
    throw new Error('Escribe tu correo para validar tu huella / FaceID.');
  }

  // 1. Solicitar reto aleatorio + lista de credenciales registradas al servidor
  const { data: beginRaw, error: beginErr } = await supabase.rpc('webauthn_begin_login_rpc', {
    p_email: cleanEmail,
  });
  if (beginErr) throw beginErr;

  const begin = beginRaw as unknown as {
    challengeId: string;
    challenge: string;
    allowCredentials: Array<{ id: string; transports?: string[] }>;
  };

  if (!begin.allowCredentials || begin.allowCredentials.length === 0) {
    throw new Error(
      'Esta cuenta no tiene dispositivos biométricos registrados. Entra con tu contraseña y activa la biometría en tu panel.',
    );
  }

  const rpId = window.location.hostname;

  // 2. Firma criptográfica hardware del reto con FaceID / Huella / Windows Hello
  let assertion: Credential | null;
  try {
    assertion = await navigator.credentials.get({
      publicKey: {
        challenge: toArrayBuffer(base64UrlToUint8Array(begin.challenge)),
        rpId,
        allowCredentials: begin.allowCredentials.map((c) => ({
          type: 'public-key' as const,
          id: toArrayBuffer(base64UrlToUint8Array(c.id)),
          ...(Array.isArray(c.transports) && c.transports.length > 0
            ? { transports: c.transports as AuthenticatorTransport[] }
            : {}),
        })),
        userVerification: 'required',
        timeout: 60_000,
      },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'NotAllowedError') {
      throw new Error(WEBAUTHN_CANCELLED_MSG);
    }
    throw err;
  }

  if (!(assertion instanceof PublicKeyCredential)) {
    throw new Error('No se recibió firma biométrica del dispositivo.');
  }

  const res = assertion.response as AuthenticatorAssertionResponse;
  const credentialId = bufferToBase64Url(assertion.rawId);

  let sealedVault: string | null = null;
  try {
    sealedVault = localStorage.getItem(`${VAULT_STORAGE_PREFIX}${credentialId}`);
  } catch {
    sealedVault = null;
  }

  // 3. Verificación criptográfica estricta en el servidor (/api/webauthn)
  const verifyRes = await fetch('/api/webauthn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'verify-login',
      email: cleanEmail,
      challengeId: begin.challengeId,
      credentialId,
      clientDataJSON: bufferToBase64Url(res.clientDataJSON),
      authenticatorData: bufferToBase64Url(res.authenticatorData),
      signature: bufferToBase64Url(res.signature),
      ...(sealedVault ? { sealedVault } : {}),
    }),
  });

  const payload = (await verifyRes.json().catch(() => null)) as {
    ok?: boolean;
    mode?: 'admin-otp' | 'session';
    tokenHash?: string;
    accessToken?: string;
    refreshToken?: string;
    error?: { message?: string };
  } | null;

  if (!verifyRes.ok || !payload?.ok) {
    throw new Error(payload?.error?.message || 'Firma biométrica inválida. Inicia sesión con tu contraseña.');
  }

  // 4. Emitir sesión real de Supabase Auth (solo tras validación criptográfica en servidor)
  if (payload.mode === 'admin-otp' && payload.tokenHash) {
    const { error: otpErr } = await supabase.auth.verifyOtp({
      token_hash: payload.tokenHash,
      type: 'magiclink',
    });
    if (otpErr) throw otpErr;
    return;
  }

  if (payload.mode === 'session' && payload.accessToken && payload.refreshToken) {
    const { error: sessErr } = await supabase.auth.setSession({
      access_token: payload.accessToken,
      refresh_token: payload.refreshToken,
    });
    if (sessErr) throw sessErr;
    return;
  }

  throw new Error('No se pudo establecer la sesión biométrica. Intenta de nuevo o entra con tu contraseña.');
}
