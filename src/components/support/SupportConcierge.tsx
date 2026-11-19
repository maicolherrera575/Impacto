import { useEffect, useRef, useState } from 'react';
import {
  BadgeCheck,
  CheckCircle2,
  Crown,
  Loader2,
  MapPin,
  Mic,
  MicOff,
  Radar,
  Send,
  Sparkles,
  Ticket,
} from 'lucide-react';
import type { Offer } from '../../types';
import { resolveTrustLevel } from '../../types';
import { ModalShell } from '../ui/ModalShell';
import { useToast } from '../ui/Toast';
import { askSupportConcierge } from '../../services/gemini.service';
import type { RadarMatchedOfferContext } from '../../services/gemini.service';
import { submitSupportTicket } from '../../services/support.service';
import type { SupportChatMessage, SupportRole } from '../../services/support.service';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { buildLiveOffersDigest, matchLiveOffersForRadar } from '../../utils/radarMatcher';
import { distanceText } from '../../utils/geo';
import type { LatLng } from '../../utils/geo';
import { cx, formatCOP } from '../../utils/format';

interface SupportConciergeProps {
  userRole: SupportRole;
  userName: string;
  municipality: string;
  /** Ofertas activas ya cargadas en memoria para recomendación en tiempo real (<5ms, 0 tokens). */
  offers?: Offer[];
  /** Posición GPS efímera voluntaria (Ley 1581: null si el usuario no la activó). */
  geoPos?: LatLng | null;
  /** Abre directamente el modal de apartado para una oferta recomendada. */
  onReserveOffer?: (offer: Offer) => void;
  /** Minimiza Radar y centra el mapa en el pin de la oferta recomendada. */
  onFocusOfferOnMap?: (offer: Offer) => void;
  /** Dispara apertura y consulta directa desde otras vistas (ej. búsqueda vacía). */
  externalPrompt?: { text: string; seq: number } | null;
  /** Posición flotante: en vista radar siempre flota sobre BottomNav en PC y móvil. */
  bottomOffsetClass?: string;
}

const QUICK_PROMPTS_CLIENT = [
  '¿Qué almuerzos hay hoy por menos de $15.000?',
  'Muéstrame algo del campo o abono',
  '¿Cómo aparto una oferta?',
  'Reportar un problema o fraude',
] as const;

const QUICK_PROMPTS_MERCHANT = [
  '¿Cómo recargo créditos?',
  'No me aparece mi comprobante',
  'Vincular huella en equipo nuevo',
] as const;

interface RecommendedCardItem {
  offer: Offer;
  distanceMeters: number | null;
}

interface ConciergeMessage {
  role: 'user' | 'assistant';
  content: string;
  at: string;
  cards?: RecommendedCardItem[];
}

/**
 * 🛰️ Radar 2.0 (V36.0):
 * - Visible en PC y Móvil (`fixed z-[45]`, siempre por encima de BottomNav).
 * - Dictado por voz nativo `es-CO` con onda pulsante.
 * - Motor híbrido de ofertas en vivo (`radarMatcher.ts`, <5ms) con tarjetas interactivas
 *   clickeables dentro del chat ("Apartar ahora" y "Ver en mapa") + IA contextual <2s.
 */
