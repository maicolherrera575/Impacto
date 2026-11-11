import { useEffect, useState } from 'react';
import { Loader2, MessageCircle, Minus, Navigation, PartyPopper, Plus, ShieldCheck, Star } from 'lucide-react';
import type { Offer, Ticket } from '../../types';
import { categoryMeta } from '../../types';
import { ModalShell } from '../ui/ModalShell';
import { useToast } from '../ui/Toast';
import { reserveOffer } from '../../services/reservations.service';
import { incrementViews } from '../../services/offers.service';
import { friendlyError } from '../../services/supabase';
import { countdownText, cx, formatCOP, ratingAvg } from '../../utils/format';
import { useTick } from '../../hooks/useTick';
import { openWhatsApp } from '../../utils/whatsapp';
import { deliveryMeta } from '../../types';

type Step = 'detail' | 'form' | 'success';

interface OfferDetailModalProps {
  offer: Offer | null;
  onClose: () => void;
  /** Registra el ticket en el dispositivo y en el estado de la app. */
  onReserved: (ticket: Ticket) => void;
  onViewTickets: () => void;
}

const STEPS: Record<Step, string> = { detail: 'La oferta', form: 'Apartar', success: '¡Listo!' };

/**
 * Modal de oferta con deep-linking viral: se abre automáticamente al
 * llegar desde un enlace compartido (?oferta=UUID) y permite apartar
 * en segundos sin registro.
 */
