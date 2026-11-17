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

export type AfficheFormat = 'story' | 'square';
export type AfficheLayout =
  | 'bento' | 'magazine' | 'diagonal' | 'polaroid' | 'arc' | 'portal' | 'swiss'
  | 'split' | 'brutal' | 'vip' | 'cyber' | 'rustic' | 'retail' | 'eco' | 'cinema' | 'float'
  | 'hud' | 'resort' | 'menu' | 'clinic' | 'agro' | 'diamond' | 'flash' | 'bento3d'
  | 'diagx' | 'orbits' | 'bleed' | 'zen';
export type AffichePiece = 0 | 1 | 2 | 3;
export type BenefitPresentation = 'auto' | 'badges' | 'bento' | 'editorial' | 'ribbons';

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
  effect: 'gradiente' | 'caja' | 'neon' | 'subrayado' | 'sticker' | 'barra';
  /** Multiplicador óptico para fuentes display condensadas (Bebas / Anton). */
  opticalBoost: number;
}

export const AFFICHE_TYPOS: AfficheTypo[] = [
  { id: 'impacto', label: '01 · Impacto Display', hint: 'Bebas/Anton condensada', font: 'Anton', effect: 'gradiente', opticalBoost: 1.14 },
  { id: 'moderna', label: '02 · Agencia Moderna', hint: 'Space Grotesk geométrica', font: 'Space Grotesk', effect: 'gradiente', opticalBoost: 1.04 },
  { id: 'revista', label: '03 · Revista Editorial', hint: 'Playfair Display lujo', font: 'Playfair Display', effect: 'gradiente', opticalBoost: 1.02 },
  { id: 'marcador', label: '04 · Marcador Resaltado', hint: 'Archivo Black bloque', font: 'Archivo Black', effect: 'caja', opticalBoost: 0.98 },
  { id: 'neon', label: '05 · Bebas Monumental', hint: 'Bebas Neue 90% ancho', font: 'Bebas Neue', effect: 'neon', opticalBoost: 1.24 },
  { id: 'gruesa', label: '06 · Montserrat Black', hint: 'Ultra-gruesa comercial', font: 'Montserrat', effect: 'subrayado', opticalBoost: 1.0 },
  { id: 'suiza', label: '07 · Suiza Arquitectónica', hint: 'Filete lateral editorial', font: 'Archivo Black', effect: 'barra', opticalBoost: 1.0 },
  { id: 'pop', label: '08 · Pop Sticker Urbano', hint: 'Trazo + sombra sólida', font: 'Archivo Black', effect: 'sticker', opticalBoost: 0.98 },
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
  photoZoom: number;
  photoPosY: number;
  qrLabel?: string;
  qrHint?: string;
  fontStyle?: string;
  headlineScale?: number;
  benefitStyle?: BenefitPresentation;
  photoUrl2?: string | null;
  photoUrl3?: string | null;
  photoUrl4?: string | null;
}

const money = (v: number): string => `$${v.toLocaleString('es-CO')}`;

function ht(plain: string, highlight: string): AfficheTexts {
  return { plain, highlight, sub: '', benefits: [], cta: '', hook: '' };
}

function splitBenefit(b: string): { icon: string; body: string } {
  const m = /^\p{Extended_Pictographic}[\uFE0F\u200D]?/u.exec(b.trim());
  const icon = m ? m[0] : '';
  const raw = m ? b.trim().slice(icon.length).trim() : b.trim();
  const body = raw.replace(/\p{Extended_Pictographic}[\uFE0F\u200D]?/gu, '').replace(/\s{2,}/g, ' ').trim();
  return { icon, body };
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
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: color,
    strokeWidth: 2.3,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  if (k === 0) {
    return (
      <svg {...common} aria-hidden>
        <path d="M2.5 12.5l5 5L19 6" />
      </svg>
    );
  }
  if (k === 1) {
    return (
      <svg {...common} aria-hidden>
        <path d="M13 2L4.5 13.5H11L10 22l8.5-11.5H12L13 2z" />
      </svg>
    );
  }
  if (k === 2) {
    return (
      <svg {...common} aria-hidden>
        <path d="M12 21s7-5.5 7-11a7 7 0 10-14 0c0 5.5 7 11 7 11z" />
        <circle cx="12" cy="10" r="2.6" />
      </svg>
    );
  }
  return (
    <svg {...common} aria-hidden>
      <path d="M12 2.5l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10v-6l8-3z" />
      <path d="M8.6 12l2.4 2.4 4.4-4.8" />
    </svg>
  );
}

function PhoneIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
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
  if (!text.trim()) return null;
  const g = glass(t);
  return (
    <div style={{ display: 'flex', justifyContent: align === 'left' ? 'flex-start' : 'center', flexShrink: 0 }}>
      <span
        style={{
          ...g.chip,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6 * s,
          padding: `${6.5 * s}px ${15 * s}px`,
          borderRadius: 999,
          fontSize: 11.5 * s,
          fontWeight: 800,
          letterSpacing: 1.6,
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          boxShadow: `0 10px 24px -6px ${t.accent}35`,
        }}
      >
        <span style={{ width: 6 * s, height: 6 * s, borderRadius: '50%', background: t.accent2, flexShrink: 0 }} />
        {text}
      </span>
    </div>
  );
}

/**
 * 📣 Titular Display Monumental: ocupa el 90% del ancho (100% en modos sangrados)
 * con compensación óptica según la fuente Display elegida.
 */
function Headline({
  texts,
  t,
  s,
  size = 48,
  align = 'center',
  color,
  styleId,
  scale = 1,
  fullWidth = false,
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
}) {
  const typo = AFFICHE_TYPOS.find((x) => x.id === styleId) ?? AFFICHE_TYPOS[0];
  const eff = typo.effect;
  const computedSize = size * typo.opticalBoost * scale * s;
  const base: CSSProperties = {
    margin: 0,
    fontFamily: `"${typo.font || t.font}", system-ui, sans-serif`,
    fontSize: Number(computedSize.toFixed(1)),
    lineHeight: 0.96,
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: -1.1 * s,
    color: color ?? (t.light ? t.text : '#ffffff'),
    textShadow:
      t.light && !color && eff !== 'neon' && eff !== 'sticker'
        ? '0 2px 8px rgba(255,255,255,0.45)'
        : '0 8px 24px rgba(0,0,0,0.68), 0 2px 6px rgba(0,0,0,0.55)',
  };

  const highlight = (): ReactElement => {
    const hl = texts.highlight.trim();
    switch (eff) {
      case 'caja':
        return (
          <span
            style={{
              background: `linear-gradient(100deg, ${t.accent}, ${t.accent2})`,
              color: '#0b0f18',
              padding: `${2 * s}px ${11 * s}px`,
              borderRadius: 12 * s,
              display: 'inline-block',
              boxShadow: `0 10px 26px ${t.accent2}55`,
              fontWeight: 900,
              textShadow: 'none',
            }}
          >
            {hl}
          </span>
        );
      case 'neon':
        return (
          <span
            style={{
              color: t.accent2,
              textShadow: `0 0 ${12 * s}px ${t.accent}cc, 0 0 ${28 * s}px ${t.accent2}88, 0 4px ${8 * s}px rgba(0,0,0,0.65)`,
            }}
          >
            {hl}
          </span>
        );
      case 'subrayado':
        return (
          <span
            style={{
              display: 'inline-block',
              color: color ?? t.text,
              boxShadow: `inset 0 -${12 * s}px 0 0 ${t.accent2}80`,
            }}
          >
            {hl}
          </span>
        );
      case 'sticker':
        return (
          <span
            style={{
              color: '#ffffff',
              WebkitTextStroke: `${3 * s}px #111827`,
              textShadow: `${4 * s}px ${4 * s}px 0 ${t.accent2}`,
              paintOrder: 'stroke fill',
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
              borderLeft: `${6 * s}px solid ${t.accent2}`,
              paddingLeft: `${11 * s}px`,
              color: t.accent2,
            }}
          >
            {hl}
          </span>
        );
      default:
        return (
          <span
            style={{
              background: `linear-gradient(105deg, ${t.accent}, ${t.accent2})`,
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              textShadow: 'none',
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
        textAlign: align,
        width: fullWidth ? '100%' : '90%',
        marginLeft: align === 'left' || fullWidth ? 0 : 'auto',
        marginRight: 'auto',
        flexShrink: 0,
      }}
    >
      <p style={base}>
        {texts.plain.trim()} {highlight()}
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
  if (!text.trim()) return null;
  return (
    <p
      style={{
        margin: 0,
        fontSize: 16.5 * s,
        fontWeight: 600,
        lineHeight: 1.32,
        color: color ?? t.sub,
        textAlign: align,
        opacity: 0.94,
        flexShrink: 0,
      }}
    >
      {text.trim()}
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
  magazine: 'editorial',
  diagonal: 'ribbons',
  polaroid: 'badges',
  arc: 'editorial',
  portal: 'badges',
  swiss: 'editorial',
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
  bleed: 'editorial',
  zen: 'bento',
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
                <GlyphIcon kind={i} size={16 * s} color="#0b0f18" />
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
  if (!label.trim()) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
      <span
        style={{
          background: bg,
          color,
          borderRadius: 999,
          padding: `${10 * s}px ${22 * s}px`,
          fontSize: 15 * s,
          fontWeight: 900,
          letterSpacing: 0.3,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7 * s,
          boxShadow: `0 12px 28px -6px ${bg}77`,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
    </div>
  );
}

/**
 * 💎 V19.0 · DOCK GLASSMORPHISM ARQUITECTÓNICO (ERRADICACIÓN DEL PARCHE BLANCO):
 *  - Nunca un rectángulo blanco opaco sobre diseños oscuros.
 *  - Panel translúcido con `backdrop-filter: blur(20px)`, borde luminoso sutil
 *    y sombra difusa tintada con el acento del tema.
 *  - QR protagonista, con margen blanco mínimo ajustado estrictamente al código.
 *  - Alineación tipográfica precisa entre Nombre, Ubicación y WhatsApp, con
 *    respiración generosa respecto al QR.
 */
function Dock({
  brand,
  t,
  s,
  qrUrl,
  size,
  qrLabel,
}: {
  brand: AfficheBrand;
  t: AfficheTheme;
  s: number;
  qrUrl: string | null;
  size: number;
  qrLabel?: string;
}) {
  const phone = (brand.phoneDisplay || 'Escríbenos').replace(/^📲\s*/, '');
  const isLight = Boolean(t.light);

  const dockSurface: CSSProperties = isLight
    ? {
        background: 'linear-gradient(135deg, rgba(255,255,255,0.78), rgba(250,248,242,0.64))',
        backdropFilter: 'blur(20px) saturate(130%)',
        border: '1px solid rgba(15,23,42,0.12)',
        boxShadow: `0 22px 48px -12px rgba(15,23,42,0.18), 0 8px 24px -8px ${t.accent}28`,
      }
    : {
        background: 'linear-gradient(135deg, rgba(9,13,25,0.76), rgba(16,23,42,0.58))',
        backdropFilter: 'blur(22px) saturate(140%)',
        border: '1px solid rgba(255,255,255,0.16)',
        boxShadow: `0 24px 54px -12px rgba(0,0,0,0.68), 0 8px 26px -8px ${t.accent}35`,
      };

  const ink = isLight ? '#0f172a' : '#f8fafc';
  const inkMuted = isLight ? 'rgba(15,23,42,0.68)' : 'rgba(226,232,240,0.72)';
  const eyebrowColor = isLight ? t.accent : t.accent2;
  const waBg = isLight ? 'rgba(5,150,105,0.12)' : 'rgba(16,185,129,0.16)';
  const waBorder = isLight ? 'rgba(5,150,105,0.34)' : 'rgba(52,211,153,0.40)';
  const waInk = isLight ? '#065f46' : '#6ee7b7';

  return (
    <div
      style={{
        ...dockSurface,
        borderRadius: 24 * s,
        position: 'relative',
        overflow: 'hidden',
        padding: `${12 * s}px ${14 * s}px`,
        display: 'flex',
        alignItems: 'center',
        gap: 16 * s,
        flexShrink: 0,
      }}
    >
      {/* Filete de luz superior */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 20 * s,
          right: 20 * s,
          height: 2 * s,
          background: `linear-gradient(90deg, ${t.accent}, ${t.accent2}, transparent)`,
          opacity: 0.85,
        }}
      />

      {/* Columna de identidad tipográfica */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 * s }}>
        <p
          style={{
            margin: 0,
            fontSize: 9.5 * s,
            fontWeight: 800,
            letterSpacing: 1.8 * s,
            textTransform: 'uppercase',
            color: eyebrowColor,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {(brand.slogan || 'COMERCIO LOCAL').toUpperCase()}
        </p>

        <p
          style={{
            margin: 0,
            fontFamily: `"${t.font}", system-ui, sans-serif`,
            fontSize: 24 * s,
            fontWeight: 900,
            color: ink,
            lineHeight: 1.03,
            letterSpacing: -0.4 * s,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {brand.name || 'Tu Negocio'}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5 * s, minWidth: 0 }}>
          <GlyphIcon kind={2} size={12 * s} color={inkMuted} />
          <p
            style={{
              margin: 0,
              fontSize: 11.5 * s,
              fontWeight: 600,
              color: inkMuted,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {brand.address || brand.municipality || 'Gachetá'}
          </p>
        </div>

        <div
          style={{
            marginTop: 2 * s,
            alignSelf: 'flex-start',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6 * s,
            background: waBg,
            border: `1px solid ${waBorder}`,
            borderRadius: 999,
            padding: `${5.5 * s}px ${11 * s}px`,
            maxWidth: '100%',
          }}
        >
          <PhoneIcon size={12.5 * s} color={waInk} />
          <span
            style={{
              fontSize: 13.5 * s,
              fontWeight: 900,
              color: waInk,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: 0.3 * s,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {phone}
          </span>
        </div>
      </div>

      {/* QR Gigante con marco mínimo estrictamente ceñido al código */}
      {qrUrl && (
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4.5 * s,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 13 * s,
              padding: 3.5 * s,
              border: `1.5px solid ${t.accent2}88`,
              boxShadow: `0 12px 28px -6px rgba(0,0,0,0.45), 0 0 ${16 * s}px ${t.accent2}30`,
            }}
          >
            <img src={qrUrl} alt="QR" style={{ width: size, height: size, display: 'block', borderRadius: 9 * s }} />
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 8.5 * s,
              fontWeight: 900,
              letterSpacing: 1.2 * s,
              textTransform: 'uppercase',
              color: inkMuted,
              whiteSpace: 'nowrap',
            }}
          >
            {(qrLabel || 'ESCANEA EL QR').replace(/^[^\p{L}\p{N}]+/u, '')}
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
    photoZoom,
    photoPosY,
    qrLabel,
    qrHint,
    fontStyle,
    headlineScale,
    benefitStyle = 'auto',
    photoUrl2,
    photoUrl3,
    photoUrl4,
  } = props;

  const hs = headlineScale ?? 1;
  const photo2 = photoUrl2 ?? photoUrl;
  const photo3 = photoUrl3 ?? photoUrl;
  const photo4 = photoUrl4 ?? photoUrl;
  const t = AFFICHE_THEMES.find((x) => x.id === themeId) ?? AFFICHE_THEMES[1];
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

  const PHOTO_MAX = (isSquare ? 220 : 390) * s;
  const dockQrSize = (isSquare ? 176 : 158) * s;
  const resolvedBenefitMode: ResolvedBenefitMode =
    benefitStyle === 'auto' ? (LAYOUT_BENEFIT_MAP[layout] ?? 'bento') : benefitStyle;

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
        <CtaButton label={priceLabel} s={s} bg={t.accent2} color={t.light ? '#ffffff' : '#0b0f18'} />
      ) : null}
    </>
  );

  const masterDock = showQr ? (
    <Dock brand={brand} t={t} s={s} qrUrl={qrUrl} size={dockQrSize} qrLabel={qrLabel} />
  ) : null;

  // ═══ PIEZA 2 · GANCHO VIRAL EDITORIAL ════════════════════════════════════
  if (piece === 1) {
    const qr2 = 104 * s;
    const bA = splitBenefit(benefits[0] ?? 'Calidad garantizada');
    const bB = splitBenefit(benefits[1] ?? 'Atención inmediata');
    return (
      <div
        style={{
          width: W,
          height: H,
          flexShrink: 0,
          position: 'relative',
          background: t.bg,
          backgroundSize: t.bgSize ?? '100% 100%, 100% 100%, 100% 100%, 100% 100%',
          color: t.text,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          borderRadius: 24 * s,
          overflow: 'hidden',
        }}
      >
        <ScenicBg url={photo2} t={t} frame />
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            padding: pad,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: 10 * s,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <span
              style={{
                background: `linear-gradient(90deg, ${t.accent}, ${t.accent2})`,
                color: '#0b0f18',
                borderRadius: 999,
                padding: `${6 * s}px ${14 * s}px`,
                fontSize: 10.5 * s,
                fontWeight: 900,
                letterSpacing: 1.4,
                textTransform: 'uppercase',
              }}
            >
              {(brand.municipality || 'Gachetá').toUpperCase()} · DESTACADO HOY
            </span>
            <span style={{ fontSize: 11 * s, fontWeight: 800, color: t.sub, letterSpacing: 1.2 }}>EDICIÓN ESPECIAL</span>
          </div>

          <p
            style={{
              margin: 0,
              flexShrink: 0,
              fontFamily: `"${t.font}", system-ui, sans-serif`,
              fontSize: 32 * s,
              lineHeight: 1.0,
              fontWeight: 900,
              textTransform: 'uppercase',
              textAlign: 'left',
              color: t.light ? t.text : '#ffffff',
            }}
          >
            {texts.hook.trim() || `${texts.plain.trim()} ${texts.highlight.trim()}`.toUpperCase()}
          </p>

          <div
            style={{
              position: 'relative',
              flex: 1,
              minHeight: 0,
              borderRadius: 26 * s,
              overflow: 'hidden',
              boxShadow: `0 24px 50px -10px rgba(0,0,0,0.55), 0 8px 26px ${t.accent}35`,
            }}
          >
            <Photo url={photo2} zoom={photoZoom} posY={photoPosY} />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(180deg, transparent 48%, rgba(8,10,18,0.68) 100%)',
              }}
            />
            {showPrice && brand.promoPrice != null && (
              <div style={{ position: 'absolute', bottom: 14 * s, left: 14 * s }}>
                <PricePill brand={brand} t={t} s={s} big />
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 * s, flexShrink: 0 }}>
            <div style={{ ...g.card, borderRadius: 18 * s, padding: `${10 * s}px ${12 * s}px` }}>
              <p style={{ margin: 0, fontSize: 10 * s, fontWeight: 900, letterSpacing: 1.2, color: t.accent2 }}>VENTAJA 01</p>
              <p style={{ margin: 0, marginTop: 4 * s, fontSize: 13 * s, fontWeight: 800, color: t.text, lineHeight: 1.2 }}>{bA.body}</p>
            </div>
            <div style={{ ...g.card, borderRadius: 18 * s, padding: `${10 * s}px ${12 * s}px` }}>
              <p style={{ margin: 0, fontSize: 10 * s, fontWeight: 900, letterSpacing: 1.2, color: t.accent }}>VENTAJA 02</p>
              <p style={{ margin: 0, marginTop: 4 * s, fontSize: 13 * s, fontWeight: 800, color: t.text, lineHeight: 1.2 }}>{bB.body}</p>
            </div>
          </div>

          {showQr && (
            <Dock brand={brand} t={t} s={s} qrUrl={qrUrl} size={qr2} qrLabel={qrLabel} />
          )}
        </div>
      </div>
    );
  }

  // ═══ PIEZA 3 · BENTO EDITORIAL DE VALOR ═══════════════════════════════════
  if (piece === 2) {
    const qr3 = 100 * s;
    return (
      <div
        style={{
          width: W,
          height: H,
          flexShrink: 0,
          position: 'relative',
          background: t.bg,
          backgroundSize: t.bgSize ?? '100% 100%, 100% 100%, 100% 100%, 100% 100%',
          color: t.text,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          borderRadius: 24 * s,
          overflow: 'hidden',
        }}
      >
        <ScenicBg url={photo3} t={t} frame />
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            padding: pad,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: 10 * s,
          }}
        >
          <div
            style={{
              position: 'relative',
              height: (isSquare ? 150 : 230) * s,
              borderRadius: 24 * s,
              overflow: 'hidden',
              flexShrink: 0,
              boxShadow: `0 20px 44px -10px rgba(0,0,0,0.55)`,
            }}
          >
            <Photo url={photo3} zoom={photoZoom} posY={photoPosY} />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(180deg, transparent 32%, rgba(8,10,18,0.82) 100%)',
              }}
            />
            <div style={{ position: 'absolute', bottom: 14 * s, left: 16 * s, right: 16 * s }}>
              <p style={{ margin: 0, fontSize: 10 * s, fontWeight: 900, letterSpacing: 1.8, color: t.accent2, textTransform: 'uppercase' }}>
                {(brand.address || brand.municipality || 'Gachetá').toUpperCase()}
              </p>
              <p
                style={{
                  margin: 0,
                  fontFamily: `"${t.font}", system-ui, sans-serif`,
                  fontSize: 28 * s,
                  fontWeight: 900,
                  color: '#ffffff',
                  lineHeight: 1.04,
                }}
              >
                {brand.name || 'Tu Negocio'}
              </p>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gridTemplateRows: '1fr 1fr',
              gap: 9 * s,
            }}
          >
            {[0, 1, 2, 3].map((i) => {
              const b = benefits[i] ?? ['Calidad comprobada', 'Atención directa', 'Ubicación céntrica', 'Trato cercano'][i] ?? '';
              const { body } = splitBenefit(b);
              return (
                <div
                  key={i}
                  style={{
                    ...g.card,
                    borderRadius: 20 * s,
                    padding: `${11 * s}px ${13 * s}px`,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span
                      style={{
                        fontFamily: `"${t.font}", system-ui, sans-serif`,
                        fontSize: 22 * s,
                        fontWeight: 900,
                        color: i % 2 === 0 ? t.accent2 : t.accent,
                        lineHeight: 1,
                      }}
                    >
                      0{i + 1}
                    </span>
                    <GlyphIcon kind={i} size={17 * s} color={t.accent2} />
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13.5 * s,
                      fontWeight: 800,
                      color: t.text,
                      lineHeight: 1.2,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {body}
                  </p>
                </div>
              );
            })}
          </div>

          {showQr && <Dock brand={brand} t={t} s={s} qrUrl={qrUrl} size={qr3} qrLabel={qrLabel} />}
        </div>
      </div>
    );
  }

  // ═══ PIEZA 4 · CIERRE VIP CON MEGA-QR PROTAGONISTA ═══════════════════════
  if (piece === 3) {
    const qrBig = (isSquare ? 190 : 292) * s;
    const medallion = (isSquare ? 96 : 148) * s;
    return (
      <div
        style={{
          width: W,
          height: H,
          flexShrink: 0,
          position: 'relative',
          background: t.bg,
          backgroundSize: t.bgSize ?? '100% 100%, 100% 100%, 100% 100%, 100% 100%',
          color: t.text,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          borderRadius: 24 * s,
          overflow: 'hidden',
        }}
      >
        <ScenicBg url={photo4} t={t} frame />
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            padding: pad,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8 * s,
          }}
        >
          <div
            style={{
              width: medallion,
              height: medallion,
              flexShrink: 0,
              borderRadius: '50%',
              background: `linear-gradient(145deg, ${t.accent}, ${t.accent2})`,
              padding: 4 * s,
              boxShadow: `0 0 ${32 * s}px ${t.accent2}66, 0 18px 40px rgba(0,0,0,0.48)`,
            }}
          >
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden' }}>
              <Photo url={photo4} zoom={photoZoom} posY={photoPosY} />
            </div>
          </div>

          <Headline texts={ht('ESCANEA Y', 'CONECTA YA')} t={t} s={s} size={36} styleId={fontStyle} scale={hs} />

          {qrUrl && (
            <div
              style={{
                ...g.card,
                borderRadius: 26 * s,
                padding: `${12 * s}px`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 7 * s,
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: 16 * s,
                  padding: 4.5 * s,
                  border: `2px solid ${t.accent2}99`,
                  boxShadow: `0 16px 36px rgba(0,0,0,0.45)`,
                }}
              >
                <img src={qrUrl} alt="QR" style={{ width: qrBig, height: qrBig, display: 'block', borderRadius: 12 * s }} />
              </div>
              <p style={{ margin: 0, fontSize: 10.5 * s, fontWeight: 900, letterSpacing: 1.4 * s, color: t.accent2, textTransform: 'uppercase' }}>
                {(qrLabel || 'ESCANEA EL QR').replace(/^[^\p{L}\p{N}]+/u, '')}
              </p>
            </div>
          )}

          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <p style={{ margin: 0, fontSize: 13 * s, fontWeight: 700, color: t.text }}>{qrHint || 'Escanea para ir a nuestro WhatsApp'}</p>
            <p style={{ margin: 0, marginTop: 4 * s, fontSize: 15 * s, fontWeight: 900, color: t.accent2, fontVariantNumeric: 'tabular-nums' }}>
              {brand.phoneDisplay || brand.name}
            </p>
            <p style={{ margin: 0, marginTop: 2 * s, fontSize: 11 * s, fontWeight: 600, color: t.sub }}>
              {brand.name || 'Tu Negocio'} · {brand.address || brand.municipality || 'Gachetá'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ═══ PIEZA 1 · AFICHE MAESTRO (28 ARQUITECTURAS SIN MOLDES REPETITIVOS) ═══
  let body: ReactElement;
  switch (layout) {
    case 'magazine': {
      // Vogue / Editorial Full-Bleed: fotografía a sangre completa + tipografía monumental solapando la escena
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
                'linear-gradient(180deg, rgba(6,8,14,0.28) 0%, rgba(6,8,14,0.08) 32%, rgba(6,8,14,0.72) 64%, rgba(6,8,14,0.95) 100%)',
            }}
          />
          <div style={{ position: 'absolute', top: pad, left: pad, right: pad, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Badge text={badge} t={t} s={s} align="left" />
            {priceOverlay && <PricePill brand={brand} t={t} s={s} />}
          </div>
          <div style={{ position: 'absolute', left: pad, right: pad, bottom: pad, display: 'flex', flexDirection: 'column', gap: 10 * s }}>
            <Headline texts={texts} t={{ ...t, light: false, text: '#ffffff' }} s={s} size={50} align="left" styleId={fontStyle} scale={hs} fullWidth />
            <SubHead text={texts.sub} t={t} s={s} align="left" color="rgba(255,255,255,0.88)" />
            {showBenefits && benefits.length > 0 && (
              <BenefitsShowcase items={benefits} t={{ ...t, light: false, text: '#ffffff' }} s={s} mode={benefitStyle === 'auto' ? 'editorial' : resolvedBenefitMode} align="left" />
            )}
            {isService && priceLabel && <CtaButton label={priceLabel} s={s} bg={t.accent2} color="#0b0f18" />}
            {showQr && <Dock brand={brand} t={{ ...t, light: false, text: '#ffffff', sub: 'rgba(255,255,255,0.75)' }} s={s} qrUrl={qrUrl} size={dockQrSize} qrLabel={qrLabel} />}
          </div>
        </div>
      );
      break;
    }

    case 'diagonal': {
      // Corte Diagonal Asimétrico con solapamiento de tipografía sobre el corte
      body = (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          <div
            style={{
              position: 'absolute',
              top: -pad,
              left: -pad,
              right: -pad,
              height: '49%',
              clipPath: 'polygon(0 0, 100% 0, 100% 78%, 0 100%)',
              overflow: 'hidden',
            }}
          >
            <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(6,8,14,0.34), transparent 36%, rgba(6,8,14,0.52) 100%)' }} />
          </div>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 3 }}>
            <Badge text={badge} t={t} s={s} align="left" />
          </div>
          <div
            style={{
              position: 'absolute',
              top: `calc(46% - ${8 * s}px)`,
              left: -pad,
              right: -pad,
              height: 5 * s,
              background: `linear-gradient(90deg, ${t.accent}, ${t.accent2})`,
              transform: 'rotate(-2.4deg)',
              boxShadow: `0 8px 24px ${t.accent}77`,
              zIndex: 3,
            }}
          />
          {priceOverlay && (
            <div style={{ position: 'absolute', top: `calc(46% - ${56 * s}px)`, right: 4 * s, transform: 'rotate(3deg)', zIndex: 5 }}>
              <PricePill brand={brand} t={t} s={s} big />
            </div>
          )}
          <div style={{ position: 'absolute', top: '42%', left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 8 * s, zIndex: 4 }}>
            <Headline texts={texts} t={t} s={s} size={46} align="left" styleId={fontStyle} scale={hs} />
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
            <span style={{ fontFamily: `"${t.font}", system-ui, sans-serif`, fontSize: 26 * s, fontWeight: 900, color: '#0b0f18', transform: 'rotate(90deg)', whiteSpace: 'nowrap', letterSpacing: 2 }}>
              {(brand.municipality || 'GACHETÁ').toUpperCase()}
            </span>
            <span style={{ fontFamily: `"${t.font}", system-ui, sans-serif`, fontSize: 18 * s, fontWeight: 900, color: '#0b0f18' }}>01</span>
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
            <span style={{ fontFamily: `"${t.font}", system-ui, sans-serif`, fontSize: 12 * s, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1, color: '#0b0f18' }}>
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
          <div style={{ position: 'absolute', top: 18 * s, right: -46 * s, width: 220 * s, transform: 'rotate(28deg)', background: t.accent2, color: '#0b0f18', textAlign: 'center', padding: `${7 * s}px 0`, fontSize: 11.5 * s, fontWeight: 900, letterSpacing: 2, textTransform: 'uppercase', boxShadow: '0 10px 24px rgba(0,0,0,0.4)', zIndex: 4 }}>
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
      // Out-of-Bounds 3D: tarjeta de titular superpuesta sobre el borde inferior de la foto
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10 * s, height: '100%', position: 'relative' }}>
          <Badge text={badge} t={t} s={s} />
          <div style={{ position: 'relative', height: (isSquare ? 185 : 320) * s, flexShrink: 0, overflow: 'visible' }}>
            <div style={{ position: 'absolute', top: 0, left: '6%', right: '6%', height: '82%', borderRadius: 26 * s, transform: 'rotate(2deg)', overflow: 'hidden', boxShadow: `0 26px 56px -10px rgba(0,0,0,0.6), 0 8px 26px ${t.accent}40` }}>
              <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
            </div>
            <div style={{ position: 'absolute', bottom: 0, left: 4 * s, right: 4 * s, ...g.card, borderRadius: 24 * s, padding: `${12 * s}px ${16 * s}px`, transform: 'rotate(-1.2deg)' }}>
              <Headline texts={texts} t={t} s={s} size={36} align="center" styleId={fontStyle} scale={hs} fullWidth />
            </div>
            {priceOverlay && (
              <div style={{ position: 'absolute', top: 10 * s, right: 6 * s, transform: 'rotate(4deg)', zIndex: 5 }}>
                <PricePill brand={brand} t={t} s={s} />
              </div>
            )}
          </div>
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
          <div style={{ transform: 'rotate(-1.8deg)', background: `linear-gradient(90deg, ${t.accent}, ${t.accent2})`, color: '#0b0f18', borderRadius: 16 * s, padding: `${9 * s}px ${18 * s}px`, alignSelf: 'center', fontSize: 16 * s, fontWeight: 900, letterSpacing: 1.4, textTransform: 'uppercase', boxShadow: `0 14px 32px ${t.accent}66`, whiteSpace: 'nowrap' }}>
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
      // Split Diagonal Extremo con titular superpuesto sobre la línea de corte
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', position: 'relative' }}>
          <div style={{ position: 'relative', height: (isSquare ? 195 : 350) * s, flexShrink: 0, overflow: 'visible' }}>
            <div
              style={{
                position: 'absolute',
                top: -pad,
                left: -pad,
                right: -pad,
                bottom: 0,
                clipPath: 'polygon(0 0, 100% 0, 100% 68%, 0 100%)',
                overflow: 'hidden',
              }}
            >
              <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
              {priceOverlay && (
                <div style={{ position: 'absolute', bottom: 26 * s, right: 18 * s }}>
                  <PricePill brand={brand} t={t} s={s} />
                </div>
              )}
            </div>
          </div>
          <div style={{ marginTop: -36 * s, position: 'relative', zIndex: 4, display: 'flex', flexDirection: 'column', gap: 9 * s }}>
            <Badge text={badge} t={t} s={s} align="left" />
            <Headline texts={texts} t={t} s={s} size={50} align="left" styleId={fontStyle} scale={hs} fullWidth />
            {contentBlocks('left')}
          </div>
          {masterDock}
        </div>
      );
      break;
    }

    case 'orbits': {
      // Círculos Intersectados Out-of-Bounds
      const bigC = (isSquare ? 210 : 370) * s;
      const smallC = (isSquare ? 150 : 265) * s;
      body = (
        <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 10 * s }}>
          <div style={{ position: 'absolute', top: 12 * s, right: -36 * s, width: bigC, height: bigC, borderRadius: '50%', overflow: 'hidden', border: `${4 * s}px solid ${t.accent2}66`, boxShadow: `0 24px 54px rgba(0,0,0,0.55)` }}>
            <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
          </div>
          <div style={{ position: 'absolute', top: (isSquare ? 82 : 145) * s, left: -46 * s, width: smallC, height: smallC, borderRadius: '50%', background: `linear-gradient(155deg, ${t.accent}, ${t.accent2})`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: `0 18px 42px ${t.accent}66`, zIndex: 3 }}>
            <span style={{ fontFamily: `"${t.font}", system-ui, sans-serif`, fontSize: (isSquare ? 34 : 52) * s, fontWeight: 900, color: '#0b0f18', lineHeight: 1 }}>
              {showPrice && brand.promoPrice != null ? money(brand.promoPrice) : 'HOY'}
            </span>
            {showPrice && brand.normalPrice != null && brand.promoPrice != null && (
              <span style={{ fontSize: 12 * s, color: 'rgba(11,15,24,0.72)', textDecoration: 'line-through', fontWeight: 800 }}>
                {money(brand.normalPrice)}
              </span>
            )}
          </div>
          <div style={{ position: 'relative', zIndex: 4, display: 'flex', flexDirection: 'column', gap: 9 * s }}>
            <Headline texts={texts} t={t} s={s} size={46} align="left" styleId={fontStyle} scale={hs} fullWidth />
            {contentBlocks('left')}
            {masterDock}
          </div>
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
        width: W,
        height: H,
        flexShrink: 0,
        position: 'relative',
        background: t.bg,
        backgroundSize: t.bgSize ?? '100% 100%, 100% 100%, 100% 100%, 100% 100%',
        color: t.text,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        borderRadius: 24 * s,
        overflow: 'hidden',
      }}
    >
      <ScenicBg url={photoUrl} t={t} />
      <div style={{ position: 'relative', width: '100%', height: '100%', padding: pad, boxSizing: 'border-box' }}>{body}</div>
    </div>
  );
}
