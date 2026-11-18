/**
 * 🎨 MOTOR DE DISEÑO EDITORIAL ÉLITE V19.0 (html-to-image 1080p)
 *
 * Artboard HTML/CSS/SVG de agencia a 540×960 (Historia 9:16) o 540×540 (Post 1:1),
 * exportado con `toPng(node, { pixelRatio: 2 })` → PNG 1080p ultra-nítido:
 *  · Cero "parche blanco": Dock Glassmorphism translúcido con backdrop-blur,
 *    filete luminoso superior, tipografía calibrada y marco mínimo ceñido al QR.
 *  · Dinamismo real de beneficios: alterna entre Insignias Circulares Flotantes,
 *    Cajas Bento Asimétricas, Declaraciones Editoriales Grandes (sin viñetas) y Cintas.
 *  · Tipografía Display monumental (ocupa ~90% del ancho con escalado óptico).
 *  · Efectos Out-of-Bounds, cortes diagonales geométricos y solapamiento editorial.
 */

import type { CSSProperties, ReactElement } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, MapPin, Phone, ShieldCheck, Zap } from 'lucide-react';
import { extractInitials, themeQrPalette } from '../../utils/styledQr';
import type { QrStyle } from '../../utils/styledQr';
import { contrastTextOn, ensureContrastColor, ensureReadableAccent, mixHex, relativeLuminance } from '../../utils/colorPalette';
import type { ExtractedBrandPalette } from '../../utils/colorPalette';

export type AfficheFormat = 'story' | 'square';
export type AfficheQrMode = 'wa' | 'perfil' | 'oferta' | 'externo';
export type AfficheLayout =
  | 'bento' | 'magazine' | 'diagonal' | 'polaroid' | 'arc' | 'portal' | 'swiss'
  | 'split' | 'brutal' | 'vip' | 'cyber' | 'rustic' | 'retail' | 'eco' | 'cinema' | 'float'
  | 'hud' | 'resort' | 'menu' | 'clinic' | 'agro' | 'diamond' | 'flash' | 'bento3d'
  | 'diagx' | 'orbits' | 'bleed' | 'zen'
  | 'immersive' | 'collage';
export type AffichePiece = 0 | 1 | 2 | 3;
export type BenefitPresentation = 'auto' | 'badges' | 'bento' | 'editorial' | 'ribbons' | 'watermark' | 'callouts';
export type DockVariant = 'auto' | 'corner' | 'centered' | 'glass';

export interface AfficheTheme {
  id: string;
  label: string;
  light?: boolean;
  font: string;
  text: string;
  sub: string;
  accent: string;
  accent2: string;
  bg: string;
  bgSize?: string;
}

export const AFFICHE_THEMES: AfficheTheme[] = [
  {
    id: 'wood', label: '🪵 Madera Nogal & Brasa', font: 'Anton',
    text: '#fff6ea', sub: '#e2c9a8', accent: '#f59e0b', accent2: '#fbbf24',
    bg:
      'repeating-linear-gradient(180deg, rgba(0,0,0,0.30) 0px, rgba(0,0,0,0.30) 2px, transparent 2px, transparent 46px),' +
      'repeating-linear-gradient(90deg, rgba(0,0,0,0.10) 0px, rgba(0,0,0,0.10) 2px, transparent 2px, transparent 110px),' +
      'radial-gradient(ellipse 420px 200px at 22% 0%, rgba(245,158,11,0.28), transparent 60%),' +
      'linear-gradient(135deg, #4a2c17, #2b1a0e)',
  },
  {
    id: 'marble', label: '🏛️ Mármol Carrara & Oro', font: 'Playfair Display', light: true,
    text: '#1c1917', sub: '#57534e', accent: '#b8860b', accent2: '#9a7b3f',
    bg:
      'radial-gradient(420px 220px at 82% 8%, rgba(180,134,11,0.14), transparent 60%),' +
      'radial-gradient(380px 200px at 8% 82%, rgba(120,112,100,0.16), transparent 60%),' +
      'linear-gradient(105deg, rgba(255,255,255,0.65) 0 18%, transparent 18% 46%, rgba(255,255,255,0.5) 46% 60%, transparent 60%),' +
      'linear-gradient(135deg, #f7f4ee, #e6dfd1)',
  },
  {
    id: 'cyber', label: '🚀 Cyber Marketing & Neón', font: 'Space Grotesk',
    text: '#eaf2ff', sub: '#9fb3d9', accent: '#22d3ee', accent2: '#a855f7',
    bg:
      'radial-gradient(320px 190px at 85% 6%, rgba(168,85,247,0.38), transparent 62%),' +
      'radial-gradient(420px 240px at 6% 88%, rgba(34,211,238,0.26), transparent 62%),' +
      'repeating-linear-gradient(90deg, rgba(34,211,238,0.09) 0px, rgba(34,211,238,0.09) 1px, transparent 1px, transparent 46px),' +
      'repeating-linear-gradient(0deg, rgba(34,211,238,0.07) 0px, rgba(34,211,238,0.07) 1px, transparent 1px, transparent 46px),' +
      'linear-gradient(160deg, #090d1f, #141c46)',
  },
  {
    id: 'kraft', label: '📜 Papel Kraft & Tinta', font: 'Archivo Black', light: true,
    text: '#2b2118', sub: '#6b5844', accent: '#8c5a2b', accent2: '#2f5d3a',
    bg:
      'radial-gradient(circle 2px at 14px 14px, rgba(120,90,50,0.22) 1.6px, transparent 2.4px),' +
      'radial-gradient(circle 2px at 38px 34px, rgba(255,255,255,0.35) 1.2px, transparent 2px),' +
      'linear-gradient(150deg, #efe4cc, #d8c5a0)',
    bgSize: '26px 26px, 44px 44px, 100% 100%',
  },
  {
    id: 'ember', label: '🔥 Piedra Volcánica & Fuego', font: 'Anton',
    text: '#fff3e4', sub: '#e6c4a3', accent: '#f97316', accent2: '#fbbf24',
    bg:
      'radial-gradient(300px 170px at 50% 102%, rgba(249,115,22,0.55), transparent 65%),' +
      'radial-gradient(210px 130px at 86% 18%, rgba(251,191,36,0.20), transparent 62%),' +
      'repeating-linear-gradient(45deg, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 3px, transparent 3px, transparent 9px),' +
      'linear-gradient(160deg, #3b0d06, #180808)',
  },
  {
    id: 'emerald', label: '🌿 Selva Esmeralda & Sol', font: 'Archivo Black',
    text: '#eafff5', sub: '#a7d8c4', accent: '#10b981', accent2: '#fde047',
    bg:
      'radial-gradient(240px 150px at 80% 10%, rgba(253,224,71,0.18), transparent 60%),' +
      'radial-gradient(120px 120px at 16% 30%, rgba(16,185,129,0.35), transparent 65%),' +
      'radial-gradient(380px 230px at 10% 92%, rgba(16,185,129,0.30), transparent 62%),' +
      'linear-gradient(160deg, #0e3a2a, #061812)',
  },
  {
    id: 'obsidian', label: '💎 Obsidiana & Champán', font: 'Playfair Display',
    text: '#fff7e6', sub: '#cfc8b8', accent: '#f59e0b', accent2: '#fde68a',
    bg:
      'repeating-linear-gradient(45deg, rgba(245,158,11,0.06) 0px, rgba(245,158,11,0.06) 2px, transparent 2px, transparent 16px),' +
      'radial-gradient(320px 190px at 82% 8%, rgba(245,158,11,0.22), transparent 62%),' +
      'linear-gradient(150deg, #141118, #08080a)',
  },
  {
    id: 'clinic', label: '🩺 Cristal Clínico Zafiro', font: 'Space Grotesk', light: true,
    text: '#0f2436', sub: '#4a6478', accent: '#0284c7', accent2: '#0ea5e9',
    bg:
      'radial-gradient(190px 130px at 84% 10%, rgba(14,165,233,0.20), transparent 62%),' +
      'radial-gradient(110px 110px at 90% 22%, rgba(14,165,233,0.16), transparent 62%),' +
      'linear-gradient(160deg, #f2f9fd, #dcecf5)',
  },
  {
    id: 'terracotta', label: '🧱 Terracota & Sol Andino', font: 'Bebas Neue',
    text: '#fff7ed', sub: '#fcd9b6', accent: '#fdba74', accent2: '#fde68a',
    bg:
      'repeating-conic-gradient(from -90deg at 50% -40px, rgba(253,230,138,0.16) 0deg 9deg, transparent 9deg 18deg),' +
      'radial-gradient(280px 160px at 50% 104%, rgba(120,53,15,0.55), transparent 65%),' +
      'linear-gradient(160deg, #b45309, #7c2d12)',
  },
  {
    id: 'pop', label: '⚡ Neobrutalismo Pop Viral', font: 'Archivo Black', light: true,
    text: '#111827', sub: '#3f3f46', accent: '#111827', accent2: '#dc2626',
    bg:
      'radial-gradient(circle 26px at 88% 9%, rgba(220,38,38,0.95) 24px, transparent 26px),' +
      'repeating-radial-gradient(circle at 102% 102%, rgba(17,24,39,0.16) 0px, rgba(17,24,39,0.16) 7px, transparent 7px, transparent 15px),' +
      'linear-gradient(160deg, #fde047, #facc15)',
  },
  {
    id: 'aurora', label: '🌌 Aurora & Glassmorphism', font: 'Bebas Neue',
    text: '#fdf4ff', sub: '#d8b4fe', accent: '#ec4899', accent2: '#2dd4bf',
    bg:
      'radial-gradient(300px 190px at 18% 14%, rgba(236,72,153,0.45), transparent 62%),' +
      'radial-gradient(260px 180px at 86% 28%, rgba(45,212,191,0.35), transparent 62%),' +
      'radial-gradient(380px 250px at 50% 96%, rgba(99,102,241,0.42), transparent 65%),' +
      'linear-gradient(170deg, #2b0a4e, #12071f)',
  },
  {
    id: 'slate', label: '📐 Estudio Suizo Titanio', font: 'Archivo Black',
    text: '#ffffff', sub: '#b9bec9', accent: '#ffffff', accent2: '#84cc16',
    bg:
      'repeating-linear-gradient(135deg, rgba(255,255,255,0.035) 0px, rgba(255,255,255,0.035) 1px, transparent 1px, transparent 28px),' +
      'radial-gradient(280px 160px at 88% 10%, rgba(132,204,22,0.14), transparent 62%),' +
      'linear-gradient(160deg, #2a2e35, #181b20)',
  },
  {
    id: 'arena', label: '🏜️ Arena Dorada & Sable', font: 'Archivo Black', light: true,
    text: '#292017', sub: '#6d5c44', accent: '#c2410c', accent2: '#d97706',
    bg:
      'radial-gradient(300px 170px at 16% 10%, rgba(217,119,6,0.20), transparent 60%),' +
      'radial-gradient(260px 160px at 88% 88%, rgba(194,65,12,0.15), transparent 60%),' +
      'repeating-linear-gradient(45deg, rgba(120,90,40,0.05) 0px, rgba(120,90,40,0.05) 2px, transparent 2px, transparent 14px),' +
      'linear-gradient(155deg, #fbf1de, #ecd9b6)',
  },
  {
    id: 'vino', label: '🍷 Vino Tinto & Oro Viejo', font: 'Anton',
    text: '#fdf2f4', sub: '#e0bcc4', accent: '#fbbf24', accent2: '#fde68a',
    bg:
      'radial-gradient(320px 190px at 84% 8%, rgba(251,191,36,0.22), transparent 62%),' +
      'radial-gradient(300px 180px at 10% 90%, rgba(127,29,29,0.55), transparent 65%),' +
      'repeating-linear-gradient(45deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 2px, transparent 2px, transparent 16px),' +
      'linear-gradient(160deg, #4c0519, #1f0509)',
  },
  {
    id: 'oceano', label: '🌊 Océano Profundo & Aqua', font: 'Space Grotesk',
    text: '#eafcff', sub: '#9fc8d8', accent: '#22d3ee', accent2: '#38bdf8',
    bg:
      'radial-gradient(340px 200px at 82% 6%, rgba(56,189,248,0.32), transparent 62%),' +
      'radial-gradient(300px 190px at 10% 92%, rgba(45,212,191,0.28), transparent 62%),' +
      'repeating-linear-gradient(180deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 2px, transparent 2px, transparent 34px),' +
      'linear-gradient(165deg, #062a3f, #03121c)',
  },
  {
    id: 'carbon', label: '🖤 Carbón Rojo & Titán', font: 'Bebas Neue',
    text: '#f8fafc', sub: '#c2c8d2', accent: '#ef4444', accent2: '#f87171',
    bg:
      'radial-gradient(300px 180px at 18% 8%, rgba(239,68,68,0.30), transparent 62%),' +
      'radial-gradient(340px 210px at 88% 92%, rgba(239,68,68,0.22), transparent 62%),' +
      'repeating-linear-gradient(45deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 2px, transparent 2px, transparent 12px),' +
      'linear-gradient(160deg, #1c1f24, #0b0d10)',
  },
];

export interface AfficheTypo {
  id: string;
  label: string;
  hint: string;
  font: string;
  bodyFont: string;
  effect: 'gradiente' | 'caja' | 'neon' | 'subrayado' | 'sticker' | 'barra';
  /** Multiplicador óptico para fuentes display condensadas (Bebas / Anton). */
  opticalBoost: number;
}

