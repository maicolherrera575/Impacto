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
  | 'split' | 'brutal' | 'vip' | 'cyber' | 'rustic' | 'retail' | 'eco' | 'cinema' | 'float';
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
}

const money = (v: number): string => `$${v.toLocaleString('es-CO')}`;

/** Titular suelto (piezas con textos dedicados). */
function ht(plain: string, highlight: string): AfficheTexts {
  return { plain, highlight, sub: '', benefits: [], cta: '', hook: '' };
}

/** Separa el emoji inicial de un beneficio (icono grande + texto). */
function splitBenefit(b: string): { icon: string; body: string } {
  const m = /^\p{Extended_Pictographic}/u.exec(b.trim());
  const icon = m ? m[0] : '✅';
  const body = m ? b.trim().slice(icon.length).trim() : b.trim();
  return { icon, body };
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
 * 📣 V13 · TITULAR DISPLAY GIGANTE: 42px en el lienzo de 540 (=84px en el PNG
 * 1080p), fuente display de agencia, alto contraste y palabras clave con
 * degradado brillante — el titular ocupa el espacio con autoridad.
 */
function Headline({
  texts, t, s, size = 42, align = 'center', color,
}: {
  texts: AfficheTexts;
  t: AfficheTheme;
  s: number;
  size?: number;
  align?: 'center' | 'left';
  color?: string;
}) {
  const base: CSSProperties = {
    margin: 0,
    fontFamily: `"${t.font}", system-ui, sans-serif`,
    fontSize: (size * s).toFixed(1),
    lineHeight: 1.06,
    fontWeight: 900,
    letterSpacing: -0.5,
    color: color ?? t.text,
    textShadow: t.light && !color ? 'none' : '0 3px 18px rgba(0,0,0,0.35)',
  };
  return (
    <div style={{ textAlign: align }}>
      <p style={base}>
        {texts.plain.trim()}{' '}
        <span
          style={{
            background: `linear-gradient(100deg, ${t.accent}, ${t.accent2})`,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          {texts.highlight.trim()}
        </span>
      </p>
    </div>
  );
}

/** Subtítulo editorial: 16px en lienzo (=32px en 1080p), legible y firme. */
function SubHead({ text, t, s, align = 'center', color }: { text: string; t: AfficheTheme; s: number; align?: 'center' | 'left'; color?: string }) {
  if (!text.trim()) return null;
  return (
    <p style={{ margin: 0, fontSize: 16 * s, fontWeight: 600, lineHeight: 1.35, color: color ?? t.sub, textAlign: align, opacity: 0.96 }}>
      {text.trim()}
    </p>
  );
}

/** 💎 V12 · Tarjetas de beneficio GRANDES: 16.5px bold (=33px en 1080p),
 *  icono grande a la izquierda, borde luminoso y sombra profunda. */
function BenefitCards({ items, t, s }: { items: string[]; t: AfficheTheme; s: number }) {
  const g = glass(t);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 * s }}>
      {items.slice(0, 3).map((b, i) => {
        const { icon, body } = splitBenefit(b);
        return (
          <div
            key={i}
            style={{
              ...g.card,
              borderRadius: 16 * s,
              display: 'flex', alignItems: 'center', gap: 13 * s,
              padding: `${13 * s}px ${16 * s}px`,
              boxShadow: t.light
                ? `0 2px 10px rgba(15,23,42,0.10), inset 0 0 0 1px ${t.accent2}22`
                : `0 6px 18px rgba(0,0,0,0.35), inset 0 0 0 1px ${t.accent2}33`,
            }}
          >
            <span style={{ fontSize: 26 * s, lineHeight: 1 }}>{icon}</span>
            <span style={{ fontSize: 16.5 * s, fontWeight: 700, color: t.text, lineHeight: 1.18 }}>{body}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Píldoras de beneficios (layouts full-bleed). */
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
            fontSize: 13.5 * s, fontWeight: 700, color: t.text,
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
      <span style={{ fontFamily: `"${t.font}", system-ui, sans-serif`, fontSize: (big ? 36 : 28) * s, fontWeight: 900, color: '#fde047', lineHeight: 1 }}>
        {money(promo)}
      </span>
      {showNormal && brand.normalPrice != null && (
        <span style={{ fontSize: 13 * s, color: '#e2e8f0', textDecoration: 'line-through' }}>{money(brand.normalPrice)}</span>
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
          padding: `${12 * s}px ${26 * s}px`,
          fontSize: 17 * s,
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
 * 📲 Dock de Conversión V12: categoría detectada del brief en MAYÚSCULAS +
 * ubicación (jamás una categoría fija), negocio en grande, botón de WhatsApp
 * y CÓDIGO QR GIGANTE sobre blanco con UNA sola etiqueta: "📱 ESCANEA EL QR".
 */
function Dock({ brand, t, s, qrUrl, size, qrLabel }: { brand: AfficheBrand; t: AfficheTheme; s: number; qrUrl: string | null; size: number; qrLabel?: string }) {
  const g = glass(t);
  const qrBox = size;
  const phone = brand.phoneDisplay || '📲 Escríbenos';
  return (
    <div
      style={{
        ...g.card,
        borderRadius: 18 * s,
        display: 'flex', alignItems: 'center', gap: 12 * s,
        padding: `${12 * s}px ${14 * s}px`,
        boxShadow: t.light ? '0 2px 10px rgba(15,23,42,0.10)' : '0 8px 26px rgba(0,0,0,0.38)',
      }}
    >
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 * s }}>
        <p style={{ margin: 0, fontSize: 9.5 * s, fontWeight: 800, letterSpacing: 1.6, textTransform: 'uppercase', color: t.light ? 'rgba(15,23,42,0.62)' : 'rgba(255,255,255,0.66)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {(brand.slogan || 'ATENCIÓN INMEDIATA').toUpperCase()}
        </p>
        <p style={{ margin: 0, fontFamily: `"${t.font}", system-ui, sans-serif`, fontSize: 26 * s, fontWeight: 900, color: t.text, lineHeight: 1.05, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {brand.name || 'Tu Negocio'}
        </p>
        <p style={{ margin: 0, fontSize: 11 * s, fontWeight: 600, color: t.light ? 'rgba(15,23,42,0.66)' : t.sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          📍 {brand.address || brand.municipality || 'Gachetá'}
        </p>
        <div
          style={{
            background: '#16a34a', color: '#ffffff',
            borderRadius: 999,
            padding: `${8 * s}px ${14 * s}px`,
            fontSize: 15 * s, fontWeight: 900,
            display: 'inline-flex', alignItems: 'center', gap: 6 * s,
            alignSelf: 'flex-start',
            boxShadow: '0 4px 14px rgba(22,163,74,0.45)',
            whiteSpace: 'nowrap',
          }}
        >
          💬 {phone}
        </div>
      </div>
      {qrUrl && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 * s, flexShrink: 0 }}>
          <div style={{ background: '#ffffff', borderRadius: 10 * s, padding: 6 * s, boxShadow: '0 4px 14px rgba(0,0,0,0.30)' }}>
            <img src={qrUrl} alt="QR" style={{ width: qrBox, height: qrBox, display: 'block' }} />
          </div>
          <p style={{ margin: 0, fontSize: 10.5 * s, fontWeight: 800, letterSpacing: 0.8, color: t.light ? 'rgba(15,23,42,0.75)' : 'rgba(255,255,255,0.88)', whiteSpace: 'nowrap' }}>
            {qrLabel || '📱 ESCANEA EL QR'}
          </p>
        </div>
      )}
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
  const { themeId, layout, format, piece, brand, texts, badge, showPrice, showBenefits, showQr, photoUrl, qrUrl, photoZoom, photoPosY, qrLabel, qrHint } = props;
  const t = AFFICHE_THEMES.find((x) => x.id === themeId) ?? AFFICHE_THEMES[1];
  const s = format === 'square' ? 0.58 : 1;
  const W = 540;
  const H = format === 'square' ? 540 : 960;
  const g = glass(t);
  const pad = 18 * s;
  const benefits = texts.benefits.filter(Boolean);
  const priceOverlay = showPrice && brand.promoPrice != null && piece === 0;
  const priceLabel = texts.cta.trim();
  const isService = brand.promoPrice == null;

  // V13: la ventana fotográfica NUNCA supera el 42% del lienzo — el titular
  // y los beneficios tienen siempre espacio monumental garantizado.
  const PHOTO_MAX = 400 * s;

  // Tamaños del dock según la pieza (piezas 2/3 tienen QR dedicado).
  const dockQrSize = 132 * s;
  const dockHeight = 180 * s;

  const photoBlock = (extra?: CSSProperties, clip?: string): React.ReactElement => (
    <div
      style={{
        flex: 1, minHeight: 0, maxHeight: PHOTO_MAX, position: 'relative',
        borderRadius: 26 * s,
        ...(clip ? { clipPath: clip, borderRadius: 0 } : {}),
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

  /** Dock estándar de la pieza maestra. */
  const masterDock = showQr ? (
    <div style={{ height: dockHeight }}>
      <Dock brand={brand} t={t} s={s} qrUrl={qrUrl} size={dockQrSize} qrLabel={qrLabel} />
    </div>
  ) : null;

  // ═══ PIEZA 2 · 🔥 PORTADA DE REVISTA FULL-BLEED (cabecera editorial + ═══
  // ═══ titular gigante 42px + insignia de oferta + barra WhatsApp + QR) ═══
  if (piece === 1) {
    const barH = 128 * s;
    return (
      <div
        style={{
          width: W, height: H, flexShrink: 0, position: 'relative',
          background: '#0a0a0a', color: '#ffffff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          borderRadius: 22 * s, overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', inset: 0 }}>
          <Photo url={photoUrl} zoom={photoZoom * 1.05} posY={photoPosY} />
        </div>
        {/* Viñeta cinematográfica dramática */}
        <div
          style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse 120% 90% at 50% 42%, transparent 32%, rgba(0,0,0,0.5) 74%, rgba(0,0,0,0.9) 100%), linear-gradient(180deg, rgba(6,8,14,0.62) 0%, rgba(6,8,14,0.18) 24%, rgba(6,8,14,0.26) 52%, rgba(4,5,9,0.94) 100%)',
          }}
        />
        {/* Marco editorial de revista doble */}
        <div style={{ position: 'absolute', inset: 12 * s, border: '1px solid rgba(255,255,255,0.34)', borderRadius: 14 * s, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 18 * s, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10 * s, pointerEvents: 'none' }} />

        {/* Cabecera tipo portada de revista: rubro + ciudad */}
        <div style={{ position: 'absolute', top: 30 * s, left: 36 * s, right: 36 * s, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 * s }}>
          <p style={{ margin: 0, fontSize: 12.5 * s, fontWeight: 900, letterSpacing: 2.2, textTransform: 'uppercase', color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: '0 2px 10px rgba(0,0,0,0.6)' }}>
            {(brand.slogan || 'ESPECIAL COMERCIAL').toUpperCase()}
          </p>
          <span style={{ border: '1px solid rgba(255,255,255,0.4)', borderRadius: 999, padding: `${4 * s}px ${12 * s}px`, fontSize: 11 * s, fontWeight: 900, letterSpacing: 1.6, textTransform: 'uppercase', color: '#ffffff', whiteSpace: 'nowrap' }}>
            {brand.municipality || 'Gachetá'}
          </span>
        </div>
        <div style={{ position: 'absolute', top: 62 * s, left: 36 * s, right: 36 * s, height: 1, background: 'linear-gradient(90deg, rgba(255,255,255,0.5), rgba(255,255,255,0.12))' }} />

        {/* Insignia grande de oferta / cotización + titular gigante 42px (=84px @1080) */}
        <div
          style={{
            position: 'absolute', left: 30 * s, right: 30 * s,
            bottom: (showQr ? barH : 0) + pad + 18 * s,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 * s, textAlign: 'center',
          }}
        >
          {brand.promoPrice != null ? (
            <div style={{ transform: 'rotate(-2deg)' }}>
              <PricePill brand={brand} t={t} s={s} big />
            </div>
          ) : (
            badge.trim() || texts.cta.trim() ? (
              <Sticker text={badge.trim() || texts.cta.trim()} s={s} bg={t.accent2} color={t.light ? '#ffffff' : '#0b0f18'} rotate={-2} />
            ) : null
          )}
          <p
            style={{
              margin: 0,
              fontFamily: `"${t.font}", system-ui, sans-serif`,
              fontSize: 42 * s,
              lineHeight: 1.04,
              fontWeight: 900,
              textTransform: 'uppercase',
              color: '#ffffff',
              textShadow: '0 4px 26px rgba(0,0,0,0.72)',
            }}
          >
            {texts.hook.trim() || `${texts.plain.trim()} ${texts.highlight.trim()}`.toUpperCase()}
          </p>
          <p style={{ margin: 0, fontSize: 16 * s, fontWeight: 700, color: 'rgba(255,255,255,0.92)', textShadow: '0 2px 12px rgba(0,0,0,0.55)' }}>
            {texts.sub.trim()}
          </p>
        </div>

        {/* Barra inferior: WhatsApp + QR con la leyenda del destino elegido */}
        {showQr && (
          <div
            style={{
              position: 'absolute', left: pad, right: pad, bottom: pad,
              display: 'flex', alignItems: 'center', gap: 12 * s,
              background: 'rgba(6,8,14,0.74)',
              border: '1px solid rgba(255,255,255,0.22)',
              borderRadius: 18 * s,
              padding: `${10 * s}px ${12 * s}px`,
            }}
          >
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 * s }}>
              <p style={{ margin: 0, fontSize: 12 * s, fontWeight: 800, color: 'rgba(255,255,255,0.88)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {brand.name || 'Tu Negocio'} · {brand.municipality || 'Gachetá'}
              </p>
              <div
                style={{
                  background: '#16a34a', color: '#ffffff',
                  borderRadius: 999,
                  padding: `${9 * s}px ${16 * s}px`,
                  fontSize: 15 * s, fontWeight: 900,
                  display: 'inline-flex', alignItems: 'center', gap: 6 * s,
                  alignSelf: 'flex-start',
                  boxShadow: '0 6px 18px rgba(22,163,74,0.5)',
                  whiteSpace: 'nowrap',
                }}
              >
                💬 {brand.phoneDisplay || 'Escríbenos al WhatsApp'}
              </div>
            </div>
            {qrUrl && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 * s, flexShrink: 0 }}>
                <div style={{ background: '#ffffff', borderRadius: 10 * s, padding: 5 * s, boxShadow: '0 4px 14px rgba(0,0,0,0.4)' }}>
                  <img src={qrUrl} alt="QR" style={{ width: 82 * s, height: 82 * s, display: 'block' }} />
                </div>
                <p style={{ margin: 0, fontSize: 9.5 * s, fontWeight: 800, letterSpacing: 0.5, color: 'rgba(255,255,255,0.92)', textAlign: 'center' }}>
                  {qrLabel || '📱 ESCANEA EL QR'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ═══ PIEZA 3 · 💎 INFOGRAFÍA VISUAL (banner panorámico 520px@1080 + ═══
  // ═══ "3 RAZONES PARA ELEGIRNOS HOY" + tarjetas Bento 01/02/03 gigantes) ═══
  if (piece === 2) {
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
        <ScenicBg url={photoUrl} t={t} frame />
        <div style={{ position: 'relative', width: '100%', height: '100%', padding: pad, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 10 * s }}>
          {/* Banner fotográfico panorámico (height 520px en el PNG 1080p) */}
          <div style={{ position: 'relative', height: 260 * s, borderRadius: 20 * s, overflow: 'hidden', flexShrink: 0, boxShadow: '0 14px 34px rgba(0,0,0,0.45)' }}>
            <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
            <div style={{ position: 'absolute', inset: 0, background: t.light ? 'linear-gradient(180deg, transparent 42%, rgba(15,23,42,0.45) 100%)' : 'linear-gradient(180deg, transparent 42%, rgba(8,10,18,0.62) 100%)' }} />
            <div style={{ position: 'absolute', bottom: 12 * s, left: 14 * s, right: 14 * s, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 * s }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 10.5 * s, fontWeight: 800, letterSpacing: 1.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.88)' }}>
                  {(brand.slogan || 'NUESTRAS RAZONES').toUpperCase()}
                </p>
                <p style={{ margin: 0, fontFamily: `"${t.font}", system-ui, sans-serif`, fontSize: 26 * s, fontWeight: 900, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {brand.name || 'Tu Negocio'}
                </p>
              </div>
              <span style={{ background: 'rgba(6,8,14,0.72)', border: '1px solid rgba(255,255,255,0.32)', borderRadius: 999, padding: `${6 * s}px ${12 * s}px`, fontSize: 11 * s, fontWeight: 800, color: '#ffffff', whiteSpace: 'nowrap' }}>
                📍 {brand.municipality || 'Gachetá'}
              </span>
            </div>
          </div>
          <Headline texts={ht('3 RAZONES', 'PARA ELEGIRNOS HOY')} t={t} s={s} size={42} />
          {/* 3 tarjetas Bento gigantes (240px @1080) con números 01/02/03 a 72px */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10 * s }}>
            {[0, 1, 2].map((i) => {
              const b = benefits[i] ?? ['🥇 Calidad garantizada', '⚡ Atención inmediata', '📍 Cerca de ti'][i] ?? '';
              const { icon, body } = splitBenefit(b);
              return (
                <div
                  key={i}
                  style={{
                    ...g.card,
                    flex: 1, minHeight: 0,
                    borderRadius: 18 * s,
                    display: 'flex', alignItems: 'center', gap: 14 * s,
                    padding: `${12 * s}px ${16 * s}px`,
                    boxShadow: t.light ? '0 2px 10px rgba(15,23,42,0.10)' : '0 6px 18px rgba(0,0,0,0.35)',
                  }}
                >
                  <span style={{ fontFamily: `"${t.font}", system-ui, sans-serif`, fontSize: 36 * s, fontWeight: 900, color: t.accent2, lineHeight: 1 }}>
                    {`0${i + 1}`}
                  </span>
                  <div style={{ width: 1, alignSelf: 'stretch', background: t.light ? 'rgba(15,23,42,0.14)' : 'rgba(255,255,255,0.20)' }} />
                  <span style={{ fontSize: 28 * s, lineHeight: 1 }}>{icon}</span>
                  <span style={{ flex: 1, fontSize: 16.5 * s, fontWeight: 700, color: t.text, lineHeight: 1.2 }}>{body}</span>
                </div>
              );
            })}
          </div>
          {/* Barra inferior: QR + contacto */}
          {showQr && (
            <div style={{ ...g.card, borderRadius: 16 * s, display: 'flex', alignItems: 'center', gap: 12 * s, padding: `${8 * s}px ${12 * s}px`, flexShrink: 0 }}>
              {qrUrl && (
                <div style={{ background: '#ffffff', borderRadius: 8 * s, padding: 4 * s, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', flexShrink: 0 }}>
                  <img src={qrUrl} alt="QR" style={{ width: 58 * s, height: 58 * s, display: 'block' }} />
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 * s }}>
                <p style={{ margin: 0, fontSize: 13 * s, fontWeight: 900, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {brand.name || 'Tu Negocio'}
                </p>
                <p style={{ margin: 0, fontSize: 11.5 * s, fontWeight: 700, color: t.light ? 'rgba(15,23,42,0.65)' : t.sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  💬 {brand.phoneDisplay || 'Escríbenos'} · 📍 {brand.municipality || 'Gachetá'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═══ PIEZA 4 · 📲 CIERRE & UBICACIÓN QR (foto en ventana superior + ═══
  // ═══ badge de ubicación + QR CENTRAL GIGANTE 420px + destino elegido) ═══
  if (piece === 3) {
    const qrBig = 210 * s; // 420×420px en el PNG 1080p
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
        <ScenicBg url={photoUrl} t={t} frame />
        <div style={{ position: 'relative', width: '100%', height: '100%', padding: pad, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 * s }}>
          {/* Foto en ventana superior */}
          <div style={{ position: 'relative', width: '100%', height: 180 * s, borderRadius: 18 * s, overflow: 'hidden', flexShrink: 0, boxShadow: '0 14px 34px rgba(0,0,0,0.48)' }}>
            <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 55%, rgba(6,8,14,0.45) 100%)' }} />
          </div>
          {/* Badge de ubicación */}
          <div style={{ ...g.chip, borderRadius: 999, padding: `${7 * s}px ${16 * s}px`, fontSize: 12 * s, fontWeight: 900, letterSpacing: 0.8, textTransform: 'uppercase', whiteSpace: 'nowrap', flexShrink: 0 }}>
            📍 Encuéntranos en {brand.address || brand.municipality || 'Gachetá'}
          </div>
          <Headline texts={ht('ESCANEA EL CÓDIGO', 'Y TE ATENDEMOS YA')} t={t} s={s} size={34} />
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
                {qrLabel || '📱 ESCANEA EL QR'}
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
            <Headline texts={texts} t={{ ...t, text: '#ffffff' }} s={s} size={42} align="center" />
            <div style={{ color: '#ffffff' }}>
              <SubHead text={texts.sub} t={t} s={s} color="rgba(255,255,255,0.92)" />
              {showBenefits && benefits.length > 0 && <div style={{ marginTop: 10 * s }}><BenefitPills items={benefits} t={t} s={s} /></div>}
              {isService && priceLabel && <div style={{ marginTop: 10 * s }}><CtaButton label={priceLabel} s={s} bg={t.accent2} color="#ffffff" /></div>}
            </div>
            {showQr && <Dock brand={{ ...brand }} t={{ ...t, light: false, text: '#ffffff', sub: 'rgba(255,255,255,0.8)' }} s={s} qrUrl={qrUrl} size={dockQrSize} qrLabel={qrLabel} />}
          </div>
        </div>
      );
      break;
    }
    case 'diagonal': {
      // ⚡ Corte diagonal dinámico (ángulo de 14°) con insignia flotante.
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 * s, height: '100%' }}>
          <Badge text={badge} t={t} s={s} />
          {photoBlock(undefined, 'polygon(0 0, 100% 0, 100% 86%, 0 100%)')}
          <div style={{ height: 4 * s, background: `linear-gradient(90deg, ${t.accent}, ${t.accent2})`, borderRadius: 999, marginTop: -26 * s, transform: 'rotate(-1.5deg)' }} />
          <Headline texts={texts} t={t} s={s} size={42} align="center" />
          {contentBlocks('center')}
          {masterDock}
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
          <Headline texts={texts} t={t} s={s} size={42} align="center" />
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
          <Headline texts={texts} t={t} s={s} size={42} align="center" />
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
          <Headline texts={texts} t={t} s={s} size={42} align="center" />
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
            <div style={{ flex: 1 }}><Headline texts={texts} t={t} s={s} size={40} align="left" /></div>
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
            <Headline texts={texts} t={t} s={s} size={42} align="left" />
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
            <Headline texts={texts} t={{ ...t, text: '#111827', accent: '#111827', accent2: t.accent2 }} s={s} size={42} align="center" />
          </div>
          <div style={{ ...hard, background: t.light ? 'rgba(255,255,255,0.85)' : '#ffffff', padding: `${12 * s}px ${16 * s}px`, display: 'flex', flexDirection: 'column', gap: 8 * s }}>
            <SubHead text={texts.sub} t={{ ...t, text: '#111827', sub: '#3f3f46' }} s={s} align="center" />
            {showBenefits && benefits.length > 0 && <BenefitCards items={benefits} t={{ ...t, light: true, text: '#111827' }} s={s} />}
            {isService && priceLabel && <CtaButton label={priceLabel} s={s} bg="#111827" color="#ffffff" />}
          </div>
          {showQr && (
            <div style={{ height: dockHeight }}>
              <Dock brand={brand} t={{ ...t, light: true, text: '#111827' }} s={s} qrUrl={qrUrl} size={dockQrSize} qrLabel={qrLabel} />
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
            <Headline texts={texts} t={t} s={s} size={42} align="center" />
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
            <Headline texts={texts} t={t} s={s} size={42} align="left" />
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
            <Headline texts={texts} t={t} s={s} size={42} align="center" />
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
          <Headline texts={texts} t={t} s={s} size={42} align="center" />
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
          <Headline texts={texts} t={t} s={s} size={42} align="center" />
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
          <Headline texts={texts} t={t} s={s} size={42} align="center" />
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
              <Headline texts={texts} t={t} s={s} size={34} align="center" />
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
    default: {
      // 🏆 Bento Agency Pro (por defecto): tarjetas modulares de cristal.
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 * s, height: '100%' }}>
          <Badge text={badge} t={t} s={s} />
          {photoBlock()}
          <Headline texts={texts} t={t} s={s} size={42} align="center" />
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
