import { useMemo, useState } from 'react';
import { Loader2, MessageCircle, Trash2 } from 'lucide-react';
import type { Ticket } from '../../types';
import { ModalShell } from '../ui/ModalShell';
import { Stars } from '../ui/Stars';
import { useToast } from '../ui/Toast';
import { rateReservation } from '../../services/reservations.service';
import { friendlyError } from '../../services/supabase';
import { formatCOP } from '../../utils/format';
import { openWhatsApp, ticketContactMessage } from '../../utils/whatsapp';
import { ticketStatusLabel } from '../../utils/storage';

interface ReservationsTabProps {
  tickets: Ticket[];
  onRate: (ticket: Ticket, stars: number) => Promise<void>;
  onRemove: (reservationId: string) => void;
  /** Cancela el apartado en el servidor y devuelve el cupo al comercio. */
  onCancel: (ticket: Ticket) => Promise<void>;
}

/**
 * Pestaña 3: tickets del cliente guardados en el dispositivo, con chat
 * directo al comercio y calificación por estrellas.
 */
export function ReservationsTab({ tickets, onRate, onRemove, onCancel }: ReservationsTabProps) {
  const toast = useToast();
  const [ratingFor, setRatingFor] = useState<Ticket | null>(null);
  const [stars, setStars] = useState(5);
  const [loading, setLoading] = useState(false);
  const [cancelFor, setCancelFor] = useState<Ticket | null>(null);
  const [canceling, setCanceling] = useState(false);

  const sorted = useMemo(() => [...tickets].sort((a, b) => b.createdAt - a.createdAt), [tickets]);

  async function submitRating() {
    if (!ratingFor) return;
    setLoading(true);
    try {
      await rateReservation(ratingFor.reservationId, ratingFor.code, stars);
      await onRate(ratingFor, stars);
      toast.success('¡Gracias por calificar! ⭐');
      setRatingFor(null);
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  async function submitCancel() {
    if (!cancelFor) return;
    setCanceling(true);
    try {
      await onCancel(cancelFor);
      toast.success(' Pedido cancelado: el cupo volvió al comercio para que otro lo aproveche ♻️');
      setCancelFor(null);
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setCanceling(false);
    }
  }

  return (
    <section className="mx-auto max-w-xl px-3 pt-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-white">🎟️ Mis apartados</h2>
          <p className="text-xs text-slate-500">Guardados en este dispositivo, sin necesidad de cuenta</p>
        </div>
        <span className="rounded-full bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-300">{tickets.length}</span>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/10 bg-impulso-panel/60 p-10 text-center">
          <p className="text-4xl">🎟️</p>
          <p className="mt-3 font-bold text-white">Todavía no tienes apartados</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-400">
            Cuando apartes una oferta del radar, tu ticket aparecerá aquí con su código único.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((t) => (
            <article key={t.reservationId} className="rounded-3xl border border-white/10 bg-impulso-card p-4 shadow-card">
              <div className="flex items-start gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/10 bg-slate-950/50 text-2xl">
                  {t.offerEmoji}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold text-white">{t.offerTitle}</p>
                  <p className="truncate text-xs font-semibold text-slate-400">
                    🏪 {t.merchantName} · {t.quantity} × {formatCOP(t.promoPrice)}
                  </p>
                </div>
                <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-bold text-slate-300">
                  {ticketStatusLabel(t.status)}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between rounded-2xl border border-dashed border-impulso-emerald/40 bg-impulso-emerald/5 px-4 py-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Código</p>
                  <p className="font-mono text-2xl font-extrabold tracking-[0.25em] text-impulso-mint">{t.code}</p>
                </div>
                {t.status === 'pending' && !t.isRated && (
                  <button
                    onClick={() => {
                      setRatingFor(t);
                      setStars(5);
                    }}
                    className="pressable rounded-xl border border-impulso-gold/40 bg-impulso-gold/10 px-3 py-2 text-xs font-bold text-impulso-gold"
                  >
                    ⭐ Calificar
                  </button>
                )}
              </div>

              <div className="mt-3 flex items-center gap-2">
                {t.status === 'pending' && (
                  <button
                    onClick={() => openWhatsApp(t.merchantWhatsapp, ticketContactMessage(t))}
                    className="pressable flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#25D366] py-3 text-sm font-extrabold text-white"
                  >
                    <MessageCircle className="h-5 w-5" /> Chatear con el comercio
                  </button>
                )}
                <button
                  onClick={() => (t.status === 'pending' ? setCancelFor(t) : onRemove(t.reservationId))}
                  title={t.status === 'pending' ? 'Cancelar apartado y liberar el cupo' : 'Eliminar ticket del dispositivo'}
                  aria-label={t.status === 'pending' ? 'Cancelar apartado' : 'Eliminar ticket'}
                  className="pressable grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-slate-950/40 text-slate-500 hover:text-impulso-rose"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Confirmación de cancelación con devolución de cupo */}
      <ModalShell open={cancelFor !== null} onClose={() => !canceling && setCancelFor(null)}>
        {cancelFor && (
          <div className="p-5 pt-14 text-center">
            <p className="text-4xl">🗑️</p>
            <h3 className="mt-2 text-lg font-extrabold text-white">¿Ya no vas a pasar por este pedido?</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-400">
              Si lo cancelas, le devolveremos el cupo al comerciante para que otra persona lo aproveche.
            </p>
            <p className="mt-3 rounded-2xl border border-white/10 bg-slate-950/40 p-3 text-xs font-semibold text-slate-300">
              {cancelFor.offerEmoji} {cancelFor.offerTitle} · {cancelFor.quantity} × {formatCOP(cancelFor.promoPrice)}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => setCancelFor(null)}
                disabled={canceling}
                className="pressable rounded-2xl border border-white/10 bg-slate-950/40 py-3.5 text-sm font-bold text-slate-200 disabled:opacity-50"
              >
                Volver
              </button>
              <button
                onClick={() => void submitCancel()}
                disabled={canceling}
                className="pressable flex items-center justify-center gap-2 rounded-2xl bg-impulso-rose py-3.5 text-sm font-extrabold text-white disabled:opacity-60"
              >
                {canceling ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Sí, cancelar'}
              </button>
            </div>
          </div>
        )}
      </ModalShell>

      {/* Calificación */}
      <ModalShell open={ratingFor !== null} onClose={() => setRatingFor(null)}>
        {ratingFor && (
          <div className="p-5 pt-14 text-center">
            <h3 className="text-lg font-extrabold text-white">
              ¿Cómo te fue en {ratingFor.merchantName}?
            </h3>
            <p className="mt-1 text-sm text-slate-400">Tu calificación ayuda a todo el pueblo a comprar mejor.</p>
            <div className="mt-4 flex justify-center">
              <Stars value={stars} onChange={setStars} size="md" />
            </div>
            <button
              onClick={submitRating}
              disabled={loading}
              className="pressable mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-impulso-emerald to-teal-600 py-3.5 text-sm font-extrabold text-white shadow-glow disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : `Enviar ${stars} ⭐`}
            </button>
          </div>
        )}
      </ModalShell>
    </section>
  );
}
