/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🚀 AGENCIA IA & MULTI-WHATSAPP STUDIO V11 (exclusivo del administrador)
 *
 * V11.0 — Motor de diseño editorial HTML/CSS/SVG a 1080p con `html-to-image`:
 *  · El afiche ya NO se dibuja a mano con `ctx.fillRect` (plano y con textos
 *    superpuestos): ahora es un artboard HTML real (540×960 / 540×540) con
 *    tipografías de Google Fonts, sombras 3D, gradientes y clip-paths,
 *    exportado con `toPng(node, { pixelRatio: 2 })` → PNG 1080×1920 nítido.
 *  · Fin del banner "🐝 pollinations.ai — At its limit right now": toda foto
 *    IA se inspecciona en un canvas 16×16 y si trae el cartel de bloqueo se
 *    descarta; el sistema cae al Banco Fotográfico Comercial HD (120+ fotos
 *    reales de Unsplash en 20 categorías, rotando en cada clic).
 *  · IA infalible: sanitizador JSON + cadena de modelos con reintento +
 *    motor sintético local `synthesizeSmartCampaignFromBrief` que SIEMPRE
 *    llena nombre, categoría, titular, subtítulo, sello, 3 beneficios, las
 *    5 pestañas de copy, los 3 mensajes de WhatsApp y los 4 despachos.
 *  · QR GIGANTE (≥135px en lienzo 540 → 270px en el PNG 1080p) con UNA
 *    sola etiqueta: "📱 ESCANEA EL QR".
 * Piezas: 0 bytes en Supabase (todo vive en el navegador y se autoguarda).
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { toPng, getFontEmbedCSS } from 'html-to-image';
import { Check, Copy, Dices, Download, ImagePlus, Loader2, Send, Sparkles, Trash2, Wand2 } from 'lucide-react';
import type { Offer, Profile } from '../../types';
import { categoryMeta } from '../../types';
import {
  extractBrandPaletteWithAI,
  generateArtDirection,
  generateCampaignCopy,
  normSpaces,
  synthesizeCampaign,
  synthesizeSmartCampaignFromBrief,
} from '../../services/gemini.service';
import type { ArtDirection, CampaignFocus, MarketingCampaign, PriceMode } from '../../services/gemini.service';
import { loadBankPhoto, isPollinationsBlockImage, guessPhotoCategory, PHOTO_BANK, PHOTO_GALLERY_TABS } from '../../utils/commercialPhotoBank';
import { extractPaletteFromImage } from '../../utils/colorPalette';
import type { ExtractedBrandPalette } from '../../utils/colorPalette';
import { generateStyledQrDataUrl, QR_STYLES } from '../../utils/styledQr';
import type { QrStyle } from '../../utils/styledQr';
import {
  AfficheArtboard,
  AFFICHE_THEMES,
  AFFICHE_TYPOS,
} from './AfficheArtboard';
import type { AfficheFormat, AfficheLayout, AffichePiece, AfficheProps, BenefitPresentation, DockVariant } from './AfficheArtboard';
import { useToast } from '../ui/Toast';
import { cx, formatCOP } from '../../utils/format';
import { waLink } from '../../utils/whatsapp';
import { clearDraft, loadDraft, saveDraft } from '../../utils/draft';

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

type Format = AfficheFormat;
type Layout = AfficheLayout;
type Piece = AffichePiece;

const AFFICHE_LAYOUTS: Array<{ id: Layout; label: string; hint: string }> = [
  { id: 'bento', label: '🏆 Bento Agency Pro', hint: 'Tarjetas modulares de cristal' },
  { id: 'magazine', label: '📸 Vogue Magazine', hint: 'Foto 100% + tipografía gigante' },
  { id: 'diagonal', label: '⚡ Corte Diagonal', hint: 'Imagen en ángulo de 14°' },
  { id: 'arc', label: '🏛️ Arco Imperial', hint: 'Arco con doble filete dorado' },
  { id: 'polaroid', label: '🖼️ Polaroid 3D Studio', hint: 'Marco blanco rotado -2.5°' },
  { id: 'portal', label: '🎯 Radar Circular Neón', hint: 'Medallón con anillos de luz' },
  { id: 'swiss', label: '📐 Swiss Grid Minimal', hint: 'Retícula fina de precisión' },
  { id: 'split', label: '🔥 Split Asimétrico 50/50', hint: 'Columna de acento vertical' },
  { id: 'brutal', label: '💥 Neobrutalismo Pop', hint: 'Bordes negros y sombra dura' },
  { id: 'vip', label: '🥂 VIP Gold & Velvet', hint: 'Doble marco ornamental de lujo' },
  { id: 'cyber', label: '🚀 Cyber Glass Dashboard', hint: 'Paneles HUD holográficos' },
  { id: 'rustic', label: '🪵 Rústico Artesanal', hint: 'Sello y costuras gourmet' },
  { id: 'retail', label: '🏷️ Mega-Promo Retail', hint: 'Cinta diagonal de oferta' },
  { id: 'eco', label: '🌿 Eco-Editorial Orgánico', hint: 'Formas suaves tono tierra' },
  { id: 'cinema', label: '🎬 Cinema Widescreen', hint: 'Bandas de cine y luces' },
  { id: 'float', label: '💎 Cristales Flotantes 3D', hint: 'Tarjetas superpuestas 3D' },
  // 🚀 V19 · 8 arquitecturas futuristas nuevas (17–24)
  { id: 'hud', label: '🚀 Holographic Cyber Frame', hint: 'Esquinas HUD luminosas' },
  { id: 'resort', label: '🏖️ Resort & Pool Paradise', hint: 'Ondas y tarjetas solares' },
  { id: 'menu', label: '🍔 Gourmet Menu Spotlight', hint: 'Foto circular + sello 3D' },
  { id: 'clinic', label: '🩺 Medical & Clinic Trust', hint: 'Cápsulas blancas/zafiro' },
  { id: 'agro', label: '🚜 Agro & Heavy Duty Pro', hint: 'Franjas industriales pro' },
  { id: 'diamond', label: '💎 Luxury Diamond Showcase', hint: 'Recorte diamante + oro' },
  { id: 'flash', label: '⚡ Flash Promo Explosion', hint: 'Bandas de oferta relámpago' },
  { id: 'bento3d', label: '🌐 Futuristic Bento 3D', hint: 'Mosaico de cristal neón' },
  // 💥 V21/V22 · composiciones asimétricas y orgánicas (25–30)
  { id: 'diagx', label: '📐 Split Diagonal Extremo', hint: 'Corte esquina a esquina + borde neón' },
  { id: 'orbits', label: '🌀 Círculos Intersectados', hint: 'Medallón + disco de precio sólido' },
  { id: 'bleed', label: '📰 Tipografía Sangrada', hint: 'Titular gigante que sangra los bordes' },
  { id: 'zen', label: '🍃 Bento Japonés Zen', hint: 'Cajas de 1px con mucho aire' },
  { id: 'immersive', label: '🌊 Tipografía Inmersiva', hint: 'Foto + blend tipográfico + Long Shadow' },
  { id: 'collage', label: '🧩 Collage Asimétrico', hint: 'Múltiples tomas + texto vertical lateral' },
];

// 🎯 V21 · Estética de agencia: sellos SIN emojis (el afiche dibuja su
// propia iconografía vectorial; el sello es tipografía pura).
const BADGE_PRESETS: Array<{ id: string; label: string }> = [
  { id: 'calidad', label: 'CALIDAD GARANTIZADA' },
  { id: 'tiempo', label: 'OFERTA POR TIEMPO LIMITADO' },
  { id: 'especialidad', label: 'ESPECIALIDAD DE LA CASA' },
  { id: 'verificado', label: 'NEGOCIO VERIFICADO' },
];

const FOCUS_OPTIONS: Array<{ id: CampaignFocus; label: string }> = [
  { id: 'remate', label: '🔥 Remate de precios' },
  { id: 'prestigio', label: '👑 Prestigio / premium' },
  { id: 'confianza', label: '🤝 Confianza / cercanía' },
  { id: 'viral', label: '⚡ Viral / llamativo' },
];

/** Descriptor fotográfico EN INGLÉS del enfoque (prompt de respaldo). */
const FOCUS_PHOTO_MOODS: Record<CampaignFocus, string> = {
  remate: 'close-up product hero shot, vibrant offer energy, warm rim light, 8k advertising photography, no text, no logos',
  prestigio: 'elegant premium scene, luxury tones, dramatic soft light, 8k editorial photography, no text, no logos',
  confianza: 'friendly team at work, natural daylight, trustworthy atmosphere, 8k commercial photography, no text, no logos',
  viral: 'eye-catching viral composition, bold colors, dynamic motion energy, 8k social media photography, no text, no logos',
};

// ── Utilidades ───────────────────────────────────────────────────────────────

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

