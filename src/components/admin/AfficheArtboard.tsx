/**
 * 🎨 MOTOR DE DISEÑO EDITORIAL V11 (html-to-image)
 *
 * Artboard HTML/CSS/SVG de nivel agencia a 540×960 (Historia 9:16) o 540×540
 * (Post 1:1), exportado con `toPng(node, { pixelRatio: 2 })` → PNG 1080×1920
 * ultra-nítido. Ventajas sobre el canvas 2D plano:
 *  · Tipografías reales de Google Fonts (Anton, Playfair, Space Grotesk…).
 *  · CERO palabras pegadas (el navegador compone el texto, jamás se superpone).
 *  · Sombras 3D multicapa, gradientes reales, texturas CSS/SVG, clip-path.
 *  · El sello va FUERA de la foto (nunca la tapa) y el layout es flex-column:
 *    el área de foto absorbe el espacio sobrante → cero huecos vacíos.
 */

import type { CSSProperties } from 'react';

export type AfficheFormat = 'story' | 'square';
export type AfficheLayout = 'bento' | 'magazine' | 'diagonal' | 'swiss' | 'polaroid' | 'portal' | 'arc' | 'strip';
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

/** V11: 12 fondos texturizados de nivel Behance (CSS puro, sin imágenes externas). */
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
}

const money = (v: number): string => `$${v.toLocaleString('es-CO')}`;

