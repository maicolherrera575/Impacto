import * as QRCode from 'qrcode';
import { contrastTextOn, mixHex, relativeLuminance } from './colorPalette';

/**
 * 🎨 V22.0 · Generador Dinámico de Códigos QR de Alta Joyería.
 *
 * - Usa corrección de errores nivel 'H' (30%) para permitir insignia/logo central
 *   sin sacrificar escaneabilidad en cámaras móviles.
 * - Soporta paleta dinámica extraída del logo/foto (`brandColors`) o del tema.
 * - `cyber`: módulos geométricos neón + ojos cuadrados precisos.
 * - `luxury`: puntos circulares suaves con degradado sutil oro → negro.
 */

export type QrStyle = 'rounded' | 'dots' | 'luxury' | 'cyber' | 'sharp';

export const QR_STYLES: Array<{ id: QrStyle; label: string; hint: string }> = [
  { id: 'rounded', label: '🟣 Orgánico Redondeado', hint: 'Módulos suaves + ojos curvos' },
  { id: 'dots', label: '🔵 Puntos de Precisión', hint: 'Matriz circular moderna' },
  { id: 'luxury', label: '💎 Luxury Oro & Noir', hint: 'Puntos circulares + degradado oro a negro' },
  { id: 'cyber', label: '⚡ Cyber / Tech Neón', hint: 'Bordes cortados + ojos cuadrados de precisión' },
  { id: 'sharp', label: '📐 Suizo Arquitectónico', hint: 'Geometría pura de alto contraste' },
];

export interface QrThemeColors {
  dark: string;
  eye: string;
  badgeBg: string;
  badgeText: string;
}

const THEME_QR_PALETTES: Record<string, QrThemeColors> = {
  wood: { dark: '#291509', eye: '#b45309', badgeBg: '#451a03', badgeText: '#fde68a' },
  marble: { dark: '#1c1917', eye: '#9a6700', badgeBg: '#1c1917', badgeText: '#fef3c7' },
  cyber: { dark: '#0f172a', eye: '#0284c7', badgeBg: '#1e1b4b', badgeText: '#67e8f9' },
  kraft: { dark: '#2b1d12', eye: '#7c4a1d', badgeBg: '#2f5d3a', badgeText: '#fef3c7' },
  ember: { dark: '#270904', eye: '#c2410c', badgeBg: '#431407', badgeText: '#fed7aa' },
  emerald: { dark: '#042f21', eye: '#047857', badgeBg: '#064e3b', badgeText: '#a7f3d0' },
  obsidian: { dark: '#111014', eye: '#b45309', badgeBg: '#18181b', badgeText: '#fde68a' },
  clinic: { dark: '#0c2235', eye: '#0369a1', badgeBg: '#075985', badgeText: '#e0f2fe' },
  terracotta: { dark: '#3b1507', eye: '#b45309', badgeBg: '#7c2d12', badgeText: '#ffedd5' },
  pop: { dark: '#111827', eye: '#b91c1c', badgeBg: '#111827', badgeText: '#fde047' },
  aurora: { dark: '#1e0b36', eye: '#be185d', badgeBg: '#3b0764', badgeText: '#f5d0fe' },
  slate: { dark: '#18181b', eye: '#3f6212', badgeBg: '#18181b', badgeText: '#d9f99d' },
  arena: { dark: '#2a1d12', eye: '#9a3412', badgeBg: '#431407', badgeText: '#fef3c7' },
  vino: { dark: '#310511', eye: '#9f1239', badgeBg: '#4c0519', badgeText: '#fde68a' },
  oceano: { dark: '#041e2e', eye: '#0e7490', badgeBg: '#083344', badgeText: '#a5f3fc' },
  carbon: { dark: '#111318', eye: '#b91c1c', badgeBg: '#18181b', badgeText: '#fca5a5' },
};

export function themeQrPalette(
  themeId: string,
  brandColors?: { primary: string; accent: string; secondary?: string } | null,
): QrThemeColors {
  if (brandColors?.primary && brandColors?.accent) {
    // Asegura contraste >= 7:1 sobre fondo blanco manteniendo el matiz real de marca
    const dark =
      relativeLuminance(brandColors.primary) > 0.16
        ? mixHex(brandColors.primary, '#070b14', 0.72)
        : brandColors.primary;
    const eye =
      relativeLuminance(brandColors.accent) > 0.38
        ? mixHex(brandColors.accent, '#0f172a', 0.48)
        : brandColors.accent;
    return {
      dark,
      eye,
      badgeBg: brandColors.primary,
      badgeText: contrastTextOn(brandColors.primary),
    };
  }
  return THEME_QR_PALETTES[themeId] ?? THEME_QR_PALETTES.emerald;
}

