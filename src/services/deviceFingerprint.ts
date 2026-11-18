/**
 * 🕵️‍♂️ V36.0 · Huella Digital de Hardware Multicapa (SHA-256 sin librerías pesadas).
 *
 * Supera la limitación de IPs compartidas CGNAT en operadores móviles y cable de Colombia
 * (Claro, Movistar, Tigo, WOM, HV Televisión) combinando de forma determinista:
 *   1) Canvas 2D rendering signature
 *   2) WebGL unmasked GPU vendor & renderer
 *   3) AudioContext sampleRate + hardwareConcurrency + deviceMemory + maxTouchPoints
 *   4) Screen geometry + colorDepth + pixelRatio + timezone + language + User-Agent
 * -> Hash criptográfico SHA-256 estable (`fp_<24_hex>`).
 * Cumplimiento Ley 1581: cero GPS oculto, solo huella técnica antifraude.
 */

const DEVICE_KEY = 'impulso_device_id';
const FP_SHA_KEY = 'impulso_fp_hw_v36';

/** Hash determinista síncrono de 64-bit para señales intermedias y fallback inmediato. */
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

function getCanvasSignal(): string {
  if (typeof document === 'undefined') return 'no-canvas';
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 220;
    canvas.height = 48;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-2d';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 220, 48);
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 14px Arial, sans-serif';
    ctx.fillText('Impulso-FP-36 · Gachetá', 8, 10);
    ctx.strokeStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(192, 24, 14, 0, Math.PI * 1.65);
    ctx.stroke();
    return syncDeterministicHex(canvas.toDataURL('image/png'));
  } catch {
    return 'canvas-err';
  }
}

function getWebglSignal(): string {
  if (typeof document === 'undefined') return 'no-webgl';
  try {
    const canvas = document.createElement('canvas');
    const gl =
      (canvas.getContext('webgl') as WebGLRenderingContext | null) ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
    if (!gl) return 'no-gl';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const vendor = ext ? String(gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) ?? '') : String(gl.getParameter(gl.VENDOR) ?? '');
    const renderer = ext
      ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? '')
      : String(gl.getParameter(gl.RENDERER) ?? '');
    return `${vendor.slice(0, 40)}~${renderer.slice(0, 60)}`;
  } catch {
    return 'gl-err';
  }
}

function getAudioAndHardwareSignal(): string {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'hw-srv';
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = String(navigator.hardwareConcurrency ?? 0);
  const mem = String(nav.deviceMemory ?? 0);
  const touch = String(navigator.maxTouchPoints ?? 0);
  let audioSig = 'no-audio';
  try {
    const AudioCtx =
      (window as unknown as { OfflineAudioContext?: typeof OfflineAudioContext; webkitOfflineAudioContext?: typeof OfflineAudioContext })
        .OfflineAudioContext ??
      (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx(1, 256, 44100);
      audioSig = `${ctx.sampleRate}:${ctx.destination.maxChannelCount}`;
    }
  } catch {
    audioSig = 'audio-err';
  }
  return `c${cores}|m${mem}|t${touch}|a${audioSig}`;
}

function collectMultilayerSignals(): string {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'srv-env|es-CO|24|1080x1920|America/Bogota';
  }
  const ua = navigator.userAgent || 'ua-unknown';
  const lang = navigator.language || 'es-CO';
  const depth = typeof screen !== 'undefined' ? String(screen.colorDepth ?? 24) : '24';
  const width = typeof screen !== 'undefined' ? String(screen.width ?? 0) : '0';
  const height = typeof screen !== 'undefined' ? String(screen.height ?? 0) : '0';
  const dpr = String(Math.round((window.devicePixelRatio || 1) * 100));
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota';
  const hw = getAudioAndHardwareSignal();
  const canvasHash = getCanvasSignal();
  const webgl = getWebglSignal();
  return [ua, lang, depth, `${width}x${height}@${dpr}`, tz, hw, canvasHash, webgl].join('|');
}

let cachedFp: string | null = null;

/**
 * Calcula la huella digital de hardware multicapa SHA-256 (`fp_<24_hex>`).
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

  const raw = collectMultilayerSignals();
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
    /* usa respaldo síncrono determinista */
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

if (typeof window !== 'undefined') {
  void computeDeviceFingerprintSha256();
}

/** Devuelve síncronamente la huella forense de hardware del dispositivo (`fp_...`). */
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

  const fallback = `fp_${syncDeterministicHex(collectMultilayerSignals())}`;
  cachedFp = fallback;
  try {
    localStorage.setItem(DEVICE_KEY, fallback);
  } catch {
    /* sin persistencia */
  }
  return fallback;
}
