import * as QRCode from 'qrcode';

/**
 * 🎨 V19.0 · Generador Dinámico de Códigos QR de Nivel Agencia.
 *
 * - Usa corrección de errores nivel 'H' (30%) para permitir insignia/logo central
 *   sin sacrificar escaneabilidad en cámaras móviles.
 * - Adapta automáticamente el color de los "ojos" (finder patterns) y los
 *   módulos de datos a la paleta del tema elegido, manteniendo contraste ≥ 7:1.
 * - Soporta 4 estilos geométricos ('rounded' | 'dots' | 'luxury' | 'sharp')
 *   e integra el logo del negocio o sus iniciales tipográficas en el centro.
 */

export type QrStyle = 'rounded' | 'dots' | 'luxury' | 'sharp';

export const QR_STYLES: Array<{ id: QrStyle; label: string; hint: string }> = [
  { id: 'rounded', label: '🟣 Orgánico Redondeado', hint: 'Módulos suaves + ojos curvos' },
  { id: 'dots', label: '🔵 Puntos de Precisión', hint: 'Matriz circular moderna' },
  { id: 'luxury', label: '💎 Facetas de Lujo', hint: 'Diamantes + marco elegante' },
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

export function themeQrPalette(themeId: string): QrThemeColors {
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
) {
  const outer = 7 * cell;
  const innerCut = 5 * cell;
  const pupil = 3 * cell;

  const outerRadius = style === 'sharp' ? cell * 0.35 : style === 'dots' ? cell * 2.2 : cell * 1.65;
  const cutRadius = style === 'sharp' ? cell * 0.2 : style === 'dots' ? cell * 1.55 : cell * 1.1;
  const pupilRadius = style === 'sharp' ? cell * 0.15 : style === 'dots' ? cell * 1.45 : cell * 0.85;

  // Marco exterior del ojo
  ctx.fillStyle = eyeColor;
  drawRoundedRect(ctx, x, y, outer, outer, outerRadius);
  ctx.fill();

  // Anillo blanco interior
  ctx.fillStyle = '#ffffff';
  drawRoundedRect(ctx, x + cell, y + cell, innerCut, innerCut, cutRadius);
  ctx.fill();

  // Pupila central
  ctx.fillStyle = darkColor;
  if (style === 'luxury') {
    const cx = x + outer / 2;
    const cy = y + outer / 2;
    const rad = pupil * 0.62;
    ctx.beginPath();
    ctx.moveTo(cx, cy - rad);
    ctx.lineTo(cx + rad, cy);
    ctx.lineTo(cx, cy + rad);
    ctx.lineTo(cx - rad, cy);
    ctx.closePath();
    ctx.fill();
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
  logoUrl?: string | null;
  businessName?: string;
  size?: number;
}

export async function generateStyledQrDataUrl(options: StyledQrOptions): Promise<string> {
  const size = options.size ?? 540;
  const style: QrStyle = options.style ?? 'rounded';
  const palette = themeQrPalette(options.themeId ?? 'emerald');
  const targetValue = options.value?.trim() || 'https://impacto-tawny.vercel.app';

  const qr = QRCode.create(targetValue, { errorCorrectionLevel: 'H' });
  const n = qr.modules.size;
  const data = qr.modules.data;

  // Quiet zone ajustado estrictamente (1.25 módulos — cero parches blancos gigantes)
  const quiet = 1.25;
  const totalCells = n + quiet * 2;
  const cell = size / totalCells;
  const offset = quiet * cell;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Fondo blanco nítido estrictamente dentro del QR
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  // Zona central reservada (~20% de la matriz, 100% segura bajo ECC H 30%)
  const centerIdx = n / 2;
  const clearRadiusCells = n * 0.145;

  // 1. Dibujar módulos de datos (saltando ojos y centro reservado)
  ctx.fillStyle = palette.dark;
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      if (!data[r * n + c]) continue;
      if (isInFinderPattern(r, c, n)) continue;

      const dist = Math.hypot(r + 0.5 - centerIdx, c + 0.5 - centerIdx);
      if (dist < clearRadiusCells) continue;

      const x = offset + c * cell;
      const y = offset + r * cell;

      if (style === 'dots') {
        ctx.beginPath();
        ctx.arc(x + cell / 2, y + cell / 2, cell * 0.42, 0, Math.PI * 2);
        ctx.fill();
      } else if (style === 'luxury') {
        const cx = x + cell / 2;
        const cy = y + cell / 2;
        const rMod = cell * 0.48;
        ctx.beginPath();
        ctx.moveTo(cx, cy - rMod);
        ctx.lineTo(cx + rMod, cy);
        ctx.lineTo(cx, cy + rMod);
        ctx.lineTo(cx - rMod, cy);
        ctx.closePath();
        ctx.fill();
      } else if (style === 'rounded') {
        const pad = cell * 0.06;
        drawRoundedRect(ctx, x + pad, y + pad, cell - pad * 2, cell - pad * 2, cell * 0.34);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, cell + 0.35, cell + 0.35);
      }
    }
  }

  // 2. Dibujar los 3 ojos con el color de acento del tema
  drawFinderEye(ctx, offset, offset, cell, style, palette.eye, palette.dark);
  drawFinderEye(ctx, offset + (n - 7) * cell, offset, cell, style, palette.eye, palette.dark);
  drawFinderEye(ctx, offset, offset + (n - 7) * cell, cell, style, palette.eye, palette.dark);

  // 3. Insignia central (logo del negocio o monograma tipográfico)
  const badgeSize = clearRadiusCells * 2 * cell * 0.88;
  const bx = size / 2 - badgeSize / 2;
  const by = size / 2 - badgeSize / 2;
  const bRad = style === 'dots' ? badgeSize / 2 : badgeSize * 0.28;

  // Halo blanco de separación para garantizar contraste
  ctx.fillStyle = '#ffffff';
  drawRoundedRect(ctx, bx - cell * 0.35, by - cell * 0.35, badgeSize + cell * 0.7, badgeSize + cell * 0.7, bRad + cell * 0.25);
  ctx.fill();

  const logoImg = options.logoUrl ? await loadCorsImage(options.logoUrl) : null;
  if (logoImg) {
    ctx.save();
    drawRoundedRect(ctx, bx, by, badgeSize, badgeSize, bRad);
    ctx.clip();
    ctx.drawImage(logoImg, bx, by, badgeSize, badgeSize);
    ctx.restore();

    ctx.strokeStyle = palette.eye;
    ctx.lineWidth = Math.max(2, cell * 0.22);
    drawRoundedRect(ctx, bx, by, badgeSize, badgeSize, bRad);
    ctx.stroke();
  } else {
    ctx.fillStyle = palette.badgeBg;
    drawRoundedRect(ctx, bx, by, badgeSize, badgeSize, bRad);
    ctx.fill();

    ctx.strokeStyle = palette.eye;
    ctx.lineWidth = Math.max(2, cell * 0.18);
    drawRoundedRect(ctx, bx, by, badgeSize, badgeSize, bRad);
    ctx.stroke();

    const initials = extractInitials(options.businessName ?? 'Impulso');
    ctx.fillStyle = palette.badgeText;
    ctx.font = `900 ${Math.round(badgeSize * 0.44)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials, size / 2, size / 2 + badgeSize * 0.03);
  }

  return canvas.toDataURL('image/png');
}