export const AFFICHE_TYPOS: AfficheTypo[] = [
  { id: 'impacto', label: '01 · Bebas + Montserrat', hint: 'Display monumental + geométrica', font: 'Bebas Neue', bodyFont: 'Montserrat', effect: 'gradiente', opticalBoost: 1.24 },
  { id: 'revista', label: '02 · Playfair + Outfit', hint: 'Editorial de lujo + orgánica', font: 'Playfair Display', bodyFont: 'Outfit', effect: 'gradiente', opticalBoost: 1.04 },
  { id: 'moderna', label: '03 · Space + Jakarta', hint: 'Tech minimalista + UI limpia', font: 'Space Grotesk', bodyFont: 'Plus Jakarta Sans', effect: 'neon', opticalBoost: 1.06 },
  { id: 'anton', label: '04 · Anton + Outfit', hint: 'Poster urbano + cuerpo limpio', font: 'Anton', bodyFont: 'Outfit', effect: 'gradiente', opticalBoost: 1.15 },
  { id: 'gruesa', label: '05 · Montserrat Black', hint: 'Ultra-gruesa + Plus Jakarta', font: 'Montserrat', bodyFont: 'Plus Jakarta Sans', effect: 'subrayado', opticalBoost: 1.02 },
  { id: 'marcador', label: '06 · Archivo + Montserrat', hint: 'Bloque de acento + cuerpo Pro', font: 'Archivo Black', bodyFont: 'Montserrat', effect: 'caja', opticalBoost: 1.0 },
  { id: 'suiza', label: '07 · Suiza Arquitectónica', hint: 'Bebas + Space Grotesk', font: 'Bebas Neue', bodyFont: 'Space Grotesk', effect: 'barra', opticalBoost: 1.22 },
  { id: 'pop', label: '08 · Pop Editorial Urbano', hint: 'Archivo + Outfit sólido', font: 'Archivo Black', bodyFont: 'Outfit', effect: 'sticker', opticalBoost: 1.0 },
];

export interface AfficheBrand {
  name: string;
  slogan: string;
  product: string;
  promoPrice: number | null;
  normalPrice: number | null;
  address: string;
  municipality: string;
  phoneDisplay: string;
}

export interface AfficheTexts {
  plain: string;
  highlight: string;
  sub: string;
  benefits: string[];
  cta: string;
  hook: string;
}

export interface AfficheProps {
  themeId: string;
  layout: AfficheLayout;
  format: AfficheFormat;
  piece: AffichePiece;
  brand: AfficheBrand;
  texts: AfficheTexts;
  badge: string;
  showPrice: boolean;
  showBenefits: boolean;
  showQr: boolean;
  photoUrl: string | null;
  qrUrl: string | null;
  qrValue?: string;
  qrStyle?: QrStyle;
  photoZoom: number;
  photoPosY: number;
  qrLabel?: string;
  qrHint?: string;
  fontStyle?: string;
  headlineScale?: number;
  benefitStyle?: BenefitPresentation;
  dockVariant?: DockVariant;
  photoUrl2?: string | null;
  photoUrl3?: string | null;
  photoUrl4?: string | null;
  brandPalette?: ExtractedBrandPalette | null;
  logoUrl?: string | null;
  qrMode?: AfficheQrMode;
}

/**
 * Orquesta dinámicamente la indicación editorial de acción real según el destino del Código QR
 * (CERO textos de botón web clickeable ni flechas "↗" sobre una imagen PNG estática).
 */
function resolveAdaptiveCta(
  qrMode: AfficheQrMode | undefined,
  rawCta: string,
  isService: boolean,
  phoneDisplay?: string,
): string {
  const cleaned = cleanPosterCopy(rawCta)
    .replace(/\s*(?:↗|→|->|»)\s*$/g, '')
    .replace(/en\s+1\s+clic/gi, 'al instante')
    .trim();
  const cleanPhone = (phoneDisplay ?? '').replace(/^[^\p{L}\p{N}+]+/u, '').trim();
  if (qrMode === 'perfil') {
    return /whatsapp|pide\s+el\s+tuyo|cotiza/i.test(cleaned) || !cleaned
      ? 'ESCANEA Y EXPLORA EL CATÁLOGO'
      : cleaned;
  }
  if (qrMode === 'externo') {
    return /whatsapp|pide\s+el\s+tuyo|cotiza|aparta|ver\s+todas/i.test(cleaned) || !cleaned
      ? 'ESCANEA PARA MÁS INFORMACIÓN'
      : cleaned;
  }
  if (qrMode === 'oferta') {
    return /whatsapp|visita\s+nuestro\s+sitio|ver\s+todas/i.test(cleaned) || !cleaned
      ? 'ESCANEA PARA APARTAR HOY'
      : cleaned;
  }
  if (cleaned) return cleaned;
  if (cleanPhone && cleanPhone.length >= 7) return `PEDIDOS AL WHATSAPP ${cleanPhone}`;
  return isService ? 'ESCANEA PARA COTIZAR HOY' : 'RESERVA HOY EN IMPULSO';
}

/**
 * Construye un tema editorial coherente a partir de los 3 colores extraidos del logo o imagen.
 */
function buildBrandTheme(base: AfficheTheme, palette: ExtractedBrandPalette | null | undefined): AfficheTheme {
  if (!palette) return base;
  const pLum = relativeLuminance(palette.primary);
  const useLightCanvas = Boolean(base.light) && pLum > 0.25;
  if (useLightCanvas) {
    const bgTop = mixHex(palette.primary, '#ffffff', 0.88);
    const bgBottom = mixHex(palette.secondary, '#f8fafc', 0.82);
    const ink = mixHex(palette.primary, '#0f172a', 0.78);
    const sub = mixHex(palette.primary, '#475569', 0.55);
    return {
      ...base,
      light: true,
      text: ink,
      sub,
      accent: ensureReadableAccent(palette.primary, true),
      accent2: ensureReadableAccent(palette.accent, true),
      bg:
        `radial-gradient(360px 210px at 84% 10%, ${palette.accent}24, transparent 62%),` +
        `radial-gradient(340px 200px at 10% 88%, ${palette.secondary}22, transparent 62%),` +
        `linear-gradient(155deg, ${bgTop}, ${bgBottom})`,
    };
  }
  const deepTop = mixHex(palette.primary, '#060a14', 0.74);
  const deepBottom = mixHex(palette.secondary, '#03060c', 0.88);
  const darkSub = mixHex(palette.secondary, '#cbd5e1', 0.74);
  return {
    ...base,
    light: false,
    text: '#f8fafc',
    sub: darkSub,
    accent: ensureReadableAccent(palette.primary, false),
    accent2: ensureReadableAccent(palette.accent, false),
    bg:
      `radial-gradient(380px 230px at 86% 6%, ${palette.accent}48, transparent 62%),` +
      `radial-gradient(400px 250px at 8% 92%, ${palette.primary}3e, transparent 62%),` +
      `repeating-linear-gradient(90deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 44px),` +
      `linear-gradient(160deg, ${deepTop}, ${deepBottom})`,
  };
}

const money = (v: number): string => `$${v.toLocaleString('es-CO')}`;

function cleanPosterCopy(text: string): string {
  return text
    .replace(/\p{Extended_Pictographic}[\uFE0F\u200D]?/gu, '')
    .replace(/^[•·\-–—→👉✅✨🔥💎🚀💬📲⚡]+\s*/u, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function splitBenefit(b: string): { icon: string; body: string } {
  const m = /^\p{Extended_Pictographic}[\uFE0F\u200D]?/u.exec(b.trim());
  const icon = m ? m[0] : '';
  const body = cleanPosterCopy(m ? b.trim().slice(icon.length) : b);
  return { icon: '', body };
}

function glass(t: AfficheTheme): { card: CSSProperties; chip: CSSProperties } {
  return t.light
    ? {
        card: {
          background: 'rgba(255,255,255,0.62)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(15,23,42,0.12)',
          boxShadow: `0 16px 36px -10px ${t.accent}24, 0 8px 20px rgba(15,23,42,0.08)`,
        },
        chip: {
          background: 'rgba(15,23,42,0.88)',
          color: '#ffffff',
          border: '1px solid rgba(255,255,255,0.18)',
          backdropFilter: 'blur(12px)',
        },
      }
    : {
        card: {
          background: 'linear-gradient(145deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04))',
          backdropFilter: 'blur(18px)',
          border: '1px solid rgba(255,255,255,0.18)',
          boxShadow: `0 20px 44px -12px rgba(0,0,0,0.55), 0 8px 24px -8px ${t.accent}2e`,
        },
        chip: {
          background: 'rgba(10,14,26,0.72)',
          color: '#ffffff',
          border: '1px solid rgba(255,255,255,0.20)',
          backdropFilter: 'blur(14px)',
        },
      };
}

function GlyphIcon({ kind, size, color }: { kind: number; size: number; color: string }) {
  const k = kind % 4;
  if (k === 0) return <Check size={size} color={color} strokeWidth={2.5} aria-hidden />;
  if (k === 1) return <Zap size={size} color={color} strokeWidth={2.3} aria-hidden />;
  if (k === 2) return <MapPin size={size} color={color} strokeWidth={2.3} aria-hidden />;
  return <ShieldCheck size={size} color={color} strokeWidth={2.3} aria-hidden />;
}

function PhoneIcon({ size, color }: { size: number; color: string }) {
  return <Phone size={size} color={color} strokeWidth={2.3} aria-hidden />;
}

function Photo({ url, zoom, posY }: { url: string | null; zoom: number; posY: number }) {
  if (!url) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 'inherit',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
          border: '1px solid rgba(255,255,255,0.18)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ width: 84, height: 84, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.28)' }} />
      </div>
    );
  }
  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', borderRadius: 'inherit' }}>
      <img
        src={url}
        alt=""
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          objectPosition: `50% ${Math.round(posY * 100)}%`,
          transform: `scale(${zoom})`,
          transformOrigin: `50% ${Math.round(posY * 100)}%`,
        }}
      />
    </div>
  );
}

function Badge({ text, t, s, align = 'center' }: { text: string; t: AfficheTheme; s: number; align?: 'center' | 'left' }) {
  const clean = cleanPosterCopy(text);
  if (!clean) return null;
  const g = glass(t);
  return (
    <div style={{ display: 'flex', justifyContent: align === 'left' ? 'flex-start' : 'center', flexShrink: 0 }}>
      <span
        style={{
          ...g.chip,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7 * s,
          padding: `${6.5 * s}px ${15 * s}px`,
          borderRadius: 999,
          fontSize: 11 * s,
          fontWeight: 800,
          letterSpacing: 1.8,
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          boxShadow: `0 10px 24px -6px ${t.accent}35`,
        }}
      >
        <span style={{ width: 6 * s, height: 6 * s, borderRadius: '50%', background: t.accent2, flexShrink: 0 }} />
        {clean}
      </span>
    </div>
  );
}

/**
 * 📣 Titular Display Monumental (V26.0):
 *  - Simplificación total compatible con html-to-image (foreignObject): cero bg-clip-text,
 *    cero gradientes en texto, cero mix-blend-mode; solo tintas sólidas de alto contraste
 *    y rotulador sólido limpio.
 */
function Headline({
  texts,
  t,
  s,
  size = 50,
  align = 'center',
  color,
  styleId,
  scale = 1,
  fullWidth = false,
  longShadow = false,
}: {
  texts: AfficheTexts;
  t: AfficheTheme;
  s: number;
  size?: number;
  align?: 'center' | 'left';
  color?: string;
  styleId?: string;
  scale?: number;
  fullWidth?: boolean;
  longShadow?: boolean;
}) {
  const typo = AFFICHE_TYPOS.find((x) => x.id === styleId) ?? AFFICHE_TYPOS[0];
  const eff = typo.effect;
  const computedSize = size * 1.18 * typo.opticalBoost * scale * s;
  const isLight = Boolean(t.light);
  const readableAccent2 = ensureReadableAccent(t.accent2, isLight);
  const baseInk = color ?? (isLight ? t.text : '#ffffff');
  const shadowColor = longShadow
    ? `0 10px 26px rgba(0,0,0,0.95), 0 ${18 * s}px ${42 * s}px rgba(0,0,0,0.90), 0 0 ${26 * s}px ${readableAccent2}4d`
    : isLight && !color
      ? '0 2px 10px rgba(255,255,255,0.45)'
      : '0 8px 22px rgba(0,0,0,0.95), 0 16px 38px rgba(0,0,0,0.88)';

  const base: CSSProperties = {
    margin: 0,
    position: 'relative',
    zIndex: 10,
    fontFamily: `"${typo.font || t.font}", system-ui, sans-serif`,
    fontSize: Number(computedSize.toFixed(1)),
    lineHeight: 1.0,
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: -1.1 * s,
    color: baseInk,
    textShadow: shadowColor,
    filter: longShadow ? 'drop-shadow(0 25px 25px rgba(0,0,0,0.85))' : undefined,
  };

  const highlight = (): ReactElement => {
    const hl = cleanPosterCopy(texts.highlight);
    if (!hl) return <></>;

    switch (eff) {
      case 'caja':
        // V28.0: cero cajas sólidas sobre el texto; solo color protagonista puro + sombra monumental de contraste
        return (
          <span
            style={{
              color: readableAccent2,
              display: 'inline-block',
              fontWeight: 900,
              textShadow: isLight
                ? '0 3px 12px rgba(15,23,42,0.22)'
                : `0 6px 18px rgba(0,0,0,0.95), 0 14px 34px rgba(0,0,0,0.88), 0 0 ${24 * s}px ${readableAccent2}4d`,
            }}
          >
            {hl}
          </span>
        );
      case 'subrayado':
        return (
          <span
            style={{
              color: baseInk,
              borderBottom: `${4.5 * s}px solid ${readableAccent2}`,
              paddingBottom: 2 * s,
              display: 'inline-block',
              textShadow: isLight
                ? '0 3px 12px rgba(15,23,42,0.2)'
                : '0 6px 18px rgba(0,0,0,0.95), 0 14px 32px rgba(0,0,0,0.85)',
            }}
          >
            {hl}
          </span>
        );
      case 'barra':
        return (
          <span
            style={{
              display: 'inline-block',
              borderLeft: `${6 * s}px solid ${readableAccent2}`,
              paddingLeft: `${11 * s}px`,
              color: readableAccent2,
              textShadow: isLight
                ? '0 3px 12px rgba(15,23,42,0.2)'
                : '0 6px 18px rgba(0,0,0,0.95), 0 14px 32px rgba(0,0,0,0.85)',
            }}
          >
            {hl}
          </span>
        );
      default:
        // Color sólido de alto impacto con drop-shadow profundo y halo de tema (100% seguro para html-to-image)
        return (
          <span
            style={{
              color: readableAccent2,
              textShadow: isLight
                ? '0 3px 12px rgba(15,23,42,0.22)'
                : `0 6px 18px rgba(0,0,0,0.95), 0 14px 34px rgba(0,0,0,0.88), 0 0 ${24 * s}px ${readableAccent2}4d`,
            }}
          >
            {hl}
          </span>
        );
    }
  };

  return (
    <div
      style={{
        position: 'relative',
        zIndex: 10,
        textAlign: align,
        width: fullWidth ? '100%' : '96%',
        marginLeft: align === 'left' || fullWidth ? 0 : 'auto',
        marginRight: 'auto',
        flexShrink: 0,
      }}
    >
      <p style={base}>
        {cleanPosterCopy(texts.plain)} {highlight()}
      </p>
    </div>
  );
}

