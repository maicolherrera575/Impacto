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
import * as QRCode from 'qrcode';
import { toPng, getFontEmbedCSS } from 'html-to-image';
import { Check, Copy, Dices, Download, ImagePlus, Loader2, Send, Sparkles, Trash2, Wand2 } from 'lucide-react';
import type { Offer, Profile } from '../../types';
import { categoryMeta } from '../../types';
import {
  generateArtDirection,
  generateCampaignCopy,
  normSpaces,
  synthesizeCampaign,
  synthesizeSmartCampaignFromBrief,
} from '../../services/gemini.service';
import type { ArtDirection, CampaignFocus, MarketingCampaign, PriceMode } from '../../services/gemini.service';
import { loadBankPhoto, isPollinationsBlockImage } from '../../utils/commercialPhotoBank';
import {
  AfficheArtboard,
  AFFICHE_THEMES,
} from './AfficheArtboard';
import type { AfficheFormat, AfficheLayout, AffichePiece, AfficheProps } from './AfficheArtboard';
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
];

const BADGE_PRESETS: Array<{ id: string; label: string }> = [
  { id: 'calidad', label: '💎 CALIDAD GARANTIZADA' },
  { id: 'tiempo', label: '🔥 OFERTA POR TIEMPO LIMITADO' },
  { id: 'especialidad', label: '⭐ ESPECIALIDAD DE LA CASA' },
  { id: 'verificado', label: '✅ NEGOCIO VERIFICADO' },
];

