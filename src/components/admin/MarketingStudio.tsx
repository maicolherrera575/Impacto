import { useEffect, useMemo, useRef, useState } from 'react';
import * as QRCode from 'qrcode';
import { Check, Copy, Download, ExternalLink, ImagePlus, Loader2, Send, Sparkles } from 'lucide-react';
import type { Offer, Profile } from '../../types';
import { categoryMeta } from '../../types';
import { generateFullMarketingCampaign } from '../../services/gemini.service';
import type { MarketingCampaign } from '../../services/gemini.service';
import { useToast } from '../ui/Toast';
import { cx, formatCOP } from '../../utils/format';
import { waLink } from '../../utils/whatsapp';

// ═══════════════════════════════════════════════════════════════════════════
// 🚀 AGENCIA IA & MULTI-WHATSAPP STUDIO (exclusivo del administrador)
// Todo el arte 1080p se genera 100% en el navegador con <canvas>: 0 bytes en
// Supabase. Los QR se codifican localmente (sin servidores pagos).
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

interface DesignTexts {
  hook: string;
  sub: string;
  headline: string;
  bullets: string;
  cta: string;
}

type Format = 'story' | 'square';

/** 5 temas editoriales de lujo, cada uno con su paleta completa. */
interface Theme {
  id: string;
  label: string;
  bg1: string;
  bg2: string;
  glow: string;
  accent: string;
  text: string;
  sub: string;
  badgeBg: string;
  badgeText: string;
}

const THEMES: Theme[] = [
  { id: 'obsidian', label: '🥂 Obsidian Gold Luxe', bg1: '#0b0b10', bg2: '#191924', glow: 'rgba(245,196,81,0.30)', accent: '#f5c451', text: '#fff7e6', sub: '#cfc8b8', badgeBg: '#f5c451', badgeText: '#241a04' },
  { id: 'esmeralda', label: '🌿 Esmeralda Andino Pro', bg1: '#06231c', bg2: '#0c4232', glow: 'rgba(52,211,153,0.32)', accent: '#34d399', text: '#eafff5', sub: '#a7d8c4', badgeBg: '#34d399', badgeText: '#04211a' },
  { id: 'brasa', label: '🔥 Brasa & Sabor Gourmet', bg1: '#2b1004', bg2: '#5c1c06', glow: 'rgba(251,146,60,0.34)', accent: '#fb923c', text: '#fff3e4', sub: '#e6c4a3', badgeBg: '#f59e0b', badgeText: '#2b1004' },
  { id: 'agro', label: '🚜 Agro & Tierra Premium', bg1: '#1c250c', bg2: '#3d4d19', glow: 'rgba(234,214,122,0.30)', accent: '#ead679', text: '#fdfbee', sub: '#cfcfa8', badgeBg: '#ead679', badgeText: '#24290a' },
  { id: 'cyber', label: '⚡ Cyber Flash Oferta', bg1: '#05070f', bg2: '#0d1633', glow: 'rgba(34,211,238,0.38)', accent: '#22d3ee', text: '#eafcff', sub: '#9ec5d4', badgeBg: '#22d3ee', badgeText: '#04121a' },
];

// ── Utilidades de dibujo ───────────────────────────────────────────────────

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

function coverDraw(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number): void {
  const s = Math.max(w / img.width, h / img.height);
  const iw = img.width * s;
  const ih = img.height * s;
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}

interface SlideArgs {
  theme: Theme;
  format: Format;
  slide: 0 | 1 | 2;
  photo: HTMLImageElement | null;
  qr: HTMLImageElement | null;
  brand: BrandData;
  texts: DesignTexts;
}

/**
 * Renderiza UNA pieza publicitaria de agencia (1080×1920 o 1080×1080)
 * directamente en canvas: foto con máscara de luz, marco editorial,
 * badge de confianza, precio tachado/gigante y QR escaneable.
 */
