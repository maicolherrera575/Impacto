/**
 * Codificación compacta lossless de UUIDs (36 chars -> 22 chars Base64url)
 * para mantener códigos QR limpios, de baja densidad y lectura instantánea.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHORT_UUID_RE = /^[A-Za-z0-9_-]{22}$/;

export function encodeShortUuid(value: string): string {
  const trimmed = value.trim();
  if (!UUID_RE.test(trimmed)) return trimmed;
  const hex = trimmed.replace(/-/g, '');
  let bin = '';
  for (let i = 0; i < hex.length; i += 2) {
    bin += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeShortUuid(value: string): string {
  const trimmed = value.trim();
  if (UUID_RE.test(trimmed)) return trimmed;
  if (!SHORT_UUID_RE.test(trimmed)) return trimmed;
  try {
    const norm = trimmed.replace(/-/g, '+').replace(/_/g, '/');
    const pad = (4 - (norm.length % 4)) % 4;
    const bin = atob(norm + '='.repeat(pad));
    if (bin.length !== 16) return trimmed;
    let hex = '';
    for (let i = 0; i < 16; i += 1) {
      hex += bin.charCodeAt(i).toString(16).padStart(2, '0');
    }
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  } catch {
    return trimmed;
  }
}