function SubHead({
  text,
  t,
  s,
  align = 'center',
  color,
}: {
  text: string;
  t: AfficheTheme;
  s: number;
  align?: 'center' | 'left';
  color?: string;
}) {
  const clean = cleanPosterCopy(text);
  if (!clean) return null;
  const ts = s < 0.75 ? 0.78 : s;
  return (
    <p
      style={{
        margin: 0,
        fontSize: 19 * ts,
        fontWeight: 700,
        lineHeight: 1.28,
        color: color ?? t.sub,
        textAlign: align,
        opacity: 0.96,
        flexShrink: 0,
      }}
    >
      {clean}
    </p>
  );
}

/**
 * ✨ V19.0 · SISTEMA DINÁMICO DE BENEFICIOS (cero listas aburridas repetitivas):
 * Alterna entre:
 *  - 'badges': Insignias flotantes circulares con aros de acento.
 *  - 'bento': Cajas Bento asimétricas (1 bloque vertical maestro + 2 bloques apilados).
 *  - 'editorial': Textos descriptivos grandes y audaces sin viñetas, con índices finos.
 *  - 'ribbons': Cintas translúcidas escalonadas con acento geométrico.
 */
type ResolvedBenefitMode = Exclude<BenefitPresentation, 'auto'>;

const LAYOUT_BENEFIT_MAP: Record<AfficheLayout, ResolvedBenefitMode> = {
  bento: 'bento',
  magazine: 'watermark',
  diagonal: 'ribbons',
  polaroid: 'badges',
  arc: 'editorial',
  portal: 'badges',
  swiss: 'callouts',
  split: 'bento',
  brutal: 'ribbons',
  vip: 'editorial',
  cyber: 'bento',
  rustic: 'badges',
  retail: 'ribbons',
  eco: 'badges',
  cinema: 'editorial',
  float: 'badges',
  hud: 'bento',
  resort: 'badges',
  menu: 'badges',
  clinic: 'ribbons',
  agro: 'bento',
  diamond: 'editorial',
  flash: 'ribbons',
  bento3d: 'bento',
  diagx: 'editorial',
  orbits: 'badges',
  bleed: 'watermark',
  zen: 'callouts',
  immersive: 'callouts',
  collage: 'watermark',
};

