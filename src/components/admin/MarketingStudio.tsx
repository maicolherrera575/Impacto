import { useEffect, useMemo, useRef, useState } from 'react';
import * as QRCode from 'qrcode';
import { Check, Copy, Dices, Download, ImagePlus, Loader2, Send, Sparkles, Trash2, Wand2 } from 'lucide-react';
import type { Offer, Profile } from '../../types';
import { categoryMeta } from '../../types';
import { generateArtDirection, generateCampaignCopy, industryFromHint, normSpaces } from '../../services/gemini.service';
import type { ArtDirection, CampaignFocus, IndustryType, MarketingCampaign, PriceMode } from '../../services/gemini.service';
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
type Layout = 'bento' | 'magazine' | 'diagonal' | 'swiss' | 'split' | 'showcase' | 'poster' | 'strip';
type Piece = 0 | 1 | 2 | 3;
type PhotoMode = 'card' | 'full' | 'diag' | 'window';
/** Textura vectorial de fondo propia de cada tema (dibujada 100% en canvas). */
type ThemePattern = 'iso' | 'deco' | 'ember' | 'clinic' | 'topo' | 'rows' | 'burst' | 'mono';

interface Theme {
  id: string;
  label: string;
  bg1: string;
  bg2: string;
  glow: string;
  glow2: string;
  accent: string;
  accent2: string;
  text: string;
  sub: string;
  pattern: ThemePattern;
  /** Fuente display de agencia cargada desde Google Fonts. */
  fontD: string;
}

const THEMES: Theme[] = [
  { id: 'cyber', label: '🚀 Cyber Indigo', bg1: '#090d16', bg2: '#101a3a', glow: 'rgba(99,102,241,0.35)', glow2: 'rgba(168,85,247,0.22)', accent: '#22d3ee', accent2: '#a855f7', text: '#eaf2ff', sub: '#9fb3d9', pattern: 'iso', fontD: 'Space Grotesk' },
  { id: 'obsidian', label: '🥂 Obsidian Gold', bg1: '#08080a', bg2: '#141118', glow: 'rgba(245,158,11,0.26)', glow2: 'rgba(255,255,255,0.08)', accent: '#f59e0b', accent2: '#fde68a', text: '#fff7e6', sub: '#cfc8b8', pattern: 'deco', fontD: 'Playfair Display' },
  { id: 'brasa', label: '🔥 Crimson Ember', bg1: '#180808', bg2: '#3b0d06', glow: 'rgba(249,115,22,0.30)', glow2: 'rgba(239,68,68,0.18)', accent: '#f97316', accent2: '#fbbf24', text: '#fff3e4', sub: '#e6c4a3', pattern: 'ember', fontD: 'Anton' },
  { id: 'clinic', label: '🩺 Clinical Cyan', bg1: '#081420', bg2: '#0e2a3c', glow: 'rgba(6,182,212,0.28)', glow2: 'rgba(255,255,255,0.10)', accent: '#06b6d4', accent2: '#7dd3fc', text: '#eafbff', sub: '#a5c8d7', pattern: 'clinic', fontD: 'Space Grotesk' },
  { id: 'emerald', label: '🌿 Emerald Andean', bg1: '#061812', bg2: '#0e3a2a', glow: 'rgba(16,185,129,0.30)', glow2: 'rgba(52,211,153,0.16)', accent: '#10b981', accent2: '#a7f3d0', text: '#eafff5', sub: '#a7d8c4', pattern: 'topo', fontD: 'Archivo Black' },
  { id: 'terra', label: '🚜 Terra Harvest', bg1: '#14180b', bg2: '#2e3712', glow: 'rgba(234,179,8,0.26)', glow2: 'rgba(163,230,53,0.14)', accent: '#eab308', accent2: '#fde047', text: '#fdfbee', sub: '#cfcfa8', pattern: 'rows', fontD: 'Anton' },
  { id: 'sunset', label: '⚡ Sunset Magenta', bg1: '#1b0b2e', bg2: '#4a1259', glow: 'rgba(236,72,153,0.32)', glow2: 'rgba(251,146,60,0.22)', accent: '#ec4899', accent2: '#fb923c', text: '#fff0fa', sub: '#e3b8d9', pattern: 'burst', fontD: 'Bebas Neue' },
  { id: 'titanium', label: '🏛️ Titanium Pro', bg1: '#111318', bg2: '#23262e', glow: 'rgba(255,255,255,0.10)', glow2: 'rgba(132,204,22,0.18)', accent: '#ffffff', accent2: '#84cc16', text: '#ffffff', sub: '#b9bec9', pattern: 'mono', fontD: 'Archivo Black' },
];

