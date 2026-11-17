/**
 * 🎨 MOTOR DE DISEÑO EDITORIAL V13 (html-to-image)
 *
 * Artboard HTML/CSS/SVG de nivel agencia a 540×960 (Historia 9:16) o 540×540
 * (Post 1:1), exportado con `toPng(node, { pixelRatio: 2 })` → PNG 1080×1920
 * ultra-nítido. V13.0:
 *  · FONDO ESCÉNICO MULTICAPA: la foto full-canvas con blur(28px) +
 *    brightness + saturación detrás del contenido, haces de luz volumétricos
 *    y marcos editoriales (nivel Wow de agencia).
 *  · Tipografía DISPLAY GIGANTE real: titular 42px (=84px en 1080p), la foto
 *    NUNCA aplasta el texto (ventana fotográfica con tope del 42%).
 *  · 4 PIEZAS RICAS: maestra con arquitectura; portada de revista full-bleed
 *    con cabecera editorial; infografía con banner panorámico y tarjetas
 *    Bento 01/02/03; cierre VIP con QR gigante 420px y destino elegido.
 *  · qrLabel/qrHint: la leyenda del QR cambia según el destino elegido
 *    (WhatsApp / Perfil Impulso / Oferta / Enlace externo).
 */

import type { CSSProperties } from 'react';

export type AfficheFormat = 'story' | 'square';
export type AfficheLayout =
  | 'bento' | 'magazine' | 'diagonal' | 'polaroid' | 'arc' | 'portal' | 'swiss'
  | 'split' | 'brutal' | 'vip' | 'cyber' | 'rustic' | 'retail' | 'eco' | 'cinema' | 'float'
  // 🚀 V19 · 8 arquitecturas futuristas nuevas (17–24)
  | 'hud' | 'resort' | 'menu' | 'clinic' | 'agro' | 'diamond' | 'flash' | 'bento3d'
  // 💥 V21 · 4 composiciones asimétricas disruptivas (25–28)
  | 'diagx' | 'orbits' | 'bleed' | 'zen';
export type AffichePiece = 0 | 1 | 2 | 3;

export interface AfficheTheme {
  id: string;
  label: string;
  /** Fondo claro → tarjetas y chips de vidrio oscuro. */
  light?: boolean;
  /** Fuente display de agencia (Google Fonts). */
  font: string;
  text: string;
  sub: string;
  accent: string;
  accent2: string;
  /** Fondo completo: gradientes + textura material en capas CSS. */
  bg: string;
  /** Tamaño de cada capa del fondo (cuando la textura es un patrón repetido). */
  bgSize?: string;
}

/** V11/V12: 12 fondos texturizados de nivel Behance (CSS puro, sin imágenes). */
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
  // V14: 4 temas nuevos → 16 fondos de agencia en cascada.
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

/** V14 · 8 ESTILOS TIPOGRÁFICOS DE AGENCIA: cambian en vivo la fuente display
 *  del titular y el tratamiento visual de las palabras clave (cascada en el
 *  Studio). Todos usan Google Fonts ya cargadas en index.html. */
export interface AfficheTypo {
  id: string;
  label: string;
  hint: string;
  font: string;
  effect: 'gradiente' | 'caja' | 'neon' | 'subrayado' | 'sticker' | 'barra';
}

export const AFFICHE_TYPOS: AfficheTypo[] = [
  { id: 'impacto', label: '01 · Impacto Display', hint: 'Gigante condensada', font: 'Anton', effect: 'gradiente' },
  { id: 'moderna', label: '02 · Agencia Moderna', hint: 'Futurista limpia', font: 'Space Grotesk', effect: 'gradiente' },
  { id: 'revista', label: '03 · Revista de Lujo', hint: 'Serif editorial', font: 'Playfair Display', effect: 'gradiente' },
  { id: 'marcador', label: '04 · Marcador Resaltado', hint: 'Cajas de color sólido', font: 'Archivo Black', effect: 'caja' },
  { id: 'neon', label: '05 · Neón & Contorno 3D', hint: 'Resplandor puro', font: 'Bebas Neue', effect: 'neon' },
  { id: 'gruesa', label: '06 · Comercial Ultra-Gruesa', hint: 'Subrayado dinámico', font: 'Montserrat', effect: 'subrayado' },
  { id: 'suiza', label: '07 · Suiza Arquitectónica', hint: 'Barras laterales', font: 'Archivo Black', effect: 'barra' },
  { id: 'pop', label: '08 · Pop Sticker Urbano', hint: 'Borde negro + sombra 3D', font: 'Archivo Black', effect: 'sticker' },
];

/** Estilos de vidrio según el fondo (claro vs oscuro). */
function glass(t: AfficheTheme): { card: CSSProperties; chip: CSSProperties } {
  return t.light
    ? {
        card: { background: 'rgba(15,23,42,0.07)', border: '1px solid rgba(15,23,42,0.16)' },
        chip: { background: 'rgba(15,23,42,0.82)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.25)' },
      }
    : {
        card: { background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.22)' },
        chip: { background: 'rgba(8,10,18,0.78)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.28)' },
      };
}

export interface AfficheBrand {
  name: string;
  /** Categoría detectada del brief · ubicación — JAMÁS una categoría fija. */
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
  /** Pregunta gancho gigante para la Pieza 2 (portada de impacto viral). */
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
  /** V13: leyenda corta del QR según el destino elegido (dock y piezas QR). */
  qrLabel?: string;
  /** V13: indicador del destino para la pieza 4 (frase completa). */
  qrHint?: string;
  /** V14: id del estilo tipográfico (AFFICHE_TYPOS) para titular y claves. */
  fontStyle?: string;
  /** 🔍 V18: escala del titular (0.8 a 1.5) — slider "Tamaño del Titular". */
  headlineScale?: number;
  /** 🖼️ V19 · Fotos DIFERENTES para las piezas 2, 3 y 4 (campaña multi-diseño). */
  photoUrl2?: string | null;
  photoUrl3?: string | null;
  photoUrl4?: string | null;
}

const money = (v: number): string => `$${v.toLocaleString('es-CO')}`;

/** Titular suelto (piezas con textos dedicados). */
function ht(plain: string, highlight: string): AfficheTexts {
  return { plain, highlight, sub: '', benefits: [], cta: '', hook: '' };
}

/** 🎯 V20 · Estética de agencia: separa el emoji inicial de un beneficio y
 *  ELIMINA cualquier emoji genérico del cuerpo (✅ ✨ ⭐ 🥇…). El icono lo
 *  dibuja el sistema con SVG vectorial (GlyphIcon), nunca un emoji. */
function splitBenefit(b: string): { icon: string; body: string } {
  const m = /^\p{Extended_Pictographic}[\uFE0F\u200D]?/u.exec(b.trim());
  const icon = m ? m[0] : '';
  const raw = m ? b.trim().slice(icon.length).trim() : b.trim();
  // Limpia cualquier pictográfico restante dentro del texto (espacios dobles incluidos)
  const body = raw.replace(/\p{Extended_Pictographic}[\uFE0F\u200D]?/gu, '').replace(/\s{2,}/g, ' ').trim();
  return { icon, body };
}

/** 🎯 V20 · Iconografía vectorial minimalista de agencia: 4 glifos SVG puros
 *  (check, rayo, pin, escudo) que reemplazan los emojis genéricos en todo
 *  el afiche. Se tintan con el acento del tema. */
function GlyphIcon({ kind, size, color }: { kind: number; size: number; color: string }) {
  const k = kind % 4;
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: color,
    strokeWidth: 2.4,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  if (k === 0) {
    // Check doble de verificación
    return (
      <svg {...common} aria-hidden>
        <path d="M2.5 12.5l5 5L19 6" />
      </svg>
    );
  }
  if (k === 1) {
    // Rayo de velocidad
    return (
      <svg {...common} aria-hidden>
        <path d="M13 2L4.5 13.5H11L10 22l8.5-11.5H12L13 2z" />
      </svg>
    );
  }
  if (k === 2) {
    // Pin de ubicación
    return (
      <svg {...common} aria-hidden>
        <path d="M12 21s7-5.5 7-11a7 7 0 10-14 0c0 5.5 7 11 7 11z" />
        <circle cx="12" cy="10" r="2.6" />
      </svg>
    );
  }
  // Escudo de confianza
  return (
    <svg {...common} aria-hidden>
      <path d="M12 2.5l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10v-6l8-3z" />
      <path d="M8.6 12l2.4 2.4 4.4-4.8" />
    </svg>
  );
}