/** 🧠 V11: carrera contra reloj — si la IA tarda más de `ms`, se rechaza y el
 *  motor sintético local toma el control (jamás cajas vacías). */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout-${ms}`)), ms);
    promise
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((e: unknown) => {
        clearTimeout(timer);
        reject(e);
      });
  });
}

/**
 * 🎲 V13 · ROTACIÓN GARANTIZADA DE FOTO: carga del banco reintenando con
 * sales distintas hasta conseguir una fotografía DIFERENTE a la anterior.
 * Así, cada clic en ✨ o 🎲 trae una toma nueva (jamás la misma imagen).
 */
async function loadBankPhotoFresh(text: string, previousUrl: string | null): Promise<string | null> {
  let last: string | null = null;
  for (let i = 0; i < 5; i++) {
    const url = await loadBankPhoto(text, Math.floor(Math.random() * 1000));
    if (!url) return last;
    last = url;
    if (url !== previousUrl) return url;
  }
  return last;
}

// ═══════════════════════════════ Componente ═════════════════════════════════

type CopyTab = 'post' | 'grupos' | 'estados' | 'video' | 'cierres';

/** V13 · Destino del Código QR y del enlace del afiche. */
type QrMode = 'wa' | 'perfil' | 'oferta' | 'externo';

const QR_MODES: Array<{ id: QrMode; icon: string; title: string; hint: string }> = [
  { id: 'wa', icon: '💬', title: 'Directo al WhatsApp con mensaje inicial', hint: 'Recomendado: cierre inmediato de ventas' },
  { id: 'perfil', icon: '🏪', title: 'Al Perfil Oficial del Local en Impulso', hint: 'Mapa, ubicación y sus ofertas (?comercio=ID)' },
  { id: 'oferta', icon: '🔥', title: 'Directo a la Oferta en Impulso', hint: 'Reserva rápida en 1 clic (?oferta=ID)' },
  { id: 'externo', icon: '🌐', title: 'Enlace externo personalizado', hint: 'Instagram, página web o Google Maps' },
];

/** Leyenda del QR + indicador de la pieza 4 según el destino elegido. */
const QR_META: Record<QrMode, { label: string; hint: string }> = {
  wa: { label: 'Escanea y Cotiza', hint: 'Escanea para ir directo a nuestro WhatsApp' },
  perfil: { label: 'Ver Perfil y Ofertas', hint: 'Escanea para ver nuestra ubicación y ofertas en Impulso' },
  oferta: { label: 'Aparta tu Cupo Hoy', hint: 'Escanea y aparta tu cupo al instante en Impulso' },
  externo: { label: 'Visita Nuestro Enlace', hint: 'Escanea para visitar nuestra página o Instagram oficial' },
};

/** V14 · Redes sociales objetivo del lanzador en 1 clic. */
type SocialMode = 'wa' | 'ig' | 'fb' | 'tt';

const SOCIAL_MODES: Array<{ id: SocialMode; icon: string; label: string; hint: string }> = [
  { id: 'wa', icon: '🟢', label: 'WhatsApp', hint: 'Estados 9:16 + grupos + difusión' },
  { id: 'ig', icon: '📸', label: 'Instagram', hint: 'Post 1:1 / Historia + hashtags IA' },
  { id: 'fb', icon: '📘', label: 'Facebook', hint: 'Muro, grupos y Marketplace' },
  { id: 'tt', icon: '🎵', label: 'TikTok / Reels', hint: 'Guion 15 s + teleprompter' },
];

/** Etiqueta del botón lanzador según la red elegida. */
const SOCIAL_LAUNCH_LABEL: Record<SocialMode, string> = {
  wa: '📲 Enviar Afiche + Texto a WhatsApp Ahora',
  ig: '📸 Preparar y Publicar en Instagram',
  fb: '📘 Publicar en Facebook en 1 Clic',
  tt: '🎵 Preparar mi Publicación en TikTok',
};

/** Payload de navigator.share (compatible con navegadores sin canShare). */
interface SharePayload {
  files?: File[];
  text?: string;
  title?: string;
}

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
  detectedCategory?: string;
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
  /** V13: selector de destino del QR y datos asociados. */
  qrMode?: QrMode;
  customWaGreeting?: string;
  externalUrl?: string;
  /** V14: tipografía, red social objetivo y formato de Instagram. */
  fontIdx?: number;
  /** 🔍 V18: escala del titular guardada en el borrador (0.8–1.5). */
  headlineScale?: number;
  /** 🎨 V19/V21: estilo dinámico del QR, presentación de beneficios y geometría del dock. */
  qrStyle?: QrStyle;
  benefitStyle?: BenefitPresentation;
  dockVariant?: DockVariant;
  socialMode?: SocialMode;
  igFormat?: 'feed' | 'historia';
}

const DEFAULT_LINES: WaLine[] = [
  { title: 'Línea 1 · Ventas directas', hint: 'Recibe los pedidos del anuncio', number: '', message: '¡Hola! Vi el anuncio de {negocio} y me interesa {producto} 🙌 ¿Me dan más información?' },
  { title: 'Línea 2 · Domicilios / cotizaciones', hint: 'Despachos y cotizaciones', number: '', message: '¡Hola! Quiero pedir {producto} a domicilio 🛵 Mi dirección es:' },
  { title: 'Línea 3 · Planes / eventos', hint: 'Especiales, alianzas, cantidad', number: '', message: '¡Hola! Me interesan los planes especiales de {negocio} 📦 ¿Me cuentan opciones?' },
];

/** Bloque de copy listo para copiar (usado en las herramientas de venta). */
function CopyBlock({
  text,
  tag,
  onCopy,
  copied,
  inputCls,
  onWa,
}: {
  text: string;
  tag: string;
  onCopy: (t: string, k: string, l: string) => Promise<void>;
  copied: string | null;
  inputCls: string;
  /** V12: botón "📲 Enviar a WhatsApp" directo con el texto precargado. */
  onWa?: (t: string) => void;
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
      <div className="mt-1.5 flex gap-2">
        <button
          onClick={() => void onCopy(text, tag, 'Copy')}
          className="pressable flex flex-1 items-center justify-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-impulso-mint"
        >
          {copied === tag ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} Copiar
        </button>
        {onWa && (
          <button
            onClick={() => onWa(text)}
            className="pressable flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#25D366]/15 px-2 py-1 text-[10px] font-bold text-[#25D366]"
          >
            <Send className="h-3 w-3" /> Enviar a WhatsApp
          </button>
        )}
      </div>
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
  /** V12: categoría/rubro detectado del BRIEF (el dock del afiche lee SIEMPRE
   *  esto — jamás la categoría fija del comercio por defecto). */
  const [detectedCategory, setDetectedCategory] = useState('');

  // ── Textos del afiche ──
  const [texts, setTexts] = useState<Texts>({ plain: '', highlight: '', sub: '', benefits: ['', '', ''], cta: '', priceLabel: 'Cotiza sin costo · WhatsApp' });
  const [copied, setCopied] = useState<string | null>(null);
  const [copyTab, setCopyTab] = useState<CopyTab>('post');

  // ── Estudio gráfico (V11: artboard HTML en vez de canvas 2D) ──
  const [themeIdx, setThemeIdx] = useState(1);
  /** V14/V20: emparejamiento tipográfico elegido (índice en AFFICHE_TYPOS). */
  const [fontIdx, setFontIdx] = useState(0);
  /** 🔍 V18: escala del titular en el afiche (0.8 a 1.5 — slider en vivo). */
  const [headlineScale, setHeadlineScale] = useState(1.2);
  const [format, setFormat] = useState<Format>('story');
  const [layout, setLayout] = useState<Layout>('bento');
  const [piece, setPiece] = useState<Piece>(0);
  const [badgeMode, setBadgeMode] = useState<string>('calidad');
  const [badgeCustom, setBadgeCustom] = useState('');
  const [showPrice, setShowPrice] = useState(true);
  const [showBenefits, setShowBenefits] = useState(true);
  const [showQr, setShowQr] = useState(true);

  // ── V13 · Selector de destino y estilo del QR ──
  const [qrMode, setQrMode] = useState<QrMode>('wa');
  const [qrStyle, setQrStyle] = useState<QrStyle>('rounded');
  const [benefitStyle, setBenefitStyle] = useState<BenefitPresentation>('auto');
  const [dockVariant, setDockVariant] = useState<DockVariant>('auto');
  const [customWaGreeting, setCustomWaGreeting] = useState('');
  const [externalUrl, setExternalUrl] = useState('');

  // ── V14 · Lanzador por red social + galería visual + teleprompter ──
  const [socialMode, setSocialMode] = useState<SocialMode>('wa');
  const [igFormat, setIgFormat] = useState<'feed' | 'historia'>('feed');
  const [teleprompterOpen, setTeleprompterOpen] = useState(false);
  const [galleryTab, setGalleryTab] = useState<string>('sugeridas');
  /** Refs de los 2 artboards dedicados al lanzador (story 9:16 y square 1:1). */
  const socialRefs = useRef<{ story: HTMLDivElement | null; square: HTMLDivElement | null }>({ story: null, square: null });

  // ── V21 · HIPER-VARIABILIDAD COHERENTE: alterna entre 3 arquetipos distintos y nunca repite ──
  const lastStyleGroupRef = useRef<0 | 1 | 2>(0);
  const lastThemeIdxRef = useRef(themeIdx);
  const lastLayoutIdxRef = useRef<Layout>(layout);
  const lastFontIdxRef = useRef(fontIdx);
  const lastBenefitStyleRef = useRef<Exclude<BenefitPresentation, 'auto'>>('bento');
  const lastQrStyleRef = useRef<QrStyle>(qrStyle);
  const lastPhotoUrlRef = useRef<string | null>(null);

  // ── Fotografía y Paleta Dinámica de Marca (V22) ──
  const [customPhoto, setCustomPhoto] = useState<string | null>(null);
  const [extLogoUrl, setExtLogoUrl] = useState<string | null>(null);
  const [brandPalette, setBrandPalette] = useState<ExtractedBrandPalette | null>(null);
  const [useBrandPalette, setUseBrandPalette] = useState(true);
  const [paletteBusy, setPaletteBusy] = useState(false);
  const [surprising, setSurprising] = useState(false);
  const [photoZoom, setPhotoZoom] = useState(1);
  const [photoPosY, setPhotoPosY] = useState(0.5);
  const [photoBusy, setPhotoBusy] = useState(false);
  /** URL (dataURL o remota) del QR gigante — ya no se dibuja en canvas. */
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  /** Generación actual de foto: invalida descargas en segundo plano si el
   *  admin cambia o sube una foto manualmente mientras tanto. */
  const photoGenRef = useRef(0);
  /** Refs de los 4 artboards ocultos full-size (exportación toPng). */
  const packRefs = useRef<Array<HTMLDivElement | null>>([null, null, null, null]);
  /** CSS de las Google Fonts embebido una vez (para exportar con tipografía real). */
  const fontCssRef = useRef('');
  const [exporting, setExporting] = useState(false);

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
    if (typeof d.detectedCategory === 'string') setDetectedCategory(d.detectedCategory);
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
    if (typeof d.themeIdx === 'number' && d.themeIdx >= 0 && d.themeIdx < AFFICHE_THEMES.length) setThemeIdx(d.themeIdx);
    if (d.format === 'story' || d.format === 'square') setFormat(d.format);
    if (AFFICHE_LAYOUTS.some((l) => l.id === d.layout)) setLayout(d.layout as Layout);
    if (d.piece === 0 || d.piece === 1 || d.piece === 2 || d.piece === 3) setPiece(d.piece);
    if (typeof d.badgeMode === 'string') setBadgeMode(d.badgeMode);
    if (typeof d.badgeCustom === 'string') setBadgeCustom(sanitizeLegacy(d.badgeCustom));
    if (typeof d.showPrice === 'boolean') setShowPrice(d.showPrice);
    if (typeof d.showBenefits === 'boolean') setShowBenefits(d.showBenefits);
    if (typeof d.showQr === 'boolean') setShowQr(d.showQr);
    if (d.qrMode === 'wa' || d.qrMode === 'perfil' || d.qrMode === 'oferta' || d.qrMode === 'externo') setQrMode(d.qrMode);
    if (typeof d.customWaGreeting === 'string') setCustomWaGreeting(sanitizeLegacy(d.customWaGreeting));
    if (typeof d.externalUrl === 'string') setExternalUrl(sanitizeLegacy(d.externalUrl));
    if (typeof d.customPhoto === 'string' || d.customPhoto === null) setCustomPhoto(d.customPhoto);
    if (typeof d.photoZoom === 'number' && d.photoZoom >= 1 && d.photoZoom <= 2.2) setPhotoZoom(d.photoZoom);
    if (typeof d.photoPosY === 'number' && d.photoPosY >= 0 && d.photoPosY <= 1) setPhotoPosY(d.photoPosY);
    if (typeof d.fontIdx === 'number' && d.fontIdx >= 0 && d.fontIdx < AFFICHE_TYPOS.length) setFontIdx(d.fontIdx);
    if (typeof d.headlineScale === 'number' && d.headlineScale >= 0.8 && d.headlineScale <= 1.5) setHeadlineScale(d.headlineScale);
    if (d.qrStyle === 'rounded' || d.qrStyle === 'dots' || d.qrStyle === 'luxury' || d.qrStyle === 'cyber' || d.qrStyle === 'sharp') setQrStyle(d.qrStyle);
    if (
      d.benefitStyle === 'auto' ||
      d.benefitStyle === 'badges' ||
      d.benefitStyle === 'bento' ||
      d.benefitStyle === 'editorial' ||
      d.benefitStyle === 'ribbons' ||
      d.benefitStyle === 'watermark' ||
      d.benefitStyle === 'callouts'
    ) {
      setBenefitStyle(d.benefitStyle);
    }
    if (d.dockVariant === 'auto' || d.dockVariant === 'corner' || d.dockVariant === 'centered' || d.dockVariant === 'glass') {
      setDockVariant(d.dockVariant);
    }
    if (d.socialMode === 'wa' || d.socialMode === 'ig' || d.socialMode === 'fb' || d.socialMode === 'tt') setSocialMode(d.socialMode);
    if (d.igFormat === 'feed' || d.igFormat === 'historia') setIgFormat(d.igFormat);
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
      detectedCategory,
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
      qrMode,
      qrStyle,
      benefitStyle,
      dockVariant,
      customWaGreeting,
      externalUrl,
      customPhoto,
      photoZoom,
      photoPosY,
      fontIdx,
      headlineScale,
      socialMode,
      igFormat,
    });
  }, [mode, merchantId, offerId, extName, extSlogan, extProduct, extNormalPrice, extPromoPrice, extAddress, extUrl, lines, briefText, priceMode, focus, detectedCategory, texts, themeIdx, format, layout, piece, badgeMode, badgeCustom, showPrice, showBenefits, showQr, qrMode, qrStyle, benefitStyle, dockVariant, customWaGreeting, externalUrl, customPhoto, photoZoom, photoPosY, fontIdx, headlineScale, socialMode, igFormat]);

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
    setDetectedCategory('');
    setTexts({ plain: '', highlight: '', sub: '', benefits: ['', '', ''], cta: '', priceLabel: 'Cotiza sin costo · WhatsApp' });
    setThemeIdx(1);
    setFormat('story');
    setLayout('bento');
    setPiece(0);
    setBadgeMode('calidad');
    setBadgeCustom('');
    setShowPrice(true);
    setShowBenefits(true);
    setShowQr(true);
    setQrMode('wa');
    setQrStyle('rounded');
    setBenefitStyle('auto');
    setDockVariant('auto');
    setCustomWaGreeting('');
    setExternalUrl('');
    setCustomPhoto(null);
    setExtLogoUrl(null);
    setBrandPalette(null);
    setUseBrandPalette(true);
    setPhotoZoom(1);
    setPhotoPosY(0.5);
    setFontIdx(0);
    setHeadlineScale(1.2);
    setSocialMode('wa');
    setIgFormat('feed');
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

  // ── Cero cuadros vacíos (V11): al elegir negocio, el Banco Fotográfico HD
  // carga al instante una foto real del rubro detectado (en silencio, sin
  // toast) para que el lienzo jamás muestre un recuadro vacío con un emoji.
  const hasBrandNow = mode === 'plataforma' ? merchantId !== '' : extName.trim() !== '';
  useEffect(() => {
    if (!hasBrandNow) return;
    if (customPhoto || brand.photo) return;
    let alive = true;
    const genId = ++photoGenRef.current;
    void (async () => {
      const dataUrl = await loadBankPhotoFresh(
        `${extName} ${extSlogan} ${extProduct} ${briefText}`,
        lastPhotoUrlRef.current,
      );
      if (alive && dataUrl && photoGenRef.current === genId) {
        lastPhotoUrlRef.current = dataUrl;
        setCustomPhoto(dataUrl);
      }
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

  /** Textos finales del artboard: editables con defaults inteligentes. */
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

  /** V12: el dock muestra SIEMPRE la categoría detectada del brief +
   *  ubicación (ej: "MARKETING DIGITAL & VENTAS · GACHETÁ") — jamás la
   *  categoría fija del comercio por defecto. */
  const dockSlogan = useMemo(
    () => (detectedCategory.trim() ? `${detectedCategory.trim()} · ${brand.municipality || 'Gachetá'}` : brand.slogan),
    [detectedCategory, brand.slogan, brand.municipality],
  );

  /** V12: pregunta gancho gigante para la Pieza 2 (portada de impacto viral),
   *  construida con el titular real de la campaña. */
  const hookText = useMemo(() => {
    // 🔥 V19 · Pregunta PROBLEMA/SOLUCIÓN propia de la pieza 2 (jamás repite
    // el titular 1): se deriva del enfoque de campaña y del municipio.
    const mun = (brand.municipality || 'Gachetá').toUpperCase();
    const nombre = brand.name.trim().toUpperCase();
    const byFocus: Record<CampaignFocus, string> = {
      remate: `¿BUSCAS EL MEJOR PRECIO EN ${mun}?`,
      prestigio: nombre ? `¿POR QUÉ TODOS RECOMIENDAN A ${nombre}?` : `¿QUIERES UN SERVICIO DE PRIMER NIVEL EN ${mun}?`,
      confianza: `¿QUIERES ATENCIÓN RÁPIDA Y DE CONFIANZA HOY MISMO?`,
      viral: `¿SIGUES PAGANDO DE MÁS EN ${mun}?`,
    };
    const focusHook = byFocus[focus];
    if (focusHook) return focusHook;
    const h = `${T.plain} ${T.highlight}`.trim().replace(/[?!.¡¿]+$/g, '').trim();
    return h ? `¿${h.toUpperCase()}?` : '';
  }, [T.plain, T.highlight, focus, brand.municipality, brand.name]);

  /** Enlaces wa.me codificados de las 3 líneas. */
  const lineLinks = useMemo(
    () => lines.map((l) => (l.number.trim() ? waLink(normalizePhone(l.number), fillMessage(l.message, brand)) : '')),
    [lines, brand],
  );

  const primaryLink = lineLinks[0] || brand.url;

  // ── V21.0 · Orquestación total del destino del Código QR ──
  const PUBLIC_APP_URL = 'https://impacto-tawny.vercel.app/';
  const qrTarget = useMemo<string>(() => {
    const publicBase =
      window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? PUBLIC_APP_URL
        : `${window.location.origin}${window.location.pathname}`;
    if (qrMode === 'perfil') {
      return `${publicBase}?comercio=${merchantId || 'catalogo'}`;
    }
    if (qrMode === 'oferta') {
      return `${publicBase}?oferta=${offerId || 'activa'}`;
    }
    if (qrMode === 'externo') {
      const rawUrl = externalUrl.trim();
      if (rawUrl) return /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
      return primaryLink || PUBLIC_APP_URL;
    }
    // WhatsApp: https://wa.me/57[NUMERO]?text=[MENSAJE_IA]
    const num =
      lines[0].number.trim() ||
      (mode === 'plataforma'
        ? merchants.find((m) => m.id === merchantId)?.whatsapp ?? ''
        : (/wa\.me\/(\d+)/.exec(extUrl)?.[1] ?? ''));
    if (num) return waLink(normalizePhone(num), fillMessage(customWaGreeting || lines[0].message, brand));
    return primaryLink || PUBLIC_APP_URL;
  }, [qrMode, mode, merchantId, offerId, externalUrl, lines, customWaGreeting, brand, primaryLink, merchants, extUrl]);

  /** Leyenda del QR + indicador de destino para la pieza 4. */
  const qrMeta = QR_META[qrMode];

  // Foto efectiva (subida/IA/banco) con fallback a la del comercio.
  const effectivePhoto = customPhoto ?? brand.photo;
  /** 🎲 V20 · Semilla aleatoria: cambia en CADA generación para que las fotos
   *  del banco salgan barajadas — visuales 100% distintos en cada intento. */
  const [photoSeed, setPhotoSeed] = useState(0);

  /** 🖼️ V19/V20 · CUATRO FOTOGRAFÍAS DIFERENTES del rubro (una por pieza):
   *  la maestra (subida/IA/banco) + 3 tomas distintas barajadas del banco con
   *  la semilla de la campaña. Nunca repite la misma combinación. */
  const piecePhotos = useMemo<string[]>(() => {
    const cat = guessPhotoCategory(briefText.trim() || `${brand.name} ${brand.slogan} ${brand.product}`);
    const bank = [...(PHOTO_BANK[cat] ?? [])];
    // Fisher-Yates determinista con la semilla de la campaña actual
    let seed = photoSeed + 1;
    const rand = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let i = bank.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      [bank[i], bank[j]] = [bank[j], bank[i]];
    }
    const out: string[] = [effectivePhoto ?? ''];
    for (const u of bank) {
      if (out.length >= 4) break;
      if (u && !out.includes(u)) out.push(u);
    }
    // Si el banco no alcanza para 4, completamos repitiendo la maestra
    while (out.length < 4) out.push(effectivePhoto ?? '');
    return out;
  }, [effectivePhoto, briefText, brand.name, brand.slogan, brand.product, photoSeed]);

  const selectedMerchantLogo = useMemo(
    () => (mode === 'plataforma' ? (merchants.find((x) => x.id === merchantId)?.logo_thumb ?? null) : null),
    [mode, merchants, merchantId],
  );
  const effectiveLogoUrl = mode === 'plataforma' ? selectedMerchantLogo : extLogoUrl;
  const activeBrandPalette = useBrandPalette ? brandPalette : null;
  const activeThemeId = AFFICHE_THEMES[themeIdx]?.id ?? 'marble';

  // 🎨 V22.0 · Extracción automática de paleta de color desde el logo del comercio
  // o logo subido (si hay logo, no forzamos temas genéricos encima de su identidad).
  useEffect(() => {
    if (!effectiveLogoUrl) return;
    let alive = true;
    void extractPaletteFromImage(effectiveLogoUrl, 'logo').then((pal) => {
      if (!alive || !pal) return;
      setBrandPalette(pal);
      setUseBrandPalette(true);
    });
    return () => {
      alive = false;
    };
  }, [effectiveLogoUrl]);

  // V19/V22: QR vectorial personalizado por tema o paleta de marca extraída,
  // con ojos personalizados, alto contraste e iniciales o logo del negocio en el centro.
  useEffect(() => {
    let alive = true;
    generateStyledQrDataUrl({
      value: qrTarget,
      style: qrStyle,
      themeId: activeThemeId,
      brandColors: activeBrandPalette
        ? {
            primary: activeBrandPalette.primary,
            accent: activeBrandPalette.accent,
            secondary: activeBrandPalette.secondary,
          }
        : null,
      logoUrl: effectiveLogoUrl,
      businessName: brand.name || 'Impulso',
      size: 540,
    })
      .then((url) => {
        if (alive) setQrUrl(url);
      })
      .catch(() => {
        if (alive) setQrUrl(null);
      });
    return () => {
      alive = false;
    };
  }, [qrTarget, qrStyle, activeThemeId, activeBrandPalette, effectiveLogoUrl, brand.name]);

  // V11: embebe el CSS de las Google Fonts UNA vez para que la exportación
  // con html-to-image salga con la tipografía de agencia real (no la fallback).
  useEffect(() => {
    void getFontEmbedCSS(document.body)
      .then((css) => {
        fontCssRef.current = css;
      })
      .catch(() => {
        /* Sin CSS embebible: la exportación usa las fuentes ya renderizadas */
      });
  }, []);

  /** Props del artboard para una pieza dada (preview y pack comparten esto). */
  const artboardProps = (p: Piece): AfficheProps => ({
    themeId: activeThemeId,
    layout,
    format,
    piece: p,
    fontStyle: AFFICHE_TYPOS[fontIdx]?.id,
    headlineScale,
    benefitStyle,
    dockVariant,
    brandPalette: activeBrandPalette,
    logoUrl: effectiveLogoUrl,
    brand: {
      name: brand.name,
      slogan: dockSlogan,
      product: brand.product,
      promoPrice: brand.promoPrice,
      normalPrice: brand.normalPrice,
      address: brand.address,
      municipality: brand.municipality,
      phoneDisplay: brand.phoneDisplay,
    },
    texts: { plain: T.plain, highlight: T.highlight, sub: T.sub, benefits: T.benefits, cta: T.cta, hook: hookText },
    badge,
    showPrice,
    showBenefits,
    showQr,
    photoUrl: piecePhotos[0],
    photoUrl2: piecePhotos[1],
    photoUrl3: piecePhotos[2],
    photoUrl4: piecePhotos[3],
    qrUrl,
    qrValue: qrTarget,
    qrStyle,
    photoZoom,
    photoPosY,
    qrLabel: qrMeta.label,
    qrHint: qrMeta.hint,
  });

  /** Opciones de exportación comunes de toPng (1080p = pixelRatio 2). */
  const pngOptions = (): Parameters<typeof toPng>[1] => ({
    pixelRatio: 2,
    cacheBust: true,
    width: 540,
    height: format === 'story' ? 960 : 540,
    ...(fontCssRef.current ? { fontEmbedCSS: fontCssRef.current } : {}),
  });

  /** ✨ Cadena V11: el BRIEF es la fuente maestra única (sirve solo, sin
   *  elegir comercio). PASADA 1 → foto instantánea del banco → PASADA 2.
   *  Si la IA falla o tarda >7s, el motor sintético local llena TODO. */
  async function generate(): Promise<void> {
    if (!brand.name.trim() && !briefText.trim()) {
      toast.error('Escribe el brief del negocio: la IA deduce todo desde ahí ✨');
      return;
    }
    setGenerating(true);
    // 🎲 V20 · Nueva semilla → fotos del banco barajadas: cada campaña sale
    // con visuales completamente distintos a la anterior.
    setPhotoSeed((v) => v + 1);
    const genId = ++photoGenRef.current;
    const merchantCategory = merchants.find((m) => m.id === merchantId)?.category;
    const lastArt = campaign;
    try {
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

      // ── PASADA 1 · Estrategia y dirección de arte (con red de seguridad) ──
      toast.info('🧠 Pasada 1/2 · Analizando el brief y diseñando la dirección de arte…');
      let art: ArtDirection;
      let res: MarketingCampaign | null = null;
      let synthetic = false;
      try {
        art = await withTimeout(generateArtDirection(input), 7000);
      } catch {
        // La API falló o tardó >7s: motor sintético local llenando TODO.
        const smart = synthesizeSmartCampaignFromBrief(input, {
          previousThemeId: lastArt?.themeId,
          previousLayoutId: lastArt?.layoutId,
        });
        art = smart.art;
        res = smart.campaign;
        synthetic = true;
      }

      // ¿Solo el brief? La IA dedujo marca y producto: los adopta el estudio.
      if (!brand.name.trim()) {
        setMode('externo');
        setExtName(art.brandName);
        setExtProduct(art.productTitle);
      }
      // V11: el Rubro/Categoría visible SIEMPRE lo actualiza la IA según el
      // brief (jamás queda "Comida y Bebidas" ni genérico por defecto).
      setExtSlogan(art.categoryLabel);
      // V12: el dock del afiche lee SIEMPRE la categoría detectada del brief.
      setDetectedCategory(art.categoryLabel);
      const bizName = brand.name.trim() || art.brandName;
      const product = brand.product.trim() || art.productTitle;
      // ── V21/V22 · HIPER-VARIABILIDAD COHERENTE POR ARQUETIPOS (si hay logo, respeta su paleta):
      const hasActiveLogo = Boolean(effectiveLogoUrl && useBrandPalette && brandPalette);
      const picked = applyHyperVariability({ preserveBrandPalette: hasActiveLogo });
      const ti = picked.themeIdx;
      const nextLayout = picked.layout;

      // ── Auto-imagen paso 1: foto HD real NUEVA del BANCO COMERCIAL (V13:
      // garantizada distinta a la foto anterior) ──
      toast.info('📷 Foto editorial HD del rubro colocada en el lienzo…');
      void (async () => {
        const dataUrl = await loadBankPhotoFresh(
          briefText.trim() || `${bizName} ${art.categoryLabel} ${product}`,
          lastPhotoUrlRef.current,
        );
        if (dataUrl && photoGenRef.current === genId) {
          lastPhotoUrlRef.current = dataUrl;
          setCustomPhoto(dataUrl);
        }
      })();

      const input2 = { ...input, businessName: bizName, product };

      // ── PASADA 2 · Copywriting senior (con red de seguridad sintética) ──
      if (res == null) {
        toast.info('✍️ Pasada 2/2 · Copywriting senior de agencia…');
        try {
          res = await withTimeout(generateCampaignCopy(input2, art), 9000);
        } catch {
          res = synthesizeCampaign(input2, art);
          synthetic = true;
        }
      }
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
      // V11: los 3 mensajes de WhatsApp de las líneas los redacta la IA
      // a la medida del giro real (ventas / domicilios / planes).
      setLines((prev) =>
        prev.map((l, i) => ({ ...l, message: [res.waLine1Msg, res.waLine2Msg, res.waLine3Msg][i] ?? l.message })),
      );
      // V13: el mensaje inicial que llega al escanear el QR lo redacta la IA.
      setCustomWaGreeting(res.waLine1Msg || '');

      // ── Auto-imagen paso 2 (segundo plano): foto IA a medida CON GUARDIA
      // anti-banner de Pollinations (si trae "At its limit" → banco HD) ──
      void (async () => {
        try {
          const seed = Math.floor(Math.random() * 999999);
          const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(art.imagePromptEn)}?width=1080&height=1080&nologo=true&enhance=true&seed=${seed}`;
          const img = await loadImage(url);
          if (isPollinationsBlockImage(img)) throw new Error('pollinations-block');
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
          // Banner de bloqueo o fallo de red: banco comercial HD al rescate
          // (V13: con foto garantizada distinta a la anterior).
          const bank = await loadBankPhotoFresh(
            briefText.trim() || `${bizName} ${art.categoryLabel} ${product}`,
            lastPhotoUrlRef.current,
          );
          if (bank && photoGenRef.current === genId) {
            lastPhotoUrlRef.current = bank;
            setCustomPhoto(bank);
          }
        }
      })();

      if (synthetic) {
        toast.info('⚡ IA saturada: campaña generada por el motor sintético local (100% completa)');
      }
      const themeLabel = activeBrandPalette
        ? `Paleta de marca (${activeBrandPalette.primary})`
        : ti >= 0
          ? AFFICHE_THEMES[ti].label
          : art.themeId;
      toast.success(`✨ ¡${picked.styleLabel}! ${themeLabel} + layout ${nextLayout.toUpperCase()} aplicados`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo generar la campaña');
    } finally {
      setGenerating(false);
    }
  }

  /** 📷 Subida de foto propia: redimensionada y con extracción automática de paleta. */
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
        const dataUrl = c.toDataURL('image/jpeg', 0.88);
        setCustomPhoto(dataUrl);
        if (!effectiveLogoUrl) {
          void extractPaletteFromImage(dataUrl, 'photo').then((pal) => {
            if (!pal) return;
            setBrandPalette(pal);
            setUseBrandPalette(true);
            toast.success(`🎨 Paleta armonizada a tu foto (${pal.colors.join(' · ')})`);
          });
        } else {
          toast.success('📷 Foto del cliente lista (0 bytes en la base de datos)');
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }

  /** 🏷️ Subida de logo del cliente externo: extrae sus 3 colores al instante. */
  function handleLogoFile(file: File | undefined): void {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 320 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        const ctx = c.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, c.width, c.height);
        const dataUrl = c.toDataURL('image/png');
        setExtLogoUrl(dataUrl);
        toast.success('🏷️ Logo cargado: extrayendo identidad cromática…');
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }

  /** ✨ Gemini Vision: analiza el logo o foto actual para deducir 3 colores hex exactos. */
  async function refinePaletteWithAI(): Promise<void> {
    const src = effectiveLogoUrl || effectivePhoto;
    if (!src) {
      toast.info('Sube un logo o fotografía primero para analizar sus colores con Gemini Vision');
      return;
    }
    setPaletteBusy(true);
    try {
      let dataUrl = src;
      if (!src.startsWith('data:')) {
        const img = await loadImage(src);
        const off = document.createElement('canvas');
        off.width = 256;
        off.height = 256;
        const octx = off.getContext('2d');
        if (octx) {
          octx.drawImage(img, 0, 0, 256, 256);
          dataUrl = off.toDataURL('image/jpeg', 0.85);
        }
      }
      const sourceKind = effectiveLogoUrl ? 'logo' : 'photo';
      const aiPal = await extractBrandPaletteWithAI(dataUrl, sourceKind);
      const pal = aiPal ?? (await extractPaletteFromImage(dataUrl, sourceKind));
      if (!pal) {
        toast.error('No se pudieron extraer los colores de esa imagen');
        return;
      }
      setBrandPalette(pal);
      setUseBrandPalette(true);
      toast.success(`✨ Paleta de marca aplicada: ${pal.colors.join(' · ')}`);
    } catch {
      toast.error('No se pudo analizar la paleta ahora');
    } finally {
      setPaletteBusy(false);
    }
  }

  /** 🎨 Foto publicitaria IA (pollinations) CON GUARDIA: si el motor devuelve
   *  el banner de bloqueo "At its limit", se descarta y cae al banco HD. */
  async function generatePhoto(vary: boolean): Promise<void> {
    setPhotoBusy(true);
    const genId = ++photoGenRef.current;
    const briefSource = briefText.trim() || `${brand.product} ${brand.name} ${brand.slogan}`;
    try {
      const seed = Math.floor(Math.random() * 999999);
      const prompt = campaign?.imagePromptEn?.trim() || FOCUS_PHOTO_MOODS[focus];
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1080&height=1080&nologo=true&enhance=true&seed=${seed}`;
      const img = await loadImage(url);
      if (isPollinationsBlockImage(img)) throw new Error('pollinations-block');
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
      // Banner de bloqueo de Pollinations o fallo de red → Banco Comercial HD
      // (V13: con foto garantizada distinta a la anterior).
      const bank = await loadBankPhotoFresh(briefSource, lastPhotoUrlRef.current);
      if (bank && photoGenRef.current === genId) {
        lastPhotoUrlRef.current = bank;
        setCustomPhoto(bank);
        toast.success('📸 Foto HD real del banco comercial aplicada (motor IA saturado)');
      } else {
        toast.error('Sin foto disponible ahora: prueba un preset HD o sube una foto');
      }
    } finally {
      setPhotoBusy(false);
    }
  }

  /** 🖼️ V14 · Aplica cualquier URL del banco/galería convirtiéndola a dataURL
   *  (misma ruta CORS-safe de los presets): el PNG exportado nunca se mancha. */
  async function applyPhotoUrl(url: string, label: string): Promise<void> {
    setPhotoBusy(true);
    const genId = ++photoGenRef.current;
    try {
      const img = await loadImage(url);
      const off = document.createElement('canvas');
      off.width = 1080;
      off.height = 1080;
      const octx = off.getContext('2d');
      if (!octx) throw new Error('canvas');
      octx.drawImage(img, 0, 0, 1080, 1080);
      if (photoGenRef.current === genId) {
        setCustomPhoto(off.toDataURL('image/jpeg', 0.9));
        toast.success(`${label}: foto HD aplicada al afiche`);
      }
    } catch {
      toast.error('Esa foto no está disponible ahora: elige otra miniatura');
    } finally {
      setPhotoBusy(false);
    }
  }

  /**
   * 🧬 V22.0 · Motor de Hiper-Variabilidad Coherente:
   * Enlaza Layout (incluidos los orgánicos immersive/collage) + Emparejamiento Tipográfico
   * + Paleta/Textura (respetando logo si existe) + Posición de QR + Beneficios fluidos.
   */
  function applyHyperVariability(opts?: { preserveBrandPalette?: boolean }): { themeIdx: number; layout: Layout; styleLabel: string } {
    const groups: Array<{
      id: 0 | 1 | 2;
      styleLabel: string;
      layouts: Layout[];
      themeIds: string[];
      fontIndices: number[];
      dockVariant: Exclude<DockVariant, 'auto'>;
      benefits: Array<Exclude<BenefitPresentation, 'auto'>>;
      qrStyles: QrStyle[];
    }> = [
      {
        id: 0,
        styleLabel: 'Estilo 1 · Cyber Neón & Collage',
        layouts: ['collage', 'diagx', 'split', 'diagonal', 'bento3d', 'cyber'],
        themeIds: ['cyber', 'aurora', 'oceano', 'carbon'],
        fontIndices: [0, 3, 5],
        dockVariant: 'corner',
        benefits: ['ribbons', 'bento', 'watermark'],
        qrStyles: ['cyber', 'sharp'],
      },
      {
        id: 1,
        styleLabel: 'Estilo 2 · Suizo & Mármol Serif',
        layouts: ['swiss', 'zen', 'vip', 'arc', 'clinic'],
        themeIds: ['marble', 'clinic', 'slate', 'arena'],
        fontIndices: [1, 6],
        dockVariant: 'centered',
        benefits: ['callouts', 'editorial', 'bento'],
        qrStyles: ['luxury', 'dots'],
      },
      {
        id: 2,
        styleLabel: 'Estilo 3 · Inmersivo Full-Bleed',
        layouts: ['immersive', 'magazine', 'bleed', 'orbits', 'float', 'portal'],
        themeIds: ['obsidian', 'emerald', 'wood', 'terracotta', 'vino', 'kraft'],
        fontIndices: [2, 4, 7],
        dockVariant: 'glass',
        benefits: ['callouts', 'watermark', 'badges', 'editorial'],
        qrStyles: ['luxury', 'rounded', 'dots'],
      },
    ];

    const availableGroups = groups.filter((g) => g.id !== lastStyleGroupRef.current);
    const chosenGroup = availableGroups[Math.floor(Math.random() * availableGroups.length)] ?? groups[0];
    lastStyleGroupRef.current = chosenGroup.id;

    const layoutPool = chosenGroup.layouts.filter((id) => id !== lastLayoutIdxRef.current);
    const nextLayout = layoutPool[Math.floor(Math.random() * layoutPool.length)] ?? chosenGroup.layouts[0];
    setLayout(nextLayout);
    lastLayoutIdxRef.current = nextLayout;

    const themeCandidates = AFFICHE_THEMES
      .map((t, idx) => ({ id: t.id, idx }))
      .filter((x) => chosenGroup.themeIds.includes(x.id) && x.idx !== lastThemeIdxRef.current);
    const fallbackThemes = AFFICHE_THEMES.map((_, idx) => ({ idx })).filter((x) => x.idx !== lastThemeIdxRef.current);
    const pickedTheme =
      themeCandidates[Math.floor(Math.random() * themeCandidates.length)] ??
      fallbackThemes[Math.floor(Math.random() * fallbackThemes.length)] ??
      { idx: 0 };
    if (!opts?.preserveBrandPalette) {
      setThemeIdx(pickedTheme.idx);
      lastThemeIdxRef.current = pickedTheme.idx;
    }

    const fontPool = chosenGroup.fontIndices.filter((idx) => idx !== lastFontIdxRef.current && idx < AFFICHE_TYPOS.length);
    const nextFont =
      fontPool[Math.floor(Math.random() * fontPool.length)] ??
      chosenGroup.fontIndices[0] ??
      0;
    setFontIdx(nextFont);
    lastFontIdxRef.current = nextFont;

    const benefitPool = chosenGroup.benefits.filter((m) => m !== lastBenefitStyleRef.current);
    const nextBenefit = benefitPool[Math.floor(Math.random() * benefitPool.length)] ?? chosenGroup.benefits[0];
    setBenefitStyle(nextBenefit);
    lastBenefitStyleRef.current = nextBenefit;

    setDockVariant(chosenGroup.dockVariant);

    const qrPool = chosenGroup.qrStyles.filter((id) => id !== lastQrStyleRef.current);
    const nextQr = qrPool[Math.floor(Math.random() * qrPool.length)] ?? chosenGroup.qrStyles[0] ?? 'rounded';
    setQrStyle(nextQr);
    lastQrStyleRef.current = nextQr;

    return { themeIdx: opts?.preserveBrandPalette ? themeIdx : pickedTheme.idx, layout: nextLayout, styleLabel: chosenGroup.styleLabel };
  }

  /**
   * 🎲 V22.0 · Sorpréndeme Implacable:
   * No solo cambia tema: rota arquitectura orgánica + carga foto diferente + solicita
   * a Gemini un ángulo comercial fresco, regenera titular, sello y reordena beneficios.
   */
  async function surpriseDesign(): Promise<void> {
    if (surprising) return;
    setSurprising(true);
    setPhotoSeed((v) => v + 1);
    const genId = ++photoGenRef.current;

    const hasActiveLogo = Boolean(effectiveLogoUrl && useBrandPalette && brandPalette);
    const picked = applyHyperVariability({ preserveBrandPalette: hasActiveLogo });

    const briefQuery = briefText.trim() || `${brand.name} ${brand.slogan} ${brand.product}`.trim();
    const freshBankPromise = loadBankPhotoFresh(briefQuery || 'comercio local profesional', lastPhotoUrlRef.current).then(
      (p) => {
        if (p && photoGenRef.current === genId) {
          lastPhotoUrlRef.current = p;
          setCustomPhoto(p);
        }
        return p;
      },
    );

    const focuses: CampaignFocus[] = ['remate', 'prestigio', 'confianza', 'viral'];
    const altFocus = focuses.filter((f) => f !== focus)[Math.floor(Math.random() * (focuses.length - 1))] ?? 'viral';
    const merchantCategory = merchants.find((m) => m.id === merchantId)?.category;

    const input: Parameters<typeof generateArtDirection>[0] = {
      businessName: brand.name,
      slogan: brand.slogan,
      brief: briefText || `${brand.name} ${brand.slogan} ${brand.product}`.trim(),
      product: brand.product,
      priceMode,
      normalPrice: brand.normalPrice,
      promoPrice: brand.promoPrice,
      priceLabel: texts.priceLabel,
      address: brand.address,
      municipality: brand.municipality || 'Gachetá',
      focus: altFocus,
      targetUrl: primaryLink || brand.url,
      categoryHint: merchantCategory,
      previousThemeId: AFFICHE_THEMES[lastThemeIdxRef.current]?.id,
      previousLayoutId: picked.layout,
    };

    try {
      toast.info('🎲 Sorpréndeme · Creando nuevo ángulo creativo y póster único con IA…');
      let art: ArtDirection;
      let res: MarketingCampaign;
      try {
        art = await withTimeout(generateArtDirection(input), 6500);
        res = await withTimeout(generateCampaignCopy({ ...input, businessName: brand.name || art.brandName, product: brand.product || art.productTitle }, art), 7500);
      } catch {
        const smart = synthesizeSmartCampaignFromBrief(input, {
          previousThemeId: input.previousThemeId,
          previousLayoutId: picked.layout,
          seed: Math.floor(Math.random() * 100000),
        });
        art = smart.art;
        res = smart.campaign;
      }

      // Reordena los 3 beneficios aleatoriamente para romper simetrías fijas
      const shuffledBenefits = [...res.benefits];
      for (let i = shuffledBenefits.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledBenefits[i], shuffledBenefits[j]] = [shuffledBenefits[j], shuffledBenefits[i]];
      }

      setCampaign(res);
      setTexts((prev) => ({
        plain: normSpaces(res.headline.plain) || prev.plain,
        highlight: normSpaces(res.headline.highlight) || prev.highlight,
        sub: normSpaces(res.sub) || prev.sub,
        benefits: [
          normSpaces(shuffledBenefits[0]) || prev.benefits[0] || '',
          normSpaces(shuffledBenefits[1]) || prev.benefits[1] || '',
          normSpaces(shuffledBenefits[2]) || prev.benefits[2] || '',
        ],
        cta: normSpaces(res.cta) || prev.cta,
        priceLabel: res.priceLabel ?? prev.priceLabel,
      }));
      if (res.badgeText) {
        setBadgeCustom(normSpaces(res.badgeText));
        setBadgeMode('custom');
      }

      // Intenta foto IA a medida en segundo plano con guardia anti-banner
      void freshBankPromise.then(async () => {
        try {
          const seed = Math.floor(Math.random() * 999999);
          const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(art.imagePromptEn)}?width=1080&height=1080&nologo=true&enhance=true&seed=${seed}`;
          const img = await loadImage(url);
          if (isPollinationsBlockImage(img)) return;
          const off = document.createElement('canvas');
          off.width = 1080;
          off.height = 1080;
          const octx = off.getContext('2d');
          if (!octx) return;
          octx.drawImage(img, 0, 0, 1080, 1080);
          if (photoGenRef.current === genId) {
            setCustomPhoto(off.toDataURL('image/jpeg', 0.92));
          }
        } catch {
          /* ya colocamos la foto HD distinta del banco */
        }
      });

      const themeName = hasActiveLogo
        ? 'Identidad del Logo'
        : AFFICHE_THEMES[picked.themeIdx]?.label.split(' ').slice(1).join(' ') ?? '';
      toast.success(`🎲 ¡Póster reinventado! ${picked.styleLabel} (${themeName} + ${picked.layout.toUpperCase()})`);
    } finally {
      setSurprising(false);
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

  /** 📥 Exporta la pieza actual en PNG 1080p con el artboard HTML. */
  async function downloadCurrent(): Promise<void> {
    const node = packRefs.current[piece];
    if (!node) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(node, pngOptions());
      triggerDownload(
        dataUrl,
        `${slug(brand.name)}-pieza-${piece + 1}-${format === 'story' ? '1080x1920' : '1080x1080'}.png`,
      );
      toast.success('📥 Pieza HD 1080p descargada (lista para publicar)');
    } catch {
      toast.error('No se pudo exportar la pieza: prueba con otra imagen');
    } finally {
      setExporting(false);
    }
  }

  /** 📦 Exporta el pack completo (4 piezas) listo para publicar. */
  async function downloadPack(): Promise<void> {
    setExporting(true);
    try {
      for (const s of [0, 1, 2, 3] as const) {
        const node = packRefs.current[s];
        if (!node) continue;
        const dataUrl = await toPng(node, pngOptions());
        triggerDownload(
          dataUrl,
          `${slug(brand.name)}-pieza-${s + 1}-${format === 'story' ? '1080x1920' : '1080x1080'}.png`,
        );
        await wait(500);
      }
      toast.success('📦 ¡Pack completo de 4 piezas descargado!');
    } catch {
      toast.error('No se pudo exportar el pack: prueba con otra imagen');
    } finally {
      setExporting(false);
    }
  }

  /** 📲 4 versiones del anuncio con redacción variada (respaldo limpio V10). */
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
      `🔥 ${p}${price}${normal}: atención inmediata HOY en ${brand.name || 'el negocio'}\n📍 ${addr} · pide con 1 clic 👉 ${primaryLink}`,
      `🚨 ${p}${price}\n📍 ${addr} · ${T.cta || 'Escríbenos ya'}\n👉 ${primaryLink}`,
      `🤔 ${T.plain || '¿Ya lo probaste?'} ${T.highlight}\n📍 ${brand.name || 'El negocio'} — ${addr}\n${brand.phoneDisplay || 'Escríbenos sin compromiso'} 👉 ${primaryLink}`,
    ];
  }, [brand, T, primaryLink]);

  /** 📲 V10: 4 mensajes de difusión — 100% redactados por la IA a la medida
   *  del giro del negocio; si aún no hay campaña, respaldo limpio. */
  const dispatchMsgs = useMemo<string[]>(() => {
    const ia = (campaign?.dispatchVersions ?? []).filter((m) => m.trim());
    if (ia.length > 0) {
      return [0, 1, 2, 3].map((i) => {
        const base = ia[i % ia.length];
        return primaryLink && !base.includes(primaryLink) ? `${base}\n👉 ${primaryLink}` : base;
      });
    }
    return variants;
  }, [campaign, primaryLink, variants]);

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
      `1️⃣ ${c?.whatsappStatusSequence.status1 || statusTexts.status1}`,
      `2️⃣ ${c?.whatsappStatusSequence.status2 || statusTexts.status2}`,
      `3️⃣ ${c?.whatsappStatusSequence.status3 || statusTexts.status3}`,
      `═══════════════════════════`,
      `📣 COPY PAS (Facebook / Instagram)`,
      c?.socialMediaCopy.pas || fbPostText,
      `📣 COPY AIDA FLASH (Grupos / Clasificados)`,
      c?.socialMediaCopy.aida || waSocialText,
      `═══════════════════════════`,
      `🎬 GUION REEL 15 SEGUNDOS`,
      `· 0-3 s: ${c?.videoReelScript.t0_3 || videoShots.s1}`,
      `· 3-10 s: ${c?.videoReelScript.t3_10 || videoShots.s2}`,
      `· 10-15 s: ${c?.videoReelScript.t10_15 || videoShots.s3}`,
      `═══════════════════════════`,
      `💬 RESPUESTAS DE CIERRE PARA EL COMERCIANTE`,
      `· ¿Precio? ${c?.salesClosingTemplates.priceReply || closingTexts.priceReply}`,
      `· Indeciso: ${c?.salesClosingTemplates.hesitantReply || closingTexts.hesitantReply}`,
      `· Despacho: ${c?.salesClosingTemplates.dispatchUpsell || closingTexts.dispatchUpsell}`,
      `═══════════════════════════`,
      `🧩 4 VERSIONES PARA COMPARTIR (anti-spam)`,
      dispatchMsgs.map((v, i) => `— Versión ${i + 1} —\n${v}`).join('\n\n'),
    ].join('\n');
    await copyText(kit, 'kit', '📋 Kit completo');
  }

  // ═══ V14 · GALERÍA VISUAL + LANZADOR POR RED SOCIAL ══════════════════════

  /** Fotos de la pestaña de galería activa ("sugeridas" usa el rubro del brief). */
  const galleryPhotos = useMemo<string[]>(() => {
    const tab = PHOTO_GALLERY_TABS.find((x) => x.id === galleryTab) ?? PHOTO_GALLERY_TABS[0];
    const cats =
      tab.id === 'sugeridas'
        ? [guessPhotoCategory(briefText.trim() || `${brand.name} ${brand.slogan} ${brand.product}`)]
        : tab.cats;
    return cats.flatMap((c) => PHOTO_BANK[c] ?? []);
  }, [galleryTab, briefText, brand.name, brand.slogan, brand.product]);

  /** Cambia de red social y sincroniza automáticamente formato de lienzo + pestaña de textos. */
  function selectSocial(m: SocialMode): void {
    setSocialMode(m);
    setFormat(m === 'wa' || m === 'tt' || (m === 'ig' && igFormat === 'historia') ? 'story' : 'square');
    setCopyTab(m === 'wa' ? 'estados' : m === 'tt' ? 'video' : 'post');
  }

  /** 📲 V21.0 · Botón inteligente "Copiar y Enviar a WhatsApp" (Web Share + fallback wa.me). */
  async function copyAndSendWhatsApp(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* continuar al canal de envío aunque falle portapapeles */
    }
    const nav = navigator as Navigator & { share?: (d: { title?: string; text?: string }) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title: brand.name || 'Impulso', text });
        toast.success('📲 ¡Texto copiado y compartido en WhatsApp!');
        return;
      } catch {
        /* usuario cerró compartir: abrir enlace wa.me abajo */
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
    toast.success('📲 Texto copiado y listo para enviar por WhatsApp');
  }

  /** Alterna Post Feed 1:1 ↔ Historia 9:16 en Instagram (y el lienzo sigue). */
  function setIgFormatSync(v: 'feed' | 'historia'): void {
    setIgFormat(v);
    setFormat(v === 'historia' ? 'story' : 'square');
  }

  /** 🟢 Texto WhatsApp con *negritas* y _cursivas_ nativas. */
  const waSocialText = useMemo(() => {
    const hook = `${T.plain} ${T.highlight}`.trim();
    const price = brand.promoPrice != null ? ` a SOLO *${formatCOP(brand.promoPrice)}*` : '';
    return [
      `🚨 *${hook.toUpperCase()}*`,
      `_${T.sub.trim()}_`,
      `${brand.product || 'Promoción de hoy'}${price} · 📍 ${brand.address || brand.municipality || 'Gachetá'}`,
      T.benefits.filter(Boolean).map((b) => `✅ ${b}`).join('\n'),
      `💬 Escribe ya 👉 *${brand.phoneDisplay || 'nuestro WhatsApp'}*`,
      `🔗 ${primaryLink}`,
    ].join('\n');
  }, [T, brand, primaryLink]);

  /** 📸 15 hashtags estratégicos del municipio + rubro + producto. */
  const igHashtags = useMemo(() => {
    const words = (src: string): string[] =>
      src
        .toLowerCase()
        .replace(/[^a-záéíóúñü\s]/gi, '')
        .split(/\s+/)
        .filter((w) => w.length > 3)
        .slice(0, 4)
        .map((w) => `#${w.charAt(0).toUpperCase()}${w.slice(1)}`);
    const base = [
      `#${(brand.municipality || 'Gachetá').replace(/\s+/g, '')}`,
      '#Guavio',
      '#Cundinamarca',
      '#Colombia',
      ...words(detectedCategory),
      ...words(brand.product),
      '#ComprasLocales',
      '#ApoyaLoNuestro',
      '#EmprendimientoLocal',
      '#OfertasHoy',
      '#NegocioLocal',
      '#PromoDelDia',
    ];
    return [...new Set(base)].slice(0, 15).join(' ');
  }, [detectedCategory, brand.product, brand.municipality]);

  /** 📸 Descripción de Instagram con hashtags. */
  const igCaption = useMemo(
    () =>
      [
        `${brand.emoji} ${`${T.plain} ${T.highlight}`.trim()}`,
        T.sub.trim(),
        T.cta.trim(),
        `📍 ${brand.address || brand.municipality || 'Gachetá'} · 💬 ${brand.phoneDisplay || 'Escríbenos por DM'}`,
        '',
        igHashtags,
      ].join('\n'),
    [T, brand, igHashtags],
  );

  /** 📘 Anuncio de alta conversión para grupos/marketplace con enlace al perfil. */
  const fbPostText = useMemo(() => {
    const hook = `${T.plain} ${T.highlight}`.trim();
    const profileUrl =
      mode === 'plataforma' && merchantId
        ? `${window.location.origin}${window.location.pathname}?comercio=${merchantId}`
        : primaryLink;
    const priceLine =
      brand.promoPrice != null
        ? `💰 HOY por solo ${formatCOP(brand.promoPrice)}${
            brand.normalPrice != null && brand.normalPrice > brand.promoPrice ? ` (antes ${formatCOP(brand.normalPrice)})` : ''
          }`
        : `💬 ${T.priceLabel.trim()}`;
    return [
      `🔥 ${hook.toUpperCase()} 🔥`,
      '',
      T.sub.trim(),
      T.benefits.filter(Boolean).map((b) => `✅ ${b}`).join('\n'),
      priceLine,
      `📍 ${brand.address || brand.municipality || 'Gachetá'}`,
      `📲 Escríbenos ya por WhatsApp: ${primaryLink}`,
      `🏪 Verifica el local en Impulso: ${profileUrl}`,
      '',
      igHashtags,
    ].join('\n');
  }, [T, brand, primaryLink, mode, merchantId, igHashtags]);

  /** 🟢 V18 · Secuencia de 3 Estados de WhatsApp derivada del titular/marca:
   *  siempre lista desde el primer segundo (la IA la pisa si ya se generó). */
  const statusTexts = useMemo(() => {
    const hook = `${T.plain} ${T.highlight}`.trim();
    const hookUp = hook ? `${hook.charAt(0).toUpperCase()}${hook.slice(1)}` : 'Promoción de hoy';
    const price = brand.promoPrice != null ? ` SOLO *${formatCOP(brand.promoPrice)}*` : '';
    const ben = T.benefits.filter(Boolean);
    const wa = brand.phoneDisplay || 'nuestro WhatsApp';
    return {
      status1: `🚨 ${hookUp}\n${ben[0] || T.sub.trim() || 'Disponible hoy en tu municipio'}\n📍 ${brand.address || brand.municipality || 'Gachetá'}`,
      status2: `👀 ¿Ya lo viste?\n${brand.product || hookUp}${price}\n${ben.slice(0, 2).map((b) => `✅ ${b}`).join('\n') || '✅ Calidad garantizada'}\n🔗 ${primaryLink}`,
      status3: `⏳ ¡Últimas unidades!\n${hookUp}\n💬 Escríbeme AHORA y te lo aparto 👉 *${wa}*`,
    };
  }, [T, brand, primaryLink]);

  /** 🎬 V18 · Guion de 15 s derivado (toma por toma) — siempre con contenido. */
  const videoShots = useMemo(() => {
    const hook = `${T.plain} ${T.highlight}`.trim();
    const price = brand.promoPrice != null ? ` Hoy por solo ${formatCOP(brand.promoPrice)}` : '';
    const ben = T.benefits.filter(Boolean);
    const wa = brand.phoneDisplay || 'el WhatsApp del anuncio';
    return {
      s1: `Primer plano del producto con la frase «${hook || 'Promoción de hoy'}»: saluda, muestra el producto y di de qué se trata`,
      s2: `Demostración de ${brand.product || hook || 'la promoción'}${price} mientras destacas: «${ben[0] || T.sub.trim() || 'Frescura y calidad garantizada'}»`,
      s3: `Cierre invitando a escribir por WhatsApp (${wa}) y menciona el punto de entrega: ${brand.address || brand.municipality || 'Gachetá'}`,
    };
  }, [T, brand]);

  /** 🤝 V18 · Respuestas de cierre derivadas (precio / indeciso / despacho). */
  const closingTexts = useMemo(() => {
    const ben = T.benefits.filter(Boolean);
    const priceLine = brand.promoPrice != null
      ? `está a ${formatCOP(brand.promoPrice)}${brand.normalPrice != null && brand.normalPrice > brand.promoPrice ? ` (antes ${formatCOP(brand.normalPrice)})` : ''}`
      : `aprovecha la promoción de hoy`;
    return {
      priceReply: `¡Hola! 😊 ${brand.product || 'La promoción'} ${priceLine}. Incluye ${ben[0] || T.sub.trim() || 'todo lo publicado'}. ¿Te la aparto?`,
      hesitantReply: `Sin compromiso 😄 te lo aparto sin costo y lo confirmas al pasar por el local (${brand.address || brand.municipality || 'Gachetá'}). ¿Te separo ${brand.product || 'la promoción'}?`,
      dispatchUpsell: `¡Listo! 🛵 Apartado confirmado para ${brand.address || brand.municipality || 'el local'}. ¿Le agregas algo más? Tenemos ${ben[1] || ben[0] || 'más productos a buen precio'}`,
    };
  }, [T, brand]);

  /** 🎵 Guion de 15 s para TikTok/Reels (teleprompter gigante). */
  const ttScript = useMemo(() => {
    const v = campaign?.videoReelScript;
    return (
      [
        v?.t0_3 ? `· 0-3 s: ${v.t0_3}` : '',
        v?.t3_10 ? `· 3-10 s: ${v.t3_10}` : '',
        v?.t10_15 ? `· 10-15 s: ${v.t10_15}` : '',
      ].filter(Boolean).join('\n') ||
      [
        `· 0-3 s: ${videoShots.s1}`,
        `· 3-10 s: ${videoShots.s2}`,
        `· 10-15 s: ${videoShots.s3}`,
      ].join('\n')
    );
  }, [campaign, videoShots]);

  /** 🚀 LANZADOR EN 1 CLIC: exporta la pieza en el formato exacto de la red,
   *  comparte con la app del teléfono si el navegador lo permite; en PC
   *  descarga el PNG HD, copia el texto optimizado y abre la red. */
  async function launchSocial(m: SocialMode): Promise<void> {
    const f: Format = m === 'wa' || m === 'tt' || (m === 'ig' && igFormat === 'historia') ? 'story' : 'square';
    const node = f === 'story' ? socialRefs.current.story : socialRefs.current.square;
    if (!node) return;
    const text = m === 'wa' ? waSocialText : m === 'ig' ? igCaption : m === 'fb' ? fbPostText : ttScript;
    const filename = `${slug(brand.name) || 'impulso'}-${m}-${f === 'story' ? '1080x1920' : '1080x1080'}.png`;
    setExporting(true);
    try {
      const dataUrl = await toPng(node, { ...pngOptions(), height: f === 'story' ? 960 : 540 });
      const nav = navigator as Navigator & {
        canShare?: (data: SharePayload) => boolean;
        share?: (data: SharePayload) => Promise<void>;
      };
      if (m !== 'tt' && nav.canShare && nav.share) {
        try {
          const blob = await (await fetch(dataUrl)).blob();
          const file = new File([blob], filename, { type: 'image/png' });
          if (nav.canShare({ files: [file] })) {
            await nav.share({ files: [file], text, title: brand.name || 'Impulso' });
            toast.success('📲 ¡Imagen HD + texto enviados a la app de la red social!');
            return;
          }
        } catch {
          /* Compartir cancelado o no soportado: continuar con el plan B */
        }
      }
      triggerDownload(dataUrl, filename);
      void copyText(
        text,
        `social-${m}`,
        m === 'wa' ? 'Texto de WhatsApp' : m === 'ig' ? 'Descripción + hashtags' : m === 'fb' ? 'Texto del anuncio' : 'Guion del video',
      );
      const openUrl: Record<SocialMode, string> = {
        wa: 'https://web.whatsapp.com',
        ig: 'https://www.instagram.com',
        fb: 'https://www.facebook.com',
        tt: 'https://www.tiktok.com',
      };
      window.open(openUrl[m], '_blank', 'noopener,noreferrer');
      if (m === 'tt') {
        setTeleprompterOpen(true);
      }
      toast.info('📥 PNG HD descargado + texto copiado: pega la imagen (Ctrl+V) y publica');
    } catch {
      toast.error('No se pudo preparar la publicación: prueba de nuevo');
    } finally {
      setExporting(false);
    }
  }

  const hasBrand = mode === 'plataforma' ? merchantId !== '' : extName.trim() !== '';
  const inputCls =
    'w-full rounded-xl bg-slate-950/75 px-3.5 py-2.5 text-sm font-medium text-white placeholder:text-slate-600 ring-1 ring-white/[0.06] outline-none transition focus:ring-impulso-emerald/60 focus:shadow-[0_0_24px_-8px_rgba(16,185,129,0.28)]';
  const labelCls = 'text-[10px] font-extrabold uppercase tracking-wider text-slate-400';
  const cardCls = 'space-y-3.5 rounded-3xl bg-slate-900/55 p-4 backdrop-blur-xl ring-1 ring-white/[0.05]';

  // Preview: artboard HTML escalado (540 → 300px de ancho visible).
  const PREVIEW_W = 300;
  const previewScale = PREVIEW_W / 540;
  const previewH = format === 'story' ? Math.round(960 * previewScale) : PREVIEW_W;

  return (
    <div className="space-y-4 p-3 lg:grid lg:grid-cols-12 lg:items-start lg:gap-5 lg:space-y-0 lg:p-4">
      {/* Artboards ocultos full-size para exportar a 1080p con toPng */}
      <div style={{ position: 'fixed', left: -10000, top: 0, opacity: 0, pointerEvents: 'none' }} aria-hidden>
        {([0, 1, 2, 3] as const).map((p) => (
          <div key={p} ref={(el) => { packRefs.current[p] = el; }}>
            <AfficheArtboard {...artboardProps(p)} />
          </div>
        ))}
        {/* V14: 2 artboards dedicados al lanzador (formato exacto por red) */}
        <div ref={(el) => { socialRefs.current.story = el; }}>
          <AfficheArtboard {...artboardProps(piece)} format="story" />
        </div>
        <div ref={(el) => { socialRefs.current.square = el; }}>
          <AfficheArtboard {...artboardProps(piece)} format="square" />
        </div>
      </div>

      {/* Cabecera Apple / Vercel Dark Mode Premium */}
      <div className="rounded-3xl bg-gradient-to-br from-slate-900/80 via-slate-900/50 to-slate-950/80 p-5 shadow-[0_0_40px_-15px_rgba(59,130,246,0.22)] ring-1 ring-white/[0.06] lg:col-span-12">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-base font-extrabold tracking-tight text-white">
              <Sparkles className="h-5 w-5 text-impulso-mint" /> Agencia IA & Multi-WhatsApp Studio
            </p>
            <p className="mt-1.5 max-w-4xl text-[11px] leading-relaxed text-slate-400">
              Motor de diseño editorial HTML a 1080p: extracción automática de paleta desde el logo, 30 composiciones
              orgánicas y asimétricas en vivo, QR de alta joyería y lanzador multired con IA — 0 bytes en base de datos.
            </p>
          </div>
          <button
            onClick={clearAllDraft}
            className="pressable flex items-center gap-1.5 rounded-xl bg-white/[0.04] px-3 py-2 text-[10px] font-bold text-slate-400 transition hover:bg-white/[0.08] hover:text-impulso-rose"
          >
            <Trash2 className="h-3 w-3" /> Limpiar borrador
          </button>
        </div>
      </div>

      {/* ═══ COLUMNA IZQUIERDA: datos, brief IA, foto y diseño ═══ */}
      <div className="space-y-4 lg:col-span-4 lg:max-h-[calc(92dvh-9.5rem)] lg:overflow-y-auto lg:pr-1.5 lg:pb-24 overscroll-contain">
        {/* Modo dual */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={() => setMode('plataforma')}
            className={cx(
              'pressable rounded-2xl px-3.5 py-3 text-left text-xs font-extrabold transition',
              mode === 'plataforma'
                ? 'bg-impulso-emerald/15 text-impulso-mint shadow-[0_0_40px_-15px_rgba(16,185,129,0.35)] ring-1 ring-impulso-emerald/40'
                : 'bg-slate-900/50 text-slate-300 hover:bg-slate-900/80',
            )}
          >
            🏪 Comercio registrado
            <span className="mt-0.5 block text-[10px] font-semibold text-slate-400">Datos y ofertas de Impulso</span>
          </button>
          <button
            onClick={() => setMode('externo')}
            className={cx(
              'pressable rounded-2xl px-3.5 py-3 text-left text-xs font-extrabold transition',
              mode === 'externo'
                ? 'bg-amber-500/15 text-impulso-gold shadow-[0_0_40px_-15px_rgba(245,158,11,0.32)] ring-1 ring-impulso-gold/40'
                : 'bg-slate-900/50 text-slate-300 hover:bg-slate-900/80',
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
            <p className="text-xs font-extrabold text-white">🏷️ Identidad del Negocio</p>
            <input value={extName} onChange={(e) => setExtName(e.target.value)} placeholder="Nombre del Negocio / Marca * (si lo dejas vacío, la IA crea uno)" className={inputCls} />
            <input value={extSlogan} onChange={(e) => setExtSlogan(e.target.value)} placeholder="Rubro / Categoría visible (la IA lo actualiza con ✨)" className={inputCls} />
            <input value={extProduct} onChange={(e) => setExtProduct(e.target.value)} placeholder="Producto / servicio estrella" className={inputCls} />
            <div className="grid grid-cols-2 gap-2">
              <input value={extNormalPrice} onChange={(e) => setExtNormalPrice(e.target.value.replace(/\D/g, ''))} placeholder="Precio normal (opcional)" inputMode="numeric" className={inputCls} />
              <input value={extPromoPrice} onChange={(e) => setExtPromoPrice(e.target.value.replace(/\D/g, ''))} placeholder="Precio promo (opcional)" inputMode="numeric" className={inputCls} />
            </div>
            <input value={extAddress} onChange={(e) => setExtAddress(e.target.value)} placeholder="Ubicación / Ciudad (ej: Gachetá, calle 4)" className={inputCls} />
            <input value={extUrl} onChange={(e) => setExtUrl(e.target.value)} placeholder="WhatsApp del negocio (wa.me/57…) o web" className={inputCls} />
            <div className="flex items-center gap-2 pt-1">
              {extLogoUrl && (
                <img src={extLogoUrl} alt="Logo" className="h-9 w-9 shrink-0 rounded-xl bg-white/10 object-cover" />
              )}
              <label className="pressable flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-white/[0.05] px-3 py-2 text-[11px] font-bold text-slate-300 hover:bg-white/[0.08]">
                <ImagePlus className="h-3.5 w-3.5 text-impulso-mint" />
                {extLogoUrl ? 'Cambiar logo del cliente' : 'Subir logo (auto-extrae paleta)'}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleLogoFile(e.target.files?.[0])} />
              </label>
              {extLogoUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setExtLogoUrl(null);
                    setBrandPalette(null);
                  }}
                  className="pressable rounded-xl bg-white/[0.04] px-2.5 py-2 text-[10px] font-bold text-slate-400 hover:text-impulso-rose"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        )}

        {/* Brief IA */}
        <div className="space-y-3.5 rounded-3xl bg-slate-900/65 p-4 shadow-[0_0_40px_-15px_rgba(16,185,129,0.2)] ring-1 ring-impulso-emerald/25 backdrop-blur-xl">
          <p className="text-xs font-extrabold text-impulso-mint">🧠 Brief del negocio / servicio para la IA</p>
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
          <p className={labelCls}>Galería visual HD · {galleryPhotos.length} fotos en esta pestaña</p>
          {/* Pestañas de categoría (cascada, sin scroll oculto) */}
          <div className="no-scrollbar -mx-1 flex flex-wrap gap-1 px-1">
            {PHOTO_GALLERY_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setGalleryTab(tab.id)}
                className={cx(
                  'pressable rounded-full border px-2.5 py-1 text-[10px] font-extrabold transition',
                  galleryTab === tab.id ? 'border-impulso-emerald/60 bg-impulso-emerald/15 text-impulso-mint' : 'border-white/10 bg-slate-950/40 text-slate-400',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {/* Miniaturas reales: un clic coloca la foto en el afiche al instante */}
          <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto p-1 sm:grid-cols-4">
            {galleryPhotos.map((u) => (
              <img
                key={u}
                src={u}
                alt="Foto HD del banco"
                loading="lazy"
                onClick={() => void applyPhotoUrl(u, 'Galería')}
                onError={(e) => {
                  const el = e.currentTarget;
                  if (el instanceof HTMLImageElement) el.style.display = 'none';
                }}
                className="h-16 w-full cursor-pointer rounded-lg object-cover ring-emerald-400 hover:ring-2"
              />
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
            Banco HD de 160+ fotos reales con miniaturas por pestaña, motor IA con guardia anti-banner y subida propia:
            todo vive en la memoria del navegador.
          </p>
        </div>

        {/* 🎯 V13 · Selector de destino del Código QR y del enlace del afiche */}
        <div className={cardCls}>
          <p className="text-xs font-extrabold text-white">🎯 ¿A dónde debe llevar el Código QR?</p>
          <div className="space-y-1.5">
            {QR_MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setQrMode(m.id)}
                className={cx(
                  'pressable flex w-full items-start gap-2.5 rounded-xl border px-3 py-2 text-left transition',
                  qrMode === m.id
                    ? 'border-impulso-emerald/60 bg-impulso-emerald/15'
                    : 'border-white/10 bg-slate-950/40',
                )}
              >
                <span className="mt-0.5 text-base leading-none">{m.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className={cx('block text-[11px] font-extrabold leading-tight', qrMode === m.id ? 'text-impulso-mint' : 'text-slate-200')}>
                    {m.title}
                  </span>
                  <span className="mt-0.5 block text-[10px] font-semibold leading-snug text-slate-400">{m.hint}</span>
                </span>
                {qrMode === m.id && <span className="text-[10px] font-extrabold text-impulso-mint">☑️</span>}
              </button>
            ))}
          </div>
          {qrMode === 'wa' && (
            <div>
              <p className={labelCls}>Mensaje inicial con el que llegará el cliente al escanear (la IA lo redacta con ✨)</p>
              <textarea
                value={customWaGreeting}
                onChange={(e) => setCustomWaGreeting(e.target.value)}
                rows={3}
                maxLength={300}
                placeholder="Ej: ¡Hola! Escaneé el código QR de su publicidad y quiero información sobre {producto}…"
                className={cx(inputCls, 'resize-none leading-relaxed')}
              />
            </div>
          )}
          {qrMode === 'perfil' && (
            <p className="rounded-xl bg-impulso-emerald/10 px-3 py-2 text-[10px] font-bold text-impulso-mint">
              📍 Leyenda en afiche: «Ver Perfil y Ofertas» · dirige al comercio en Impulso (?comercio=ID).
            </p>
          )}
          {qrMode === 'wa' && (
            <p className="rounded-xl bg-impulso-emerald/10 px-3 py-2 text-[10px] font-bold text-impulso-mint">
              💬 Leyenda en afiche: «Escanea y Cotiza» · dirige a WhatsApp con el mensaje prellenado de la IA.
            </p>
          )}
          {qrMode === 'oferta' && (
            offerId ? (
              <p className="rounded-xl bg-impulso-emerald/10 px-3 py-2 text-[10px] font-bold text-impulso-mint">
                ⚡ Leyenda en afiche: «Aparta tu Cupo Hoy» · el QR abre la reserva rápida de la oferta elegida.
              </p>
            ) : (
              <p className="rounded-xl border border-impulso-gold/30 bg-impulso-gold/5 px-3 py-2 text-[10px] font-semibold text-amber-200/90">
                El destino Oferta requiere elegir una oferta activa del comercio (o usa WhatsApp/Externo).
              </p>
            )
          )}
          {qrMode === 'externo' && (
            <div>
              <p className={labelCls}>Enlace externo (Instagram, web o ubicación de Google Maps)</p>
              <input
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://instagram.com/tunegocio"
                className={inputCls}
              />
            </div>
          )}
          <div className="flex items-center gap-2 rounded-xl bg-slate-950/50 px-2.5 py-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">🔗 El QR codifica:</span>
            <p className="min-w-0 flex-1 truncate font-mono text-[10px] font-semibold text-impulso-mint">{qrTarget}</p>
          </div>
        </div>

        {/* Controles de diseño */}
        <div className={cardCls}>
          <p className="text-xs font-extrabold text-white">🎨 Dirección de Arte & Paleta</p>
          <button
            onClick={() => void surpriseDesign()}
            disabled={surprising}
            className="pressable flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-amber-400/20 py-3 text-xs font-extrabold text-impulso-gold shadow-[0_0_40px_-15px_rgba(245,158,11,0.3)] ring-1 ring-amber-400/35 disabled:opacity-50"
          >
            {surprising ? <Loader2 className="h-4 w-4 animate-spin" /> : <Dices className="h-4 w-4" />}
            {surprising ? '🎲 Creando ángulo comercial e imagen única…' : '🎲 Sorpréndeme con Diseño y Copy IA'}
          </button>

          {/* 🎨 V22.0 · Paleta Dinámica extraída de Logo o Foto */}
          <div className="space-y-2 rounded-2xl bg-slate-950/60 p-3 ring-1 ring-white/[0.05]">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-extrabold text-white">
                🧬 Identidad Cromática {brandPalette ? (brandPalette.source === 'logo' ? 'del Logo' : 'de la Foto') : 'de Marca'}
              </p>
              {brandPalette && (
                <button
                  type="button"
                  onClick={() => setUseBrandPalette((v) => !v)}
                  className={cx(
                    'pressable rounded-full px-2.5 py-0.5 text-[9px] font-extrabold transition',
                    useBrandPalette
                      ? 'bg-impulso-emerald/20 text-impulso-mint shadow-[0_0_16px_-4px_rgba(16,185,129,0.45)]'
                      : 'bg-white/[0.06] text-slate-400',
                  )}
                >
                  {useBrandPalette ? 'ACTIVA EN LIENZO' : 'USAR TEMA BASE'}
                </button>
              )}
            </div>
            {brandPalette ? (
              <div className="flex items-center gap-2">
                {brandPalette.colors.map((hex, i) => (
                  <div key={`${hex}-${i}`} className="flex flex-1 items-center gap-1.5 rounded-xl bg-white/[0.04] px-2 py-1.5">
                    <span className="h-4 w-4 shrink-0 rounded-full ring-1 ring-white/25" style={{ background: hex }} />
                    <span className="truncate font-mono text-[9px] font-bold text-slate-300">{hex}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] leading-snug text-slate-400">
                Elige un comercio con logo, sube un logo/foto o extrae 3 colores hex exactos de la escena con Gemini Vision.
              </p>
            )}
            <button
              type="button"
              onClick={() => void refinePaletteWithAI()}
              disabled={paletteBusy}
              className="pressable flex w-full items-center justify-center gap-1.5 rounded-xl bg-white/[0.05] py-2 text-[10px] font-extrabold text-cyan-300 transition hover:bg-white/[0.09] disabled:opacity-50"
            >
              {paletteBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {paletteBusy ? 'Extrayendo 3 colores con Gemini Vision…' : '✨ Extraer / Refinar paleta con Gemini Vision'}
            </button>
          </div>
          <p className={labelCls}>🎨 Fondos y texturas de agencia · 16 en cascada</p>
          <div className="grid grid-cols-2 gap-1.5">
            {AFFICHE_THEMES.map((t, i) => (
              <button
                key={t.id}
                onClick={() => {
                  setThemeIdx(i);
                  setUseBrandPalette(false);
                }}
                className={cx(
                  'pressable flex items-center gap-2 rounded-xl p-1.5 text-left transition',
                  themeIdx === i && !activeBrandPalette
                    ? 'bg-impulso-gold/15 shadow-[0_0_24px_-8px_rgba(245,158,11,0.35)] ring-1 ring-impulso-gold/50'
                    : 'bg-slate-950/60 hover:bg-slate-900/90',
                )}
              >
                <span
                  className="h-8 w-8 shrink-0 rounded-lg ring-1 ring-white/15"
                  style={{ background: t.bg, backgroundSize: t.bgSize ?? '100% 100%, 100% 100%, 100% 100%, 100% 100%' }}
                />
                <span className={cx('min-w-0 text-[10px] font-extrabold leading-tight', themeIdx === i && !activeBrandPalette ? 'text-impulso-gold' : 'text-slate-400')}>
                  {t.label}
                </span>
              </button>
            ))}
          </div>
          <p className={labelCls}>🔤 Arquitectura de letras · 8 estilos tipográficos en cascada</p>
          <div className="grid grid-cols-2 gap-1.5">
            {AFFICHE_TYPOS.map((f, i) => (
              <button
                key={f.id}
                onClick={() => setFontIdx(i)}
                className={cx(
                  'pressable rounded-xl px-2.5 py-2 text-left text-[10px] font-extrabold transition',
                  fontIdx === i
                    ? 'bg-impulso-gold/15 text-impulso-gold shadow-[0_0_24px_-8px_rgba(245,158,11,0.3)] ring-1 ring-impulso-gold/45'
                    : 'bg-slate-950/60 text-slate-400 hover:bg-slate-900/90',
                )}
              >
                {f.label}
                <span className="mt-0.5 block font-semibold opacity-70">{f.hint}</span>
              </button>
            ))}
          </div>
          {/* 🔍 V18 · Slider del tamaño del titular (cambia el afiche en vivo) */}
          <div>
            <p className="text-[10px] font-bold text-slate-400">
              🔍 Tamaño del Titular ({Math.round(headlineScale * 100)}%)
            </p>
            <input
              type="range"
              min={0.8}
              max={1.5}
              step={0.05}
              value={headlineScale}
              onChange={(e) => setHeadlineScale(Number(e.target.value))}
              className="w-full accent-impulso-emerald"
            />
            <p className="mt-0.5 text-[9px] font-semibold text-slate-500">
              Agranda el texto principal del afiche en vivo (80% a 150%).
            </p>
          </div>
          <p className={labelCls}>📐 Layout · 30 arquitecturas orgánicas y editoriales</p>
          <div className="grid grid-cols-2 gap-1.5">
            {AFFICHE_LAYOUTS.map((l) => (
              <button
                key={l.id}
                onClick={() => setLayout(l.id)}
                className={cx(
                  'pressable rounded-xl px-2.5 py-2 text-left text-[10px] font-extrabold transition',
                  layout === l.id
                    ? 'bg-impulso-emerald/15 text-impulso-mint shadow-[0_0_24px_-8px_rgba(16,185,129,0.35)] ring-1 ring-impulso-emerald/45'
                    : 'bg-slate-950/60 text-slate-400 hover:bg-slate-900/90',
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
          <p className={labelCls}>🔳 Estilo de QR Dinámico (tinta y centro del tema)</p>
          <div className="grid grid-cols-2 gap-1.5">
            {QR_STYLES.map((q) => (
              <button
                key={q.id}
                onClick={() => {
                  setQrStyle(q.id);
                  lastQrStyleRef.current = q.id;
                }}
                className={cx(
                  'pressable rounded-xl px-2.5 py-2 text-left text-[10px] font-extrabold transition',
                  qrStyle === q.id
                    ? 'bg-impulso-emerald/15 text-impulso-mint shadow-[0_0_24px_-8px_rgba(16,185,129,0.32)] ring-1 ring-impulso-emerald/45'
                    : 'bg-slate-950/60 text-slate-400 hover:bg-slate-900/90',
                )}
              >
                {q.label}
                <span className="mt-0.5 block font-semibold opacity-70">{q.hint}</span>
              </button>
            ))}
          </div>

          <p className={labelCls}>✨ Presentación de Beneficios (cero moldes repetitivos)</p>
          <div className="grid grid-cols-2 gap-1.5">
            {(
              [
                ['auto', '🎲 Auto Dinámico', 'Alterna según el diseño'],
                ['badges', '🔘 Insignias Flotantes', 'Pills y círculos 3D'],
                ['bento', '🧱 Cajas Bento', 'Mosaico asimétrico'],
                ['editorial', '✒️ Editorial Bold', 'Frases grandes sin viñetas'],
                ['ribbons', '🎗️ Cintas de Acento', 'Tiras modernas'],
                ['watermark', '🌊 Tipografía Gigante Fondo', 'Texto masivo opacity 10%'],
                ['callouts', '📐 Líneas Guía Minimal', 'Viñetas finas con 1px solid'],
              ] as const
            ).map(([id, label, hint]) => (
              <button
                key={id}
                onClick={() => setBenefitStyle(id)}
                className={cx(
                  'pressable rounded-xl px-2.5 py-2 text-left text-[10px] font-extrabold transition',
                  id === 'auto' ? 'col-span-2' : '',
                  benefitStyle === id
                    ? 'bg-impulso-gold/15 text-impulso-gold shadow-[0_0_24px_-8px_rgba(245,158,11,0.3)] ring-1 ring-impulso-gold/45'
                    : 'bg-slate-950/60 text-slate-400 hover:bg-slate-900/90',
                )}
              >
                {label}
                <span className="mt-0.5 block font-semibold opacity-70">{hint}</span>
              </button>
            ))}
          </div>

          <p className={labelCls}>Elementos en el afiche</p>
          {(
            [
              [showPrice, setShowPrice, '💰 Precio / promoción (o etiqueta de servicio)'],
              [showBenefits, setShowBenefits, '✅ Los 3 beneficios en diseño dinámico'],
              [showQr, setShowQr, '🔳 QR GIGANTE + dock Glassmorphism'],
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

      {/* ═══ COLUMNA CENTRAL: artboard en vivo (HTML escalado) · V21 anclado
              a la pantalla (sticky) mientras las columnas laterales hacen
              scroll: el afiche SIEMPRE visible y centrado, sin recortarse. ═══ */}
      <div className="lg:sticky lg:top-2 lg:col-span-4 lg:flex lg:max-h-[calc(92dvh-9.5rem)] lg:flex-col lg:overflow-y-auto lg:pb-12">
        <div className="space-y-3 lg:m-auto lg:w-full">
          {/* 📲 V14 · ¿Para qué Red Social es esta publicidad? */}
          <div className={cardCls}>
            <p className="text-xs font-extrabold text-white">📲 ¿Para qué Red Social es esta publicidad?</p>
            <div className="grid grid-cols-2 gap-1.5">
            {SOCIAL_MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => selectSocial(m.id)}
                className={cx(
                  'pressable rounded-xl px-2.5 py-2 text-left text-[10px] font-extrabold transition',
                  socialMode === m.id
                    ? 'bg-impulso-emerald/15 text-impulso-mint shadow-[0_0_24px_-8px_rgba(16,185,129,0.35)] ring-1 ring-impulso-emerald/45'
                    : 'bg-slate-950/60 text-slate-400 hover:bg-slate-900/90',
                )}
              >
                {m.icon} {m.label}
                <span className="mt-0.5 block font-semibold opacity-70">{m.hint}</span>
              </button>
            ))}
            </div>
            {socialMode === 'ig' && (
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => setIgFormatSync('feed')}
                  className={cx(
                    'pressable rounded-xl border px-2 py-1.5 text-[10px] font-extrabold transition',
                    igFormat === 'feed' ? 'border-impulso-gold/60 bg-impulso-gold/15 text-impulso-gold' : 'border-white/10 bg-slate-950/40 text-slate-400',
                  )}
                >
                  🖼️ Post Feed 1:1
                </button>
                <button
                  onClick={() => setIgFormatSync('historia')}
                  className={cx(
                    'pressable rounded-xl border px-2 py-1.5 text-[10px] font-extrabold transition',
                    igFormat === 'historia' ? 'border-impulso-gold/60 bg-impulso-gold/15 text-impulso-gold' : 'border-white/10 bg-slate-950/40 text-slate-400',
                  )}
                >
                  📱 Historia / Reel 9:16
                </button>
              </div>
            )}
            {socialMode === 'tt' && (
              <button
                onClick={() => setTeleprompterOpen(true)}
                className="pressable w-full rounded-xl border border-white/15 bg-slate-950/40 py-2 text-[10px] font-extrabold text-slate-200"
              >
                🎬 Abrir Teleprompter Grande
              </button>
            )}
            <button
              onClick={() => void launchSocial(socialMode)}
              disabled={exporting}
              className="pressable flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-impulso-emerald to-teal-600 py-3 text-xs font-extrabold text-white shadow-glow disabled:opacity-40 disabled:shadow-none"
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {exporting ? 'Preparando la publicación…' : SOCIAL_LAUNCH_LABEL[socialMode]}
            </button>
            <p className="text-[10px] leading-relaxed text-slate-500">
              En celular: comparte la imagen HD + el texto directo a la app. En PC: descarga el PNG en la resolución
              exacta, copia el texto optimizado y abre {SOCIAL_MODES.find((m) => m.id === socialMode)?.label} para pegar
              y publicar.
            </p>
          </div>
          <div className="flex rounded-2xl bg-slate-950/60 p-1">
            {(
              [
                [0, '🏆 Maestra'],
                [1, '⚡ Gancho Viral'],
                [2, '💎 Infografía VIP'],
                [3, '📲 Cierre + QR'],
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
          <div className="grid place-items-center rounded-3xl bg-slate-950/60 p-4 shadow-[0_0_50px_-15px_rgba(59,130,246,0.22)]">
            <div
              style={{ width: PREVIEW_W, height: previewH, overflow: 'hidden' }}
              className="mx-auto block rounded-2xl shadow-[0_24px_60px_-12px_rgba(0,0,0,0.85),0_0_40px_-15px_rgba(16,185,129,0.25)]"
            >
              <div
                style={{
                  width: 540,
                  height: format === 'story' ? 960 : 540,
                  transform: `scale(${previewScale})`,
                  transformOrigin: 'top left',
                }}
              >
                <AfficheArtboard {...artboardProps(piece)} />
              </div>
            </div>
            {(photoBusy || exporting) && (
              <p className="mt-2.5 flex items-center gap-1.5 text-[10px] font-bold text-impulso-mint">
                <Loader2 className="h-3 w-3 animate-spin" /> {exporting ? 'Exportando a 1080p…' : 'Cargando fotografía…'}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => void downloadCurrent()}
              disabled={exporting}
              className="pressable col-span-2 flex items-center justify-center gap-2 rounded-2xl bg-impulso-emerald py-3 text-xs font-extrabold text-slate-950 disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> Descargar pieza actual en HD (PNG 1080p)
            </button>
            <button
              onClick={() => void downloadPack()}
              disabled={exporting}
              className="pressable col-span-2 flex items-center justify-center gap-1.5 rounded-2xl border border-impulso-gold/40 bg-impulso-gold/10 py-3 text-[11px] font-extrabold text-impulso-gold disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> 📦 Descargar Pack Completo de 4 Afiches HD
            </button>
            <button
              onClick={() => void copyKit()}
              className="pressable col-span-2 flex items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-slate-950/40 py-3 text-[11px] font-extrabold text-slate-200"
            >
              <Copy className="h-4 w-4" /> Copiar kit al cliente
            </button>
          </div>
        </div>
      </div>

      {/* ═══ COLUMNA DERECHA: textos, red social objetivo y WhatsApp ═══ */}
      <div className="space-y-3 lg:col-span-4 lg:max-h-[calc(92dvh-9.5rem)] lg:overflow-y-auto lg:pr-1.5 lg:pb-24 overscroll-contain">
        {/* 📱 V21.0 · Selector Reactivo por Red Social en Columna Derecha */}
        <div className={cardCls}>
          <p className="text-xs font-extrabold text-white">📱 ¿Para qué Red Social es esta campaña?</p>
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                ['wa', '🟢 WhatsApp', '*Negrita* y _cursiva_'],
                ['ig', '📸 Instagram / FB', 'Saltos + #Hashtags'],
                ['tt', '🎵 TikTok / Reels', 'Teleprompter 15s'],
              ] as const
            ).map(([id, label, hint]) => {
              const active = id === 'ig' ? socialMode === 'ig' || socialMode === 'fb' : socialMode === id;
              return (
                <button
                  key={id}
                  onClick={() => selectSocial(id)}
                  className={cx(
                    'pressable rounded-xl border px-2 py-2 text-left text-[10px] font-extrabold transition',
                    active
                      ? 'border-impulso-emerald/60 bg-impulso-emerald/15 text-impulso-mint'
                      : 'border-white/10 bg-slate-950/40 text-slate-400',
                  )}
                >
                  {label}
                  <span className="mt-0.5 block font-semibold opacity-70">{hint}</span>
                </button>
              );
            })}
          </div>

          {socialMode === 'wa' && (
            <div className="space-y-2.5 rounded-2xl bg-[#25D366]/[0.08] p-3.5 shadow-[0_0_32px_-14px_rgba(37,211,102,0.3)] ring-1 ring-[#25D366]/25">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#25D366]">
                  💬 Copy nativo WhatsApp (*negrita* · _cursiva_)
                </p>
              </div>
              <p className="whitespace-pre-wrap rounded-xl bg-slate-950/60 p-2.5 text-xs font-medium leading-relaxed text-slate-200">
                {campaign?.socialMediaCopy.aida || waSocialText}
              </p>
              <button
                onClick={() => void copyAndSendWhatsApp(campaign?.socialMediaCopy.aida || waSocialText)}
                className="pressable flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] py-2.5 text-xs font-extrabold text-slate-950"
              >
                <Send className="h-3.5 w-3.5" /> Copiar y Enviar a WhatsApp
              </button>
            </div>
          )}

          {(socialMode === 'ig' || socialMode === 'fb') && (
            <div className="space-y-2.5 rounded-2xl bg-impulso-gold/[0.07] p-3.5 shadow-[0_0_32px_-14px_rgba(245,158,11,0.28)] ring-1 ring-impulso-gold/25">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-impulso-gold">
                  📸 Copy con párrafos y nube de hashtags
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => selectSocial('ig')}
                    className={cx(
                      'rounded-lg px-2 py-0.5 text-[9px] font-extrabold',
                      socialMode === 'ig' ? 'bg-impulso-gold/25 text-impulso-gold' : 'text-slate-400',
                    )}
                  >
                    Instagram
                  </button>
                  <button
                    onClick={() => selectSocial('fb')}
                    className={cx(
                      'rounded-lg px-2 py-0.5 text-[9px] font-extrabold',
                      socialMode === 'fb' ? 'bg-impulso-gold/25 text-impulso-gold' : 'text-slate-400',
                    )}
                  >
                    Facebook
                  </button>
                </div>
              </div>
              <p className="whitespace-pre-wrap rounded-xl bg-slate-950/60 p-2.5 text-xs font-medium leading-relaxed text-slate-200">
                {socialMode === 'fb'
                  ? fbPostText
                  : campaign?.socialMediaCopy.pas
                    ? campaign.socialMediaCopy.pas.includes('#')
                      ? campaign.socialMediaCopy.pas
                      : `${campaign.socialMediaCopy.pas}\n\n${igHashtags}`
                    : igCaption}
              </p>
              <button
                onClick={() =>
                  void copyText(
                    socialMode === 'fb'
                      ? fbPostText
                      : campaign?.socialMediaCopy.pas
                        ? campaign.socialMediaCopy.pas.includes('#')
                          ? campaign.socialMediaCopy.pas
                          : `${campaign.socialMediaCopy.pas}\n\n${igHashtags}`
                        : igCaption,
                    'social-igfb',
                    socialMode === 'fb' ? 'Post de Facebook' : 'Copy Instagram + Hashtags',
                  )
                }
                className="pressable flex w-full items-center justify-center gap-2 rounded-xl border border-impulso-gold/50 bg-impulso-gold/15 py-2.5 text-xs font-extrabold text-impulso-gold"
              >
                <Copy className="h-3.5 w-3.5" /> Copiar texto + hashtags
              </button>
            </div>
          )}

          {socialMode === 'tt' && (
            <div className="space-y-2.5 rounded-2xl bg-slate-950/85 p-3.5 shadow-[0_0_32px_-14px_rgba(34,211,238,0.28)] ring-1 ring-impulso-emerald/30">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-impulso-mint">
                  🎬 Guion de 15 Segundos · Modo Teleprompter
                </p>
                <button
                  onClick={() => setTeleprompterOpen(true)}
                  className="pressable rounded-lg border border-impulso-emerald/50 bg-impulso-emerald/15 px-2.5 py-1 text-[10px] font-extrabold text-impulso-mint"
                >
                  📺 Pantalla completa
                </button>
              </div>
              <p className="whitespace-pre-wrap text-base font-extrabold leading-relaxed text-white">
                {ttScript}
              </p>
              <button
                onClick={() => void copyText(ttScript, 'tt-teleprompter', 'Guion de 15s')}
                className="pressable flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-slate-900 py-2 text-xs font-extrabold text-slate-200"
              >
                <Copy className="h-3.5 w-3.5" /> Copiar guion completo
              </button>
            </div>
          )}
        </div>

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

        {/* 🧰 Herramientas de venta (V12: nombres claros, cero siglas) */}
        <div className={cardCls}>
          <p className="text-xs font-extrabold text-white">🧰 Textos y Herramientas de Venta</p>
          <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
            {(
              [
                ['post', '📘 Post FB/IG'],
                ['grupos', '⚡ Grupos'],
                ['estados', '🟢 Estados'],
                ['video', '🎬 Video 15s'],
                ['cierres', '🤝 Cierres'],
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
          {copyTab === 'post' && (
            <>
              <p className="text-[11px] font-semibold leading-relaxed text-slate-400">
                Texto persuasivo listo para pegar debajo de la imagen cuando la publiques en Facebook, Instagram o grupos.
              </p>
              <CopyBlock
                text={campaign?.socialMediaCopy.pas || fbPostText}
                tag="Anuncio completo para publicar HOY · Facebook / Instagram"
                onCopy={copyText}
                copied={copied}
                inputCls={inputCls}
                onWa={(t) => window.open(`https://wa.me/?text=${encodeURIComponent(t)}`, '_blank', 'noopener,noreferrer')}
              />
            </>
          )}
          {copyTab === 'grupos' && (
            <>
              <p className="text-[11px] font-semibold leading-relaxed text-slate-400">
                Mensaje directo y al grano diseñado para enviar en grupos del municipio sin que la gente se aburra de leer.
              </p>
              <CopyBlock
                text={campaign?.socialMediaCopy.aida || waSocialText}
                tag="Anuncio corto para grupos de WhatsApp"
                onCopy={copyText}
                copied={copied}
                inputCls={inputCls}
                onWa={(t) => window.open(`https://wa.me/?text=${encodeURIComponent(t)}`, '_blank', 'noopener,noreferrer')}
              />
            </>
          )}
          {copyTab === 'estados' && (
            <>
              <p className="text-[11px] font-semibold leading-relaxed text-slate-400">
                Sube estos 3 textos en tus Estados de WhatsApp a lo largo del día para antojar y cerrar ventas hoy mismo.
              </p>
              <CopyBlock
                text={campaign?.whatsappStatusSequence.status1 || statusTexts.status1}
                tag="1 · Gancho de atención inmediata (9:00 - 11:00)"
                onCopy={copyText}
                copied={copied}
                inputCls={inputCls}
                onWa={(t) => window.open(`https://wa.me/?text=${encodeURIComponent(t)}`, '_blank', 'noopener,noreferrer')}
              />
              <CopyBlock
                text={campaign?.whatsappStatusSequence.status2 || statusTexts.status2}
                tag="2 · Demostración de beneficios (12:00)"
                onCopy={copyText}
                copied={copied}
                inputCls={inputCls}
                onWa={(t) => window.open(`https://wa.me/?text=${encodeURIComponent(t)}`, '_blank', 'noopener,noreferrer')}
              />
              <CopyBlock
                text={campaign?.whatsappStatusSequence.status3 || statusTexts.status3}
                tag="3 · Llamado urgente a escribir YA (19:00)"
                onCopy={copyText}
                copied={copied}
                inputCls={inputCls}
                onWa={(t) => window.open(`https://wa.me/?text=${encodeURIComponent(t)}`, '_blank', 'noopener,noreferrer')}
              />
            </>
          )}
          {copyTab === 'video' && (
            <>
              <p className="text-[11px] font-semibold leading-relaxed text-slate-400">
                Instrucciones sencillas en 3 pasos para que tú o el dueño del negocio graben un video ganador con el celular.
              </p>
              <CopyBlock text={campaign?.videoReelScript.t0_3 || videoShots.s1} tag="🎥 Toma 1 · Primeros 3 seg: qué mostrar y qué decir" onCopy={copyText} copied={copied} inputCls={inputCls} />
              <CopyBlock text={campaign?.videoReelScript.t3_10 || videoShots.s2} tag="🎥 Toma 2 · Segundos 4 al 10: demostración" onCopy={copyText} copied={copied} inputCls={inputCls} />
              <CopyBlock text={campaign?.videoReelScript.t10_15 || videoShots.s3} tag="🎥 Toma 3 · Segundos 11 al 15: cierre e invitación" onCopy={copyText} copied={copied} inputCls={inputCls} />
            </>
          )}
          {copyTab === 'cierres' && (
            <>
              <p className="text-[11px] font-semibold leading-relaxed text-slate-400">
                Cuando un cliente escriba al WhatsApp preguntando "¿Precio?" o "¿Información?", responde con estos mensajes para asegurar la venta.
              </p>
              <CopyBlock text={campaign?.salesClosingTemplates.priceReply || closingTexts.priceReply} tag="💸 Cuando preguntan ¿precio?" onCopy={copyText} copied={copied} inputCls={inputCls} />
              <CopyBlock text={campaign?.salesClosingTemplates.hesitantReply || closingTexts.hesitantReply} tag="🤔 Cliente indeciso o que deja de responder" onCopy={copyText} copied={copied} inputCls={inputCls} />
              <CopyBlock text={campaign?.salesClosingTemplates.dispatchUpsell || closingTexts.dispatchUpsell} tag="🛵 Confirmación + venta adicional" onCopy={copyText} copied={copied} inputCls={inputCls} />
            </>
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
          {dispatchMsgs.map((v, i) => (
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

      {/* 🎬 V14 · Teleprompter gigante para grabar TikTok/Reels leyendo a cámara */}
      {teleprompterOpen && (
        <div
          className="fixed inset-0 z-[100] flex cursor-pointer flex-col items-center justify-center bg-slate-950 p-6 text-center"
          onClick={() => setTeleprompterOpen(false)}
          role="button"
          tabIndex={0}
          onKeyDown={() => setTeleprompterOpen(false)}
        >
          <p className="text-xs font-extrabold uppercase tracking-widest text-slate-500">🎬 Teleprompter · toca la pantalla para cerrar</p>
          <p className="mt-6 max-w-3xl whitespace-pre-wrap text-2xl font-extrabold leading-snug text-white sm:text-4xl">{ttScript}</p>
          <p className="mt-6 text-[11px] font-semibold text-slate-400">
            Lee mirando la cámara frontal del celular: 15 segundos, sin papel y sin memorizar.
          </p>
        </div>
      )}
    </div>
  );
}