/** Presets manuales HD (el banco automático vive en commercialPhotoBank). */
const PHOTO_PRESETS: Array<{ id: string; label: string }> = [
  { id: 'photo-1568901346375-23c9450c5869', label: '🍔 Gastronomía' },
  { id: 'photo-1509440159596-0249088772ff', label: '🥐 Panadería/Café' },
  { id: 'photo-1544025162-d76694265947', label: '🥩 Asadero/Carnes' },
  { id: 'photo-1500595046743-cd271d694d30', label: '🐄 Agro/Campo' },
  { id: 'photo-1606811841689-23dfddce3e95', label: '🦷 Odontología' },
  { id: 'photo-1560066984-138dadb34c00', label: '💅 Belleza/Spa' },
  { id: 'photo-1503951914875-452162b0f3f1', label: '💈 Barbería' },
  { id: 'photo-1552053831-71594a27632d', label: '🐶 Mascotas' },
  { id: 'photo-1460925895917-afdab627c93f', label: '📈 Marketing' },
  { id: 'photo-1498050108023-c5249f4df085', label: '💻 Tecnología' },
  { id: 'photo-1504148455328-c376907d081c', label: '🛠️ Ferretería' },
  { id: 'photo-1501700493788-fa1a4fc9fe62', label: '🚚 Transporte' },
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

const PRESET_URL = (id: string): string =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1080&q=85`;

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

// ═══════════════════════════════ Componente ═════════════════════════════════

/** Texto honesto cuando aún no hay campaña generada (NUNCA copy prefabricado). */
const EMPTY_COPY = '✨ Genera la campaña con IA y este texto aparecerá aquí';

type CopyTab = 'post' | 'grupos' | 'estados' | 'video' | 'cierres';

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
  const [texts, setTexts] = useState<Texts>({ plain: '', highlight: '', sub: '', benefits: ['', '', ''], cta: '', priceLabel: '💬 Cotiza gratis por WhatsApp' });
  const [copied, setCopied] = useState<string | null>(null);
  const [copyTab, setCopyTab] = useState<CopyTab>('post');

  // ── Estudio gráfico (V11: artboard HTML en vez de canvas 2D) ──
  const [themeIdx, setThemeIdx] = useState(1);
  const [format, setFormat] = useState<Format>('story');
  const [layout, setLayout] = useState<Layout>('bento');
  const [piece, setPiece] = useState<Piece>(0);
  const [badgeMode, setBadgeMode] = useState<string>('calidad');
  const [badgeCustom, setBadgeCustom] = useState('');
  const [showPrice, setShowPrice] = useState(true);
  const [showBenefits, setShowBenefits] = useState(true);
  const [showQr, setShowQr] = useState(true);

  // ── Fotografía ──
  const [customPhoto, setCustomPhoto] = useState<string | null>(null);
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
      customPhoto,
      photoZoom,
      photoPosY,
    });
  }, [mode, merchantId, offerId, extName, extSlogan, extProduct, extNormalPrice, extPromoPrice, extAddress, extUrl, lines, briefText, priceMode, focus, detectedCategory, texts, themeIdx, format, layout, piece, badgeMode, badgeCustom, showPrice, showBenefits, showQr, customPhoto, photoZoom, photoPosY]);

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
      const dataUrl = await loadBankPhoto(
        `${extName} ${extSlogan} ${extProduct} ${briefText}`,
        Math.floor(Math.random() * 1000),
      );
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
    const h = `${T.plain} ${T.highlight}`.trim().replace(/[?!.¡¿]+$/g, '').trim();
    return h ? `¿${h.toUpperCase()}?` : '';
  }, [T.plain, T.highlight]);

  /** Enlaces wa.me codificados de las 3 líneas. */
  const lineLinks = useMemo(
    () => lines.map((l) => (l.number.trim() ? waLink(normalizePhone(l.number), fillMessage(l.message, brand)) : '')),
    [lines, brand],
  );

  const primaryLink = lineLinks[0] || brand.url;
  const qrTarget = primaryLink || `${window.location.origin}`;

  // Foto efectiva (subida/IA/banco) con fallback a la del comercio.
  const effectivePhoto = customPhoto ?? brand.photo;

  // QR codificado localmente (0 bytes en la base de datos) — se muestra como
  // <img> dataURL en el artboard: captura limpia, sin tainting del canvas.
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(qrTarget, {
      margin: 1,
      width: 480,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => {
        if (alive) setQrUrl(url);
      })
      .catch(() => setQrUrl(null));
    return () => {
      alive = false;
    };
  }, [qrTarget]);

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
    themeId: AFFICHE_THEMES[themeIdx]?.id ?? 'marble',
    layout,
    format,
    piece: p,
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
    photoUrl: effectivePhoto,
    qrUrl,
    photoZoom,
    photoPosY,
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
      // Aplica el tema y layout recomendados por la IA (rota por rubro).
      const ti = AFFICHE_THEMES.findIndex((t) => t.id === art.themeId);
      if (ti >= 0) setThemeIdx(ti);
      if (AFFICHE_LAYOUTS.some((l) => l.id === art.layoutId)) setLayout(art.layoutId as Layout);

      // ── Auto-imagen paso 1: foto HD real del BANCO COMERCIAL al instante ──
      toast.info('📷 Foto editorial HD del rubro colocada en el lienzo…');
      void (async () => {
        const dataUrl = await loadBankPhoto(
          briefText.trim() || `${bizName} ${art.categoryLabel} ${product}`,
          Math.floor(Math.random() * 1000),
        );
        if (dataUrl && photoGenRef.current === genId) setCustomPhoto(dataUrl);
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
          // Banner de bloqueo o fallo de red: banco comercial HD al rescate.
          const bank = await loadBankPhoto(
            briefText.trim() || `${bizName} ${art.categoryLabel} ${product}`,
            Math.floor(Math.random() * 1000),
          );
          if (bank && photoGenRef.current === genId) setCustomPhoto(bank);
        }
      })();

      if (synthetic) {
        toast.info('⚡ IA saturada: campaña generada por el motor sintético local (100% completa)');
      }
      const themeLabel = ti >= 0 ? AFFICHE_THEMES[ti].label : art.themeId;
      toast.success(`✨ ¡Campaña única lista! Tema ${themeLabel} + layout ${art.layoutId} aplicados`);
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
      // Banner de bloqueo de Pollinations o fallo de red → Banco Comercial HD.
      const bank = await loadBankPhoto(briefSource, Math.floor(Math.random() * 1000));
      if (bank && photoGenRef.current === genId) {
        setCustomPhoto(bank);
        toast.success('📸 Foto HD real del banco comercial aplicada (motor IA saturado)');
      } else {
        toast.error('Sin foto disponible ahora: prueba un preset HD o sube una foto');
      }
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

  /** 🎲 V11 · Sorpréndeme: cambia fondo + arquitectura en un clic, SIEMPRE
   *  evitando el diseño actual, y trae una foto nueva del banco HD. */
  function surpriseDesign(): void {
    let ni = themeIdx;
    while (AFFICHE_THEMES.length > 1 && ni === themeIdx) ni = Math.floor(Math.random() * AFFICHE_THEMES.length);
    setThemeIdx(ni);
    const others = AFFICHE_LAYOUTS.filter((l) => l.id !== layout);
    const nl = others[Math.floor(Math.random() * others.length)];
    if (nl) setLayout(nl.id);
    // Foto nueva del banco (otra toma, otro clic).
    void loadBankPhoto(
      briefText.trim() || `${brand.name} ${brand.slogan} ${brand.product}`,
      Math.floor(Math.random() * 1000),
    ).then((p) => {
      if (p) setCustomPhoto(p);
    });
    const themeName = AFFICHE_THEMES[ni].label.split(' ').slice(1).join(' ');
    toast.success(`🎲 Nueva propuesta completa: ${themeName} + ${nl ? nl.label.split(' ').slice(1).join(' ') : layout}`);
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
      dispatchMsgs.map((v, i) => `— Versión ${i + 1} —\n${v}`).join('\n\n'),
    ].join('\n');
    await copyText(kit, 'kit', '📋 Kit completo');
  }

  const hasBrand = mode === 'plataforma' ? merchantId !== '' : extName.trim() !== '';
  const inputCls =
    'w-full rounded-xl border border-white/10 bg-slate-950/60 px-3.5 py-2.5 text-sm font-medium text-white placeholder:text-slate-600 outline-none focus:border-impulso-emerald/60';
  const labelCls = 'text-[10px] font-extrabold uppercase tracking-wider text-slate-500';
  const cardCls = 'space-y-2.5 rounded-3xl border border-white/10 bg-impulso-card p-3.5';

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
      </div>

      {/* Cabecera */}
      <div className="rounded-3xl border border-impulso-emerald/30 bg-gradient-to-br from-impulso-emerald/10 to-transparent p-4 lg:col-span-12">
        <p className="flex items-center gap-2 text-base font-extrabold text-impulso-mint">
          <Sparkles className="h-5 w-5" /> Agencia IA & Multi-WhatsApp Studio
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
          Motor de diseño editorial HTML a 1080p: 12 fondos texturizados de agencia, 8 arquitecturas de afiche con
          tipografía real, banco fotográfico HD de 120+ fotos que rota en cada clic y IA infalible que SIEMPRE llena la
          campaña — 0 bytes en la base de datos. Todo se autoguarda mientras trabajas.
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
          </div>
        )}

        {/* Brief IA */}
        <div className="space-y-2.5 rounded-3xl border border-impulso-emerald/30 bg-impulso-emerald/5 p-3.5">
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
            Banco HD de 120+ fotos reales que rota en cada clic, motor IA con guardia anti-banner y subida propia: todo
            vive en la memoria del navegador.
          </p>
        </div>

        {/* Controles de diseño */}
        <div className={cardCls}>
          <p className="text-xs font-extrabold text-white">🎨 Controles de diseño</p>
          <button
            onClick={surpriseDesign}
            className="pressable flex w-full items-center justify-center gap-2 rounded-xl border border-impulso-gold/50 bg-impulso-gold/10 py-2.5 text-xs font-extrabold text-impulso-gold"
          >
            <Dices className="h-4 w-4" /> 🎲 Sorpréndeme con Otro Diseño Radical
          </button>
          <p className={labelCls}>Arquitectura · 16 diseños de agencia</p>
          <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {AFFICHE_THEMES.map((t, i) => (
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
          <p className={labelCls}>Layout (arquitectura del afiche)</p>
          <div className="grid grid-cols-2 gap-1.5">
            {AFFICHE_LAYOUTS.map((l) => (
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
              [showQr, setShowQr, '🔳 QR GIGANTE + botón de WhatsApp'],
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

      {/* ═══ COLUMNA CENTRAL: artboard en vivo (HTML escalado) ═══ */}
      <div className="lg:sticky lg:top-4 lg:col-span-4">
        <div className="space-y-3">
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
          <div className="grid place-items-center rounded-3xl border border-white/10 bg-slate-950/30 p-3">
            <div
              style={{ width: PREVIEW_W, height: previewH, overflow: 'hidden' }}
              className="mx-auto block rounded-2xl border border-white/10 shadow-2xl"
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
              <p className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-impulso-mint">
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
                text={campaign?.socialMediaCopy.pas || EMPTY_COPY}
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
                text={campaign?.socialMediaCopy.aida || EMPTY_COPY}
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
                text={campaign?.whatsappStatusSequence.status1 || EMPTY_COPY}
                tag="1 · Gancho de atención inmediata (9:00 - 11:00)"
                onCopy={copyText}
                copied={copied}
                inputCls={inputCls}
                onWa={(t) => window.open(`https://wa.me/?text=${encodeURIComponent(t)}`, '_blank', 'noopener,noreferrer')}
              />
              <CopyBlock
                text={campaign?.whatsappStatusSequence.status2 || EMPTY_COPY}
                tag="2 · Demostración de beneficios (12:00)"
                onCopy={copyText}
                copied={copied}
                inputCls={inputCls}
                onWa={(t) => window.open(`https://wa.me/?text=${encodeURIComponent(t)}`, '_blank', 'noopener,noreferrer')}
              />
              <CopyBlock
                text={campaign?.whatsappStatusSequence.status3 || EMPTY_COPY}
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
              <CopyBlock text={campaign?.videoReelScript.t0_3 || EMPTY_COPY} tag="🎥 Toma 1 · Primeros 3 seg: qué mostrar y qué decir" onCopy={copyText} copied={copied} inputCls={inputCls} />
              <CopyBlock text={campaign?.videoReelScript.t3_10 || EMPTY_COPY} tag="🎥 Toma 2 · Segundos 4 al 10: demostración" onCopy={copyText} copied={copied} inputCls={inputCls} />
              <CopyBlock text={campaign?.videoReelScript.t10_15 || EMPTY_COPY} tag="🎥 Toma 3 · Segundos 11 al 15: cierre e invitación" onCopy={copyText} copied={copied} inputCls={inputCls} />
            </>
          )}
          {copyTab === 'cierres' && (
            <>
              <p className="text-[11px] font-semibold leading-relaxed text-slate-400">
                Cuando un cliente escriba al WhatsApp preguntando "¿Precio?" o "¿Información?", responde con estos mensajes para asegurar la venta.
              </p>
              <CopyBlock text={campaign?.salesClosingTemplates.priceReply || EMPTY_COPY} tag="💸 Cuando preguntan ¿precio?" onCopy={copyText} copied={copied} inputCls={inputCls} />
              <CopyBlock text={campaign?.salesClosingTemplates.hesitantReply || EMPTY_COPY} tag="🤔 Cliente indeciso o que deja de responder" onCopy={copyText} copied={copied} inputCls={inputCls} />
              <CopyBlock text={campaign?.salesClosingTemplates.dispatchUpsell || EMPTY_COPY} tag="🛵 Confirmación + venta adicional" onCopy={copyText} copied={copied} inputCls={inputCls} />
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
    </div>
  );
}
