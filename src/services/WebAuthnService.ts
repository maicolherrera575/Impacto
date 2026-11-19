import { supabase } from './supabase';
import { getDeviceId } from './deviceFingerprint';

/**
 * 🔐 V36.0 · WebAuthnService — Reparación de Raíz de Autenticación Biométrica (Passkeys).
 *
 * - Normalización Base64URL estricta (sin padding `=`) de `credentialId` entre registro,
 *   consulta de `allowCredentials` y verificación en servidor.
 * - Soporta login Discoverable (sin escribir correo) Y con correo opcional (sin restringir `transports`).
 * - Elimina fragilidad de `localStorage`: la bóveda AES-256-GCM persiste en Supabase y
 *   `syncPasskeyVaultsOnPasswordLogin()` la re-sella transparentemente al entrar con contraseña.
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
const WEBAUTHN_CEREMONY_TIMEOUT_MS = 180_000;

/** 🔒 V37.0 · Mutexes de ceremonia: impiden llamadas solapadas que abortan caBLE en Android. */
let activeLoginPromise: Promise<void> | null = null;
let activeRegisterPromise: Promise<{ id: string; credentialId: string; deviceLabel: string }> | null = null;

async function hasActiveSupabaseSession(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    return Boolean(data.session?.user?.id);
  } catch {
    return false;
  }
}

// ── Utilidades Base64 / Base64URL ──────────────────────────────────────────

function normalizeBase64Url(input: string): string {
  return input.trim().replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

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
  begin: PasskeyBeginRegisterData;
}

export const PASSKEY_LINKED_SUCCESS_MSG =
  'Huella vinculada exitosamente a este dispositivo. Si cambias de equipo, inicia sesión con tu contraseña para vincular el nuevo.';

export const WEBAUTHN_CANCELLED_MSG = 'Autenticación cancelada. Puedes seguir usando tu contraseña.';

export const WEBAUTHN_CROSS_DEVICE_MSG =
  'No se encontró la llave de acceso en este dispositivo. Si registraste la huella en otro equipo, por favor inicia sesión con tu contraseña o asegúrate de usar la misma cuenta de Google/Apple para sincronizar las llaves.';

// ── Validación de contraseña previa + registro WebAuthn (navigator.credentials.create) ───

/**
 * 1) Valida la contraseña actual contra Supabase (`signInWithPassword`) ANTES de
 *    pedir la biometría al hardware y genera el reto en el servidor.
 */