const LAYOUTS: Array<{ id: Layout; label: string; hint: string }> = [
  { id: 'bento', label: '🏆 Master Bento', hint: 'Foto tarjeta + texto centrado' },
  { id: 'magazine', label: '📸 Full-Bleed', hint: 'Foto completa de fondo' },
  { id: 'diagonal', label: '⚡ Asymmetric Diagonal', hint: 'Corte diagonal dinámico' },
  { id: 'swiss', label: '🏛️ Executive Grid', hint: 'Retícula numerada' },
  { id: 'split', label: '🪟 Split Doble', hint: 'Texto a la izquierda, foto a la derecha' },
  { id: 'showcase', label: '🔵 Medallón', hint: 'Foto circular de vitrina' },
  { id: 'poster', label: '🖤 Poster Impacto', hint: 'Tipografía gigante sobre foto' },
  { id: 'strip', label: '🎞️ Trío de Franjas', hint: 'Foto, banda de titular, contacto' },
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

// ── Librería de 40 fotografías editoriales HD (5 por rubro, rotación aleatoria)
// Se cargan al instante para que el lienzo JAMÁS quede vacío; la foto IA a
// medida de pollinations llega después y reemplaza suavemente la instantánea.
const INDUSTRY_LABELS: Record<IndustryType, string> = {
  digital_tech: '💻 Marketing/Tech',
  gastronomia: '🍽️ Gastronomía',
  salud_belleza: '🩺 Salud/Belleza',
  agro_campo: '🚜 Agro/Campo',
  transporte_logistica: '🛻 Transporte',
  comercio_retail: '🛍️ Comercio',
  servicios_profesionales: '💼 Servicios Pro',
  construccion_hogar: '🏗️ Construcción',
};

const INDUSTRY_PHOTOS: Record<IndustryType, string[]> = {
  digital_tech: [
    'photo-1518770660439-4636190af55',
    'photo-1461749280684-dccba630e2f6',
    'photo-1519389950473-47ba0277781c',
    'photo-1550745165-9bc0b252726f',
    'photo-1531297484001-80022131f5a1',
  ],
  gastronomia: [
    'photo-1568901346375-23c9450c5869',
    'photo-1509440159596-0249088772ff',
    'photo-1544025162-d76694265947',
    'photo-1565299624946-b28f40a0ae38',
    'photo-1555939594-58d7cb561ad1',
  ],
  salud_belleza: [
    'photo-1606811841689-23dfddce3e95',
    'photo-1560066984-138dadb34c00',
    'photo-1596462502278-27bfdc403348',
    'photo-1576091160399-112ba8d25d1d',
    'photo-1588776814546-1ffcf47267a5',
  ],
  agro_campo: [
    'photo-1500595046743-cd271d694d30',
    'photo-1500382017468-9049fed747ef',
    'photo-1560493676-04071c5f467b',
    'photo-1625246333195-78d9c8adad30',
    'photo-1574943320219-553eb213f72d',
  ],
  transporte_logistica: [
    'photo-1501700493788-fa1a4fc9fe62',
    'photo-1601584115197-04ecc0da31d7',
    'photo-1519003722824-194ddf4c2e91',
    'photo-1568607918850-51c8d6ac40e5',
    'photo-1558618666-fcd25c85cd64',
  ],
  comercio_retail: [
    'photo-1441986300917-64674bd600d8',
    'photo-1483985988355-763728e1935b',
    'photo-1472851294608-062f824d29cc',
    'photo-1607083206968-1361166ea65e',
    'photo-1555529669-e69e7aa0ba9a',
  ],
  servicios_profesionales: [
    'photo-1450101499163-c8848c66ca85',
    'photo-1521791136064-7986c2920216',
    'photo-1507003211169-0a1dd7228f2d',
    'photo-1573496359142-b8d87734a5a2',
    'photo-1560264280-88b68371db39',
  ],
  construccion_hogar: [
    'photo-1504148455328-c376907d081c',
    'photo-1541888946425-d81bb19240f5',
    'photo-1581094794329-c8112a89af12',
    'photo-1600585154340-be6161a56a0c',
    'photo-1416331108676-a22ccb276e35',
  ],
};

/** Adivina el rubro por palabras clave del brief (cliente externo sin categoría). */
function guessIndustry(text: string): IndustryType {
  const t = text.toLowerCase();
  if (/marketing|digital|redes|software|pagina|p[aá]gina|web|tecnolog|publicidad|agencia/.test(t)) return 'digital_tech';
  if (/restaurante|comida|pizza|asado|panader|caf[eé]|almuerzo|men[uú]|sabor/.test(t)) return 'gastronomia';
  if (/odont|dental|salud|m[eé]dico|belleza|spa|est[eé]tica|peluquer|farmacia|droguer/.test(t)) return 'salud_belleza';
  if (/agro|campo|veterinar|finca|ganado|cultivo|abono|semilla|concentrado/.test(t)) return 'agro_campo';
  if (/transporte|flete|domicilio|camion|moto|despacho|log[ií]stica/.test(t)) return 'transporte_logistica';
  if (/tienda|ropa|venta|almac[eé]n|boutique|supermercado|comercio/.test(t)) return 'comercio_retail';
  if (/construcci[oó]n|obra|ferreter|alba[nñ]il|hogar|mueble|electricis|plomero/.test(t)) return 'construccion_hogar';
  return 'servicios_profesionales';
}

/** Carga en rotación aleatoria una foto editorial del rubro; prueba las 5. */
async function loadCuratedIndustryPhoto(industry: IndustryType): Promise<string | null> {
  const ids = [...INDUSTRY_PHOTOS[industry]].sort(() => Math.random() - 0.5);
  for (const id of ids) {
    try {
      const img = await loadImage(PRESET_URL(id));
      const off = document.createElement('canvas');
      off.width = 1080;
      off.height = 1080;
      const octx = off.getContext('2d');
      if (!octx) return null;
      octx.drawImage(img, 0, 0, 1080, 1080);
      return off.toDataURL('image/jpeg', 0.9);
    } catch {
      // Foto no disponible: prueba la siguiente del rubro.
    }
  }
  return null;
}

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
  switch (layout) {
    case 'magazine':
    case 'poster':
      return 'full';
    case 'diagonal':
      return 'diag';
    case 'swiss':
      return 'window';
    default:
      return 'card';
  }
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

/** Textura vectorial única de cada tema (8 estilos, cero fondos repetidos). */
function drawThemePattern(ctx: CanvasRenderingContext2D, W: number, H: number, t: Theme, fs: number): void {
  ctx.save();
  switch (t.pattern) {
    case 'iso': {
      // Retícula isométrica tecnológica + destellos neón en cruz.
      ctx.strokeStyle = alpha(t.accent, 0.10);
      ctx.lineWidth = Math.max(1, 1.5 * fs);
      const step = 150 * fs;
      for (let x = -H; x < W + H; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + H * 0.55, H);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + H * 0.55, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      ctx.strokeStyle = alpha(t.accent2, 0.55);
      ctx.lineWidth = Math.max(1.2, 2.5 * fs);
      for (const [px, py, s] of [[W * 0.14, H * 0.3, 20], [W * 0.82, H * 0.16, 26], [W * 0.1, H * 0.78, 18]] as Array<[number, number, number]>) {
        ctx.beginPath();
        ctx.moveTo(px - s * fs, py);
        ctx.lineTo(px + s * fs, py);
        ctx.moveTo(px, py - s * fs);
        ctx.lineTo(px, py + s * fs);
        ctx.stroke();
      }
      break;
    }
    case 'deco': {
      // Arcos art-déco concéntricos + líneas verticales de champán.
      ctx.strokeStyle = alpha(t.accent, 0.16);
      ctx.lineWidth = Math.max(1, 2 * fs);
      for (let r = 120 * fs; r < W * 0.9; r += 110 * fs) {
        ctx.beginPath();
        ctx.arc(W * 0.5, -W * 0.32, r, 0, Math.PI);
        ctx.stroke();
      }
      ctx.strokeStyle = alpha(t.accent, 0.10);
      for (let x = 70 * fs; x < W; x += 90 * fs) {
        ctx.beginPath();
        ctx.moveTo(x, H * 0.62);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      break;
    }
    case 'ember': {
      // Brasas ascendentes con halo cálido.
      const spots: Array<[number, number, number]> = [
        [W * 0.12, H * 0.2, 10], [W * 0.24, H * 0.34, 6], [W * 0.86, H * 0.24, 8], [W * 0.78, H * 0.4, 12],
        [W * 0.08, H * 0.62, 7], [W * 0.9, H * 0.58, 9], [W * 0.5, H * 0.1, 6], [W * 0.35, H * 0.15, 8],
      ];
      for (const [px, py, s] of spots) {
        const g = ctx.createRadialGradient(px, py, 0, px, py, s * 4 * fs);
        g.addColorStop(0, alpha(t.accent2, 0.5));
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, s * 4 * fs, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'clinic': {
      // Cruces clínicas sutiles + pulso ECG horizontal.
      ctx.strokeStyle = alpha(t.accent, 0.14);
      ctx.lineWidth = Math.max(1, 2.5 * fs);
      for (const [px, py, s] of [[W * 0.16, H * 0.2, 16], [W * 0.88, H * 0.34, 20], [W * 0.1, H * 0.75, 14], [W * 0.8, H * 0.12, 12]] as Array<[number, number, number]>) {
        ctx.beginPath();
        ctx.moveTo(px - s * fs, py);
        ctx.lineTo(px + s * fs, py);
        ctx.moveTo(px, py - s * fs);
        ctx.lineTo(px, py + s * fs);
        ctx.stroke();
      }
      ctx.strokeStyle = alpha(t.accent, 0.35);
      ctx.lineWidth = Math.max(1.5, 3 * fs);
      ctx.beginPath();
      ctx.moveTo(0, H * 0.14);
      ctx.lineTo(W * 0.3, H * 0.14);
      ctx.lineTo(W * 0.38, H * 0.07);
      ctx.lineTo(W * 0.46, H * 0.2);
      ctx.lineTo(W * 0.54, H * 0.14);
      ctx.lineTo(W, H * 0.14);
      ctx.stroke();
      break;
    }
    case 'topo': {
      // Curvas topográficas suaves de montaña andina.
      ctx.strokeStyle = alpha(t.accent2, 0.16);
      ctx.lineWidth = Math.max(1, 2 * fs);
      for (let i = 0; i < 6; i++) {
        const baseY = H * (0.12 + i * 0.15);
        ctx.beginPath();
        for (let x = 0; x <= W; x += 24 * fs) {
          const y = baseY + Math.sin(x / (170 * fs) + i * 1.4) * 26 * fs;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      break;
    }
    case 'rows': {
      // Halftone de trigo + surcos horizontales de cultivo.
      ctx.fillStyle = alpha(t.accent, 0.20);
      const rad = 5 * fs;
      for (let row = 0; row < 9; row++) {
        for (let col = 0; col <= row; col++) {
          ctx.beginPath();
          ctx.arc(70 * fs + col * 34 * fs, H * 0.2 + row * 30 * fs, rad, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.strokeStyle = alpha(t.accent2, 0.14);
      ctx.lineWidth = Math.max(1, 2 * fs);
      for (let y = H * 0.72; y < H; y += 46 * fs) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
      break;
    }
    case 'burst': {
      // Cuchillas diagonales de color + halftone viral.
      ctx.fillStyle = alpha(t.accent, 0.10);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(W * 0.55, 0);
      ctx.lineTo(0, H * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = alpha(t.accent2, 0.12);
      ctx.beginPath();
      ctx.moveTo(W, H);
      ctx.lineTo(W * 0.4, H);
      ctx.lineTo(W, H * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = alpha(t.accent, 0.16);
      for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 7; col++) {
          const cx2 = W * 0.62 + col * 38 * fs;
          const cy2 = H * 0.08 + row * 38 * fs;
          const r = (1 - row / 8) * 7 * fs;
          ctx.beginPath();
          ctx.arc(cx2, cy2, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
    case 'mono': {
      // Líneas técnicas diagonales + crosshairs de plano arquitectónico.
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = Math.max(1, 1.5 * fs);
      for (let x = -H; x < W + H; x += 130 * fs) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + H * 0.4, H);
        ctx.stroke();
      }
      ctx.strokeStyle = alpha(t.accent2, 0.5);
      ctx.lineWidth = Math.max(1.2, 2.5 * fs);
      for (const [px, py] of [[W * 0.12, H * 0.24], [W * 0.88, H * 0.2], [W * 0.86, H * 0.8]] as Array<[number, number]>) {
        const s = 26 * fs;
        ctx.beginPath();
        ctx.moveTo(px - s, py);
        ctx.lineTo(px + s, py);
        ctx.moveTo(px, py - s);
        ctx.lineTo(px, py + s);
        ctx.stroke();
      }
      break;
    }
  }
  ctx.restore();
}

/** Adorno vectorial de agencia según el layout (flechas, ráfagas, rayos, checks). */
function drawLayoutOrnament(ctx: CanvasRenderingContext2D, W: number, H: number, t: Theme, layout: Layout, fs: number): void {
  ctx.save();
  ctx.strokeStyle = alpha(t.accent2, 0.5);
  ctx.fillStyle = alpha(t.accent2, 0.5);
  ctx.lineWidth = Math.max(2, 4 * fs);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (layout === 'bento') {
    // Flecha de crecimiento escalonada (esquina superior derecha).
    const x0 = W * 0.6;
    const y0 = H * 0.115;
    ctx.beginPath();
    ctx.moveTo(x0, y0 + 60 * fs);
    ctx.lineTo(x0 + 55 * fs, y0 + 18 * fs);
    ctx.lineTo(x0 + 110 * fs, y0 + 52 * fs);
    ctx.lineTo(x0 + 165 * fs, y0 - 8 * fs);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x0 + 165 * fs, y0 - 8 * fs);
    ctx.lineTo(x0 + 138 * fs, y0 - 2 * fs);
    ctx.moveTo(x0 + 165 * fs, y0 - 8 * fs);
    ctx.lineTo(x0 + 160 * fs, y0 + 20 * fs);
    ctx.stroke();
  } else if (layout === 'magazine') {
    // Anillo de ráfaga con marcas radiales (esquina superior izquierda).
    const cx2 = W * 0.14;
    const cy2 = H * 0.14;
    ctx.beginPath();
    ctx.arc(cx2, cy2, 46 * fs, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx2 + Math.cos(a) * 58 * fs, cy2 + Math.sin(a) * 58 * fs);
      ctx.lineTo(cx2 + Math.cos(a) * 76 * fs, cy2 + Math.sin(a) * 76 * fs);
      ctx.stroke();
    }
  } else if (layout === 'diagonal') {
    // Rayo angular gigante translúcido.
    ctx.fillStyle = alpha(t.accent2, 0.16);
    ctx.beginPath();
    ctx.moveTo(W * 0.78, H * 0.06);
    ctx.lineTo(W * 0.62, H * 0.2);
    ctx.lineTo(W * 0.72, H * 0.21);
    ctx.lineTo(W * 0.56, H * 0.36);
    ctx.lineTo(W * 0.84, H * 0.18);
    ctx.lineTo(W * 0.74, H * 0.17);
    ctx.closePath();
    ctx.fill();
  } else if (layout === 'swiss') {
    // Check circular de ejecutivo (esquina superior derecha).
    const cx2 = W * 0.86;
    const cy2 = H * 0.12;
    ctx.beginPath();
    ctx.arc(cx2, cy2, 42 * fs, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx2 - 18 * fs, cy2);
    ctx.lineTo(cx2 - 4 * fs, cy2 + 15 * fs);
    ctx.lineTo(cx2 + 20 * fs, cy2 - 14 * fs);
    ctx.stroke();
  } else if (layout === 'split') {
    // Doble filo vertical separando las columnas del split.
    ctx.strokeStyle = alpha(t.accent, 0.35);
    ctx.lineWidth = Math.max(1.5, 3 * fs);
    const vx = W * 0.5;
    ctx.beginPath();
    ctx.moveTo(vx, H * 0.06);
    ctx.lineTo(vx, H * 0.94);
    ctx.stroke();
    ctx.strokeStyle = alpha(t.accent2, 0.3);
    ctx.beginPath();
    ctx.moveTo(vx + 12 * fs, H * 0.12);
    ctx.lineTo(vx + 12 * fs, H * 0.88);
    ctx.stroke();
  } else if (layout === 'showcase') {
    // Ondas de vitrina alrededor del medallón.
    ctx.strokeStyle = alpha(t.accent2, 0.3);
    ctx.lineWidth = Math.max(1.5, 3 * fs);
    const cx2 = W * 0.5;
    const cy2 = H * 0.27;
    for (const r of [0.34, 0.4]) {
      ctx.beginPath();
      ctx.arc(cx2, cy2, W * r, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (layout === 'poster') {
    // Barras de cartel cinematográfico arriba y abajo de la tipografía.
    ctx.fillStyle = alpha(t.accent2, 0.55);
    ctx.fillRect(W * 0.07, H * 0.415, W * 0.2, 10 * fs);
    ctx.fillRect(W * 0.07, H * 0.86, W * 0.86, 10 * fs);
  } else {
    // Trío de franjas: ticks diagonales repetidos en la banda de contacto.
    ctx.strokeStyle = alpha(t.accent2, 0.35);
    ctx.lineWidth = Math.max(2, 4 * fs);
    for (let x = 40 * fs; x < W; x += 70 * fs) {
      ctx.beginPath();
      ctx.moveTo(x, H * 0.66);
      ctx.lineTo(x + 26 * fs, H * 0.7);
      ctx.stroke();
    }
  }
  ctx.restore();
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

/** Foto recortada en círculo perfecto (arquitectura medallón). */
function drawPhotoCircle(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cx: number,
  cy: number,
  r: number,
  zoom: number,
  posY: number,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  const s = Math.max((r * 2) / img.width, (r * 2) / img.height) * zoom;
  const iw = img.width * s;
  const ih = img.height * s;
  const drift = ih > r * 2 ? (ih - r * 2) * (0.5 - posY) * 0.8 : 0;
  ctx.drawImage(img, cx - iw / 2, cy - ih / 2 + drift, iw, ih);
  const vig = ctx.createRadialGradient(cx, cy, r * 0.55, cx, cy, r);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = vig;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
}

/** Composición inicial de agencia cuando aún no hay foto (JAMÁS un emoji
 *  flotando en un recuadro vacío): iniciales tipográficas gigantes, anillos
 *  concéntricos y brillo del tema, con la marca ya presente en el lienzo. */
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
  ctx.save();
  rr(ctx, x, y, w, h, 44 * fs);
  ctx.clip();
  // Base del tema + brillo radial de acento.
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, t.bg1);
  g.addColorStop(1, t.bg2);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  const glow = ctx.createRadialGradient(x + w / 2, y + h * 0.42, 0, x + w / 2, y + h * 0.42, w * 0.55);
  glow.addColorStop(0, alpha(t.accent, 0.35));
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x, y, w, h);
  // Anillos concéntricos de luz.
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = Math.max(1, 2.5 * fs);
  for (const r of [0.16, 0.28, 0.4]) {
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h * 0.44, w * r, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Iniciales tipográficas gigantes de la marca.
  const initials = (brand.name || 'IM')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase() || 'IM';
  ctx.textAlign = 'center';
  ctx.font = `900 ${Math.round(w * 0.3)}px "${t.fontD}", system-ui, sans-serif`;
  ctx.fillStyle = alpha(t.accent, 0.92);
  ctx.shadowColor = alpha(t.accent, 0.6);
  ctx.shadowBlur = 60 * fs;
  ctx.fillText(initials, x + w / 2, y + h * 0.52);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  // Nombre del negocio abajo, dentro de la composición.
  ctx.font = `700 ${Math.round(34 * fs)}px system-ui, sans-serif`;
  ctx.fillStyle = t.sub;
  let name = brand.name || 'Impulso';
  while (ctx.measureText(name).width > w - 90 * fs && name.length > 6) name = name.slice(0, -2);
  ctx.fillText(name, x + w / 2, y + h - 52 * fs);
  ctx.restore();
  rr(ctx, x, y, w, h, 44 * fs);
  ctx.strokeStyle = alpha(t.accent, 0.55);
  ctx.lineWidth = Math.max(1, 2.5 * fs);
  ctx.stroke();
  ctx.textAlign = 'left';
}

/** Sello superior glassmorphism con brillo sutil y borde metálico fino. */
function drawBadgeGlass(ctx: CanvasRenderingContext2D, cx: number, y: number, text: string, t: Theme, fs: number, align: 'center' | 'left' = 'center'): number {
  if (!text.trim()) return 0;
  const size = Math.round(34 * fs);
  ctx.font = `800 ${size}px "${t.fontD}", system-ui, sans-serif`;
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

/** Titular de agencia a DOS TONOS con word-wrap garantizado y espacios
 *  SIEMPRE correctos (V8): texto normalizado y ancho de espacio explícito
 *  medido con la misma fuente del titular. */
function drawMixedHeadline(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  plainRaw: string,
  highlightRaw: string,
  maxW: number,
  size: number,
  t: Theme,
  align: 'center' | 'left',
): number {
  const plain = plainRaw.replace(/\s+/g, ' ').trim();
  const highlight = highlightRaw.replace(/\s+/g, ' ').trim();
  type Tok = { w: string; c: string; x: number };
  const tokens: Tok[] = [];
  plain.split(/\s+/).filter(Boolean).forEach((w) => tokens.push({ w, c: t.text, x: 0 }));
  highlight.split(/\s+/).filter(Boolean).forEach((w) => tokens.push({ w, c: t.accent, x: 0 }));
  if (tokens.length === 0) return 0;
  ctx.font = `900 ${size}px "${t.fontD}", system-ui, sans-serif`;
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
  ctx.font = `900 ${big}px "${t.fontD}", system-ui, sans-serif`;
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
  ctx.font = `900 ${big}px "${t.fontD}", system-ui, sans-serif`;
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
  ctx.font = `900 ${Math.round(40 * fs)}px "${t.fontD}", system-ui, sans-serif`;
  let name = brand.name || 'Impulso';
  while (ctx.measureText(name).width > maxTextW && name.length > 4) name = name.slice(0, -2);
  ctx.fillText(name, x + pad, y + pad + 40 * fs);
  ctx.font = `600 ${Math.round(26 * fs)}px system-ui, sans-serif`;
  ctx.fillStyle = t.sub;
  let addr = `📍 ${brand.address || brand.municipality || 'Gachetá'}`;
  while (ctx.measureText(addr).width > maxTextW && addr.length > 6) addr = addr.slice(0, -2);
  ctx.fillText(addr, x + pad, y + pad + 78 * fs);
  ctx.font = `900 ${Math.round(44 * fs)}px "${t.fontD}", system-ui, sans-serif`;
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
  ctx.font = `900 ${Math.round(38 * fs)}px "${t.fontD}", system-ui, sans-serif`;
  ctx.fillText((brand.name || 'Impulso').slice(0, 30), 60 * fs, y + 48 * fs);
  ctx.font = `900 ${Math.round(34 * fs)}px "${t.fontD}", system-ui, sans-serif`;
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
  drawThemePattern(ctx, W, H, t, fs);
  drawLayoutOrnament(ctx, W, H, t, a.layout, fs);

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
  if (a.layout === 'split') {
    // 🪟 SPLIT DOBLE: columna de texto a la izquierda, foto a la derecha.
    const margin = 64 * fs;
    const colX = margin;
    const colW = W * 0.48 - margin;
    const photoX = W * 0.54;
    const photoW = W - photoX - margin;
    const photoY = 140 * fs;
    const photoH = H * 0.5;
    if (a.photo) drawPhotoBox(ctx, a.photo, photoX, photoY, photoW, photoH, 'card', a.zoom, a.posY, t, fs);
    else drawPhotoPlaceholder(ctx, photoX, photoY, photoW, photoH, a.brand, t, fs);
    if (a.badge) drawBadgeGlass(ctx, colX, photoY, a.badge, t, fs * 0.85, 'left');
    let y = photoY + 30 * fs;
    y += drawMixedHeadline(ctx, colX, y + 72 * fs, T.plain, T.highlight, colW, 72 * fs, t, 'left') + 12 * fs;
    if (T.sub.trim()) {
      ctx.font = `600 ${Math.round(30 * fs)}px system-ui, sans-serif`;
      ctx.fillStyle = t.sub;
      const lines = wrapLines(ctx, T.sub, colW, 3);
      for (const line of lines) {
        ctx.fillText(line, colX, y + 30 * fs);
        y += 40 * fs;
      }
      y += 6 * fs;
    }
    if (a.showBenefits) y = drawBenefitPills(ctx, colX + colW / 2, y + 12 * fs, T.benefits, t, colW, fs * 0.72) + 12 * fs;
    if (a.showPrice) drawPriceFloat(ctx, a.brand, priceText(), t, fs, colX + colW / 2, H - 250 * fs, 'center');
    const dockH = 180 * fs;
    if (a.showQr && a.qr) drawDock(ctx, margin, H - dockH - 50 * fs, W - margin * 2, dockH, a.brand, a.qr, t, fs, true);
    else drawContactBar(ctx, W, H, a.brand, a.qr, t, fs, false);
    return;
  }
  if (a.layout === 'showcase') {
    // 🔵 MEDALLÓN: foto circular de vitrina con anillos + texto centrado.
    const r = W * 0.3;
    const cy = 170 * fs + r;
    if (a.badge) drawBadgeGlass(ctx, W / 2, 80 * fs, a.badge, t, fs);
    if (a.photo) drawPhotoCircle(ctx, a.photo, W / 2, cy, r, a.zoom, a.posY);
    else drawPhotoPlaceholder(ctx, W / 2 - r, cy - r, r * 2, r * 2, a.brand, t, fs);
    ctx.strokeStyle = alpha(t.accent, 0.85);
    ctx.lineWidth = Math.max(3, 7 * fs);
    ctx.beginPath();
    ctx.arc(W / 2, cy, r + 14 * fs, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = alpha(t.accent2, 0.4);
    ctx.lineWidth = Math.max(1.5, 3 * fs);
    ctx.beginPath();
    ctx.arc(W / 2, cy, r + 34 * fs, 0, Math.PI * 2);
    ctx.stroke();
    let y = cy + r + 80 * fs;
    y += drawMixedHeadline(ctx, W / 2, y + 92 * fs, T.plain, T.highlight, W - 160, 92 * fs, t, 'center') + 12 * fs;
    y += drawSub(y) + 10 * fs;
    if (a.showBenefits) y = drawBenefitPills(ctx, W / 2, y + 10 * fs, T.benefits, t, W - 250, fs * 0.8) + 12 * fs;
    const barH = 150 * fs;
    if (a.showPrice) drawPriceFloat(ctx, a.brand, priceText(), t, fs, W / 2, H - barH - 34 * fs, 'center');
    bottomContact();
    return;
  }
  if (a.layout === 'poster') {
    // 🖤 POSTER IMPACTO: foto a sangre + tipografía gigante alineada a la izquierda.
    const photoH = H * 0.66;
    if (a.photo) drawPhotoBox(ctx, a.photo, 0, 0, W, photoH, 'full', a.zoom, a.posY, t, fs);
    else drawPhotoPlaceholder(ctx, 0, 0, W, photoH, a.brand, t, fs);
    const gBot = ctx.createLinearGradient(0, photoH * 0.35, 0, photoH);
    gBot.addColorStop(0, 'rgba(0,0,0,0)');
    gBot.addColorStop(1, alpha(t.bg1, 0.97));
    ctx.fillStyle = gBot;
    ctx.fillRect(0, photoH * 0.35, W, photoH * 0.65);
    if (a.badge) drawBadgeGlass(ctx, 70 * fs, 90 * fs, a.badge, t, fs, 'left');
    let y = photoH - 60 * fs;
    y += drawMixedHeadline(ctx, 70 * fs, y + 116 * fs, T.plain, T.highlight, W - 140 * fs, 116 * fs, t, 'left') + 16 * fs;
    if (T.sub.trim()) {
      ctx.font = `600 ${Math.round(38 * fs)}px system-ui, sans-serif`;
      ctx.fillStyle = t.sub;
      const lines = wrapLines(ctx, T.sub, W - 220 * fs, 2);
      for (const line of lines) {
        ctx.fillText(line, 70 * fs, y + 38 * fs);
        y += 50 * fs;
      }
      y += 8 * fs;
    }
    if (a.showBenefits) y = drawBenefitPills(ctx, W / 2, y + 12 * fs, T.benefits, t, W - 250, fs * 0.78) + 12 * fs;
    const barH = 150 * fs;
    if (a.showPrice) drawPriceFloat(ctx, a.brand, priceText(), t, fs, W - 80 * fs, H - barH - 40 * fs, 'right');
    bottomContact();
    return;
  }
  if (a.layout === 'strip') {
    // 🎞️ TRÍO DE FRANJAS: foto arriba, banda de titular, contacto abajo.
    const band1 = H * 0.32;
    if (a.photo) drawPhotoBox(ctx, a.photo, 0, 0, W, band1, 'full', a.zoom, a.posY, t, fs);
    else drawPhotoPlaceholder(ctx, 0, 0, W, band1, a.brand, t, fs);
    if (a.badge) drawBadgeGlass(ctx, W / 2, band1 - 56 * fs, a.badge, t, fs * 0.9);
    // Banda 2: panel de titular con doble filo de acento.
    const band2 = H * 0.36;
    ctx.fillStyle = alpha(t.bg2, 0.9);
    ctx.fillRect(0, band1, W, band2);
    ctx.strokeStyle = alpha(t.accent, 0.7);
    ctx.lineWidth = Math.max(2, 5 * fs);
    ctx.beginPath();
    ctx.moveTo(0, band1 + 3 * fs);
    ctx.lineTo(W, band1 + 3 * fs);
    ctx.moveTo(0, band1 + band2 - 3 * fs);
    ctx.lineTo(W, band1 + band2 - 3 * fs);
    ctx.stroke();
    let y = band1 + 70 * fs;
    y += drawMixedHeadline(ctx, W / 2, y + 88 * fs, T.plain, T.highlight, W - 170, 88 * fs, t, 'center') + 12 * fs;
    y += drawSub(y) + 10 * fs;
    if (a.showBenefits) y = drawBenefitPills(ctx, W / 2, y + 8 * fs, T.benefits, t, W - 260, fs * 0.72) + 8 * fs;
    // Banda 3: precio flotante + contacto.
    if (a.showPrice) drawPriceFloat(ctx, a.brand, priceText(), t, fs, W / 2, H - 170 * fs, 'center');
    bottomContact();
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
    ctx.font = `900 ${Math.round(80 * fs)}px "${t.fontD}", system-ui, sans-serif`;
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
    ctx.font = `900 ${Math.round(54 * fs)}px "${t.fontD}", system-ui, sans-serif`;
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

/** Texto honesto cuando aún no hay campaña generada (NUNCA copy prefabricado). */
const EMPTY_COPY = '✨ Genera la campaña con IA y este texto aparecerá aquí';

type CopyTab = 'pas' | 'aida' | 'estados' | 'reel' | 'cierres';

/** Clave de autoguardado del estudio (V9: llave limpia, sin herencia corrupta). */
const MARKETING_DRAFT_KEY = 'impulso_studio_v9_clean';

/** Llaves heredadas corruptas que se purgan al montar (V7/V8). */
const LEGACY_DRAFT_KEYS = ['impulso_draft_marketing_v7', 'impulso_draft_marketing_v8'];

/** Marcadores del borrador corrupto del fallback tonto (V7). */
const DIRTY_RE =
  /delpueblo|del pueblo, hecho con|esun|marketingdigital|lo que todos comentan|domicilio disponible/i;

/** Sanitizador V9: si un campo trae basura del fallback tonto, lo devuelve
 *  vacío para que los valores limpios de agencia lo reemplacen al instante. */
function sanitizeLegacy(value: unknown): string {
  const v = typeof value === 'string' ? value : '';
  return DIRTY_RE.test(v) ? '' : v;
}

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
  /** Generación actual de foto: invalida descargas en segundo plano si el
   *  admin cambia o sube una foto manualmente mientras tanto. */
  const photoGenRef = useRef(0);

  // ── Autoguardado instantáneo (cero pérdida de datos del admin) ──
  /** Evita que el autoguardado pise el borrador con vacíos antes de restaurar. */
  const draftReadyRef = useRef(false);

  // V9: purga de borradores heredados corruptos ANTES de restaurar nada.
  useEffect(() => {
    try {
      for (const key of LEGACY_DRAFT_KEYS) localStorage.removeItem(key);
    } catch {
      /* localStorage bloqueado: continuar sin purga */
    }
  }, []);

  // Restaurar el borrador al montar el estudio (con sanitizador anti-basura).
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
        plain: sanitizeLegacy(d.texts.plain),
        highlight: sanitizeLegacy(d.texts.highlight),
        sub: sanitizeLegacy(d.texts.sub),
        benefits:
          Array.isArray(d.texts.benefits) && d.texts.benefits.length === 3
            ? d.texts.benefits.map((b) => sanitizeLegacy(b))
            : ['', '', ''],
        cta: sanitizeLegacy(d.texts.cta),
        priceLabel: sanitizeLegacy(d.texts.priceLabel) || '💬 Cotiza gratis por WhatsApp',
      });
    }
    if (typeof d.themeIdx === 'number' && d.themeIdx >= 0 && d.themeIdx < THEMES.length) setThemeIdx(d.themeIdx);
    if (d.format === 'story' || d.format === 'square') setFormat(d.format);
    if (LAYOUTS.some((l) => l.id === d.layout)) setLayout(d.layout as Layout);
    if (d.piece === 0 || d.piece === 1 || d.piece === 2 || d.piece === 3) setPiece(d.piece);
    if (typeof d.badgeMode === 'string') setBadgeMode(d.badgeMode);
    if (typeof d.badgeCustom === 'string') setBadgeCustom(sanitizeLegacy(d.badgeCustom));
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

  // ── Cero cuadros vacíos (V8): al elegir negocio, carga al instante una foto
  // editorial del rubro detectado (en silencio, sin toast) para que el lienzo
  // jamás muestre un recuadro vacío con un emoji.
  const hasBrandNow = mode === 'plataforma' ? merchantId !== '' : extName.trim() !== '';
  useEffect(() => {
    if (!hasBrandNow) return;
    if (customPhoto || brand.photo) return;
    let alive = true;
    const genId = ++photoGenRef.current;
    const merchantCategory = merchants.find((m) => m.id === merchantId)?.category;
    const industry: IndustryType = merchantCategory
      ? industryFromHint(merchantCategory)
      : guessIndustry(`${extName} ${extSlogan} ${extProduct} ${briefText}`);
    void (async () => {
      const dataUrl = await loadCuratedIndustryPhoto(industry);
      if (alive && dataUrl && photoGenRef.current === genId) setCustomPhoto(dataUrl);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasBrandNow, customPhoto, brand.photo, mode, merchantId, extName, extSlogan, extProduct]);

  /** Textos por defecto derivados de la marca (siempre neutrales y honestos). */
  const dflt = useMemo<Texts>(() => {
    const service = priceMode === 'servicio';
    return {
      plain: brand.name || 'Lo mejor del pueblo',
      highlight: brand.product || 'HOY',
      sub: brand.slogan || 'Atención de primera, cerca de ti',
      benefits: service
        ? ['🤝 Atención personalizada', '⏱️ Respuesta rápida', '📍 Cerca de ti en el pueblo']
        : ['🥇 Calidad garantizada', '⚡ Atención inmediata', '⏰ Disponible HOY'],
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

  // V9: re-render del lienzo cuando las Google Fonts de agencia terminan de
  // cargar (evita afiches dibujados con la fuente de reserva del sistema).
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    const families = ['Anton', 'Archivo Black', 'Bebas Neue', 'Playfair Display', 'Space Grotesk'];
    let alive = true;
    void Promise.all(families.map((f) => document.fonts.load(`900 64px "${f}"`)))
      .then(() => {
        if (alive) setFontsReady(true);
      })
      .catch(() => {
        /* Sin fuentes disponibles: el canvas sigue con la de reserva */
      });
    return () => {
      alive = false;
    };
  }, []);

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
  }, [themeIdx, format, layout, piece, photoImg, qrImg, brand, T, badge, showPrice, showBenefits, showQr, photoZoom, photoPosY, fontsReady]);

  /** ✨ Cadena V9: el BRIEF es la fuente maestra única (sirve solo, sin
   *  elegir comercio). PASADA 1 → foto instantánea → PASADA 2, con variación
   *  infinita (semilla creativa + evitación del tema/layout anterior). */
  async function generate(): Promise<void> {
    if (!brand.name.trim() && !briefText.trim()) {
      toast.error('Escribe el brief del negocio: la IA deduce todo desde ahí ✨');
      return;
    }
    setGenerating(true);
    const genId = ++photoGenRef.current;
    const merchantCategory = merchants.find((m) => m.id === merchantId)?.category;
    const lastArt = campaign;
    try {
      // ── PASADA 1 · Estrategia y dirección de arte ──
      toast.info('🧠 Pasada 1/2 · Analizando el brief y diseñando la dirección de arte…');
      const input = {
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
        categoryHint: merchantCategory,
        previousThemeId: lastArt?.themeId,
        previousLayoutId: lastArt?.layoutId,
      };
      const art: ArtDirection = await generateArtDirection(input);
      // ¿Solo el brief? La IA dedujo marca y producto: los adopta el estudio.
      if (!brand.name.trim()) {
        setMode('externo');
        setExtName(art.brandName);
        setExtProduct(art.productTitle);
        setExtSlogan(art.valueProposition.slice(0, 90));
      }
      const bizName = brand.name.trim() || art.brandName;
      const product = brand.product.trim() || art.productTitle;
      // Aplica el tema y layout recomendados por la IA (rota por rubro).
      const ti = THEMES.findIndex((t) => t.id === art.themeId);
      if (ti >= 0) setThemeIdx(ti);
      if (LAYOUTS.some((l) => l.id === art.layoutId)) setLayout(art.layoutId as Layout);

      // ── Auto-imagen paso 1: fotografía editorial del rubro AL INSTANTE ──
      toast.info(`📷 Foto editorial instantánea del rubro ${INDUSTRY_LABELS[art.industryType]}…`);
      const curated = await loadCuratedIndustryPhoto(art.industryType);
      if (curated && photoGenRef.current === genId) setCustomPhoto(curated);

      // ── Auto-imagen paso 2 (segundo plano): foto IA a medida con el prompt ──
      void (async () => {
        try {
          const seed = Math.floor(Math.random() * 999999);
          const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(art.imagePromptEn)}?width=1080&height=1080&nologo=true&enhance=true&seed=${seed}`;
          const img = await loadImage(url);
          const off = document.createElement('canvas');
          off.width = 1080;
          off.height = 1080;
          const octx = off.getContext('2d');
          if (!octx) return;
          octx.drawImage(img, 0, 0, 1080, 1080);
          if (photoGenRef.current === genId) {
            setCustomPhoto(off.toDataURL('image/jpeg', 0.92));
            toast.success('🎨 Foto IA a medida colocada en el lienzo');
          }
        } catch {
          // Se mantiene la foto editorial instantánea del rubro.
        }
      })();

      // ── PASADA 2 · Copywriting senior con la estrategia de la pasada 1 ──
      toast.info('✍️ Pasada 2/2 · Copywriting senior de agencia…');
      const res: MarketingCampaign = await generateCampaignCopy(
        { ...input, businessName: bizName, product },
        art,
      );
      setCampaign(res);
      const benefits = [res.benefits[0] ?? '', res.benefits[1] ?? '', res.benefits[2] ?? ''];
      setTexts((prev) => ({
        plain: normSpaces(res.headline.plain),
        highlight: normSpaces(res.headline.highlight),
        sub: normSpaces(res.sub),
        benefits: benefits.map((b) => normSpaces(b)),
        cta: normSpaces(res.cta),
        priceLabel: res.priceLabel ?? prev.priceLabel,
      }));
      setBadgeCustom(normSpaces(res.badgeText));
      setBadgeMode('custom');
      toast.success(`✨ ¡Campaña única lista! Tema ${ti >= 0 ? THEMES[ti].label.split(' ').slice(1).join(' ') : art.themeId} + layout ${art.layoutId} aplicados`);
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
        photoGenRef.current += 1; // invalida descargas IA en curso
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
    const genId = ++photoGenRef.current;
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
      if (photoGenRef.current === genId) {
        setCustomPhoto(off.toDataURL('image/jpeg', 0.92));
        toast.success(vary ? '🎲 Nueva toma fotográfica lista' : '🎨 Foto publicitaria IA lista');
      }
    } catch {
      toast.error('El motor de foto IA no respondió: prueba un preset HD o sube una foto');
    } finally {
      setPhotoBusy(false);
    }
  }

  /** Preset fotográfico HD por rubro (Unsplash CORS-safe). */
  async function usePreset(preset: { id: string; label: string }): Promise<void> {
    setPhotoBusy(true);
    const genId = ++photoGenRef.current;
    try {
      const img = await loadImage(PRESET_URL(preset.id));
      const off = document.createElement('canvas');
      off.width = 1080;
      off.height = 1080;
      const octx = off.getContext('2d');
      if (!octx) throw new Error('canvas');
      octx.drawImage(img, 0, 0, 1080, 1080);
      if (photoGenRef.current === genId) {
        setCustomPhoto(off.toDataURL('image/jpeg', 0.9));
        toast.success(`${preset.label}: foto HD aplicada`);
      }
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
      `1️⃣ ${c?.whatsappStatusSequence.status1 || EMPTY_COPY}`,
      `2️⃣ ${c?.whatsappStatusSequence.status2 || EMPTY_COPY}`,
      `3️⃣ ${c?.whatsappStatusSequence.status3 || EMPTY_COPY}`,
      `═══════════════════════════`,
      `📣 COPY PAS (Facebook / Instagram)`,
      c?.socialMediaCopy.pas || EMPTY_COPY,
      `📣 COPY AIDA FLASH (Grupos / Clasificados)`,
      c?.socialMediaCopy.aida || EMPTY_COPY,
      `═══════════════════════════`,
      `🎬 GUION REEL 15 SEGUNDOS`,
      `· 0-3 s: ${c?.videoReelScript.t0_3 || EMPTY_COPY}`,
      `· 3-10 s: ${c?.videoReelScript.t3_10 || EMPTY_COPY}`,
      `· 10-15 s: ${c?.videoReelScript.t10_15 || EMPTY_COPY}`,
      `═══════════════════════════`,
      `💬 RESPUESTAS DE CIERRE PARA EL COMERCIANTE`,
      `· ¿Precio? ${c?.salesClosingTemplates.priceReply || EMPTY_COPY}`,
      `· Indeciso: ${c?.salesClosingTemplates.hesitantReply || EMPTY_COPY}`,
      `· Despacho: ${c?.salesClosingTemplates.dispatchUpsell || EMPTY_COPY}`,
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
          Suite profesional: brief IA que lo deduce TODO, fotografía publicitaria generada en el navegador, 8
          arquitecturas de afiche con tipografía de agencia y piezas HD 1080p con QR real — 0 bytes en la base de datos.
          Todo se autoguarda mientras trabajas.
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
            🆕 V9: este brief <strong className="text-impulso-mint">sirve SOLO</strong> — no necesitas llenar nada más.
            De una frase como "Es un servicio de marketing digital nuevo", la IA deduce el nombre del negocio, el
            servicio estrella, el titular, los 3 beneficios, el sello, el precio/cotización, todo el copy (PAS, AIDA,
            Estados, Reel y cierres), el tema, la arquitectura del afiche y la foto. Cada clic genera una propuesta 100%
            diferente.
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
            disabled={generating}
            className="pressable flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-impulso-emerald to-teal-600 py-3 text-xs font-extrabold text-white shadow-glow disabled:opacity-40 disabled:shadow-none"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? '🧠 Diseñando campaña y arte único con IA...' : '✨ Generar Campaña y Diseño con IA'}
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
            <CopyBlock text={campaign?.socialMediaCopy.pas || EMPTY_COPY} tag="Fórmula PAS · Facebook / Instagram" onCopy={copyText} copied={copied} inputCls={inputCls} />
          )}
          {copyTab === 'aida' && (
            <CopyBlock text={campaign?.socialMediaCopy.aida || EMPTY_COPY} tag="Fórmula AIDA Flash · Grupos / Clasificados" onCopy={copyText} copied={copied} inputCls={inputCls} />
          )}
          {copyTab === 'estados' && (
            <div className="space-y-2">
              <CopyBlock text={campaign?.whatsappStatusSequence.status1 || EMPTY_COPY} tag="Estado 1 · 9:00/11:00 · Curiosidad" onCopy={copyText} copied={copied} inputCls={inputCls} />
              <CopyBlock text={campaign?.whatsappStatusSequence.status2 || EMPTY_COPY} tag="Estado 2 · Con la pieza 2 · Revelación" onCopy={copyText} copied={copied} inputCls={inputCls} />
              <CopyBlock text={campaign?.whatsappStatusSequence.status3 || EMPTY_COPY} tag="Estado 3 · 19:00 · Escasez + prueba social" onCopy={copyText} copied={copied} inputCls={inputCls} />
            </div>
          )}
          {copyTab === 'reel' && (
            <div className="space-y-2">
              <CopyBlock text={campaign?.videoReelScript.t0_3 || EMPTY_COPY} tag="⏱️ 0-3 s · Gancho visual" onCopy={copyText} copied={copied} inputCls={inputCls} />
              <CopyBlock text={campaign?.videoReelScript.t3_10 || EMPTY_COPY} tag="⏱️ 3-10 s · Demostración" onCopy={copyText} copied={copied} inputCls={inputCls} />
              <CopyBlock text={campaign?.videoReelScript.t10_15 || EMPTY_COPY} tag="⏱️ 10-15 s · Cierre con dirección" onCopy={copyText} copied={copied} inputCls={inputCls} />
            </div>
          )}
          {copyTab === 'cierres' && (
            <div className="space-y-2">
              <CopyBlock text={campaign?.salesClosingTemplates.priceReply || EMPTY_COPY} tag="💸 Cuando preguntan ¿precio?" onCopy={copyText} copied={copied} inputCls={inputCls} />
              <CopyBlock text={campaign?.salesClosingTemplates.hesitantReply || EMPTY_COPY} tag="🤔 Cliente indeciso" onCopy={copyText} copied={copied} inputCls={inputCls} />
              <CopyBlock text={campaign?.salesClosingTemplates.dispatchUpsell || EMPTY_COPY} tag="🛵 Confirmación + upsell" onCopy={copyText} copied={copied} inputCls={inputCls} />
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