export function extractInitials(businessName: string): string {
  const words = businessName
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0 && !/^(el|la|los|las|de|del|y|en)$/i.test(w));
  if (words.length === 0) return 'IM';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function isInFinderPattern(r: number, c: number, size: number): boolean {
  const topLeft = r < 7 && c < 7;
  const topRight = r < 7 && c >= size - 7;
  const bottomLeft = r >= size - 7 && c < 7;
  return topLeft || topRight || bottomLeft;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawFinderEye(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cell: number,
  style: QrStyle,
  eyeColor: string,
  darkColor: string,
  transparentBg: boolean,
) {
  const outer = 7 * cell;
  const innerCut = 5 * cell;
  const pupil = 3 * cell;

  const outerRadius =
    style === 'cyber' || style === 'sharp'
      ? cell * 0.12
      : style === 'dots' || style === 'luxury'
        ? cell * 2.15
        : cell * 1.65;
  const cutRadius =
    style === 'cyber' || style === 'sharp'
      ? cell * 0.08
      : style === 'dots' || style === 'luxury'
        ? cell * 1.5
        : cell * 1.1;
  const pupilRadius =
    style === 'cyber' || style === 'sharp'
      ? 0
      : style === 'dots' || style === 'luxury'
        ? cell * 1.4
        : cell * 0.85;

  // Marco exterior del ojo
  ctx.fillStyle = eyeColor;
  if (style === 'cyber' || style === 'sharp') {
    ctx.fillRect(x, y, outer, outer);
  } else {
    drawRoundedRect(ctx, x, y, outer, outer, outerRadius);
    ctx.fill();
  }

  // Anillo interior: en modo transparente recorta alfa real (cero parche blanco)
  ctx.save();
  if (transparentBg) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000000';
  } else {
    ctx.fillStyle = '#ffffff';
  }
  if (style === 'cyber' || style === 'sharp') {
    ctx.fillRect(x + cell, y + cell, innerCut, innerCut);
  } else {
    drawRoundedRect(ctx, x + cell, y + cell, innerCut, innerCut, cutRadius);
    ctx.fill();
  }
  ctx.restore();

  // Pupila central
  ctx.fillStyle = darkColor;
  if (style === 'cyber' || style === 'sharp') {
    ctx.fillRect(x + 2 * cell, y + 2 * cell, pupil, pupil);
  } else {
    drawRoundedRect(ctx, x + 2 * cell, y + 2 * cell, pupil, pupil, pupilRadius);
    ctx.fill();
  }
}

function loadCorsImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export interface StyledQrOptions {
  value: string;
  style?: QrStyle;
  themeId?: string;
  brandColors?: { primary: string; accent: string; secondary?: string } | null;
  logoUrl?: string | null;
  businessName?: string;
  size?: number;
  isLight?: boolean;
}