export function OfferDetailModal({ offer, onClose, onReserved, onViewTickets }: OfferDetailModalProps) {
  const toast = useToast();
  const now = useTick(1000);
  const [step, setStep] = useState<Step>('detail');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [ticket, setTicket] = useState<Ticket | null>(null);

  useEffect(() => {
    if (offer) {
      setStep('detail');
      setQuantity(1);
      setNote('');
      setTicket(null);
      incrementViews(offer.id);
    }
  }, [offer]);

  if (!offer) return null;

  const countdown = countdownText(offer.expires_at, now);
  const merchant = offer.merchant;
  const cat = categoryMeta(offer.category);
  const delivery = deliveryMeta(offer.delivery_type);
  const maxQty = Math.min(20, Math.max(1, offer.available_quota));

  async function handleReserve() {
    if (name.trim().length < 2) {
      toast.error('Escribe tu nombre para poder entregarte el pedido');
      return;
    }
    if (!/^3\d{9}$/.test(phone.trim())) {
      toast.error('Tu WhatsApp debe ser un celular de 10 dígitos que empiece por 3 (ej: 3201234567)');
      return;
    }
    setLoading(true);
    try {
      const result = await reserveOffer({
        offerId: offer!.id,
        customerName: name.trim(),
        customerPhone: phone.trim(),
        quantity,
        customerNote: note.trim(),
      });
      const t: Ticket = {
        reservationId: result.reservation.id,
        code: result.reservation.reservation_code,
        offerId: offer!.id,
        offerTitle: offer!.title,
        offerEmoji: offer!.emoji_icon,
        promoPrice: Number(offer!.promo_price),
        quantity,
        customerName: result.reservation.customer_name,
        merchantId: result.merchant.id,
        merchantName: result.merchant.business_name,
        merchantWhatsapp: result.merchant.whatsapp,
        status: result.reservation.status,
        isRated: false,
        createdAt: Date.now(),
      };
      setTicket(t);
      setStep('success');
      onReserved(t);
      toast.success(`¡Apartado! Tu código es ${t.code} 🎟️`);
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalShell open onClose={onClose} panelClassName="max-w-md">
      <div className="p-5 pt-14">
        {/* Encabezado contextual */}
        <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-500">{STEPS[step]}</p>

        {step === 'detail' && (
          <div className="animate-fade-in">
            <div className="flex items-start gap-4">
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-white/10 bg-slate-950/50 text-4xl">
                {offer.emoji_icon}
              </div>
              <div className="min-w-0 flex-1">
                <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-400">
                  {cat.emoji} {cat.label}
                </span>
                <h2 className="mt-1.5 text-xl font-extrabold leading-tight text-white">{offer.title}</h2>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <span
                className={cx(
                  'rounded-full px-3 py-1.5 font-bold',
                  countdown.urgent ? 'bg-impulso-rose/15 text-impulso-rose' : 'bg-impulso-emerald/10 text-impulso-mint'
                )}
              >
                {countdown.text}
              </span>
              <span className="rounded-full bg-white/5 px-3 py-1.5 font-semibold text-slate-300">
                🔥 Quedan {offer.available_quota} de {offer.total_quota}
              </span>
            </div>

            {/* Foto micro-WebP (opcional) con el emoji flotando encima */}
            {offer.image_thumb && (
              <div className="relative mb-3 overflow-hidden rounded-xl">
                <img src={offer.image_thumb} alt={offer.title} className="h-48 w-full object-cover" />
                <span className="absolute bottom-2 right-2 grid h-10 w-10 place-items-center rounded-full bg-slate-950/60 text-xl backdrop-blur-md">
                  {offer.emoji_icon}
                </span>
              </div>
            )}

            <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-white/10 bg-slate-950/40 p-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-impulso-emerald/10 text-lg">🏪</div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-sm font-bold text-white">
                  {merchant?.business_name ?? 'Comercio local'}
                  {merchant?.is_verified && (
                    <span className="flex items-center text-impulso-mint" title="Negocio verificado">
                      <ShieldCheck className="h-4 w-4" />
                    </span>
                  )}
                </p>
                <p className="flex items-center gap-1 text-xs font-semibold text-impulso-gold">
                  <Star className="h-3 w-3" fill="currentColor" />
                  {ratingAvg(merchant?.rating_sum ?? 5, merchant?.rating_count ?? 1)} · {offer.municipality}
                </p>
              </div>
            </div>

            <p className="mt-4 text-[15px] leading-relaxed text-slate-300">{offer.description}</p>

            {/* Modalidad de entrega segura elegida por el comercio */}
            <p className="mt-3 flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/40 p-3 text-xs font-semibold text-slate-300">
              <span className="text-base">{delivery.emoji}</span>
              Entrega: {delivery.label}
            </p>

            {/* Escudo comunitario: aviso preventivo para comercios sin verificación */}
            {merchant && !merchant.is_verified && (
              <p className="mt-3 flex items-start gap-2 rounded-2xl border border-impulso-gold/25 bg-impulso-gold/5 p-3 text-[11px] font-semibold leading-relaxed text-amber-200/90">
                <span className="text-sm leading-none">🛡️</span>
                <span>
                  Comercio en proceso de verificación local: te recomendamos recibir tu pedido en un punto público del
                  casco urbano o pagar únicamente contra entrega.
                </span>
              </p>
            )}

            {/* Ruta al negocio: el GPS del teléfono calcula el trayecto al instante */}
            {offer.lat != null && offer.lng != null && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${offer.lat},${offer.lng}`}
                target="_blank"
                rel="noreferrer"
                className="pressable mt-3 flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-slate-950/40 py-3 text-sm font-bold text-impulso-mint transition hover:bg-impulso-emerald/10"
              >
                <Navigation className="h-4 w-4" />
                Cómo llegar hasta aquí
              </a>
            )}

            <div className="mt-4 flex items-end justify-between rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <div>
                {offer.original_price != null && Number(offer.original_price) > Number(offer.promo_price) && (
                  <p className="text-sm font-medium text-slate-500 line-through">{formatCOP(offer.original_price)}</p>
                )}
                <p className="text-3xl font-extrabold tracking-tight text-impulso-mint">{formatCOP(offer.promo_price)}</p>
              </div>
              <p className="text-right text-xs font-semibold text-slate-400">
                {offer.views_count} 👀 vistas
                <br />· {offer.municipality}
              </p>
            </div>

            <button
              onClick={() => setStep('form')}
              disabled={offer.available_quota <= 0 || countdown.expired}
              className="pressable mt-4 w-full rounded-2xl bg-gradient-to-r from-impulso-emerald to-teal-600 py-4 text-base font-extrabold text-white shadow-glow disabled:opacity-40 disabled:shadow-none"
            >
              {offer.available_quota <= 0 ? '🥲 Se agotó' : countdown.expired ? 'Oferta finalizada' : 'Apartar el mío YA'}
            </button>
          </div>
        )}

        {step === 'form' && (
          <div className="animate-fade-in">
            <h2 className="text-lg font-extrabold text-white">
              {offer.emoji_icon} Aparta tu {offer.title.toLowerCase().slice(0, 42)}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Sin registro, sin tarjeta. Solo tus datos de contacto para avisarle al comercio.
            </p>

            <div className="mt-4 space-y-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre *"
                maxLength={60}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3.5 text-[15px] font-medium text-white placeholder:text-slate-600 outline-none focus:border-impulso-emerald/60"
              />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                placeholder="Tu WhatsApp * (ej: 3201234567)"
                inputMode="tel"
                maxLength={10}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3.5 text-[15px] font-medium text-white placeholder:text-slate-600 outline-none focus:border-impulso-emerald/60"
              />
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/50 p-3">
                <span className="text-sm font-semibold text-slate-300">Cantidad</span>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    aria-label="Quitar una unidad"
                    className="pressable grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-impulso-panel text-white disabled:opacity-40"
                    disabled={quantity <= 1}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-8 text-center text-lg font-extrabold text-white">{quantity}</span>
                  <button
                    onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                    aria-label="Agregar una unidad"
                    className="pressable grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-impulso-panel text-white disabled:opacity-40"
                    disabled={quantity >= maxQty}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Nota para el comercio (opcional) · ej: sin cebolla"
                maxLength={140}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3.5 text-[15px] font-medium text-white placeholder:text-slate-600 outline-none focus:border-impulso-emerald/60"
              />
              <div className="flex items-center justify-between rounded-2xl bg-impulso-emerald/10 px-4 py-3">
                <span className="text-sm font-semibold text-slate-300">Total a pagar al recoger</span>
                <span className="text-xl font-extrabold text-impulso-mint">{formatCOP(Number(offer.promo_price) * quantity)}</span>
              </div>
              <p className="flex items-start gap-2 rounded-2xl border border-impulso-emerald/25 bg-impulso-emerald/5 p-3 text-[11px] font-semibold leading-relaxed text-impulso-mint">
                <span className="text-sm leading-none">🔒</span>
                <span>
                  Conexión protegida: por seguridad de la comunidad, tu solicitud registra código de dispositivo e IP
                  conforme a la Ley 1581 de 2012.
                </span>
              </p>
            </div>

            <button
              onClick={handleReserve}
              disabled={loading}
              className="pressable mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-impulso-emerald to-teal-600 py-4 text-base font-extrabold text-white shadow-glow disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> Apartando…
                </>
              ) : (
                'Confirmar mi apartado 🎟️'
              )}
            </button>
          </div>
        )}

        {step === 'success' && ticket && (
          <div className="animate-scale-in text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-impulso-emerald/15">
              <PartyPopper className="h-8 w-8 text-impulso-mint" />
            </div>
            <h2 className="mt-3 text-2xl font-extrabold text-white">¡Apartado exitoso!</h2>
            <p className="mt-1 text-sm text-slate-400">
              Presenta este código en {ticket.merchantName} para recoger tu pedido.
            </p>

            <div className="mt-4 rounded-3xl border border-dashed border-impulso-emerald/50 bg-impulso-emerald/5 p-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Código de reserva</p>
              <p className="mt-1 font-mono text-5xl font-extrabold tracking-[0.3em] text-impulso-mint">{ticket.code}</p>
              <p className="mt-2 text-sm font-semibold text-slate-300">
                {ticket.quantity} × {ticket.offerTitle}
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => openWhatsApp(ticket.merchantWhatsapp, `Hola ${ticket.merchantName}! Aparté el pedido ${ticket.code} en Impulso 🎟️`)}
                className="pressable flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] py-3.5 text-sm font-extrabold text-white"
              >
                <MessageCircle className="h-5 w-5" /> WhatsApp
              </button>
              <button
                onClick={() => {
                  onClose();
                  onViewTickets();
                }}
                className="pressable rounded-2xl border border-white/10 bg-slate-950/40 py-3.5 text-sm font-bold text-slate-200"
              >
                🎟️ Mis apartados
              </button>
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
}
