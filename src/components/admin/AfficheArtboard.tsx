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
import { ArrowUpRight, Check, MapPin, Phone, ShieldCheck, Zap } from 'lucide-react';
import { themeQrPalette } from '../../utils/styledQr';
import type { QrStyle } from '../../utils/styledQr';
import { contrastTextOn, ensureReadableAccent, mixHex, relativeLuminance } from '../../utils/colorPalette';
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
 * Orquesta dinámicamente el texto del botón CTA según el destino del Código QR.
 */
function resolveAdaptiveCta(
  qrMode: AfficheQrMode | undefined,
  rawCta: string,
  isService: boolean,
): string {
  const cleaned = cleanPosterCopy(rawCta);
  const hasWaCopy = /whatsapp|pide\s+el\s+tuyo|cotiza/i.test(cleaned);
  if (qrMode === 'perfil') {
    return hasWaCopy || !cleaned ? 'Ver todas las ofertas' : cleaned;
  }
  if (qrMode === 'externo') {
    return /whatsapp|pide\s+el\s+tuyo|cotiza|aparta|ver\s+todas/i.test(cleaned) || !cleaned
      ? 'Visita nuestro sitio'
      : cleaned;
  }
  if (qrMode === 'oferta') {
    return /whatsapp|visita\s+nuestro\s+sitio|ver\s+todas/i.test(cleaned) || !cleaned
      ? 'Aparta tu cupo hoy'
      : cleaned;
  }
  if (cleaned) return cleaned;
  return isService ? 'Cotiza en 1 clic' : 'Escríbenos por WhatsApp';
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
  const computedSize = size * 1.12 * typo.opticalBoost * scale * s;
  const isLight = Boolean(t.light);
  const readableAccent2 = ensureReadableAccent(t.accent2, isLight);
  const baseInk = color ?? (isLight ? t.text : '#ffffff');
  const shadowColor = longShadow
    ? `0 6px 18px rgba(0,0,0,0.95), 0 ${14 * s}px ${36 * s}px rgba(0,0,0,0.88), 0 0 ${26 * s}px ${readableAccent2}4d`
    : isLight && !color
      ? '0 2px 10px rgba(255,255,255,0.45)'
      : '0 6px 18px rgba(0,0,0,0.95), 0 14px 34px rgba(0,0,0,0.85)';

  const base: CSSProperties = {
    margin: 0,
    position: 'relative',
    zIndex: 10,
    fontFamily: `"${typo.font || t.font}", system-ui, sans-serif`,
    fontSize: Number(computedSize.toFixed(1)),
    lineHeight: eff === 'caja' ? 1.0 : 0.94,
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: -1.1 * s,
    color: baseInk,
    textShadow: shadowColor,
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
  return (
    <p
      style={{
        margin: 0,
        fontSize: 16 * s,
        fontWeight: 600,
        lineHeight: 1.3,
        color: color ?? t.sub,
        textAlign: align,
        opacity: 0.94,
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
  const g = glass(t);
  const cleanItems = items.slice(0, 3).map((b) => splitBenefit(b).body).filter(Boolean);
  if (cleanItems.length === 0) return null;

  if (mode === 'badges') {
    return (
      <div style={{ display: 'flex', alignItems: 'stretch', justifyContent: 'center', gap: 9 * s, flexShrink: 0 }}>
        {cleanItems.map((body, i) => {
          const offsetY = i === 1 ? -4 * s : 3 * s;
          return (
            <div
              key={i}
              style={{
                flex: 1,
                minWidth: 0,
                transform: `translateY(${offsetY}px)`,
                ...g.card,
                borderRadius: 22 * s,
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
                  width: 34 * s,
                  height: 34 * s,
                  borderRadius: '50%',
                  background: `linear-gradient(145deg, ${t.accent}, ${t.accent2})`,
                  boxShadow: `0 6px 18px ${t.accent}55`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <GlyphIcon kind={i} size={16 * s} color={contrastTextOn(t.accent, t.accent2)} />
              </span>
              <span
                style={{
                  fontSize: 12 * s,
                  fontWeight: 800,
                  lineHeight: 1.18,
                  color: t.text,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {body}
              </span>
            </div>
          );
        })}
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
          gridTemplateColumns: second ? '1.18fr 1fr' : '1fr',
          gap: 8 * s,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            ...g.card,
            borderRadius: 20 * s,
            padding: `${11 * s}px ${13 * s}px`,
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: 74 * s,
          }}
        >
          <span
            style={{
              position: 'absolute',
              right: 8 * s,
              top: -4 * s,
              fontFamily: `"${t.font}", system-ui, sans-serif`,
              fontSize: 38 * s,
              fontWeight: 900,
              color: t.accent2,
              opacity: 0.22,
              lineHeight: 1,
            }}
          >
            01
          </span>
          <span
            style={{
              width: 24 * s,
              height: 24 * s,
              borderRadius: 8 * s,
              background: `${t.accent2}28`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <GlyphIcon kind={0} size={13 * s} color={t.accent2} />
          </span>
          <p style={{ margin: 0, marginTop: 6 * s, fontSize: 14 * s, fontWeight: 900, lineHeight: 1.16, color: t.text }}>
            {first}
          </p>
        </div>

        {(second || third) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 * s }}>
            {second && (
              <div
                style={{
                  ...g.card,
                  borderRadius: 16 * s,
                  padding: `${8 * s}px ${11 * s}px`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8 * s,
                  flex: 1,
                }}
              >
                <span style={{ fontSize: 11 * s, fontWeight: 900, color: t.accent2, fontFamily: 'monospace' }}>02</span>
                <span style={{ fontSize: 12 * s, fontWeight: 800, color: t.text, lineHeight: 1.16 }}>{second}</span>
              </div>
            )}
            {third && (
              <div
                style={{
                  ...g.card,
                  borderRadius: 16 * s,
                  padding: `${8 * s}px ${11 * s}px`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8 * s,
                  flex: 1,
                }}
              >
                <span style={{ fontSize: 11 * s, fontWeight: 900, color: t.accent, fontFamily: 'monospace' }}>03</span>
                <span style={{ fontSize: 12 * s, fontWeight: 800, color: t.text, lineHeight: 1.16 }}>{third}</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (mode === 'editorial') {
    return (
      <div
        style={{
          ...g.card,
          borderRadius: 20 * s,
          padding: `${10 * s}px ${13 * s}px`,
          display: 'flex',
          flexDirection: 'column',
          gap: 7 * s,
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
                width: 24 * s,
                height: 24 * s,
                borderRadius: 8 * s,
                background: `linear-gradient(135deg, ${t.accent}, ${t.accent2})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: `0 6px 14px ${t.accent}44`,
              }}
            >
              <GlyphIcon kind={i} size={13 * s} color={contrastTextOn(t.accent, t.accent2)} />
            </span>
            <span
              style={{
                fontSize: 14.5 * s,
                fontWeight: 800,
                letterSpacing: -0.2 * s,
                color: t.text,
                lineHeight: 1.18,
              }}
            >
              {body}
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (mode === 'watermark') {
    const firstWord = (cleanItems[0] || 'CALIDAD').split(/\s+/)[0]?.toUpperCase() || 'CALIDAD';
    return (
      <div style={{ position: 'relative', flexShrink: 0, overflow: 'hidden', padding: `${4 * s}px 0` }}>
        <p
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: align === 'left' ? -4 * s : '50%',
            top: '50%',
            transform: align === 'left' ? 'translateY(-50%)' : 'translate(-50%, -50%)',
            margin: 0,
            fontFamily: `"${t.font}", system-ui, sans-serif`,
            fontSize: 70 * s,
            fontWeight: 900,
            letterSpacing: 4 * s,
            color: t.text,
            opacity: 0.1,
            lineHeight: 0.85,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          {firstWord}
        </p>
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: align === 'left' ? 'flex-start' : 'center',
            gap: 7 * s,
          }}
        >
          {cleanItems.map((body, i) => (
            <span
              key={i}
              style={{
                ...g.card,
                borderRadius: 999,
                padding: `${5.5 * s}px ${11 * s}px`,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6 * s,
                fontSize: 12 * s,
                fontWeight: 800,
                color: t.text,
                letterSpacing: -0.15 * s,
              }}
            >
              <span
                style={{
                  width: 18 * s,
                  height: 18 * s,
                  borderRadius: '50%',
                  background: `linear-gradient(135deg, ${t.accent}, ${t.accent2})`,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <GlyphIcon kind={i} size={10 * s} color={contrastTextOn(t.accent, t.accent2)} />
              </span>
              {body}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (mode === 'callouts') {
    const lineInk = ensureReadableAccent(t.accent2, Boolean(t.light));
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6.5 * s,
          flexShrink: 0,
          alignItems: align === 'left' ? 'stretch' : 'center',
        }}
      >
        {cleanItems.map((body, i) => (
          <div
            key={i}
            style={{
              ...g.card,
              borderRadius: 14 * s,
              borderLeft: `3.5px solid ${lineInk}`,
              padding: `${7 * s}px ${12 * s}px`,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 9 * s,
              maxWidth: '100%',
            }}
          >
            <span
              style={{
                width: 22 * s,
                height: 22 * s,
                borderRadius: 8 * s,
                background: `${lineInk}26`,
                border: `1px solid ${lineInk}55`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <GlyphIcon kind={i} size={12 * s} color={lineInk} />
            </span>
            <span
              style={{
                fontSize: 12.5 * s,
                fontWeight: 800,
                color: t.text,
                letterSpacing: 0.1 * s,
                lineHeight: 1.18,
              }}
            >
              {body}
            </span>
          </div>
        ))}
      </div>
    );
  }

  // 'ribbons': Cintas de cristal translúcidas con icono vectorial
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 * s, justifyContent: align === 'left' ? 'flex-start' : 'center', flexShrink: 0 }}>
      {cleanItems.map((body, i) => (
        <span
          key={i}
          style={{
            ...g.card,
            borderRadius: 14 * s,
            borderLeft: `3px solid ${i % 2 === 0 ? t.accent2 : t.accent}`,
            padding: `${7 * s}px ${12 * s}px`,
            fontSize: 12.5 * s,
            fontWeight: 800,
            color: t.text,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6 * s,
          }}
        >
          <GlyphIcon kind={i} size={12 * s} color={i % 2 === 0 ? t.accent2 : t.accent} />
          {body}
        </span>
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

function CtaButton({
  label,
  s,
  bg = '#10b981',
  accent2,
  color = '#ffffff',
  align = 'center',
}: {
  label: string;
  s: number;
  bg?: string;
  accent2?: string;
  color?: string;
  align?: 'center' | 'left';
}) {
  const clean = cleanPosterCopy(label);
  if (!clean) return null;
  const endColor = accent2 || bg;
  return (
    <div style={{ display: 'flex', justifyContent: align === 'left' ? 'flex-start' : 'center', flexShrink: 0 }}>
      <span
        style={{
          background: `linear-gradient(135deg, ${bg} 0%, ${endColor} 100%)`,
          color,
          borderRadius: 999,
          border: '1px solid rgba(255,255,255,0.28)',
          padding: `${9 * s}px ${20 * s}px`,
          fontSize: 13.5 * s,
          fontWeight: 900,
          letterSpacing: 0.35,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7 * s,
          boxShadow: `0 0 ${22 * s}px ${endColor}55, 0 ${10 * s}px ${24 * s}px -6px rgba(0,0,0,0.48)`,
          whiteSpace: 'nowrap',
        }}
      >
        {clean}
        <ArrowUpRight size={14.5 * s} color={color} strokeWidth={2.8} aria-hidden />
      </span>
    </div>
  );
}

/**
 * 💎 V22.0 · QR DE ALTA JOYERÍA (Canvas estilizado prioritario + respaldo SVG):
 *  - Cyber/Tech (`qrStyle === 'cyber'`): chasis con esquinas cortadas (`clip-path`),
 *    borde luminoso y ojos cuadrados precisos.
 *  - Luxury/Premium (`qrStyle === 'luxury'`): puntos circulares suaves con degradado
 *    oro → negro sobre chasis translúcido `backdrop-blur-md`.
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
  const outerRadius = isCyber ? 0 : (qrStyle === 'sharp' ? 10 : isLuxury ? 20 : 18) * s;
  const innerRadius = isCyber ? 0 : (qrStyle === 'sharp' ? 6 : isLuxury ? 14 : 12) * s;
  const bezelPad = 2 * s;
  // Quiet zone mínimo y elegante (~p-2 en blanco puro) manteniendo 100% lectura en cámara y Lens
  const matrixPad = qrUrl ? Math.max(6, Math.round(8 * s)) : Math.max(8, Math.round(10 * s));
  const svgSize = Math.max(48, Math.round(size - (bezelPad + matrixPad) * 2));
  const isLight = Boolean(t.light);
  const cut = Math.round(12 * s);
  const cyberClip = isCyber
    ? `polygon(${cut}px 0, 100% 0, 100% calc(100% - ${cut}px), calc(100% - ${cut}px) 100%, 0 100%, 0 ${cut}px)`
    : undefined;
  const innerCut = Math.round(8 * s);
  const innerCyberClip = isCyber
    ? `polygon(${innerCut}px 0, 100% 0, 100% calc(100% - ${innerCut}px), calc(100% - ${innerCut}px) 100%, 0 100%, 0 ${innerCut}px)`
    : undefined;

  const bezelBg = isLuxury
    ? 'linear-gradient(145deg, rgba(245,158,11,0.28), rgba(20,17,24,0.42))'
    : isCyber
      ? `linear-gradient(135deg, ${t.accent}55, ${t.accent2}44)`
      : isLight
        ? 'linear-gradient(145deg, rgba(255,255,255,0.92), rgba(226,232,240,0.72))'
        : 'linear-gradient(145deg, rgba(255,255,255,0.22), rgba(255,255,255,0.05))';

  const bezelBorder = isLuxury
    ? '1.5px solid rgba(251,191,36,0.58)'
    : `1.5px solid ${t.accent2}90`;

  const bezelShadow = isLuxury
    ? `0 22px 44px -10px rgba(0,0,0,0.68), 0 0 ${24 * s}px rgba(245,158,11,0.34)`
    : `0 22px 44px -10px rgba(0,0,0,0.58), 0 0 ${22 * s}px ${t.accent2}35`;

  return (
    <div
      style={{
        width: size,
        height: size,
        padding: bezelPad,
        borderRadius: outerRadius,
        clipPath: cyberClip,
        background: bezelBg,
        backdropFilter: 'blur(16px)',
        border: bezelBorder,
        boxShadow: bezelShadow,
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          position: 'relative',
          background: '#ffffff',
          borderRadius: innerRadius,
          clipPath: innerCyberClip,
          padding: matrixPad,
          lineHeight: 0,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
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
              borderRadius: isCyber ? 0 : Math.max(0, innerRadius * 0.72),
            }}
          />
        ) : value ? (
          <QRCodeSVG
            value={value}
            size={svgSize}
            level="M"
            marginSize={2}
            bgColor="#ffffff"
            fgColor={palette.dark}
          />
        ) : null}
      </div>
    </div>
  );
}

/**
 * 💎 V29.0 · DOCK GLASSMORPHISM DE ÉLITE:
 *  - Adaptado dinámicamente al destino del Código QR (`qrMode`), sin líneas divisorias innecesarias.
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
  variant = 'glass',
  brandColors,
  logoUrl,
  qrMode = 'wa',
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
}) {
  const phone = (brand.phoneDisplay || 'Escríbenos').replace(/^[^\p{L}\p{N}+]+/u, '').trim();
  const actionChipText =
    qrMode === 'perfil'
      ? 'Perfil Oficial'
      : qrMode === 'externo'
        ? 'Enlace Oficial'
        : qrMode === 'oferta'
          ? 'Aparta Cupo Hoy'
          : phone || 'WhatsApp Directo';
  const isLight = Boolean(t.light);
  const resolvedLabel = cleanPosterCopy(qrLabel || 'ESCANEA AQUÍ').toUpperCase();

  const dockSurface: CSSProperties = isLight
    ? {
        background: 'linear-gradient(135deg, rgba(255,255,255,0.84), rgba(250,248,242,0.72))',
        backdropFilter: 'blur(20px) saturate(135%)',
        border: '1px solid rgba(15,23,42,0.13)',
        boxShadow: `0 22px 48px -12px rgba(15,23,42,0.18), 0 8px 24px -8px ${t.accent}28`,
      }
    : {
        background: 'linear-gradient(135deg, rgba(9,13,25,0.82), rgba(16,23,42,0.64))',
        backdropFilter: 'blur(22px) saturate(145%)',
        border: '1px solid rgba(255,255,255,0.17)',
        boxShadow: `0 24px 54px -12px rgba(0,0,0,0.72), 0 8px 26px -8px ${t.accent}35`,
      };

  const ink = isLight ? '#0f172a' : '#f8fafc';
  const inkMuted = isLight ? 'rgba(15,23,42,0.72)' : 'rgba(226,232,240,0.78)';
  const eyebrowColor = ensureReadableAccent(isLight ? t.accent : t.accent2, isLight);
  const waBg = isLight ? 'rgba(5,150,105,0.13)' : 'rgba(16,185,129,0.17)';
  const waBorder = isLight ? 'rgba(5,150,105,0.36)' : 'rgba(52,211,153,0.44)';
  const waInk = isLight ? '#065f46' : '#6ee7b7';
  const qrCaptionStyle: CSSProperties = {
    margin: 0,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: 8 * s,
    fontWeight: 800,
    letterSpacing: 2.2 * s,
    textTransform: 'uppercase',
    color: eyebrowColor,
    whiteSpace: 'nowrap',
  };

  // Estilo 2 · Minimalista Suizo / Mármol Serif: tarjeta inferior con QR protagonista (>= 350px reales en exportación)
  if (variant === 'centered' && (qrValue || qrUrl)) {
    const horizontalCompact = s < 0.75;
    if (horizontalCompact) {
      return (
        <div
          style={{
            ...dockSurface,
            borderRadius: 22 * s,
            position: 'relative',
            overflow: 'hidden',
            padding: `${10 * s}px ${14 * s}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14 * s,
            flexShrink: 0,
            fontFamily: `"${bodyFont || 'Inter'}", system-ui, sans-serif`,
          }}
        >
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 * s }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 * s, minWidth: 0 }}>
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt=""
                  style={{
                    width: 24 * s,
                    height: 24 * s,
                    borderRadius: 7 * s,
                    objectFit: 'cover',
                    border: `1px solid ${eyebrowColor}55`,
                    flexShrink: 0,
                  }}
                />
              )}
              <p
                style={{
                  margin: 0,
                  fontFamily: `"${displayFont || t.font}", system-ui, sans-serif`,
                  fontSize: 22 * s,
                  fontWeight: 900,
                  color: ink,
                  lineHeight: 1.0,
                  letterSpacing: -0.3 * s,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {cleanPosterCopy(brand.name || 'Tu Negocio')}
              </p>
            </div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 * s, fontSize: 11.5 * s, fontWeight: 600, color: inkMuted }}>
              <MapPin size={11.5 * s} color={inkMuted} strokeWidth={2.2} style={{ flexShrink: 0 }} aria-hidden />
              {cleanPosterCopy(brand.address || brand.municipality || 'Casco Urbano')}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4.5 * s, fontSize: 12 * s, fontWeight: 900, color: waInk }}>
              {qrMode === 'wa' ? <PhoneIcon size={11.5 * s} color={waInk} /> : <ArrowUpRight size={11.5 * s} color={waInk} strokeWidth={2.5} aria-hidden />}
              {actionChipText}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 * s, flexShrink: 0 }}>
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
            <p style={qrCaptionStyle}>{resolvedLabel}</p>
          </div>
        </div>
      );
    }
    return (
      <div
        style={{
          ...dockSurface,
          borderRadius: 24 * s,
          position: 'relative',
          overflow: 'hidden',
          padding: `${12 * s}px ${16 * s}px`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8 * s,
          flexShrink: 0,
          textAlign: 'center',
          fontFamily: `"${bodyFont || 'Inter'}", system-ui, sans-serif`,
        }}
      >
        <div
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4 * s,
            paddingBottom: 4 * s,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 * s }}>
            {logoUrl && (
              <img
                src={logoUrl}
                alt=""
                style={{
                  width: 24 * s,
                  height: 24 * s,
                  borderRadius: 7 * s,
                  objectFit: 'cover',
                  border: `1px solid ${eyebrowColor}55`,
                }}
              />
            )}
            <p
              style={{
                margin: 0,
                fontFamily: `"${displayFont || t.font}", system-ui, sans-serif`,
                fontSize: 22 * s,
                fontWeight: 900,
                color: ink,
                lineHeight: 1.02,
                letterSpacing: -0.3 * s,
              }}
            >
              {cleanPosterCopy(brand.name || 'Tu Negocio')}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 * s, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 * s, fontSize: 11.5 * s, fontWeight: 600, color: inkMuted }}>
              <MapPin size={11.5 * s} color={inkMuted} strokeWidth={2.2} aria-hidden />
              {cleanPosterCopy(brand.address || brand.municipality || 'Casco Urbano')}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4.5 * s, fontSize: 12 * s, fontWeight: 900, color: waInk }}>
              {qrMode === 'wa' ? <PhoneIcon size={11.5 * s} color={waInk} /> : <ArrowUpRight size={11.5 * s} color={waInk} strokeWidth={2.5} aria-hidden />}
              {actionChipText}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 * s }}>
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
          <p style={qrCaptionStyle}>{resolvedLabel}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        ...dockSurface,
        borderRadius: variant === 'corner' ? `${22 * s}px ${22 * s}px ${28 * s}px ${22 * s}px` : 24 * s,
        borderRight: variant === 'corner' ? `2px solid ${t.accent2}99` : dockSurface.border,
        position: 'relative',
        overflow: 'hidden',
        padding: s < 0.75 ? `${10 * s}px ${14 * s}px` : `${16 * s}px ${20 * s}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: s < 0.75 ? 14 * s : 22 * s,
        flexShrink: 0,
        fontFamily: `"${bodyFont || 'Inter'}", system-ui, sans-serif`,
      }}
    >
      {/* Filete de luz superior */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 22 * s,
          right: 22 * s,
          height: 2 * s,
          background: `linear-gradient(90deg, ${t.accent}, ${t.accent2}, transparent)`,
          opacity: 0.9,
        }}
      />

      {/* Columna izquierda de identidad con respiración generosa y saltos limpios */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7 * s }}>
        <p
          style={{
            margin: 0,
            fontSize: 9.5 * s,
            fontWeight: 800,
            letterSpacing: 2 * s,
            textTransform: 'uppercase',
            color: eyebrowColor,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {cleanPosterCopy(brand.slogan || 'COMERCIO LOCAL').toUpperCase()}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 9 * s, minWidth: 0 }}>
          {logoUrl && (
            <img
              src={logoUrl}
              alt=""
              style={{
                width: 28 * s,
                height: 28 * s,
                borderRadius: 8 * s,
                objectFit: 'cover',
                flexShrink: 0,
                border: `1px solid ${eyebrowColor}55`,
              }}
            />
          )}
          <p
            style={{
              margin: 0,
              fontFamily: `"${displayFont || t.font}", system-ui, sans-serif`,
              fontSize: 26 * s,
              fontWeight: 900,
              color: ink,
              lineHeight: 0.96,
              letterSpacing: -0.35 * s,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {cleanPosterCopy(brand.name || 'Tu Negocio')}
          </p>
        </div>

        {/* Salto de línea limpio para ubicación y contacto */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5.5 * s, paddingTop: 2 * s }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 * s, minWidth: 0 }}>
            <MapPin size={12.5 * s} color={inkMuted} strokeWidth={2.2} style={{ flexShrink: 0 }} aria-hidden />
            <p
              style={{
                margin: 0,
                fontSize: 12 * s,
                fontWeight: 600,
                color: inkMuted,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {cleanPosterCopy(brand.address || brand.municipality || 'Casco Urbano')}
            </p>
          </div>

          <div
            style={{
              alignSelf: 'flex-start',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6.5 * s,
              background: waBg,
              border: `1px solid ${waBorder}`,
              borderRadius: 999,
              padding: `${5.5 * s}px ${12.5 * s}px`,
              maxWidth: '100%',
            }}
          >
            {qrMode === 'wa' ? <PhoneIcon size={12 * s} color={waInk} /> : <ArrowUpRight size={12 * s} color={waInk} strokeWidth={2.5} aria-hidden />}
            <span
              style={{
                fontSize: 13.5 * s,
                fontWeight: 900,
                color: waInk,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: 0.35 * s,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {actionChipText}
            </span>
          </div>
        </div>
      </div>

      {/* QR Orgánico integrado en esquina / lateral */}
      {(qrValue || qrUrl) && (
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 5.5 * s,
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
          <p style={qrCaptionStyle}>{resolvedLabel}</p>
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
    brandPalette,
    logoUrl,
    qrMode = 'wa',
  } = props;

  const hs = headlineScale ?? 1.2;
  const photo2 = photoUrl2 ?? photoUrl;
  const baseTheme = AFFICHE_THEMES.find((x) => x.id === themeId) ?? AFFICHE_THEMES[1];
  const t = buildBrandTheme(baseTheme, brandPalette);
  const brandColors = brandPalette
    ? { primary: brandPalette.primary, accent: brandPalette.accent, secondary: brandPalette.secondary }
    : null;
  const cssBrandVars = {
    '--color-primary': t.accent,
    '--color-accent': t.accent2,
    '--color-secondary': brandPalette?.secondary ?? t.accent2,
  } as CSSProperties;
  const activeTypo = AFFICHE_TYPOS.find((x) => x.id === fontStyle) ?? AFFICHE_TYPOS[0];
  const boardBodyFont = `"${activeTypo.bodyFont}", system-ui, -apple-system, sans-serif`;
  const boardDisplayFont = activeTypo.font || t.font;
  const s = format === 'square' ? 0.58 : 1;
  const isSquare = format === 'square';
  const W = 540;
  const H = isSquare ? 540 : 960;
  const g = glass(t);
  const pad = 18 * s;
  const benefits = texts.benefits.filter(Boolean);
  const priceOverlay = showPrice && brand.promoPrice != null && piece === 0;
  const isService = brand.promoPrice == null;
  const adaptiveCta = resolveAdaptiveCta(qrMode, texts.cta, isService);

  // V29.0 · QR compacto y equilibrado (tamaño ágil para Lens sin inflar el contenedor blanco)
  const dockQrSize = isSquare ? 156 : 196;
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

  // ═══ PIEZA 2 · GANCHO VIRAL EXTREMO (SOLO FOTO + OVERLAY 70% + PREGUNTA + CTA MÍNIMO) ═══
  // Cero lista de beneficios, cero tarjetas, cero QR: foco absoluto en detener el scroll.
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
        {/* Overlay negro estricto al 70% para máximo drama y legibilidad absoluta */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.70)',
          }}
        />

        <div
          style={{
            position: 'relative',
            zIndex: 6,
            width: '100%',
            height: '100%',
            padding: `${26 * s}px ${26 * s}px`,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            textAlign: 'center',
          }}
        >
          {/* Sello discreto de marca arriba */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 * s, opacity: 0.9 }}>
            {logoUrl && (
              <img
                src={logoUrl}
                alt=""
                style={{
                  width: 28 * s,
                  height: 28 * s,
                  borderRadius: 8 * s,
                  objectFit: 'contain',
                  background: 'rgba(255,255,255,0.08)',
                  padding: 2 * s,
                }}
              />
            )}
            <span
              style={{
                fontSize: 11 * s,
                fontWeight: 800,
                letterSpacing: 3 * s,
                textTransform: 'uppercase',
                color: ensureReadableAccent(t.accent2, false),
              }}
            >
              {cleanPosterCopy(brand.name || 'EDICIÓN VIRAL').toUpperCase()}
            </span>
          </div>

          {/* Única pregunta gigante de dolor/gancho centrada */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 * s, maxWidth: '94%' }}>
            <span
              style={{
                width: 52 * s,
                height: 3.5 * s,
                borderRadius: 999,
                background: `linear-gradient(90deg, ${t.accent}, ${t.accent2})`,
              }}
            />
            <p
              style={{
                margin: 0,
                fontFamily: `"${boardDisplayFont}", system-ui, sans-serif`,
                fontSize: (isSquare ? 52 : 60) * s,
                lineHeight: 0.94,
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: -1.4 * s,
                color: '#ffffff',
                textShadow: '0 14px 36px rgba(0,0,0,0.85)',
              }}
            >
              {rawHook}
            </p>
          </div>

          {/* Botón mínimo único abajo */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 999,
              padding: `${9 * s}px ${22 * s}px`,
              background: 'rgba(255,255,255,0.12)',
              border: `1px solid ${ensureReadableAccent(t.accent2, false)}88`,
              backdropFilter: 'blur(10px)',
              color: '#ffffff',
              fontSize: 12 * s,
              fontWeight: 800,
              letterSpacing: 1.4 * s,
              textTransform: 'uppercase',
            }}
          >
            Descubre cómo →
          </div>
        </div>
      </div>
    );
  }

  // ═══ PIEZA 3 · INFOGRAFÍA BENTO GRID GLASSMORPHISM (NUMEROS FONDO 01/02/03 OPACITY-10 + ICONOS MASIVOS) ═══
  if (piece === 2) {
    const neonNumColor = ensureReadableAccent(t.accent2, false);
    const secondaryNeon = ensureReadableAccent(t.accent, false);
    const uiInk = '#f8fafc';
    const uiMuted = '#cbd5e1';
    const glassCard: CSSProperties = {
      background: 'linear-gradient(145deg, rgba(255,255,255,0.085), rgba(255,255,255,0.03))',
      backdropFilter: 'blur(18px) saturate(140%)',
      border: '1px solid rgba(255,255,255,0.14)',
      boxShadow: '0 22px 44px -14px rgba(0,0,0,0.68)',
    };

    const infoItems = [0, 1, 2].map((i) => {
      const b = benefits[i] ?? ['Calidad garantizada de principio a fin', 'Atención directa y sin esperas', 'Ubicación estratégica y despacho ágil'][i];
      const clean = splitBenefit(b).body;
      return {
        num: `0${i + 1}`,
        title: clean,
        hint: [
          `Respaldo directo de ${cleanPosterCopy(brand.name || 'nuestro equipo')} en cada detalle.`,
          `Atención ágil para clientes en ${cleanPosterCopy(brand.municipality || 'el municipio')}.`,
          cleanPosterCopy(texts.sub || 'Beneficio exclusivo disponible hoy.'),
        ][i],
      };
    });

    return (
      <div
        style={{
          ...cssBrandVars,
          width: W,
          height: H,
          flexShrink: 0,
          position: 'relative',
          background: 'linear-gradient(155deg, #060a14 0%, #0f172a 54%, #080d1a 100%)',
          color: uiInk,
          fontFamily: boardBodyFont,
          borderRadius: 24 * s,
          overflow: 'hidden',
        }}
      >
        {/* Capas ambientales sutiles de vidrio esmerilado (sin foto ni fondo blanco plano) */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              `radial-gradient(420px 260px at 88% 8%, ${t.accent}33, transparent 62%),` +
              `radial-gradient(400px 260px at 12% 92%, ${t.accent2}2b, transparent 64%)`,
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            width: '100%',
            height: '100%',
            padding: `${20 * s}px ${22 * s}px`,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 12 * s,
          }}
        >
          {/* Cabecera Bento Glassmorphism (sin cubo de iniciales) */}
          <div
            style={{
              ...glassCard,
              borderRadius: 20 * s,
              padding: `${10 * s}px ${16 * s}px`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12 * s,
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 * s, minWidth: 0 }}>
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt=""
                  style={{
                    width: 36 * s,
                    height: 36 * s,
                    borderRadius: 10 * s,
                    objectFit: 'contain',
                    background: 'rgba(255,255,255,0.08)',
                    padding: 3 * s,
                    flexShrink: 0,
                  }}
                />
              )}
              <div style={{ minWidth: 0 }}>
                <p
                  style={{
                    margin: 0,
                    fontFamily: `"${boardDisplayFont}", system-ui, sans-serif`,
                    fontSize: 19 * s,
                    fontWeight: 900,
                    color: uiInk,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {cleanPosterCopy(brand.name || 'Tu Negocio')}
                </p>
                <p style={{ margin: 0, fontSize: 10 * s, fontWeight: 700, color: uiMuted, letterSpacing: 1 * s, textTransform: 'uppercase' }}>
                  {cleanPosterCopy(brand.slogan || brand.municipality || 'AUTORIDAD LOCAL')}
                </p>
              </div>
            </div>
            <span
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 9.5 * s,
                fontWeight: 900,
                letterSpacing: 1.6 * s,
                color: neonNumColor,
                textTransform: 'uppercase',
                flexShrink: 0,
              }}
            >
              3 CLAVES
            </span>
          </div>

          <p
            style={{
              margin: 0,
              fontFamily: `"${boardDisplayFont}", system-ui, sans-serif`,
              fontSize: (isSquare ? 26 : 34) * s,
              fontWeight: 900,
              lineHeight: 0.98,
              textTransform: 'uppercase',
              letterSpacing: -0.6 * s,
              color: uiInk,
              flexShrink: 0,
            }}
          >
            POR QUÉ ELEGIR <span style={{ color: neonNumColor }}>{cleanPosterCopy(brand.product || brand.name || 'HOY')}</span>
          </p>

          {/* Bento Grid Asimétrico / Columnas Escalonadas: 01 protagonista arriba + 02/03 en columnas abajo */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gridTemplateRows: isSquare ? '1fr 1.08fr' : '1.05fr 1.25fr',
              gap: 10 * s,
            }}
          >
            {infoItems.map((item, idx) => {
              const rowNeon = idx % 2 === 0 ? neonNumColor : secondaryNeon;
              const isHeroTile = idx === 0;
              return (
                <div
                  key={item.num}
                  style={{
                    gridColumn: isHeroTile ? '1 / -1' : undefined,
                    position: 'relative',
                    overflow: 'hidden',
                    ...glassCard,
                    borderTop: isHeroTile ? undefined : `3.5px solid ${rowNeon}`,
                    borderLeft: isHeroTile ? `4.5px solid ${rowNeon}` : undefined,
                    borderRadius: 22 * s,
                    padding: `${(isSquare ? 12 : 16) * s}px ${(isSquare ? 14 : 18) * s}px`,
                    display: 'flex',
                    flexDirection: isHeroTile ? 'row' : 'column',
                    alignItems: isHeroTile ? 'center' : 'flex-start',
                    justifyContent: isHeroTile ? 'flex-start' : 'space-between',
                    gap: (isHeroTile ? 16 : 10) * s,
                    minHeight: 0,
                    marginTop: idx === 2 ? 6 * s : 0,
                    marginBottom: idx === 1 ? 6 * s : 0,
                  }}
                >
                  {/* Número Display gigante en capa de fondo (opacity 0.14) */}
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      right: 10 * s,
                      bottom: isHeroTile ? -14 * s : -10 * s,
                      fontFamily: `"${boardDisplayFont}", system-ui, sans-serif`,
                      fontSize: (isHeroTile ? (isSquare ? 102 : 138) : (isSquare ? 82 : 112)) * s,
                      fontWeight: 900,
                      lineHeight: 0.85,
                      color: '#ffffff',
                      opacity: 0.14,
                      pointerEvents: 'none',
                      userSelect: 'none',
                    }}
                  >
                    {item.num}
                  </span>

                  {/* Icono vectorial grande lucide-react */}
                  <span
                    style={{
                      position: 'relative',
                      zIndex: 2,
                      width: (isHeroTile ? (isSquare ? 54 : 68) : (isSquare ? 44 : 56)) * s,
                      height: (isHeroTile ? (isSquare ? 54 : 68) : (isSquare ? 44 : 56)) * s,
                      borderRadius: 18 * s,
                      background: `linear-gradient(145deg, ${t.accent}, ${t.accent2})`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      boxShadow: `0 12px 28px ${t.accent}55`,
                    }}
                  >
                    <GlyphIcon
                      kind={idx}
                      size={(isHeroTile ? (isSquare ? 30 : 38) : (isSquare ? 24 : 30)) * s}
                      color={contrastTextOn(t.accent, t.accent2)}
                    />
                  </span>

                  <div style={{ position: 'relative', zIndex: 2, flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: 'inline-block',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                        fontSize: 9.5 * s,
                        fontWeight: 900,
                        letterSpacing: 1.8 * s,
                        color: rowNeon,
                        marginBottom: 3 * s,
                      }}
                    >
                      CLAVE {item.num}
                    </span>
                    <p
                      style={{
                        margin: 0,
                        fontSize: (isHeroTile ? (isSquare ? 17 : 20) : (isSquare ? 14 : 16.5)) * s,
                        fontWeight: 900,
                        lineHeight: 1.12,
                        color: uiInk,
                      }}
                    >
                      {item.title}
                    </p>
                    <p
                      style={{
                        margin: 0,
                        marginTop: 5 * s,
                        fontSize: (isSquare ? 10.5 : 12.5) * s,
                        fontWeight: 600,
                        lineHeight: 1.25,
                        color: uiMuted,
                        display: '-webkit-box',
                        WebkitLineClamp: isHeroTile ? 2 : 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {item.hint}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderTop: '1px solid rgba(255,255,255,0.12)',
              paddingTop: 10 * s,
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 11 * s, fontWeight: 700, color: uiMuted }}>
              {cleanPosterCopy(brand.address || brand.municipality || 'Gachetá')}
            </span>
            <span style={{ fontSize: 12 * s, fontWeight: 900, color: neonNumColor, fontVariantNumeric: 'tabular-nums' }}>
              {brand.phoneDisplay || brand.name}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ═══ PIEZA 4 · CIERRE DE CONVERSIÓN (LOGO MASIVO + QR MASIVO >= 400PX + CTA DIRECTO · CERO TEXTOS LARGOS) ═══
  if (piece === 3) {
    // QR masivo siempre >= 400x400px reales en exportación tanto en 1:1 como en 9:16
    const qrMasivo = isSquare ? 228 : Math.round(H * 0.48);
    const accentInk = ensureReadableAccent(t.accent2, Boolean(t.light));
    const waFormatted = (brand.phoneDisplay || 'WhatsApp Directo').replace(/^[^\p{L}\p{N}+]+/u, '').trim();

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
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              `radial-gradient(460px 320px at 50% 50%, ${t.accent2}24, transparent 70%)`,
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            width: '100%',
            height: '100%',
            padding: `${(isSquare ? 14 : 22) * s}px ${22 * s}px`,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Logo masivo centrado arriba o tipografía pura monumental (sin cubo de iniciales) */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 * s, flexShrink: 0 }}>
            {logoUrl && (
              <div
                style={{
                  width: (isSquare ? 68 : 108) * s,
                  height: (isSquare ? 68 : 108) * s,
                  borderRadius: 24 * s,
                  padding: 6 * s,
                  background: t.light ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(14px)',
                  border: `1.5px solid ${t.accent2}66`,
                  boxShadow: '0 16px 34px rgba(0,0,0,0.42)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <img src={logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 18 * s }} />
              </div>
            )}
            <p
              style={{
                margin: 0,
                fontFamily: `"${boardDisplayFont}", system-ui, sans-serif`,
                fontSize: logoUrl ? (isSquare ? 18 : 24) * s : (isSquare ? 34 : 42) * s,
                fontWeight: 900,
                color: logoUrl ? t.text : accentInk,
                letterSpacing: -0.5 * s,
                lineHeight: 0.98,
                textAlign: 'center',
                textTransform: logoUrl ? 'none' : 'uppercase',
              }}
            >
              {cleanPosterCopy(brand.name || 'Tu Negocio')}
            </p>
          </div>

          {/* Tarjeta flotante con QR masivo */}
          {(qrValue || qrUrl) && (
            <div
              style={{
                ...g.card,
                borderRadius: 28 * s,
                padding: `${(isSquare ? 12 : 16) * s}px`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 32px 72px -12px rgba(0,0,0,0.72), 0 0 46px ${t.accent}35`,
                flexShrink: 0,
              }}
            >
              <QrOrganicToken
                qrValue={qrValue}
                qrUrl={qrUrl}
                size={qrMasivo}
                t={t}
                s={s}
                businessName={brand.name || 'Impulso'}
                qrStyle={qrStyle}
                brandColors={brandColors}
              />
            </div>
          )}

          {/* Llamado final directo (ESCANEA AHORA + WhatsApp, CERO textos largos) */}
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 * s, flexShrink: 0 }}>
            <p
              style={{
                margin: 0,
                fontFamily: `"${boardDisplayFont}", system-ui, sans-serif`,
                fontSize: (isSquare ? 26 : 32) * s,
                fontWeight: 900,
                letterSpacing: 1 * s,
                textTransform: 'uppercase',
                color: t.text,
                lineHeight: 1,
              }}
            >
              ESCANEA AHORA
            </p>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8 * s,
                borderRadius: 999,
                padding: `${7 * s}px ${18 * s}px`,
                background: t.light ? 'rgba(5,150,105,0.12)' : 'rgba(16,185,129,0.18)',
                border: `1.5px solid ${t.light ? 'rgba(5,150,105,0.35)' : 'rgba(52,211,153,0.45)'}`,
              }}
            >
              <PhoneIcon size={15 * s} color={t.light ? '#065f46' : '#6ee7b7'} />
              <span
                style={{
                  fontSize: (isSquare ? 16 : 19) * s,
                  fontWeight: 900,
                  color: t.light ? '#065f46' : '#6ee7b7',
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: 0.6 * s,
                }}
              >
                {waFormatted}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══ PIEZA 1 · AFICHE MAESTRO (V29.0 · 3 ARQUETIPOS LÍQUIDOS: OSCURO, LUMINOSO Y SPLIT COLOR) ═══
  const darkPhotoTheme: AfficheTheme = {
    ...t,
    light: false,
    text: '#ffffff',
    sub: 'rgba(255,255,255,0.88)',
    accent: ensureReadableAccent(t.accent, false),
    accent2: ensureReadableAccent(t.accent2, false),
  };
  const lightPhotoTheme: AfficheTheme = {
    ...t,
    light: true,
    text: '#0b0f18',
    sub: 'rgba(15,23,42,0.82)',
    accent: ensureReadableAccent(t.accent, true),
    accent2: ensureReadableAccent(t.accent2, true),
  };

  const renderFullBleedHero = ({
    mode,
    align = 'left',
    benefitMode,
    headlineSize,
    watermarkText,
    showMunicipalityTag = false,
  }: {
    mode: 'dark' | 'light';
    align?: 'left' | 'center';
    benefitMode: ResolvedBenefitMode;
    headlineSize: number;
    watermarkText?: string;
    showMunicipalityTag?: boolean;
  }): ReactElement => {
    const heroTheme = mode === 'light' ? lightPhotoTheme : darkPhotoTheme;
    const creamDeep = mixHex('#fdfbf7', t.accent, 0.05);
    const creamMid = mixHex('#f7f2e7', t.accent2, 0.07);
    const gradientOverlay =
      mode === 'light'
        ? `linear-gradient(to bottom, rgba(255,253,249,0.52) 0%, transparent 22%), linear-gradient(to top, ${creamDeep} 0%, ${creamMid}f2 40%, ${creamMid}a8 62%, transparent 86%)`
        : 'linear-gradient(to bottom, rgba(0,0,0,0.42) 0%, transparent 22%), linear-gradient(to top, rgba(0,0,0,0.96) 0%, rgba(0,0,0,0.82) 38%, rgba(0,0,0,0.48) 62%, transparent 86%)';

    const topRight = priceOverlay ? (
      <PricePill brand={brand} t={heroTheme} s={s} />
    ) : showMunicipalityTag ? (
      <span
        style={{
          fontSize: 10 * s,
          fontWeight: 800,
          letterSpacing: 1.8,
          color: mode === 'light' ? 'rgba(15,23,42,0.72)' : 'rgba(255,255,255,0.88)',
          textTransform: 'uppercase',
          textShadow: mode === 'light' ? 'none' : '0 2px 10px rgba(0,0,0,0.85)',
        }}
      >
        {(brand.municipality || 'Gachetá').toUpperCase()}
      </span>
    ) : null;

    return (
      <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: mode === 'light' ? creamDeep : '#020617' }}>
        <div style={{ position: 'absolute', inset: 0 }}>
          <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
        </div>
        <div style={{ position: 'absolute', inset: 0, background: gradientOverlay }} />
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
              fontSize: 110 * s,
              fontWeight: 900,
              letterSpacing: -3 * s,
              lineHeight: 0.85,
              color: mode === 'light' ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)',
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
            zIndex: 5,
            width: '100%',
            height: '100%',
            padding: pad,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: isSquare ? 5 * s : 8 * s,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0,
              paddingRight: logoUrl ? 52 * s : 0,
            }}
          >
            <Badge text={badge} t={heroTheme} s={s} align="left" />
            {topRight}
          </div>
          <div style={{ flex: 1, minHeight: isSquare ? 8 * s : 90 * s }} />
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: isSquare ? 5 * s : 7 * s }}>
            <Headline
              texts={texts}
              t={heroTheme}
              s={s}
              size={headlineSize}
              align={align}
              styleId={fontStyle}
              scale={hs}
              fullWidth
              longShadow={mode === 'dark'}
            />
            <SubHead
              text={texts.sub}
              t={heroTheme}
              s={s}
              align={align}
              color={mode === 'light' ? 'rgba(15,23,42,0.84)' : 'rgba(255,255,255,0.92)'}
            />
            {showBenefits && benefits.length > 0 && (
              <BenefitsShowcase
                items={benefits}
                t={heroTheme}
                s={s}
                mode={benefitStyle === 'auto' ? benefitMode : resolvedBenefitMode}
                align={align}
              />
            )}
            {adaptiveCta && (
              <CtaButton
                label={adaptiveCta}
                s={s}
                bg={t.accent}
                accent2={t.accent2}
                color={contrastTextOn(t.accent, t.accent2)}
                align={align}
              />
            )}
            {showQr && (
              <Dock
                brand={brand}
                t={heroTheme}
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
              />
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderSplitScreenHero = ({
    align = 'left',
    benefitMode,
    headlineSize,
  }: {
    align?: 'left' | 'center';
    benefitMode: ResolvedBenefitMode;
    headlineSize: number;
  }): ReactElement => {
    const solidBg = mixHex(t.accent, '#080d19', 0.56);
    const solidDeep = mixHex(t.accent2, '#04070e', 0.72);
    const splitIsLight = relativeLuminance(solidBg) > 0.36;
    const splitTheme: AfficheTheme = {
      ...t,
      light: splitIsLight,
      text: splitIsLight ? '#0b0f18' : '#ffffff',
      sub: splitIsLight ? 'rgba(15,23,42,0.82)' : 'rgba(241,245,249,0.88)',
      accent: ensureReadableAccent(t.accent, splitIsLight),
      accent2: ensureReadableAccent(t.accent2, splitIsLight),
    };

    return (
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: `radial-gradient(360px 220px at 88% 14%, ${t.accent2}2b, transparent 65%), linear-gradient(175deg, ${solidBg} 0%, ${solidDeep} 100%)`,
        }}
      >
        {/* Mitad superior: fotografía edge-to-edge con fundido atmosférico hacia el color extraído */}
        <div
          style={{
            position: 'relative',
            height: isSquare ? '39%' : '45%',
            width: '100%',
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(to bottom, rgba(0,0,0,0.32) 0%, transparent 28%, transparent 56%, ${solidBg} 100%)`,
            }}
          />
          <div
            style={{
              position: 'relative',
              zIndex: 4,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: pad,
              paddingRight: logoUrl ? pad + 52 * s : pad,
            }}
          >
            <Badge text={badge} t={darkPhotoTheme} s={s} align="left" />
            {priceOverlay && <PricePill brand={brand} t={darkPhotoTheme} s={s} />}
          </div>
        </div>

        {/* Mitad inferior: bloque sólido armonioso tintado con el color dominante de la imagen */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            marginTop: -2 * s,
            padding: `0 ${pad}px ${pad}px`,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: isSquare ? 4 * s : 7 * s,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: isSquare ? 4 * s : 7 * s }}>
            <Headline
              texts={texts}
              t={splitTheme}
              s={s}
              size={isSquare ? headlineSize - 4 : headlineSize}
              align={align}
              styleId={fontStyle}
              scale={hs}
              fullWidth
              longShadow={!splitIsLight}
            />
            <SubHead text={texts.sub} t={splitTheme} s={s} align={align} />
            {showBenefits && benefits.length > 0 && (
              <BenefitsShowcase
                items={benefits}
                t={splitTheme}
                s={s}
                mode={benefitStyle === 'auto' ? benefitMode : resolvedBenefitMode}
                align={align}
              />
            )}
            {adaptiveCta && (
              <CtaButton
                label={adaptiveCta}
                s={s}
                bg={t.accent}
                accent2={t.accent2}
                color={contrastTextOn(t.accent, t.accent2)}
                align={align}
              />
            )}
          </div>
          {showQr && (
            <Dock
              brand={brand}
              t={splitTheme}
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
            />
          )}
        </div>
      </div>
    );
  };

  const blendWord = (cleanPosterCopy(brand.product || brand.name || 'IMPULSO').split(/\s+/)[0] || 'OFERTA').toUpperCase();
  let body: ReactElement;
  switch (layout) {
    case 'swiss':
    case 'zen':
    case 'vip':
    case 'arc':
    case 'clinic':
    case 'resort':
    case 'eco':
    case 'agro':
    case 'float':
    case 'polaroid': {
      body = renderFullBleedHero({
        mode: 'light',
        align: layout === 'swiss' || layout === 'zen' ? 'left' : 'center',
        benefitMode: layout === 'vip' || layout === 'arc' ? 'editorial' : 'callouts',
        headlineSize: isSquare ? 36 : 46,
        showMunicipalityTag: true,
      });
      break;
    }

    case 'split':
    case 'diagonal':
    case 'diagx':
    case 'collage':
    case 'cyber':
    case 'bento3d':
    case 'brutal':
    case 'retail':
    case 'diamond':
    case 'flash':
    case 'hud':
    case 'menu':
    case 'rustic': {
      body = renderSplitScreenHero({
        align: layout === 'retail' || layout === 'diamond' || layout === 'flash' || layout === 'menu' ? 'center' : 'left',
        benefitMode: layout === 'diagonal' || layout === 'cyber' ? 'ribbons' : 'callouts',
        headlineSize: isSquare ? 36 : 44,
      });
      break;
    }

    case 'immersive':
    case 'cinema':
    case 'bleed': {
      body = renderFullBleedHero({
        mode: t.light ? 'light' : 'dark',
        align: 'left',
        benefitMode: 'callouts',
        headlineSize: isSquare ? 38 : 48,
        watermarkText: layout === 'immersive' ? blendWord : undefined,
      });
      break;
    }

    case 'magazine':
    default: {
      body = renderFullBleedHero({
        mode: t.light ? 'light' : 'dark',
        align: layout === 'portal' || layout === 'orbits' ? 'center' : 'left',
        benefitMode: layout === 'magazine' ? 'editorial' : 'bento',
        headlineSize: isSquare ? 38 : 48,
        showMunicipalityTag: layout === 'bento',
      });
      break;
    }
  }

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
        {/* Logo en esquina estratégica del Póster Maestro (nunca inventa caja vacía si no hay logoUrl) */}
        {logoUrl && (
          <div
            style={{
              position: 'absolute',
              top: pad,
              right: pad,
              zIndex: 12,
              padding: 4 * s,
              borderRadius: 12 * s,
              background: 'rgba(8,12,24,0.62)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.22)',
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