export async function generateStyledQrDataUrl(options: StyledQrOptions): Promise<string> {
  const size = options.size ?? 540;
  const style: QrStyle = options.style ?? 'rounded';
  const isLight = Boolean(options.isLight);
  const palette = themeQrPalette(options.themeId ?? 'emerald', options.brandColors);
  const targetValue = options.value?.trim() || 'https://tuimpulso.vercel.app';

  // Carga opcional del logo ANTES de crear la matriz: si no hay logo, usamos ECC 'M'
  // para reducir densidad de módulos y lograr puntos amplios y escaneables con Lens.
  const logoImg = options.logoUrl ? await loadCorsImage(options.logoUrl) : null;
  const qr = QRCode.create(targetValue, { errorCorrectionLevel: logoImg ? 'H' : 'M' });
  const n = qr.modules.size;
  const data = qr.modules.data;

  // Quiet zone elegante y mínimo (1.5 módulos en transparente; 1.8 en claro redondeado)
  const quiet = isLight ? 1.8 : 1.5;
  const totalCells = n + quiet * 2;
  const cell = size / totalCells;
  const offset = quiet * cell;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Fondo transparente puro en modo oscuro (Glassmorphism) o píldora blanca muy redondeada en modo claro
  ctx.clearRect(0, 0, size, size);
  const transparentBg = !isLight;
  if (!transparentBg) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    drawRoundedRect(ctx, 0, 0, size, size, size * 0.12);
    ctx.fill();
  }

  const centerIdx = n / 2;
  const clearRadiusCells = logoImg ? n * 0.145 : 0;

  // 1. Dibujar módulos de datos (saltando ojos y, solo si hay logo real, el centro reservado)
  const moduleDarkInk = isLight ? palette.dark : '#f8fafc';
  const moduleEyeInk = isLight
    ? palette.eye
    : relativeLuminance(palette.eye) < 0.62
      ? mixHex('#ffffff', palette.eye, 0.28)
      : palette.eye;

  if (!isLight) {
    if (style === 'luxury') {
      const grad = ctx.createLinearGradient(0, 0, size, size);
      grad.addColorStop(0, '#fef3c7');
      grad.addColorStop(0.55, '#fde68a');
      grad.addColorStop(1, '#ffffff');
      ctx.fillStyle = grad;
    } else if (style === 'cyber') {
      const grad = ctx.createLinearGradient(0, 0, size, size);
      grad.addColorStop(0, '#ecfeff');
      grad.addColorStop(1, mixHex('#ffffff', options.brandColors?.accent ?? '#22d3ee', 0.28));
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = moduleDarkInk;
    }
  } else if (style === 'luxury') {
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, options.brandColors ? palette.eye : '#9a6b06');
    grad.addColorStop(0.55, '#1e1608');
    grad.addColorStop(1, '#0b0a0c');
    ctx.fillStyle = grad;
  } else if (style === 'cyber') {
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, options.brandColors ? palette.dark : '#062c43');
    grad.addColorStop(1, options.brandColors ? palette.eye : '#3b0764');
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = moduleDarkInk;
  }

  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      if (!data[r * n + c]) continue;
      if (isInFinderPattern(r, c, n)) continue;

      if (clearRadiusCells > 0) {
        const dist = Math.hypot(r + 0.5 - centerIdx, c + 0.5 - centerIdx);
        if (dist < clearRadiusCells) continue;
      }

      const x = offset + c * cell;
      const y = offset + r * cell;

      if (style === 'dots' || style === 'luxury') {
        ctx.beginPath();
        ctx.arc(x + cell / 2, y + cell / 2, cell * (style === 'luxury' ? 0.43 : 0.42), 0, Math.PI * 2);
        ctx.fill();
      } else if (style === 'cyber') {
        const pad = cell * 0.08;
        ctx.fillRect(x + pad, y + pad, cell - pad * 2, cell - pad * 2);
      } else if (style === 'rounded') {
        const pad = cell * 0.06;
        drawRoundedRect(ctx, x + pad, y + pad, cell - pad * 2, cell - pad * 2, cell * 0.34);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, cell + 0.35, cell + 0.35);
      }
    }
  }

  // 2. Dibujar los 3 ojos con el color de acento adaptado (contraste mínimo >= 75%)
  const cyberEyeColor = style === 'cyber' && !options.brandColors ? (isLight ? '#0284c7' : '#a5f3fc') : moduleEyeInk;
  const luxuryEyeColor = style === 'luxury' && !options.brandColors ? (isLight ? '#b47b09' : '#fde68a') : moduleEyeInk;
  const activeEyeColor = style === 'cyber' ? cyberEyeColor : style === 'luxury' ? luxuryEyeColor : moduleEyeInk;
  drawFinderEye(ctx, offset, offset, cell, style, activeEyeColor, moduleDarkInk, transparentBg);
  drawFinderEye(ctx, offset + (n - 7) * cell, offset, cell, style, activeEyeColor, moduleDarkInk, transparentBg);
  drawFinderEye(ctx, offset, offset + (n - 7) * cell, cell, style, activeEyeColor, moduleDarkInk, transparentBg);

  // 3. Insignia central EXCLUSIVAMENTE cuando el comercio subió un logo real
  if (logoImg) {
    const badgeSize = clearRadiusCells * 2 * cell * 0.88;
    const bx = size / 2 - badgeSize / 2;
    const by = size / 2 - badgeSize / 2;
    const bRad =
      style === 'dots' || style === 'luxury'
        ? badgeSize / 2
        : style === 'cyber' || style === 'sharp'
          ? badgeSize * 0.12
          : badgeSize * 0.28;

    // Halo de separación coordinado (transparente en vidrio oscuro; blanco suave en tema claro)
    if (transparentBg) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = '#000000';
      drawRoundedRect(ctx, bx - cell * 0.35, by - cell * 0.35, badgeSize + cell * 0.7, badgeSize + cell * 0.7, bRad + cell * 0.25);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = '#ffffff';
      drawRoundedRect(ctx, bx - cell * 0.35, by - cell * 0.35, badgeSize + cell * 0.7, badgeSize + cell * 0.7, bRad + cell * 0.25);
      ctx.fill();
    }

    ctx.save();
    drawRoundedRect(ctx, bx, by, badgeSize, badgeSize, bRad);
    ctx.clip();
    ctx.drawImage(logoImg, bx, by, badgeSize, badgeSize);
    ctx.restore();

    ctx.strokeStyle = activeEyeColor;
    ctx.lineWidth = Math.max(2, cell * 0.22);
    drawRoundedRect(ctx, bx, by, badgeSize, badgeSize, bRad);
    ctx.stroke();
  }

  return canvas.toDataURL('image/png');
}
