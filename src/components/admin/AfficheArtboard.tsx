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
  const deepTop = mixHex(palette.primary, '#070b14', 0.72);
  const deepBottom = mixHex(palette.secondary, '#04070e', 0.86);
  const darkSub = mixHex(palette.secondary, '#e2e8f0', 0.72);
  return {
    ...base,
    light: false,
    text: '#f8fafc',
    sub: darkSub,
    accent: ensureReadableAccent(palette.primary, false),
    accent2: ensureReadableAccent(palette.accent, false),
    bg:
      `radial-gradient(360px 220px at 84% 8%, ${palette.accent}42, transparent 62%),` +
      `radial-gradient(380px 240px at 8% 90%, ${palette.primary}38, transparent 62%),` +
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

function ScenicBg({ url, t, frame = false }: { url: string | null; t: AfficheTheme; frame?: boolean }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 'inherit' }}>
      {url ? (
        <div
          style={{
            position: 'absolute',
            inset: -48,
            backgroundImage: `url(${url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: t.light
              ? 'blur(34px) brightness(1.06) saturate(1.12)'
              : 'blur(32px) brightness(0.38) saturate(1.38)',
            transform: 'scale(1.2)',
          }}
        />
      ) : null}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: t.light
            ? 'linear-gradient(180deg, rgba(250,248,242,0.68), rgba(250,248,242,0.46))'
            : 'linear-gradient(165deg, rgba(6,8,14,0.42) 0%, rgba(6,8,14,0.22) 44%, rgba(6,8,14,0.68) 100%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            `radial-gradient(360px 220px at 84% 8%, ${t.accent}3c, transparent 65%),` +
            `radial-gradient(400px 260px at 8% 92%, ${t.accent2}2e, transparent 65%),` +
            'linear-gradient(118deg, rgba(255,255,255,0.08) 0%, transparent 28%, transparent 66%, rgba(255,255,255,0.06) 100%)',
        }}
      />
      {frame && (
        <>
          <div style={{ position: 'absolute', inset: 14, border: '1px solid rgba(255,255,255,0.22)', borderRadius: 18, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', inset: 22, border: '1px solid rgba(255,255,255,0.09)', borderRadius: 14, pointerEvents: 'none' }} />
        </>
      )}
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
    ? `0 ${5 * s}px ${14 * s}px rgba(0,0,0,0.85), 0 0 ${18 * s}px ${readableAccent2}44`
    : isLight && !color && eff !== 'neon'
      ? '0 2px 10px rgba(255,255,255,0.45)'
      : '0 4px 12px rgba(0,0,0,0.78)';

  const base: CSSProperties = {
    margin: 0,
    position: 'relative',
    zIndex: 10,
    fontFamily: `"${typo.font || t.font}", system-ui, sans-serif`,
    fontSize: Number(computedSize.toFixed(1)),
    lineHeight: eff === 'caja' ? 1.08 : 0.96,
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: -1.1 * s,
    color: baseInk,
    textShadow: shadowColor,
  };

  const highlight = (): ReactElement => {
    const hl = cleanPosterCopy(texts.highlight);
    if (!hl) return <></>;
    // Color sólido puro de rotulador + tinta sólida contrastante (cero bg-clip-text, gradientes o superposiciones)
    const markerBg = ensureReadableAccent(t.accent2, false);
    const cajaInk = contrastTextOn(markerBg);

    switch (eff) {
      case 'caja':
        return (
          <span
            style={{
              backgroundColor: markerBg,
              color: cajaInk,
              padding: `${2 * s}px ${9 * s}px`,
              borderRadius: 6 * s,
              display: 'inline-block',
              lineHeight: 1.04,
              marginTop: 3 * s,
              fontWeight: 900,
              textShadow: 'none',
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
            }}
          >
            {hl}
          </span>
        );
      default:
        // Color sólido puro + sombra de texto simple 100% compatible con html-to-image
        return (
          <span
            style={{
              color: readableAccent2,
              textShadow: isLight
                ? '0 2px 8px rgba(15,23,42,0.18)'
                : `0 4px 12px rgba(0,0,0,0.82)`,
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
    const ruleColor = t.light ? 'rgba(15,23,42,0.16)' : 'rgba(255,255,255,0.16)';
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6 * s,
          textAlign: align,
          flexShrink: 0,
        }}
      >
        {cleanItems.map((body, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: align === 'left' ? 'flex-start' : 'center',
              gap: 9 * s,
              borderBottom: i < cleanItems.length - 1 ? `1px solid ${ruleColor}` : 'none',
              paddingBottom: i < cleanItems.length - 1 ? 5 * s : 0,
            }}
          >
            <span
              style={{
                fontFamily: `"${t.font}", system-ui, sans-serif`,
                fontSize: 13 * s,
                fontWeight: 900,
                color: t.accent2,
                letterSpacing: 1,
                flexShrink: 0,
              }}
            >
              0{i + 1}/
            </span>
            <span
              style={{
                fontSize: 16.5 * s,
                fontWeight: 900,
                letterSpacing: -0.3 * s,
                color: t.text,
                lineHeight: 1.16,
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
            fontSize: 74 * s,
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
            gap: `${6 * s}px ${16 * s}px`,
          }}
        >
          {cleanItems.map((body, i) => (
            <span
              key={i}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6 * s,
                fontSize: 13.5 * s,
                fontWeight: 900,
                color: t.text,
                letterSpacing: -0.2 * s,
              }}
            >
              <span style={{ width: 12 * s, height: 1.5 * s, background: ensureReadableAccent(t.accent2, Boolean(t.light)), flexShrink: 0 }} />
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
          gap: 6 * s,
          flexShrink: 0,
          alignItems: align === 'left' ? 'flex-start' : 'center',
        }}
      >
        {cleanItems.map((body, i) => (
          <div
            key={i}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8 * s,
              maxWidth: '100%',
            }}
          >
            <span
              style={{
                width: 6 * s,
                height: 6 * s,
                borderRadius: '50%',
                background: lineInk,
                boxShadow: `0 0 10px ${lineInk}88`,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                width: (22 + i * 10) * s,
                height: '1px',
                background: lineInk,
                opacity: 0.85,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 13 * s,
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

  // 'ribbons': Cintas escalonadas con acento diagonal
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 * s, justifyContent: align === 'left' ? 'flex-start' : 'center', flexShrink: 0 }}>
      {cleanItems.map((body, i) => (
        <span
          key={i}
          style={{
            ...g.card,
            borderRadius: 14 * s,
            borderLeft: `3px solid ${i % 2 === 0 ? t.accent2 : t.accent}`,
            padding: `${7.5 * s}px ${13 * s}px`,
            fontSize: 13 * s,
            fontWeight: 800,
            color: t.text,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6 * s,
          }}
        >
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

function CtaButton({ label, s, bg = '#10b981', color = '#ffffff' }: { label: string; s: number; bg?: string; color?: string }) {
  const clean = cleanPosterCopy(label);
  if (!clean) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
      <span
        style={{
          background: bg,
          color,
          borderRadius: 999,
          padding: `${9.5 * s}px ${22 * s}px`,
          fontSize: 14.5 * s,
          fontWeight: 900,
          letterSpacing: 0.4,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7 * s,
          boxShadow: `0 12px 28px -6px ${bg}77`,
          whiteSpace: 'nowrap',
        }}
      >
        {clean}
        <ArrowUpRight size={15 * s} color={color} strokeWidth={2.8} aria-hidden />
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
  // Quiet zone sólido blanco mínimo equivalente a ~4 módulos: styledQr ya dibuja 4 módulos
  // blancos dentro del PNG; el padding CSS refuerza un borde blanco puro inalterable.
  const matrixPad = qrUrl ? Math.max(4, Math.round(size * 0.025)) : Math.max(10, Math.round(size * 0.075));
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
            marginSize={4}
            bgColor="#ffffff"
            fgColor={palette.dark}
          />
        ) : null}
      </div>
    </div>
  );
}

/**
 * 💎 V22.0 · DOCK GLASSMORPHISM DE ÉLITE:
 *  - Soporta 3 geometrías coordinadas (`glass`, `corner`, `centered`),
 *    variables de marca (`brandPalette`) e insignia discreta de `logoUrl`.
 *  - Etiqueta QR refinada en monospace `tracking-widest` diminuta y elegante.
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
}) {
  const phone = (brand.phoneDisplay || 'Escríbenos').replace(/^[^\p{L}\p{N}+]+/u, '').trim();
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
              <PhoneIcon size={11.5 * s} color={waInk} />
              {phone || 'WhatsApp Directo'}
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
            borderBottom: `1px solid ${isLight ? 'rgba(15,23,42,0.1)' : 'rgba(255,255,255,0.12)'}`,
            paddingBottom: 8 * s,
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
            <span style={{ color: eyebrowColor, fontWeight: 900 }}>·</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4.5 * s, fontSize: 12 * s, fontWeight: 900, color: waInk }}>
              <PhoneIcon size={11.5 * s} color={waInk} />
              {phone || 'WhatsApp Directo'}
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
            <PhoneIcon size={12 * s} color={waInk} />
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
              {phone || 'WhatsApp Directo'}
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
    photoUrl3,
    brandPalette,
    logoUrl,
  } = props;

  const hs = headlineScale ?? 1.2;
  const photo2 = photoUrl2 ?? photoUrl;
  const photo3 = photoUrl3 ?? photoUrl;
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
  const priceLabel = texts.cta.trim();
  const isService = brand.promoPrice == null;

  const PHOTO_MAX = (isSquare ? 158 : 315) * s;
  const dockQrSize = isSquare ? 202 : 210;
  const resolvedBenefitMode: ResolvedBenefitMode =
    benefitStyle === 'auto' ? (LAYOUT_BENEFIT_MAP[layout] ?? 'bento') : benefitStyle;
  const resolvedDockVariant: Exclude<DockVariant, 'auto'> =
    dockVariant !== 'auto'
      ? dockVariant
      : layout === 'swiss' || layout === 'zen' || layout === 'vip' || layout === 'arc'
        ? 'centered'
        : layout === 'diagx' || layout === 'split' || layout === 'hud' || layout === 'bento3d' || layout === 'diagonal' || layout === 'cyber' || layout === 'collage'
          ? 'corner'
          : 'glass';

  const photoBlock = (extra?: CSSProperties): ReactElement => (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        maxHeight: PHOTO_MAX,
        position: 'relative',
        borderRadius: 26 * s,
        boxShadow: `0 24px 52px -12px rgba(0,0,0,0.55), 0 10px 28px -8px ${t.accent}35`,
        overflow: 'hidden',
        ...extra,
      }}
    >
      <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
      {priceOverlay && (
        <div style={{ position: 'absolute', bottom: 14 * s, right: 14 * s }}>
          <PricePill brand={brand} t={t} s={s} />
        </div>
      )}
    </div>
  );

  const contentBlocks = (
    align: 'center' | 'left' = 'center',
    forceMode?: ResolvedBenefitMode,
  ): ReactElement => (
    <>
      <SubHead text={texts.sub} t={t} s={s} align={align} />
      {showBenefits && benefits.length > 0 && (
        <BenefitsShowcase
          items={benefits}
          t={t}
          s={s}
          mode={forceMode ?? resolvedBenefitMode}
          align={align}
        />
      )}
      {isService && priceLabel ? (
        <CtaButton label={priceLabel} s={s} bg={t.accent2} color={contrastTextOn(t.accent2)} />
      ) : null}
    </>
  );

  const masterDock = showQr ? (
    <Dock
      brand={brand}
      t={t}
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
    />
  ) : null;

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

  // ═══ PIEZA 1 · AFICHE MAESTRO (28 ARQUITECTURAS SIN MOLDES REPETITIVOS) ═══
  let body: ReactElement;
  switch (layout) {
    case 'magazine': {
      // Editorial Full-Bleed: foto al 100% con degradado orgánico profundo abajo (from-slate-900 to-transparent) sin tapar el sujeto principal
      body = (
        <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 24 * s, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0 }}>
            <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
          </div>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(to top, #0f172a 0%, rgba(15,23,42,0.92) 34%, rgba(15,23,42,0.52) 56%, rgba(15,23,42,0.12) 78%, transparent 100%)',
            }}
          />
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
              gap: 8 * s,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <Badge text={badge} t={t} s={s} align="left" />
              {priceOverlay && <PricePill brand={brand} t={t} s={s} />}
            </div>
            <div style={{ flex: 1, minHeight: isSquare ? 8 * s : 110 * s }} />
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 7 * s }}>
              <Headline texts={texts} t={{ ...t, light: false, text: '#ffffff' }} s={s} size={isSquare ? 38 : 48} align="left" styleId={fontStyle} scale={hs} fullWidth />
              <SubHead text={texts.sub} t={t} s={s} align="left" color="rgba(255,255,255,0.9)" />
              {showBenefits && benefits.length > 0 && (
                <BenefitsShowcase items={benefits} t={{ ...t, light: false, text: '#ffffff' }} s={s} mode={benefitStyle === 'auto' ? 'editorial' : resolvedBenefitMode} align="left" />
              )}
              {isService && priceLabel && <CtaButton label={priceLabel} s={s} bg={t.accent2} color={contrastTextOn(t.accent2)} />}
              {showQr && (
                <Dock
                  brand={brand}
                  t={{ ...t, light: false, text: '#ffffff', sub: 'rgba(255,255,255,0.78)' }}
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
                />
              )}
            </div>
          </div>
        </div>
      );
      break;
    }

    case 'diagonal': {
      // Corte Diagonal Fraccionado Flexbox: banda fotográfica superior separada estrictamente de titular + QR
      body = (
        <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 8 * s }}>
          <div style={{ position: 'relative', marginLeft: -pad, marginRight: -pad, marginTop: -pad, height: isSquare ? 104 : 258, flexShrink: 0, overflow: 'visible' }}>
            <div
              style={{
                width: '100%',
                height: '100%',
                clipPath: 'polygon(0 0, 100% 0, 100% 82%, 0 100%)',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(15,23,42,0.34), transparent 38%, rgba(15,23,42,0.52) 100%)' }} />
            </div>
            <div style={{ position: 'absolute', top: pad, left: pad, right: pad, display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 3 }}>
              <Badge text={badge} t={t} s={s} align="left" />
            </div>
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 5 * s,
                background: `linear-gradient(90deg, ${t.accent}, ${t.accent2})`,
                transform: 'rotate(-2.4deg)',
                boxShadow: `0 8px 24px ${t.accent}77`,
                zIndex: 3,
              }}
            />
            {priceOverlay && (
              <div style={{ position: 'absolute', bottom: 14 * s, right: pad, transform: 'rotate(2.5deg)', zIndex: 5 }}>
                <PricePill brand={brand} t={t} s={s} />
              </div>
            )}
          </div>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 6 * s, zIndex: 4 }}>
            <Headline texts={texts} t={t} s={s} size={isSquare ? 36 : 44} align="left" styleId={fontStyle} scale={hs} />
            {contentBlocks('left')}
            {masterDock}
          </div>
        </div>
      );
      break;
    }

    case 'polaroid': {
      // Polaroid 3D Out-of-Bounds: foto inclinada sobresaliendo + sello de precio flotante
      const fw = (isSquare ? 210 : 340) * s;
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10 * s, height: '100%' }}>
          <Badge text={badge} t={t} s={s} />
          <div style={{ display: 'flex', justifyContent: 'center', position: 'relative', overflow: 'visible' }}>
            <div
              style={{
                width: fw,
                transform: 'rotate(-3deg)',
                background: '#fcfbf7',
                borderRadius: 18 * s,
                padding: 10 * s,
                boxShadow: `0 26px 52px -10px rgba(0,0,0,0.52), 0 10px 26px ${t.accent}35`,
                display: 'flex',
                flexDirection: 'column',
                gap: 7 * s,
              }}
            >
              <div style={{ height: (isSquare ? 130 : 230) * s, borderRadius: 12 * s, overflow: 'hidden' }}>
                <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
              </div>
              <p style={{ margin: 0, fontSize: 12 * s, fontWeight: 800, color: '#1e293b', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {(texts.sub.trim() || brand.product).slice(0, 44)}
              </p>
            </div>
            {priceOverlay && (
              <div style={{ position: 'absolute', bottom: -10 * s, right: 16 * s, transform: 'rotate(5deg)', zIndex: 4 }}>
                <PricePill brand={brand} t={t} s={s} />
              </div>
            )}
          </div>
          <Headline texts={texts} t={t} s={s} size={46} align="center" styleId={fontStyle} scale={hs} />
          {showBenefits && benefits.length > 0 && (
            <BenefitsShowcase items={benefits} t={t} s={s} mode={benefitStyle === 'auto' ? 'badges' : resolvedBenefitMode} />
          )}
          {masterDock}
        </div>
      );
      break;
    }

    case 'arc': {
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10 * s, height: '100%' }}>
          <Badge text={badge} t={t} s={s} />
          <div
            style={{
              flex: 1,
              minHeight: 0,
              maxHeight: PHOTO_MAX,
              position: 'relative',
              borderRadius: `270px 270px ${26 * s}px ${26 * s}px`,
              border: `2.5px solid ${t.accent2}cc`,
              boxShadow: `0 0 0 6px ${t.light ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.08)'}, 0 24px 50px -10px rgba(0,0,0,0.52)`,
              overflow: 'hidden',
            }}
          >
            <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
            {priceOverlay && (
              <div style={{ position: 'absolute', bottom: 14 * s, right: 14 * s }}>
                <PricePill brand={brand} t={t} s={s} />
              </div>
            )}
          </div>
          <Headline texts={texts} t={t} s={s} size={48} align="center" styleId={fontStyle} scale={hs} />
          {contentBlocks('center')}
          {masterDock}
        </div>
      );
      break;
    }

    case 'portal': {
      const d = (isSquare ? 156 : 250) * s;
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10 * s, height: '100%' }}>
          <Badge text={badge} t={t} s={s} />
          <div style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: d + 54 * s, height: d + 54 * s, borderRadius: '50%', border: `1px solid ${t.accent2}44` }} />
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: d + 28 * s, height: d + 28 * s, borderRadius: '50%', border: `1.5px dashed ${t.accent}77` }} />
            <div style={{ position: 'relative', width: d + 16 * s, height: d + 16 * s }}>
              <div style={{ position: 'absolute', inset: 4 * s, borderRadius: '50%', overflow: 'hidden', border: `3px solid ${t.accent2}`, boxShadow: `0 0 36px ${t.accent}55` }}>
                <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
              </div>
              {priceOverlay && (
                <div style={{ position: 'absolute', bottom: -8 * s, right: -12 * s, transform: 'rotate(-4deg)' }}>
                  <PricePill brand={brand} t={t} s={s} />
                </div>
              )}
            </div>
          </div>
          <Headline texts={texts} t={t} s={s} size={46} align="center" styleId={fontStyle} scale={hs} />
          {contentBlocks('center')}
          {masterDock}
        </div>
      );
      break;
    }

    case 'swiss': {
      const line = t.light ? 'rgba(15,23,42,0.18)' : 'rgba(255,255,255,0.20)';
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10 * s, height: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${line}`, paddingBottom: 8 * s }}>
            <Badge text={badge} t={t} s={s} align="left" />
            <span style={{ fontFamily: `"${t.font}", system-ui, sans-serif`, fontSize: 18 * s, fontWeight: 900, color: t.accent2 }}>01 / HOY</span>
          </div>
          {photoBlock({ borderRadius: 16 * s, border: `1px solid ${line}` })}
          <Headline texts={texts} t={t} s={s} size={46} align="left" styleId={fontStyle} scale={hs} fullWidth />
          {contentBlocks('left')}
          {masterDock}
        </div>
      );
      break;
    }

    case 'split': {
      body = (
        <div style={{ display: 'flex', gap: 12 * s, height: '100%' }}>
          <div
            style={{
              width: 58 * s,
              borderRadius: 22 * s,
              flexShrink: 0,
              background: `linear-gradient(180deg, ${t.accent}, ${t.accent2})`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: `${16 * s}px 0`,
              boxShadow: `0 16px 36px ${t.accent}44`,
            }}
          >
            <span style={{ fontFamily: `"${t.font}", system-ui, sans-serif`, fontSize: 26 * s, fontWeight: 900, color: contrastTextOn(t.accent, t.accent2), transform: 'rotate(90deg)', whiteSpace: 'nowrap', letterSpacing: 2 }}>
              {(brand.municipality || 'GACHETÁ').toUpperCase()}
            </span>
            <span style={{ fontFamily: `"${t.font}", system-ui, sans-serif`, fontSize: 18 * s, fontWeight: 900, color: contrastTextOn(t.accent, t.accent2) }}>01</span>
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10 * s }}>
            <Badge text={badge} t={t} s={s} align="left" />
            {photoBlock()}
            <Headline texts={texts} t={t} s={s} size={44} align="left" styleId={fontStyle} scale={hs} fullWidth />
            {contentBlocks('left')}
            {masterDock}
          </div>
        </div>
      );
      break;
    }

    case 'brutal': {
      const hard: CSSProperties = {
        border: `2.5px solid ${t.light ? '#111827' : '#ffffff'}`,
        boxShadow: `6px 6px 0 ${t.light ? '#111827' : t.accent2}`,
        borderRadius: 20 * s,
      };
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10 * s, height: '100%' }}>
          <div style={{ ...hard, background: t.accent2, alignSelf: 'flex-start', padding: `${7 * s}px ${16 * s}px`, transform: 'rotate(-1.5deg)' }}>
            <span style={{ fontFamily: `"${t.font}", system-ui, sans-serif`, fontSize: 12 * s, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1, color: contrastTextOn(t.accent2) }}>
              {badge.trim() || 'SELECCIÓN HOY'}
            </span>
          </div>
          <div style={{ ...hard, flex: 1, minHeight: 0, maxHeight: PHOTO_MAX, overflow: 'hidden', position: 'relative' }}>
            <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
            {priceOverlay && (
              <div style={{ position: 'absolute', bottom: 10 * s, right: 10 * s }}>
                <PricePill brand={brand} t={t} s={s} />
              </div>
            )}
          </div>
          <Headline texts={texts} t={t} s={s} size={46} align="left" styleId={fontStyle} scale={hs} fullWidth />
          {contentBlocks('left')}
          {masterDock}
        </div>
      );
      break;
    }

    case 'vip': {
      const orn = t.accent2;
      body = (
        <div style={{ height: '100%', border: `1.5px solid ${orn}88`, borderRadius: 24 * s, padding: 8 * s, boxSizing: 'border-box' }}>
          <div style={{ height: '100%', border: `1px solid ${orn}44`, borderRadius: 18 * s, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10 * s, padding: 12 * s, boxSizing: 'border-box' }}>
            <Badge text={badge} t={t} s={s} />
            {photoBlock({ borderRadius: 20 * s })}
            <Headline texts={texts} t={t} s={s} size={46} align="center" styleId={fontStyle} scale={hs} />
            {contentBlocks('center')}
            {masterDock}
          </div>
        </div>
      );
      break;
    }

    case 'cyber': {
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10 * s, height: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10 * s, fontWeight: 800, letterSpacing: 2, color: t.accent }}>
              {(brand.municipality || 'GACHETÁ').toUpperCase()} · EN VIVO
            </span>
            <Badge text={badge} t={t} s={s} />
          </div>
          {photoBlock({ border: `1px solid ${t.accent2}66` })}
          <div style={{ ...g.card, borderRadius: 22 * s, borderLeft: `4px solid ${t.accent2}`, padding: `${11 * s}px ${15 * s}px` }}>
            <Headline texts={texts} t={t} s={s} size={44} align="left" styleId={fontStyle} scale={hs} fullWidth />
          </div>
          {contentBlocks('left')}
          {masterDock}
        </div>
      );
      break;
    }

    case 'rustic': {
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10 * s, height: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <span style={{ border: `1.5px dashed ${t.accent2}`, borderRadius: 999, padding: `${6 * s}px ${16 * s}px`, fontSize: 11 * s, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: t.text }}>
              {badge.trim() || 'TRADICIÓN Y CALIDAD LOCAL'}
            </span>
          </div>
          {photoBlock({ border: `4px solid ${t.light ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.14)'}` })}
          <Headline texts={texts} t={t} s={s} size={46} align="center" styleId={fontStyle} scale={hs} />
          {contentBlocks('center')}
          {masterDock}
        </div>
      );
      break;
    }

    case 'retail': {
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10 * s, height: '100%', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 18 * s, right: -46 * s, width: 220 * s, transform: 'rotate(28deg)', background: t.accent2, color: contrastTextOn(t.accent2), textAlign: 'center', padding: `${7 * s}px 0`, fontSize: 11.5 * s, fontWeight: 900, letterSpacing: 2, textTransform: 'uppercase', boxShadow: '0 10px 24px rgba(0,0,0,0.4)', zIndex: 4 }}>
            {badge.trim() || 'OFERTA HOY'}
          </div>
          {photoBlock()}
          <Headline texts={texts} t={t} s={s} size={48} align="center" styleId={fontStyle} scale={hs} />
          {contentBlocks('center')}
          {masterDock}
        </div>
      );
      break;
    }

    case 'eco': {
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10 * s, height: '100%', position: 'relative' }}>
          <div style={{ position: 'absolute', top: -40 * s, left: -50 * s, width: 220 * s, height: 220 * s, borderRadius: '50% 50% 46% 54% / 55% 48% 52% 45%', background: `${t.accent2}26` }} />
          <Badge text={badge} t={t} s={s} />
          {photoBlock({ borderRadius: '44% 44% 26px 26px / 18% 18% 26px 26px' })}
          <Headline texts={texts} t={t} s={s} size={46} align="center" styleId={fontStyle} scale={hs} />
          {contentBlocks('center')}
          {masterDock}
        </div>
      );
      break;
    }

    case 'cinema': {
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10 * s, height: '100%' }}>
          <Badge text={badge} t={t} s={s} />
          <div style={{ flex: 1, minHeight: 0, maxHeight: PHOTO_MAX, position: 'relative', borderRadius: 22 * s, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 48px rgba(0,0,0,0.55)' }}>
            <div style={{ height: 26 * s, background: '#050507' }} />
            <div style={{ flex: 1, minHeight: 0 }}>
              <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
            </div>
            <div style={{ height: 26 * s, background: '#050507', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 8.5 * s, fontWeight: 800, letterSpacing: 3, color: 'rgba(255,255,255,0.68)' }}>
                {(brand.municipality || 'GACHETÁ').toUpperCase()} · ESTRENO HOY
              </span>
            </div>
            {priceOverlay && (
              <div style={{ position: 'absolute', bottom: 36 * s, right: 14 * s }}>
                <PricePill brand={brand} t={t} s={s} />
              </div>
            )}
          </div>
          <Headline texts={texts} t={t} s={s} size={46} align="center" styleId={fontStyle} scale={hs} />
          {contentBlocks('center')}
          {masterDock}
        </div>
      );
      break;
    }

    case 'float': {
      // Escena inclinada 3D arriba + bloque tipográfico nítido debajo (cero choques sobre la foto)
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10 * s, height: '100%', position: 'relative' }}>
          <Badge text={badge} t={t} s={s} />
          <div style={{ position: 'relative', height: (isSquare ? 158 : 285) * s, flexShrink: 0, overflow: 'visible', padding: `0 ${14 * s}px` }}>
            <div style={{ position: 'absolute', top: 6 * s, left: '8%', right: '8%', bottom: 6 * s, borderRadius: 26 * s, background: `linear-gradient(135deg, ${t.accent}55, ${t.accent2}55)`, transform: 'rotate(-2.4deg)' }} />
            <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 24 * s, transform: 'rotate(1.6deg)', overflow: 'hidden', boxShadow: `0 24px 48px -10px rgba(0,0,0,0.6), 0 8px 24px ${t.accent}40` }}>
              <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
              {priceOverlay && (
                <div style={{ position: 'absolute', bottom: 10 * s, right: 10 * s, transform: 'rotate(-1.6deg)' }}>
                  <PricePill brand={brand} t={t} s={s} />
                </div>
              )}
            </div>
          </div>
          <Headline texts={texts} t={t} s={s} size={44} align="center" styleId={fontStyle} scale={hs} fullWidth />
          {contentBlocks('center')}
          {masterDock}
        </div>
      );
      break;
    }

    case 'hud': {
      const corner = (pos: CSSProperties): ReactElement => (
        <div style={{ position: 'absolute', width: 38 * s, height: 38 * s, borderColor: t.accent2, borderStyle: 'solid', borderWidth: 0, ...pos }} />
      );
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10 * s, height: '100%', position: 'relative' }}>
          {corner({ top: 4 * s, left: 4 * s, borderTopWidth: 2.5 * s, borderLeftWidth: 2.5 * s, borderTopLeftRadius: 12 * s })}
          {corner({ top: 4 * s, right: 4 * s, borderTopWidth: 2.5 * s, borderRightWidth: 2.5 * s, borderTopRightRadius: 12 * s })}
          <Badge text={badge} t={t} s={s} />
          {photoBlock({ margin: `0 ${10 * s}px` })}
          <Headline texts={texts} t={t} s={s} size={46} align="center" styleId={fontStyle} scale={hs} />
          {contentBlocks('center')}
          {masterDock}
        </div>
      );
      break;
    }

    case 'resort': {
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10 * s, height: '100%' }}>
          <Badge text={badge} t={t} s={s} />
          {photoBlock({ borderRadius: 28 * s })}
          <Headline texts={texts} t={t} s={s} size={48} align="center" styleId={fontStyle} scale={hs} />
          {contentBlocks('center')}
          {masterDock}
        </div>
      );
      break;
    }

    case 'menu': {
      const d = (isSquare ? 164 : 275) * s;
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10 * s, height: '100%', alignItems: 'center', position: 'relative' }}>
          <Badge text={badge} t={t} s={s} />
          <div style={{ position: 'relative', width: d, height: d, flexShrink: 0, borderRadius: '50%', padding: 6 * s, background: `linear-gradient(155deg, ${t.accent}, ${t.accent2})`, boxShadow: `0 22px 48px rgba(0,0,0,0.52), 0 0 32px ${t.accent2}55` }}>
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden' }}>
              <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
            </div>
            {priceOverlay && (
              <div style={{ position: 'absolute', bottom: 4 * s, right: -24 * s, transform: 'rotate(5deg)' }}>
                <PricePill brand={brand} t={t} s={s} />
              </div>
            )}
          </div>
          <Headline texts={texts} t={t} s={s} size={46} align="center" styleId={fontStyle} scale={hs} />
          {contentBlocks('center')}
          <div style={{ width: '100%' }}>{masterDock}</div>
        </div>
      );
      break;
    }

    case 'clinic': {
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10 * s, height: '100%' }}>
          <Badge text={badge} t={t} s={s} />
          {photoBlock({ border: '2px solid rgba(255,255,255,0.6)' })}
          <Headline texts={texts} t={t} s={s} size={46} align="center" styleId={fontStyle} scale={hs} />
          {contentBlocks('center')}
          {masterDock}
        </div>
      );
      break;
    }

    case 'agro': {
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10 * s, height: '100%' }}>
          <div style={{ background: `repeating-linear-gradient(45deg, #facc15 0 ${16 * s}px, #0f172a ${16 * s}px ${32 * s}px)`, color: '#ffffff', borderRadius: 18 * s, padding: `${9 * s}px ${14 * s}px`, display: 'flex', alignItems: 'center', gap: 10 * s, boxShadow: '0 12px 26px rgba(0,0,0,0.45)' }}>
            <span style={{ background: '#059669', borderRadius: 999, padding: `${4 * s}px ${10 * s}px`, fontSize: 11 * s, fontWeight: 900, whiteSpace: 'nowrap' }}>SELECCIÓN</span>
            <span style={{ fontSize: 13 * s, fontWeight: 900, letterSpacing: 1, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {badge || 'RENDIMIENTO GARANTIZADO'}
            </span>
          </div>
          {photoBlock()}
          <Headline texts={texts} t={t} s={s} size={48} align="center" styleId={fontStyle} scale={hs} />
          {contentBlocks('center')}
          {masterDock}
        </div>
      );
      break;
    }

    case 'diamond': {
      const sz = (isSquare ? 176 : 290) * s;
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10 * s, height: '100%', alignItems: 'center' }}>
          <Badge text={badge} t={t} s={s} />
          <div style={{ position: 'relative', width: sz, height: sz, flexShrink: 0 }}>
            <div style={{ width: '100%', height: '100%', clipPath: 'polygon(50% 0%, 100% 26%, 100% 74%, 50% 100%, 0% 74%, 0% 26%)', background: `linear-gradient(160deg, ${t.accent}, ${t.accent2})`, padding: 4 * s }}>
              <div style={{ width: '100%', height: '100%', clipPath: 'polygon(50% 0%, 100% 26%, 100% 74%, 50% 100%, 0% 74%, 0% 26%)', overflow: 'hidden' }}>
                <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
              </div>
            </div>
            {priceOverlay && (
              <div style={{ position: 'absolute', bottom: 4 * s, right: -16 * s }}>
                <PricePill brand={brand} t={t} s={s} />
              </div>
            )}
          </div>
          <Headline texts={texts} t={t} s={s} size={44} align="center" styleId={fontStyle} scale={hs} />
          {contentBlocks('center')}
          <div style={{ width: '100%' }}>{masterDock}</div>
        </div>
      );
      break;
    }

    case 'flash': {
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10 * s, height: '100%' }}>
          <div style={{ transform: 'rotate(-1.8deg)', background: `linear-gradient(90deg, ${t.accent}, ${t.accent2})`, color: contrastTextOn(t.accent, t.accent2), borderRadius: 16 * s, padding: `${9 * s}px ${18 * s}px`, alignSelf: 'center', fontSize: 16 * s, fontWeight: 900, letterSpacing: 1.4, textTransform: 'uppercase', boxShadow: `0 14px 32px ${t.accent}66`, whiteSpace: 'nowrap' }}>
            {badge || 'OPORTUNIDAD RELÁMPAGO'}
          </div>
          {photoBlock()}
          <Headline texts={texts} t={t} s={s} size={48} align="center" styleId={fontStyle} scale={hs} />
          {contentBlocks('center')}
          {masterDock}
        </div>
      );
      break;
    }

    case 'bento3d': {
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10 * s, height: '100%' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.48fr 1fr', gap: 10 * s, height: (isSquare ? 185 : 320) * s, flexShrink: 0 }}>
            <div style={{ position: 'relative', borderRadius: 24 * s, overflow: 'hidden', boxShadow: `0 22px 46px rgba(0,0,0,0.5), 0 0 0 1.5px ${t.accent2}66` }}>
              <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
              {priceOverlay && (
                <div style={{ position: 'absolute', bottom: 10 * s, left: 10 * s }}>
                  <PricePill brand={brand} t={t} s={s} />
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 * s }}>
              {[0, 1].map((idx) => (
                <div key={idx} style={{ flex: 1, ...g.card, borderRadius: 20 * s, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 * s, padding: 10 * s }}>
                  <GlyphIcon kind={idx} size={22 * s} color={t.accent2} />
                  <span style={{ fontSize: 12 * s, fontWeight: 800, color: t.text, textAlign: 'center', lineHeight: 1.2 }}>
                    {splitBenefit(benefits[idx] ?? 'Calidad garantizada').body}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <Badge text={badge} t={t} s={s} />
          <Headline texts={texts} t={t} s={s} size={46} align="center" styleId={fontStyle} scale={hs} />
          <SubHead text={texts.sub} t={t} s={s} align="center" />
          {masterDock}
        </div>
      );
      break;
    }

    case 'diagx': {
      // Split Diagonal Fraccionado: margen estricto tras el corte geométrico sin colisión sobre la foto
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 8 * s, height: '100%', position: 'relative' }}>
          <div style={{ position: 'relative', height: (isSquare ? 166 : 310) * s, flexShrink: 0, overflow: 'visible' }}>
            <div
              style={{
                position: 'absolute',
                top: -pad,
                left: -pad,
                right: -pad,
                bottom: 0,
                clipPath: 'polygon(0 0, 100% 0, 100% 72%, 0 100%)',
                overflow: 'hidden',
              }}
            >
              <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
              {priceOverlay && (
                <div style={{ position: 'absolute', bottom: 24 * s, right: 18 * s }}>
                  <PricePill brand={brand} t={t} s={s} />
                </div>
              )}
            </div>
          </div>
          <div style={{ marginTop: 6 * s, position: 'relative', zIndex: 4, display: 'flex', flexDirection: 'column', gap: 8 * s }}>
            <Badge text={badge} t={t} s={s} align="left" />
            <Headline texts={texts} t={t} s={s} size={46} align="left" styleId={fontStyle} scale={hs} fullWidth />
            {contentBlocks('left')}
          </div>
          {masterDock}
        </div>
      );
      break;
    }

    case 'orbits': {
      // Círculos Intersectados con escenario superior acotado (cero superposición sobre texto)
      const bigC = (isSquare ? 156 : 290) * s;
      const smallC = (isSquare ? 104 : 184) * s;
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 8 * s, height: '100%', position: 'relative' }}>
          <div style={{ position: 'relative', height: (isSquare ? 162 : 302) * s, flexShrink: 0 }}>
            <div style={{ position: 'absolute', top: 0, left: 0, zIndex: 4 }}>
              <Badge text={badge} t={t} s={s} align="left" />
            </div>
            <div style={{ position: 'absolute', top: 4 * s, right: 4 * s, width: bigC, height: bigC, borderRadius: '50%', overflow: 'hidden', border: `${4 * s}px solid ${t.accent2}88`, boxShadow: `0 22px 48px rgba(0,0,0,0.55)` }}>
              <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
            </div>
            <div style={{ position: 'absolute', bottom: 6 * s, left: 4 * s, width: smallC, height: smallC, borderRadius: '50%', background: `linear-gradient(155deg, ${t.accent}, ${t.accent2})`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: `0 18px 40px ${t.accent}66`, zIndex: 3, padding: 8 * s, boxSizing: 'border-box', textAlign: 'center' }}>
              <span style={{ fontFamily: `"${boardDisplayFont}", system-ui, sans-serif`, fontSize: (isSquare ? 26 : 42) * s, fontWeight: 900, color: contrastTextOn(t.accent, t.accent2), lineHeight: 1 }}>
                {showPrice && brand.promoPrice != null ? money(brand.promoPrice) : 'HOY'}
              </span>
              {showPrice && brand.normalPrice != null && brand.promoPrice != null && (
                <span style={{ fontSize: 11 * s, color: contrastTextOn(t.accent, t.accent2), opacity: 0.78, textDecoration: 'line-through', fontWeight: 800 }}>
                  {money(brand.normalPrice)}
                </span>
              )}
            </div>
          </div>
          <div style={{ position: 'relative', zIndex: 4, display: 'flex', flexDirection: 'column', gap: 8 * s }}>
            <Headline texts={texts} t={t} s={s} size={44} align="left" styleId={fontStyle} scale={hs} fullWidth />
            {contentBlocks('left')}
          </div>
          {masterDock}
        </div>
      );
      break;
    }

    case 'bleed': {
      // Tipografía Sangrada Monumental
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', gap: 10 * s }}>
          <div style={{ flexShrink: 0, margin: `0 ${-24 * s}px`, marginTop: -4 * s }}>
            <div style={{ width: '112%', marginLeft: '-6%' }}>
              <Headline texts={texts} t={t} s={s} size={60} align="left" styleId={fontStyle} scale={hs} fullWidth />
            </div>
          </div>
          <div style={{ display: 'flex', flex: 1, minHeight: 0, gap: 12 * s }}>
            <div style={{ flex: 1.55, borderRadius: 24 * s, overflow: 'hidden', position: 'relative', boxShadow: '0 22px 46px rgba(0,0,0,0.5)' }}>
              <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
              {priceOverlay && (
                <div style={{ position: 'absolute', bottom: 10 * s, left: 10 * s }}>
                  <PricePill brand={brand} t={t} s={s} />
                </div>
              )}
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 * s, justifyContent: 'center' }}>
              <Badge text={badge} t={t} s={s} align="left" />
              {showBenefits && benefits.length > 0 && (
                <BenefitsShowcase items={benefits} t={t} s={s} mode="editorial" align="left" />
              )}
            </div>
          </div>
          {masterDock}
        </div>
      );
      break;
    }

    case 'zen': {
      const line = t.light ? 'rgba(15,23,42,0.16)' : 'rgba(255,255,255,0.18)';
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10 * s, height: '100%' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.65fr 1fr', gridTemplateRows: '1fr 1fr', gap: 10 * s, height: (isSquare ? 195 : 350) * s, flexShrink: 0 }}>
            <div style={{ gridRow: 'span 2', border: `1px solid ${line}`, borderRadius: 18 * s, overflow: 'hidden' }}>
              <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
            </div>
            <div style={{ border: `1px solid ${line}`, borderRadius: 18 * s, padding: 12 * s, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <p style={{ margin: 0, fontSize: 9.5 * s, fontWeight: 800, letterSpacing: 2.5, textTransform: 'uppercase', color: t.accent2 }}>
                {badge || 'HOY'}
              </p>
              {showPrice && brand.promoPrice != null ? (
                <span style={{ fontFamily: `"${t.font}", system-ui, sans-serif`, fontSize: 24 * s, fontWeight: 900, color: t.text, lineHeight: 1 }}>
                  {money(brand.promoPrice)}
                </span>
              ) : (
                <p style={{ margin: 0, fontSize: 13 * s, fontWeight: 800, color: t.text, lineHeight: 1.25 }}>
                  {splitBenefit(benefits[0] ?? 'Calidad garantizada').body}
                </p>
              )}
            </div>
            <div style={{ border: `1px solid ${line}`, borderRadius: 18 * s, padding: 12 * s, display: 'flex', flexDirection: 'column', gap: 6 * s, justifyContent: 'center' }}>
              {benefits.slice(0, 2).map((b, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 * s }}>
                  <GlyphIcon kind={i + 1} size={13 * s} color={t.accent2} />
                  <span style={{ fontSize: 11 * s, fontWeight: 700, color: t.text, lineHeight: 1.2 }}>{splitBenefit(b).body}</span>
                </div>
              ))}
            </div>
          </div>
          <Headline texts={texts} t={t} s={s} size={46} align="left" styleId={fontStyle} scale={hs} fullWidth />
          {masterDock}
        </div>
      );
      break;
    }

    case 'immersive': {
      // V25 · Tipografía Inmersiva sin mixBlendMode: degradado orgánico inferior Slate-900 a transparente
      const blendWord = (cleanPosterCopy(brand.product || brand.name || 'IMPULSO').split(/\s+/)[0] || 'OFERTA').toUpperCase();
      body = (
        <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 24 * s, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0 }}>
            <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
          </div>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(to top, #0f172a 0%, rgba(15,23,42,0.92) 34%, rgba(15,23,42,0.52) 56%, rgba(15,23,42,0.14) 78%, transparent 100%)',
            }}
          />
          {/* Eco tipográfico translúcido seguro en exportación sin mixBlendMode */}
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
            {blendWord}
          </p>
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
              gap: 8 * s,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <Badge text={badge} t={t} s={s} align="left" />
              {priceOverlay && <PricePill brand={brand} t={t} s={s} />}
            </div>
            <div style={{ flex: 1, minHeight: isSquare ? 8 * s : 110 * s }} />
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 7 * s }}>
              <Headline texts={texts} t={{ ...t, light: false, text: '#ffffff' }} s={s} size={isSquare ? 38 : 50} align="left" styleId={fontStyle} scale={hs} fullWidth longShadow />
              <SubHead text={texts.sub} t={t} s={s} align="left" color="rgba(255,255,255,0.9)" />
              {showBenefits && benefits.length > 0 && (
                <BenefitsShowcase
                  items={benefits}
                  t={{ ...t, light: false, text: '#ffffff' }}
                  s={s}
                  mode={benefitStyle === 'auto' ? 'callouts' : resolvedBenefitMode}
                  align="left"
                />
              )}
              {isService && priceLabel && <CtaButton label={priceLabel} s={s} bg={t.accent2} color={contrastTextOn(t.accent2)} />}
              {showQr && (
                <Dock
                  brand={brand}
                  t={{ ...t, light: false, text: '#ffffff', sub: 'rgba(255,255,255,0.78)' }}
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
                />
              )}
            </div>
          </div>
        </div>
      );
      break;
    }

    case 'collage': {
      // V22 · Collage Asimétrico: múltiples recuadros superpuestos + texto vertical lateral
      const verticalTag = cleanPosterCopy(brand.municipality || brand.name || 'IMPULSO').toUpperCase();
      body = (
        <div style={{ display: 'flex', height: '100%', gap: 8 * s, position: 'relative' }}>
          {/* Eje tipográfico vertical lateral */}
          <div
            style={{
              width: 34 * s,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: `${6 * s}px 0`,
            }}
          >
            <span style={{ width: 6 * s, height: 6 * s, borderRadius: '50%', background: t.accent2 }} />
            <p
              style={{
                margin: 0,
                writingMode: 'vertical-rl',
                transform: 'rotate(180deg)',
                fontFamily: `"${boardDisplayFont}", system-ui, sans-serif`,
                fontSize: 30 * s,
                fontWeight: 900,
                letterSpacing: 3 * s,
                color: t.text,
                opacity: 0.34,
                whiteSpace: 'nowrap',
              }}
            >
              {verticalTag}
            </p>
            <span style={{ width: 1.5 * s, height: 48 * s, background: `linear-gradient(180deg, ${t.accent2}, transparent)` }} />
          </div>

          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 9 * s }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Badge text={badge} t={t} s={s} align="left" />
            </div>

            {/* Escenario collage multi-foto asimétrico */}
            <div style={{ position: 'relative', height: (isSquare ? 168 : 300) * s, flexShrink: 0, overflow: 'visible' }}>
              {/* Foto principal */}
              <div
                style={{
                  position: 'absolute',
                  top: 6 * s,
                  right: 4 * s,
                  width: '72%',
                  height: '86%',
                  borderRadius: 20 * s,
                  transform: 'rotate(1.8deg)',
                  overflow: 'hidden',
                  boxShadow: `0 22px 46px rgba(0,0,0,0.52), 0 0 0 1.5px ${t.accent2}66`,
                }}
              >
                <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
              </div>
              {/* Foto secundaria arriba izquierda */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '44%',
                  height: '52%',
                  borderRadius: 16 * s,
                  transform: 'rotate(-4deg)',
                  overflow: 'hidden',
                  border: `2.5px solid ${t.accent2}`,
                  boxShadow: '0 18px 34px rgba(0,0,0,0.55)',
                  zIndex: 2,
                }}
              >
                <Photo url={photo2} zoom={1.08} posY={0.45} />
              </div>
              {/* Foto detalle inferior izquierda */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: '14%',
                  width: '36%',
                  height: '42%',
                  borderRadius: 14 * s,
                  transform: 'rotate(-2deg)',
                  overflow: 'hidden',
                  border: '2px solid rgba(255,255,255,0.6)',
                  boxShadow: '0 16px 32px rgba(0,0,0,0.5)',
                  zIndex: 3,
                }}
              >
                <Photo url={photo3} zoom={1.12} posY={0.5} />
              </div>
              {priceOverlay && (
                <div style={{ position: 'absolute', bottom: -6 * s, right: 6 * s, zIndex: 5 }}>
                  <PricePill brand={brand} t={t} s={s} />
                </div>
              )}
            </div>

            <Headline texts={texts} t={t} s={s} size={44} align="left" styleId={fontStyle} scale={hs} fullWidth />
            {showBenefits && benefits.length > 0 && (
              <BenefitsShowcase
                items={benefits}
                t={t}
                s={s}
                mode={benefitStyle === 'auto' ? 'watermark' : resolvedBenefitMode}
                align="left"
              />
            )}
            {masterDock}
          </div>
        </div>
      );
      break;
    }

    default: {
      // 'bento' (Agencia Pro): composición asimétrica limpia con sombra tintada y dock glassmorphic
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10 * s, height: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Badge text={badge} t={t} s={s} align="left" />
            <span style={{ fontSize: 10 * s, fontWeight: 800, letterSpacing: 1.8, color: t.sub, textTransform: 'uppercase' }}>
              {(brand.municipality || 'Gachetá').toUpperCase()}
            </span>
          </div>
          {photoBlock()}
          <Headline texts={texts} t={t} s={s} size={48} align="left" styleId={fontStyle} scale={hs} />
          {contentBlocks('left')}
          {masterDock}
        </div>
      );
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
      <ScenicBg url={photoUrl} t={t} />
      <div style={{ position: 'relative', width: '100%', height: '100%', padding: pad, boxSizing: 'border-box' }}>
        {body}
        {/* Logo en esquina estratégica del Póster Maestro (respetando cintas o sellos según layout) */}
        {logoUrl && (
          <div
            style={{
              position: 'absolute',
              top: pad,
              ...(layout === 'retail' || layout === 'magazine' || layout === 'immersive' || layout === 'hud'
                ? { left: layout === 'magazine' || layout === 'immersive' ? undefined : pad, right: layout === 'magazine' || layout === 'immersive' ? pad : undefined }
                : { right: pad }),
              zIndex: 12,
              padding: 4 * s,
              borderRadius: 12 * s,
              background: t.light ? 'rgba(255,255,255,0.72)' : 'rgba(8,12,24,0.52)',
              backdropFilter: 'blur(12px)',
              border: `1px solid ${t.light ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.2)'}`,
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
