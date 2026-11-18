/**
 * 🕵️‍♂️ V35.0 · Huella Digital Forense Avanzada (Device Fingerprinting SHA-256).
 *
 * Supera la limitación de IPs compartidas CGNAT en redes móviles de Colombia
 * combinando señales estables del navegador/dispositivo:
 *   User-Agent + navigator.language + screen.colorDepth + screen.width +
 *   screen.height + Intl.DateTimeFormat().resolvedOptions().timeZone
 * y generando un hash criptográfico SHA-256 con prefijo `fp_...`.
 */

const DEVICE_KEY = 'impulso_device_id';
const FP_SHA_KEY = 'impulso_fp_sha256';

function collectRawSignals(): string {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'srv-env|es-CO|24|1080x1920|America/Bogota';
  }
  const ua = navigator.userAgent || 'ua-unknown';
  const lang = navigator.language || 'es-CO';
  const depth = typeof screen !== 'undefined' ? String(screen.colorDepth ?? 24) : '24';
  const width = typeof screen !== 'undefined' ? String(screen.width ?? 0) : '0';
  const height = typeof screen !== 'undefined' ? String(screen.height ?? 0) : '0';
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota';
  return [ua, lang, depth, width, height, tz].join('|');
}

/** Hash determinista de respaldo síncrono (64-bit hex) mientras WebCrypto resuelve. */
function syncDeterministicHex(raw: string): string {
  let h1 = 0xdeadbeef ^ raw.length;
  let h2 = 0x41c6ce57 ^ raw.length;
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

let cachedFp: string | null = null;

/**
 * Calcula la huella digital SHA-256 (`fp_<24_hex>`) combinando User-Agent,
 * idioma, profundidad de color, resolución de pantalla y zona horaria.
 */
export async function computeDeviceFingerprintSha256(): Promise<string> {
  if (cachedFp && cachedFp.startsWith('fp_')) return cachedFp;
  try {
    const saved = localStorage.getItem(FP_SHA_KEY);
    if (saved && saved.startsWith('fp_')) {
      cachedFp = saved;
      return saved;
    }
  } catch {
    /* localStorage restringido */
  }

  const raw = collectRawSignals();
  let fp = `fp_${syncDeterministicHex(raw)}`;

  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const bytes = new TextEncoder().encode(raw);
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const hex = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      fp = `fp_${hex.slice(0, 24)}`;
    }
  } catch {
    /* usa el hash determinista de respaldo */
  }

  cachedFp = fp;
  try {
    localStorage.setItem(FP_SHA_KEY, fp);
    localStorage.setItem(DEVICE_KEY, fp);
  } catch {
    /* continuar en memoria */
  }
  return fp;
}

// Pre-calienta la huella SHA-256 real apenas carga el módulo en el navegador
if (typeof window !== 'undefined') {
  void computeDeviceFingerprintSha256();
}

/**
 * Devuelve síncronamente la huella forense del dispositivo (`fp_...`).
 */
export function getDeviceId(): string {
  if (cachedFp) return cachedFp;
  try {
    const shaSaved = localStorage.getItem(FP_SHA_KEY);
    if (shaSaved && shaSaved.startsWith('fp_')) {
      cachedFp = shaSaved;
      return shaSaved;
    }
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing && existing.startsWith('fp_')) {
      cachedFp = existing;
      return existing;
    }
  } catch {
    /* localStorage bloqueado */
  }

  const fallback = `fp_${syncDeterministicHex(collectRawSignals())}`;
  cachedFp = fallback;
  try {
    localStorage.setItem(DEVICE_KEY, fallback);
  } catch {
    /* sin persistencia */
  }
  return fallback;
}
