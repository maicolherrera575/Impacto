import { useState } from 'react';
import { Loader2, MessageCircle } from 'lucide-react';
import type { Category, QuickRequest } from '../../types';
import { CATEGORIES, MEETING_POINTS, categoryMeta, meetingPointMeta } from '../../types';
import { ModalShell } from '../ui/ModalShell';
import { useToast } from '../ui/Toast';
import { createQuickRequest } from '../../services/requests.service';
import { detectFraudSignals, FRAUD_MESSAGE } from '../../services/gemini.service';
import { friendlyError } from '../../services/supabase';
import { cx, timeAgo, timeLeftLabel } from '../../utils/format';
import { useTick } from '../../hooks/useTick';

interface RequestsTabProps {
  requests: QuickRequest[];
  municipality: string;
  /** Notifica a la app para refrescar la lista (optimista + realtime). */
  onCreated: () => void;
}

const FORM_MIN_LEN = 5;

/**
 * Pestaña 2: Subasta inversa. Los ciudadanos publican lo que necesitan
 * urgentemente y los comercios responden por WhatsApp en un clic.
 */
export function RequestsTab({ requests, municipality, onCreated }: RequestsTabProps) {
  const toast = useToast();
  const now = useTick(30_000);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [category, setCategory] = useState<Category>('comida');
  const [description, setDescription] = useState('');
  const [meetingPoint, setMeetingPoint] = useState('parque_principal');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (name.trim().length < 2) return toast.error('Escribe tu nombre');
    if (!/^3\d{9}$/.test(whatsapp)) return toast.error('Tu WhatsApp debe ser un celular de 10 dígitos que empiece por 3 (ej: 3201234567)');
    if (description.trim().length < FORM_MIN_LEN) return toast.error('Describe qué necesitas (mínimo 5 caracteres)');
    if (detectFraudSignals(description)) return toast.error(FRAUD_MESSAGE);

    setLoading(true);
    try {
      await createQuickRequest({
        customerName: name.trim(),
        customerWhatsapp: whatsapp.trim(),
        municipality,
        category,
        needDescription: description.trim(),
        meetingPoint,
      });
      toast.success('¡Pedido publicado! Los comercios ya lo ven 📢');
      setDescription('');
      setOpen(false);
      onCreated();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-xl px-3 pt-4">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-impulso-panel to-impulso-card p-5 shadow-card">
        <h2 className="text-xl font-extrabold text-white">📢 ¿Quién tiene…?</h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-400">
          Publica lo que necesitas urgente. Los comercios del municipio te responden directo por WhatsApp.
        </p>
        <button
          onClick={() => setOpen(true)}
          className="pressable mt-3 w-full rounded-2xl bg-gradient-to-r from-impulso-emerald to-teal-600 py-3.5 text-sm font-extrabold text-white shadow-glow"
        >
          Publicar mi necesidad
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {requests.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 bg-impulso-panel/60 p-8 text-center">
            <p className="text-3xl">🤝</p>
            <p className="mt-2 font-bold text-white">Aún no hay pedidos</p>
            <p className="mt-1 text-sm text-slate-400">Sé el primero en pedir lo que necesitas hoy.</p>
          </div>
        ) : (
          requests.map((r) => {
            const cat = categoryMeta(r.category);
            return (
              <article key={r.id} className="rounded-3xl border border-white/10 bg-impulso-card p-4 shadow-card">
                <div className="flex items-center gap-2 text-[11px] font-bold">
                  <span className="rounded-full bg-impulso-emerald/10 px-2.5 py-1 text-impulso-mint">
                    {cat.emoji} {cat.label}
                  </span>
                  <span className="text-slate-500">{timeLeftLabel(r.expires_at, now)}</span>
                  <span className="ml-auto text-slate-600">{timeAgo(r.created_at, now)}</span>
                </div>
                <p className="mt-2.5 text-[15px] font-semibold leading-snug text-white">{r.need_description}</p>
                <p className="mt-2 flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-950/40 px-2.5 py-1.5 text-[11px] font-semibold text-slate-300">
                  <span>{meetingPointMeta(r.meeting_point).emoji}</span>
                  Encuentro: {meetingPointMeta(r.meeting_point).label}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="truncate text-xs font-semibold text-slate-500">
                    👤 {r.customer_name} · {r.municipality}
                  </span>
                  <a
                    href={`https://wa.me/${r.customer_whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
                      `Hola ${r.customer_name}! Vi tu pedido en Impulso ("${r.need_description.slice(0, 60)}"). Yo tengo lo que necesitas 🙌`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pressable flex items-center gap-1.5 rounded-xl bg-[#25D366] px-3.5 py-2 text-xs font-extrabold text-white"
                  >
                    <MessageCircle className="h-4 w-4" /> Responder
                  </a>
                </div>
                <p className="mt-2.5 text-center text-[10px] font-semibold text-slate-500">
                  🛡️ Nunca envíes dinero ni recargas Nequi por adelantado. Trata solo contra entrega en el punto acordado.
                </p>
              </article>
            );
          })
        )}
      </div>

      {/* Formulario */}
      <ModalShell open={open} onClose={() => setOpen(false)}>
        <div className="p-5 pt-14">
          <h3 className="text-lg font-extrabold text-white">¿Qué necesitas hoy?</h3>
          <p className="mt-1 text-sm text-slate-400">Sé específico: producto, cantidad y para cuándo.</p>

          <div className="mt-4 space-y-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre *"
              maxLength={60}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3.5 text-[15px] font-medium text-white placeholder:text-slate-600 outline-none focus:border-impulso-emerald/60"
            />
            <input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, ''))}
              placeholder="Tu WhatsApp * (ej: 3201234567)"
              inputMode="tel"
              maxLength={15}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3.5 text-[15px] font-medium text-white placeholder:text-slate-600 outline-none focus:border-impulso-emerald/60"
            />
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  className={cx(
                    'pressable shrink-0 rounded-full border px-3.5 py-2 text-xs font-bold',
                    category === c.id
                      ? 'border-impulso-emerald/50 bg-impulso-emerald/15 text-impulso-mint'
                      : 'border-white/10 bg-slate-950/40 text-slate-400'
                  )}
                >
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
            <div>
              <p className="mb-1.5 text-xs font-bold text-slate-300">📍 Punto de entrega / encuentro seguro *</p>
              <div className="space-y-1.5">
                {MEETING_POINTS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMeetingPoint(m.id)}
                    className={cx(
                      'pressable flex w-full items-center gap-2 rounded-2xl border px-3.5 py-2.5 text-left text-xs font-semibold',
                      meetingPoint === m.id
                        ? 'border-impulso-emerald/50 bg-impulso-emerald/10 text-impulso-mint'
                        : 'border-white/10 bg-slate-950/50 text-slate-400'
                    )}
                  >
                    <span className="text-base">{m.emoji}</span>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Necesito 2 bultos de cemento para mañana temprano en el casco urbano"
              rows={3}
              maxLength={220}
              className="w-full resize-none rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3.5 text-[15px] font-medium text-white placeholder:text-slate-600 outline-none focus:border-impulso-emerald/60"
            />
            <button
              onClick={submit}
              disabled={loading}
              className="pressable flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-impulso-emerald to-teal-600 py-3.5 text-sm font-extrabold text-white shadow-glow disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Publicar mi pedido 📢'}
            </button>
            <p className="flex items-start gap-2 rounded-2xl border border-impulso-emerald/25 bg-impulso-emerald/5 p-3 text-[11px] font-semibold leading-relaxed text-impulso-mint">
              <span className="text-sm leading-none">🔒</span>
              <span>
                Conexión protegida: por seguridad de la comunidad, tu solicitud registra código de dispositivo e IP
                conforme a la Ley 1581 de 2012.
              </span>
            </p>
          </div>
        </div>
      </ModalShell>
    </section>
  );
}