/** Foto con recorte, zoom y posición vertical (100% nítida, sin overlays). */
function Photo({
  url, zoom, posY,
}: {
  url: string | null;
  zoom: number;
  posY: number;
}) {
  if (!url) {
    return (
      <div
        style={{
          width: '100%', height: '100%', borderRadius: 'inherit',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <div style={{ width: 96, height: 96, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.35)' }} />
      </div>
    );
  }
  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', borderRadius: 'inherit' }}>
      <img
        src={url}
        alt=""
        style={{
          width: '100%', height: '100%', objectFit: 'cover', display: 'block',
          objectPosition: `50% ${Math.round(posY * 100)}%`,
          transform: `scale(${zoom})`,
          transformOrigin: `50% ${Math.round(posY * 100)}%`,
        }}
      />
    </div>
  );
}

/**
 * 🌄 V13 · FONDO ESCÉNICO MULTICAPA (nivel Wow de agencia):
 *  · Capa 1 — foto full-canvas con `blur(28px) brightness(0.42) saturate(1.35)`
 *    (o desenfoque luminoso en temas claros) escalada para tapar bordes.
 *  · Capa 2 — tinte ambiental del tema + resplandor del acento + haces de
 *    luz volumétricos diagonales.
 *  · Capa 3 (opcional) — marco editorial doble a 14px (=28px en 1080p).
 * Todo queda DETRÁS del contenido: riqueza escénica sin tapar textos.
 */
function ScenicBg({ url, t, frame = false }: { url: string | null; t: AfficheTheme; frame?: boolean }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 'inherit' }}>
      {url ? (
        <div
          style={{
            position: 'absolute', inset: -48,
            backgroundImage: `url(${url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: t.light ? 'blur(30px) brightness(1.02) saturate(1.15)' : 'blur(28px) brightness(0.42) saturate(1.35)',
            transform: 'scale(1.18)',
          }}
        />
      ) : null}
      {/* Tinte ambiental del tema + viñeta cinematográfica */}
      <div
        style={{
          position: 'absolute', inset: 0,
          background: t.light
            ? 'linear-gradient(180deg, rgba(250,248,242,0.62), rgba(250,248,242,0.38))'
            : 'linear-gradient(165deg, rgba(6,8,14,0.34) 0%, rgba(6,8,14,0.16) 42%, rgba(6,8,14,0.62) 100%)',
        }}
      />
      {/* Resplandor del acento + haces de luz volumétricos */}
      <div
        style={{
          position: 'absolute', inset: 0,
          background:
            `radial-gradient(320px 190px at 82% 6%, ${t.accent}42, transparent 62%),` +
            `radial-gradient(380px 240px at 8% 94%, ${t.accent2}32, transparent 62%),` +
            'linear-gradient(115deg, rgba(255,255,255,0.10) 0%, transparent 26%, transparent 64%, rgba(255,255,255,0.08) 100%)',
        }}
      />
      {/* Marco editorial doble a 14px del borde (=28px en el PNG 1080p) */}
      {frame && (
        <>
          <div style={{ position: 'absolute', inset: 14, border: '1px solid rgba(255,255,255,0.30)', borderRadius: 12, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', inset: 20, border: '1px solid rgba(255,255,255,0.11)', borderRadius: 9, pointerEvents: 'none' }} />
        </>
      )}
    </div>
  );
}

/** Sello superior flotante — FUERA de la foto, jamás la tapa. */
function Badge({ text, t, s }: { text: string; t: AfficheTheme; s: number }) {
  if (!text.trim()) return null;
  const g = glass(t);
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <span
        style={{
          ...g.chip,
          display: 'inline-flex', alignItems: 'center',
          padding: `${8 * s}px ${18 * s}px`,
          borderRadius: 999,
          fontSize: 13 * s,
          fontWeight: 800,
          letterSpacing: 1.4,
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}
      >
        {text}
      </span>
    </div>
  );
}

/**
 * 📣 V14 · TITULAR DISPLAY GIGANTE con 8 estilos tipográficos: 46px en el
 * lienzo de 540 (=92px en el PNG 1080p), fuente display elegida en cascada y
 * palabras clave con efecto de agencia (gradiente / caja / neón / subrayado /
 * sticker 3D / barra lateral).
 */
function Headline({
  texts, t, s, size = 46, align = 'center', color, styleId, scale = 1, fullWidth = false,
}: {
  texts: AfficheTexts;
  t: AfficheTheme;
  s: number;
  size?: number;
  align?: 'center' | 'left';
  color?: string;
  styleId?: string;
  /** 🔍 V18: multiplicador del tamaño del titular (slider 80%–150%). */
  scale?: number;
  /** 💥 V21 · Ancho 100% (layout Tipografía Sangrada: el titular sangra). */
  fullWidth?: boolean;
}) {
  const typo = AFFICHE_TYPOS.find((x) => x.id === styleId) ?? AFFICHE_TYPOS[0];
  const eff = typo.effect;
  const base: CSSProperties = {
    margin: 0,
    fontFamily: `"${typo.font || t.font}", system-ui, sans-serif`,
    fontSize: (size * scale * s).toFixed(1),
    // 🎯 V21 · Display de élite: interlineado mínimo (leading-none) y
    // tracking apretado (-1.2px) tipo revista de moda, 100% en caja alta.
    lineHeight: 1.0,
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: -1.2 * s,
    color: color ?? (t.light ? t.text : '#ffffff'),
    // 💡 V19 · Reluciente de alto contraste: sombra triple de profundidad para
    // que el titular se lea perfecto sobre cualquier fondo claro u oscuro.
    textShadow:
      t.light && !color && eff !== 'neon' && eff !== 'sticker'
        ? '0 2px 6px rgba(255,255,255,0.5)'
        : '0 4px 16px rgba(0,0,0,0.95), 0 2px 6px rgba(0,0,0,0.6), 0 1px 2px rgba(0,0,0,0.8)',
  };

  /** Palabra(s) clave con el efecto del estilo tipográfico elegido. */
  const highlight = (): React.ReactElement => {
    const hl = texts.highlight.trim();
    switch (eff) {
      case 'caja':
        return (
          <span
            style={{
              background: `linear-gradient(100deg, ${t.accent}, ${t.accent2})`,
              color: '#0b0f18',
              padding: `${2 * s}px ${10 * s}px`, borderRadius: 10 * s,
              display: 'inline-block', boxShadow: `0 6px 16px ${t.accent2}55, 0 0 ${24 * s}px ${t.accent}55`,
              fontWeight: 900,
            }}
          >
            {hl}
          </span>
        );
      case 'neon':
        return (
          <span style={{ color: t.accent2, textShadow: `0 0 ${8 * s}px ${t.accent}, 0 0 ${22 * s}px ${t.accent2}99, 0 2px ${6 * s}px rgba(0,0,0,0.6)` }}>
            {hl}
          </span>
        );
      case 'subrayado':
        return (
          <span style={{ display: 'inline-block', color: color ?? t.text, boxShadow: `inset 0 -${11 * s}px 0 0 ${t.accent2}77` }}>
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
          <span style={{ display: 'inline-block', borderLeft: `${6 * s}px solid ${t.accent2}`, paddingLeft: `${10 * s}px`, color: t.accent2 }}>
            {hl}
          </span>
        );
      default: // gradiente
        return (
          <span
            style={{
              background: `linear-gradient(100deg, ${t.accent}, ${t.accent2})`,
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            {hl}
          </span>
        );
    }
  };

  return (
    // 🎯 V21 · El titular respira: ocupa el 90% del ancho disponible del afiche
    // (o 100% con fullWidth en el layout de tipografía sangrada).
    <div
      style={{
        textAlign: align,
        width: fullWidth ? '100%' : '90%',
        marginLeft: align === 'left' || fullWidth ? 0 : 'auto',
        marginRight: 'auto',
      }}
    >
      <p style={base}>
        {texts.plain.trim()}{' '}
        {highlight()}
      </p>
    </div>
  );
}

/** Subtítulo editorial: 18.5px en lienzo (=37px en 1080p), legible y firme. */
function SubHead({ text, t, s, align = 'center', color }: { text: string; t: AfficheTheme; s: number; align?: 'center' | 'left'; color?: string }) {
  if (!text.trim()) return null;
  return (
    <p style={{ margin: 0, fontSize: 18.5 * s, fontWeight: 600, lineHeight: 1.35, color: color ?? t.sub, textAlign: align, opacity: 0.96 }}>
      {text.trim()}
    </p>
  );
}

/** 💎 V14 · Tarjetas de beneficio GRANDES: 18.5px bold (=37px en 1080p),
 *  icono 30px a la izquierda, borde luminoso y sombra profunda. */
function BenefitCards({ items, t, s }: { items: string[]; t: AfficheTheme; s: number }) {
  const g = glass(t);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 * s }}>
      {items.slice(0, 3).map((b, i) => {
        const { body } = splitBenefit(b);
        return (
          <div
            key={i}
            style={{
              ...g.card,
              borderRadius: 16 * s,
              display: 'flex', alignItems: 'center', gap: 13 * s,
              padding: `${12 * s}px ${16 * s}px`,
              boxShadow: t.light
                ? `0 2px 10px rgba(15,23,42,0.10), inset 0 0 0 1px ${t.accent2}22`
                : `0 6px 18px rgba(0,0,0,0.35), inset 0 0 0 1px ${t.accent2}33`,
            }}
          >
            {/* 🎯 V20 · Icono VECTORIAL minimalista en caja con gradiente luminoso (cero emojis) */}
            <span
              style={{
                width: 40 * s, height: 40 * s, flexShrink: 0,
                borderRadius: 11 * s,
                background: `linear-gradient(160deg, ${t.accent}40, ${t.accent2}28)`,
                border: '1px solid rgba(255,255,255,0.35)',
                boxShadow: 'inset 0 2px 5px rgba(255,255,255,0.35), 0 4px 12px rgba(0,0,0,0.30)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <GlyphIcon kind={i} size={20 * s} color={t.accent2} />
            </span>
            <span style={{ flex: 1, fontSize: 19.5 * s, fontWeight: 800, color: t.text, lineHeight: 1.18 }}>{body}</span>
            <GlyphIcon kind={0} size={18 * s} color={t.accent2} />
          </div>
        );
      })}
    </div>
  );
}

/** Píldoras de beneficios (layouts full-bleed): 15px bold. */
function BenefitPills({ items, t, s }: { items: string[]; t: AfficheTheme; s: number }) {
  const g = glass(t);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 * s, justifyContent: 'center' }}>
      {items.slice(0, 3).map((b, i) => (
        <span
          key={i}
          style={{
            ...g.card,
            borderRadius: 999,
            padding: `${9 * s}px ${15 * s}px`,
            fontSize: 15 * s, fontWeight: 700, color: t.text,
            whiteSpace: 'nowrap',
          }}
        >
          {b}
        </span>
      ))}
    </div>
  );
}

/** Píldora de precio flotante sobre el borde inferior de la foto. */
function PricePill({ brand, t, s, big = false }: { brand: AfficheBrand; t: AfficheTheme; s: number; big?: boolean }) {
  const promo = brand.promoPrice;
  const showNormal = brand.normalPrice != null && promo != null && brand.normalPrice > promo;
  if (promo == null) return null;
  return (
    <div
      style={{
        background: 'rgba(8,10,18,0.82)',
        border: '1px solid rgba(255,255,255,0.30)',
        borderRadius: 16 * s,
        padding: `${9 * s}px ${18 * s}px`,
        display: 'flex', alignItems: 'baseline', gap: 8 * s,
        boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
      }}
    >
      <span style={{ fontFamily: `"${t.font}", system-ui, sans-serif`, fontSize: (big ? 40 : 30) * s, fontWeight: 900, color: '#fde047', lineHeight: 1 }}>
        {money(promo)}
      </span>
      {showNormal && brand.normalPrice != null && (
        <span style={{ fontSize: 14 * s, color: '#e2e8f0', textDecoration: 'line-through' }}>{money(brand.normalPrice)}</span>
      )}
    </div>
  );
}

/** 🎯 V12 · Botón publicitario real: 17px extrabold, píldora grande con
 *  sombra luminosa — se lee y se quiere tocar. */
function CtaButton({ label, s, bg = '#16a34a', color = '#ffffff' }: { label: string; s: number; bg?: string; color?: string }) {
  if (!label.trim()) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <span
        style={{
          background: bg,
          color,
          borderRadius: 999,
          padding: `${13 * s}px ${28 * s}px`,
          fontSize: 18 * s,
          fontWeight: 900,
          letterSpacing: 0.3,
          display: 'inline-flex', alignItems: 'center', gap: 8 * s,
          boxShadow: `0 10px 26px ${bg}66`,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
    </div>
  );
}

/**
 * 🎫 V21 · DOCK "TARJETA DE EMBARQUE" (rediseño total): una tarjeta VIP con
 * fondo SÓLIDO contrastante (blanco puro en tema oscuro, ónix en tema claro)
 * para que el QR se escanee a la primera. Estructura de boarding pass:
 *  · Franja superior de acento (filete de color).
 *  · Zona izquierda: rubro · negocio · ubicación.
 *  · Separador PERFORADO con muescas circulares (estilo billete).
 *  · Zona derecha: QR gigante (≥45% del ancho del dock) + leyenda.
 *  · Barra inferior de ancho completo: WhatsApp en ≥32px REALES.
 */
function Dock({ brand, t, s, qrUrl, size, qrZone, qrLabel }: { brand: AfficheBrand; t: AfficheTheme; s: number; qrUrl: string | null; size: number; qrZone: number; qrLabel?: string }) {
  const phone = brand.phoneDisplay || '📲 Escríbenos';
  // Contraste radical: tema oscuro → tarjeta blanca pura; tema claro → ónix.
  const cardBg = t.light ? '#0b0f18' : '#ffffff';
  const ink = t.light ? '#ffffff' : '#0f172a';
  const inkSoft = t.light ? 'rgba(255,255,255,0.72)' : 'rgba(15,23,42,0.62)';
  const waText = t.light ? '#eafff6' : '#022c22';
  // WhatsApp con mínimo garantizado de 32px reales en el PNG 1080p:
  // 16px en el lienzo de 540px = 32px reales en AMBOS formatos.
  const waFont = 16 * Math.max(1, s);
  const qrPad = 7 * s;
  return (
    <div
      style={{
        background: cardBg,
        borderRadius: 18 * s,
        position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        padding: 0,
        boxShadow: '0 10px 30px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(148,163,184,0.25)',
      }}
    >
      {/* Filete superior de acento de color */}
      <div style={{ height: 6 * s, flexShrink: 0, background: `linear-gradient(90deg, ${t.accent}, ${t.accent2}, ${t.accent})` }} />
      {/* Cuerpo: información + separador perforado + QR */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'stretch', gap: 0, padding: `${10 * s}px ${12 * s}px 0` }}>
        {/* Columna izquierda: rubro · negocio gigante · ubicación */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 5 * s, paddingRight: 10 * s }}>
          <p
            style={{
              margin: 0, alignSelf: 'flex-start',
              background: t.light ? 'rgba(255,255,255,0.12)' : `${t.accent2}1f`,
              border: `1px solid ${t.accent2}55`,
              color: t.light ? t.accent2 : '#92400e',
              borderRadius: 6 * s,
              padding: `${3 * s}px ${9 * s}px`,
              fontSize: 10 * s, fontWeight: 900, letterSpacing: 1.6, textTransform: 'uppercase',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
            }}
          >
            {(brand.slogan || 'ATENCIÓN INMEDIATA').toUpperCase()}
          </p>
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                fontFamily: `"${t.font}", system-ui, sans-serif`,
                fontSize: 28 * s, fontWeight: 900, color: ink, lineHeight: 1.02,
                letterSpacing: -0.5,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}
            >
              {brand.name || 'Tu Negocio'}
            </p>
            <p style={{ margin: 0, marginTop: 3 * s, fontSize: 12 * s, fontWeight: 700, color: inkSoft, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {brand.address || brand.municipality || 'Gachetá'}
            </p>
          </div>
        </div>
        {/* Separador perforado estilo billete de avión */}
        <div style={{ width: 0, flexShrink: 0, position: 'relative', borderLeft: `2px dashed ${t.light ? 'rgba(255,255,255,0.30)' : 'rgba(15,23,42,0.22)'}` }}>
          {/* Muescas semicirculares en los extremos (clipeadas por el borde
              de la tarjeta, como en un billete real de embarque) */}
          <span
            style={{
              position: 'absolute', top: -9 * s, left: 0, transform: 'translateX(-50%)',
              width: 18 * s, height: 18 * s, borderRadius: '50%',
              background: cardBg,
              boxShadow: `inset 0 0 0 ${1.5 * s}px ${t.light ? 'rgba(255,255,255,0.18)' : 'rgba(15,23,42,0.14)'}`,
            }}
          />
          <span
            style={{
              position: 'absolute', bottom: -9 * s, left: 0, transform: 'translateX(-50%)',
              width: 18 * s, height: 18 * s, borderRadius: '50%',
              background: cardBg,
              boxShadow: `inset 0 0 0 ${1.5 * s}px ${t.light ? 'rgba(255,255,255,0.18)' : 'rgba(15,23,42,0.14)'}`,
            }}
          />
        </div>
        {/* Zona derecha: QR gigante sobre blanco puro (≥45% del ancho del dock) */}
        {qrUrl && (
          <div
            style={{
              width: qrZone, flexShrink: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 * s,
            }}
          >
            <div
              style={{
                background: '#ffffff',
                borderRadius: 10 * s,
                padding: qrPad,
                border: `2px solid ${t.accent2}`,
                boxShadow: `0 0 ${14 * s}px ${t.accent2}55`,
              }}
            >
              <img src={qrUrl} alt="QR" style={{ width: size, height: size, display: 'block' }} />
            </div>
            <p style={{ margin: 0, fontSize: 10.5 * s, fontWeight: 900, letterSpacing: 0.8, color: inkSoft, whiteSpace: 'nowrap' }}>
              {qrLabel || 'ESCANEA AQUÍ'}
            </p>
          </div>
        )}
      </div>
      {/* Barra inferior de ancho completo: WhatsApp en ≥32px reales */}
      <div style={{ flexShrink: 0, padding: `${8 * s}px ${12 * s}px ${10 * s}px` }}>
        <div
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'linear-gradient(90deg, #059669, #34d399)',
            color: waText,
            borderRadius: 12 * s,
            padding: `${8 * s}px ${12 * s}px`,
            fontSize: waFont, fontWeight: 900, letterSpacing: 0.2,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 * s,
            boxShadow: `0 0 ${22 * s}px rgba(16,185,129,0.45)`,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}
        >
          <span style={{ flexShrink: 0 }}>💬</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{phone}</span>
        </div>
      </div>
    </div>
  );
}

/** Sticker rotado tipo etiqueta promocional. */
function Sticker({ text, s, bg = '#fde047', color = '#111827', rotate = -3 }: { text: string; s: number; bg?: string; color?: string; rotate?: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <span
        style={{
          background: bg, color,
          transform: `rotate(${rotate}deg)`,
          borderRadius: 999,
          padding: `${11 * s}px ${22 * s}px`,
          fontSize: 15 * s, fontWeight: 900,
          display: 'inline-block',
          boxShadow: '0 10px 24px rgba(0,0,0,0.35)',
          whiteSpace: 'nowrap',
        }}
      >
        {text}
      </span>
    </div>
  );
}

/**
 * Artboard principal V12:
 *  · Pieza 1 → la arquitectura elegida entre las 16 (afiche maestro).
 *  · Pieza 2 → portada de impacto viral full-bleed (pregunta gancho 44px).
 *  · Pieza 3 → infografía VIP numerada 01 / 02 / 03 con cinta de garantía.
 *  · Pieza 4 → tarjeta ejecutiva de cierre con QR GIGANTE central de 220px.
 */
export function AfficheArtboard(props: AfficheProps): React.ReactElement {
  const { themeId, layout, format, piece, brand, texts, badge, showPrice, showBenefits, showQr, photoUrl, qrUrl, photoZoom, photoPosY, qrLabel, qrHint, fontStyle, headlineScale, photoUrl2, photoUrl3, photoUrl4 } = props;
  /** 🔍 V18: escala del titular leída del slider (default 1 = tamaño base). */
  const hs = headlineScale ?? 1;
  /** 🖼️ V19: cada pieza recibe su PROPIA fotografía (si no hay, cae a la maestra). */
  const photo2 = photoUrl2 ?? photoUrl;
  const photo3 = photoUrl3 ?? photoUrl;
  const photo4 = photoUrl4 ?? photoUrl;
  const t = AFFICHE_THEMES.find((x) => x.id === themeId) ?? AFFICHE_THEMES[1];
  const s = format === 'square' ? 0.58 : 1;
  const W = 540;
  const H = format === 'square' ? 540 : 960;
  const g = glass(t);
  // V14: contenido desde 16px del borde — CERO hueco muerto arriba.
  const pad = 16 * s;
  const benefits = texts.benefits.filter(Boolean);
  const priceOverlay = showPrice && brand.promoPrice != null && piece === 0;
  const priceLabel = texts.cta.trim();
  const isService = brand.promoPrice == null;

  // V13: la ventana fotográfica NUNCA supera el 42% del lienzo — el titular
  // y los beneficios tienen siempre espacio monumental garantizado.
  const PHOTO_MAX = 400 * s;

  // Tamaños del dock según la pieza (piezas 2/3 tienen QR dedicado).
  // 🎯 V20/V21 · QR PROTAGONISTA y DOCK "TARJETA DE EMBARQUE":
  //  · story (s=1): QR 226px lienzo = 452px PNG 1080p, zona QR = 244px lienzo
  //    (≈47% del ancho del dock, ≥45% exigido) · WhatsApp 32px reales.
  //  · square (s=0.58): QR 276px escalados = 160px lienzo = 320px PNG.
  //  · Alturas con holgura verificada: story 332 · square 400 (escalados).
  //  · El fondo es SÓLIDO y contrastante (blanco puro u ónix) para escaneo perfecto.
  const isSquare = format === 'square';
  const dockQrSize = (isSquare ? 276 : 226) * s;
  const dockHeight = (isSquare ? 400 : 332) * s;
  const dockQrZone = (isSquare ? 300 : 244) * s;

  const photoBlock = (extra?: CSSProperties): React.ReactElement => (
    <div
      style={{
        flex: 1, minHeight: 0, maxHeight: PHOTO_MAX, position: 'relative',
        borderRadius: 26 * s,
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

  /** Bloque de contenido estándar: subtítulo + beneficios + CTA. */
  const contentBlocks = (align: 'center' | 'left' = 'center', pills = false): React.ReactElement => (
    <>
      <SubHead text={texts.sub} t={t} s={s} align={align} />
      {showBenefits && benefits.length > 0 && (pills
        ? <BenefitPills items={benefits} t={t} s={s} />
        : <BenefitCards items={benefits} t={t} s={s} />)}
      {isService && priceLabel
        ? <CtaButton label={priceLabel} s={s} bg={t.accent2} color={t.light ? '#ffffff' : '#0b0f18'} />
        : null}
    </>
  );

  /** Dock estándar de la pieza maestra (Tarjeta de Embarque V21). */
  const masterDock = showQr ? (
    <div style={{ height: dockHeight }}>
      <Dock brand={brand} t={t} s={s} qrUrl={qrUrl} size={dockQrSize} qrZone={dockQrZone} qrLabel={qrLabel} />
    </div>
  ) : null;

  // ═══ PIEZA 2 · 🔥 AFICHE GANCHO VIRAL V14 (scroll-stopper de alto impacto: ═══
  // ═══ cinta de alerta + gancho colosal + foto spotlight con burbujas + ═══
  // ═══ comparativa ❌/✅ + barra de acción con QR grande) ═══
  if (piece === 1) {
    const qr2 = 96 * s; // 192×192px en el PNG 1080p
    const bA = splitBenefit(benefits[0] ?? 'Calidad garantizada');
    const bB = splitBenefit(benefits[1] ?? 'Atención inmediata');
    const bC = splitBenefit(benefits[2] ?? 'Cerca de ti');
    const bubbleCls = (tilt: number): CSSProperties => ({
      flex: 1, minWidth: 0,
      background: 'rgba(255,255,255,0.95)', color: '#0f172a',
      borderRadius: 999,
      padding: `${7 * s}px ${12 * s}px`,
      display: 'flex', alignItems: 'center', gap: 7 * s,
      boxShadow: '0 10px 26px rgba(0,0,0,0.42)',
      transform: `rotate(${tilt}deg)`,
    });
    return (
      <div
        style={{
          width: W, height: H, flexShrink: 0, position: 'relative',
          background: 'linear-gradient(165deg, #160a10, #2b0510 52%, #0b0d10)',
          color: '#ffffff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          borderRadius: 22 * s, overflow: 'hidden',
        }}
      >
        {/* Halo del acento del tema para mantener la identidad de la campaña */}
        <div
          style={{
            position: 'absolute', inset: 0,
            background:
              `radial-gradient(340px 220px at 82% 10%, ${t.accent}33, transparent 62%),` +
              `radial-gradient(300px 200px at 10% 90%, ${t.accent2}2a, transparent 62%)`,
          }}
        />
        <div style={{ position: 'relative', width: '100%', height: '100%', padding: pad, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 9 * s }}>
          {/* Cinta superior de alerta viral */}
          <div
            style={{
              flexShrink: 0,
              background: 'linear-gradient(90deg, #dc2626, #f97316 55%, #facc15)',
              color: '#160b04',
              borderRadius: 10 * s,
              padding: `${7 * s}px ${9 * s}px`,
              textAlign: 'center',
              boxShadow: '0 8px 22px rgba(220,38,38,0.45)',
            }}
          >
            <p style={{ margin: 0, fontSize: 11.5 * s, fontWeight: 900, letterSpacing: 0.6, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Atención {(brand.municipality || 'Gachetá').toUpperCase()} · Lo más buscado hoy
            </p>
          </div>
          {/* Pregunta / gancho polémico colosal */}
          <p
            style={{
              margin: 0, flexShrink: 0,
              fontFamily: `"${t.font}", system-ui, sans-serif`,
              fontSize: 27 * s, lineHeight: 1.06, fontWeight: 900,
              textTransform: 'uppercase', textAlign: 'center',
              color: '#ffffff', textShadow: '0 4px 22px rgba(0,0,0,0.6)',
            }}
          >
            {texts.hook.trim() || `${texts.plain.trim()} ${texts.highlight.trim()}`.toUpperCase()}
          </p>
          {/* Fotografía en spotlight con precio flotante (🖼️ V19 · foto #2 propia de esta pieza) */}
          <div style={{ position: 'relative', flex: 1, minHeight: 0, borderRadius: 18 * s, overflow: 'hidden', boxShadow: '0 16px 40px rgba(0,0,0,0.5)' }}>
            <Photo url={photo2} zoom={photoZoom} posY={photoPosY} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(6,8,14,0.25) 0%, transparent 30%, transparent 70%, rgba(6,8,14,0.45) 100%)' }} />
            {showPrice && brand.promoPrice != null && (
              <div style={{ position: 'absolute', bottom: 10 * s, left: 10 * s }}>
                <PricePill brand={brand} t={t} s={s} />
              </div>
            )}
          </div>
          {/* 2 burbujas flotantes tipo notificación de redes sociales (🎯 V20: iconos vectoriales) */}
          <div style={{ display: 'flex', gap: 8 * s, flexShrink: 0 }}>
            <div style={bubbleCls(-2)}>
              <GlyphIcon kind={3} size={14 * s} color="#0f766e" />
              <span style={{ fontSize: 10.5 * s, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>+100 clientes satisfechos</span>
            </div>
            <div style={bubbleCls(2)}>
              <GlyphIcon kind={0} size={14 * s} color="#b45309" />
              <span style={{ fontSize: 10.5 * s, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Calificación 5.0 en atención</span>
            </div>
          </div>
          {/* Cuadro comparativo: ❌ Antes/Otros vs ✅ Con el negocio */}
          <div style={{ display: 'flex', gap: 8 * s, flexShrink: 0 }}>
            <div style={{ flex: 1, minWidth: 0, borderRadius: 14 * s, padding: `${10 * s}px ${11 * s}px`, background: 'rgba(127,29,29,0.38)', border: '1px solid rgba(248,113,113,0.45)' }}>
              <p style={{ margin: 0, fontSize: 11.5 * s, fontWeight: 900, color: '#fca5a5', marginBottom: 5 * s }}>❌ SIN ESTRATEGIA</p>
              <p style={{ margin: 0, fontSize: 11 * s, fontWeight: 700, lineHeight: 1.35, color: 'rgba(255,255,255,0.88)' }}>
                Búsqueda eterna, precios que suben y servicio que no responde.
              </p>
            </div>
            <div style={{ flex: 1, minWidth: 0, borderRadius: 14 * s, padding: `${10 * s}px ${11 * s}px`, background: 'rgba(6,78,59,0.52)', border: `1.5px solid ${t.accent2}` }}>
              <p style={{ margin: 0, fontSize: 11.5 * s, fontWeight: 900, color: '#6ee7b7', marginBottom: 5 * s }}>✅ CON {(brand.name || 'NOSOTROS').slice(0, 22).toUpperCase()}</p>
              <p style={{ margin: 0, fontSize: 11 * s, fontWeight: 700, lineHeight: 1.35, color: '#ffffff' }}>
                {bA.body} · {bB.body} · {bC.body}
              </p>
            </div>
          </div>
          {/* Barra inferior de acción + QR grande */}
          {showQr && (
            <div
              style={{
                flexShrink: 0,
                display: 'flex', alignItems: 'center', gap: 10 * s,
                background: 'rgba(6,8,14,0.80)',
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: 16 * s,
                padding: `${9 * s}px ${11 * s}px`,
              }}
            >
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 * s }}>
                <p style={{ margin: 0, fontSize: 11.5 * s, fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {brand.name || 'Tu Negocio'} · 📍 {brand.address || brand.municipality || 'Gachetá'}
                </p>
                <div
                  style={{
                    background: '#16a34a', color: '#ffffff',
                    borderRadius: 999,
                    padding: `${8 * s}px ${14 * s}px`,
                    fontSize: 14 * s, fontWeight: 900,
                    alignSelf: 'flex-start',
                    boxShadow: '0 8px 20px rgba(22,163,74,0.5)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  💬 {brand.phoneDisplay || 'Escríbenos ya'}
                </div>
              </div>
              {qrUrl && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 * s, flexShrink: 0 }}>
                  <div style={{ background: '#ffffff', borderRadius: 9 * s, padding: 5 * s, boxShadow: '0 4px 14px rgba(0,0,0,0.4)' }}>
                    <img src={qrUrl} alt="QR" style={{ width: qr2, height: qr2, display: 'block' }} />
                  </div>
                  <p style={{ margin: 0, fontSize: 9 * s, fontWeight: 800, letterSpacing: 0.5, color: 'rgba(255,255,255,0.92)' }}>
                    {qrLabel || '📱 ESCANEA AQUÍ'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═══ PIEZA 3 · 📊 INFOGRAFÍA VIP DE VALOR V14 (bento denso: banner con ═══
  // ═══ medidor circular 100% + 3 tarjetas 01/02/03 con número gradiente e ═══
  // ═══ icono 3D + cinta de garantía + proceso 3 pasos + dock WA + QR) ═══
  if (piece === 2) {
    const qr3 = 88 * s; // 176×176px en el PNG 1080p
    const steps = ['1️⃣ Escríbenos', '2️⃣ Aparta / Cotiza', '3️⃣ Recibe y disfruta'];
    return (
      <div
        style={{
          width: W, height: H, flexShrink: 0, position: 'relative',
          background: t.bg, backgroundSize: t.bgSize ?? '100% 100%, 100% 100%, 100% 100%, 100% 100%',
          color: t.text,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          borderRadius: 22 * s, overflow: 'hidden',
        }}
      >
        {/* 🖼️ V19 · fondo escénico con la FOTO #3 propia de esta pieza */}
        <ScenicBg url={photo3} t={t} frame />
        <div style={{ position: 'relative', width: '100%', height: '100%', padding: pad, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 9 * s }}>
          {/* Banner fotográfico + medidor estadístico circular */}
          <div style={{ position: 'relative', height: 200 * s, borderRadius: 18 * s, overflow: 'hidden', flexShrink: 0, boxShadow: '0 14px 34px rgba(0,0,0,0.45)' }}>
            <Photo url={photo3} zoom={photoZoom} posY={photoPosY} />
            <div style={{ position: 'absolute', inset: 0, background: t.light ? 'linear-gradient(180deg, transparent 40%, rgba(15,23,42,0.5) 100%)' : 'linear-gradient(180deg, transparent 40%, rgba(8,10,18,0.66) 100%)' }} />
            <div style={{ position: 'absolute', bottom: 11 * s, left: 13 * s, right: 110 * s }}>
              <p style={{ margin: 0, fontSize: 10.5 * s, fontWeight: 900, letterSpacing: 1.4, textTransform: 'uppercase', color: '#fde68a', textShadow: '0 2px 6px rgba(0,0,0,0.8)' }}>
                {`LO QUE HACEMOS POR TI EN ${(brand.address || brand.municipality || 'Gachetá').toUpperCase()}`}
              </p>
              <p style={{ margin: 0, fontFamily: `"${t.font}", system-ui, sans-serif`, fontSize: 26 * s, fontWeight: 900, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: '0 3px 12px rgba(0,0,0,0.85)' }}>
                {brand.name || 'Tu Negocio'}
              </p>
            </div>
            {/* Medidor circular: 100% CALIDAD Y CUMPLIMIENTO */}
            <div
              style={{
                position: 'absolute', top: 10 * s, right: 10 * s,
                width: 92 * s, height: 92 * s, borderRadius: '50%',
                background: `conic-gradient(${t.accent2} 0deg 300deg, ${t.accent} 300deg 360deg)`,
                boxShadow: '0 10px 26px rgba(0,0,0,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 74 * s, height: 74 * s, borderRadius: '50%',
                  background: 'rgba(6,8,14,0.86)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 * s,
                  border: '1px solid rgba(255,255,255,0.25)',
                }}
              >
                <span style={{ margin: 0, fontFamily: `"${t.font}", system-ui, sans-serif`, fontSize: 19 * s, fontWeight: 900, color: t.accent2, lineHeight: 1 }}>100%</span>
                <span style={{ margin: 0, fontSize: 7.5 * s, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase', color: '#ffffff', textAlign: 'center', lineHeight: 1.2 }}>
                  Calidad y<br />cumplimiento
                </span>
              </div>
            </div>
          </div>
          {/* Cinta de garantía de satisfacción (🎯 V20 · sin emojis genéricos) */}
          <Sticker text="GARANTÍA DE SATISFACCIÓN O TE DEVOLVEMOS TU PLATA" s={s} bg={t.accent2} color={t.light ? '#ffffff' : '#0b0f18'} rotate={-1.5} />
          {/* 💎 V19/V20 · GRILLA MODULAR 2×2: 4 cajas de cristal iluminadas con
              numeración 01–04, iconos VECTORIALES y métricas de confianza */}
          <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 9 * s }}>
            {[0, 1, 2, 3].map((i) => {
              const b = benefits[i] ?? ['Calidad garantizada', 'Atención inmediata', 'Cerca de ti', 'Trato personalizado'][i] ?? '';
              const { body } = splitBenefit(b);
              const metric = ['Atención inmediata', '100% garantizado', 'Servicio verificado', 'Aquí mismo'][i];
              return (
                <div
                  key={i}
                  style={{
                    ...g.card,
                    borderRadius: 15 * s,
                    padding: `${10 * s}px ${11 * s}px`,
                    display: 'flex', flexDirection: 'column', gap: 4 * s,
                    position: 'relative', overflow: 'hidden', minHeight: 0,
                    boxShadow: t.light ? '0 2px 10px rgba(15,23,42,0.10)' : '0 6px 18px rgba(0,0,0,0.35)',
                  }}
                >
                  {/* Resplandor de acento por tarjeta */}
                  <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(120px 70px at 88% 6%, ${t.accent2}2e, transparent 70%)`, pointerEvents: 'none' }} />
                  <span
                    style={{
                      fontFamily: `"${t.font}", system-ui, sans-serif`,
                      fontSize: 21 * s, fontWeight: 900, lineHeight: 1,
                      background: `linear-gradient(180deg, ${t.accent}, ${t.accent2})`,
                      WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
                    }}
                  >
                    {`0${i + 1}`}
                  </span>
                  <span
                    style={{
                      width: 34 * s, height: 34 * s, flexShrink: 0,
                      borderRadius: 9 * s,
                      background: `linear-gradient(160deg, ${t.accent}3d, ${t.accent2}26)`,
                      border: '1px solid rgba(255,255,255,0.35)',
                      boxShadow: 'inset 0 2px 5px rgba(255,255,255,0.35), 0 4px 10px rgba(0,0,0,0.30)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <GlyphIcon kind={i} size={18 * s} color={t.accent2} />
                  </span>
                  <p style={{ margin: 0, fontSize: 13.5 * s, fontWeight: 900, color: t.text, lineHeight: 1.15, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {body}
                  </p>
                  <p style={{ margin: 0, marginTop: 'auto', fontSize: 9.5 * s, fontWeight: 900, letterSpacing: 0.4, textTransform: 'uppercase', color: t.light ? 'rgba(15,23,42,0.6)' : t.accent2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {metric}
                  </p>
                </div>
              );
            })}
          </div>
          {/* Proceso en 3 pasos iconográficos */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 * s, flexShrink: 0 }}>
            {steps.map((st, i) => (
              <span
                key={st}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6 * s,
                  fontSize: 11 * s, fontWeight: 800, color: t.text, whiteSpace: 'nowrap',
                }}
              >
                {st}
                {i < steps.length - 1 && <span style={{ color: t.accent2, fontWeight: 900 }}>→</span>}
              </span>
            ))}
          </div>
          {/* Dock inferior: WhatsApp grande + QR del destino elegido */}
          {showQr && (
            <div style={{ ...g.card, borderRadius: 16 * s, display: 'flex', alignItems: 'center', gap: 10 * s, padding: `${8 * s}px ${11 * s}px`, flexShrink: 0 }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 * s }}>
                <p style={{ margin: 0, fontSize: 12 * s, fontWeight: 900, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  💬 {brand.phoneDisplay || 'Escríbenos hoy'}
                </p>
                <p style={{ margin: 0, fontSize: 10.5 * s, fontWeight: 700, color: t.light ? 'rgba(15,23,42,0.65)' : t.sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  📍 {brand.address || brand.municipality || 'Gachetá'} · {brand.name || 'Tu Negocio'}
                </p>
                <div
                  style={{
                    background: '#16a34a', color: '#ffffff',
                    borderRadius: 999,
                    padding: `${7 * s}px ${13 * s}px`,
                    fontSize: 12.5 * s, fontWeight: 900,
                    alignSelf: 'flex-start',
                    boxShadow: '0 6px 16px rgba(22,163,74,0.45)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ESCRÍBENOS POR WHATSAPP
                </div>
              </div>
              {qrUrl && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 * s, flexShrink: 0 }}>
                  <div style={{ background: '#ffffff', borderRadius: 8 * s, padding: 4 * s, boxShadow: '0 4px 12px rgba(0,0,0,0.35)' }}>
                    <img src={qrUrl} alt="QR" style={{ width: qr3, height: qr3, display: 'block' }} />
                  </div>
                  <p style={{ margin: 0, fontSize: 8.5 * s, fontWeight: 800, letterSpacing: 0.4, color: t.light ? 'rgba(15,23,42,0.75)' : 'rgba(255,255,255,0.9)', whiteSpace: 'nowrap' }}>
                    {qrLabel || '📱 ESCANEA AQUÍ'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═══ PIEZA 4 · 📲 CIERRE VIP & CONTACTO DIRECTO (🖼️ V19: foto en ═══
  // ═══ MEDALLÓN CIRCULAR con doble anillo de luz neón + badge de ubicación ═══
  // ═══ + MEGA-QR CENTRAL 310px = 620px en el PNG 1080p + destino elegido) ═══
  if (piece === 3) {
    const qrBig = 310 * s; // 620×620px en el PNG 1080p
    const medallion = 170 * s;
    return (
      <div
        style={{
          width: W, height: H, flexShrink: 0, position: 'relative',
          background: t.bg, backgroundSize: t.bgSize ?? '100% 100%, 100% 100%, 100% 100%, 100% 100%',
          color: t.text,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          borderRadius: 22 * s, overflow: 'hidden',
        }}
      >
        <ScenicBg url={photo4} t={t} frame />
        <div style={{ position: 'relative', width: '100%', height: '100%', padding: pad, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 * s }}>
          {/* 🖼️ V19 · FOTO en MEDALLÓN circular con doble anillo de luz neón */}
          <div
            style={{
              position: 'relative', width: medallion, height: medallion, flexShrink: 0,
              borderRadius: '50%',
              background: `conic-gradient(from 30deg, ${t.accent2}, ${t.accent}, ${t.accent2}, ${t.accent})`,
              padding: 6 * s,
              boxShadow: `0 0 ${30 * s}px ${t.accent2}88, 0 14px 34px rgba(0,0,0,0.5)`,
            }}
          >
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', padding: 5 * s, background: 'rgba(255,255,255,0.92)', boxShadow: 'inset 0 0 12px rgba(0,0,0,0.25)' }}>
              <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden' }}>
                <Photo url={photo4} zoom={photoZoom} posY={photoPosY} />
              </div>
            </div>
          </div>
          {/* Badge de ubicación */}
          <div style={{ ...g.chip, borderRadius: 999, padding: `${7 * s}px ${16 * s}px`, fontSize: 12 * s, fontWeight: 900, letterSpacing: 0.8, textTransform: 'uppercase', whiteSpace: 'nowrap', flexShrink: 0 }}>
            📍 Encuéntranos en {brand.address || brand.municipality || 'Gachetá'}
          </div>
          <Headline texts={ht('ESCANEA EL CÓDIGO', 'Y TE ATENDEMOS YA')} t={t} s={s} size={34} styleId={fontStyle} scale={hs} />
          {/* QR CENTRAL GIGANTE sobre tarjeta blanca con marco brillante */}
          {qrUrl && (
            <div
              style={{
                background: '#ffffff',
                borderRadius: 20 * s,
                padding: `${10 * s}px`,
                border: `4px solid ${t.accent2}`,
                boxShadow: `0 0 0 ${3 * s}px ${t.accent}, 0 18px 44px rgba(0,0,0,0.5)`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 * s,
                flexShrink: 0,
              }}
            >
              <img src={qrUrl} alt="QR" style={{ width: qrBig, height: qrBig, display: 'block' }} />
              <p style={{ margin: 0, fontSize: 12.5 * s, fontWeight: 900, letterSpacing: 0.6, color: '#0f172a', textAlign: 'center' }}>
                {qrLabel || '📱 ESCANEA AQUÍ'}
              </p>
            </div>
          )}
          {/* Indicador del destino elegido en el studio */}
          <p style={{ margin: 0, fontSize: 14 * s, fontWeight: 800, color: t.text, textAlign: 'center' }}>
            {qrHint || 'Escanea para ir a nuestro WhatsApp'}
          </p>
          {/* Botón de WhatsApp grande */}
          <div
            style={{
              background: '#16a34a', color: '#ffffff',
              borderRadius: 999,
              padding: `${12 * s}px ${24 * s}px`,
              fontSize: 18 * s, fontWeight: 900,
              display: 'flex', alignItems: 'center', gap: 8 * s,
              boxShadow: '0 10px 26px rgba(22,163,74,0.5)',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            💬 {brand.phoneDisplay || 'Escríbenos ahora'}
          </div>
          <p style={{ margin: 0, fontSize: 11 * s, fontWeight: 700, color: t.light ? 'rgba(15,23,42,0.6)' : t.sub, textAlign: 'center' }}>
            {brand.name || 'Tu Negocio'} · {(brand.slogan || 'ATENCIÓN INMEDIATA').toUpperCase()}
          </p>
        </div>
      </div>
    );
  }

  // ═══ PIEZA 1 · 🏆 AFICHE MAESTRO (la arquitectura elegida de las 16) ═══
  let body: React.ReactElement;
  switch (layout) {
    case 'magazine': {
      // 📸 Vogue / Forbes: foto 100% de fondo + tipografía gigante superpuesta.
      body = (
        <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 22 * s, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0 }}>
            <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
          </div>
          <div
            style={{
              position: 'absolute', inset: 0,
              background: t.light
                ? 'linear-gradient(180deg, rgba(0,0,0,0.10) 26%, rgba(8,10,18,0.74) 68%, rgba(8,10,18,0.94) 100%)'
                : 'linear-gradient(180deg, rgba(0,0,0,0.20) 20%, rgba(8,10,18,0.64) 58%, rgba(8,10,18,0.92) 100%)',
            }}
          />
          <div style={{ position: 'absolute', top: pad, left: 0, right: 0 }}>
            <Badge text={badge} t={t} s={s} />
          </div>
          <div style={{ position: 'absolute', left: pad, right: pad, bottom: pad, display: 'flex', flexDirection: 'column', gap: 12 * s }}>
            <Headline texts={texts} t={{ ...t, text: '#ffffff' }} s={s} size={46} align="center" styleId={fontStyle} scale={hs} />
            <div style={{ color: '#ffffff' }}>
              <SubHead text={texts.sub} t={t} s={s} color="rgba(255,255,255,0.92)" />
              {showBenefits && benefits.length > 0 && <div style={{ marginTop: 10 * s }}><BenefitPills items={benefits} t={t} s={s} /></div>}
              {isService && priceLabel && <div style={{ marginTop: 10 * s }}><CtaButton label={priceLabel} s={s} bg={t.accent2} color="#ffffff" /></div>}
            </div>
            {showQr && <Dock brand={{ ...brand }} t={{ ...t, light: false, text: '#ffffff', sub: 'rgba(255,255,255,0.8)' }} s={s} qrUrl={qrUrl} size={dockQrSize} qrZone={dockQrZone} qrLabel={qrLabel} />}
          </div>
        </div>
      );
      break;
    }
    case 'diagonal': {
      // ⚡ V14 · CORTE DIAGONAL FULL-BLEED: la foto nace del borde superior
      // (cero hueco negro), ocupa el 48% del lienzo cortada con ángulo dinámico
      // `polygon(0 0, 100% 0, 100% 80%, 0 100%)`, franja luminosa diagonal y
      // sello flotando sobre el corte.
      body = (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          {/* Foto full-bleed superior cortada en diagonal (desde el borde real) */}
          <div
            style={{
              position: 'absolute', top: -pad, left: -pad, right: -pad,
              height: '48%',
              clipPath: 'polygon(0 0, 100% 0, 100% 80%, 0 100%)',
              overflow: 'hidden',
            }}
          >
            <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(6,8,14,0.30) 0%, transparent 28%, transparent 58%, rgba(6,8,14,0.44) 100%)' }} />
          </div>
          {/* Insignia flotando sobre la foto (a 16px del borde superior) */}
          <div style={{ position: 'absolute', top: pad, left: 0, right: 0 }}>
            <Badge text={badge} t={t} s={s} />
          </div>
          {/* Franja luminosa diagonal sobre el corte */}
          <div
            style={{
              position: 'absolute', top: `calc(48% - ${10 * s}px)`, left: -pad, right: -pad,
              height: 7 * s,
              background: `linear-gradient(90deg, ${t.accent}, ${t.accent2})`,
              transform: 'rotate(-1.6deg)',
              borderRadius: 999,
              boxShadow: `0 8px 26px ${t.accent}77`,
              zIndex: 3,
            }}
          />
          {/* Sello de precio flotando sobre el corte */}
          {priceOverlay && (
            <div style={{ position: 'absolute', top: `calc(48% - ${68 * s}px)`, right: 2 * s, transform: 'rotate(3deg)', zIndex: 4 }}>
              <PricePill brand={brand} t={t} s={s} big />
            </div>
          )}
          {/* Contenido inferior */}
          <div style={{ position: 'absolute', top: '48%', left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', gap: 8 * s, overflow: 'hidden' }}>
            <Headline texts={texts} t={t} s={s} size={44} align="center" styleId={fontStyle} scale={hs} />
            {format === 'story' && <SubHead text={texts.sub} t={t} s={s} align="center" />}
            {showBenefits && benefits.length > 0 && <BenefitPills items={benefits} t={t} s={s} />}
            {isService && priceLabel && <CtaButton label={priceLabel} s={s} bg={t.accent2} color={t.light ? '#ffffff' : '#0b0f18'} />}
            {masterDock}
          </div>
        </div>
      );
      break;
    }
    case 'polaroid': {
      // 🖼️ Polaroid 3D Studio: marco blanco rotado -2.5° con sticker.
      const fw = 330 * s;
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 * s, height: '100%' }}>
          <Badge text={badge} t={t} s={s} />
          <div style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
            <div
              style={{
                width: fw,
                transform: 'rotate(-2.5deg)',
                background: '#fdfdf8',
                borderRadius: 12 * s,
                padding: 12 * s,
                boxShadow: '0 20px 44px rgba(0,0,0,0.48)',
                display: 'flex', flexDirection: 'column', gap: 8 * s,
              }}
            >
              <div style={{ height: 240 * s, borderRadius: 6 * s, overflow: 'hidden' }}>
                <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
              </div>
              <p style={{ margin: 0, fontSize: 13 * s, fontWeight: 700, color: '#1f2937', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {(texts.sub.trim() || brand.product).slice(0, 46)}
              </p>
            </div>
            {priceOverlay && (
              <div style={{ position: 'absolute', bottom: -8 * s, right: 30 * s, transform: 'rotate(4deg)' }}>
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
    case 'arc': {
      // 🏛️ Arco Imperial: ventana en arco con doble filete dorado/neón.
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 * s, height: '100%' }}>
          <Badge text={badge} t={t} s={s} />
          <div
            style={{
              flex: 1, minHeight: 0, maxHeight: PHOTO_MAX, position: 'relative',
              borderRadius: `270px 270px ${24 * s}px ${24 * s}px`,
              border: `3px solid ${t.accent2}`,
              boxShadow: `0 0 0 6px ${t.light ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.10)'}, 0 14px 34px rgba(0,0,0,0.40)`,
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
          <Headline texts={texts} t={t} s={s} size={46} align="center" styleId={fontStyle} scale={hs} />
          {contentBlocks('center')}
          {masterDock}
        </div>
      );
      break;
    }
    case 'portal': {
      // 🎯 Radar Circular Neón: medallón con anillos concéntricos luminosos.
      const d = 250 * s;
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 * s, height: '100%' }}>
          <Badge text={badge} t={t} s={s} />
          <div style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: d + 64 * s, height: d + 64 * s, borderRadius: '50%', border: `1px solid ${t.accent2}55` }} />
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: d + 34 * s, height: d + 34 * s, borderRadius: '50%', border: `2px dashed ${t.accent}66` }} />
            <div style={{ position: 'relative', width: d + 26 * s, height: d + 26 * s }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid ${t.accent2}`, boxShadow: `0 0 26px ${t.accent}55` }} />
              <div style={{ position: 'absolute', inset: 10 * s, borderRadius: '50%', overflow: 'hidden', border: `3px solid ${t.accent2}` }}>
                <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
              </div>
              {priceOverlay && (
                <div style={{ position: 'absolute', bottom: -6 * s, right: -4 * s }}>
                  <PricePill brand={brand} t={t} s={s} />
                </div>
              )}
            </div>
          </div>
          <Headline texts={texts} t={t} s={s} size={46} align="center" styleId={fontStyle} scale={hs} />
          {contentBlocks('center', true)}
          {masterDock}
        </div>
      );
      break;
    }
    case 'swiss': {
      // 📐 Swiss Grid Minimal: retícula de precisión 1px, tipografía potente.
      const line = t.light ? 'rgba(15,23,42,0.22)' : 'rgba(255,255,255,0.25)';
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 * s, height: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${line}`, paddingBottom: 8 * s }}>
            <Badge text={badge} t={t} s={s} />
            <span style={{ fontFamily: `"${t.font}", system-ui, sans-serif`, fontSize: 20 * s, fontWeight: 900, color: t.accent }}>1/1</span>
          </div>
          <div style={{ flex: 1, minHeight: 0, maxHeight: PHOTO_MAX, position: 'relative', border: `1px solid ${line}`, borderRadius: 8 * s, overflow: 'hidden' }}>
            <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
            {priceOverlay && (
              <div style={{ position: 'absolute', bottom: 12 * s, right: 12 * s }}>
                <PricePill brand={brand} t={t} s={s} />
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 * s }}>
            <span style={{ fontFamily: `"${t.font}", system-ui, sans-serif`, fontSize: 34 * s, fontWeight: 900, color: t.accent }}>01</span>
            <div style={{ flex: 1 }}><Headline texts={texts} t={t} s={s} size={44} align="left" styleId={fontStyle} scale={hs} /></div>
          </div>
          {contentBlocks('left')}
          {masterDock}
        </div>
      );
      break;
    }
    case 'split': {
      // 🔥 Split Asimétrico 50/50: columna de acento + texto vertical.
      body = (
        <div style={{ display: 'flex', gap: 12 * s, height: '100%' }}>
          <div
            style={{
              width: 64 * s, borderRadius: 16 * s, flexShrink: 0,
              background: `linear-gradient(180deg, ${t.accent}, ${t.accent2})`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: `${14 * s}px 0`,
            }}
          >
            <span style={{ fontFamily: `"${t.font}", system-ui, sans-serif`, fontSize: 30 * s, fontWeight: 900, color: t.light ? '#0b0f18' : '#0b0f18', transform: 'rotate(90deg)', whiteSpace: 'nowrap', letterSpacing: 2 }}>
              {(brand.slogan || 'IMPULSO HOY').slice(0, 18).toUpperCase()}
            </span>
            <span style={{ fontFamily: `"${t.font}", system-ui, sans-serif`, fontSize: 22 * s, fontWeight: 900, color: t.light ? '#0b0f18' : '#0b0f18' }}>★</span>
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 * s }}>
            <Badge text={badge} t={t} s={s} />
            <div style={{ flex: 1, minHeight: 0, maxHeight: PHOTO_MAX, borderRadius: 20 * s, overflow: 'hidden', position: 'relative' }}>
              <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
              {priceOverlay && (
                <div style={{ position: 'absolute', bottom: 12 * s, right: 12 * s }}>
                  <PricePill brand={brand} t={t} s={s} />
                </div>
              )}
            </div>
            <Headline texts={texts} t={t} s={s} size={42} align="left" styleId={fontStyle} scale={hs} />
            {contentBlocks('left')}
            {masterDock}
          </div>
        </div>
      );
      break;
    }
    case 'brutal': {
      // 💥 Neobrutalismo Pop Viral: bordes negros 3px + sombras duras 6px.
      const hard: CSSProperties = { border: `3px solid ${t.light ? '#111827' : '#ffffff'}`, boxShadow: `6px 6px 0 ${t.light ? '#111827' : 'rgba(0,0,0,0.6)'}`, borderRadius: 12 * s };
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 * s, height: '100%' }}>
          <div style={{ ...hard, background: t.accent2, alignSelf: 'center', padding: `${8 * s}px ${18 * s}px`, transform: 'rotate(-1.5deg)' }}>
            <span style={{ fontFamily: `"${t.font}", system-ui, sans-serif`, fontSize: 13 * s, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1, color: t.light ? '#111827' : '#0b0f18' }}>{badge.trim() || '¡NUEVO!'}</span>
          </div>
          <div style={{ ...hard, flex: 1, minHeight: 0, overflow: 'hidden', background: '#ffffff' }}>
            <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
          </div>
          <div style={{ ...hard, background: '#ffffff', padding: `${12 * s}px ${16 * s}px` }}>
            <Headline texts={texts} t={{ ...t, text: '#111827', accent: '#111827', accent2: t.accent2 }} s={s} size={46} align="center" styleId={fontStyle} scale={hs} />
          </div>
          <div style={{ ...hard, background: t.light ? 'rgba(255,255,255,0.85)' : '#ffffff', padding: `${12 * s}px ${16 * s}px`, display: 'flex', flexDirection: 'column', gap: 8 * s }}>
            <SubHead text={texts.sub} t={{ ...t, text: '#111827', sub: '#3f3f46' }} s={s} align="center" />
            {showBenefits && benefits.length > 0 && <BenefitCards items={benefits} t={{ ...t, light: true, text: '#111827' }} s={s} />}
            {isService && priceLabel && <CtaButton label={priceLabel} s={s} bg="#111827" color="#ffffff" />}
          </div>
          {showQr && (
            <div style={{ height: dockHeight }}>
              <Dock brand={brand} t={{ ...t, light: true, text: '#111827' }} s={s} qrUrl={qrUrl} size={dockQrSize} qrZone={dockQrZone} qrLabel={qrLabel} />
            </div>
          )}
        </div>
      );
      break;
    }
    case 'vip': {
      // 🥂 VIP Gold & Velvet Frame: doble marco ornamental de lujo.
      const orn = t.accent2;
      body = (
        <div style={{ height: '100%', border: `2px solid ${orn}`, borderRadius: 18 * s, padding: 8 * s, boxSizing: 'border-box' }}>
          <div style={{ height: '100%', border: `1px solid ${orn}88`, borderRadius: 12 * s, display: 'flex', flexDirection: 'column', gap: 12 * s, padding: 12 * s, boxSizing: 'border-box' }}>
            <Badge text={badge} t={t} s={s} />
            <div style={{ flex: 1, minHeight: 0, maxHeight: PHOTO_MAX, borderRadius: 10 * s, overflow: 'hidden', position: 'relative' }}>
              <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
              {priceOverlay && (
                <div style={{ position: 'absolute', bottom: 12 * s, right: 12 * s }}>
                  <PricePill brand={brand} t={t} s={s} />
                </div>
              )}
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 11 * s, fontWeight: 800, letterSpacing: 4, textTransform: 'uppercase', color: t.accent2 }}>✦ ✦ ✦</p>
            </div>
            <Headline texts={texts} t={t} s={s} size={46} align="center" styleId={fontStyle} scale={hs} />
            {contentBlocks('center', true)}
            {masterDock}
          </div>
        </div>
      );
      break;
    }
    case 'cyber': {
      // 🚀 Cyber Glass Dashboard: paneles HUD futuristas estilo holográfico.
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 * s, height: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: `"${t.font}", system-ui, sans-serif`, fontSize: 11 * s, fontWeight: 800, letterSpacing: 2, color: t.accent }}>◆ SISTEMA ACTIVO</span>
            <Badge text={badge} t={t} s={s} />
          </div>
          <div style={{ flex: 1, minHeight: 0, maxHeight: PHOTO_MAX, position: 'relative', ...g.card, borderRadius: 14 * s, overflow: 'hidden' }}>
            <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
            {/* Esquinas HUD de interfaz holográfica */}
            {(
              [
                { top: 8 * s, left: 8 * s, bw: `${2 * s}px 0 0 ${2 * s}px` },
                { top: 8 * s, right: 8 * s, bw: `${2 * s}px ${2 * s}px 0 0` },
                { bottom: 8 * s, left: 8 * s, bw: `0 0 ${2 * s}px ${2 * s}px` },
                { bottom: 8 * s, right: 8 * s, bw: `0 ${2 * s}px ${2 * s}px 0` },
              ] as Array<{ top?: number; left?: number; right?: number; bottom?: number; bw: string }>
            ).map((c, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute', top: c.top, left: c.left, right: c.right, bottom: c.bottom,
                  width: 22 * s, height: 22 * s,
                  borderStyle: 'solid', borderColor: t.accent2, borderWidth: c.bw,
                }}
              />
            ))}
            {priceOverlay && (
              <div style={{ position: 'absolute', bottom: 12 * s, right: 12 * s }}>
                <PricePill brand={brand} t={t} s={s} />
              </div>
            )}
          </div>
          <div style={{ ...g.card, borderRadius: 14 * s, borderLeft: `4px solid ${t.accent2}`, padding: `${12 * s}px ${16 * s}px` }}>
            <Headline texts={texts} t={t} s={s} size={42} align="left" styleId={fontStyle} scale={hs} />
          </div>
          {contentBlocks('center')}
          {masterDock}
        </div>
      );
      break;
    }
    case 'rustic': {
      // 🪵 Rústico Artesanal Gourmet: etiqueta de sello y costuras punteadas.
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 * s, height: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <span style={{ border: `2px dashed ${t.accent}`, borderRadius: 999, padding: `${7 * s}px ${16 * s}px`, fontSize: 12 * s, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: t.text }}>
              {badge.trim() || '★ HECHO ARTESANALMENTE ★'}
            </span>
          </div>
          <div style={{ flex: 1, minHeight: 0, maxHeight: PHOTO_MAX, borderRadius: 10 * s, overflow: 'hidden', position: 'relative', border: `6px solid ${t.light ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.12)'}` }}>
            <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
            {priceOverlay && (
              <div style={{ position: 'absolute', bottom: 12 * s, right: 12 * s }}>
                <PricePill brand={brand} t={t} s={s} />
              </div>
            )}
          </div>
          <div style={{ borderTop: `2px dashed ${t.accent}77`, paddingTop: 10 * s }}>
            <Headline texts={texts} t={t} s={s} size={46} align="center" styleId={fontStyle} scale={hs} />
          </div>
          {contentBlocks('center')}
          {masterDock}
        </div>
      );
      break;
    }
    case 'retail': {
      // 🏷️ Mega-Promo Retail: cinta diagonal de oferta + pastilla de precio.
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 * s, height: '100%', position: 'relative' }}>
          <div style={{ position: 'absolute', top: -30 * s, right: -60 * s, width: 260 * s, transform: 'rotate(24deg)', background: t.accent2, color: t.light ? '#0b0f18' : '#0b0f18', textAlign: 'center', padding: `${8 * s}px 0`, fontSize: 14 * s, fontWeight: 900, letterSpacing: 3, textTransform: 'uppercase', boxShadow: '0 8px 20px rgba(0,0,0,0.35)', zIndex: 3 }}>
            {badge.trim() || 'OFERTA ESPECIAL'}
          </div>
          <div style={{ flex: 1, minHeight: 0, borderRadius: 20 * s, overflow: 'hidden', position: 'relative' }}>
            <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
            {priceOverlay && (
              <div style={{ position: 'absolute', bottom: 14 * s, left: 14 * s, transform: 'rotate(-3deg)' }}>
                <PricePill brand={brand} t={t} s={s} big />
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
    case 'eco': {
      // 🌿 Eco-Editorial Orgánico: formas redondeadas, tonos tierra/verde.
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 * s, height: '100%', position: 'relative' }}>
          <div style={{ position: 'absolute', top: -40 * s, left: -50 * s, width: 220 * s, height: 220 * s, borderRadius: '50% 50% 46% 54% / 55% 48% 52% 45%', background: `${t.accent2}26` }} />
          <div style={{ position: 'absolute', bottom: -60 * s, right: -40 * s, width: 240 * s, height: 240 * s, borderRadius: '54% 46% 50% 50% / 48% 55% 45% 52%', background: `${t.accent}1f` }} />
          <Badge text={badge} t={t} s={s} />
          <div style={{ flex: 1, minHeight: 0, maxHeight: PHOTO_MAX, borderRadius: '46% 46% 24px 24px / 20% 20% 24px 24px', overflow: 'hidden', position: 'relative' }}>
            <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
            {priceOverlay && (
              <div style={{ position: 'absolute', bottom: 12 * s, right: 12 * s }}>
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
    case 'cinema': {
      // 🎬 Cinema Widescreen: bandas cinematográficas + luces de estudio.
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 * s, height: '100%' }}>
          <Badge text={badge} t={t} s={s} />
          <div style={{ flex: 1, minHeight: 0, maxHeight: PHOTO_MAX, position: 'relative', borderRadius: 14 * s, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ height: 34 * s, background: '#050507' }} />
            <div style={{ flex: 1, minHeight: 0 }}>
              <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
            </div>
            <div style={{ height: 34 * s, background: '#050507', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 * s }}>
              <span style={{ fontSize: 9 * s, fontWeight: 800, letterSpacing: 3, color: 'rgba(255,255,255,0.7)' }}>· {brand.municipality || 'GACHETÁ'} · EN CARTELERA HOY ·</span>
            </div>
            {priceOverlay && (
              <div style={{ position: 'absolute', bottom: 44 * s, right: 14 * s }}>
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
      // 💎 Cristales Flotantes 3D: tarjetas superpuestas con desenfoque.
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 * s, height: '100%', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 60 * s, right: -30 * s, width: 160 * s, height: 160 * s, borderRadius: '50%', background: `${t.accent}33`, filter: 'blur(28px)' }} />
          <Badge text={badge} t={t} s={s} />
          <div style={{ display: 'flex', justifyContent: 'center', position: 'relative', height: 300 * s }}>
            <div style={{ position: 'absolute', top: 10 * s, left: '50%', transform: 'translateX(-50%) rotate(2.5deg)', width: 320 * s, height: 250 * s, borderRadius: 20 * s, overflow: 'hidden', boxShadow: '0 24px 50px rgba(0,0,0,0.5)' }}>
              <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
            </div>
            <div style={{ position: 'absolute', bottom: -6 * s, left: '50%', transform: 'translateX(-50%) rotate(-2deg)', width: 360 * s, ...g.card, borderRadius: 18 * s, padding: `${14 * s}px ${18 * s}px`, boxShadow: '0 20px 44px rgba(0,0,0,0.45)' }}>
              <Headline texts={texts} t={t} s={s} size={34} align="center" styleId={fontStyle} scale={hs} />
            </div>
            {priceOverlay && (
              <div style={{ position: 'absolute', top: 24 * s, right: 16 * s, transform: 'rotate(5deg)' }}>
                <PricePill brand={brand} t={t} s={s} />
              </div>
            )}
          </div>
          {contentBlocks('center', true)}
          {masterDock}
        </div>
      );
      break;
    }
    // ═══ 🚀 V19 · 8 ARQUITECTURAS FUTURISTAS NUEVAS (17–24) ═══
    case 'hud': {
      // 17 · Holographic Cyber Frame: esquinas HUD tecnológicas + scanlines.
      const corner = (pos: CSSProperties): React.ReactElement => (
        <div style={{ position: 'absolute', width: 46 * s, height: 46 * s, borderColor: t.accent2, borderStyle: 'solid', borderWidth: 0, boxShadow: `0 0 ${10 * s}px ${t.accent2}66`, ...pos }} />
      );
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 * s, height: '100%', position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, background: `repeating-linear-gradient(180deg, ${t.accent}08 0 ${2 * s}px, transparent ${2 * s}px ${7 * s}px)`, pointerEvents: 'none', borderRadius: 20 * s }} />
          {corner({ top: 8 * s, left: 8 * s, borderTopWidth: 3 * s, borderLeftWidth: 3 * s })}
          {corner({ top: 8 * s, right: 8 * s, borderTopWidth: 3 * s, borderRightWidth: 3 * s })}
          {corner({ bottom: 8 * s, left: 8 * s, borderBottomWidth: 3 * s, borderLeftWidth: 3 * s })}
          {corner({ bottom: 8 * s, right: 8 * s, borderBottomWidth: 3 * s, borderRightWidth: 3 * s })}
          <Badge text={badge} t={t} s={s} />
          {photoBlock({ margin: `0 ${14 * s}px` })}
          <Headline texts={texts} t={t} s={s} size={46} align="center" styleId={fontStyle} scale={hs} />
          {contentBlocks('center', true)}
          {masterDock}
        </div>
      );
      break;
    }
    case 'resort': {
      // 18 · Resort & Pool Paradise: ventana panorámica + ondas luminosas.
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 * s, height: '100%' }}>
          <Badge text={badge} t={t} s={s} />
          <div style={{ flex: 1, minHeight: 0, maxHeight: 330 * s, position: 'relative', borderRadius: 26 * s, overflow: 'hidden', boxShadow: '0 16px 40px rgba(0,0,0,0.45)' }}>
            <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 62%, rgba(14,116,144,0.30) 100%)' }} />
            {/* Ondas acuáticas luminosas */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 46 * s, background: `repeating-radial-gradient(ellipse 120px 34px at 50% 120%, transparent 0 ${16 * s}px, rgba(125,211,252,0.35) ${16 * s}px ${19 * s}px, transparent ${19 * s}px ${30 * s}px)` }} />
            {priceOverlay && (
              <div style={{ position: 'absolute', top: 12 * s, right: 12 * s }}>
                <PricePill brand={brand} t={t} s={s} />
              </div>
            )}
          </div>
          <Headline texts={texts} t={t} s={s} size={46} align="center" styleId={fontStyle} scale={hs} />
          {contentBlocks('center', true)}
          {masterDock}
        </div>
      );
      break;
    }
    case 'menu': {
      // 19 · Gourmet Menu Spotlight: foto circular gigante + sello 3D de precio.
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 * s, height: '100%', alignItems: 'center', position: 'relative' }}>
          <Badge text={badge} t={t} s={s} />
          <div style={{ position: 'relative', width: 300 * s, height: 300 * s, flexShrink: 0, borderRadius: '50%', padding: 7 * s, background: `linear-gradient(160deg, ${t.accent}, ${t.accent2})`, boxShadow: `0 0 ${26 * s}px ${t.accent2}66, 0 16px 40px rgba(0,0,0,0.5)` }}>
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden' }}>
              <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
            </div>
          </div>
          {showPrice && brand.promoPrice != null && (
            <div style={{ position: 'absolute', top: 118 * s, right: 6 * s, transform: 'rotate(7deg)' }}>
              <PricePill brand={brand} t={t} s={s} />
            </div>
          )}
          <Headline texts={texts} t={t} s={s} size={44} align="center" styleId={fontStyle} scale={hs} />
          {contentBlocks('center', true)}
          {masterDock}
        </div>
      );
      break;
    }
    case 'clinic': {
      // 20 · Medical & Clinic Trust: cápsulas blancas/zafiro de alta precisión.
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 * s, height: '100%' }}>
          <Badge text={badge} t={t} s={s} />
          <div style={{ flex: 1, minHeight: 0, maxHeight: 330 * s, position: 'relative', borderRadius: 24 * s, overflow: 'hidden', boxShadow: '0 14px 36px rgba(15,23,42,0.28)', border: '3px solid rgba(255,255,255,0.9)' }}>
            <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
            {priceOverlay && (
              <div style={{ position: 'absolute', bottom: 12 * s, right: 12 * s }}>
                <PricePill brand={brand} t={t} s={s} />
              </div>
            )}
          </div>
          <Headline texts={texts} t={t} s={s} size={44} align="center" styleId={fontStyle} scale={hs} />
          {showBenefits && benefits.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 * s }}>
              {benefits.slice(0, 3).map((b, i) => {
                const { body: txt } = splitBenefit(b);
                return (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.96)', color: '#0f172a', borderRadius: 999, padding: `${8 * s}px ${14 * s}px`, display: 'flex', alignItems: 'center', gap: 10 * s, boxShadow: '0 4px 14px rgba(15,23,42,0.22)' }}>
                    <GlyphIcon kind={i} size={17 * s} color="#0369a1" />
                    <span style={{ flex: 1, fontSize: 13.5 * s, fontWeight: 800, lineHeight: 1.2 }}>{txt}</span>
                    <span style={{ width: 20 * s, height: 20 * s, borderRadius: '50%', background: 'linear-gradient(160deg, #38bdf8, #0369a1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <GlyphIcon kind={0} size={11 * s} color="#ffffff" />
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {masterDock}
        </div>
      );
      break;
    }
    case 'agro': {
      // 21 · Agro & Heavy Duty Pro: franjas industriales amarillo/esmeralda.
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 * s, height: '100%' }}>
          <div style={{ background: `repeating-linear-gradient(45deg, #facc15 0 ${18 * s}px, #0f172a ${18 * s}px ${36 * s}px)`, color: '#ffffff', borderRadius: 12 * s, padding: `${10 * s}px ${14 * s}px`, display: 'flex', alignItems: 'center', gap: 10 * s, boxShadow: '0 10px 26px rgba(0,0,0,0.45)' }}>
            <span style={{ background: '#059669', borderRadius: 8 * s, padding: `${5 * s}px ${10 * s}px`, fontSize: 13 * s, fontWeight: 900, whiteSpace: 'nowrap' }}>💪 PRO</span>
            <span style={{ fontSize: 14 * s, fontWeight: 900, letterSpacing: 1, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{badge || 'TRABAJO PESADO HECHO BIEN'}</span>
          </div>
          {photoBlock()}
          <Headline texts={texts} t={t} s={s} size={46} align="center" styleId={fontStyle} scale={hs} />
          {contentBlocks('center')}
          {masterDock}
        </div>
      );
      break;
    }
    case 'diamond': {
      // 22 · Luxury Diamond Showcase: foto en recorte diamante + destellos oro.
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 * s, height: '100%', alignItems: 'center', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 40 * s, left: 14 * s, fontSize: 22 * s, opacity: 0.85 }}>✨</div>
          <div style={{ position: 'absolute', top: 150 * s, right: 18 * s, fontSize: 15 * s, opacity: 0.75 }}>✨</div>
          <Badge text={badge} t={t} s={s} />
          <div style={{ width: 310 * s, height: 310 * s, flexShrink: 0, clipPath: 'polygon(50% 0%, 100% 26%, 100% 74%, 50% 100%, 0% 74%, 0% 26%)', background: `linear-gradient(160deg, ${t.accent}, ${t.accent2})`, padding: 5 * s, boxShadow: `0 0 ${28 * s}px ${t.accent2}77` }}>
            <div style={{ width: '100%', height: '100%', clipPath: 'polygon(50% 0%, 100% 26%, 100% 74%, 50% 100%, 0% 74%, 0% 26%)', overflow: 'hidden', background: '#111827' }}>
              <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
            </div>
          </div>
          <Headline texts={texts} t={t} s={s} size={44} align="center" styleId={fontStyle} scale={hs} />
          {contentBlocks('center', true)}
          {masterDock}
        </div>
      );
      break;
    }
    case 'flash': {
      // 23 · Flash Promo Explosion: bandas diagonales de oferta relámpago.
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 * s, height: '100%', position: 'relative' }}>
          <div style={{ position: 'absolute', top: -40 * s, right: -70 * s, width: 260 * s, height: 260 * s, transform: 'rotate(24deg)', background: `linear-gradient(90deg, ${t.accent}, ${t.accent2})`, opacity: 0.22, borderRadius: 24 * s, pointerEvents: 'none' }} />
          <div style={{ transform: 'rotate(-2.5deg)', background: `linear-gradient(90deg, ${t.accent}, ${t.accent2})`, color: '#0b0f18', borderRadius: 12 * s, padding: `${10 * s}px ${18 * s}px`, alignSelf: 'center', fontSize: 19 * s, fontWeight: 900, letterSpacing: 1.4, textTransform: 'uppercase', boxShadow: `0 12px 30px ${t.accent}77`, whiteSpace: 'nowrap' }}>
            ⚡ ¡{badge || 'OFERTA RELÁMPAGO DE HOY'}! ⚡
          </div>
          {photoBlock()}
          <Headline texts={texts} t={t} s={s} size={46} align="center" styleId={fontStyle} scale={hs} />
          {contentBlocks('center', true)}
          {masterDock}
        </div>
      );
      break;
    }
    case 'bento3d': {
      // 24 · Futuristic Bento 3D: mosaico asimétrico de cristal con borde neón.
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 * s, height: '100%' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 10 * s, height: 330 * s, flexShrink: 0 }}>
            <div style={{ position: 'relative', borderRadius: 20 * s, overflow: 'hidden', boxShadow: `0 0 0 ${2 * s}px ${t.accent2}88, 0 14px 34px rgba(0,0,0,0.5)` }}>
              <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
              {priceOverlay && (
                <div style={{ position: 'absolute', bottom: 10 * s, left: 10 * s }}>
                  <PricePill brand={brand} t={t} s={s} />
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 * s }}>
              <div style={{ flex: 1, ...g.card, borderRadius: 16 * s, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 * s, padding: 10 * s }}>
                <GlyphIcon kind={0} size={26 * s} color={t.accent2} />
                <span style={{ fontSize: 12.5 * s, fontWeight: 900, color: t.text, textAlign: 'center', lineHeight: 1.2, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{splitBenefit(benefits[0] ?? 'Calidad garantizada').body}</span>
              </div>
              <div style={{ flex: 1, ...g.card, borderRadius: 16 * s, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 * s, padding: 10 * s }}>
                <GlyphIcon kind={1} size={26 * s} color={t.accent2} />
                <span style={{ fontSize: 12.5 * s, fontWeight: 900, color: t.text, textAlign: 'center', lineHeight: 1.2, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{splitBenefit(benefits[1] ?? 'Atención inmediata').body}</span>
              </div>
            </div>
          </div>
          <Badge text={badge} t={t} s={s} />
          <Headline texts={texts} t={t} s={s} size={44} align="center" styleId={fontStyle} scale={hs} />
          {contentBlocks('center', true)}
          {masterDock}
        </div>
      );
      break;
    }
    // ═══ 💥 V21 · 4 COMPOSICIONES ASIMÉTRICAS DISRUPTIVAS (25–28) ═══
    case 'diagx': {
      // 25 · Split Diagonal Extremo: foto cortada esquina a esquina con
      // borde neón de 10px + titular abajo alineado a la izquierda.
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ position: 'relative', height: 340 * s, flexShrink: 0, overflow: 'visible' }}>
            <div
              style={{
                position: 'absolute', top: -20 * s, left: -30 * s, right: -30 * s, bottom: -20 * s,
                clipPath: 'polygon(0 0, 100% 0, 100% 62%, 0 100%)',
                overflow: 'hidden',
                borderBottom: `${10 * s}px solid ${t.accent2}`,
              }}
            >
              <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
              {priceOverlay && (
                <div style={{ position: 'absolute', bottom: 20 * s, right: 16 * s }}>
                  <PricePill brand={brand} t={t} s={s} />
                </div>
              )}
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 9 * s, padding: `${14 * s}px 18 * s` }}>
            <Badge text={badge} t={t} s={s} />
            <Headline texts={texts} t={t} s={s} size={50} align="left" styleId={fontStyle} scale={hs} />
            {contentBlocks('left', true)}
            {masterDock}
          </div>
        </div>
      );
      break;
    }
    case 'orbits': {
      // 26 · Círculos Intersectados: gran círculo con la foto a la derecha y
      // un círculo sólido de acento a la izquierda con el descuento/titular.
      body = (
        <div style={{ position: 'relative', height: '100%' }}>
          <div style={{ position: 'absolute', top: 40 * s, right: -46 * s, width: 380 * s, height: 380 * s, borderRadius: '50%', overflow: 'hidden', border: `${6 * s}px solid ${t.accent2}66`, boxShadow: `0 18px 44px rgba(0,0,0,0.5), 0 0 ${30 * s}px ${t.accent2}44` }}>
            <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
          </div>
          <div style={{ position: 'absolute', top: 150 * s, left: -70 * s, width: 300 * s, height: 300 * s, borderRadius: '50%', background: `linear-gradient(160deg, ${t.accent}, ${t.accent2})`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 * s, boxShadow: `0 16px 40px ${t.accent}66` }}>
            <span style={{ fontFamily: `"${t.font}", system-ui, sans-serif`, fontSize: 64 * s, fontWeight: 900, color: '#0b0f18', lineHeight: 1 }}>
              {showPrice && brand.promoPrice != null ? money(brand.promoPrice) : (badge || t.accent).slice(0, 9)}
            </span>
            {showPrice && brand.normalPrice != null && brand.promoPrice != null && (
              <span style={{ fontSize: 14 * s, color: 'rgba(11,15,24,0.72)', textDecoration: 'line-through', fontWeight: 800 }}>{money(brand.normalPrice)}</span>
            )}
          </div>
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 10 * s, paddingTop: 440 * s }}>
            <Headline texts={texts} t={t} s={s} size={44} align="left" styleId={fontStyle} scale={hs} />
            {contentBlocks('left', true)}
            {masterDock}
          </div>
        </div>
      );
      break;
    }
    case 'bleed': {
      // 27 · Tipografía Sangrada: titular de revista de moda, tan grande que
      // sangra por los bordes del afiche (overflow hidden) + foto vertical.
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          <div style={{ flexShrink: 0, margin: `0 ${-26 * s}px`, marginTop: -6 * s }}>
            <div style={{ width: '116%', marginLeft: '-8%' }}>
              <Headline texts={texts} t={t} s={s} size={64} align="left" styleId={fontStyle} scale={hs} fullWidth />
            </div>
          </div>
          <div style={{ display: 'flex', flex: 1, minHeight: 0, gap: 10 * s, marginTop: 8 * s }}>
            <div style={{ flex: 1.6, borderRadius: 18 * s, overflow: 'hidden', position: 'relative' }}>
              <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
              {priceOverlay && (
                <div style={{ position: 'absolute', bottom: 10 * s, left: 10 * s }}>
                  <PricePill brand={brand} t={t} s={s} />
                </div>
              )}
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 * s, justifyContent: 'center' }}>
              <Badge text={badge} t={t} s={s} />
              {showBenefits && benefits.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 * s }}>
                  {benefits.slice(0, 3).map((b, i) => {
                    const { body: txt } = splitBenefit(b);
                    return (
                      <p key={i} style={{ margin: 0, fontSize: 11.5 * s, fontWeight: 700, color: t.text, lineHeight: 1.3 }}>
                        {txt}
                      </p>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <div style={{ flexShrink: 0, marginTop: 10 * s }}>
            {masterDock}
          </div>
        </div>
      );
      break;
    }
    case 'zen': {
      // 28 · Bento Minimalista Japonés: cajas de 1px, mucho aire y una foto
      // pequeña exquisita — precisión y silencio visual.
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 * s, height: '100%', padding: `${6 * s}px 0` }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gridTemplateRows: '1fr 1fr', gap: 10 * s, height: 360 * s, flexShrink: 0 }}>
            <div style={{ gridRow: 'span 2', border: `1px solid ${t.light ? 'rgba(15,23,42,0.18)' : 'rgba(255,255,255,0.22)'}`, borderRadius: 4 * s, overflow: 'hidden' }}>
              <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
            </div>
            <div style={{ border: `1px solid ${t.light ? 'rgba(15,23,42,0.18)' : 'rgba(255,255,255,0.22)'}`, borderRadius: 4 * s, padding: 12 * s, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <p style={{ margin: 0, fontSize: 10 * s, fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase', color: t.light ? 'rgba(15,23,42,0.5)' : t.accent2 }}>{badge || 'HOY'}</p>
              {showPrice && brand.promoPrice != null ? (
                <span style={{ fontFamily: `"${t.font}", system-ui, sans-serif`, fontSize: 26 * s, fontWeight: 900, color: t.text, lineHeight: 1 }}>{money(brand.promoPrice)}</span>
              ) : (
                <p style={{ margin: 0, fontSize: 15 * s, fontWeight: 800, color: t.text, lineHeight: 1.25 }}>{splitBenefit(benefits[0] ?? 'Calidad garantizada').body}</p>
              )}
            </div>
            <div style={{ border: `1px solid ${t.light ? 'rgba(15,23,42,0.18)' : 'rgba(255,255,255,0.22)'}`, borderRadius: 4 * s, padding: 12 * s, display: 'flex', flexDirection: 'column', gap: 8 * s, justifyContent: 'center' }}>
              {benefits.slice(0, 2).map((b, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 * s }}>
                  <GlyphIcon kind={i + 1} size={14 * s} color={t.accent2} />
                  <span style={{ fontSize: 11 * s, fontWeight: 700, color: t.text, lineHeight: 1.2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{splitBenefit(b).body}</span>
                </div>
              ))}
            </div>
          </div>
          <Headline texts={texts} t={t} s={s} size={44} align="left" styleId={fontStyle} scale={hs} />
          <div style={{ flex: 1, minHeight: 0 }}>
            {masterDock}
          </div>
        </div>
      );
      break;
    }
    default: {
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 * s, height: '100%' }}>
          <Badge text={badge} t={t} s={s} />
          {photoBlock()}
          <Headline texts={texts} t={t} s={s} size={46} align="center" styleId={fontStyle} scale={hs} />
          {contentBlocks('center')}
          {masterDock}
        </div>
      );
    }
  }

  return (
    <div
      style={{
        width: W, height: H, flexShrink: 0, position: 'relative',
        background: t.bg,
        backgroundSize: t.bgSize ?? '100% 100%, 100% 100%, 100% 100%, 100% 100%',
        color: t.text,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        borderRadius: 22 * s,
        overflow: 'hidden',
      }}
    >
      {/* V13: fondo escénico multicapa DETRÁS de la composición maestra */}
      <ScenicBg url={photoUrl} t={t} />
      <div style={{ position: 'relative', width: '100%', height: '100%', padding: pad, boxSizing: 'border-box' }}>{body}</div>
    </div>
  );
}