/** Foto con recorte, zoom y posición vertical (100% nítida, sin overlays). */
function Photo({
  url, zoom, posY, style,
}: {
  url: string | null;
  zoom: number;
  posY: number;
  style?: CSSProperties;
}) {
  if (!url) {
    return (
      <div style={{ width: '100%', height: '100%', ...style }}>
        <div
          style={{
            width: '100%', height: '100%', borderRadius: 'inherit',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.25)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <div style={{ width: 96, height: 96, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 70, height: 70, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.22)' }} />
          </div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', borderRadius: 'inherit', ...style }}>
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
          padding: `${7 * s}px ${16 * s}px`,
          borderRadius: 999,
          fontSize: 12 * s,
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

/** Titular a dos tonos con separación natural (cero palabras pegadas). */
function Headline({ texts, t, s, align = 'center', scale = 1 }: { texts: AfficheTexts; t: AfficheTheme; s: number; align?: 'center' | 'left'; scale?: number }) {
  return (
    <div style={{ textAlign: align }}>
      <p
        style={{
          margin: 0,
          fontFamily: `"${t.font}", system-ui, sans-serif`,
          fontSize: (46 * scale * s).toFixed(1),
          lineHeight: 1.04,
          color: t.text,
          fontWeight: 900,
          textShadow: t.light ? 'none' : '0 2px 14px rgba(0,0,0,0.35)',
        }}
      >
        {texts.plain.trim()}{' '}
        <span style={{ color: t.accent2 }}>{texts.highlight.trim()}</span>
      </p>
    </div>
  );
}

/** Tarjetas de beneficios con icono grande (grilla Bento). */
function BenefitCards({ items, t, s }: { items: string[]; t: AfficheTheme; s: number }) {
  const g = glass(t);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 * s }}>
      {items.slice(0, 3).map((b, i) => {
        const m = /^\p{Extended_Pictographic}/u.exec(b.trim());
        const icon = m ? m[0] : '✅';
        const body = m ? b.trim().slice(icon.length).trim() : b.trim();
        return (
          <div
            key={i}
            style={{
              ...g.card,
              borderRadius: 14 * s,
              display: 'flex', alignItems: 'center', gap: 12 * s,
              padding: `${11 * s}px ${14 * s}px`,
              boxShadow: t.light ? '0 1px 6px rgba(15,23,42,0.08)' : '0 4px 14px rgba(0,0,0,0.30)',
            }}
          >
            <span style={{ fontSize: 22 * s, lineHeight: 1 }}>{icon}</span>
            <span style={{ fontSize: 15.5 * s, fontWeight: 700, color: t.text, lineHeight: 1.15 }}>{body}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Píldoras de beneficios centradas (layouts premium). */
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
            padding: `${8 * s}px ${14 * s}px`,
            fontSize: 13 * s, fontWeight: 700, color: t.text,
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
        padding: `${8 * s}px ${16 * s}px`,
        display: 'flex', alignItems: 'baseline', gap: 8 * s,
        boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
      }}
    >
      <span style={{ fontFamily: `"${t.font}", system-ui, sans-serif`, fontSize: (big ? 34 : 26) * s, fontWeight: 900, color: '#fde047', lineHeight: 1 }}>
        {money(promo)}
      </span>
      {showNormal && brand.normalPrice != null && (
        <span style={{ fontSize: 12 * s, color: '#e2e8f0', textDecoration: 'line-through' }}>{money(brand.normalPrice)}</span>
      )}
    </div>
  );
}

/**
 * 📲 Dock de Conversión V11: negocio + rubro/ubicación + botón WhatsApp
 * + CÓDIGO QR GIGANTE (≥135px en lienzo 540 = 270px reales en 1080p)
 * sobre blanco puro con UNA sola etiqueta: "📱 ESCANEA EL QR".
 */
function Dock({ brand, t, s, qrUrl, size }: { brand: AfficheBrand; t: AfficheTheme; s: number; qrUrl: string | null; size: number }) {
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
        <p style={{ margin: 0, fontSize: 9.5 * s, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: t.light ? 'rgba(15,23,42,0.62)' : 'rgba(255,255,255,0.66)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {(brand.slogan || 'ATENCIÓN INMEDIATA').toUpperCase()}
        </p>
        <p style={{ margin: 0, fontFamily: `"${t.font}", system-ui, sans-serif`, fontSize: 25 * s, fontWeight: 900, color: t.text, lineHeight: 1.05, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {brand.name || 'Tu Negocio'}
        </p>
        <p style={{ margin: 0, fontSize: 11 * s, fontWeight: 600, color: t.light ? 'rgba(15,23,42,0.66)' : t.sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          📍 {brand.address || brand.municipality || 'Gachetá'}
        </p>
        <div
          style={{
            background: '#16a34a', color: '#ffffff',
            borderRadius: 999,
            padding: `${7 * s}px ${13 * s}px`,
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
            📱 ESCANEA EL QR
          </p>
        </div>
      )}
    </div>
  );
}

/** Pie de foto dentro del marco polaroid. */
function PolaroidCaption({ text, s }: { text: string; s: number }) {
  return (
    <p style={{ margin: 0, fontSize: 12 * s, fontWeight: 700, color: '#1f2937', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
      {text}
    </p>
  );
}

/**
 * Artboard principal: flex-column que absorbe el sobrante en la foto
 * (cero espacio desperdiciado) y rota entre las 8 arquitecturas de agencia.
 */
export function AfficheArtboard(props: AfficheProps): React.ReactElement {
  const { themeId, layout, format, piece, brand, texts, badge, showPrice, showBenefits, showQr, photoUrl, qrUrl, photoZoom, photoPosY } = props;
  const t = AFFICHE_THEMES.find((x) => x.id === themeId) ?? AFFICHE_THEMES[1];
  const s = format === 'square' ? 0.58 : 1;
  const W = 540;
  const H = format === 'square' ? 540 : 960;
  const pad = 18 * s;

  // ── Énfasis por pieza (las 4 piezas de la campaña) ──
  const headlineScale = piece === 1 ? 1.22 : piece === 3 ? 0.9 : 1;
  const showPriceNow = showPrice && piece !== 1;
  const dockQrSize = (piece === 3 ? 148 : 138) * s;
  const dockHeight = (piece === 3 ? 196 : 184) * s;
  const benefits = texts.benefits.filter(Boolean);

  const priceOverlay = showPriceNow && brand.promoPrice != null;
  const priceLabel = texts.cta.trim();

  const photoBlock = (extra?: CSSProperties, clip?: string): React.ReactElement => (
    <div
      style={{
        flex: 1, minHeight: 0, position: 'relative',
        borderRadius: 26 * s,
        ...(clip ? { clipPath: clip, borderRadius: 0 } : {}),
        ...extra,
      }}
    >
      <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
      {priceOverlay && (
        <div style={{ position: 'absolute', bottom: 14 * s, right: 14 * s }}>
          <PricePill brand={brand} t={t} s={s} big={piece === 2} />
        </div>
      )}
    </div>
  );

  const contentBlocks = (align: 'center' | 'left' = 'center', pills = false): React.ReactElement => (
    <>
      {texts.sub.trim() && (
        <p style={{ margin: 0, fontSize: 14 * s, fontWeight: 600, color: t.sub, textAlign: align, lineHeight: 1.3 }}>
          {texts.sub.trim()}
        </p>
      )}
      {showBenefits && benefits.length > 0 && (pills
        ? <BenefitPills items={benefits} t={t} s={s} />
        : <BenefitCards items={benefits} t={t} s={s} />)}
      {showPriceNow && brand.promoPrice == null && priceLabel && (
        <p style={{ margin: 0, fontSize: 17 * s, fontWeight: 800, color: t.accent2, textAlign: align }}>
          {priceLabel}
        </p>
      )}
    </>
  );

  let body: React.ReactElement;
  switch (layout) {
    case 'magazine': {
      // Portada Full-Bleed: foto al 100% de fondo + degradado cinematográfico.
      body = (
        <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 22 * s, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0 }}>
            <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
          </div>
          <div
            style={{
              position: 'absolute', inset: 0,
              background: t.light
                ? 'linear-gradient(180deg, rgba(0,0,0,0.08) 30%, rgba(8,10,18,0.72) 74%, rgba(8,10,18,0.92) 100%)'
                : 'linear-gradient(180deg, rgba(0,0,0,0.18) 22%, rgba(8,10,18,0.62) 60%, rgba(8,10,18,0.90) 100%)',
            }}
          />
          <div style={{ position: 'absolute', top: pad, left: 0, right: 0 }}>
            <Badge text={badge} t={t} s={s} />
          </div>
          <div style={{ position: 'absolute', left: pad, right: pad, bottom: pad, display: 'flex', flexDirection: 'column', gap: 10 * s }}>
            <Headline texts={texts} t={{ ...t, text: '#ffffff', sub: 'rgba(255,255,255,0.85)' }} s={s} align="center" scale={headlineScale} />
            <div style={{ color: '#ffffff' }}>{contentBlocks('center', true)}</div>
            {showQr && <Dock brand={{ ...brand }} t={{ ...t, light: false, text: '#ffffff', sub: 'rgba(255,255,255,0.8)' }} s={s} qrUrl={qrUrl} size={dockQrSize} />}
          </div>
        </div>
      );
      break;
    }
    case 'diagonal': {
      // Corte diagonal dinámico con insignia flotante en el corte.
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 * s, height: '100%' }}>
          <Badge text={badge} t={t} s={s} />
          {photoBlock(undefined, 'polygon(0 0, 100% 0, 100% 88%, 0 100%)')}
          <Headline texts={texts} t={t} s={s} align="center" scale={headlineScale} />
          {contentBlocks('center')}
          {showQr && <div style={{ height: dockHeight }}><Dock brand={brand} t={t} s={s} qrUrl={qrUrl} size={dockQrSize} /></div>}
        </div>
      );
      break;
    }
    case 'polaroid': {
      // Polaroid 3D inclinada: marco blanco rotado con sombra profunda.
      const fw = 330 * s;
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 * s, height: '100%' }}>
          <Badge text={badge} t={t} s={s} />
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div
              style={{
                width: fw,
                transform: 'rotate(-2deg)',
                background: '#fdfdf8',
                borderRadius: 12 * s,
                padding: 12 * s,
                boxShadow: '0 18px 40px rgba(0,0,0,0.45)',
                display: 'flex', flexDirection: 'column', gap: 8 * s,
              }}
            >
              <div style={{ height: 250 * s, borderRadius: 6 * s, overflow: 'hidden' }}>
                <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
              </div>
              <PolaroidCaption text={(texts.sub.trim() || brand.product).slice(0, 46)} s={s} />
            </div>
          </div>
          <Headline texts={texts} t={t} s={s} align="center" scale={headlineScale} />
          {contentBlocks('center', true)}
          {showQr && <div style={{ height: dockHeight }}><Dock brand={brand} t={t} s={s} qrUrl={qrUrl} size={dockQrSize} /></div>}
        </div>
      );
      break;
    }
    case 'arc': {
      // Arco Imperial: foto en arco con doble borde dorado.
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 * s, height: '100%' }}>
          <Badge text={badge} t={t} s={s} />
          <div
            style={{
              flex: 1, minHeight: 0, position: 'relative',
              borderRadius: `270px 270px ${24 * s}px ${24 * s}px`,
              border: `3px solid ${t.accent2}`,
              boxShadow: `0 0 0 6px ${t.light ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.10)'}, 0 14px 34px rgba(0,0,0,0.40)`,
              overflow: 'hidden',
            }}
          >
            <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
            {priceOverlay && (
              <div style={{ position: 'absolute', bottom: 14 * s, right: 14 * s }}>
                <PricePill brand={brand} t={t} s={s} big={piece === 2} />
              </div>
            )}
          </div>
          <Headline texts={texts} t={t} s={s} align="center" scale={headlineScale} />
          {contentBlocks('center', true)}
          {showQr && <div style={{ height: dockHeight }}><Dock brand={brand} t={t} s={s} qrUrl={qrUrl} size={dockQrSize} /></div>}
        </div>
      );
      break;
    }
    case 'portal': {
      // Portal Circular: foto en círculo con anillos orbitales.
      const d = 240 * s;
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 * s, height: '100%' }}>
          <Badge text={badge} t={t} s={s} />
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ position: 'relative', width: d + 26 * s, height: d + 26 * s }}>
              <div
                style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  border: `2px solid ${t.accent2}`,
                  boxShadow: `0 0 0 ${8 * s}px ${t.light ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.08)'}`,
                }}
              />
              <div style={{ position: 'absolute', inset: 10 * s, borderRadius: '50%', overflow: 'hidden', border: `3px solid ${t.accent2}` }}>
                <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
              </div>
              {priceOverlay && (
                <div style={{ position: 'absolute', bottom: -6 * s, right: -4 * s }}>
                  <PricePill brand={brand} t={t} s={s} big={piece === 2} />
                </div>
              )}
            </div>
          </div>
          <Headline texts={texts} t={t} s={s} align="center" scale={headlineScale} />
          {contentBlocks('center')}
          {showQr && <div style={{ height: dockHeight }}><Dock brand={brand} t={t} s={s} qrUrl={qrUrl} size={dockQrSize} /></div>}
        </div>
      );
      break;
    }
    case 'swiss': {
      // Grilla Suiza: retícula de precisión con numeración gigante.
      const line = t.light ? 'rgba(15,23,42,0.22)' : 'rgba(255,255,255,0.25)';
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 * s, height: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${line}`, paddingBottom: 8 * s }}>
            <Badge text={badge} t={t} s={s} />
            <span style={{ fontFamily: `"${t.font}", system-ui, sans-serif`, fontSize: 20 * s, fontWeight: 900, color: t.accent }}>{piece + 1}/4</span>
          </div>
          <div style={{ flex: 1, minHeight: 0, position: 'relative', border: `1px solid ${line}`, borderRadius: 8 * s, overflow: 'hidden' }}>
            <Photo url={photoUrl} zoom={photoZoom} posY={photoPosY} />
            {priceOverlay && (
              <div style={{ position: 'absolute', bottom: 12 * s, right: 12 * s }}>
                <PricePill brand={brand} t={t} s={s} big={piece === 2} />
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 * s }}>
            <span style={{ fontFamily: `"${t.font}", system-ui, sans-serif`, fontSize: 30 * s, fontWeight: 900, color: t.accent }}>01</span>
            <div style={{ flex: 1 }}><Headline texts={texts} t={t} s={s} align="left" scale={headlineScale} /></div>
          </div>
          {contentBlocks('left')}
          {showQr && <div style={{ height: dockHeight }}><Dock brand={brand} t={t} s={s} qrUrl={qrUrl} size={dockQrSize} /></div>}
        </div>
      );
      break;
    }
    case 'strip': {
      // Franjas de Impacto: foto, banda de titular a acento y dock.
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 * s, height: '100%' }}>
          <Badge text={badge} t={t} s={s} />
          {photoBlock()}
          <div
            style={{
              background: t.light ? 'rgba(15,23,42,0.85)' : 'rgba(8,10,18,0.55)',
              borderRadius: 14 * s,
              padding: `${12 * s}px ${14 * s}px`,
              borderLeft: `6px solid ${t.accent2}`,
            }}
          >
            <Headline texts={{ ...texts }} t={{ ...t, text: t.light ? '#ffffff' : t.text }} s={s} align="left" scale={headlineScale} />
          </div>
          {contentBlocks('center')}
          {showQr && <div style={{ height: dockHeight }}><Dock brand={brand} t={t} s={s} qrUrl={qrUrl} size={dockQrSize} /></div>}
        </div>
      );
      break;
    }
    default: {
      // Layout A · Bento Modular Pro (por defecto).
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 * s, height: '100%' }}>
          <Badge text={badge} t={t} s={s} />
          {photoBlock()}
          <Headline texts={texts} t={t} s={s} align="center" scale={headlineScale} />
          {contentBlocks('center')}
          {showQr && <div style={{ height: dockHeight }}><Dock brand={brand} t={t} s={s} qrUrl={qrUrl} size={dockQrSize} /></div>}
        </div>
      );
    }
  }

  return (
    <div
      style={{
        width: W, height: H, flexShrink: 0,
        background: t.bg,
        backgroundSize: t.bgSize ?? '100% 100%, 100% 100%, 100% 100%, 100% 100%',
        color: t.text,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        borderRadius: 22 * s,
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute' }} />
      <div style={{ width: '100%', height: '100%', padding: pad, boxSizing: 'border-box' }}>{body}</div>
    </div>
  );
}