export async function verifyPasswordAndPreparePasskey(
  currentPassword: string,
): Promise<PreparedPasskeyEnrollment> {
  if (!isWebAuthnSupported()) {
    throw new Error('Este navegador o conexión no soporta desbloqueo biométrico seguro (requiere conexión cifrada HTTPS).');
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

  const { data: beginRaw, error: beginErr } = await supabase.rpc('webauthn_begin_register_rpc');
  if (beginErr) throw beginErr;

  return {
    accessToken: authData.session.access_token,
    email: userEmail,
    vaultPassword: currentPassword,
    begin: beginRaw as unknown as PasskeyBeginRegisterData,
  };
}

/**
 * 2) Dispara `navigator.credentials.create()` con un reto ya autorizado y
 *    registra la clave pública en el servidor (`/api/webauthn`).
 *    Omite `authenticatorAttachment` para permitir llaves sincronizadas (Google/Apple)
 *    y roaming cross-device móvil -> PC.
 */
export async function completePreparedPasskeyEnrollment(
  prepared: PreparedPasskeyEnrollment,
  options?: { deviceLabel?: string },
): Promise<{ id: string; credentialId: string; deviceLabel: string }> {
  if (activeRegisterPromise) return activeRegisterPromise;
  const run = completePreparedPasskeyEnrollmentInternal(prepared, options).finally(() => {
    activeRegisterPromise = null;
  });
  activeRegisterPromise = run;
  return run;
}

async function completePreparedPasskeyEnrollmentInternal(
  prepared: PreparedPasskeyEnrollment,
  options?: { deviceLabel?: string },
): Promise<{ id: string; credentialId: string; deviceLabel: string }> {
  const { begin, accessToken, vaultPassword } = prepared;
  const rpId = window.location.hostname;
  const stableUserId = begin.userId.trim().toLowerCase();
  if (!stableUserId) {
    throw new Error('No se encontró identificador constante de usuario para registrar la llave.');
  }
  const userIdBytes = new TextEncoder().encode(stableUserId);

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
          name: (begin.email || begin.businessName).trim().toLowerCase(),
          displayName: begin.businessName || begin.email,
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256 (ECDSA P-256)
          { type: 'public-key', alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          // Omitimos authenticatorAttachment para habilitar sincronización en la nube (Google/Apple) y roaming cross-device
          residentKey: 'required',
          requireResidentKey: true,
          userVerification: 'required',
        },
        timeout: WEBAUTHN_CEREMONY_TIMEOUT_MS,
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
      if (err.name === 'SecurityError' || err.name === 'NotSupportedError') {
        throw new Error(
          'Tu navegador actual bloqueó el guardado de la huella. Abre la app directamente en Chrome o Safari (no dentro de WhatsApp/Instagram) e intenta de nuevo.',
        );
      }
    }
    throw err;
  }

  if (!(cred instanceof PublicKeyCredential)) {
    throw new Error('No se recibió credencial biométrica del dispositivo.');
  }

  const response = cred.response as AuthenticatorAttestationResponse;
  const credentialId = bufferToBase64Url(cred.rawId);
  const rawTransports = typeof response.getTransports === 'function' ? response.getTransports() : ['internal', 'hybrid'];
  const transports = Array.from(new Set(rawTransports));

  const extracted = extractAuthDataFromAttestation(response.attestationObject);
  const nativeSpki = typeof response.getPublicKey === 'function' ? response.getPublicKey() : null;
  const nativeAlg = typeof response.getPublicKeyAlgorithm === 'function' ? response.getPublicKeyAlgorithm() : null;

  const publicKeySpki = nativeSpki ? bufferToBase64(nativeSpki) : extracted.fallbackSpkiBase64;
  const algorithm = nativeAlg ?? extracted.fallbackAlg;

  if (!publicKeySpki) {
    throw new Error('No se pudo vincular la llave de seguridad en este dispositivo.');
  }

  const verifyRes = await fetch('/api/webauthn', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'X-Device-Fingerprint': getDeviceId(),
    },
    body: JSON.stringify({
      action: 'register',
      challengeId: begin.challengeId,
      expectedChallenge: normalizeBase64Url(begin.challenge),
      credentialId: normalizeBase64Url(credentialId),
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

  const finalCredId = normalizeBase64Url(String(payload.credentialId ?? credentialId));
  if (payload.sealedVault) {
    try {
      localStorage.setItem(`${VAULT_STORAGE_PREFIX}${finalCredId}`, payload.sealedVault);
    } catch {
      /* almacenamiento bloqueado */
    }
  }

  return {
    id: String(payload.id ?? ''),
    credentialId: finalCredId,
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

/**
 * 🔄 V36.0 · Auto-sanación silenciosa de bóvedas biométricas al iniciar sesión con contraseña:
 * Si el usuario ya tenía su huella vinculada (en este celular o sincronizada) y cambió su clave
 * o borró caché local, esta llamada re-sella silenciosamente todas sus llaves en Supabase +
 * localStorage sin pedirle jamás que borre ni recree su huella manualmente.
 */
export async function syncPasskeyVaultsOnPasswordLogin(email: string, password: string): Promise<void> {
  if (!isWebAuthnSupported() || !email.trim() || password.length < 6) return;
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    const res = await fetch('/api/webauthn', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Device-Fingerprint': getDeviceId(),
      },
      body: JSON.stringify({
        action: 'sync-vault',
        email: email.trim().toLowerCase(),
        password,
      }),
    });
    if (!res.ok) return;
    const json = (await res.json().catch(() => null)) as { vaults?: Record<string, string> } | null;
    if (json?.vaults && typeof json.vaults === 'object') {
      for (const [cid, sealed] of Object.entries(json.vaults)) {
        if (cid && sealed) {
          try {
            localStorage.setItem(`${VAULT_STORAGE_PREFIX}${normalizeBase64Url(cid)}`, sealed);
          } catch {
            /* continuar */
          }
        }
      }
    }
  } catch {
    /* silencioso: jamás bloquea el acceso con contraseña */
  }
}

// ── Inicio de Sesión criptográfico (navigator.credentials.get) ─────────────

export async function authenticateWithPasskey(email?: string): Promise<void> {
  // Si ya hay sesión activa (ej: ceremonia recién completada o sincronizada), salir en éxito silencioso
  if (await hasActiveSupabaseSession()) return;
  // Evita ceremonias duplicadas simultáneas (causa raíz del error caBLE en Android tras entrar)
  if (activeLoginPromise) return activeLoginPromise;

  const run = authenticateWithPasskeyInternal(email).finally(() => {
    activeLoginPromise = null;
  });
  activeLoginPromise = run;
  return run;
}

