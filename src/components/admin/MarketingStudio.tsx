import { useEffect, useMemo, useRef, useState } from 'react';
import * as QRCode from 'qrcode';
import { Check, Copy, Dices, Download, ImagePlus, Loader2, Send, Sparkles, Trash2, Wand2 } from 'lucide-react';
import type { Offer, Profile } from '../../types';
import { categoryMeta } from '../../types';
import { generateFullMarketingCampaign } from '../../services/gemini.service';
import type { CampaignFocus, MarketingCampaign, PriceMode } from '../../services/gemini.service';
import { useToast } from '../ui/Toast';
import { cx, formatCOP } from '../../utils/format';
import { waLink } from '../../utils/whatsapp';
import { clearDraft, loadDraft, saveDraft } from '../../utils/draft';

// ═══════════════════════════════════════════════════════════════════════════
// 🚀 AGENCIA IA & MULTI-WHATSAPP STUDIO V7 (exclusivo del administrador)
// Piezas HD 1080p y QR: 100% en el navegador con <canvas> → 0 bytes en Supabase.
// ═══════════════════════════════════════════════════════════════════════════

interface MarketingStudioProps {
  merchants: Profile[];
  offers: Offer[];
}

interface BrandData {
  name: string;
  slogan: string;
  product: string;
  normalPrice: number | null;
  promoPrice: number | null;
  address: string;
  municipality: string;
  rating: number;
  photo: string | null;
  phoneDisplay: string;
  url: string;
  verified: boolean;
  emoji: string;
}

interface WaLine {
  title: string;
  hint: string;
  number: string;
  message: string;
}

interface Texts {
  plain: string;
  highlight: string;
  sub: string;
  benefits: string[];
  cta: string;
  priceLabel: string;
}

type Format = 'story' | 'square';
type Layout = 'bento' | 'magazine' | 'diagonal' | 'swiss';
type Piece = 0 | 1 | 2 | 3;
type PhotoMode = 'card' | 'full' | 'diag' | 'window';

interface Theme {
  id: string;
  label: string;
  bg1: string;
  bg2: string;
  glow: string;
  glow2: string;
  accent: string;
  text: string;
  sub: string;
}

const THEMES: Theme[] = [
  { id: 'obsidian', label: '🥂 Obsidian Gold', bg1: '#0b0b10', bg2: '#191924', glow: 'rgba(245,196,81,0.28)', glow2: 'rgba(255,255,255,0.10)', accent: '#f5c451', text: '#fff7e6', sub: '#cfc8b8' },
  { id: 'esmeralda', label: '🌿 Esmeralda Andino', bg1: '#06231c', bg2: '#0c4232', glow: 'rgba(52,211,153,0.30)', glow2: 'rgba(16,220,160,0.16)', accent: '#34d399', text: '#eafff5', sub: '#a7d8c4' },
  { id: 'brasa', label: '🔥 Brasa & Sabor', bg1: '#2b1004', bg2: '#5c1c06', glow: 'rgba(251,146,60,0.32)', glow2: 'rgba(239,68,68,0.18)', accent: '#fb923c', text: '#fff3e4', sub: '#e6c4a3' },
  { id: 'agro', label: '🚜 Agro & Tierra', bg1: '#1c250c', bg2: '#3d4d19', glow: 'rgba(234,214,122,0.28)', glow2: 'rgba(163,230,53,0.14)', accent: '#ead679', text: '#fdfbee', sub: '#cfcfa8' },
  { id: 'cyber', label: '⚡ Cyber Flash', bg1: '#05070f', bg2: '#0d1633', glow: 'rgba(34,211,238,0.36)', glow2: 'rgba(168,85,247,0.20)', accent: '#22d3ee', text: '#eafcff', sub: '#9ec5d4' },
];

const LAYOUTS: Array<{ id: Layout; label: string; hint: string }> = [
  { id: 'bento', label: '🏆 Master Bento', hint: 'Todo en uno (recomendado)' },
  { id: 'magazine', label: '📸 Full-Bleed', hint: 'Portada de revista' },
  { id: 'diagonal', label: '⚡ Diagonal', hint: 'Spotlight dinámico' },
  { id: 'swiss', label: '🏛️ Swiss Minimal', hint: 'Servicios y agro' },
];

const BADGE_PRESETS: Array<{ id: string; label: string }> = [
  { id: 'calidad', label: '💎 CALIDAD GARANTIZADA' },
  { id: 'tiempo', label: '🔥 OFERTA POR TIEMPO LIMITADO' },
  { id: 'especialidad', label: '⭐ ESPECIALIDAD DE LA CASA' },
  { id: 'verificado', label: '✅ NEGOCIO VERIFICADO' },
];

const PHOTO_PRESETS: Array<{ id: string; label: string }> = [
  { id: 'photo-1568901346375-23c9450c5869', label: '🍔 Gastronomía' },
  { id: 'photo-1509440159596-0249088772ff', label: '🥐 Panadería/Café' },
  { id: 'photo-1544025162-d76694265947', label: '🥩 Asadero/Carnes' },
  { id: 'photo-1500595046743-cd271d694d30', label: '🚜 Agro/Ganadería' },
  { id: 'photo-1501700493788-fa1a4fc9fe62', label: '🛻 Transporte/4x4' },
  { id: 'photo-1504148455328-c376907d081c', label: '🛠️ Ferretería' },
  { id: 'photo-1606811841689-23dfddce3e95', label: '🦷 Salud/Odonto' },
  { id: 'photo-1560066984-138dadb34c00', label: '💇‍♀️ Belleza/Spa' },
  { id: 'photo-1441986300917-64674bd600d8', label: '🛍️ Ropa/Comercio' },
  { id: 'photo-1518770660439-4636190af55', label: '💻 Tecnología' },
];

const FOCUS_OPTIONS: Array<{ id: CampaignFocus; label: string }> = [
  { id: 'remate', label: '🔥 Remate / Urgencia' },
  { id: 'prestigio', label: '💎 Prestigio' },
  { id: 'confianza', label: '🤝 Confianza local' },
  { id: 'viral', label: '⚡ Impacto viral' },
];

const FOCUS_PHOTO_MOODS: Record<CampaignFocus, string> = {
  remate: 'bold high contrast advertising shot, dramatic urgent lighting',
  prestigio: 'luxury editorial photography, elegant golden soft lighting',
  confianza: 'authentic warm documentary style, natural daylight, family business',
  viral: 'trendy vibrant modern shot, punchy saturated colors',
};

const PRESET_URL = (id: string): string =>
  `https://images.unsplash.com/${id}?w=1080&q=80&fm=jpg&fit=crop`;

// ── Utilidades de dibujo y teléfono ────────────────────────────────────────

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1]}…`;
    return kept;
  }
  return lines;
}

/** Convierte un hex (#rrggbb) en rgba con alfa. */
function alpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3
    ? h.split('').map((c) => c + c).join('')
    : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 10) digits = `57${digits}`;
  return digits;
}

/** Teléfono legible para el dock de conversión del afiche. */
function prettyPhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 10) digits = `57${digits}`;
  const local = digits.startsWith('57') && digits.length === 12 ? digits.slice(2) : digits;
  if (local.length !== 10) return '';
  return `📲 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}

function fillMessage(message: string, brand: BrandData): string {
  return message
    .replaceAll('{producto}', brand.product || 'tu promoción')
    .replaceAll('{negocio}', brand.name || 'el negocio');
}

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function triggerDownload(dataUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

function slug(text: string): string {
  return (text || 'impulso').toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('img'));
    img.src = src;
  });
}

// ═════════════════════════ Motor de render canvas V7 ═════════════════════════

interface RenderArgs {
  theme: Theme;
  format: Format;
  layout: Layout;
  piece: Piece;
  photo: HTMLImageElement | null;
  qr: HTMLImageElement | null;
  brand: BrandData;
  texts: Texts;
  badge: string;
  showPrice: boolean;
  showBenefits: boolean;
  showQr: boolean;
  zoom: number;
  posY: number;
}

function photoModeOf(layout: Layout): PhotoMode {
  return layout === 'bento' ? 'card' : layout === 'magazine' ? 'full' : layout === 'diagonal' ? 'diag' : 'window';
}

/** Fondo editorial: degradado diagonal + malla de luces radiales suaves. */
function backdrop(ctx: CanvasRenderingContext2D, W: number, H: number, t: Theme): void {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, t.bg1);
  g.addColorStop(1, t.bg2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const spots: Array<[number, number, number, string]> = [
    [W * 0.22, H * 0.16, W * 0.55, t.glow],
    [W * 0.85, H * 0.4, W * 0.5, t.glow2],
    [W * 0.5, H * 0.9, W * 0.6, t.glow],
  ];
  for (const [x, y, r, color] of spots) {
    const g2 = ctx.createRadialGradient(x, y, 0, x, y, r);
    g2.addColorStop(0, color);
    g2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, W, H);
  }
}

/** Haz de luz radial para el layout diagonal. */
function lightBeam(ctx: CanvasRenderingContext2D, W: number, H: number, t: Theme): void {
  const g = ctx.createRadialGradient(W * 0.72, H * 0.2, 0, W * 0.72, H * 0.2, W * 0.95);
  g.addColorStop(0, alpha(t.accent, 0.32));
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/** Retícula arquitectónica sutil para el layout swiss. */
function swissGrid(ctx: CanvasRenderingContext2D, W: number, H: number, fs: number): void {
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = Math.max(1, 1.5 * fs);
  for (let gx = 90 * fs; gx < W; gx += 120 * fs) {
    ctx.beginPath();
    ctx.moveTo(gx, 40 * fs);
    ctx.lineTo(gx, H - 40 * fs);
    ctx.stroke();
  }
  for (let gy = 90 * fs; gy < H; gy += 140 * fs) {
    ctx.beginPath();
    ctx.moveTo(30 * fs, gy);
    ctx.lineTo(W - 30 * fs, gy);
    ctx.stroke();
  }
}

/** Dibuja la foto con recorte según el layout, zoom y posición vertical. */
function drawPhotoBox(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  mode: PhotoMode,
  zoom: number,
  posY: number,
  t: Theme,
  fs: number,
): void {
  ctx.save();
  if (mode === 'diag') {
    const cut = h * 0.34;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h - cut);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.clip();
  } else if (mode !== 'full') {
    rr(ctx, x, y, w, h, mode === 'card' ? 44 * fs : 28 * fs);
    ctx.clip();
  }
  const s = Math.max(w / img.width, h / img.height) * zoom;
  const iw = img.width * s;
  const ih = img.height * s;
  const ix = x + (w - iw) / 2;
  const iy = y + Math.min(Math.max((h - ih) * posY, h - ih), 0);
  ctx.drawImage(img, ix, iy, iw, ih);
  const vig = ctx.createLinearGradient(0, y + h * 0.55, 0, y + h);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, mode === 'full' ? 'rgba(0,0,0,0.85)' : alpha(t.bg1, 0.6));
  ctx.fillStyle = vig;
  ctx.fillRect(x, y + h * 0.55, w, h * 0.45);
  ctx.restore();
  if (mode === 'window') {
    rr(ctx, x, y, w, h, 28 * fs);
    ctx.strokeStyle = alpha(t.accent, 0.75);
    ctx.lineWidth = Math.max(1.5, 3 * fs);
    ctx.stroke();
  }
}

/** Marco elegante cuando aún no hay foto (adiós afiches vacíos). */
function drawPhotoPlaceholder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  brand: BrandData,
  t: Theme,
  fs: number,
): void {
  rr(ctx, x, y, w, h, 44 * fs);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = Math.max(1, 2 * fs);
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.font = `900 ${Math.round(120 * fs)}px system-ui, sans-serif`;
  ctx.fillStyle = alpha(t.accent, 0.9);
  ctx.fillText(brand.emoji || '✨', x + w / 2, y + h / 2 + 20 * fs);
  ctx.font = `700 ${Math.round(28 * fs)}px system-ui, sans-serif`;
  ctx.fillStyle = t.sub;
  ctx.fillText('Genera una foto IA en la columna izquierda', x + w / 2, y + h - 46 * fs);
  ctx.textAlign = 'left';
}

