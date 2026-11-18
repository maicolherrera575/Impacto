import { BadgeCheck, Crown, MessageSquareShare, Share2, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { Offer } from '../../types';
import { categoryMeta, resolveTrustLevel } from '../../types';
import { countdownText, cx, formatCOP, ratingAvg } from '../../utils/format';
import { distanceText } from '../../utils/geo';
import { useTick } from '../../hooks/useTick';

interface OfferCardProps {
  offer: Offer;
  /** Distancia en metros desde el usuario (null si no hay GPS). */
  distance: number | null;
  onOpen: () => void;
  onShare: () => void;
  /** 📲 Texto magnético listo para el Estado de WhatsApp. */
  onStatus: () => void;
  /** Reporte comunitario 🛡️: abre el modal de motivos (3 reportes tumban la oferta). */
  onReport: () => void;
  /** Este dispositivo ya reportó la oferta: el botón queda deshabilitado. */
  reported?: boolean;
  /** V32.0 · Oferta recién publicada vía Realtime (resaltado suave). */
  isNew?: boolean;
  /** V13 · Abre el Perfil Público del comercio (?comercio=UUID). */
  onOpenMerchant?: (merchantId: string) => void;
}

/**
 * Tarjeta de alta conversión: insignia de verificado, estrellas, distancia,
 * reloj dinámico inteligente, precios tachados y barra de stock en vivo.
 */
export function OfferCard({ offer, distance, onOpen, onShare, onStatus, onReport, reported = false, isNew = false, onOpenMerchant }: OfferCardProps) {
  const now = useTick(1000);
  const countdown = countdownText(offer.expires_at, now);
  const merchant = offer.merchant;
  const remaining = offer.available_quota;
  const pct = offer.total_quota > 0 ? Math.round((remaining / offer.total_quota) * 100) : 0;
  const cat = categoryMeta(offer.category);
  const trustLevel = resolveTrustLevel(merchant);

  return (
    <article
      className={cx(
        'card-lift relative overflow-hidden rounded-3xl border border-white/[0.08] bg-impulso-card p-4 shadow-card transition-all duration-300 hover:border-impulso-emerald/25',
        countdown.urgent && 'border-impulso-rose/25',
        trustLevel === 'super' &&
          'border-impulso-gold/65 ring-1 ring-impulso-gold/30 shadow-[0_0_28px_-6px_rgba(245,158,11,0.32)]',
        isNew && 'border-impulso-emerald/70 ring-2 ring-impulso-emerald/45 shadow-glow animate-pulse-soft'
      )}
    >
      {/* Urgencia superior */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {isNew && (
          <span className="rounded-full bg-impulso-emerald/20 px-2.5 py-1 text-[11px] font-extrabold text-impulso-mint">
            ⚡ Recién llegada
          </span>
        )}
        <span
          className={cx(
            'rounded-full px-2.5 py-1 text-[11px] font-bold',
            countdown.urgent
              ? 'bg-impulso-rose/15 text-impulso-rose animate-pulse-soft'
              : 'bg-impulso-emerald/10 text-impulso-mint'
          )}
        >
          {countdown.text}
        </span>
        {distance !== null && (
          <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-300">
            {distanceText(distance)}
          </span>
        )}
        <span className="ml-auto rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-400">
          {cat.emoji} {cat.label}
        </span>
      </div>

      {/* Foto micro-WebP (opcional): nítida, ultra liviana, con badges flotantes */}
      {offer.image_thumb && (
        <button
          onClick={onOpen}
          className="relative mb-3 block h-40 w-full overflow-hidden rounded-xl"
          aria-label={`Ver ${offer.title}`}
        >
          <img src={offer.image_thumb} alt={offer.title} className="h-40 w-full object-cover" loading="lazy" />
          <span className="absolute left-2 top-2 rounded-full bg-slate-950/60 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-md">
            {cat.emoji} {cat.label}
          </span>
          <span className="absolute bottom-2 right-2 grid h-9 w-9 place-items-center rounded-full bg-slate-950/60 text-lg backdrop-blur-md">
            {offer.emoji_icon}
          </span>
        </button>
      )}

      <div className="flex items-start gap-3.5">
        {/* Emote del producto */}
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-white/10 bg-slate-950/50 text-3xl">
          {offer.emoji_icon}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-bold leading-snug text-white" title={offer.title}>
            {offer.title}
          </h3>

          {/* Comercio + verificado + calificación (V13: el nombre abre el Perfil Público) */}
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            {merchant && onOpenMerchant ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenMerchant(merchant.id);
                }}
                title="Ver el perfil oficial del comercio"
                className="max-w-[160px] truncate font-semibold text-slate-300 underline decoration-slate-600 decoration-dotted underline-offset-2 transition hover:text-impulso-mint"
              >
                🏪 {merchant.business_name}
              </button>
            ) : (
              <span className="max-w-[160px] truncate font-semibold text-slate-300">
                {merchant?.business_name ?? 'Comercio local'}
              </span>
            )}
            {trustLevel === 'super' ? (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-impulso-gold/45 bg-impulso-gold/15 px-2 py-0.5 text-[10px] font-extrabold text-impulso-gold"
                title="Nivel 3 · Súper Comercio con trayectoria impecable"
              >
                <Crown className="h-3 w-3" />
                Súper Comercio
              </span>
            ) : trustLevel === 'verified' ? (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-extrabold text-sky-300 ring-1 ring-sky-400/40"
                title="Nivel 2 · Comercio Verificado con RUT/Cédula"
              >
                <BadgeCheck className="h-3.5 w-3.5 fill-sky-500 text-slate-950" />
                Verificado
              </span>
            ) : (
              <span
                className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300"
                title="Nivel 1 · Comercio Nuevo"
              >
                Comercio Nuevo
              </span>
            )}
            <span className="flex items-center gap-0.5 font-bold text-impulso-gold">
              ⭐ {ratingAvg(merchant?.rating_sum ?? 5, merchant?.rating_count ?? 1)}
            </span>
          </div>

          {trustLevel === 'new' && (
            <p className="mt-2 rounded-xl border border-amber-400/25 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-semibold leading-snug text-amber-200/95">
              ⚠️ Comercio Nuevo: Para tu seguridad, Impulso recomienda pagar únicamente al recibir el producto o servicio.
            </p>
          )}

          {/* Precios */}
          <div className="mt-1.5 flex items-baseline gap-2">
            {offer.original_price != null && Number(offer.original_price) > Number(offer.promo_price) && (
              <span className="text-sm font-medium text-slate-500 line-through">
                {formatCOP(offer.original_price)}
              </span>
            )}
            <span className="text-xl font-extrabold tracking-tight text-impulso-mint tabular-nums">
              {formatCOP(offer.promo_price)}
            </span>
          </div>
        </div>
      </div>

      {/* Barra de progreso de stock en vivo */}
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-[11px] font-semibold">
          <span className={remaining <= 3 ? 'text-impulso-rose' : 'text-slate-400'}>
            {remaining <= 3 ? `🔥 ¡Quedan ${remaining} disponibles!` : `Quedan ${remaining} de ${offer.total_quota}`}
          </span>
          <span className="text-slate-500">{pct}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
          <div
            className={cx(
              'stock-bar-fill relative h-full rounded-full transition-all duration-500',
              remaining <= 3 ? 'bg-gradient-to-r from-impulso-rose to-orange-500' : 'bg-gradient-to-r from-impulso-emerald to-teal-400'
            )}
            style={{ width: `${Math.max(4, pct)}%` }}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>

      {/* Acciones principales */}
      <div className="mt-3.5 flex items-center gap-2">
        <button
          onClick={onOpen}
          disabled={remaining <= 0}
          className="pressable flex-1 rounded-2xl bg-gradient-to-r from-impulso-emerald to-teal-600 py-3 text-sm font-extrabold text-white shadow-glow disabled:opacity-40 disabled:shadow-none"
        >
          {remaining <= 0 ? '🥲 Se agotó' : 'Apartar el mío YA'}
        </button>
        <button
          onClick={onShare}
          title="Compartir oferta por WhatsApp"
          aria-label="Compartir oferta"
          className="pressable grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-slate-950/40 text-slate-300 hover:text-impulso-mint"
        >
          <Share2 className="h-5 w-5" />
        </button>
        <button
          onClick={onStatus}
          title="📲 Texto listo para tu Estado de WhatsApp"
          aria-label="Estado de WhatsApp"
          className="pressable grid h-12 w-10 place-items-center rounded-2xl border border-white/10 bg-slate-950/40 text-slate-300 transition hover:border-[#25D366]/50 hover:text-[#25D366]"
        >
          <MessageSquareShare className="h-4 w-4" />
        </button>
        {reported ? (
          <button
            disabled
            title="Ya reportaste esta oferta desde este dispositivo"
            aria-label="Oferta ya reportada"
            className="grid h-12 w-10 place-items-center rounded-2xl border border-impulso-emerald/30 bg-impulso-emerald/10 text-impulso-mint opacity-80"
          >
            <ShieldCheck className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={onReport}
            title="Reportar esta oferta: elige el motivo (producto falso, precio engañoso…)"
            aria-label="Reportar oferta"
            className="pressable grid h-12 w-10 place-items-center rounded-2xl border border-white/10 bg-slate-950/40 text-slate-500 transition hover:border-impulso-rose/40 hover:text-impulso-rose"
          >
            <ShieldAlert className="h-4 w-4" />
          </button>
        )}
      </div>
    </article>
  );
}