function drawSlide(canvas: HTMLCanvasElement, a: SlideArgs): void {
  const W = 1080;
  const H = a.format === 'story' ? 1920 : 1080;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const t = a.theme;
  const fs = a.format === 'story' ? 1 : 0.62;

  // Fondo con degradado diagonal + halo radial de luces
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, t.bg1);
  g.addColorStop(1, t.bg2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, H * 0.16, 20, W / 2, H * 0.16, W);
  glow.addColorStop(0, t.glow);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Foto de fondo (cobertura + viñeta cinematográfica que funde con el tema)
  const photoH = a.photo ? Math.round(H * (a.format === 'story' ? 0.55 : 0.36)) : 0;
  if (a.photo) {
    coverDraw(ctx, a.photo, 0, 0, W, photoH);
    const tint = ctx.createLinearGradient(0, 0, 0, photoH);
    tint.addColorStop(0, 'rgba(0,0,0,0.36)');
    tint.addColorStop(0.55, 'rgba(0,0,0,0.10)');
    tint.addColorStop(1, t.bg1);
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, W, photoH);
  }

  // Marco editorial de cristal
  ctx.strokeStyle = t.accent;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 4;
  rr(ctx, 26, 26, W - 52, H - 52, 46);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Badge de confianza
  ctx.font = `800 ${Math.round(30 * fs)}px system-ui, sans-serif`;
  const badge = '✅ COMERCIO RECOMENDADO';
  const bw = ctx.measureText(badge).width + 44 * fs;
  rr(ctx, 60, 58, bw, 62 * fs, 999);
  ctx.fillStyle = t.badgeBg;
  ctx.fill();
  ctx.fillStyle = t.badgeText;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(badge, 60 + 22 * fs, 58 + 31 * fs + 1);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  const zoneBottom = H - (a.slide === 2 ? 210 : 150) * fs;
  const zoneTop = photoH + 30 * fs;

  const hook = a.texts.hook.trim() || a.brand.name || 'Oferta especial';
  const sub = a.texts.sub.trim();
  const headline = a.texts.headline.trim();
  const bullets = a.texts.bullets.split('\n').map((b) => b.trim()).filter(Boolean);
  const cta = a.texts.cta.trim() || '¡Pide el tuyo HOY!';

  if (a.slide === 0) {
    // PIEZA 1 — Gancho magnético anclado al borde inferior
    const hookSize = Math.round(92 * fs);
    ctx.font = `900 ${hookSize}px system-ui, sans-serif`;
    const lines = wrapLines(ctx, hook, W - 150 * fs, 3);
    const lh = Math.round(hookSize * 1.14);
    let y = zoneBottom - lh * lines.length - (sub ? Math.round(70 * fs) : 0);
    ctx.fillStyle = t.text;
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 18 * fs;
    ctx.shadowOffsetY = 4 * fs;
    for (const line of lines) {
      ctx.fillText(line, W / 2, y + hookSize);
      y += lh;
    }
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    if (sub) {
      ctx.font = `600 ${Math.round(44 * fs)}px system-ui, sans-serif`;
      ctx.fillStyle = t.sub;
      for (const line of wrapLines(ctx, sub, W - 200 * fs, 2)) {
        ctx.fillText(line, W / 2, y + Math.round(52 * fs));
        y += Math.round(56 * fs);
      }
    }
  } else if (a.slide === 1) {
    // PIEZA 2 — Oferta estrella: headline + beneficios + precio gigante
    let y = zoneTop;
    const hSize = Math.round(64 * fs);
    ctx.font = `900 ${hSize}px system-ui, sans-serif`;
    ctx.fillStyle = t.text;
    for (const line of wrapLines(ctx, headline, W - 160 * fs, 2)) {
      ctx.fillText(line, W / 2, y + hSize);
      y += Math.round(hSize * 1.2);
    }
    y += 26 * fs;
    ctx.font = `700 ${Math.round(46 * fs)}px system-ui, sans-serif`;
    ctx.fillStyle = t.sub;
    for (const b of bullets.slice(0, 3)) {
      ctx.fillText(b, W / 2, y + Math.round(46 * fs));
      y += Math.round(66 * fs);
    }
    y += 22 * fs;
    if (a.brand.promoPrice != null) {
      if (a.brand.normalPrice != null && a.brand.normalPrice > a.brand.promoPrice) {
        ctx.font = `700 ${Math.round(54 * fs)}px system-ui, sans-serif`;
        const oTxt = formatCOP(a.brand.normalPrice);
        const oW = ctx.measureText(oTxt).width;
        ctx.fillStyle = t.sub;
        ctx.fillText(oTxt, W / 2, y + Math.round(54 * fs));
        ctx.strokeStyle = t.text;
        ctx.lineWidth = 5 * fs;
        ctx.beginPath();
        ctx.moveTo(W / 2 - oW / 2, y + 54 * fs * 0.62);
        ctx.lineTo(W / 2 + oW / 2, y + 54 * fs * 0.62);
        ctx.stroke();
        y += Math.round(84 * fs);
      }
      ctx.font = `900 ${Math.round(150 * fs)}px system-ui, sans-serif`;
      ctx.fillStyle = t.accent;
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = 30 * fs;
      ctx.shadowOffsetY = 6 * fs;
      ctx.fillText(formatCOP(a.brand.promoPrice), W / 2, y + Math.round(140 * fs));
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      y += Math.round(180 * fs);
      const pill = '⚡ SOLO POR HOY';
      ctx.font = `900 ${Math.round(34 * fs)}px system-ui, sans-serif`;
      const pw = ctx.measureText(pill).width + 50 * fs;
      rr(ctx, W / 2 - pw / 2, y, pw, 56 * fs, 999);
      ctx.fillStyle = t.accent;
      ctx.fill();
      ctx.fillStyle = t.badgeText;
      ctx.textBaseline = 'middle';
      ctx.fillText(pill, W / 2, y + 28 * fs + 1);
      ctx.textBaseline = 'alphabetic';
    }
  } else {
    // PIEZA 3 — Cierre: CTA + contacto + QR escaneable
    let y = zoneTop;
    const cSize = Math.round(56 * fs);
    ctx.font = `900 ${cSize}px system-ui, sans-serif`;
    ctx.fillStyle = t.text;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 14 * fs;
    for (const line of wrapLines(ctx, cta, W - 170 * fs, 2)) {
      ctx.fillText(line, W / 2, y + cSize);
      y += Math.round(cSize * 1.22);
    }
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    if (a.qr) {
      const qs = Math.round(300 * fs);
      const pad = Math.round(26 * fs);
      const panel = qs + pad * 2;
      const py = zoneBottom - panel - Math.round(60 * fs);
      rr(ctx, W / 2 - panel / 2, py, panel, panel, 36 * fs);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.drawImage(a.qr, W / 2 - qs / 2, py + pad, qs, qs);
      ctx.font = `700 ${Math.round(34 * fs)}px system-ui, sans-serif`;
      ctx.fillStyle = t.sub;
      ctx.fillText('📲 Escanea y escríbenos al instante', W / 2, py + panel + Math.round(46 * fs));
    }
  }

  // Franja del negocio
  if (a.slide !== 2) {
    ctx.font = `900 ${Math.round(42 * fs)}px system-ui, sans-serif`;
    ctx.fillStyle = t.text;
    ctx.fillText(a.brand.name || 'Impulso', W / 2, H - 92 * fs);
  }
  ctx.font = `600 ${Math.round(30 * fs)}px system-ui, sans-serif`;
  ctx.fillStyle = t.sub;
  const meta = `📍 ${a.brand.address || a.brand.municipality || 'Gachetá'}${a.brand.verified ? `  ·  ⭐ ${a.brand.rating.toFixed(1)}` : ''}`;
  ctx.fillText(meta.slice(0, 64), W / 2, a.slide === 2 ? H - 52 * fs : H - 48 * fs);
}