/** Sello superior glassmorphism con brillo sutil y borde metálico fino. */
function drawBadgeGlass(ctx: CanvasRenderingContext2D, cx: number, y: number, text: string, t: Theme, fs: number, align: 'center' | 'left' = 'center'): number {
  if (!text.trim()) return 0;
  const size = Math.round(34 * fs);
  ctx.font = `800 ${size}px system-ui, sans-serif`;
  const chars = Array.from(text.trim());
  const maxTextW = 940 * fs;
  while (chars.length > 4 && ctx.measureText(chars.join('')).width > maxTextW) chars.pop();
  const txt = chars.length < Array.from(text.trim()).length ? chars.join('') + '…' : chars.join('');
  const tw = ctx.measureText(txt).width;
  const padX = 26 * fs;
  const h = 62 * fs;
  const w = tw + padX * 2;
  const x = align === 'left' ? cx : cx - w / 2;
  rr(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = Math.max(1.2, 2 * fs);
  ctx.stroke();
  const sheen = ctx.createLinearGradient(x, y, x, y + h);
  sheen.addColorStop(0, 'rgba(255,255,255,0.20)');
  sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
  sheen.addColorStop(1, 'rgba(255,255,255,0.07)');
  ctx.fillStyle = sheen;
  rr(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = t.text;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(txt, x + padX, y + h / 2 + size * 0.06);
  ctx.textBaseline = 'alphabetic';
  return h;
}

/** Titular de agencia a DOS TONOS con word-wrap garantizado. */
function drawMixedHeadline(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  plain: string,
  highlight: string,
  maxW: number,
  size: number,
  t: Theme,
  align: 'center' | 'left',
): number {
  type Tok = { w: string; c: string; x: number };
  const tokens: Tok[] = [];
  plain.trim().split(/\s+/).filter(Boolean).forEach((w) => tokens.push({ w, c: t.text, x: 0 }));
  highlight.trim().split(/\s+/).filter(Boolean).forEach((w) => tokens.push({ w, c: t.accent, x: 0 }));
  if (tokens.length === 0) return 0;
  ctx.font = `900 ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const spaceW = ctx.measureText(' ').width;
  const lines: Tok[][] = [];
  let cur: Tok[] = [];
  let curW = 0;
  for (const tk of tokens) {
    const tw = ctx.measureText(tk.w).width;
    const add = cur.length > 0 ? spaceW + tw : tw;
    if (curW + add > maxW && cur.length > 0) {
      lines.push(cur);
      cur = [{ w: tk.w, c: tk.c, x: 0 }];
      curW = tw;
    } else {
      cur.push({ w: tk.w, c: tk.c, x: curW });
      curW += add;
    }
  }
  if (cur.length > 0) lines.push(cur);
  let yy = y;
  for (const line of lines) {
    const last = line[line.length - 1];
    const lw = last.x + ctx.measureText(last.w).width;
    const startX = align === 'left' ? x : x - lw / 2;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = size * 0.25;
    ctx.shadowOffsetY = size * 0.07;
    for (const tk of line) {
      ctx.fillStyle = tk.c;
      ctx.fillText(tk.w, startX + tk.x, yy);
    }
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    yy += size * 1.16;
  }
  return yy - y - size * 0.16;
}

/** Píldoras horizontales de cristal con los beneficios (una por línea). */
function drawBenefitPills(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  items: string[],
  t: Theme,
  maxW: number,
  fs: number,
): number {
  if (items.length === 0) return y;
  const size = Math.round(38 * fs);
  ctx.font = `700 ${size}px system-ui, sans-serif`;
  const pillH = 66 * fs;
  const gap = 16 * fs;
  let cy = y;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const item of items.slice(0, 3)) {
    const w = Math.min(maxW, ctx.measureText(item).width + 56 * fs);
    const x = cx - w / 2;
    rr(ctx, x, cy, w, pillH, pillH / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = Math.max(1, 1.5 * fs);
    ctx.stroke();
    let txt = item;
    while (ctx.measureText(txt).width > w - 40 * fs && txt.length > 4) txt = txt.slice(0, -2);
    ctx.fillStyle = t.text;
    ctx.fillText(txt, cx, cy + pillH / 2 + size * 0.08);
    cy += pillH + gap;
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  return cy - gap;
}

/** Etiqueta de precio/servicio flotante con efecto 3D sobre la foto. */
function drawPriceFloat(
  ctx: CanvasRenderingContext2D,
  brand: BrandData,
  priceLabel: string,
  t: Theme,
  fs: number,
  ax: number,
  ayBottom: number,
  anchor: 'right' | 'center',
): number {
  const promo = brand.promoPrice;
  const showNormal = brand.normalPrice != null && promo != null && brand.normalPrice > promo;
  if (promo == null && !priceLabel.trim()) return 0;
  const big = Math.round(promo != null ? 108 * fs : 44 * fs);
  const small = Math.round(40 * fs);
  const promoTxt = promo != null ? formatCOP(promo) : priceLabel.trim();
  ctx.font = `900 ${big}px system-ui, sans-serif`;
  const promoW = ctx.measureText(promoTxt).width;
  const normalTxt = showNormal && brand.normalPrice != null ? formatCOP(brand.normalPrice) : '';
  ctx.font = `700 ${small}px system-ui, sans-serif`;
  const normW = normalTxt ? ctx.measureText(normalTxt).width : 0;
  const padX = 36 * fs;
  const w = Math.max(promoW, normW) + padX * 2;
  const h = (normalTxt ? 196 : promo != null ? 152 : 84) * fs;
  const x = anchor === 'right' ? ax - w : ax - w / 2;
  const y = ayBottom - h;
  rr(ctx, x, y, w, h, 30 * fs);
  ctx.fillStyle = 'rgba(8,10,14,0.55)';
  ctx.fill();
  ctx.strokeStyle = alpha(t.accent, 0.6);
  ctx.lineWidth = Math.max(1.2, 2.5 * fs);
  ctx.stroke();
  ctx.textAlign = 'center';
  if (normalTxt) {
    ctx.font = `700 ${small}px system-ui, sans-serif`;
    ctx.fillStyle = t.sub;
    ctx.fillText(normalTxt, x + w / 2, y + 52 * fs);
    const nw = ctx.measureText(normalTxt).width;
    ctx.strokeStyle = t.text;
    ctx.lineWidth = 4 * fs;
    ctx.beginPath();
    ctx.moveTo(x + w / 2 - nw / 2, y + 44 * fs);
    ctx.lineTo(x + w / 2 + nw / 2, y + 44 * fs);
    ctx.stroke();
  }
  ctx.font = `900 ${big}px system-ui, sans-serif`;
  ctx.fillStyle = t.accent;
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 22 * fs;
  ctx.shadowOffsetY = 5 * fs;
  const baseline = promo != null ? y + h - 28 * fs : y + h / 2 + big * 0.34;
  ctx.fillText(promoTxt, x + w / 2, baseline);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.textAlign = 'left';
  return h;
}

/** Tarjeta Dock de Conversión: negocio + dirección + WhatsApp + QR. */
function drawDock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  brand: BrandData,
  qr: HTMLImageElement | null,
  t: Theme,
  fs: number,
  withQr: boolean,
): void {
  rr(ctx, x, y, w, h, 36 * fs);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = Math.max(1, 2 * fs);
  ctx.stroke();
  const pad = 30 * fs;
  const qrSize = withQr && qr ? h - pad * 2 : 0;
  const maxTextW = w - pad * 2 - qrSize - (qrSize > 0 ? 24 * fs : 0);
  ctx.textAlign = 'left';
  ctx.fillStyle = t.text;
  ctx.font = `900 ${Math.round(40 * fs)}px system-ui, sans-serif`;
  let name = brand.name || 'Impulso';
  while (ctx.measureText(name).width > maxTextW && name.length > 4) name = name.slice(0, -2);
  ctx.fillText(name, x + pad, y + pad + 40 * fs);
  ctx.font = `600 ${Math.round(26 * fs)}px system-ui, sans-serif`;
  ctx.fillStyle = t.sub;
  let addr = `📍 ${brand.address || brand.municipality || 'Gachetá'}`;
  while (ctx.measureText(addr).width > maxTextW && addr.length > 6) addr = addr.slice(0, -2);
  ctx.fillText(addr, x + pad, y + pad + 78 * fs);
  ctx.font = `900 ${Math.round(44 * fs)}px system-ui, sans-serif`;
  ctx.fillStyle = t.accent;
  let phone = brand.phoneDisplay || '📲 Escríbenos por WhatsApp';
  while (ctx.measureText(phone).width > maxTextW && phone.length > 6) phone = phone.slice(0, -2);
  ctx.fillText(phone, x + pad, y + h - pad - 4 * fs);
  if (qrSize > 0 && qr) {
    const qx = x + w - pad - qrSize;
    rr(ctx, qx, y + pad, qrSize, qrSize, 16 * fs);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.drawImage(qr, qx + 8 * fs, y + pad + 8 * fs, qrSize - 16 * fs, qrSize - 16 * fs);
  }
}

/** Barra de contacto inferior con QR compacto opcional. */
function drawContactBar(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  brand: BrandData,
  qr: HTMLImageElement | null,
  t: Theme,
  fs: number,
  withQr: boolean,
): void {
  const barH = (withQr && qr ? 150 : 112) * fs;
  const y = H - barH;
  ctx.fillStyle = 'rgba(0,0,0,0.52)';
  ctx.fillRect(0, y, W, barH);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = Math.max(1, 2 * fs);
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(W, y);
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = t.text;
  ctx.font = `900 ${Math.round(38 * fs)}px system-ui, sans-serif`;
  ctx.fillText((brand.name || 'Impulso').slice(0, 30), 60 * fs, y + 48 * fs);
  ctx.font = `900 ${Math.round(34 * fs)}px system-ui, sans-serif`;
  ctx.fillStyle = t.accent;
  ctx.fillText((brand.phoneDisplay || '📲 Escríbenos por WhatsApp').slice(0, 34), 60 * fs, y + barH - 26 * fs);
  if (withQr && qr) {
    const qs = 106 * fs;
    const qx = W - qs - 44 * fs;
    const qy = y + (barH - qs) / 2;
    rr(ctx, qx - 10 * fs, qy - 10 * fs, qs + 20 * fs, qs + 20 * fs, 16 * fs);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.drawImage(qr, qx, qy, qs, qs);
  }
}

/** Lista numerada 01/02/03 del layout swiss. */
function drawNumbered(ctx: CanvasRenderingContext2D, x: number, y: number, items: string[], t: Theme, maxW: number, fs: number): number {
  const itemSize = Math.round(38 * fs);
  const gap = 30 * fs;
  let cy = y;
  ctx.textAlign = 'left';
  items.slice(0, 3).forEach((item, i) => {
    ctx.font = `800 ${Math.round(30 * fs)}px system-ui, sans-serif`;
    ctx.fillStyle = t.accent;
    ctx.fillText(`0${i + 1}`, x, cy + itemSize);
    ctx.font = `600 ${itemSize}px system-ui, sans-serif`;
    ctx.fillStyle = t.text;
    const lines = wrapLines(ctx, item, maxW - 74 * fs, 1);
    ctx.fillText(lines[0] ?? item, x + 74 * fs, cy + itemSize);
    cy += itemSize + gap;
  });
  return cy - gap;
}

/** Tarjeta ejecutiva blanca (layout swiss) con QR nítido. */
function drawExecCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  brand: BrandData,
  qr: HTMLImageElement | null,
  fs: number,
  withQr: boolean,
): void {
  rr(ctx, x, y, w, h, 28 * fs);
  ctx.fillStyle = '#f8fafc';
  ctx.fill();
  const pad = 30 * fs;
  const qrSize = withQr && qr ? h - pad * 2 : 0;
  const maxTextW = w - pad * 2 - qrSize - (qrSize > 0 ? 24 * fs : 0);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0f172a';
  ctx.font = `900 ${Math.round(40 * fs)}px system-ui, sans-serif`;
  let name = brand.name || 'Impulso';
  while (ctx.measureText(name).width > maxTextW && name.length > 4) name = name.slice(0, -2);
  ctx.fillText(name, x + pad, y + pad + 38 * fs);
  ctx.font = `600 ${Math.round(28 * fs)}px system-ui, sans-serif`;
  ctx.fillStyle = '#475569';
  let addr = `📍 ${brand.address || brand.municipality || 'Gachetá'}`;
  while (ctx.measureText(addr).width > maxTextW && addr.length > 6) addr = addr.slice(0, -2);
  ctx.fillText(addr, x + pad, y + pad + 76 * fs);
  ctx.font = `900 ${Math.round(40 * fs)}px system-ui, sans-serif`;
  ctx.fillStyle = '#0f766e';
  let phone = brand.phoneDisplay || '📲 Escríbenos por WhatsApp';
  while (ctx.measureText(phone).width > maxTextW && phone.length > 6) phone = phone.slice(0, -2);
  ctx.fillText(phone, x + pad, y + h - pad - 2 * fs);
  if (qrSize > 0 && qr) {
    ctx.drawImage(qr, x + w - pad - qrSize, y + pad, qrSize, qrSize);
  }
}

// ═════════════════════════ Compositor de piezas ═════════════════════════════

function drawPiece(canvas: HTMLCanvasElement, a: RenderArgs): void {
  const W = 1080;
  const H = a.format === 'story' ? 1920 : 1080;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const fs = a.format === 'story' ? 1 : 0.62;
  const t = a.theme;
  const T = a.texts;
  const mode = photoModeOf(a.layout);
  backdrop(ctx, W, H, t);

  /** Texto del bloque de precio cuando no hay promo (modalidad servicio). */
  const priceText = (): string => T.priceLabel.trim() || '💬 Cotiza gratis por WhatsApp';

  /** Subtítulo centrado con word-wrap; devuelve la altura dibujada. */
  const drawSub = (cy: number): number => {
    if (!T.sub.trim()) return 0;
    ctx.font = `600 ${Math.round(40 * fs)}px system-ui, sans-serif`;
    ctx.fillStyle = t.sub;
    ctx.textAlign = 'center';
    const lines = wrapLines(ctx, T.sub, W - 230, 2);
    let yy = cy;
    for (const line of lines) {
      ctx.fillText(line, W / 2, yy + 40 * fs);
      yy += 52 * fs;
    }
    ctx.textAlign = 'left';
    return yy - cy;
  };

  const bottomContact = (): void => {
    if (a.showQr && a.qr) drawContactBar(ctx, W, H, a.brand, a.qr, t, fs, true);
    else drawContactBar(ctx, W, H, a.brand, a.qr, t, fs, false);
  };

  // ═══ PIEZA 0 · MASTER TODO-EN-UNO (4 layouts) ═══
  if (a.piece === 0) {
    if (a.layout === 'magazine') {
      if (a.photo) drawPhotoBox(ctx, a.photo, 0, 0, W, H, 'full', a.zoom, a.posY, t, fs);
      const gTop = ctx.createLinearGradient(0, 0, 0, H * 0.3);
      gTop.addColorStop(0, 'rgba(0,0,0,0.55)');
      gTop.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gTop;
      ctx.fillRect(0, 0, W, H * 0.3);
      const gBot = ctx.createLinearGradient(0, H * 0.42, 0, H);
      gBot.addColorStop(0, 'rgba(0,0,0,0)');
      gBot.addColorStop(1, alpha(t.bg1, 0.95));
      ctx.fillStyle = gBot;
      ctx.fillRect(0, H * 0.42, W, H * 0.58);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = Math.max(1.5, 3 * fs);
      rr(ctx, 36 * fs, 36 * fs, W - 72 * fs, H - 72 * fs, 40 * fs);
      ctx.stroke();
      if (a.badge) drawBadgeGlass(ctx, W / 2, 96 * fs, a.badge, t, fs);
      let y = H * (a.format === 'story' ? 0.56 : 0.5);
      y += drawMixedHeadline(ctx, W / 2, y + 100 * fs, T.plain, T.highlight, W - 170, 100 * fs, t, 'center') + 14 * fs;
      y += drawSub(y) + 10 * fs;
      if (a.showBenefits) y = drawBenefitPills(ctx, W / 2, y + 12 * fs, T.benefits, t, W - 230, fs * 0.85) + 12 * fs;
      const barH = 150 * fs;
      if (a.showPrice) drawPriceFloat(ctx, a.brand, priceText(), t, fs, W / 2, H - barH - 34 * fs, 'center');
      bottomContact();
      return;
    }
    if (a.layout === 'bento') {
      const px = 56;
      const py = 120 * fs;
      const pw = W - 112;
      const ph = H * 0.46;
      if (a.photo) drawPhotoBox(ctx, a.photo, px, py, pw, ph, 'card', a.zoom, a.posY, t, fs);
      else drawPhotoPlaceholder(ctx, px, py, pw, ph, a.brand, t, fs);
      if (a.badge) drawBadgeGlass(ctx, px + pw / 2, py + 30 * fs, a.badge, t, fs);
      if (a.showPrice) drawPriceFloat(ctx, a.brand, priceText(), t, fs, px + pw - 56 * fs, py + ph - 40 * fs, 'right');
      const zy = py + ph + 66 * fs;
      let y = zy + drawMixedHeadline(ctx, W / 2, zy + 82 * fs, T.plain, T.highlight, W - 150, 82 * fs, t, 'center') + 10 * fs;
      y += drawSub(y) + 8 * fs;
      const dockH = 190 * fs;
      if (a.showBenefits) {
        y = drawBenefitPills(ctx, W / 2, y + 10 * fs, T.benefits, t, W - 240, fs * 0.85) + 12 * fs;
      }
      if (a.showQr && a.qr) drawDock(ctx, 56, H - dockH - 50 * fs, W - 112, dockH, a.brand, a.qr, t, fs, true);
      else drawContactBar(ctx, W, H, a.brand, a.qr, t, fs, false);
      return;
    }
    if (a.layout === 'diagonal') {
      lightBeam(ctx, W, H, t);
      const ph = H * 0.5;
      if (a.photo) drawPhotoBox(ctx, a.photo, 0, 0, W, ph, 'diag', a.zoom, a.posY, t, fs);
      else drawPhotoPlaceholder(ctx, 40, 40, W - 80, ph - 60, a.brand, t, fs);
      if (a.badge) drawBadgeGlass(ctx, W / 2, 96 * fs, a.badge, t, fs);
      if (a.showPrice) drawPriceFloat(ctx, a.brand, priceText(), t, fs, W - 80 * fs, ph + 26 * fs, 'right');
      let y = ph + 64 * fs;
      y += drawMixedHeadline(ctx, W / 2, y + 80 * fs, T.plain, T.highlight, W - 170, 80 * fs, t, 'center') + 10 * fs;
      y += drawSub(y) + 8 * fs;
      const dockH = 190 * fs;
      if (a.showBenefits) y = drawBenefitPills(ctx, W / 2, y + 10 * fs, T.benefits, t, W - 240, fs * 0.85) + 12 * fs;
      if (a.showQr && a.qr) drawDock(ctx, 56, H - dockH - 50 * fs, W - 112, dockH, a.brand, a.qr, t, fs, true);
      else drawContactBar(ctx, W, H, a.brand, a.qr, t, fs, false);
      return;
    }
    // swiss
    swissGrid(ctx, W, H, fs);
    const px = 70;
    const py = 130 * fs;
    const pw = W - 140;
    const ph = H * 0.32;
    if (a.photo) drawPhotoBox(ctx, a.photo, px, py, pw, ph, 'window', a.zoom, a.posY, t, fs);
    else drawPhotoPlaceholder(ctx, px, py, pw, ph, a.brand, t, fs);
    let y = py + ph + 64 * fs;
    y += drawMixedHeadline(ctx, 90, y + 74 * fs, T.plain, T.highlight, W - 180, 74 * fs, t, 'left') + 12 * fs;
    if (T.sub.trim()) {
      ctx.font = `600 ${Math.round(36 * fs)}px system-ui, sans-serif`;
      ctx.fillStyle = t.sub;
      const lines = wrapLines(ctx, T.sub, W - 260, 2);
      for (const line of lines) {
        ctx.fillText(line, 90, y + 36 * fs);
        y += 46 * fs;
      }
      y += 8 * fs;
    }
    if (a.showBenefits) y = drawNumbered(ctx, 90, y + 14 * fs, T.benefits, t, W - 180, fs) + 16 * fs;
    const execH = 180 * fs;
    if (a.showPrice) {
      const lbl = a.brand.promoPrice != null ? `💰 OFERTA ${formatCOP(a.brand.promoPrice)}` : priceText();
      drawBadgeGlass(ctx, 90, Math.min(y + 10 * fs, H - execH - 150 * fs), lbl, t, fs * 0.95, 'left');
    }
    if (a.showQr && a.qr) drawExecCard(ctx, 56, H - execH - 50 * fs, W - 112, execH, a.brand, a.qr, fs, true);
    else drawContactBar(ctx, W, H, a.brand, a.qr, t, fs, false);
    return;
  }

  // ═══ PIEZA 1 · GANCHO MAGNÉTICO ═══
  if (a.piece === 1) {
    if (a.layout === 'magazine') {
      if (a.photo) drawPhotoBox(ctx, a.photo, 0, 0, W, H, 'full', a.zoom, a.posY, t, fs);
      const gBot = ctx.createLinearGradient(0, H * 0.35, 0, H);
      gBot.addColorStop(0, 'rgba(0,0,0,0)');
      gBot.addColorStop(1, alpha(t.bg1, 0.95));
      ctx.fillStyle = gBot;
      ctx.fillRect(0, H * 0.35, W, H * 0.65);
      if (a.badge) drawBadgeGlass(ctx, W / 2, 96 * fs, a.badge, t, fs);
      let y = H * 0.6;
      y += drawMixedHeadline(ctx, W / 2, y + 104 * fs, T.plain, T.highlight, W - 150, 104 * fs, t, 'center') + 14 * fs;
      y += drawSub(y);
      if (a.showBenefits) y = drawBenefitPills(ctx, W / 2, y + 14 * fs, T.benefits, t, W - 240, fs * 0.8) + 10 * fs;
      bottomContact();
      return;
    }
    const inset = a.layout === 'swiss' ? 70 : 60;
    const ph = H * 0.52;
    if (a.photo) drawPhotoBox(ctx, a.photo, inset, 110 * fs, W - inset * 2, ph, mode === 'full' ? 'card' : mode, a.zoom, a.posY, t, fs);
    else drawPhotoPlaceholder(ctx, inset, 110 * fs, W - inset * 2, ph, a.brand, t, fs);
    if (a.badge) drawBadgeGlass(ctx, W / 2, 110 * fs + 30 * fs, a.badge, t, fs);
    let y = 110 * fs + ph + 70 * fs;
    y += drawMixedHeadline(ctx, W / 2, y + 98 * fs, T.plain, T.highlight, W - 150, 98 * fs, t, 'center') + 12 * fs;
    y += drawSub(y) + 10 * fs;
    drawBadgeGlass(ctx, W / 2, Math.min(y + 8 * fs, H - 220 * fs), T.cta, t, fs);
    bottomContact();
    return;
  }

  // ═══ PIEZA 2 · OFERTA / BENEFICIOS ═══
  if (a.piece === 2) {
    if (a.layout === 'magazine') {
      if (a.photo) drawPhotoBox(ctx, a.photo, 0, 0, W, H, 'full', a.zoom, a.posY, t, fs);
      const gBot = ctx.createLinearGradient(0, H * 0.3, 0, H);
      gBot.addColorStop(0, 'rgba(0,0,0,0)');
      gBot.addColorStop(1, alpha(t.bg1, 0.96));
      ctx.fillStyle = gBot;
      ctx.fillRect(0, H * 0.3, W, H * 0.7);
      if (a.badge) drawBadgeGlass(ctx, W / 2, 96 * fs, a.badge, t, fs);
      let y = H * 0.48;
      y += drawMixedHeadline(ctx, W / 2, y + 84 * fs, T.plain, T.highlight, W - 170, 84 * fs, t, 'center') + 12 * fs;
      y += drawSub(y) + 10 * fs;
      if (a.showBenefits) y = drawBenefitPills(ctx, W / 2, y + 10 * fs, T.benefits, t, W - 240, fs * 0.82) + 12 * fs;
      const barH = 150 * fs;
      if (a.showPrice) drawPriceFloat(ctx, a.brand, priceText(), t, fs, W / 2, H - barH - 34 * fs, 'center');
      bottomContact();
      return;
    }
    const inset = a.layout === 'swiss' ? 70 : 60;
    const ph = H * 0.26;
    if (a.photo) drawPhotoBox(ctx, a.photo, inset, 100 * fs, W - inset * 2, ph, mode === 'full' ? 'card' : mode, a.zoom, a.posY, t, fs);
    else drawPhotoPlaceholder(ctx, inset, 100 * fs, W - inset * 2, ph, a.brand, t, fs);
    if (a.badge) drawBadgeGlass(ctx, W / 2, 100 * fs + 26 * fs, a.badge, t, fs);
    let y = 100 * fs + ph + 60 * fs;
    y += drawMixedHeadline(ctx, W / 2, y + 74 * fs, T.plain, T.highlight, W - 170, 74 * fs, t, 'center') + 12 * fs;
    y += drawSub(y) + 10 * fs;
    if (a.showBenefits) y = drawBenefitPills(ctx, W / 2, y + 10 * fs, T.benefits, t, W - 240, fs * 0.85) + 14 * fs;
    const barH = (a.showQr && a.qr ? 150 : 112) * fs;
    if (a.showPrice) drawPriceFloat(ctx, a.brand, priceText(), t, fs, W / 2, H - barH - 30 * fs, 'center');
    bottomContact();
    return;
  }

  // ═══ PIEZA 3 · CIERRE + CONTACTO QR ═══
  if (a.piece === 3) {
    if (a.badge) drawBadgeGlass(ctx, W / 2, 96 * fs, a.badge, t, fs);
    let y = H * 0.22;
    ctx.font = `900 ${Math.round(80 * fs)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = t.text;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 20 * fs;
    const ctaLines = wrapLines(ctx, T.cta, W - 190, 3);
    for (const line of ctaLines) {
      ctx.fillText(line, W / 2, y + 80 * fs);
      y += 94 * fs;
    }
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';
    y += 16 * fs;
    y += drawSub(y);
    if (a.showBenefits) y = drawBenefitPills(ctx, W / 2, y + 16 * fs, T.benefits, t, W - 240, fs * 0.85) + 12 * fs;
    ctx.font = `900 ${Math.round(54 * fs)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = t.accent;
    ctx.fillText((a.brand.name || 'Impulso').slice(0, 30), W / 2, Math.max(y + 60 * fs, H * 0.62));
    ctx.textAlign = 'left';
    const dockH = 250 * fs;
    if (a.showQr && a.qr) drawDock(ctx, 56, H - dockH - 60 * fs, W - 112, dockH, a.brand, a.qr, t, fs, true);
    else drawContactBar(ctx, W, H, a.brand, a.qr, t, fs, false);
  }
}

// ═════════════════════════════════ Componente ═══════════════════════════════

const COPY_FALLBACK = {
  pas: '¿Se te antoja algo rico y no quieres cocinar? 😩 Todos los días pasa igual… pero hoy tienes la solución a un mensaje de distancia. Escríbenos por WhatsApp 👉',
  aida: '🔥 ATENCIÓN: salió lo que estabas esperando. 👀 Interés: es fresquito y del pueblo. 😍 Deseo: pídelo sin salir de casa. ⚡ Acción: escríbenos YA 👉',
  status1: '👀 ¿Ya sabes qué vas a almorzar hoy? Te va a encantar esto…',
  status2: '🔥 Hoy lo tienes a precio de amigo. Escríbenos y te lo apartamos 👉',
  status3: '🚨 ¡Últimas unidades! El pueblo ya está apartando. Escríbenos aquí 👉',
  reel1: 'Plano cercano del producto + voz: "¿Esto te lo imaginas en tu mesa hoy?"',
  reel2: 'Demostración del producto o servicio + voz: "recién hecho, como en casa"',
  reel3: 'Plano del local o la moto del domicilio + voz: "escríbenos por WhatsApp 👉"',
  close1: '¡Claro que sí! 😊 Te paso el valor al toque. Si pides 2 te incluyo domicilio. ¿Te aparto?',
  close2: 'Te entiendo 👍 Hoy solo nos quedan unas pocas unidades y mañana ya no hay. ¿Confirmamos?',
  close3: '¡Listo, tu pedido va en camino 🛵! ¿Te incluyo un extra por un poquito más?',
};

type CopyTab = 'pas' | 'aida' | 'estados' | 'reel' | 'cierres';

/** Clave de autoguardado del estudio (cero pérdida de datos del admin). */
const MARKETING_DRAFT_KEY = 'impulso_draft_marketing_v7';

interface MktDraft {
  mode?: 'plataforma' | 'externo';
  merchantId?: string;
  offerId?: string;
  extName?: string;
  extSlogan?: string;
  extProduct?: string;
  extNormalPrice?: string;
  extPromoPrice?: string;
  extAddress?: string;
  extUrl?: string;
  lines?: WaLine[];
  briefText?: string;
  priceMode?: PriceMode;
  focus?: CampaignFocus;
  texts?: Texts;
  themeIdx?: number;
  format?: Format;
  layout?: Layout;
  piece?: Piece;
  badgeMode?: string;
  badgeCustom?: string;
  showPrice?: boolean;
  showBenefits?: boolean;
  showQr?: boolean;
  customPhoto?: string | null;
  photoZoom?: number;
  photoPosY?: number;
}

const DEFAULT_LINES: WaLine[] = [
  { title: 'Línea 1 · Ventas directas', hint: 'Recibe los pedidos del anuncio', number: '', message: '¡Hola! Vi la promoción de {producto} en {negocio} y quiero pedir el mío 🙌' },
  { title: 'Línea 2 · Domicilios / veredas', hint: 'Despachos a domicilio', number: '', message: '¡Hola! Quiero pedir {producto} a domicilio 🛵. Mi dirección es:' },
  { title: 'Línea 3 · Reservas / mayoristas', hint: 'Eventos, fincas, cantidades', number: '', message: '¡Hola! Necesito {producto} en cantidad para un evento 📦. ¿Me dan precio mayorista?' },
];

/** Bloque de copy listo para copiar (usado en las pestañas de copywriting). */
function CopyBlock({
  text,
  tag,
  onCopy,
  copied,
  inputCls,
}: {
  text: string;
  tag: string;
  onCopy: (t: string, k: string, l: string) => Promise<void>;
  copied: string | null;
  inputCls: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-950/50 p-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{tag}</p>
      <textarea
        readOnly
        value={text}
        rows={Math.min(6, Math.max(3, Math.ceil(text.length / 44)))}
        className={cx(inputCls, 'mt-1 resize-none text-[11px] leading-relaxed text-slate-200')}
      />
      <button
        onClick={() => void onCopy(text, tag, 'Copy')}
        className="pressable mt-1.5 flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-impulso-mint"
      >
        {copied === tag ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} Copiar
      </button>
    </div>
  );
}

export function MarketingStudio({ merchants, offers }: MarketingStudioProps) {
  const toast = useToast();

  // ── Modo dual ──
  const [mode, setMode] = useState<'plataforma' | 'externo'>('plataforma');
  const [merchantId, setMerchantId] = useState('');
  const [offerId, setOfferId] = useState('');

  // ── Cliente externo ──
  const [extName, setExtName] = useState('');
  const [extSlogan, setExtSlogan] = useState('');
  const [extProduct, setExtProduct] = useState('');
  const [extNormalPrice, setExtNormalPrice] = useState('');
  const [extPromoPrice, setExtPromoPrice] = useState('');
  const [extAddress, setExtAddress] = useState('');
  const [extUrl, setExtUrl] = useState('');

  // ── Multi-WhatsApp ──
  const [lines, setLines] = useState<WaLine[]>(DEFAULT_LINES);

  // ── Campaña IA + brief ──
  const [campaign, setCampaign] = useState<MarketingCampaign | null>(null);
  const [generating, setGenerating] = useState(false);
  const [briefText, setBriefText] = useState('');
  const [priceMode, setPriceMode] = useState<PriceMode>('precio');
  const [focus, setFocus] = useState<CampaignFocus>('remate');

  // ── Textos del afiche ──
  const [texts, setTexts] = useState<Texts>({ plain: '', highlight: '', sub: '', benefits: ['', '', ''], cta: '', priceLabel: '💬 Cotiza gratis por WhatsApp' });
  const [copied, setCopied] = useState<string | null>(null);
  const [copyTab, setCopyTab] = useState<CopyTab>('pas');

  // ── Estudio gráfico ──
  const [themeIdx, setThemeIdx] = useState(1);
  const [format, setFormat] = useState<Format>('story');
  const [layout, setLayout] = useState<Layout>('bento');
  const [piece, setPiece] = useState<Piece>(0);
  const [badgeMode, setBadgeMode] = useState<string>('calidad');
  const [badgeCustom, setBadgeCustom] = useState('');
  const [showPrice, setShowPrice] = useState(true);
  const [showBenefits, setShowBenefits] = useState(true);
  const [showQr, setShowQr] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // ── Fotografía ──
  const [customPhoto, setCustomPhoto] = useState<string | null>(null);
  const [photoZoom, setPhotoZoom] = useState(1);
  const [photoPosY, setPhotoPosY] = useState(0.5);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoImg, setPhotoImg] = useState<HTMLImageElement | null>(null);
  const [qrImg, setQrImg] = useState<HTMLImageElement | null>(null);

  // ── Autoguardado instantáneo (cero pérdida de datos del admin) ──
  /** Evita que el autoguardado pise el borrador con vacíos antes de restaurar. */
  const draftReadyRef = useRef(false);

  // Restaurar el borrador al montar el estudio.
  useEffect(() => {
    const d = loadDraft<MktDraft>(MARKETING_DRAFT_KEY);
    if (!d) {
      draftReadyRef.current = true;
      return;
    }
    if (d.mode === 'plataforma' || d.mode === 'externo') setMode(d.mode);
    if (typeof d.merchantId === 'string') setMerchantId(d.merchantId);
    if (typeof d.offerId === 'string') setOfferId(d.offerId);
    if (typeof d.extName === 'string') setExtName(d.extName);
    if (typeof d.extSlogan === 'string') setExtSlogan(d.extSlogan);
    if (typeof d.extProduct === 'string') setExtProduct(d.extProduct);
    if (typeof d.extNormalPrice === 'string') setExtNormalPrice(d.extNormalPrice);
    if (typeof d.extPromoPrice === 'string') setExtPromoPrice(d.extPromoPrice);
    if (typeof d.extAddress === 'string') setExtAddress(d.extAddress);
    if (typeof d.extUrl === 'string') setExtUrl(d.extUrl);
    if (Array.isArray(d.lines) && d.lines.length === 3) setLines(d.lines as WaLine[]);
    if (typeof d.briefText === 'string') setBriefText(d.briefText);
    if (d.priceMode === 'precio' || d.priceMode === 'servicio') setPriceMode(d.priceMode);
    if (d.focus === 'remate' || d.focus === 'prestigio' || d.focus === 'confianza' || d.focus === 'viral') setFocus(d.focus);
    if (d.texts) {
      setTexts({
        plain: typeof d.texts.plain === 'string' ? d.texts.plain : '',
        highlight: typeof d.texts.highlight === 'string' ? d.texts.highlight : '',
        sub: typeof d.texts.sub === 'string' ? d.texts.sub : '',
        benefits:
          Array.isArray(d.texts.benefits) && d.texts.benefits.length === 3
            ? d.texts.benefits.map((b) => (typeof b === 'string' ? b : ''))
            : ['', '', ''],
        cta: typeof d.texts.cta === 'string' ? d.texts.cta : '',
        priceLabel: typeof d.texts.priceLabel === 'string' ? d.texts.priceLabel : '💬 Cotiza gratis por WhatsApp',
      });
    }
    if (typeof d.themeIdx === 'number' && d.themeIdx >= 0 && d.themeIdx < THEMES.length) setThemeIdx(d.themeIdx);
    if (d.format === 'story' || d.format === 'square') setFormat(d.format);
    if (d.layout === 'bento' || d.layout === 'magazine' || d.layout === 'diagonal' || d.layout === 'swiss') setLayout(d.layout);
    if (d.piece === 0 || d.piece === 1 || d.piece === 2 || d.piece === 3) setPiece(d.piece);
    if (typeof d.badgeMode === 'string') setBadgeMode(d.badgeMode);
    if (typeof d.badgeCustom === 'string') setBadgeCustom(d.badgeCustom);
    if (typeof d.showPrice === 'boolean') setShowPrice(d.showPrice);
    if (typeof d.showBenefits === 'boolean') setShowBenefits(d.showBenefits);
    if (typeof d.showQr === 'boolean') setShowQr(d.showQr);
    if (typeof d.customPhoto === 'string' || d.customPhoto === null) setCustomPhoto(d.customPhoto);
    if (typeof d.photoZoom === 'number' && d.photoZoom >= 1 && d.photoZoom <= 2.2) setPhotoZoom(d.photoZoom);
    if (typeof d.photoPosY === 'number' && d.photoPosY >= 0 && d.photoPosY <= 1) setPhotoPosY(d.photoPosY);
    draftReadyRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Guardar cada cambio al instante.
  useEffect(() => {
    if (!draftReadyRef.current) return;
    saveDraft(MARKETING_DRAFT_KEY, {
      mode,
      merchantId,
      offerId,
      extName,
      extSlogan,
      extProduct,
      extNormalPrice,
      extPromoPrice,
      extAddress,
      extUrl,
      lines,
      briefText,
      priceMode,
      focus,
      texts,
      themeIdx,
      format,
      layout,
      piece,
      badgeMode,
      badgeCustom,
      showPrice,
      showBenefits,
      showQr,
      customPhoto,
      photoZoom,
      photoPosY,
    });
  }, [mode, merchantId, offerId, extName, extSlogan, extProduct, extNormalPrice, extPromoPrice, extAddress, extUrl, lines, briefText, priceMode, focus, texts, themeIdx, format, layout, piece, badgeMode, badgeCustom, showPrice, showBenefits, showQr, customPhoto, photoZoom, photoPosY]);

  /** 🧹 Empieza el estudio desde cero (borra el autoguardado). */
  function clearAllDraft(): void {
    clearDraft(MARKETING_DRAFT_KEY);
    setMode('plataforma');
    setMerchantId('');
    setOfferId('');
    setExtName('');
    setExtSlogan('');
    setExtProduct('');
    setExtNormalPrice('');
    setExtPromoPrice('');
    setExtAddress('');
    setExtUrl('');
    setLines(DEFAULT_LINES);
    setBriefText('');
    setPriceMode('precio');
    setFocus('remate');
    setTexts({ plain: '', highlight: '', sub: '', benefits: ['', '', ''], cta: '', priceLabel: '💬 Cotiza gratis por WhatsApp' });
    setThemeIdx(1);
    setFormat('story');
    setLayout('bento');
    setPiece(0);
    setBadgeMode('calidad');
    setBadgeCustom('');
    setShowPrice(true);
    setShowBenefits(true);
    setShowQr(true);
    setCustomPhoto(null);
    setPhotoZoom(1);
    setPhotoPosY(0.5);
    setCampaign(null);
    toast.success('🧹 Borrador limpio: estudio en blanco');
  }

  const merchantOffers = useMemo(() => offers.filter((o) => o.merchant?.id === merchantId), [offers, merchantId]);

  /** Marca actual según el modo (plataforma se autollena; externo es editable). */
  const brand = useMemo<BrandData>(() => {
    if (mode === 'plataforma') {
      const m = merchants.find((x) => x.id === merchantId) ?? null;
      const offer = merchantOffers.find((o) => o.id === offerId) ?? null;
      return {
        name: m?.business_name ?? '',
        slogan: m ? `${categoryMeta(m.category).label} · ${m.municipality}` : '',
        product: offer?.title ?? '',
        normalPrice: offer?.original_price ?? null,
        promoPrice: offer?.promo_price ?? null,
        address: m?.address_reference ?? m?.municipality ?? '',
        municipality: m?.municipality ?? 'Gachetá',
        rating: m && m.rating_count > 0 ? m.rating_sum / m.rating_count : 5,
        photo: offer?.image_thumb ?? m?.logo_thumb ?? null,
        phoneDisplay: m ? prettyPhone(m.whatsapp) : '',
        url: offer ? `${window.location.origin}${window.location.pathname}?oferta=${offer.id}` : `${window.location.origin}`,
        verified: m?.is_verified ?? false,
        emoji: offer?.emoji_icon ?? '✨',
      };
    }
    const promo = Number(extPromoPrice.replace(/\D/g, '')) || null;
    const normal = Number(extNormalPrice.replace(/\D/g, '')) || null;
    const waInUrl = /wa\.me\/(\d+)/.exec(extUrl)?.[1] ?? '';
    return {
      name: extName,
      slogan: extSlogan,
      product: extProduct,
      normalPrice: normal,
      promoPrice: promo,
      address: extAddress,
      municipality: 'Gachetá',
      rating: 5,
      photo: null,
      phoneDisplay: prettyPhone(lines[0].number || waInUrl),
      url: extUrl || (lines[0].number ? waLink(normalizePhone(lines[0].number), '') : `${window.location.origin}`),
      verified: true,
      emoji: '✨',
    };
  }, [mode, merchants, merchantId, merchantOffers, offerId, extName, extSlogan, extProduct, extNormalPrice, extPromoPrice, extAddress, extUrl, lines]);

  /** Textos por defecto derivados de la marca. */
  const dflt = useMemo<Texts>(() => {
    const service = priceMode === 'servicio';
    return {
      plain: brand.name || 'Lo mejor del pueblo',
      highlight: brand.product || 'HOY',
      sub: brand.slogan || 'Calidad del pueblo, atención de primera',
      benefits: service
        ? ['🤝 Atención personalizada', '⏱️ Respuesta rápida', '📍 Cerca de ti en el pueblo']
        : ['🥇 Calidad garantizada', '🚚 Domicilio disponible', '⏰ Solo por HOY'],
      cta: service
        ? texts.priceLabel.trim() || '💬 Cotiza gratis por WhatsApp'
        : brand.promoPrice != null
          ? `¡Pide el tuyo HOY a solo ${formatCOP(brand.promoPrice)}! 👉`
          : '¡Aparta el tuyo HOY! Escríbenos 👉',
      priceLabel: texts.priceLabel,
    };
  }, [brand, priceMode, texts.priceLabel]);

  /** Textos finales del canvas: editables con defaults inteligentes. */
  const T = useMemo<Texts>(() => {
    const benefits = texts.benefits.map((b, i) => b.trim() || (dflt.benefits[i] ?? ''));
    return {
      plain: texts.plain.trim() || dflt.plain,
      highlight: texts.highlight.trim() || dflt.highlight,
      sub: texts.sub.trim() || dflt.sub,
      benefits: benefits.filter(Boolean),
      cta: texts.cta.trim() || dflt.cta,
      priceLabel: texts.priceLabel.trim() || '💬 Cotiza gratis por WhatsApp',
    };
  }, [texts, dflt]);

  /** Sello resuelto: preset, custom u oculto. */
  const badge = useMemo<string>(() => {
    if (badgeMode === 'none') return '';
    if (badgeMode === 'custom') return badgeCustom.trim();
    return BADGE_PRESETS.find((b) => b.id === badgeMode)?.label ?? '';
  }, [badgeMode, badgeCustom]);

  /** Enlaces wa.me codificados de las 3 líneas. */
  const lineLinks = useMemo(
    () => lines.map((l) => (l.number.trim() ? waLink(normalizePhone(l.number), fillMessage(l.message, brand)) : '')),
    [lines, brand],
  );

  const primaryLink = lineLinks[0] || brand.url;
  const qrTarget = primaryLink || `${window.location.origin}`;

  // Foto efectiva (subida/IA/preset) con fallback a la del comercio.
  const effectivePhoto = customPhoto ?? brand.photo;
  useEffect(() => {
    if (!effectivePhoto) {
      setPhotoImg(null);
      return;
    }
    let alive = true;
    loadImage(effectivePhoto)
      .then((img) => {
        if (alive) setPhotoImg(img);
      })
      .catch(() => {
        if (alive) setPhotoImg(null);
      });
    return () => {
      alive = false;
    };
  }, [effectivePhoto]);

  // QR codificado localmente (0 bytes en la base de datos).
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(qrTarget, {
      margin: 1,
      width: 480,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => {
        if (!alive) return;
        const img = new Image();
        img.onload = () => {
          if (alive) setQrImg(img);
        };
        img.src = url;
      })
      .catch(() => setQrImg(null));
    return () => {
      alive = false;
    };
  }, [qrTarget]);

  // Render en vivo del lienzo HD.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawPiece(canvas, {
      theme: THEMES[themeIdx],
      format,
      layout,
      piece,
      photo: photoImg,
      qr: qrImg,
      brand,
      texts: T,
      badge,
      showPrice,
      showBenefits,
      showQr,
      zoom: photoZoom,
      posY: photoPosY,
    });
  }, [themeIdx, format, layout, piece, photoImg, qrImg, brand, T, badge, showPrice, showBenefits, showQr, photoZoom, photoPosY]);

  /** ✨ Genera la campaña estratégica con IA (fallback local integrado). */
  async function generate(): Promise<void> {
    if (!brand.name.trim()) {
      toast.error('Elige un comercio (o escribe el nombre del negocio externo) primero');
      return;
    }
    setGenerating(true);
    try {
      const res = await generateFullMarketingCampaign({
        businessName: brand.name,
        slogan: brand.slogan,
        brief: briefText,
        product: brand.product,
        priceMode,
        normalPrice: brand.normalPrice,
        promoPrice: brand.promoPrice,
        priceLabel: texts.priceLabel,
        address: brand.address,
        municipality: brand.municipality || 'Gachetá',
        focus,
        targetUrl: primaryLink || brand.url,
      });
      setCampaign(res);
      const benefits = [res.benefits[0] ?? '', res.benefits[1] ?? '', res.benefits[2] ?? ''];
      setTexts((prev) => ({
        plain: res.headline.plain,
        highlight: res.headline.highlight,
        sub: res.sub,
        benefits,
        cta: res.cta,
        priceLabel: res.priceLabel ?? prev.priceLabel,
      }));
      setBadgeCustom(res.badgeText);
      setBadgeMode('custom');
      toast.success('✨ ¡Campaña y diseño listos! Textos, sello y prompt de foto aplicados');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo generar la campaña');
    } finally {
      setGenerating(false);
    }
  }

  /** 📷 Subida de foto propia: redimensionada y cacheada en memoria. */
  function handlePhotoFile(file: File | undefined): void {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 1400 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        const ctx = c.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, c.width, c.height);
        setCustomPhoto(c.toDataURL('image/jpeg', 0.88));
        toast.success('📷 Foto del cliente lista (0 bytes en la base de datos)');
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }

  /** 🎨 Foto publicitaria IA gratuita (pollinations) cacheada como dataURL. */
  async function generatePhoto(vary: boolean): Promise<void> {
    setPhotoBusy(true);
    try {
      const seed = Math.floor(Math.random() * 999999);
      const mood = FOCUS_PHOTO_MOODS[focus];
      const prompt = campaign?.imagePromptEn?.trim() || `professional advertising photo of ${brand.product || brand.name || 'a colombian local business'}, ${mood}, high resolution, no text`;
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1080&height=1080&nologo=true&enhance=true&seed=${seed}`;
      const img = await loadImage(url);
      const off = document.createElement('canvas');
      off.width = 1080;
      off.height = 1080;
      const octx = off.getContext('2d');
      if (!octx) throw new Error('canvas');
      octx.drawImage(img, 0, 0, 1080, 1080);
      setCustomPhoto(off.toDataURL('image/jpeg', 0.92));
      toast.success(vary ? '🎲 Nueva toma fotográfica lista' : '🎨 Foto publicitaria IA lista');
    } catch {
      toast.error('El motor de foto IA no respondió: prueba un preset HD o sube una foto');
    } finally {
      setPhotoBusy(false);
    }
  }

  /** Preset fotográfico HD por rubro (Unsplash CORS-safe). */
  async function usePreset(preset: { id: string; label: string }): Promise<void> {
    setPhotoBusy(true);
    try {
      const img = await loadImage(PRESET_URL(preset.id));
      const off = document.createElement('canvas');
      off.width = 1080;
      off.height = 1080;
      const octx = off.getContext('2d');
      if (!octx) throw new Error('canvas');
      octx.drawImage(img, 0, 0, 1080, 1080);
      setCustomPhoto(off.toDataURL('image/jpeg', 0.9));
      toast.success(`${preset.label}: foto HD aplicada`);
    } catch {
      toast.error('Esa foto no está disponible ahora: elige otra o sube la tuya');
    } finally {
      setPhotoBusy(false);
    }
  }

  async function copyText(text: string, key: string, label: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      toast.success(`${label} copiado ✅`);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1600);
    } catch {
      toast.error('No se pudo copiar: mantén presionado el texto');
    }
  }

  /** 📥 Exporta la pieza actual en PNG 1080p. */
  function downloadCurrent(): void {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      triggerDownload(
        canvas.toDataURL('image/png'),
        `${slug(brand.name)}-pieza-${piece + 1}-${format === 'story' ? '1080x1920' : '1080x1080'}.png`,
      );
      toast.success('📥 Pieza HD descargada (lista para publicar)');
    } catch {
      toast.error('La foto actual bloquea la exportación: prueba otra imagen');
    }
  }

  /** 📦 Exporta el pack completo (4 piezas) listo para publicar. */
  async function downloadPack(): Promise<void> {
    try {
      for (const s of [0, 1, 2, 3] as const) {
        const c = document.createElement('canvas');
        drawPiece(c, {
          theme: THEMES[themeIdx],
          format,
          layout,
          piece: s,
          photo: photoImg,
          qr: qrImg,
          brand,
          texts: T,
          badge,
          showPrice,
          showBenefits,
          showQr,
          zoom: photoZoom,
          posY: photoPosY,
        });
        triggerDownload(
          c.toDataURL('image/png'),
          `${slug(brand.name)}-pieza-${s + 1}-${format === 'story' ? '1080x1920' : '1080x1080'}.png`,
        );
        await wait(500);
      }
      toast.success('📦 ¡Pack completo de 4 piezas descargado!');
    } catch {
      toast.error('La foto actual bloquea la exportación: prueba otra imagen');
    }
  }

  /** 📲 4 versiones del anuncio con redacción variada (anti-spam). */
  const variants = useMemo(() => {
    const price = brand.promoPrice != null ? ` a SOLO ${formatCOP(brand.promoPrice)}` : '';
    const normal =
      brand.normalPrice != null && brand.promoPrice != null && brand.normalPrice > brand.promoPrice
        ? ` (antes ${formatCOP(brand.normalPrice)})`
        : '';
    const addr = brand.address || brand.municipality || 'Gachetá';
    const hook = T.plain ? `${T.plain} ${T.highlight}`.trim() : brand.product || 'Lo nuevo del pueblo';
    const p = brand.product || 'la promoción';
    return [
      `${brand.emoji} ${hook}\n${p}${price}${normal} · 📍 ${addr}\n${T.cta}\n👉 ${primaryLink}`,
      `🔥 ¡CORRE QUE SE VUELA! ${p} volando hoy en ${brand.name || 'el negocio'}${price}${normal}\n📍 ${addr} · pide con 1 clic 👉 ${primaryLink}`,
      `🚨 ÚLTIMAS UNIDADES: ${p}\nEl pueblo ya está apartando el suyo${price}\n📍 ${addr}\n👉 ${primaryLink}`,
      `🤔 ${T.plain || '¿Ya lo probaste?'} ${T.highlight}\n📍 ${brand.name || 'El negocio'} — ${addr}\n${brand.phoneDisplay || 'Escríbenos sin compromiso'} 👉 ${primaryLink}`,
    ];
  }, [brand, T, primaryLink]);

  /** 📋 Kit completo para entregar al cliente. */
  async function copyKit(): Promise<void> {
    const c = campaign;
    const kit = [
      `🚀 KIT DE CAMPAÑA — ${brand.name || 'Cliente'}`,
      `═══════════════════════════`,
      `💎 SELLO DEL AFICHE: ${badge || '(sin sello)'}`,
      `🪄 TITULAR: ${T.plain} ${T.highlight}`,
      `📝 SUBTÍTULO: ${T.sub}`,
      `✅ BENEFICIOS: ${T.benefits.join(' | ')}`,
      `💰 PRECIO/SERVICIO: ${brand.promoPrice != null ? formatCOP(brand.promoPrice) : T.priceLabel}`,
      `═══════════════════════════`,
      `📲 ENLACES MULTI-WHATSAPP`,
      lines.map((l, i) => `${l.title}: ${lineLinks[i] || '(sin número)'}`).join('\n'),
      `🔗 Enlace de la oferta: ${brand.url}`,
      `═══════════════════════════`,
      `✅ SECUENCIA DE ESTADOS (9:00 → 12:00 → 19:00)`,
      `1️⃣ ${c?.whatsappStatusSequence.status1 ?? COPY_FALLBACK.status1}`,
      `2️⃣ ${c?.whatsappStatusSequence.status2 ?? COPY_FALLBACK.status2}`,
      `3️⃣ ${c?.whatsappStatusSequence.status3 ?? COPY_FALLBACK.status3}`,
      `═══════════════════════════`,
      `📣 COPY PAS (Facebook / Instagram)`,
      c?.socialMediaCopy.pas ?? COPY_FALLBACK.pas,
      `📣 COPY AIDA FLASH (Grupos / Clasificados)`,
      c?.socialMediaCopy.aida ?? COPY_FALLBACK.aida,
      `═══════════════════════════`,
      `🎬 GUION REEL 15 SEGUNDOS`,
      `· 0-3 s: ${c?.videoReelScript.t0_3 ?? COPY_FALLBACK.reel1}`,
      `· 3-10 s: ${c?.videoReelScript.t3_10 ?? COPY_FALLBACK.reel2}`,
      `· 10-15 s: ${c?.videoReelScript.t10_15 ?? COPY_FALLBACK.reel3}`,
      `═══════════════════════════`,
      `💬 RESPUESTAS DE CIERRE PARA EL COMERCIANTE`,
      `· ¿Precio? ${c?.salesClosingTemplates.priceReply ?? COPY_FALLBACK.close1}`,
      `· Indeciso: ${c?.salesClosingTemplates.hesitantReply ?? COPY_FALLBACK.close2}`,
      `· Despacho: ${c?.salesClosingTemplates.dispatchUpsell ?? COPY_FALLBACK.close3}`,
      `═══════════════════════════`,
      `🧩 4 VERSIONES PARA COMPARTIR (anti-spam)`,
      variants.map((v, i) => `— Versión ${i + 1} —\n${v}`).join('\n\n'),
    ].join('\n');
    await copyText(kit, 'kit', '📋 Kit completo');
  }

  const hasBrand = mode === 'plataforma' ? merchantId !== '' : extName.trim() !== '';
  const inputCls =
    'w-full rounded-xl border border-white/10 bg-slate-950/60 px-3.5 py-2.5 text-sm font-medium text-white placeholder:text-slate-600 outline-none focus:border-impulso-emerald/60';
  const labelCls = 'text-[10px] font-extrabold uppercase tracking-wider text-slate-500';
  const cardCls = 'space-y-2.5 rounded-3xl border border-white/10 bg-impulso-card p-3.5';

  return (
    <div className="space-y-4 p-3 lg:grid lg:grid-cols-12 lg:items-start lg:gap-5 lg:space-y-0 lg:p-4">
      {/* Cabecera */}
      <div className="rounded-3xl border border-impulso-emerald/30 bg-gradient-to-br from-impulso-emerald/10 to-transparent p-4 lg:col-span-12">
        <p className="flex items-center gap-2 text-base font-extrabold text-impulso-mint">
          <Sparkles className="h-5 w-5" /> Agencia IA & Multi-WhatsApp Studio
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
          Suite profesional: brief IA, fotografía publicitaria generada en el navegador, 4 layouts editoriales y piezas HD
          1080p con QR real — 0 bytes en la base de datos. Todo se autoguarda mientras trabajas.
        </p>
        <button
          onClick={clearAllDraft}
          className="pressable mt-2 flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-950/40 px-3 py-1.5 text-[10px] font-bold text-slate-400 hover:text-impulso-rose"
        >
          <Trash2 className="h-3 w-3" /> Limpiar borrador (empezar desde cero)
        </button>
      </div>

      {/* ═══ COLUMNA IZQUIERDA: datos, brief IA, foto y diseño ═══ */}
      <div className="space-y-3 lg:col-span-4">
        {/* Modo dual */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setMode('plataforma')}
            className={cx(
              'pressable rounded-2xl border px-3 py-3 text-left text-xs font-extrabold transition',
              mode === 'plataforma'
                ? 'border-impulso-emerald/60 bg-impulso-emerald/15 text-impulso-mint'
                : 'border-white/10 bg-slate-950/40 text-slate-300',
            )}
          >
            🏪 Comercio registrado
            <span className="mt-0.5 block text-[10px] font-semibold text-slate-400">Datos y ofertas de Impulso</span>
          </button>
          <button
            onClick={() => setMode('externo')}
            className={cx(
              'pressable rounded-2xl border px-3 py-3 text-left text-xs font-extrabold transition',
              mode === 'externo'
                ? 'border-impulso-gold/60 bg-impulso-gold/15 text-impulso-gold'
                : 'border-white/10 bg-slate-950/40 text-slate-300',
            )}
          >
            ✨ Cliente externo
            <span className="mt-0.5 block text-[10px] font-semibold text-slate-400">Negocios por fuera de la plataforma</span>
          </button>
        </div>

        {/* Fuente de datos */}
        {mode === 'plataforma' ? (
          <div className={cardCls}>
            <p className="text-xs font-extrabold text-white">🏪 Comercio y oferta de la plataforma</p>
            {merchants.length === 0 ? (
              <p className="py-2 text-center text-[11px] text-slate-500">Aún no hay comercios registrados. Usa el modo Cliente Externo.</p>
            ) : (
              <>
                <select
                  value={merchantId}
                  onChange={(e) => {
                    setMerchantId(e.target.value);
                    setOfferId('');
                  }}
                  className={cx(inputCls, 'appearance-none')}
                  aria-label="Elegir comercio"
                >
                  <option value="">Elegir comercio…</option>
                  {merchants.map((m) => (
                    <option key={m.id} value={m.id} className="bg-impulso-panel">
                      {m.business_name} · {m.municipality}
                    </option>
                  ))}
                </select>
                <select
                  value={offerId}
                  onChange={(e) => setOfferId(e.target.value)}
                  disabled={merchantId === ''}
                  className={cx(inputCls, 'appearance-none disabled:opacity-40')}
                  aria-label="Elegir oferta activa"
                >
                  <option value="">Sin oferta específica (solo la marca)</option>
                  {merchantOffers.map((o) => (
                    <option key={o.id} value={o.id} className="bg-impulso-panel">
                      {o.emoji_icon} {o.title} — {formatCOP(o.promo_price)}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        ) : (
          <div className={cardCls}>
            <p className="text-xs font-extrabold text-white">✨ Datos del negocio externo</p>
            <input value={extName} onChange={(e) => setExtName(e.target.value)} placeholder="Nombre del negocio/marca *" className={inputCls} />
            <input value={extSlogan} onChange={(e) => setExtSlogan(e.target.value)} placeholder="Eslogan o rubro" className={inputCls} />
            <input value={extProduct} onChange={(e) => setExtProduct(e.target.value)} placeholder="Producto / servicio estrella" className={inputCls} />
            <div className="grid grid-cols-2 gap-2">
              <input value={extNormalPrice} onChange={(e) => setExtNormalPrice(e.target.value.replace(/\D/g, ''))} placeholder="Precio normal (opcional)" inputMode="numeric" className={inputCls} />
              <input value={extPromoPrice} onChange={(e) => setExtPromoPrice(e.target.value.replace(/\D/g, ''))} placeholder="Precio promo (opcional)" inputMode="numeric" className={inputCls} />
            </div>
            <input value={extAddress} onChange={(e) => setExtAddress(e.target.value)} placeholder="Dirección / referencia en el pueblo" className={inputCls} />
            <input value={extUrl} onChange={(e) => setExtUrl(e.target.value)} placeholder="Enlace de destino (web o wa.me…)" className={inputCls} />
          </div>
        )}

        {/* Brief IA */}
        <div className="space-y-2.5 rounded-3xl border border-impulso-emerald/30 bg-impulso-emerald/5 p-3.5">
          <p className="text-xs font-extrabold text-impulso-mint">🧠 Brief del negocio / servicio para la IA</p>
          <p className="text-[10px] leading-relaxed text-slate-400">
            Cuéntale libremente qué hace el negocio, qué promociona, su público o la idea de la campaña. La IA construye
            el titular, los beneficios, el sello y hasta el prompt de la foto.
          </p>
          <textarea
            value={briefText}
            onChange={(e) => setBriefText(e.target.value)}
            rows={4}
            maxLength={600}
            placeholder="Ej: Somos una veterinaria y almacén agropecuario en Gachetá. Queremos promocionar jornada de vacunación, concentrado al por mayor y asesoría para ganaderos con domicilio a veredas…"
            className={cx(inputCls, 'resize-none leading-relaxed')}
          />
          <p className={labelCls}>Modalidad de precio en el afiche</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setPriceMode('precio')}
              className={cx(
                'pressable rounded-xl border px-2 py-2 text-[10px] font-extrabold transition',
                priceMode === 'precio' ? 'border-impulso-emerald/60 bg-impulso-emerald/15 text-impulso-mint' : 'border-white/10 bg-slate-950/40 text-slate-400',
              )}
            >
              💰 Precio de oferta
              <span className="mt-0.5 block font-semibold opacity-70">Precio antes → precio promo</span>
            </button>
            <button
              onClick={() => setPriceMode('servicio')}
              className={cx(
                'pressable rounded-xl border px-2 py-2 text-[10px] font-extrabold transition',
                priceMode === 'servicio' ? 'border-impulso-gold/60 bg-impulso-gold/15 text-impulso-gold' : 'border-white/10 bg-slate-950/40 text-slate-400',
              )}
            >
              💬 Servicio / Cotización
              <span className="mt-0.5 block font-semibold opacity-70">Ideal para profesionales</span>
            </button>
          </div>
          {priceMode === 'servicio' && (
            <input
              value={texts.priceLabel}
              onChange={(e) => setTexts((p) => ({ ...p, priceLabel: e.target.value }))}
              placeholder='Texto de cotización (ej: "Valoración Sin Costo", "Desde $25.000")'
              className={inputCls}
            />
          )}
          <p className={labelCls}>Enfoque psicológico del anuncio</p>
          <div className="grid grid-cols-2 gap-2">
            {FOCUS_OPTIONS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFocus(f.id)}
                className={cx(
                  'pressable rounded-xl border px-2 py-2 text-[10px] font-extrabold transition',
                  focus === f.id ? 'border-impulso-emerald/60 bg-impulso-emerald/15 text-impulso-mint' : 'border-white/10 bg-slate-950/40 text-slate-400',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => void generate()}
            disabled={generating || !hasBrand}
            className="pressable flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-impulso-emerald to-teal-600 py-3 text-xs font-extrabold text-white shadow-glow disabled:opacity-40 disabled:shadow-none"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? 'Estrategia en camino…' : '✨ Generar Campaña y Diseño con IA'}
          </button>
        </div>

        {/* Fotografía */}
        <div className={cardCls}>
          <p className="text-xs font-extrabold text-white">🖼️ Fotografía comercial del afiche</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => void generatePhoto(false)}
              disabled={photoBusy}
              className="pressable flex items-center justify-center gap-1.5 rounded-xl bg-impulso-emerald/90 py-2.5 text-[10px] font-extrabold text-slate-950 disabled:opacity-50"
            >
              {photoBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />} Generar Foto IA
            </button>
            <button
              onClick={() => void generatePhoto(true)}
              disabled={photoBusy}
              className="pressable flex items-center justify-center gap-1.5 rounded-xl border border-impulso-emerald/40 bg-impulso-emerald/10 py-2.5 text-[10px] font-extrabold text-impulso-mint disabled:opacity-50"
            >
              <Dices className="h-3.5 w-3.5" /> Variar Foto IA
            </button>
          </div>
          <p className={labelCls}>Presets HD por rubro (1 clic)</p>
          <div className="grid grid-cols-2 gap-1.5">
            {PHOTO_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => void usePreset(p)}
                disabled={photoBusy}
                className="pressable rounded-lg border border-white/10 bg-slate-950/40 px-2 py-1.5 text-[10px] font-bold text-slate-300 hover:border-impulso-emerald/40 hover:text-impulso-mint disabled:opacity-50"
              >
                {p.label}
              </button>
            ))}
          </div>
          <label className="pressable flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-slate-950/40 py-2.5 text-xs font-bold text-slate-300">
            <ImagePlus className="h-4 w-4" />
            Subir foto real del cliente
            <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoFile(e.target.files?.[0])} />
          </label>
          {customPhoto && (
            <div className="space-y-2 rounded-2xl bg-slate-950/40 p-2.5">
              <div className="flex items-center justify-between">
                <p className={labelCls}>Ajustes de la foto</p>
                <button
                  onClick={() => setCustomPhoto(null)}
                  className="pressable flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-red-400"
                >
                  <Trash2 className="h-3 w-3" /> Quitar foto
                </button>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400">🔍 Zoom ({photoZoom.toFixed(1)}×)</p>
                <input
                  type="range"
                  min={1}
                  max={2.2}
                  step={0.05}
                  value={photoZoom}
                  onChange={(e) => setPhotoZoom(Number(e.target.value))}
                  className="w-full accent-impulso-emerald"
                />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400">↕️ Posición vertical ({Math.round(photoPosY * 100)}%)</p>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={photoPosY}
                  onChange={(e) => setPhotoPosY(Number(e.target.value))}
                  className="w-full accent-impulso-emerald"
                />
              </div>
            </div>
          )}
          <p className="text-[10px] text-slate-500">
            Foto IA sin costo (motor gratuito), presets HD y subida propia: todo vive en la memoria del navegador.
          </p>
        </div>

        {/* Controles de diseño */}
        <div className={cardCls}>
          <p className="text-xs font-extrabold text-white">🎨 Controles de diseño</p>
          <p className={labelCls}>Tema editorial</p>
          <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {THEMES.map((t, i) => (
              <button
                key={t.id}
                onClick={() => setThemeIdx(i)}
                className={cx(
                  'pressable shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-extrabold transition',
                  themeIdx === i ? 'border-impulso-gold/60 bg-impulso-gold/15 text-impulso-gold' : 'border-white/10 bg-slate-950/40 text-slate-400',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <p className={labelCls}>Layout (estructura del afiche)</p>
          <div className="grid grid-cols-2 gap-1.5">
            {LAYOUTS.map((l) => (
              <button
                key={l.id}
                onClick={() => setLayout(l.id)}
                className={cx(
                  'pressable rounded-xl border px-2 py-2 text-left text-[10px] font-extrabold transition',
                  layout === l.id ? 'border-impulso-emerald/60 bg-impulso-emerald/15 text-impulso-mint' : 'border-white/10 bg-slate-950/40 text-slate-400',
                )}
              >
                {l.label}
                <span className="mt-0.5 block font-semibold opacity-70">{l.hint}</span>
              </button>
            ))}
          </div>
          <p className={labelCls}>Sello superior (badge)</p>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => setBadgeMode('none')}
              className={cx(
                'pressable rounded-lg border px-2 py-1.5 text-[10px] font-bold transition',
                badgeMode === 'none' ? 'border-impulso-emerald/60 bg-impulso-emerald/15 text-impulso-mint' : 'border-white/10 bg-slate-950/40 text-slate-400',
              )}
            >
              🚫 Ocultar sello
            </button>
            {BADGE_PRESETS.map((b) => (
              <button
                key={b.id}
                onClick={() => setBadgeMode(b.id)}
                className={cx(
                  'pressable truncate rounded-lg border px-2 py-1.5 text-[10px] font-bold transition',
                  badgeMode === b.id ? 'border-impulso-emerald/60 bg-impulso-emerald/15 text-impulso-mint' : 'border-white/10 bg-slate-950/40 text-slate-400',
                )}
              >
                {b.label}
              </button>
            ))}
            <button
              onClick={() => setBadgeMode('custom')}
              className={cx(
                'pressable rounded-lg border px-2 py-1.5 text-[10px] font-bold transition',
                badgeMode === 'custom' ? 'border-impulso-gold/60 bg-impulso-gold/15 text-impulso-gold' : 'border-white/10 bg-slate-950/40 text-slate-400',
              )}
            >
              ✏️ Mi propio sello…
            </button>
          </div>
          {badgeMode === 'custom' && (
            <input
              value={badgeCustom}
              onChange={(e) => setBadgeCustom(e.target.value)}
              placeholder='Ej: "🏅 15 AÑOS DE TRADICIÓN"'
              className={inputCls}
            />
          )}
          <p className={labelCls}>Elementos en el afiche</p>
          {(
            [
              [showPrice, setShowPrice, '💰 Precio / promoción (o etiqueta de servicio)'],
              [showBenefits, setShowBenefits, '✅ Los 3 beneficios en tarjetas de cristal'],
              [showQr, setShowQr, '🔳 Código QR + botón de WhatsApp'],
            ] as const
          ).map(([val, set, label]) => (
            <button
              key={label}
              onClick={() => set(!val)}
              className={cx(
                'pressable flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-[11px] font-bold transition',
                val ? 'border-impulso-emerald/50 bg-impulso-emerald/10 text-impulso-mint' : 'border-white/10 bg-slate-950/40 text-slate-400',
              )}
            >
              {val ? '☑️' : '⬜'} {label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ COLUMNA CENTRAL: lienzo en vivo ═══ */}
      <div className="lg:sticky lg:top-4 lg:col-span-4">
        <div className="space-y-3">
          <div className="flex rounded-2xl bg-slate-950/60 p-1">
            {(
              [
                [0, '⭐ Maestra'],
                [1, '1 · Gancho'],
                [2, '2 · Oferta'],
                [3, '3 · Cierre'],
              ] as const
            ).map(([p, label]) => (
              <button
                key={p}
                onClick={() => setPiece(p)}
                className={cx(
                  'pressable flex-1 rounded-xl py-2 text-[10px] font-extrabold transition',
                  piece === p ? 'bg-impulso-emerald/20 text-impulso-mint' : 'text-slate-400',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex justify-center rounded-2xl bg-slate-950/40 p-1.5">
            {(
              [
                ['story', '📱 Historia 9:16'],
                ['square', '🖼️ Post 1:1'],
              ] as const
            ).map(([f, label]) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={cx(
                  'pressable flex-1 rounded-xl py-2 text-[10px] font-extrabold transition',
                  format === f ? 'bg-impulso-gold/20 text-impulso-gold' : 'text-slate-400',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="grid place-items-center rounded-3xl border border-white/10 bg-slate-950/30 p-3">
            <canvas
              ref={canvasRef}
              className="mx-auto block w-full max-w-[320px] rounded-2xl border border-white/10 shadow-2xl lg:w-auto lg:max-w-none lg:max-h-[68dvh]"
            />
            {photoBusy && (
              <p className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-impulso-mint">
                <Loader2 className="h-3 w-3 animate-spin" /> Cargando fotografía…
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={downloadCurrent}
              className="pressable col-span-2 flex items-center justify-center gap-2 rounded-2xl bg-impulso-emerald py-3 text-xs font-extrabold text-slate-950"
            >
              <Download className="h-4 w-4" /> Descargar pieza actual en HD (PNG 1080p)
            </button>
            <button
              onClick={() => void downloadPack()}
              className="pressable flex items-center justify-center gap-1.5 rounded-2xl border border-impulso-gold/40 bg-impulso-gold/10 py-3 text-[11px] font-extrabold text-impulso-gold"
            >
              <Download className="h-4 w-4" /> Pack 4 piezas
            </button>
            <button
              onClick={() => void copyKit()}
              className="pressable flex items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-slate-950/40 py-3 text-[11px] font-extrabold text-slate-200"
            >
              <Copy className="h-4 w-4" /> Copiar kit al cliente
            </button>
          </div>
        </div>
      </div>

      {/* ═══ COLUMNA DERECHA: textos, copywriting y WhatsApp ═══ */}
      <div className="space-y-3 lg:col-span-4">
        {/* Editor de textos */}
        <div className={cardCls}>
          <p className="text-xs font-extrabold text-white">✍️ Editor de textos del afiche</p>
          <div>
            <p className={labelCls}>Titular en blanco</p>
            <input value={texts.plain} onChange={(e) => setTexts((p) => ({ ...p, plain: e.target.value }))} placeholder="Parte blanca del titular" className={inputCls} />
          </div>
          <div>
            <p className={labelCls}>Palabras resaltadas en el acento</p>
            <input value={texts.highlight} onChange={(e) => setTexts((p) => ({ ...p, highlight: e.target.value }))} placeholder="Ej: HOY, CALIDAD, EL MEJOR…" className={inputCls} />
          </div>
          <div>
            <p className={labelCls}>Subtítulo</p>
            <input value={texts.sub} onChange={(e) => setTexts((p) => ({ ...p, sub: e.target.value }))} placeholder="Frase de apoyo del titular" className={inputCls} />
          </div>
          <div>
            <p className={labelCls}>3 beneficios (con emoji)</p>
            {texts.benefits.map((b, i) => (
              <input
                key={i}
                value={b}
                onChange={(e) => setTexts((p) => ({ ...p, benefits: p.benefits.map((x, j) => (j === i ? e.target.value : x)) }))}
                placeholder={`Beneficio ${i + 1}`}
                className={cx(inputCls, 'mt-1.5')}
              />
            ))}
          </div>
          <div>
            <p className={labelCls}>Llamado a la acción (CTA)</p>
            <input value={texts.cta} onChange={(e) => setTexts((p) => ({ ...p, cta: e.target.value }))} placeholder="Ej: ¡Pide el tuyo HOY! 👉" className={inputCls} />
          </div>
          {priceMode === 'servicio' && (
            <div>
              <p className={labelCls}>Etiqueta de cotización</p>
              <input value={texts.priceLabel} onChange={(e) => setTexts((p) => ({ ...p, priceLabel: e.target.value }))} className={inputCls} />
            </div>
          )}
        </div>

        {/* Copywriting profesional */}
        <div className={cardCls}>
          <p className="text-xs font-extrabold text-white">📣 Copywriting profesional</p>
          <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
            {(
              [
                ['pas', 'PAS'],
                ['aida', 'AIDA'],
                ['estados', 'Estados'],
                ['reel', 'Reel 15s'],
                ['cierres', 'Cierres'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setCopyTab(id)}
                className={cx(
                  'pressable shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-extrabold transition',
                  copyTab === id ? 'border-impulso-emerald/60 bg-impulso-emerald/15 text-impulso-mint' : 'border-white/10 bg-slate-950/40 text-slate-400',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {copyTab === 'pas' && (
            <CopyBlock text={campaign?.socialMediaCopy.pas ?? COPY_FALLBACK.pas} tag="Fórmula PAS · Facebook / Instagram" onCopy={copyText} copied={copied} inputCls={inputCls} />
          )}
          {copyTab === 'aida' && (
            <CopyBlock text={campaign?.socialMediaCopy.aida ?? COPY_FALLBACK.aida} tag="Fórmula AIDA Flash · Grupos / Clasificados" onCopy={copyText} copied={copied} inputCls={inputCls} />
          )}
          {copyTab === 'estados' && (
            <div className="space-y-2">
              <CopyBlock text={campaign?.whatsappStatusSequence.status1 ?? COPY_FALLBACK.status1} tag="Estado 1 · 9:00/11:00 · Curiosidad" onCopy={copyText} copied={copied} inputCls={inputCls} />
              <CopyBlock text={campaign?.whatsappStatusSequence.status2 ?? COPY_FALLBACK.status2} tag="Estado 2 · Con la pieza 2 · Revelación" onCopy={copyText} copied={copied} inputCls={inputCls} />
              <CopyBlock text={campaign?.whatsappStatusSequence.status3 ?? COPY_FALLBACK.status3} tag="Estado 3 · 19:00 · Escasez + prueba social" onCopy={copyText} copied={copied} inputCls={inputCls} />
            </div>
          )}
          {copyTab === 'reel' && (
            <div className="space-y-2">
              <CopyBlock text={campaign?.videoReelScript.t0_3 ?? COPY_FALLBACK.reel1} tag="⏱️ 0-3 s · Gancho visual" onCopy={copyText} copied={copied} inputCls={inputCls} />
              <CopyBlock text={campaign?.videoReelScript.t3_10 ?? COPY_FALLBACK.reel2} tag="⏱️ 3-10 s · Demostración" onCopy={copyText} copied={copied} inputCls={inputCls} />
              <CopyBlock text={campaign?.videoReelScript.t10_15 ?? COPY_FALLBACK.reel3} tag="⏱️ 10-15 s · Cierre con dirección" onCopy={copyText} copied={copied} inputCls={inputCls} />
            </div>
          )}
          {copyTab === 'cierres' && (
            <div className="space-y-2">
              <CopyBlock text={campaign?.salesClosingTemplates.priceReply ?? COPY_FALLBACK.close1} tag="💸 Cuando preguntan ¿precio?" onCopy={copyText} copied={copied} inputCls={inputCls} />
              <CopyBlock text={campaign?.salesClosingTemplates.hesitantReply ?? COPY_FALLBACK.close2} tag="🤔 Cliente indeciso" onCopy={copyText} copied={copied} inputCls={inputCls} />
              <CopyBlock text={campaign?.salesClosingTemplates.dispatchUpsell ?? COPY_FALLBACK.close3} tag="🛵 Confirmación + upsell" onCopy={copyText} copied={copied} inputCls={inputCls} />
            </div>
          )}
        </div>

        {/* Orquestador multi-WhatsApp */}
        <div className={cardCls}>
          <p className="text-xs font-extrabold text-white">📞 Líneas de WhatsApp (hasta 3 canales)</p>
          {lines.map((l, i) => (
            <div key={l.title} className="rounded-2xl border border-white/10 bg-slate-950/40 p-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-extrabold text-impulso-gold">{l.title}</p>
                <p className="text-[10px] font-semibold text-slate-500">{l.hint}</p>
              </div>
              <input
                value={l.number}
                onChange={(e) => setLines((prev) => prev.map((x, j) => (j === i ? { ...x, number: e.target.value.replace(/[^\d+\s]/g, '') } : x)))}
                placeholder="Número WhatsApp (ej: 3201234567)"
                inputMode="tel"
                className={cx(inputCls, 'mt-2')}
              />
              <textarea
                value={l.message}
                onChange={(e) => setLines((prev) => prev.map((x, j) => (j === i ? { ...x, message: e.target.value } : x)))}
                rows={2}
                maxLength={300}
                placeholder="Mensaje de entrada (usa {producto} y {negocio})"
                className={cx(inputCls, 'mt-2 resize-none')}
              />
              {lineLinks[i] && (
                <div className="mt-2 flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate rounded-lg bg-impulso-emerald/10 px-2.5 py-1.5 font-mono text-[10px] font-semibold text-impulso-mint">
                    {lineLinks[i]}
                  </p>
                  <button
                    onClick={() => void copyText(lineLinks[i], `link${i}`, 'Enlace wa.me')}
                    className="pressable grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 text-slate-300 hover:text-impulso-mint"
                    aria-label="Copiar enlace"
                  >
                    {copied === `link${i}` ? <Check className="h-3.5 w-3.5 text-impulso-mint" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Despacho anti-spam */}
        <div className={cardCls}>
          <p className="text-xs font-extrabold text-white">📲 Despacho Rápido Multi-WhatsApp (4 versiones anti-spam)</p>
          {variants.map((v, i) => (
            <div key={i} className="rounded-2xl bg-slate-950/50 p-2.5">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-impulso-gold">Versión {i + 1}</p>
              <p className="mt-1 whitespace-pre-wrap text-[11px] font-semibold leading-relaxed text-slate-200">{v}</p>
              <div className="mt-1.5 flex gap-2">
                <button
                  onClick={() => void copyText(v, `v${i}`, `Versión ${i + 1}`)}
                  className="pressable flex flex-1 items-center justify-center gap-1 rounded-lg border border-white/10 py-1.5 text-[10px] font-bold text-slate-300 hover:text-impulso-mint"
                >
                  {copied === `v${i}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} Copiar
                </button>
                <button
                  onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(v)}`, '_blank', 'noopener,noreferrer')}
                  className="pressable flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#25D366]/15 py-1.5 text-[10px] font-bold text-[#25D366]"
                >
                  <Send className="h-3 w-3" /> Enviar WhatsApp
                </button>
              </div>
            </div>
          ))}
        </div>

        {!hasBrand && (
          <p className="rounded-2xl border border-dashed border-white/15 bg-slate-950/40 p-3 text-center text-[11px] font-semibold text-slate-500">
            👆 Elige un comercio o escribe el nombre del cliente externo para activar la IA y el estudio gráfico.
          </p>
        )}
      </div>
    </div>
  );
}