export function SupportConcierge({
  userRole,
  userName,
  municipality,
  offers = [],
  geoPos = null,
  onReserveOffer,
  onFocusOfferOnMap,
  externalPrompt = null,
  bottomOffsetClass = 'bottom-20 right-4 sm:bottom-24 sm:right-6',
}: SupportConciergeProps) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [ticketSentId, setTicketSentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConciergeMessage[]>(() => [
    {
      role: 'assistant',
      content:
        userRole === 'merchant'
          ? '¡Hola! Soy Radar, el asistente de élite de Impulso. ¿En qué te ayudo hoy con tus ofertas, recargas o seguridad?'
          : `¡Hola! Soy Radar 🛰️. Pregúntame o díctame qué buscas hoy en ${municipality} (ej: "tengo $15.000 para almorzar" o "abono para el campo") y te muestro las ofertas activas al instante.`,
      at: new Date().toISOString(),
    },
  ]);
  const listRef = useRef<HTMLDivElement | null>(null);
  const lastExternalSeqRef = useRef<number>(0);

  const speech = useSpeechRecognition((transcript) => {
    setInput(transcript);
    void sendMessage(transcript);
  });

  const suggestions = userRole === 'merchant' ? QUICK_PROMPTS_MERCHANT : QUICK_PROMPTS_CLIENT;

  function scrollToBottom() {
    window.setTimeout(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    }, 40);
  }

  async function sendMessage(textOverride?: string) {
    const clean = (textOverride ?? input).trim();
    if (!clean || busy) return;

    const userMsg: ConciergeMessage = { role: 'user', content: clean, at: new Date().toISOString() };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    if (!textOverride) setInput('');
    setBusy(true);
    scrollToBottom();

    // ⚡ Fase local determinista (<5ms, 0 tokens): busca ofertas activas + pulso del municipio
    const localMatch = matchLiveOffersForRadar(clean, offers, geoPos, 4);
    const liveDigest = buildLiveOffersDigest(offers);
    const matchedCards: RecommendedCardItem[] = localMatch.matches.map((m) => ({
      offer: m.offer,
      distanceMeters: m.distanceMeters,
    }));
    const compactSummary: RadarMatchedOfferContext[] = localMatch.matches.map((m) => ({
      title: m.offer.title,
      merchant: m.offer.merchant?.business_name ?? 'Comercio local',
      priceCop: Number(m.offer.promo_price),
      quota: m.offer.available_quota,
      category: m.offer.category,
      verified: Boolean(m.offer.merchant?.is_verified),
      distanceLabel: m.distanceMeters != null ? distanceText(m.distanceMeters) : null,
    }));

    try {
      const assessment = await askSupportConcierge({
        history: nextHistory.map((m) => ({ role: m.role, content: m.content })),
        latestMessage: clean,
        userRole,
        municipality,
        intent: localMatch.intent,
        matchedOffersSummary: compactSummary,
        parsedBudget: localMatch.parsedBudget,
        isShoppingIntent: localMatch.isShoppingIntent,
        liveCatalogDigest: {
          activeCount: liveDigest.activeCount,
          categoriesLabel: liveDigest.categoriesLabel,
          cheapestLabel: liveDigest.cheapest
            ? `${liveDigest.cheapest.title} (${formatCOP(liveDigest.cheapest.promo_price)})`
            : null,
        },
      });

      const assistantMsg: ConciergeMessage = {
        role: 'assistant',
        content: assessment.reply,
        at: new Date().toISOString(),
        ...(matchedCards.length > 0 ? { cards: matchedCards } : {}),
      };
      const updatedConversation = [...nextHistory, assistantMsg];
      setMessages(updatedConversation);
      scrollToBottom();

      if (assessment.isTechnicalIssue) {
        const transcriptForDb: SupportChatMessage[] = updatedConversation.map((m) => ({
          role: m.role,
          text: m.content,
          at: m.at,
        }));
        const res = await submitSupportTicket({
          userRole,
          userName,
          municipality,
          category: assessment.category,
          severity: assessment.severity,
          summary: assessment.summary,
          chatTranscript: transcriptForDb,
          aiAnalysis: assessment.aiAnalysis,
        });
        setTicketSentId(res.ticket?.id ?? `local-${Date.now()}`);
        toast.info('🛠️ Ticket registrado para revisión prioritaria.');
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            matchedCards.length > 0
              ? `¡Encontré ${matchedCards.length} oferta${matchedCards.length === 1 ? '' : 's'} activa${matchedCards.length === 1 ? '' : 's'} para ti! Toca "Apartar ahora" o "Ver en mapa" en las tarjetas de abajo.`
              : 'Tuve una interrupción momentánea de conexión. Intenta enviarme tu consulta de nuevo en unos segundos.',
          at: new Date().toISOString(),
          ...(matchedCards.length > 0 ? { cards: matchedCards } : {}),
        },
      ]);
      scrollToBottom();
    } finally {
      setBusy(false);
    }
  }

  // Permite abrir Radar con una consulta directa desde la búsqueda vacía del feed
  useEffect(() => {
    if (!externalPrompt || externalPrompt.seq === lastExternalSeqRef.current) return;
    lastExternalSeqRef.current = externalPrompt.seq;
    setOpen(true);
    if (externalPrompt.text.trim()) {
      void sendMessage(externalPrompt.text.trim());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalPrompt]);

  return (
    <>
      {/* 🛰️ Lanzador flotante universal (PC + Móvil · z-[45] siempre sobre BottomNav) */}
      <div className={cx('group fixed z-[45] flex items-center gap-2.5', bottomOffsetClass)}>
        <span
          className="pointer-events-none hidden rounded-full border border-impulso-emerald/30 bg-slate-950/92 px-3 py-1.5 text-[11px] font-bold text-slate-200 shadow-lg backdrop-blur-xl transition-all duration-200 sm:inline-block lg:opacity-90 lg:group-hover:opacity-100"
        >
          ¿Qué buscas hoy? Pregúntale a <span className="text-impulso-mint">Radar</span>
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir Radar · Asistente inteligente Impulso"
          title="¿Qué buscas hoy? Pregúntale a Radar"
          className="pressable relative flex items-center gap-2 rounded-full border border-impulso-emerald/50 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 px-4 py-3 text-xs font-extrabold text-white shadow-[0_14px_36px_rgba(0,0,0,0.6),0_0_26px_rgba(16,185,129,0.34)] backdrop-blur-xl transition hover:border-impulso-mint hover:shadow-[0_14px_40px_rgba(0,0,0,0.65),0_0_32px_rgba(52,211,153,0.48)]"
        >
          <span className="relative flex h-5 w-5 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-impulso-emerald/45" />
            <Radar className="relative h-4 w-4 text-impulso-mint" />
          </span>
          <span>Radar</span>
        </button>
      </div>

      <ModalShell open={open} onClose={() => setOpen(false)} escClose closeLabel="Cerrar Radar" panelClassName="max-w-lg">
        <div className="flex max-h-[86dvh] flex-col p-4 pt-5">
          <div className="flex items-center gap-2.5 pb-3 pr-11">
            <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-impulso-emerald/30 to-cyan-500/20 ring-1 ring-impulso-emerald/45">
              <Radar className="h-5 w-5 text-impulso-mint" />
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-impulso-emerald ring-2 ring-slate-950" />
            </div>
            <div>
              <h3 className="flex items-center gap-1.5 text-base font-extrabold text-white">
                Radar · Asistente Impulso
                <Sparkles className="h-3.5 w-3.5 text-impulso-mint" />
              </h3>
              <p className="text-[11px] font-semibold text-slate-400">
                Ofertas en vivo en {municipality} · Voz + Respuesta rápida
              </p>
            </div>
          </div>

          {/* Chips rápidos */}
          <div className="no-scrollbar -mx-1 mb-2.5 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {suggestions.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => void sendMessage(q)}
                disabled={busy}
                className="pressable shrink-0 rounded-full border border-white/10 bg-slate-950/60 px-3 py-1.5 text-[11px] font-semibold text-slate-300 transition hover:border-impulso-emerald/40 hover:text-impulso-mint disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Historial + Tarjetas interactivas de ofertas en vivo */}
          <div
            ref={listRef}
            className="min-h-[250px] max-h-[48dvh] flex-1 space-y-3 overflow-y-auto rounded-2xl border border-white/[0.07] bg-slate-950/60 p-3"
          >
            {messages.map((m, i) => (
              <div key={i} className={cx('flex flex-col gap-2', m.role === 'user' ? 'items-end' : 'items-start')}>
                <div
                  className={cx(
                    'max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed',
                    m.role === 'user'
                      ? 'rounded-br-sm bg-impulso-emerald font-bold text-slate-950'
                      : 'rounded-bl-sm border border-white/10 bg-slate-900/95 font-medium text-slate-200',
                  )}
                >
                  {m.content}
                </div>

                {/* 🎯 Tarjetas Interactivas de Ofertas Reales dentro de Radar */}
                {m.cards && m.cards.length > 0 && (
                  <div className="w-full max-w-[96%] space-y-2">
                    {m.cards.map(({ offer, distanceMeters }) => {
                      const trust = resolveTrustLevel(offer.merchant);
                      return (
                        <article
                          key={offer.id}
                          className={cx(
                            'rounded-2xl border bg-slate-900/90 p-3 shadow-md transition',
                            trust === 'super'
                              ? 'border-impulso-gold/45 ring-1 ring-impulso-gold/20'
                              : 'border-impulso-emerald/25 hover:border-impulso-emerald/50',
                          )}
                        >
                          <div className="flex items-start gap-2.5">
                            {offer.image_thumb ? (
                              <img
                                src={offer.image_thumb}
                                alt={offer.title}
                                className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-white/10"
                              />
                            ) : (
                              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-white/10 bg-slate-950/70 text-2xl">
                                {offer.emoji_icon}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-extrabold text-white">{offer.title}</p>
                              <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] font-semibold text-slate-400">
                                <span className="truncate">{offer.merchant?.business_name ?? 'Comercio local'}</span>
                                {trust === 'super' ? (
                                  <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-impulso-gold/15 px-1.5 py-0.5 text-[9px] font-extrabold text-impulso-gold">
                                    <Crown className="h-2.5 w-2.5" /> Súper
                                  </span>
                                ) : trust === 'verified' ? (
                                  <BadgeCheck className="h-3.5 w-3.5 shrink-0 fill-sky-500 text-slate-950" />
                                ) : null}
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                                <span className="font-extrabold tabular-nums text-impulso-mint">
                                  {formatCOP(offer.promo_price)}
                                </span>
                                {offer.original_price != null && Number(offer.original_price) > Number(offer.promo_price) && (
                                  <span className="text-[10px] text-slate-500 line-through">
                                    {formatCOP(offer.original_price)}
                                  </span>
                                )}
                                <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                                  🎟️ {offer.available_quota} cupos
                                </span>
                                {distanceMeters != null && (
                                  <span className="text-[10px] font-bold text-sky-300">
                                    📍 {distanceText(distanceMeters)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setOpen(false);
                                onReserveOffer?.(offer);
                              }}
                              className="pressable flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-impulso-emerald to-teal-600 py-2 text-[11px] font-extrabold text-white shadow-glow"
                            >
                              <Ticket className="h-3.5 w-3.5" /> Apartar ahora
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOpen(false);
                                // Ejecutamos tras cerrar el modal para que el mapa reciba foco, haga flyTo y scroll suave
                                window.setTimeout(() => {
                                  onFocusOfferOnMap?.(offer);
                                }, 60);
                              }}
                              className="pressable flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-slate-950/70 py-2 text-[11px] font-bold text-slate-200 transition hover:border-impulso-mint/40 hover:text-impulso-mint"
                            >
                              <MapPin className="h-3.5 w-3.5" /> Ver en mapa
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-impulso-mint" />
                Escaneando ofertas y respondiendo…
              </div>
            )}
          </div>

          {speech.listening && (
            <div className="mt-2 flex items-center justify-between rounded-xl border border-impulso-rose/40 bg-impulso-rose/10 px-3 py-2 text-[11px] font-bold text-rose-200">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 animate-ping rounded-full bg-impulso-rose" />
                Escuchando tu voz (es-CO)… habla ahora
              </span>
              <button type="button" onClick={speech.stop} className="underline">
                Detener
              </button>
            </div>
          )}

          {ticketSentId && (
            <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-impulso-emerald/35 bg-impulso-emerald/10 px-3 py-2 text-[11px] font-bold text-impulso-mint">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Ticket registrado en la cola prioritaria de seguridad y soporte.</span>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendMessage();
            }}
            className="mt-3 flex items-center gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                userRole === 'merchant'
                  ? 'Pregunta o dicta tu duda…'
                  : 'Ej: "almuerzo menos de 15 mil" o "abono"'
              }
              maxLength={400}
              className="flex-1 rounded-2xl border border-white/10 bg-slate-950/70 px-3.5 py-3 text-sm font-medium text-white placeholder:text-slate-600 outline-none focus:border-impulso-emerald/60"
            />
            {speech.supported && (
              <button
                type="button"
                onClick={() => (speech.listening ? speech.stop() : speech.start())}
                disabled={busy}
                aria-label={speech.listening ? 'Detener dictado por voz' : 'Dictar por voz'}
                title={speech.listening ? 'Detener dictado' : 'Dictar por voz (es-CO)'}
                className={cx(
                  'pressable relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl border transition disabled:opacity-40',
                  speech.listening
                    ? 'border-impulso-rose/60 bg-impulso-rose text-white shadow-[0_0_18px_rgba(244,63,94,0.45)]'
                    : 'border-white/10 bg-slate-950/70 text-slate-300 hover:border-impulso-emerald/50 hover:text-impulso-mint',
                )}
              >
                {speech.listening ? <MicOff className="h-4 w-4 animate-pulse" /> : <Mic className="h-4 w-4" />}
              </button>
            )}
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label="Enviar mensaje"
              className="pressable grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-impulso-emerald text-slate-950 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </ModalShell>
    </>
  );
}