async function authenticateWithPasskeyInternal(email?: string): Promise<void> {
  if (!isWebAuthnSupported()) {
    throw new Error('Este navegador o conexión no soporta desbloqueo biométrico seguro (requiere conexión cifrada HTTPS).');
  }

  const cleanEmail = (email ?? '').trim().toLowerCase();
  const hasValidEmail = /.+@.+\..+/.test(cleanEmail);

  // 1. Solicitar reto aleatorio: con allowCredentials si escribió correo, o Discoverable si está vacío
  let begin: {
    challengeId: string;
    challenge: string;
    allowCredentials: Array<{ id: string; transports?: string[] }>;
  };

  if (hasValidEmail) {
    const { data: beginRaw, error: beginErr } = await supabase.rpc('webauthn_begin_login_rpc', {
      p_email: cleanEmail,
    });
    if (beginErr) throw beginErr;
    begin = beginRaw as unknown as typeof begin;
    if (!begin.allowCredentials || begin.allowCredentials.length === 0) {
      throw new Error(WEBAUTHN_CROSS_DEVICE_MSG);
    }
  } else {
    const { data: beginRaw, error: beginErr } = await supabase.rpc('webauthn_begin_discoverable_login_rpc');
    if (beginErr) {
      throw new Error('Escribe tu correo para validar tu huella / FaceID.');
    }
    begin = beginRaw as unknown as typeof begin;
  }

  const rpId = window.location.hostname;

  // 2. Firma criptográfica hardware del reto (timeout amplio de 180s para flujo cross-device QR/Bluetooth)
  let assertion: Credential | null;
  try {
    const publicKeyOptions: PublicKeyCredentialRequestOptions = {
      challenge: toArrayBuffer(base64UrlToUint8Array(normalizeBase64Url(begin.challenge))),
      rpId,
      userVerification: 'required',
      timeout: WEBAUTHN_CEREMONY_TIMEOUT_MS,
    };
    if (hasValidEmail && begin.allowCredentials.length > 0) {
      publicKeyOptions.allowCredentials = begin.allowCredentials.map((c) => ({
        type: 'public-key' as const,
        id: toArrayBuffer(base64UrlToUint8Array(normalizeBase64Url(c.id))),
      }));
    }
    assertion = await navigator.credentials.get({ publicKey: publicKeyOptions });
  } catch (err) {
    // Si la sesión ya quedó autenticada en paralelo, JAMÁS mostrar error contradictorio
    if (await hasActiveSupabaseSession()) return;
    if (err instanceof DOMException) {
      if (err.name === 'NotAllowedError') {
        throw new Error('Verificación biométrica cancelada o sin llave registrada en este equipo.');
      }
      throw new Error(WEBAUTHN_CROSS_DEVICE_MSG);
    }
    throw err;
  }

  if (!(assertion instanceof PublicKeyCredential)) {
    if (await hasActiveSupabaseSession()) return;
    throw new Error(WEBAUTHN_CROSS_DEVICE_MSG);
  }

  const res = assertion.response as AuthenticatorAssertionResponse;
  const credentialId = normalizeBase64Url(bufferToBase64Url(assertion.rawId));

  let sealedVault: string | null = null;
  try {
    sealedVault = localStorage.getItem(`${VAULT_STORAGE_PREFIX}${credentialId}`);
  } catch {
    sealedVault = null;
  }

  // 3. Verificación criptográfica estricta en el servidor (/api/webauthn)
  const verifyRes = await fetch('/api/webauthn', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Fingerprint': getDeviceId(),
    },
    body: JSON.stringify({
      action: 'verify-login',
      ...(hasValidEmail ? { email: cleanEmail } : {}),
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
    refreshedVault?: string;
    credentialId?: string;
    error?: { code?: string; message?: string };
  } | null;

  if (!verifyRes.ok || !payload?.ok) {
    if (await hasActiveSupabaseSession()) return;
    throw new Error(payload?.error?.message || 'No se pudo validar tu huella. Inicia sesión con tu contraseña.');
  }

  if (payload.refreshedVault) {
    try {
      localStorage.setItem(`${VAULT_STORAGE_PREFIX}${normalizeBase64Url(payload.credentialId || credentialId)}`, payload.refreshedVault);
    } catch {
      /* continuar */
    }
  }

  // 4. Emitir sesión real de Supabase Auth (solo tras validación criptográfica en servidor)
  if (payload.mode === 'admin-otp' && payload.tokenHash) {
    const { error: otpErr } = await supabase.auth.verifyOtp({
      token_hash: payload.tokenHash,
      type: 'magiclink',
    });
    if (otpErr) {
      if (await hasActiveSupabaseSession()) return;
      throw otpErr;
    }
    return;
  }

  if (payload.mode === 'session' && payload.accessToken && payload.refreshToken) {
    const { error: sessErr } = await supabase.auth.setSession({
      access_token: payload.accessToken,
      refresh_token: payload.refreshToken,
    });
    if (sessErr) {
      if (await hasActiveSupabaseSession()) return;
      throw sessErr;
    }
    return;
  }

  if (await hasActiveSupabaseSession()) return;
  throw new Error('No se pudo establecer la sesión biométrica. Intenta de nuevo o entra con tu contraseña.');
}
