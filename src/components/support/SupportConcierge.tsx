import { useRef, useState } from 'react';
import { CheckCircle2, Headphones, Loader2, Send, Sparkles } from 'lucide-react';
import { ModalShell } from '../ui/ModalShell';
import { useToast } from '../ui/Toast';
import { askSupportConcierge } from '../../services/gemini.service';
import { submitSupportTicket } from '../../services/support.service';
import type { SupportChatMessage, SupportRole } from '../../services/support.service';
import { cx } from '../../utils/format';

interface SupportConciergeProps {
  userRole: SupportRole;
  userName: string;
  municipality: string;
  /** En vista cliente deja espacio libre arriba del BottomNav; en panel comerciante va pegado abajo. */
  bottomOffsetClass?: string;
}

const QUICK_PROMPTS_CLIENT = [
  '¿Cómo aparto una oferta?',
  'No me carga el mapa GPS',
  'Reportar un error técnico',
] as const;

const QUICK_PROMPTS_MERCHANT = [
  '¿Cómo recargo créditos?',
  'No me aparece mi comprobante',
  'Vincular huella en equipo nuevo',
] as const;

interface ConciergeMessage {
  role: 'user' | 'assistant';
  content: string;
  at: string;
}

/**
 * 🤖 El Conserje de Impulso (V34):
 * Chat conversacional real con memoria multi-turno en Gemini y registro silencioso de tickets.
 */
export function SupportConcierge({
  userRole,
  userName,
  municipality,
  bottomOffsetClass = 'bottom-20 sm:bottom-5',
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
          ? '¡Hola! Soy el Conserje de Impulso. ¿En qué te puedo ayudar hoy con tus ofertas, recargas o reservas?'
          : '¡Hola! Soy el Conserje de Impulso. ¿En qué te ayudo para explorar ofertas o apartar hoy?',
      at: new Date().toISOString(),
    },
  ]);
  const listRef = useRef<HTMLDivElement | null>(null);

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

    try {
      const assessment = await askSupportConcierge({
        history: nextHistory.map((m) => ({ role: m.role, content: m.content })),
        latestMessage: clean,
        userRole,
        municipality,
      });

      const assistantMsg: ConciergeMessage = {
        role: 'assistant',
        content: assessment.reply,
        at: new Date().toISOString(),
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
          content: 'Tuve una interrupción momentánea de conexión. Intenta enviarme el detalle de nuevo en unos segundos.',
          at: new Date().toISOString(),
        },
      ]);
      scrollToBottom();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir Conserje de soporte Impulso"
        title="Conserje de Soporte Impulso"
        className={cx(
          'pressable fixed right-3.5 z-30 flex items-center gap-2 rounded-full border border-impulso-emerald/35 bg-slate-950/90 px-3.5 py-2.5 text-xs font-extrabold text-white shadow-[0_12px_32px_rgba(0,0,0,0.55),0_0_20px_rgba(16,185,129,0.22)] backdrop-blur-xl transition hover:border-impulso-emerald/60',
          bottomOffsetClass,
        )}
      >
        <Headphones className="h-4 w-4 text-impulso-mint" />
        <span className="hidden sm:inline">Conserje</span>
      </button>

      <ModalShell open={open} onClose={() => setOpen(false)} escClose closeLabel="Cerrar soporte" panelClassName="max-w-md">
        <div className="flex max-h-[82dvh] flex-col p-4 pt-5">
          <div className="flex items-center gap-2.5 pb-3 pr-11">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-impulso-emerald/25 to-cyan-500/20 ring-1 ring-impulso-emerald/40">
              <Sparkles className="h-5 w-5 text-impulso-mint" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Conserje de Impulso</h3>
              <p className="text-[11px] font-semibold text-slate-400">Soporte personalizado en vivo</p>
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

          {/* Historial */}
          <div
            ref={listRef}
            className="flex-1 space-y-2.5 overflow-y-auto rounded-2xl border border-white/[0.06] bg-slate-950/55 p-3 min-h-[230px] max-h-[42dvh]"
          >
            {messages.map((m, i) => (
              <div key={i} className={cx('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div
                  className={cx(
                    'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed',
                    m.role === 'user'
                      ? 'bg-impulso-emerald text-slate-950 font-bold rounded-br-sm'
                      : 'border border-white/10 bg-slate-900/90 text-slate-200 font-medium rounded-bl-sm',
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-impulso-mint" />
                Analizando tu consulta…
              </div>
            )}
          </div>

          {ticketSentId && (
            <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-impulso-emerald/35 bg-impulso-emerald/10 px-3 py-2 text-[11px] font-bold text-impulso-mint">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Ticket registrado en la cola técnica prioritaria.</span>
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
              placeholder="Describe tu duda o inconveniente…"
              maxLength={400}
              className="flex-1 rounded-2xl border border-white/10 bg-slate-950/70 px-3.5 py-3 text-sm font-medium text-white placeholder:text-slate-600 outline-none focus:border-impulso-emerald/60"
            />
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