function BenefitsShowcase({
  items,
  t,
  s,
  mode,
  align = 'center',
}: {
  items: string[];
  t: AfficheTheme;
  s: number;
  mode: ResolvedBenefitMode;
  align?: 'center' | 'left';
}) {
  const cleanItems = items.slice(0, 3).map((b) => splitBenefit(b).body).filter(Boolean);
  if (cleanItems.length === 0) return null;
  const ts = s < 0.75 ? 0.78 : s;
  const isLight = Boolean(t.light);
  const ink = isLight ? ensureContrastColor(t.text, '#f4f1ea', 7) : '#ffffff';
  const tileBg = isLight ? 'rgba(15, 23, 42, 0.06)' : 'rgba(255, 255, 255, 0.09)';
  const tileBorder = isLight ? '1px solid rgba(15, 23, 42, 0.14)' : '1px solid rgba(255, 255, 255, 0.18)';
  const shadow = isLight ? 'none' : '0 2px 10px rgba(0,0,0,0.85)';

  if (mode === 'badges') {
    return (
      <div style={{ display: 'flex', alignItems: 'stretch', justifyContent: 'center', gap: 9 * s, flexShrink: 0 }}>
        {cleanItems.map((body, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              minWidth: 0,
              background: tileBg,
              backdropFilter: 'blur(14px)',
              border: tileBorder,
              borderRadius: 16 * s,
              padding: `${10 * s}px ${9 * s}px`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: 6 * s,
            }}
          >
            <span
              style={{
                width: 30 * ts,
                height: 30 * ts,
                borderRadius: '50%',
                background: `linear-gradient(145deg, ${t.accent}, ${t.accent2})`,
                boxShadow: `0 6px 16px ${t.accent}44`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <GlyphIcon kind={i} size={15 * ts} color={contrastTextOn(t.accent, t.accent2)} />
            </span>
            <span
              style={{
                fontSize: 14.5 * ts,
                fontWeight: 800,
                lineHeight: 1.18,
                color: ink,
                textShadow: shadow,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {body}
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (mode === 'bento') {
    const first = cleanItems[0];
    const second = cleanItems[1];
    const third = cleanItems[2];
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: second ? '1.15fr 1fr' : '1fr',
          gap: 8 * s,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            background: tileBg,
            backdropFilter: 'blur(14px)',
            border: tileBorder,
            borderRadius: 16 * s,
            padding: `${11 * s}px ${13 * s}px`,
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: 68 * s,
          }}
        >
          <span
            style={{
              width: 26 * ts,
              height: 26 * ts,
              borderRadius: 8 * s,
              background: `${t.accent2}2b`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <GlyphIcon kind={0} size={14 * ts} color={ensureReadableAccent(t.accent2, isLight)} />
          </span>
          <p style={{ margin: 0, marginTop: 6 * s, fontSize: 16 * ts, fontWeight: 900, lineHeight: 1.18, color: ink, textShadow: shadow }}>
            {first}
          </p>
        </div>

        {(second || third) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 * s }}>
            {second && (
              <div
                style={{
                  background: tileBg,
                  backdropFilter: 'blur(14px)',
                  border: tileBorder,
                  borderRadius: 14 * s,
                  padding: `${8 * s}px ${11 * s}px`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8 * s,
                  flex: 1,
                }}
              >
                <span style={{ fontSize: 13 * ts, fontWeight: 900, color: ensureReadableAccent(t.accent2, isLight), fontFamily: 'monospace' }}>02</span>
                <span style={{ fontSize: 14.5 * ts, fontWeight: 800, color: ink, lineHeight: 1.18 }}>{second}</span>
              </div>
            )}
            {third && (
              <div
                style={{
                  background: tileBg,
                  backdropFilter: 'blur(14px)',
                  border: tileBorder,
                  borderRadius: 14 * s,
                  padding: `${8 * s}px ${11 * s}px`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8 * s,
                  flex: 1,
                }}
              >
                <span style={{ fontSize: 13 * ts, fontWeight: 900, color: ensureReadableAccent(t.accent, isLight), fontFamily: 'monospace' }}>03</span>
                <span style={{ fontSize: 14.5 * ts, fontWeight: 800, color: ink, lineHeight: 1.18 }}>{third}</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (mode === 'ribbons') {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 * s, justifyContent: align === 'left' ? 'flex-start' : 'center', flexShrink: 0 }}>
        {cleanItems.map((body, i) => (
          <span
            key={i}
            style={{
              background: tileBg,
              backdropFilter: 'blur(14px)',
              border: tileBorder,
              borderRadius: 12 * s,
              borderLeft: `4px solid ${i % 2 === 0 ? t.accent2 : t.accent}`,
              padding: `${7 * ts}px ${12 * ts}px`,
              fontSize: 15 * ts,
              fontWeight: 800,
              color: ink,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7 * s,
            }}
          >
            <GlyphIcon kind={i} size={14 * ts} color={ensureReadableAccent(i % 2 === 0 ? t.accent2 : t.accent, isLight)} />
            {body}
          </span>
        ))}
      </div>
    );
  }

  // 'editorial' | 'callouts' | 'watermark': listas limpias de lectura inmediata sin zoom
  return (
    <div
      style={{
        padding: `${2 * s}px 0`,
        display: 'flex',
        flexDirection: 'column',
        gap: 8 * s,
        textAlign: align,
        flexShrink: 0,
      }}
    >
      {cleanItems.map((body, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: align === 'left' ? 'flex-start' : 'center',
            gap: 10 * s,
          }}
        >
          <span
            style={{
              width: 24 * ts,
              height: 24 * ts,
              borderRadius: 8 * s,
              background: `linear-gradient(135deg, ${t.accent}, ${t.accent2})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: `0 6px 14px ${t.accent}44`,
            }}
          >
            <GlyphIcon kind={i} size={13.5 * ts} color={contrastTextOn(t.accent, t.accent2)} />
          </span>
          <span
            style={{
              fontSize: 16.5 * ts,
              fontWeight: 800,
              letterSpacing: -0.2 * ts,
              color: ink,
              lineHeight: 1.2,
              textShadow: shadow,
            }}
          >
            {body}
          </span>
        </div>
      ))}
    </div>
  );
}

function PricePill({ brand, t, s, big = false }: { brand: AfficheBrand; t: AfficheTheme; s: number; big?: boolean }) {
  const promo = brand.promoPrice;
  const showNormal = brand.normalPrice != null && promo != null && brand.normalPrice > promo;
  if (promo == null) return null;
  return (
    <div
      style={{
        background: t.light ? 'rgba(15,23,42,0.92)' : 'rgba(8,12,24,0.82)',
        backdropFilter: 'blur(16px)',
        border: `1.5px solid ${t.accent2}88`,
        borderRadius: 20 * s,
        padding: `${9 * s}px ${17 * s}px`,
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 9 * s,
        boxShadow: `0 18px 40px -8px rgba(0,0,0,0.65), 0 6px 20px ${t.accent2}40`,
      }}
    >
      <span
        style={{
          fontFamily: `"${t.font}", system-ui, sans-serif`,
          fontSize: (big ? 38 : 30) * s,
          fontWeight: 900,
          color: '#fde047',
          lineHeight: 1,
          letterSpacing: -0.5,
        }}
      >
        {money(promo)}
      </span>
      {showNormal && brand.normalPrice != null && (
        <span style={{ fontSize: 13.5 * s, color: 'rgba(226,232,240,0.75)', textDecoration: 'line-through', fontWeight: 700 }}>
          {money(brand.normalPrice)}
        </span>
      )}
    </div>
  );
}

/**
 * ✏️ Flecha editorial curva SVG para guiar la mirada hacia el Código QR
 * (estética de afiche de agencia impreso, jamás icono de enlace web).
 */
function CurvedQrArrow({
  color,
  size = 30,
  direction = 'right-down',
}: {
  color: string;
  size?: number;
  direction?: 'right-down' | 'right-up' | 'down';
}) {
  const path =
    direction === 'right-up'
      ? 'M4 24 C14 24, 20 16, 24 6 M18 9 L24 5 L27 12'
      : direction === 'down'
        ? 'M14 3 C18 11, 18 19, 14 27 M9 22 L14 28 L19 22'
        : 'M4 8 C14 6, 22 12, 24 23 M18 19 L24 25 L28 17';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0, overflow: 'visible' }}
    >
      <path d={path} stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * 🏷️ V36.0 · Pieza Gráfica Editorial de Acción (reemplaza el botón web falso):
 * Sello / cinta tipográfica de estudio con flecha curva apuntando al QR real.
 */
function EditorialActionCue({
  label,
  s,
  accent,
  accent2,
  inkColor,
  align = 'left',
  arrowDir = 'right-down',
  showArrow = true,
  variant = 'ribbon',
}: {
  label: string;
  s: number;
  accent: string;
  accent2?: string;
  inkColor?: string;
  align?: 'center' | 'left';
  arrowDir?: 'right-down' | 'right-up' | 'down';
  showArrow?: boolean;
  variant?: 'ribbon' | 'stamp' | 'typographic';
}) {
  const clean = cleanPosterCopy(label).replace(/\s*(?:↗|→|->)\s*$/g, '').trim();
  if (!clean) return null;
  const ts = s < 0.75 ? 0.78 : s;
  const barColor = accent2 || accent;
  const textColor = inkColor ?? contrastTextOn(accent, barColor);

  if (variant === 'stamp') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: align === 'left' ? 'flex-start' : 'center',
          gap: 8 * ts,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            border: `2px dashed ${barColor}`,
            background: `${accent}24`,
            color: inkColor ?? '#ffffff',
            borderRadius: 10 * ts,
            padding: `${6 * ts}px ${14 * ts}px`,
            fontSize: 13.5 * ts,
            fontWeight: 900,
            letterSpacing: 1.4 * ts,
            textTransform: 'uppercase',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7 * ts,
          }}
        >
          <span style={{ width: 7 * ts, height: 7 * ts, borderRadius: '50%', background: barColor, flexShrink: 0 }} />
          {clean}
        </span>
        {showArrow && <CurvedQrArrow color={barColor} size={26 * ts} direction={arrowDir} />}
      </div>
    );
  }

  if (variant === 'typographic') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: align === 'left' ? 'flex-start' : 'center',
          gap: 8 * ts,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            borderLeft: `4px solid ${barColor}`,
            paddingLeft: 10 * ts,
            color: inkColor ?? '#ffffff',
            fontSize: 14.5 * ts,
            fontWeight: 900,
            letterSpacing: 1.1 * ts,
            textTransform: 'uppercase',
            lineHeight: 1.1,
          }}
        >
          {clean}
        </span>
        {showArrow && <CurvedQrArrow color={barColor} size={26 * ts} direction={arrowDir} />}
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: align === 'left' ? 'flex-start' : 'center',
        gap: 8 * ts,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          background: `linear-gradient(90deg, ${accent}, ${barColor})`,
          color: textColor,
          borderRadius: 6 * ts,
          padding: `${7 * ts}px ${15 * ts}px`,
          fontSize: 13.5 * ts,
          fontWeight: 900,
          letterSpacing: 1.2 * ts,
          textTransform: 'uppercase',
          display: 'inline-flex',
          alignItems: 'center',
          boxShadow: `0 10px 24px -8px ${accent}66`,
        }}
      >
        {clean}
      </span>
      {showArrow && <CurvedQrArrow color={barColor} size={26 * ts} direction={arrowDir} />}
    </div>
  );
}

/**
 * 💎 V36.0 · QR Escaneable 100% por Google Lens (contraste WCAG >= 8.5:1 + quiet zone nítido):
 * Conserva el tinte extraído de la marca con marco limpio y borde de acento.
 */
function QrOrganicToken({
  qrValue,
  qrUrl,
  size,
  t,
  s,
  qrStyle = 'rounded',
  brandColors,
}: {
  qrValue?: string;
  qrUrl: string | null;
  size: number;
  t: AfficheTheme;
  s: number;
  businessName?: string;
  qrStyle?: QrStyle;
  brandColors?: { primary: string; accent: string; secondary?: string } | null;
}) {
  const value = qrValue?.trim() || '';
  if (!value && !qrUrl) return null;
  const palette = themeQrPalette(t.id, brandColors);
  const isCyber = qrStyle === 'cyber';
  const isLuxury = qrStyle === 'luxury';
  const framePad = Math.max(7, Math.round(9 * s));
  const svgSize = Math.max(64, Math.round(size - framePad * 2));
  const cut = Math.round(12 * s);
  const cyberClip = isCyber
    ? `polygon(${cut}px 0, 100% 0, 100% calc(100% - ${cut}px), calc(100% - ${cut}px) 100%, 0 100%, 0 ${cut}px)`
    : undefined;

  // Superficie blanca limpia con quiet zone real para lectura instantánea en 0.1s por cualquier cámara
  const panelBorder = isLuxury
    ? '2px solid rgba(251, 191, 36, 0.72)'
    : `2px solid ${brandColors?.accent ?? t.accent2}88`;

  return (
    <div
      style={{
        width: size,
        height: size,
        maxWidth: '100%',
        maxHeight: '100%',
        flexShrink: 0,
        padding: framePad,
        borderRadius: isCyber ? 10 * s : 18 * s,
        clipPath: cyberClip,
        background: '#ffffff',
        border: panelBorder,
        boxShadow: `0 16px 34px -10px rgba(0,0,0,0.48), 0 0 ${16 * s}px var(--color-accent, ${t.accent2})33`,
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 0,
        overflow: 'hidden',
      }}
    >
      {qrUrl ? (
        <img
          src={qrUrl}
          alt="QR"
          style={{
            width: svgSize,
            height: svgSize,
            display: 'block',
            borderRadius: isCyber ? 4 * s : 8 * s,
          }}
        />
      ) : value ? (
        <QRCodeSVG
          value={value}
          size={svgSize}
          level="M"
          marginSize={1}
          bgColor="#ffffff"
          fgColor={palette.dark}
        />
      ) : null}
    </div>
  );
}

/**
 * 💎 V36.0 · Pie Editorial de Agencia con QR Escaneable y Contraste WCAG:
 *  - Cero botones web falsos ni texto microscópico.
 *  - Tamaño de fuente mínimo garantizado para lectura instantánea en celular sin hacer zoom.
 */
function Dock({
  brand,
  t,
  s,
  qrUrl,
  qrValue,
  qrStyle,
  size,
  qrLabel,
  displayFont,
  bodyFont,
  brandColors,
  logoUrl,
  surfaceHex,
  showQrToken = true,
}: {
  brand: AfficheBrand;
  t: AfficheTheme;
  s: number;
  qrUrl: string | null;
  qrValue?: string;
  qrStyle?: QrStyle;
  size: number;
  qrLabel?: string;
  displayFont?: string;
  bodyFont?: string;
  variant?: Exclude<DockVariant, 'auto'>;
  brandColors?: { primary: string; accent: string; secondary?: string } | null;
  logoUrl?: string | null;
  qrMode?: AfficheQrMode;
  surfaceHex?: string;
  showQrToken?: boolean;
}) {
  const ts = s < 0.75 ? 0.78 : s;
  const phone = (brand.phoneDisplay || '').replace(/^[^\p{L}\p{N}+]+/u, '').trim();
  const isLight = Boolean(t.light);
  const bgRef = surfaceHex ?? (isLight ? '#f4f1ea' : '#090f1d');
  const ink = ensureContrastColor(isLight ? '#0f172a' : '#f8fafc', bgRef, 7.5);
  const inkMuted = ensureContrastColor(isLight ? '#334155' : '#cbd5e1', bgRef, 5.2);
  const eyebrowColor = ensureContrastColor(isLight ? t.accent : t.accent2, bgRef, 4.6);
  const resolvedLabel = cleanPosterCopy(qrLabel || 'ESCANEA AQUÍ').toUpperCase();
  const addressText = cleanPosterCopy(brand.address || brand.municipality || 'Casco Urbano');

  return (
    <div
      style={{
        background: surfaceHex
          ? `${surfaceHex}e6`
          : isLight
            ? 'rgba(255, 255, 255, 0.86)'
            : 'rgba(6, 10, 20, 0.72)',
        backdropFilter: 'blur(20px) saturate(140%)',
        border: isLight ? '1.5px solid rgba(15, 23, 42, 0.14)' : `1.5px solid ${t.accent2}38`,
        borderRadius: 20 * s,
        position: 'relative',
        overflow: 'hidden',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        padding: s < 0.75 ? `${10 * s}px ${14 * s}px` : `${14 * s}px ${18 * s}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: s < 0.75 ? 12 * s : 16 * s,
        flexShrink: 0,
        fontFamily: `"${bodyFont || 'Inter'}", system-ui, sans-serif`,
      }}
    >
      {/* Columna izquierda: Marca + Dirección Exacta + WhatsApp legible sin zoom */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 * ts }}>
        <p
          style={{
            margin: 0,
            fontSize: 11.5 * ts,
            fontWeight: 900,
            letterSpacing: 1.8 * ts,
            textTransform: 'uppercase',
            color: eyebrowColor,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {cleanPosterCopy(brand.slogan || brand.municipality || 'COMERCIO LOCAL').toUpperCase()}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 * ts, minWidth: 0 }}>
          {logoUrl && (
            <img
              src={logoUrl}
              alt=""
              style={{
                width: 30 * ts,
                height: 30 * ts,
                borderRadius: 8 * ts,
                objectFit: 'contain',
                background: isLight ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.1)',
                padding: 2 * ts,
                flexShrink: 0,
              }}
            />
          )}
          <p
            style={{
              margin: 0,
              fontFamily: `"${displayFont || t.font}", system-ui, sans-serif`,
              fontSize: 27 * ts,
              fontWeight: 900,
              color: ink,
              lineHeight: 0.98,
              letterSpacing: -0.3 * ts,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {cleanPosterCopy(brand.name || 'Tu Negocio')}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 * ts, minWidth: 0 }}>
          <MapPin size={15 * ts} color={eyebrowColor} strokeWidth={2.4} style={{ flexShrink: 0 }} aria-hidden />
          <p
            style={{
              margin: 0,
              fontSize: 14.5 * ts,
              fontWeight: 700,
              color: inkMuted,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {addressText}
          </p>
        </div>

        {phone && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 * ts, minWidth: 0 }}>
            <PhoneIcon size={15 * ts} color={eyebrowColor} />
            <span
              style={{
                fontSize: 16 * ts,
                fontWeight: 900,
                color: ink,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: 0.4 * ts,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {phone}
            </span>
          </div>
        )}
      </div>

      {/* QR Protagonista equilibrado (165px-190px en 9:16 = 330px-380px reales en 1080p) */}
      {showQrToken && (qrValue || qrUrl) && (
        <div
          style={{
            flexShrink: 0,
            maxWidth: size + 10,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 5 * ts,
          }}
        >
          <QrOrganicToken
            qrValue={qrValue}
            qrUrl={qrUrl}
            size={size}
            t={t}
            s={s}
            businessName={brand.name || 'Impulso'}
            qrStyle={qrStyle}
            brandColors={brandColors}
          />
          <p
            style={{
              margin: 0,
              maxWidth: '100%',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              fontSize: 10.5 * ts,
              fontWeight: 900,
              letterSpacing: 1.2 * ts,
              textTransform: 'uppercase',
              color: eyebrowColor,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              textAlign: 'center',
            }}
          >
            {resolvedLabel}
          </p>
        </div>
      )}
    </div>
  );
}

export function AfficheArtboard(props: AfficheProps): ReactElement {
  const {
    themeId,
    layout,
    format,
    piece,
    brand,
    texts,
    badge,
    showPrice,
    showBenefits,
    showQr,
    photoUrl,
    qrUrl,
    qrValue,
    qrStyle = 'rounded',
    photoZoom,
    photoPosY,
    qrLabel,
    fontStyle,
    headlineScale,
    benefitStyle = 'auto',
    dockVariant = 'auto',
    photoUrl2,
    photoUrl3,
    brandPalette,
    logoUrl,
    qrMode = 'wa',
  } = props;

  const hs = headlineScale ?? 1.2;
  const photo2 = photoUrl2 ?? photoUrl;
  const photo3 = photoUrl3 ?? photo2;
  const baseTheme = AFFICHE_THEMES.find((x) => x.id === themeId) ?? AFFICHE_THEMES[1];
  const t = buildBrandTheme(baseTheme, brandPalette);
  const brandColors = brandPalette
    ? { primary: brandPalette.primary, accent: brandPalette.accent, secondary: brandPalette.secondary }
    : null;
  const dominantDark = mixHex(brandPalette?.primary ?? t.accent, '#02040a', 0.72);
  const cssBrandVars = {
    '--color-primary': t.accent,
    '--color-accent': t.accent2,
    '--color-secondary': brandPalette?.secondary ?? mixHex(t.accent, '#0f172a', 0.5),
    '--color-dominant-dark': dominantDark,
  } as CSSProperties;
  const activeTypo = AFFICHE_TYPOS.find((x) => x.id === fontStyle) ?? AFFICHE_TYPOS[0];
  const boardBodyFont = `"${activeTypo.bodyFont}", system-ui, -apple-system, sans-serif`;
  const boardDisplayFont = activeTypo.font || t.font;
  const s = format === 'square' ? 0.58 : 1;
  const ts = format === 'square' ? 0.78 : 1;
  const isSquare = format === 'square';
  const W = 540;
  const H = isSquare ? 540 : 960;
  const pad = isSquare ? 14 : 20;
  const benefits = texts.benefits.filter(Boolean);
  const priceOverlay = showPrice && brand.promoPrice != null && piece === 0;
  const isService = brand.promoPrice == null;
  const adaptiveCta = resolveAdaptiveCta(qrMode, texts.cta, isService, brand.phoneDisplay);

  // 🎯 Regla de Oro del QR (V36.0): 166px–192px en 9:16 (= 332px–384px reales en 1080p) y 128px en 1:1 (= 256px en 1080p)
  const dockQrSize = isSquare ? 128 : 168;
  const resolvedBenefitMode: ResolvedBenefitMode =
    benefitStyle === 'auto' ? (LAYOUT_BENEFIT_MAP[layout] ?? 'editorial') : benefitStyle;
  const resolvedDockVariant: Exclude<DockVariant, 'auto'> =
    dockVariant !== 'auto'
      ? dockVariant
      : layout === 'swiss' || layout === 'zen' || layout === 'vip' || layout === 'arc'
        ? 'centered'
        : layout === 'diagx' || layout === 'split' || layout === 'diagonal' || layout === 'cyber' || layout === 'collage'
          ? 'corner'
          : 'glass';

  // ═══ PIEZA 2 · GANCHO VIRAL EXTREMO (SOLO FOTO + VIÑETA + PREGUNTA MONUMENTAL · CERO BOTÓN WEB) ═══
  if (piece === 1) {
    const rawHook = texts.hook.trim() || `¿POR QUÉ TODOS HABLAN DE ${(brand.product || brand.name || 'ESTO').toUpperCase()}?`;
    return (
      <div
        style={{
          ...cssBrandVars,
          width: W,
          height: H,
          flexShrink: 0,
          position: 'relative',
          background: '#05070d',
          color: '#ffffff',
          fontFamily: boardBodyFont,
          borderRadius: 24 * s,
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', inset: 0 }}>
          <Photo url={photo2} zoom={photoZoom} posY={photoPosY} />
        </div>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(to top, ${dominantDark}f5 0%, rgba(0,0,0,0.58) 54%, rgba(0,0,0,0.28) 100%)`,
          }}
        />

        <div
          style={{
            position: 'relative',
            zIndex: 6,
            width: '100%',
            height: '100%',
            padding: `${24 * ts}px`,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            textAlign: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 * ts }}>
            {logoUrl && (
              <img
                src={logoUrl}
                alt=""
                style={{
                  width: 32 * ts,
                  height: 32 * ts,
                  borderRadius: 9 * ts,
                  objectFit: 'contain',
                  background: 'rgba(255,255,255,0.12)',
                  padding: 3 * ts,
                }}
              />
            )}
            <span
              style={{
                fontSize: 13 * ts,
                fontWeight: 900,
                letterSpacing: 3 * ts,
                textTransform: 'uppercase',
                color: ensureReadableAccent(t.accent2, false),
              }}
            >
              {cleanPosterCopy(brand.name || 'EDICIÓN VIRAL').toUpperCase()}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 * ts, maxWidth: '94%' }}>
            <span
              style={{
                width: 60 * ts,
                height: 4 * ts,
                borderRadius: 999,
                background: `linear-gradient(90deg, ${t.accent}, ${t.accent2})`,
              }}
            />
            <p
              style={{
                margin: 0,
                fontFamily: `"${boardDisplayFont}", system-ui, sans-serif`,
                fontSize: (isSquare ? 48 : 64) * ts,
                lineHeight: 0.94,
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: -1.2 * ts,
                color: '#ffffff',
                textShadow: '0 14px 36px rgba(0,0,0,0.88)',
              }}
            >
              {rawHook}
            </p>
          </div>

          <div
            style={{
              borderTop: `2px solid ${ensureReadableAccent(t.accent2, false)}88`,
              borderBottom: `2px solid ${ensureReadableAccent(t.accent2, false)}88`,
              padding: `${8 * ts}px ${22 * ts}px`,
              color: '#ffffff',
              fontSize: 13.5 * ts,
              fontWeight: 900,
              letterSpacing: 2.2 * ts,
              textTransform: 'uppercase',
            }}
          >
            {cleanPosterCopy(brand.municipality || 'Gachetá').toUpperCase()} · EDICIÓN HOY
          </div>
        </div>
      </div>
    );
  }

  // ═══ ARQUITECTURA 7 · PIEZA 3 · INFOGRAFÍA DE AUTORIDAD (3 BANDAS HORIZONTALES RICAS + MICRO-MÉTRICAS + QR) ═══
  if (piece === 2) {
    const surfaceBg = dominantDark;
    const neonNumColor = ensureContrastColor(t.accent2, surfaceBg, 4.8);
    const secondaryNeon = ensureContrastColor(t.accent, surfaceBg, 4.6);
    const uiInk = '#f8fafc';
    const uiMuted = '#e2e8f0';
    const microMetrics = ['100% LOCAL', 'ENTREGA ÁGIL', 'GARANTÍA REAL'] as const;

    const infoItems = [0, 1, 2].map((i) => {
      const b = benefits[i] ?? ['Calidad garantizada de principio a fin', 'Atención directa y sin esperas', 'Ubicación estratégica y despacho ágil'][i];
      const clean = splitBenefit(b).body;
      return {
        num: `0${i + 1}`,
        metric: microMetrics[i],
        title: clean,
        hint: [
          `Respaldo directo de ${cleanPosterCopy(brand.name || 'nuestro equipo')} en cada pedido.`,
          `Atención cercana en ${cleanPosterCopy(brand.municipality || 'el municipio')}.`,
          cleanPosterCopy(texts.sub || 'Promoción oficial activa hoy en Impulso.'),
        ][i],
      };
    });

    const infoQrSize = isSquare ? 104 : 148;

    return (
      <div
        style={{
          ...cssBrandVars,
          width: W,
          height: H,
          flexShrink: 0,
          position: 'relative',
          background: surfaceBg,
          color: uiInk,
          fontFamily: boardBodyFont,
          borderRadius: 24 * s,
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, opacity: 0.28 }}>
          <Photo url={photo3} zoom={photoZoom} posY={photoPosY} />
        </div>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(180deg, ${surfaceBg}d9 0%, ${surfaceBg}f2 58%, #040712fc 100%)`,
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            width: '100%',
            height: '100%',
            padding: `${isSquare ? 14 : 22}px`,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: isSquare ? 8 : 14,
          }}
        >
          {/* Cabecera editorial de autoridad */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt=""
                  style={{
                    width: 40 * ts,
                    height: 40 * ts,
                    borderRadius: 11 * ts,
                    objectFit: 'contain',
                    background: 'rgba(255,255,255,0.12)',
                    padding: 3 * ts,
                    flexShrink: 0,
                  }}
                />
              )}
              <div style={{ minWidth: 0 }}>
                <p
                  style={{
                    margin: 0,
                    fontFamily: `"${boardDisplayFont}", system-ui, sans-serif`,
                    fontSize: 23 * ts,
                    fontWeight: 900,
                    color: uiInk,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    lineHeight: 1,
                  }}
                >
                  {cleanPosterCopy(brand.name || 'Tu Negocio')}
                </p>
                <p style={{ margin: 0, marginTop: 2, fontSize: 12 * ts, fontWeight: 700, color: neonNumColor, letterSpacing: 1.2 * ts, textTransform: 'uppercase' }}>
                  {cleanPosterCopy(brand.slogan || brand.municipality || 'AUTORIDAD LOCAL')}
                </p>
              </div>
            </div>
            <span
              style={{
                border: `1.5px solid ${neonNumColor}88`,
                background: `${neonNumColor}1f`,
                borderRadius: 999,
                padding: `${5 * ts}px ${12 * ts}px`,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 11 * ts,
                fontWeight: 900,
                letterSpacing: 1.4 * ts,
                color: neonNumColor,
                textTransform: 'uppercase',
                flexShrink: 0,
              }}
            >
              3 RAZONES CLAVE
            </span>
          </div>

          <p
            style={{
              margin: 0,
              fontFamily: `"${boardDisplayFont}", system-ui, sans-serif`,
              fontSize: (isSquare ? 30 : 40) * ts,
              fontWeight: 900,
              lineHeight: 0.98,
              textTransform: 'uppercase',
              letterSpacing: -0.6 * ts,
              color: uiInk,
              flexShrink: 0,
            }}
          >
            POR QUÉ ELEGIR <span style={{ color: neonNumColor }}>{cleanPosterCopy(brand.product || brand.name || 'HOY')}</span>
          </p>

          {/* 3 Bloques horizontales ricos de autoridad (cero vacíos) */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: isSquare ? 7 : 12 }}>
            {infoItems.map((item, idx) => {
              const rowAccent = idx % 2 === 0 ? neonNumColor : secondaryNeon;
              return (
                <div
                  key={item.num}
                  style={{
                    flex: 1,
                    position: 'relative',
                    overflow: 'hidden',
                    background: 'rgba(255, 255, 255, 0.08)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255, 255, 255, 0.16)',
                    borderLeft: `5px solid ${rowAccent}`,
                    borderRadius: 18 * s,
                    padding: `${isSquare ? 8 : 14}px ${isSquare ? 12 : 16}px`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: isSquare ? 11 : 16,
                    minHeight: 0,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      right: 12,
                      bottom: -10,
                      fontFamily: `"${boardDisplayFont}", system-ui, sans-serif`,
                      fontSize: isSquare ? 68 : 104,
                      fontWeight: 900,
                      lineHeight: 0.85,
                      color: '#ffffff',
                      opacity: 0.09,
                      pointerEvents: 'none',
                    }}
                  >
                    {item.num}
                  </span>

                  <span
                    style={{
                      width: (isSquare ? 42 : 56) * ts,
                      height: (isSquare ? 42 : 56) * ts,
                      borderRadius: 14 * ts,
                      background: `linear-gradient(145deg, ${t.accent}, ${t.accent2})`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      boxShadow: `0 10px 24px ${t.accent}44`,
                    }}
                  >
                    <GlyphIcon kind={idx} size={(isSquare ? 22 : 30) * ts} color={contrastTextOn(t.accent, t.accent2)} />
                  </span>

                  <div style={{ position: 'relative', zIndex: 2, flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 11 * ts, fontWeight: 900, color: rowAccent, letterSpacing: 1.2 }}>
                        {item.num} · {item.metric}
                      </span>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: (isSquare ? 17 : 21) * ts,
                        fontWeight: 900,
                        lineHeight: 1.12,
                        color: uiInk,
                      }}
                    >
                      {item.title}
                    </p>
                    {!isSquare && (
                      <p
                        style={{
                          margin: 0,
                          marginTop: 4,
                          fontSize: 14.5,
                          fontWeight: 600,
                          lineHeight: 1.25,
                          color: uiMuted,
                        }}
                      >
                        {item.hint}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pie de marca de autoridad con QR bien proporcionado */}
          <Dock
            brand={brand}
            t={{ ...t, light: false, text: uiInk, sub: uiMuted, accent: secondaryNeon, accent2: neonNumColor }}
            s={s}
            qrUrl={qrUrl}
            qrValue={qrValue}
            qrStyle={qrStyle}
            size={infoQrSize}
            qrLabel={qrLabel}
            displayFont={boardDisplayFont}
            bodyFont={activeTypo.bodyFont}
            brandColors={brandColors}
            logoUrl={logoUrl}
            surfaceHex="#090f1e"
            showQrToken={showQr}
          />
        </div>
      </div>
    );
  }

  // ═══ ARQUITECTURA 8 · PIEZA 4 · CIERRE VIP / TICKET BOARDING PASS CON TROQUELADO LATERAL ═══
  if (piece === 3) {
    const qrTicketSize = isSquare ? 168 : 206;
    const isLightBg = Boolean(t.light);
    const ticketBg = isLightBg ? '#ffffff' : '#0b1222';
    const ticketInk = ensureContrastColor(isLightBg ? '#0f172a' : '#f8fafc', ticketBg, 8);
    const ticketMuted = ensureContrastColor(isLightBg ? '#475569' : '#cbd5e1', ticketBg, 5);
    const ticketAccent = ensureContrastColor(t.accent2, ticketBg, 4.6);
    const waFormatted = (brand.phoneDisplay || '').replace(/^[^\p{L}\p{N}+]+/u, '').trim();
    const initials = extractInitials(brand.name || 'Impulso');
    const notchBg = isLightBg ? '#dfd7c7' : '#050811';

    return (
      <div
        style={{
          ...cssBrandVars,
          width: W,
          height: H,
          flexShrink: 0,
          position: 'relative',
          background: t.bg,
          backgroundSize: t.bgSize ?? '100% 100%, 100% 100%, 100% 100%, 100% 100%',
          color: t.text,
          fontFamily: boardBodyFont,
          borderRadius: 24 * s,
          overflow: 'hidden',
          padding: `${isSquare ? 18 : 30}px ${isSquare ? 20 : 26}px`,
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Tarjeta VIP Boarding Pass con troquelados semicirculares laterales */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            borderRadius: 28 * s,
            background: ticketBg,
            border: `2px solid ${ticketAccent}55`,
            boxShadow: '0 28px 64px -16px rgba(0,0,0,0.68)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Barra superior de acento */}
          <div style={{ height: 8 * s, width: '100%', background: `linear-gradient(90deg, ${t.accent}, ${t.accent2})`, flexShrink: 0 }} />

          {/* Talón superior del ticket: Logo real o monograma tipográfico limpio (cero cajas grises) */}
          <div
            style={{
              padding: `${isSquare ? 12 : 22}px ${isSquare ? 18 : 24}px`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt=""
                  style={{
                    width: (isSquare ? 48 : 66) * ts,
                    height: (isSquare ? 48 : 66) * ts,
                    borderRadius: 14 * ts,
                    objectFit: 'contain',
                    background: isLightBg ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.08)',
                    padding: 4 * ts,
                    flexShrink: 0,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: (isSquare ? 44 : 58) * ts,
                    height: (isSquare ? 44 : 58) * ts,
                    borderRadius: '50%',
                    border: `2.5px solid ${ticketAccent}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: `"${boardDisplayFont}", system-ui, sans-serif`,
                    fontSize: (isSquare ? 22 : 28) * ts,
                    fontWeight: 900,
                    color: ticketAccent,
                    letterSpacing: 1,
                    flexShrink: 0,
                  }}
                >
                  {initials}
                </div>
              )}
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 11 * ts, fontWeight: 900, letterSpacing: 2.2 * ts, textTransform: 'uppercase', color: ticketAccent }}>
                  PASE EXCLUSIVO · {(brand.municipality || 'GACHETÁ').toUpperCase()}
                </p>
                <p
                  style={{
                    margin: 0,
                    marginTop: 2,
                    fontFamily: `"${boardDisplayFont}", system-ui, sans-serif`,
                    fontSize: (isSquare ? 24 : 34) * ts,
                    fontWeight: 900,
                    color: ticketInk,
                    lineHeight: 0.98,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {cleanPosterCopy(brand.name || 'Tu Negocio')}
                </p>
              </div>
            </div>
            {!isSquare && (
              <span
                style={{
                  border: `1.5px solid ${ticketAccent}66`,
                  borderRadius: 10,
                  padding: '6px 10px',
                  fontFamily: 'monospace',
                  fontSize: 11,
                  fontWeight: 900,
                  color: ticketAccent,
                  letterSpacing: 1.5,
                  flexShrink: 0,
                }}
              >
                VIP PASS
              </span>
            )}
          </div>

          {/* Línea troquelada real con muescas semicirculares laterales */}
          <div style={{ position: 'relative', height: 24 * s, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <span style={{ position: 'absolute', left: -14 * s, width: 28 * s, height: 28 * s, borderRadius: '50%', background: notchBg }} />
            <div style={{ width: '100%', margin: `0 ${20 * s}px`, borderTop: `2px dashed ${ticketAccent}55` }} />
            <span style={{ position: 'absolute', right: -14 * s, width: 28 * s, height: 28 * s, borderRadius: '50%', background: notchBg }} />
          </div>

          {/* Cuerpo principal del pase: QR Protagonista + Indicación Editorial + Contacto */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              padding: `${isSquare ? 8 : 18}px ${isSquare ? 18 : 26}px ${isSquare ? 14 : 24}px`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'space-between',
              textAlign: 'center',
              gap: isSquare ? 6 : 12,
            }}
          >
            {!isSquare && (
              <p
                style={{
                  margin: 0,
                  fontFamily: `"${boardDisplayFont}", system-ui, sans-serif`,
                  fontSize: 32,
                  fontWeight: 900,
                  lineHeight: 1.02,
                  textTransform: 'uppercase',
                  color: ticketInk,
                }}
              >
                {cleanPosterCopy(brand.product || texts.plain || 'OFERTA EXCLUSIVA DE HOY')}
              </p>
            )}

            {(qrValue || qrUrl) && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 * ts }}>
                <QrOrganicToken
                  qrValue={qrValue}
                  qrUrl={qrUrl}
                  size={qrTicketSize}
                  t={t}
                  s={s}
                  businessName={brand.name || 'Impulso'}
                  qrStyle={qrStyle}
                  brandColors={brandColors}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CurvedQrArrow color={ticketAccent} size={22 * ts} direction="right-up" />
                  <span style={{ fontFamily: 'monospace', fontSize: 13 * ts, fontWeight: 900, letterSpacing: 1.8 * ts, color: ticketAccent, textTransform: 'uppercase' }}>
                    {cleanPosterCopy(qrLabel || 'ESCANEA PARA APARTAR HOY').toUpperCase()}
                  </span>
                </div>
              </div>
            )}

            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 * ts }}>
              <p style={{ margin: 0, fontSize: 15 * ts, fontWeight: 700, color: ticketMuted, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <MapPin size={15 * ts} color={ticketAccent} strokeWidth={2.4} aria-hidden />
                {cleanPosterCopy(brand.address || brand.municipality || 'Casco Urbano')}
              </p>
              {waFormatted && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8 * ts,
                    borderRadius: 999,
                    padding: `${7 * ts}px ${18 * ts}px`,
                    background: isLightBg ? 'rgba(5,150,105,0.12)' : 'rgba(16,185,129,0.2)',
                    border: `1.5px solid ${isLightBg ? 'rgba(5,150,105,0.38)' : 'rgba(52,211,153,0.5)'}`,
                  }}
                >
                  <PhoneIcon size={16 * ts} color={isLightBg ? '#065f46' : '#6ee7b7'} />
                  <span
                    style={{
                      fontSize: 18 * ts,
                      fontWeight: 900,
                      color: isLightBg ? '#065f46' : '#6ee7b7',
                      fontVariantNumeric: 'tabular-nums',
                      letterSpacing: 0.6,
                    }}
                  >
                    {waFormatted}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══ PIEZA 1 · AFICHE MAESTRO (V36.0 · 6 ARQUITECTURAS RADICALMENTE DISTINTAS DE AGENCIA) ═══
  const darkPhotoTheme: AfficheTheme = {
    ...t,
    light: false,
    text: '#ffffff',
    sub: 'rgba(255,255,255,0.92)',
    accent: ensureReadableAccent(t.accent, false),
    accent2: ensureReadableAccent(t.accent2, false),
  };

  // Superficie sólida WCAG-verificada para bloques de color de marca (Split, Diagonal, Bento)
  const solidSurfaceHex = t.light
    ? '#f7f4ec'
    : mixHex(brandPalette?.primary ?? t.accent, '#090e1a', 0.78);
  const solidTheme: AfficheTheme = {
    ...t,
    light: Boolean(t.light),
    text: ensureContrastColor(t.light ? '#0f172a' : '#f8fafc', solidSurfaceHex, 8.0),
    sub: ensureContrastColor(t.light ? '#334155' : '#cbd5e1', solidSurfaceHex, 5.2),
    accent: ensureContrastColor(t.accent, solidSurfaceHex, 4.6),
    accent2: ensureContrastColor(t.accent2, solidSurfaceHex, 4.8),
  };

  // ── ARQUITECTURA 1: Split Screen Editorial 50/50 (Foto limpia arriba · Color-block sólido abajo) ──
  const renderEditorialSplit50 = (): ReactElement => {
    const photoHeight = isSquare ? 210 : 410;
    const isLightSplit = Boolean(solidTheme.light);
    const barAccent = solidTheme.accent2;
    return (
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: solidSurfaceHex,
        }}
      >
        {/* Mitad superior: 100% Fotografía pura sin texto que tape el producto */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: photoHeight,
            flexShrink: 0,
            overflow: 'hidden',
            background: '#050811',
          }}
        >
          <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.34) 0%, transparent 32%, transparent 74%, rgba(0,0,0,0.38) 100%)',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: pad,
              left: pad,
              right: logoUrl ? pad + 56 * s : pad,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              zIndex: 4,
            }}
          >
            <Badge text={badge} t={darkPhotoTheme} s={s} align="left" />
          </div>
          {priceOverlay && (
            <div style={{ position: 'absolute', right: pad, bottom: 12 * ts, zIndex: 5 }}>
              <PricePill brand={brand} t={darkPhotoTheme} s={s} />
            </div>
          )}
        </div>

        {/* Filete arquitectónico de color de marca */}
        <div
          aria-hidden="true"
          style={{
            height: isSquare ? 4 : 5,
            width: '100%',
            flexShrink: 0,
            background: `linear-gradient(90deg, ${t.accent}, ${t.accent2})`,
          }}
        />

        {/* Mitad inferior: Bloque sólido editorial de alto contraste WCAG */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            padding: isSquare ? `${12}px ${pad}px` : `${18}px ${pad}px`,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: isSquare ? 5 : 9,
            background: isLightSplit
              ? `linear-gradient(180deg, ${solidSurfaceHex} 0%, #ede8dc 100%)`
              : `linear-gradient(180deg, ${solidSurfaceHex} 0%, #050811 100%)`,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: isSquare ? 4 : 7, minHeight: 0 }}>
            <Headline
              texts={texts}
              t={solidTheme}
              s={s}
              size={isSquare ? 36 : 48}
              align="left"
              styleId={fontStyle}
              scale={Math.min(hs, 1.24)}
              fullWidth
            />
            <SubHead text={texts.sub} t={solidTheme} s={s} align="left" color={solidTheme.sub} />
            {showBenefits && benefits.length > 0 && (
              <BenefitsShowcase
                items={benefits}
                t={solidTheme}
                s={s}
                mode={benefitStyle === 'auto' ? 'editorial' : resolvedBenefitMode}
                align="left"
              />
            )}
            {adaptiveCta && (
              <EditorialActionCue
                label={adaptiveCta}
                s={s}
                accent={solidTheme.accent}
                accent2={barAccent}
                inkColor={solidTheme.text}
                align="left"
                arrowDir="right-down"
                variant="typographic"
                showArrow={showQr}
              />
            )}
          </div>
          <Dock
            brand={brand}
            t={solidTheme}
            s={s}
            qrUrl={qrUrl}
            qrValue={qrValue}
            qrStyle={qrStyle}
            size={isSquare ? 116 : dockQrSize}
            qrLabel={qrLabel}
            displayFont={boardDisplayFont}
            bodyFont={activeTypo.bodyFont}
            variant={resolvedDockVariant}
            brandColors={brandColors}
            logoUrl={logoUrl}
            qrMode={qrMode}
            surfaceHex={isLightSplit ? '#ffffff' : mixHex(solidSurfaceHex, '#02040a', 0.4)}
            showQrToken={showQr}
          />
        </div>
      </div>
    );
  };

  // ── ARQUITECTURA 2: Arco Orgánico / Boutique Luxury (Ventana de arco + columna lateral QR) ──
  const renderOrganicArchLuxury = (): ReactElement => {
    const isLightCanvas = Boolean(t.light);
    const canvasRefHex = isLightCanvas ? '#f6f1e6' : dominantDark;
    const archTheme: AfficheTheme = {
      ...t,
      text: ensureContrastColor(isLightCanvas ? '#18181b' : '#ffffff', canvasRefHex, 7.8),
      sub: ensureContrastColor(isLightCanvas ? '#44403c' : '#e2e8f0', canvasRefHex, 5.2),
      accent: ensureContrastColor(t.accent, canvasRefHex, 4.5),
      accent2: ensureContrastColor(t.accent2, canvasRefHex, 4.8),
    };
    const sideQrSize = 152;
    const useSideQrPedestal = !isSquare && showQr && Boolean(qrValue || qrUrl);

    return (
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          padding: isSquare ? 14 : 22,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: isSquare ? 8 : 12,
          overflow: 'hidden',
        }}
      >
        {/* Cabecera boutique */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            paddingRight: logoUrl ? 50 * s : 0,
            flexShrink: 0,
          }}
        >
          <Badge text={badge} t={archTheme} s={s} align="left" />
          <span
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 11 * ts,
              fontWeight: 900,
              letterSpacing: 2 * ts,
              color: archTheme.accent2,
              textTransform: 'uppercase',
            }}
          >
            {(brand.municipality || 'GACHETÁ').toUpperCase()}
          </span>
        </div>

        {/* Escenario del Arco Arquitectónico + Pedestal QR lateral en 9:16 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'stretch',
            gap: isSquare ? 12 : 16,
            height: isSquare ? 214 : 386,
            flexShrink: 0,
          }}
        >
          {/* Fotografía recortada en arco arquitectónico */}
          <div
            style={{
              position: 'relative',
              flex: isSquare ? '0 0 46%' : useSideQrPedestal ? '1 1 62%' : '1 1 100%',
              height: '100%',
              borderRadius: isSquare ? '120px 120px 16px 16px' : '240px 240px 20px 20px',
              overflow: 'hidden',
              border: `2.5px solid ${archTheme.accent2}88`,
              boxShadow: isLightCanvas
                ? '0 22px 44px -16px rgba(24,24,27,0.28)'
                : '0 26px 54px -14px rgba(0,0,0,0.75)',
              background: '#050811',
            }}
          >
            <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
            {priceOverlay && (
              <div style={{ position: 'absolute', left: '50%', bottom: 10 * ts, transform: 'translateX(-50%)', zIndex: 4 }}>
                <PricePill brand={brand} t={darkPhotoTheme} s={s * 0.94} />
              </div>
            )}
          </div>

          {/* Columna derecha editorial en Story: QR protagonista flotante / En Square: Titular + Precio */}
          {useSideQrPedestal ? (
            <div
              style={{
                flex: '0 0 176px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 10px',
                borderRadius: 24,
                background: isLightCanvas ? 'rgba(255,255,255,0.78)' : 'rgba(255,255,255,0.07)',
                border: `1.5px solid ${archTheme.accent2}44`,
                backdropFilter: 'blur(14px)',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: 10.5,
                    fontWeight: 900,
                    letterSpacing: 1.8,
                    color: archTheme.accent2,
                    textTransform: 'uppercase',
                  }}
                >
                  EDICIÓN ESPECIAL
                </p>
                <div
                  style={{
                    width: 34,
                    height: 2,
                    margin: '8px auto 0',
                    background: `linear-gradient(90deg, transparent, ${archTheme.accent2}, transparent)`,
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <QrOrganicToken
                  qrValue={qrValue}
                  qrUrl={qrUrl}
                  size={sideQrSize}
                  t={archTheme}
                  s={1}
                  businessName={brand.name || 'Impulso'}
                  qrStyle={qrStyle}
                  brandColors={brandColors}
                />
                <p
                  style={{
                    margin: 0,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontSize: 11,
                    fontWeight: 900,
                    letterSpacing: 1.2,
                    color: archTheme.text,
                    textTransform: 'uppercase',
                    textAlign: 'center',
                  }}
                >
                  {cleanPosterCopy(qrLabel || 'ESCANEA AQUÍ')}
                </p>
              </div>

              <span style={{ fontSize: 11, fontWeight: 800, color: archTheme.sub, textAlign: 'center' }}>
                {cleanPosterCopy(brand.name || 'Tu Negocio')}
              </span>
            </div>
          ) : isSquare ? (
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Headline
                texts={texts}
                t={archTheme}
                s={s}
                size={36}
                align="left"
                styleId={fontStyle}
                scale={Math.min(hs, 1.18)}
                fullWidth
              />
              <SubHead text={texts.sub} t={archTheme} s={s} align="left" color={archTheme.sub} />
              {adaptiveCta && (
                <EditorialActionCue
                  label={adaptiveCta}
                  s={s}
                  accent={archTheme.accent}
                  accent2={archTheme.accent2}
                  inkColor={archTheme.text}
                  align="left"
                  arrowDir="down"
                  variant="stamp"
                  showArrow={showQr}
                />
              )}
            </div>
          ) : null}
        </div>

        {/* Bloque tipográfico principal (en Story) + Beneficios + Pie de marca */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: isSquare ? 6 : 10 }}>
          {!isSquare && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Headline
                texts={texts}
                t={archTheme}
                s={s}
                size={50}
                align="left"
                styleId={fontStyle}
                scale={Math.min(hs, 1.24)}
                fullWidth
              />
              <SubHead text={texts.sub} t={archTheme} s={s} align="left" color={archTheme.sub} />
              {showBenefits && benefits.length > 0 && (
                <BenefitsShowcase
                  items={benefits}
                  t={archTheme}
                  s={s}
                  mode={benefitStyle === 'auto' ? 'editorial' : resolvedBenefitMode}
                  align="left"
                />
              )}
              {adaptiveCta && (
                <EditorialActionCue
                  label={adaptiveCta}
                  s={s}
                  accent={archTheme.accent}
                  accent2={archTheme.accent2}
                  inkColor={archTheme.text}
                  align="left"
                  arrowDir="right-up"
                  variant="stamp"
                  showArrow={useSideQrPedestal}
                />
              )}
            </div>
          )}

          {isSquare && showBenefits && benefits.length > 0 && (
            <BenefitsShowcase
              items={benefits}
              t={archTheme}
              s={s}
              mode={benefitStyle === 'auto' ? 'editorial' : resolvedBenefitMode}
              align="left"
            />
          )}

          <Dock
            brand={brand}
            t={archTheme}
            s={s}
            qrUrl={qrUrl}
            qrValue={qrValue}
            qrStyle={qrStyle}
            size={isSquare ? 114 : dockQrSize}
            qrLabel={qrLabel}
            displayFont={boardDisplayFont}
            bodyFont={activeTypo.bodyFont}
            variant={resolvedDockVariant}
            brandColors={brandColors}
            logoUrl={logoUrl}
            qrMode={qrMode}
            surfaceHex={isLightCanvas ? '#ffffff' : '#090e1c'}
            showQrToken={showQr && !useSideQrPedestal}
          />
        </div>
      </div>
    );
  };

  // ── ARQUITECTURA 3: Corte Diagonal Dinámico + QR VIP en Esquina Superior Derecha ──
  const renderDynamicDiagonalVip = (): ReactElement => {
    const diagSurface = mixHex(brandPalette?.primary ?? t.accent, '#070b14', 0.68);
    const diagTheme: AfficheTheme = {
      ...t,
      light: false,
      text: '#ffffff',
      sub: 'rgba(241,245,249,0.92)',
      accent: ensureContrastColor(t.accent, diagSurface, 4.6),
      accent2: ensureContrastColor(t.accent2, diagSurface, 5.2),
    };
    const topRightQrSize = isSquare ? 116 : 162;
    const hasTopRightQr = showQr && Boolean(qrValue || qrUrl);

    return (
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          background: `linear-gradient(160deg, ${diagSurface} 0%, #050811 100%)`,
        }}
      >
        {/* Fotografía con corte diagonal real (clip-path poligonal) */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: isSquare ? '54%' : '56%',
            clipPath: isSquare
              ? 'polygon(0 0, 100% 0, 100% 78%, 0 98%)'
              : 'polygon(0 0, 100% 0, 100% 74%, 0 96%)',
            overflow: 'hidden',
            background: '#000000',
          }}
        >
          <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(135deg, rgba(0,0,0,0.46) 0%, transparent 48%, rgba(0,0,0,0.34) 100%)',
            }}
          />
        </div>

        {/* Franja geométrica de acento paralela al corte diagonal */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '-8%',
            right: '-8%',
            top: isSquare ? '46.5%' : '47%',
            height: isSquare ? 5 : 7,
            transform: isSquare ? 'rotate(-11.5deg)' : 'rotate(-12.5deg)',
            background: `linear-gradient(90deg, ${t.accent}, ${t.accent2}, ${t.accent})`,
            boxShadow: `0 0 28px ${t.accent2}88`,
            pointerEvents: 'none',
            zIndex: 4,
          }}
        />

        {/* Cabecera superior: Sello izquierda + QR VIP Protagonista en esquina superior derecha */}
        <div
          style={{
            position: 'relative',
            zIndex: 8,
            width: '100%',
            height: '100%',
            padding: pad,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
              <Badge text={badge} t={darkPhotoTheme} s={s} align="left" />
              {priceOverlay && <PricePill brand={brand} t={darkPhotoTheme} s={s} />}
            </div>

            {hasTopRightQr && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6 * ts,
                  padding: `${8 * ts}px`,
                  borderRadius: 18 * ts,
                  background: 'rgba(6, 10, 22, 0.78)',
                  backdropFilter: 'blur(16px)',
                  border: `1.5px solid ${diagTheme.accent2}77`,
                  boxShadow: '0 22px 46px rgba(0,0,0,0.6)',
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontSize: 9.5 * ts,
                    fontWeight: 900,
                    letterSpacing: 1.4 * ts,
                    color: diagTheme.accent2,
                    textTransform: 'uppercase',
                  }}
                >
                  PASE DIRECTO
                </span>
                <QrOrganicToken
                  qrValue={qrValue}
                  qrUrl={qrUrl}
                  size={topRightQrSize}
                  t={diagTheme}
                  s={s}
                  businessName={brand.name || 'Impulso'}
                  qrStyle={qrStyle}
                  brandColors={brandColors}
                />
                <span
                  style={{
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontSize: 10 * ts,
                    fontWeight: 900,
                    letterSpacing: 1.1 * ts,
                    color: '#ffffff',
                    textTransform: 'uppercase',
                  }}
                >
                  {cleanPosterCopy(qrLabel || 'ESCANEA AQUÍ')}
                </span>
              </div>
            )}
          </div>

          {/* Zona inferior diagonal: Titular monumental + Beneficios + Pie de marca sin duplicar QR */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: isSquare ? 5 : 9,
              marginTop: 'auto',
              paddingTop: isSquare ? 18 : 34,
            }}
          >
            <Headline
              texts={texts}
              t={diagTheme}
              s={s}
              size={isSquare ? 37 : 51}
              align="left"
              styleId={fontStyle}
              scale={Math.min(hs, 1.24)}
              fullWidth
              longShadow
            />
            <SubHead text={texts.sub} t={diagTheme} s={s} align="left" color={diagTheme.sub} />
            {showBenefits && benefits.length > 0 && (
              <BenefitsShowcase
                items={benefits}
                t={diagTheme}
                s={s}
                mode={benefitStyle === 'auto' ? 'callouts' : resolvedBenefitMode}
                align="left"
              />
            )}
            {adaptiveCta && (
              <EditorialActionCue
                label={adaptiveCta}
                s={s}
                accent={t.accent}
                accent2={diagTheme.accent2}
                inkColor={contrastTextOn(t.accent, diagTheme.accent2)}
                align="left"
                arrowDir="right-up"
                variant="ribbon"
                showArrow={hasTopRightQr}
              />
            )}
            <Dock
              brand={brand}
              t={diagTheme}
              s={s}
              qrUrl={qrUrl}
              qrValue={qrValue}
              qrStyle={qrStyle}
              size={dockQrSize}
              qrLabel={qrLabel}
              displayFont={boardDisplayFont}
              bodyFont={activeTypo.bodyFont}
              variant={resolvedDockVariant}
              brandColors={brandColors}
              logoUrl={logoUrl}
              qrMode={qrMode}
              surfaceHex="#070c18"
              showQrToken={false}
            />
          </div>
        </div>
      </div>
    );
  };

  // ── ARQUITECTURA 4: Portada de Revista Full-Bleed Inmersiva (Masthead editorial + viñeta de marca) ──
  const renderMagazineCover = ({
    align = 'left',
    watermarkText,
    editorialAccentRule = true,
  }: {
    align?: 'left' | 'center';
    watermarkText?: string;
    editorialAccentRule?: boolean;
  }): ReactElement => {
    const mastheadText = cleanPosterCopy(brand.name || 'IMPULSO').toUpperCase();
    const regionText = cleanPosterCopy(brand.municipality || 'GACHETÁ').toUpperCase();

    return (
      <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#000000' }}>
        <div style={{ position: 'absolute', inset: 0 }}>
          <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
        </div>
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(to bottom, rgba(0,0,0,0.52) 0%, transparent 24%, transparent 42%, rgba(0,0,0,0.68) 70%, ${dominantDark}fc 100%)`,
          }}
        />
        {watermarkText && (
          <p
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: '18%',
              left: '-6%',
              right: '-6%',
              margin: 0,
              textAlign: 'center',
              fontFamily: `"${boardDisplayFont}", system-ui, sans-serif`,
              fontSize: 112 * s,
              fontWeight: 900,
              letterSpacing: -3 * s,
              lineHeight: 0.85,
              color: 'rgba(255,255,255,0.08)',
              transform: 'rotate(-4deg)',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}
          >
            {watermarkText}
          </p>
        )}

        <div
          style={{
            position: 'relative',
            zIndex: 6,
            width: '100%',
            height: '100%',
            padding: pad,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: isSquare ? 6 : 10,
          }}
        >
          {/* Cabecera Masthead estilo Revista */}
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: isSquare ? 6 : 9 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid rgba(255,255,255,0.34)',
                paddingBottom: 6 * ts,
                paddingRight: logoUrl ? 52 * s : 0,
              }}
            >
              <span
                style={{
                  fontFamily: `"${boardDisplayFont}", system-ui, sans-serif`,
                  fontSize: 18 * ts,
                  fontWeight: 900,
                  letterSpacing: 3 * ts,
                  color: '#ffffff',
                  textShadow: '0 2px 10px rgba(0,0,0,0.75)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {mastheadText}
              </span>
              <span
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: 10.5 * ts,
                  fontWeight: 800,
                  letterSpacing: 1.8 * ts,
                  color: darkPhotoTheme.accent2,
                  flexShrink: 0,
                }}
              >
                {regionText} · EDICIÓN HOY
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <Badge text={badge} t={darkPhotoTheme} s={s} align="left" />
              {priceOverlay && <PricePill brand={brand} t={darkPhotoTheme} s={s} />}
            </div>
          </div>

          <div style={{ flex: 1, minHeight: isSquare ? 8 : 80 }} />

          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: isSquare ? 5 : 8 }}>
            <div style={editorialAccentRule && align === 'left' ? { borderLeft: `4px solid ${darkPhotoTheme.accent2}`, paddingLeft: 12 * ts } : undefined}>
              <Headline
                texts={texts}
                t={darkPhotoTheme}
                s={s}
                size={isSquare ? 40 : 54}
                align={align}
                styleId={fontStyle}
                scale={hs}
                fullWidth
                longShadow
              />
            </div>
            <SubHead text={texts.sub} t={darkPhotoTheme} s={s} align={align} color="rgba(255,255,255,0.94)" />
            {showBenefits && benefits.length > 0 && (
              <BenefitsShowcase
                items={benefits}
                t={darkPhotoTheme}
                s={s}
                mode={benefitStyle === 'auto' ? 'editorial' : resolvedBenefitMode}
                align={align}
              />
            )}
            {adaptiveCta && (
              <EditorialActionCue
                label={adaptiveCta}
                s={s}
                accent={t.accent}
                accent2={darkPhotoTheme.accent2}
                inkColor={contrastTextOn(t.accent, darkPhotoTheme.accent2)}
                align={align}
                arrowDir="right-down"
                variant="ribbon"
                showArrow={showQr}
              />
            )}
            <Dock
              brand={brand}
              t={darkPhotoTheme}
              s={s}
              qrUrl={qrUrl}
              qrValue={qrValue}
              qrStyle={qrStyle}
              size={dockQrSize}
              qrLabel={qrLabel}
              displayFont={boardDisplayFont}
              bodyFont={activeTypo.bodyFont}
              variant={resolvedDockVariant}
              brandColors={brandColors}
              logoUrl={logoUrl}
              qrMode={qrMode}
              surfaceHex={dominantDark}
              showQrToken={showQr}
            />
          </div>
        </div>
      </div>
    );
  };

  // ── ARQUITECTURA 5: Cuadrícula Bento Asimétrica (4 módulos geométricos Apple / Suiza) ──
  const renderAsymmetricBento = (): ReactElement => {
    const isLightBento = Boolean(t.light);
    const boardBg = isLightBento ? '#e7e2d7' : '#060a14';
    const tileBg = isLightBento ? '#ffffff' : '#10182b';
    const tileBorder = isLightBento ? '1.5px solid rgba(15,23,42,0.10)' : `1.5px solid ${t.accent2}2e`;
    const bentoTheme: AfficheTheme = {
      ...t,
      text: ensureContrastColor(isLightBento ? '#0f172a' : '#f8fafc', tileBg, 8.0),
      sub: ensureContrastColor(isLightBento ? '#475569' : '#cbd5e1', tileBg, 5.2),
      accent: ensureContrastColor(t.accent, tileBg, 4.6),
      accent2: ensureContrastColor(t.accent2, tileBg, 4.8),
    };
    const qrTileInk = contrastTextOn(t.accent, t.accent2);
    const phone = (brand.phoneDisplay || '').replace(/^[^\p{L}\p{N}+]+/u, '').trim();
    const addressText = cleanPosterCopy(brand.address || brand.municipality || 'Casco Urbano');
    const bentoQrSize = isSquare ? 116 : 162;

    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          padding: isSquare ? 12 : 16,
          boxSizing: 'border-box',
          background: boardBg,
          display: 'grid',
          gridTemplateRows: isSquare ? '176px auto 1fr' : '345px auto 1fr',
          gap: isSquare ? 8 : 12,
          overflow: 'hidden',
        }}
      >
        {/* Módulo 1: Fotografía pura en tarjeta Bento */}
        <div
          style={{
            position: 'relative',
            borderRadius: 20 * ts,
            overflow: 'hidden',
            border: tileBorder,
            background: '#050811',
          }}
        >
          <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.36) 0%, transparent 38%, rgba(0,0,0,0.42) 100%)',
              pointerEvents: 'none',
            }}
          />
          <div style={{ position: 'absolute', top: 12 * ts, left: 12 * ts, zIndex: 4 }}>
            <Badge text={badge} t={darkPhotoTheme} s={s} align="left" />
          </div>
          {logoUrl && (
            <div
              style={{
                position: 'absolute',
                top: 12 * ts,
                right: 12 * ts,
                zIndex: 4,
                padding: 4 * ts,
                borderRadius: 11 * ts,
                background: 'rgba(8,12,24,0.68)',
                border: '1px solid rgba(255,255,255,0.2)',
              }}
            >
              <img src={logoUrl} alt="" style={{ width: 32 * ts, height: 32 * ts, objectFit: 'contain', display: 'block', borderRadius: 7 * ts }} />
            </div>
          )}
          {priceOverlay && (
            <div style={{ position: 'absolute', right: 12 * ts, bottom: 12 * ts, zIndex: 4 }}>
              <PricePill brand={brand} t={darkPhotoTheme} s={s} />
            </div>
          )}
        </div>

        {/* Módulo 2: Titular monumental + subtítulo + acción editorial */}
        <div
          style={{
            borderRadius: 20 * ts,
            background: tileBg,
            border: tileBorder,
            padding: isSquare ? '10px 14px' : '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: isSquare ? 4 : 7,
            overflow: 'hidden',
          }}
        >
          <Headline
            texts={texts}
            t={bentoTheme}
            s={s}
            size={isSquare ? 34 : 46}
            align="left"
            styleId={fontStyle}
            scale={Math.min(hs, 1.2)}
            fullWidth
          />
          <SubHead text={texts.sub} t={bentoTheme} s={s} align="left" color={bentoTheme.sub} />
          {!isSquare && adaptiveCta && (
            <EditorialActionCue
              label={adaptiveCta}
              s={s}
              accent={bentoTheme.accent}
              accent2={bentoTheme.accent2}
              inkColor={bentoTheme.text}
              align="left"
              arrowDir="right-down"
              variant="typographic"
              showArrow={showQr}
            />
          )}
        </div>

        {/* Fila inferior asimétrica: Módulo 3 (Beneficios + Contacto) + Módulo 4 (QR Protagonista) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: showQr ? (isSquare ? '1.25fr 0.85fr' : '1.15fr 0.92fr') : '1fr',
            gap: isSquare ? 8 : 12,
            minHeight: 0,
          }}
        >
          {/* Módulo 3: Beneficios claros + Nombre + Dirección + WhatsApp */}
          <div
            style={{
              borderRadius: 20 * ts,
              background: tileBg,
              border: tileBorder,
              padding: isSquare ? '10px 12px' : '16px 16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: isSquare ? 5 : 9,
              minWidth: 0,
              overflow: 'hidden',
            }}
          >
            {showBenefits && benefits.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: isSquare ? 4 : 7 }}>
                {benefits.slice(0, 3).map((b, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7 * ts }}>
                    <Check size={14 * ts} color={bentoTheme.accent2} strokeWidth={3} style={{ marginTop: 2, flexShrink: 0 }} aria-hidden />
                    <span style={{ fontSize: (isSquare ? 13.5 : 15.5) * ts, fontWeight: 800, color: bentoTheme.text, lineHeight: 1.18 }}>
                      {cleanPosterCopy(b)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 * ts, borderTop: `1px solid ${isLightBento ? 'rgba(15,23,42,0.1)' : 'rgba(255,255,255,0.1)'}`, paddingTop: 7 * ts }}>
              <p
                style={{
                  margin: 0,
                  fontFamily: `"${boardDisplayFont}", system-ui, sans-serif`,
                  fontSize: (isSquare ? 19 : 24) * ts,
                  fontWeight: 900,
                  color: bentoTheme.text,
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {cleanPosterCopy(brand.name || 'Tu Negocio')}
              </p>
              <p style={{ margin: 0, fontSize: 13 * ts, fontWeight: 700, color: bentoTheme.sub, display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <MapPin size={13 * ts} color={bentoTheme.accent2} style={{ flexShrink: 0 }} aria-hidden />
                {addressText}
              </p>
              {phone && (
                <p style={{ margin: 0, fontSize: 14.5 * ts, fontWeight: 900, color: bentoTheme.accent, display: 'flex', alignItems: 'center', gap: 5, fontVariantNumeric: 'tabular-nums' }}>
                  <PhoneIcon size={13.5 * ts} color={bentoTheme.accent} />
                  {phone}
                </p>
              )}
            </div>
          </div>

          {/* Módulo 4: Tarjeta QR dedicada con color de marca */}
          {showQr && (
            <div
              style={{
                borderRadius: 20 * ts,
                background: `linear-gradient(155deg, ${t.accent} 0%, ${mixHex(t.accent, '#090f1d', 0.35)} 100%)`,
                padding: isSquare ? 8 : 14,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: isSquare ? 5 : 9,
                overflow: 'hidden',
              }}
            >
              <QrOrganicToken
                qrValue={qrValue}
                qrUrl={qrUrl}
                size={bentoQrSize}
                t={bentoTheme}
                s={s}
                businessName={brand.name || 'Impulso'}
                qrStyle={qrStyle}
                brandColors={brandColors}
              />
              <span
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: 10.5 * ts,
                  fontWeight: 900,
                  letterSpacing: 1.2 * ts,
                  color: qrTileInk,
                  textTransform: 'uppercase',
                  textAlign: 'center',
                }}
              >
                {cleanPosterCopy(qrLabel || 'ESCANEA AQUÍ')}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── ARQUITECTURA 6: Polaroid 3D & Collage Multi-Foto (Soporta 1 o 2 fotos físicas con inclinación) ──
  const renderPolaroid3dCollage = (): ReactElement => {
    const isLightBg = Boolean(t.light);
    const bgRef = isLightBg ? '#f3efe6' : dominantDark;
    const polTheme: AfficheTheme = {
      ...t,
      text: ensureContrastColor(isLightBg ? '#18181b' : '#ffffff', bgRef, 7.8),
      sub: ensureContrastColor(isLightBg ? '#475569' : '#e2e8f0', bgRef, 5.2),
      accent: ensureContrastColor(t.accent, bgRef, 4.5),
      accent2: ensureContrastColor(t.accent2, bgRef, 4.8),
    };
    const hasDistinctSecondPhoto = Boolean(photo2 && photo2 !== photoUrl);
    const stageHeight = isSquare ? 202 : 382;

    return (
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          padding: isSquare ? 14 : 20,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: isSquare ? 6 : 10,
          overflow: 'hidden',
        }}
      >
        {/* Cabecera */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingRight: logoUrl ? 50 * s : 0,
            flexShrink: 0,
          }}
        >
          <Badge text={badge} t={polTheme} s={s} align="left" />
          {priceOverlay && <PricePill brand={brand} t={darkPhotoTheme} s={s} />}
        </div>

        {/* Escenario físico de Marcos Polaroid 3D inclinados */}
        <div style={{ position: 'relative', width: '100%', height: stageHeight, flexShrink: 0 }}>
          {/* Polaroid 1 (Principal) */}
          <div
            style={{
              position: 'absolute',
              left: hasDistinctSecondPhoto ? '2%' : '10%',
              top: isSquare ? 4 : 10,
              width: hasDistinctSecondPhoto ? '62%' : '80%',
              height: isSquare ? 186 : 332,
              background: '#fdfcf8',
              padding: isSquare ? '7px 7px 22px 7px' : '11px 11px 36px 11px',
              boxSizing: 'border-box',
              borderRadius: 6,
              transform: hasDistinctSecondPhoto ? 'rotate(-3deg)' : 'rotate(-1.8deg)',
              boxShadow: '0 24px 48px -12px rgba(0,0,0,0.52), 0 4px 12px rgba(0,0,0,0.22)',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 3,
            }}
          >
            <div style={{ flex: 1, width: '100%', overflow: 'hidden', borderRadius: 2, background: '#111827' }}>
              <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
            </div>
            <span
              style={{
                position: 'absolute',
                left: 12,
                right: 12,
                bottom: isSquare ? 5 : 10,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: isSquare ? 9 : 11,
                fontWeight: 800,
                color: '#334155',
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {cleanPosterCopy(brand.product || brand.name || 'EDICIÓN LOCAL')}
            </span>
          </div>

          {/* Polaroid 2 (Toma secundaria en superposición real si existe 2ª foto) */}
          {hasDistinctSecondPhoto && (
            <div
              style={{
                position: 'absolute',
                right: '1.5%',
                bottom: isSquare ? 2 : 8,
                width: '46%',
                height: isSquare ? 148 : 262,
                background: '#fdfcf8',
                padding: isSquare ? '6px 6px 18px 6px' : '9px 9px 28px 9px',
                boxSizing: 'border-box',
                borderRadius: 6,
                transform: 'rotate(4deg)',
                boxShadow: '0 26px 52px -12px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.24)',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 5,
              }}
            >
              <div style={{ flex: 1, width: '100%', overflow: 'hidden', borderRadius: 2, background: '#111827' }}>
                <Photo url={photo2} zoom={1.06} posY={0.45} />
              </div>
              <span
                style={{
                  position: 'absolute',
                  left: 10,
                  right: 10,
                  bottom: isSquare ? 4 : 8,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: isSquare ? 8 : 10,
                  fontWeight: 800,
                  color: '#475569',
                  textAlign: 'center',
                  textTransform: 'uppercase',
                }}
              >
                {cleanPosterCopy(brand.municipality || 'GACHETÁ')}
              </span>
            </div>
          )}
        </div>

        {/* Bloque editorial inferior */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: isSquare ? 5 : 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: isSquare ? 4 : 7 }}>
            <Headline
              texts={texts}
              t={polTheme}
              s={s}
              size={isSquare ? 35 : 48}
              align="left"
              styleId={fontStyle}
              scale={Math.min(hs, 1.22)}
              fullWidth
            />
            <SubHead text={texts.sub} t={polTheme} s={s} align="left" color={polTheme.sub} />
            {showBenefits && benefits.length > 0 && (
              <BenefitsShowcase
                items={benefits}
                t={polTheme}
                s={s}
                mode={benefitStyle === 'auto' ? 'editorial' : resolvedBenefitMode}
                align="left"
              />
            )}
            {adaptiveCta && (
              <EditorialActionCue
                label={adaptiveCta}
                s={s}
                accent={polTheme.accent}
                accent2={polTheme.accent2}
                inkColor={polTheme.text}
                align="left"
                arrowDir="right-down"
                variant="stamp"
                showArrow={showQr}
              />
            )}
          </div>
          <Dock
            brand={brand}
            t={polTheme}
            s={s}
            qrUrl={qrUrl}
            qrValue={qrValue}
            qrStyle={qrStyle}
            size={isSquare ? 114 : dockQrSize}
            qrLabel={qrLabel}
            displayFont={boardDisplayFont}
            bodyFont={activeTypo.bodyFont}
            variant={resolvedDockVariant}
            brandColors={brandColors}
            logoUrl={logoUrl}
            qrMode={qrMode}
            surfaceHex={isLightBg ? '#ffffff' : '#080e1c'}
            showQrToken={showQr}
          />
        </div>
      </div>
    );
  };

  const blendWord = (cleanPosterCopy(brand.product || brand.name || 'IMPULSO').split(/\s+/)[0] || 'OFERTA').toUpperCase();
  const isDiagonalVipLayout =
    layout === 'diagonal' ||
    layout === 'diagx' ||
    layout === 'cyber' ||
    layout === 'flash' ||
    layout === 'diamond' ||
    layout === 'brutal' ||
    layout === 'retail' ||
    layout === 'hud';
  const isBentoGridLayout = layout === 'bento' || layout === 'bento3d';

  let body: ReactElement;
  switch (layout) {
    case 'split':
    case 'swiss':
    case 'zen':
    case 'clinic':
    case 'agro':
    case 'menu': {
      body = renderEditorialSplit50();
      break;
    }

    case 'arc':
    case 'vip':
    case 'resort':
    case 'eco':
    case 'portal': {
      body = renderOrganicArchLuxury();
      break;
    }

    case 'diagonal':
    case 'diagx':
    case 'cyber':
    case 'flash':
    case 'diamond':
    case 'brutal':
    case 'retail':
    case 'hud': {
      body = renderDynamicDiagonalVip();
      break;
    }

    case 'bento':
    case 'bento3d': {
      body = renderAsymmetricBento();
      break;
    }

    case 'polaroid':
    case 'collage':
    case 'float': {
      body = renderPolaroid3dCollage();
      break;
    }

    case 'immersive':
    case 'cinema':
    case 'orbits': {
      body = renderMagazineCover({
        align: 'center',
        watermarkText: layout === 'immersive' || layout === 'orbits' ? blendWord : undefined,
        editorialAccentRule: false,
      });
      break;
    }

    case 'bleed':
    case 'magazine':
    case 'rustic':
    default: {
      body = renderMagazineCover({
        align: 'left',
        editorialAccentRule: true,
      });
      break;
    }
  }

  // Oculta el logo flotante en esquina superior derecha si esa esquina la ocupa el QR VIP o Bento (evita solapamiento)
  const showCornerFloatingLogo = Boolean(logoUrl) && !isDiagonalVipLayout && !isBentoGridLayout;

  return (
    <div
      style={{
        ...cssBrandVars,
        width: W,
        height: H,
        flexShrink: 0,
        position: 'relative',
        background: t.bg,
        backgroundSize: t.bgSize ?? '100% 100%, 100% 100%, 100% 100%, 100% 100%',
        color: t.text,
        fontFamily: boardBodyFont,
        borderRadius: 24 * s,
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'relative', width: '100%', height: '100%', boxSizing: 'border-box' }}>
        {body}
        {showCornerFloatingLogo && logoUrl && (
          <div
            style={{
              position: 'absolute',
              top: pad,
              right: pad,
              zIndex: 12,
              padding: 4 * s,
              borderRadius: 12 * s,
              background: 'rgba(8,12,24,0.66)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.24)',
              boxShadow: '0 8px 20px rgba(0,0,0,0.35)',
              pointerEvents: 'none',
            }}
          >
            <img
              src={logoUrl}
              alt=""
              style={{ width: 38 * s, height: 38 * s, objectFit: 'contain', display: 'block', borderRadius: 8 * s }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
