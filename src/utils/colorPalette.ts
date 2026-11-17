/**
 * Motor de extraccion de paleta cromatica de marca (V22.0).
 *
 * Analiza el logo del negocio (o fotografia subida) por cuantizacion en Canvas
 * y devuelve exactamente 3 colores hexadecimales representativos [primary, accent, secondary],
 * junto con utilidades WCAG para inyectar contraste garantizado y variables CSS
 * (--color-primary / --color-accent) en el Artboard publicitario.
 */

export interface ExtractedBrandPalette {
  primary: string;
  accent: string;
  secondary: string;
  colors: [string, string, string];
  source: 'logo' | 'photo';
}

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export function normalizeHex(hex: string): string | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const raw = m[1];
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  return `#${full.toLowerCase()}`;
}

export function hexToRgb(hex: string): RgbColor {
  const clean = normalizeHex(hex) ?? '#10b981';
  const num = parseInt(clean.slice(1), 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((x) => x.toString(16).padStart(2, '0'))
      .join('')
  );
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const chan = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
}

export function mixHex(hexA: string, hexB: string, ratioB = 0.5): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const t = Math.max(0, Math.min(1, ratioB));
  return rgbToHex(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t);
}

export function colorDistance(hexA: string, hexB: string): number {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
}

/**
 * Devuelve '#ffffff' u '#0b0f18' asegurando lectura nitida encima de un color o gradiente.
 */
export function contrastTextOn(hexA: string, hexB?: string): '#ffffff' | '#0b0f18' {
  const lum = hexB ? (relativeLuminance(hexA) + relativeLuminance(hexB)) / 2 : relativeLuminance(hexA);
  return lum >= 0.42 ? '#0b0f18' : '#ffffff';
}

/**
 * Ajusta un color de acento para que no quede ilegible ni en fondos claros ni en fondos oscuros.
 */
export function ensureReadableAccent(hex: string, bgIsLight: boolean): string {
  const lum = relativeLuminance(hex);
  if (bgIsLight && lum > 0.52) return mixHex(hex, '#0f172a', 0.45);
  if (!bgIsLight && lum < 0.22) return mixHex(hex, '#ffffff', 0.48);
  return hex;
}

function rgbSaturation({ r, g, b }: RgbColor): number {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  if (max === min) return 0;
  const l = (max + min) / 2;
  const d = max - min;
  return l > 0.5 ? d / (2 - max - min) : d / (max + min);
}

function loadCanvasFriendlyImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    if (!src.startsWith('data:') && !src.startsWith('blob:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function fetchAsObjectUrl(src: string): Promise<string | null> {
  try {
    const res = await fetch(src, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

/**
 * Extrae los 3 colores hexadecimales dominantes y representativos de una imagen/logo.
 */
export async function extractPaletteFromImage(
  src: string,
  source: 'logo' | 'photo' = 'logo',
): Promise<ExtractedBrandPalette | null> {
  const cleanSrc = src.trim();
  if (!cleanSrc) return null;

  let revokeUrl: string | null = null;
  let img = await loadCanvasFriendlyImage(cleanSrc);
  if (!img && !cleanSrc.startsWith('data:') && !cleanSrc.startsWith('blob:')) {
    const objUrl = await fetchAsObjectUrl(cleanSrc);
    if (objUrl) {
      revokeUrl = objUrl;
      img = await loadCanvasFriendlyImage(objUrl);
    }
  }
  if (!img) {
    if (revokeUrl) URL.revokeObjectURL(revokeUrl);
    return null;
  }

  try {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);

    interface Bucket {
      rSum: number;
      gSum: number;
      bSum: number;
      weight: number;
      count: number;
    }

    const buckets = new Map<string, Bucket>();
    const step = 24;

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 120) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      // Filtra blancos y negros extremos de relleno para capturar los colores reales de la marca
      if (lum > 0.95 || lum < 0.04) continue;

      const sat = rgbSaturation({ r, g, b });
      const qr = Math.floor(r / step);
      const qg = Math.floor(g / step);
      const qb = Math.floor(b / step);
      const key = `${qr}:${qg}:${qb}`;
      const weight = 1 + sat * 2.4;

      const cur = buckets.get(key) ?? { rSum: 0, gSum: 0, bSum: 0, weight: 0, count: 0 };
      cur.rSum += r;
      cur.gSum += g;
      cur.bSum += b;
      cur.weight += weight;
      cur.count += 1;
      buckets.set(key, cur);
    }

    if (buckets.size === 0) return null;

    const candidates = [...buckets.values()]
      .map((b) => {
        const hex = rgbToHex(b.rSum / b.count, b.gSum / b.count, b.bSum / b.count);
        const sat = rgbSaturation(hexToRgb(hex));
        return { hex, score: b.weight, sat, count: b.count };
      })
      .sort((a, b) => b.score - a.score);

    const chosen: Array<{ hex: string; sat: number; count: number }> = [];
    for (const c of candidates) {
      if (chosen.length === 0 || chosen.every((x) => colorDistance(x.hex, c.hex) >= 54)) {
        chosen.push(c);
        if (chosen.length === 3) break;
      }
    }
    for (const c of candidates) {
      if (chosen.length >= 3) break;
      if (!chosen.some((x) => colorDistance(x.hex, c.hex) < 22)) {
        chosen.push(c);
      }
    }

    if (chosen.length === 0) return null;
    while (chosen.length < 3) {
      const base = chosen[chosen.length - 1]?.hex ?? chosen[0].hex;
      const derived =
        chosen.length === 1
          ? mixHex(base, relativeLuminance(base) > 0.45 ? '#0f172a' : '#f8fafc', 0.55)
          : mixHex(chosen[0].hex, chosen[1].hex, 0.45);
      chosen.push({ hex: derived, sat: rgbSaturation(hexToRgb(derived)), count: 1 });
    }

    // Ordena: color más saturado como accent, color estructural como primary
    const sortedBySat = [...chosen].sort((a, b) => b.sat - a.sat);
    const accent = sortedBySat[0].hex;
    const remaining = chosen.filter((c) => c.hex !== accent);
    const primary = remaining[0]?.hex ?? chosen[0].hex;
    const secondary = remaining[1]?.hex ?? mixHex(primary, accent, 0.5);

    return {
      primary,
      accent,
      secondary,
      colors: [primary, accent, secondary],
      source,
    };
  } catch {
    return null;
  } finally {
    if (revokeUrl) URL.revokeObjectURL(revokeUrl);
  }
}

/**
 * Construye una lista de 3 colores normalizados a partir de respuesta JSON (ej. Gemini Vision).
 */
export function buildPaletteFromHexTriplet(
  hexes: string[],
  source: 'logo' | 'photo' = 'logo',
): ExtractedBrandPalette | null {
  const clean = hexes.map((h) => normalizeHex(h)).filter((x): x is string => Boolean(x));
  if (clean.length === 0) return null;
  const p = clean[0];
  const a = clean[1] ?? mixHex(p, '#f59e0b', 0.45);
  const s = clean[2] ?? mixHex(p, a, 0.5);
  return {
    primary: p,
    accent: a,
    secondary: s,
    colors: [p, a, s],
    source,
  };
}