// ── Helpers de teléfono / WhatsApp ─────────────────────────────────────────

function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 10) digits = `57${digits}`;
  return digits;
}

function fillMessage(message: string, brand: BrandData): string {
  return message
    .replaceAll('{producto}', brand.product || 'tu promoción')
    .replaceAll('{negocio}', brand.name || 'el negocio');
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function triggerDownload(dataUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

// ═════════════════════════════ Componente ═══════════════════════════════════

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
  const [extPhoto, setExtPhoto] = useState<string | null>(null);
  const [extUrl, setExtUrl] = useState('');

  // ── Multi-WhatsApp (3 líneas / embudos) ──
  const [lines, setLines] = useState<WaLine[]>([
    { title: 'Línea 1 · Ventas directas', hint: 'Recibe los pedidos del anuncio', number: '', message: '¡Hola! Vi la promoción de {producto} en {negocio} y quiero pedir el mío 🙌' },
    { title: 'Línea 2 · Domicilios / veredas', hint: 'Despachos a domicilio', number: '', message: '¡Hola! Quiero pedir {producto} a domicilio 🛵. Mi dirección es:' },
    { title: 'Línea 3 · Reservas / mayoristas', hint: 'Eventos, fincas, cantidades', number: '', message: '¡Hola! Necesito {producto} en cantidad para un evento 📦. ¿Me dan precio mayorista?' },
  ]);

  // ── Campaña IA + variantes + textos de diseño ──
  const [campaign, setCampaign] = useState<MarketingCampaign | null>(null);
  const [generating, setGenerating] = useState(false);
  const [texts, setTexts] = useState<DesignTexts>({ hook: '', sub: '', headline: '', bullets: '', cta: '' });
  const [copied, setCopied] = useState<string | null>(null);

  // ── Estudio gráfico ──
  const [themeIdx, setThemeIdx] = useState(1);
  const [format, setFormat] = useState<Format>('story');
  const [slide, setSlide] = useState<0 | 1 | 2>(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [photoImg, setPhotoImg] = useState<HTMLImageElement | null>(null);
  const [qrImg, setQrImg] = useState<HTMLImageElement | null>(null);

  const merchantOffers = useMemo(() => offers.filter((o) => o.merchant?.id === merchantId), [offers, merchantId]);

  /** Marca actual según el modo (plataforma rellena solo, externo es editable). */
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
        url: offer ? `${window.location.origin}${window.location.pathname}?oferta=${offer.id}` : `${window.location.origin}`,
        verified: m?.is_verified ?? false,
        emoji: offer?.emoji_icon ?? '✨',
      };
    }
    const promo = Number(extPromoPrice.replace(/\D/g, '')) || null;
    const normal = Number(extNormalPrice.replace(/\D/g, '')) || null;
    return {
      name: extName,
      slogan: extSlogan,
      product: extProduct,
      normalPrice: normal,
      promoPrice: promo,
      address: extAddress,
      municipality: 'Gachetá',
      rating: 5,
      photo: extPhoto,
      url: extUrl || (lines[0].number ? waLink(normalizePhone(lines[0].number), '') : `${window.location.origin}`),
      verified: true,
      emoji: '✨',
    };
  }, [mode, merchants, merchantId, merchantOffers, offerId, extName, extSlogan, extProduct, extNormalPrice, extPromoPrice, extAddress, extPhoto, extUrl, lines]);

  /** Textos por defecto derivados de la marca (antes de generar IA). */
  const dflt = useMemo<DesignTexts>(
    () => ({
      hook: brand.product ? `¿Ya probaste ${brand.product}?` : brand.name || 'Oferta especial del día',
      sub: brand.slogan || 'Fresquito y recién hecho, solo HOY',
      headline: brand.product
        ? brand.promoPrice != null
          ? `${brand.product} a solo ${formatCOP(brand.promoPrice)}`
          : brand.product
        : 'El favorito del pueblo',
      bullets: '🥇 Calidad garantizada\n🚚 Domicilio disponible\n⏰ Solo por HOY',
      cta: brand.promoPrice != null ? `¡Pide el tuyo HOY a solo ${formatCOP(brand.promoPrice)}! 👉` : '¡Aparta el tuyo HOY! Escríbenos 👉',
    }),
    [brand]
  );

  /** Textos finales del canvas: editables con defaults inteligentes. */
  const T = useMemo<DesignTexts>(
    () => ({
      hook: texts.hook.trim() || dflt.hook,
      sub: texts.sub.trim() || dflt.sub,
      headline: texts.headline.trim() || dflt.headline,
      bullets: texts.bullets.trim() || dflt.bullets,
      cta: texts.cta.trim() || dflt.cta,
    }),
    [texts, dflt]
  );

  /** Enlaces wa.me codificados de las 3 líneas. */
  const lineLinks = useMemo(
    () =>
      lines.map((l) =>
        l.number.trim()
          ? waLink(normalizePhone(l.number), fillMessage(l.message, brand))
          : ''
      ),
    [lines, brand]
  );

  const primaryLink = lineLinks[0] || brand.url;

  /** Objetivo del QR: línea 1 → enlace de la oferta → origen. */
  const qrTarget = primaryLink || `${window.location.origin}`;

  // Carga de la foto del producto (sin taint si es dataURL / Supabase)
  useEffect(() => {
    if (!brand.photo) {
      setPhotoImg(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setPhotoImg(img);
    img.onerror = () => setPhotoImg(null);
    img.src = brand.photo;
  }, [brand.photo]);

  // Codificación local del QR (0 bytes de base de datos)
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
        img.onload = () => setQrImg(img);
        img.src = url;
      })
      .catch(() => setQrImg(null));
    return () => {
      alive = false;
    };
  }, [qrTarget]);

  // Render en vivo del canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawSlide(canvas, { theme: THEMES[themeIdx], format, slide, photo: photoImg, qr: qrImg, brand, texts: T });
  }, [themeIdx, format, slide, photoImg, qrImg, brand, T]);

  /** Subida de foto del cliente externo: procesada en memoria, redimensionada. */
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
        setExtPhoto(c.toDataURL('image/jpeg', 0.85));
        toast.success('🖼️ Foto cargada en memoria (0 bytes en la base de datos)');
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }

  /** ✨ Genera la campaña estratégica con IA (con fallback local integrado). */
  async function generate(): Promise<void> {
    if (!brand.name.trim()) {
      toast.error('Elige un comercio (o escribe el nombre del negocio externo) primero');
      return;
    }
    setGenerating(true);
    try {
      const res = await generateFullMarketingCampaign({
        businessName: brand.name,
        slogan: brand.slogan,
        product: brand.product,
        normalPrice: brand.normalPrice,
        promoPrice: brand.promoPrice,
        address: brand.address,
        municipality: brand.municipality || 'Gachetá',
        targetUrl: primaryLink || brand.url,
      });
      setCampaign(res);
      setTexts({
        hook: res.visualHooks.slide1_hook,
        sub: res.visualHooks.slide1_sub,
        headline: res.visualHooks.slide2_headline,
        bullets: res.visualHooks.slide2_bullets.join('\n'),
        cta: res.visualHooks.slide3_cta,
      });
      toast.success('✨ ¡Estrategia 360° lista! Revisa los textos, el copy y el guion');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo generar la campaña');
    } finally {
      setGenerating(false);
    }
  }

  /** 📲 4 versiones del anuncio con redacción variada (anti-spam de grupos). */
  const variants = useMemo(() => {
    const price = brand.promoPrice != null ? ` a SOLO ${formatCOP(brand.promoPrice)}` : '';
    const normal =
      brand.normalPrice != null && brand.promoPrice != null && brand.normalPrice > brand.promoPrice
        ? ` (antes ${formatCOP(brand.normalPrice)})`
        : '';
    const addr = brand.address || brand.municipality || 'Gachetá';
    const hook = campaign?.visualHooks.slide1_hook ?? `¿Ya probaste ${brand.product || 'lo nuevo'}?`;
    const reveal = campaign?.visualHooks.slide2_headline ?? '';
    const scarcity = campaign?.visualHooks.slide3_cta ?? '¡Pide el tuyo HOY!';
    const p = brand.product || 'la promoción';
    return [
      `${brand.emoji} ${hook}\n${p}${price}${normal} · 📍 ${addr}\n${scarcity}\n👉 ${primaryLink}`,
      `🔥 ¡CORRE QUE SE VUELA! ${p} volando hoy en ${brand.name || 'el negocio'}${price}${normal}\n📍 ${addr} · pide con 1 clic 👉 ${primaryLink}`,
      `🚨 ÚLTIMAS UNIDADES: ${p}\nEl pueblo ya está apartando el suyo${price}\n📍 ${addr}\n👉 ${primaryLink}`,
      `🤔 ¿Almuerzo o antojo resuelto HOY? ${reveal || p}\n📍 ${brand.name || 'El negocio'} — ${addr}\nEscríbenos sin compromiso 👉 ${primaryLink}`,
    ];
  }, [brand, campaign, primaryLink]);

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
        `${(brand.name || 'impulso').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-pieza-${slide + 1}-${format === 'story' ? '1080x1920' : '1080x1080'}.png`
      );
      toast.success('📥 Pieza HD descargada (lista para publicar)');
    } catch {
      toast.error('La foto de la campaña bloquea la exportación: cambia la imagen');
    }
  }

  /** 📦 Exporta las 3 piezas como pack listo para publicar en secuencia. */
  async function downloadPack(): Promise<void> {
    try {
      for (const s of [0, 1, 2] as const) {
        const c = document.createElement('canvas');
        drawSlide(c, { theme: THEMES[themeIdx], format, slide: s, photo: photoImg, qr: qrImg, brand, texts: T });
        triggerDownload(
          c.toDataURL('image/png'),
          `${(brand.name || 'impulso').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-pieza-${s + 1}-${format === 'story' ? '1080x1920' : '1080x1080'}.png`
        );
        await wait(500);
      }
      toast.success('📦 ¡Pack completo de 3 piezas descargado!');
    } catch {
      toast.error('La foto de la campaña bloquea la exportación: cambia la imagen');
    }
  }

  /** 📋 Kit completo para entregar al cliente (guion + textos + enlaces). */
  async function copyKit(): Promise<void> {
    const c = campaign;
    const kit = [
      `🚀 KIT DE CAMPAÑA — ${brand.name || 'Cliente'}`,
      `═══════════════════════════`,
      `📲 ENLACES MULTI-WHATSAPP`,
      lines.map((l, i) => `${l.title}: ${lineLinks[i] || '(sin número)'}`).join('\n'),
      `🔗 Enlace de la oferta: ${brand.url}`,
      `═══════════════════════════`,
      `✅ SECUENCIA DE ESTADOS (9:00 → 12:00 → 19:00)`,
      `1️⃣ ${(c?.whatsappStatusSequence.status1 ?? T.hook)}`,
      `2️⃣ ${(c?.whatsappStatusSequence.status2 ?? T.headline)}`,
      `3️⃣ ${(c?.whatsappStatusSequence.status3 ?? T.cta)}`,
      `═══════════════════════════`,
      `📣 COPY PAS (Facebook / Instagram)`,
      c?.socialMediaCopy.pas ?? '—',
      `📣 COPY AIDA FLASH (Grupos / Clasificados)`,
      c?.socialMediaCopy.aida ?? '—',
      `═══════════════════════════`,
      `🎬 GUION REEL 15 SEGUNDOS`,
      `· 0-3 s: ${c?.videoReelScript.t0_3 ?? '—'}`,
      `· 3-10 s: ${c?.videoReelScript.t3_10 ?? '—'}`,
      `· 10-15 s: ${c?.videoReelScript.t10_15 ?? '—'}`,
      `═══════════════════════════`,
      `💬 RESPUESTAS DE CIERRE PARA EL COMERCIANTE`,
      `· ¿Precio? ${c?.salesClosingTemplates.priceReply ?? '—'}`,
      `· Indeciso: ${c?.salesClosingTemplates.hesitantReply ?? '—'}`,
      `· Despacho: ${c?.salesClosingTemplates.dispatchUpsell ?? '—'}`,
      `═══════════════════════════`,
      `🧩 4 VERSIONES PARA COMPARTIR (anti-spam)`,
      variants.map((v, i) => `— Versión ${i + 1} —\n${v}`).join('\n\n'),
    ].join('\n');
    await copyText(kit, 'kit', '📋 Kit completo');
  }

  const hasBrand = mode === 'plataforma' ? merchantId !== '' : extName.trim() !== '';
  const inputCls =
    'w-full rounded-xl border border-white/10 bg-slate-950/60 px-3.5 py-2.5 text-sm font-medium text-white placeholder:text-slate-600 outline-none focus:border-impulso-emerald/60';

  return (
    <div className="space-y-4 p-4">
      {/* Cabecera del estudio */}
      <div className="rounded-3xl border border-impulso-emerald/30 bg-gradient-to-br from-impulso-emerald/10 to-transparent p-4">
        <p className="flex items-center gap-2 text-base font-extrabold text-impulso-mint">
          <Sparkles className="h-5 w-5" /> Agencia IA & Multi-WhatsApp Studio
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
          Suite profesional de marketing: campaña estratégica con IA, piezas gráficas HD 1080p generadas 100% en tu
          navegador (0 bytes en la base de datos), QR escaneable y orquestación de hasta 3 líneas de WhatsApp.
        </p>
      </div>

      {/* ── Modo dual ── */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setMode('plataforma')}
          className={cx(
            'pressable rounded-2xl border px-3 py-3 text-left text-xs font-extrabold transition',
            mode === 'plataforma'
              ? 'border-impulso-emerald/60 bg-impulso-emerald/15 text-impulso-mint'
              : 'border-white/10 bg-slate-950/40 text-slate-300'
          )}
        >
          🏪 Comercio registrado
          <span className="mt-0.5 block text-[10px] font-semibold text-slate-400">Datos y ofertas de Impulso, todo automático</span>
        </button>
        <button
          onClick={() => setMode('externo')}
          className={cx(
            'pressable rounded-2xl border px-3 py-3 text-left text-xs font-extrabold transition',
            mode === 'externo'
              ? 'border-impulso-gold/60 bg-impulso-gold/15 text-impulso-gold'
              : 'border-white/10 bg-slate-950/40 text-slate-300'
          )}
        >
          ✨ Cliente externo
          <span className="mt-0.5 block text-[10px] font-semibold text-slate-400">Negocios, eventos o fincas que contratan por fuera</span>
        </button>
      </div>

      {/* ── Fuente de datos según el modo ── */}
      {mode === 'plataforma' ? (
        <div className="space-y-2 rounded-3xl border border-white/10 bg-impulso-card p-3.5">
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
              {merchantId !== '' && merchantOffers.length === 0 && (
                <p className="text-[10px] font-semibold text-slate-500">Este comercio no tiene ofertas activas ahora mismo.</p>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2 rounded-3xl border border-white/10 bg-impulso-card p-3.5">
          <p className="text-xs font-extrabold text-white">✨ Datos del negocio externo</p>
          <div className="grid grid-cols-2 gap-2">
            <input value={extName} onChange={(e) => setExtName(e.target.value)} placeholder="Nombre del negocio/marca *" className={inputCls} />
            <input value={extSlogan} onChange={(e) => setExtSlogan(e.target.value)} placeholder="Eslogan o rubro" className={inputCls} />
          </div>
          <input value={extProduct} onChange={(e) => setExtProduct(e.target.value)} placeholder="Producto / promoción estrella" className={inputCls} />
          <div className="grid grid-cols-2 gap-2">
            <input value={extNormalPrice} onChange={(e) => setExtNormalPrice(e.target.value.replace(/\D/g, ''))} placeholder="Precio normal (opcional)" inputMode="numeric" className={inputCls} />
            <input value={extPromoPrice} onChange={(e) => setExtPromoPrice(e.target.value.replace(/\D/g, ''))} placeholder="Precio promo (opcional)" inputMode="numeric" className={inputCls} />
          </div>
          <input value={extAddress} onChange={(e) => setExtAddress(e.target.value)} placeholder="Dirección / referencia en el pueblo" className={inputCls} />
          <input value={extUrl} onChange={(e) => setExtUrl(e.target.value)} placeholder="Enlace de destino (web o wa.me…)" className={inputCls} />
          <div className="flex items-center gap-3">
            <label className="pressable flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-slate-950/40 py-2.5 text-xs font-bold text-slate-300">
              <ImagePlus className="h-4 w-4" />
              {extPhoto ? 'Cambiar foto' : 'Subir foto del producto'}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoFile(e.target.files?.[0])} />
            </label>
            {extPhoto && <img src={extPhoto} alt="" className="h-12 w-12 rounded-xl border border-white/10 object-cover" />}
          </div>
          <p className="text-[10px] text-slate-500">La foto se procesa en la memoria del navegador: no se sube a Supabase.</p>
        </div>
      )}

      {/* ── Orquestador multi-WhatsApp ── */}
      <div className="space-y-2.5 rounded-3xl border border-white/10 bg-impulso-card p-3.5">
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

      {/* ── Generador de campaña 360° ── */}
      <button
        onClick={() => void generate()}
        disabled={generating || !hasBrand}
        className="pressable flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-impulso-emerald to-teal-600 py-3.5 text-sm font-extrabold text-white shadow-glow disabled:opacity-40 disabled:shadow-none"
      >
        {generating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
        {generating ? 'Estrategia en camino…' : '✨ Generar Estrategia y Creativos con IA'}
      </button>

      {campaign && (
        <div className="space-y-2.5">
          {/* Secuencia de estados */}
          <div className="rounded-3xl border border-impulso-emerald/25 bg-impulso-card p-3.5">
            <p className="text-xs font-extrabold text-impulso-mint">✅ Secuencia psicológica de 3 Estados de WhatsApp</p>
            {(
              [
                ['9:00 / 11:00 · Curiosidad', campaign.whatsappStatusSequence.status1],
                ['Con la pieza 2 · Revelación', campaign.whatsappStatusSequence.status2],
                ['19:00 · Escasez + prueba social', campaign.whatsappStatusSequence.status3],
              ] as const
            ).map(([tag, txt], i) => (
              <div key={tag} className="mt-2 rounded-2xl bg-slate-950/50 p-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{tag}</p>
                <p className="mt-1 whitespace-pre-wrap text-xs font-semibold leading-relaxed text-slate-200">{txt}</p>
                <button
                  onClick={() => void copyText(txt, `st${i}`, 'Estado')}
                  className="pressable mt-1.5 flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-impulso-mint"
                >
                  {copied === `st${i}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} Copiar
                </button>
              </div>
            ))}
          </div>

          {/* Copy PAS / AIDA */}
          {(
            [
              ['📣 Copy PAS (Facebook / Instagram)', campaign.socialMediaCopy.pas, 'pas'],
              ['⚡ Copy AIDA Flash (Grupos / Clasificados)', campaign.socialMediaCopy.aida, 'aida'],
            ] as const
          ).map(([tag, txt, key]) => (
            <div key={key} className="rounded-3xl border border-white/10 bg-impulso-card p-3.5">
              <p className="text-xs font-extrabold text-white">{tag}</p>
              <p className="mt-1.5 whitespace-pre-wrap rounded-2xl bg-slate-950/50 p-2.5 text-xs font-semibold leading-relaxed text-slate-200">{txt}</p>
              <button
                onClick={() => void copyText(txt, key, 'Copy')}
                className="pressable mt-1.5 flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-impulso-mint"
              >
                {copied === key ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} Copiar
              </button>
            </div>
          ))}

          {/* Guion Reel */}
          <div className="rounded-3xl border border-white/10 bg-impulso-card p-3.5">
            <p className="text-xs font-extrabold text-white">🎬 Guion técnico de Reel / TikTok (15 s)</p>
            <div className="mt-1.5 space-y-1.5">
              {(
                [
                  ['⏱️ 0-3 s', campaign.videoReelScript.t0_3],
                  ['⏱️ 3-10 s', campaign.videoReelScript.t3_10],
                  ['⏱️ 10-15 s', campaign.videoReelScript.t10_15],
                ] as const
              ).map(([tag, txt]) => (
                <p key={tag} className="rounded-xl bg-slate-950/50 px-2.5 py-2 text-[11px] font-semibold leading-relaxed text-slate-300">
                  <span className="font-extrabold text-impulso-gold">{tag}</span> — {txt}
                </p>
              ))}
            </div>
          </div>

          {/* Plantillas de cierre */}
          <div className="rounded-3xl border border-impulso-gold/25 bg-impulso-card p-3.5">
            <p className="text-xs font-extrabold text-impulso-gold">💬 Embudo de cierre (entrégale esto al comerciante)</p>
            <div className="mt-1.5 space-y-1.5">
              {(
                [
                  ['💸 Cuando preguntan ¿precio?', campaign.salesClosingTemplates.priceReply],
                  ['🤔 Cliente indeciso', campaign.salesClosingTemplates.hesitantReply],
                  ['🛵 Confirmación + upsell', campaign.salesClosingTemplates.dispatchUpsell],
                ] as const
              ).map(([tag, txt], i) => (
                <div key={tag} className="rounded-xl bg-slate-950/50 px-2.5 py-2">
                  <p className="text-[10px] font-extrabold text-slate-500">{tag}</p>
                  <p className="mt-0.5 text-[11px] font-semibold leading-relaxed text-slate-200">{txt}</p>
                  <button
                    onClick={() => void copyText(txt, `cl${i}`, 'Respuesta')}
                    className="pressable mt-1 flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-impulso-gold"
                  >
                    {copied === `cl${i}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} Copiar
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Despacho rápido multi-WhatsApp ── */}
      <div className="rounded-3xl border border-white/10 bg-impulso-card p-3.5">
        <p className="text-xs font-extrabold text-white">📲 Despacho Rápido Multi-WhatsApp (4 versiones anti-spam)</p>
        <p className="mt-0.5 text-[10px] font-semibold text-slate-500">
          Redacciones distintas para compartir en varios grupos/estados sin que WhatsApp te marque spam.
        </p>
        {variants.map((v, i) => (
          <div key={i} className="mt-2 rounded-2xl bg-slate-950/50 p-2.5">
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

      {/* ── Estudio gráfico HD ── */}
      <div className="space-y-3 rounded-3xl border border-impulso-gold/25 bg-impulso-card p-3.5">
        <p className="text-xs font-extrabold text-white">🎨 Estudio gráfico HD (canvas 100% en tu navegador)</p>

        {/* Temas */}
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {THEMES.map((t, i) => (
            <button
              key={t.id}
              onClick={() => setThemeIdx(i)}
              className={cx(
                'pressable shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-extrabold transition',
                themeIdx === i ? 'border-impulso-gold/60 bg-impulso-gold/15 text-impulso-gold' : 'border-white/10 bg-slate-950/40 text-slate-400'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Formato + pieza */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex rounded-xl bg-slate-950/60 p-1">
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
                  'pressable flex-1 rounded-lg py-2 text-[10px] font-extrabold transition',
                  format === f ? 'bg-impulso-gold/20 text-impulso-gold' : 'text-slate-400'
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex rounded-xl bg-slate-950/60 p-1">
            {(
              [
                [0, '1 · Gancho'],
                [1, '2 · Oferta'],
                [2, '3 · Cierre QR'],
              ] as const
            ).map(([s, label]) => (
              <button
                key={s}
                onClick={() => setSlide(s)}
                className={cx(
                  'pressable flex-1 rounded-lg py-2 text-[10px] font-extrabold transition',
                  slide === s ? 'bg-impulso-emerald/20 text-impulso-mint' : 'text-slate-400'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Canvas en vivo */}
        <canvas
          ref={canvasRef}
          className="mx-auto block w-full max-w-sm rounded-2xl border border-white/10 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.7)]"
        />

        {/* Edición de textos en caliente */}
        <div className="space-y-2">
          <input value={texts.hook} onChange={(e) => setTexts((p) => ({ ...p, hook: e.target.value }))} placeholder="Gancho (pieza 1)" className={inputCls} />
          <input value={texts.sub} onChange={(e) => setTexts((p) => ({ ...p, sub: e.target.value }))} placeholder="Subtítulo (pieza 1)" className={inputCls} />
          <input value={texts.headline} onChange={(e) => setTexts((p) => ({ ...p, headline: e.target.value }))} placeholder="Titular de la oferta (pieza 2)" className={inputCls} />
          <textarea
            value={texts.bullets}
            onChange={(e) => setTexts((p) => ({ ...p, bullets: e.target.value }))}
            rows={3}
            placeholder="3 beneficios (uno por línea, con emoji)"
            className={cx(inputCls, 'resize-none')}
          />
          <input value={texts.cta} onChange={(e) => setTexts((p) => ({ ...p, cta: e.target.value }))} placeholder="Llamado a la acción (pieza 3)" className={inputCls} />
        </div>

        {/* Exportaciones */}
        <div className="grid grid-cols-1 gap-2">
          <button
            onClick={downloadCurrent}
            className="pressable flex items-center justify-center gap-2 rounded-2xl bg-impulso-emerald py-3 text-xs font-extrabold text-slate-950"
          >
            <Download className="h-4 w-4" /> Descargar pieza actual en HD (PNG 1080p)
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => void downloadPack()}
              className="pressable flex items-center justify-center gap-1.5 rounded-2xl border border-impulso-gold/40 bg-impulso-gold/10 py-3 text-[11px] font-extrabold text-impulso-gold"
            >
              <Download className="h-4 w-4" /> Pack 3 piezas
            </button>
            <button
              onClick={() => void copyKit()}
              className="pressable flex items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-slate-950/40 py-3 text-[11px] font-extrabold text-slate-200"
            >
              <ExternalLink className="h-4 w-4" /> Copiar kit al cliente
            </button>
          </div>
        </div>
      </div>

      {!hasBrand && (
        <p className="rounded-2xl border border-dashed border-white/15 bg-slate-950/40 p-3 text-center text-[11px] font-semibold text-slate-500">
          👆 Elige un comercio o escribe el nombre del cliente externo para activar la IA y el estudio gráfico.
        </p>
      )}
    </div>
  );
}
