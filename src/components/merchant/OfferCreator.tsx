import { useEffect, useState } from 'react';
import { Camera, Loader2, Mic, MicOff, Sparkles, Trash2, Wand2 } from 'lucide-react';
import type { OfferForm, Profile } from '../../types';
import { CATEGORIES, DURATION_OPTIONS, DELIVERY_TYPES } from '../../types';
import { ModalShell } from '../ui/ModalShell';
import { useToast } from '../ui/Toast';
import { parsePromoFromText } from '../../services/gemini.service';
import { publishOffer } from '../../services/offers.service';
import { friendlyError } from '../../services/supabase';
import { compressImageToMicroWebP, compressionSummary } from '../../services/imageCompressor';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { cx, formatCOP } from '../../utils/format';

const EMOJI_CHOICES = ['🔥', '🍽️', '🥐', '🍕', '☕', '🚚', '🌱', '🥩', '🏨', '🏠', '💄', '💊', '🛠️', '🧺', '🐑'] as const;

export const EMPTY_FORM: OfferForm = {
  emoji_icon: '🔥',
  category: 'comida',
  title: '',
  description: '',
  original_price: '',
  promo_price: '',
  total_quota: '',
  duration_hours: 3,
  image_thumb: null,
  delivery_type: 'local_fisico',
};

interface OfferCreatorProps {
  open: boolean;
  onClose: () => void;
  profile: Profile;
  onPublished: () => void;
  /** Precarga el formulario (republicación en 1 clic). */
  initialForm?: OfferForm | null;
}

/**
 * Creador Mágico con Gemini AI: el comerciante escribe o dicta su promoción
 * en lenguaje natural y la IA estructura todo el formulario, editable antes
 * de publicar.
 */
export function OfferCreator({ open, onClose, profile, onPublished, initialForm }: OfferCreatorProps) {
  const toast = useToast();
  const [freeText, setFreeText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [form, setForm] = useState<OfferForm>(EMPTY_FORM);
  const [aiFilled, setAiFilled] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const speech = useSpeechRecognition((text) => setFreeText(text));

  useEffect(() => {
    if (open) {
      setFreeText('');
      setForm(initialForm ?? EMPTY_FORM);
      setAiFilled(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialForm]);

  function patch(p: Partial<OfferForm>) {
    setForm((prev) => ({ ...prev, ...p }));
  }

  async function createWithAi() {
    setAiLoading(true);
    try {
      const parsed = await parsePromoFromText(freeText);
      setForm({
        emoji_icon: parsed.emoji_icon,
        category: parsed.category,
        title: parsed.title,
        description: parsed.description,
        original_price: parsed.original_price ? String(parsed.original_price) : '',
        promo_price: String(parsed.promo_price),
        total_quota: String(parsed.total_quota),
        duration_hours: Math.min(96, Math.max(0.5, parsed.duration_hours)),
        image_thumb: form.image_thumb,
        delivery_type: form.delivery_type,
      });
      setAiFilled(true);
      toast.success('✨ ¡La IA estructuró tu oferta! Revísala y publica');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : friendlyError(err));
    } finally {
      setAiLoading(false);
    }
  }

  async function pickImage(file: File | undefined) {
    if (!file) return;
    setCompressing(true);
    try {
      const thumb = await compressImageToMicroWebP(file, 420, 0.62);
      patch({ image_thumb: thumb });
      toast.success(compressionSummary(file, thumb));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : friendlyError(err));
    } finally {
      setCompressing(false);
    }
  }

  async function publish() {
    const title = form.title.trim();
    const description = form.description.trim();
    const promo = Number(form.promo_price);
    const quota = Number(form.total_quota);

    if (title.length < 3 || title.length > 90) return toast.error('El título debe tener entre 3 y 90 caracteres');
    if (description.length < 5 || description.length > 280) return toast.error('La descripción debe tener entre 5 y 280 caracteres');
    if (!Number.isFinite(promo) || promo < 0) return toast.error('Escribe el precio de oferta');
    if (!Number.isInteger(quota) || quota < 1 || quota > 500) return toast.error('El cupo debe estar entre 1 y 500');
    if (profile.credits < 1) return toast.error('No tienes créditos. Recarga con el administrador 💚');

    setPublishing(true);
    try {
      await publishOffer({
        category: form.category,
        title,
        description,
        emojiIcon: form.emoji_icon || '🔥',
        originalPrice: form.original_price ? Number(form.original_price) : null,
        promoPrice: promo,
        totalQuota: quota,
        durationHours: form.duration_hours,
        municipality: profile.municipality,
        lat: profile.lat,
        lng: profile.lng,
        imageThumb: form.image_thumb,
        deliveryType: form.delivery_type,
      });
      toast.success('¡Oferta en el radar! 🚀 Se descontó 1 crédito');
      onPublished();
      onClose();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setPublishing(false);
    }
  }

  const totalPreview = Number(form.promo_price) > 0 ? formatCOP(Number(form.promo_price)) : '$…';

  return (
    <ModalShell open={open} onClose={onClose} panelClassName="max-w-lg">
      <div className="p-5 pt-14">
        <h3 className="text-xl font-extrabold text-white">✨ Crear oferta</h3>
        <p className="mt-1 text-sm text-slate-400">
          Escribe o dicta tu promoción como si le hablaras a un vecino. La IA hace el resto.
        </p>

        {/* Entrada libre (texto/voz) + IA */}
        <div className="mt-4 rounded-3xl border border-impulso-emerald/25 bg-impulso-emerald/5 p-4">
          <div className="relative">
            <textarea
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              rows={3}
              maxLength={600}
              placeholder="Ej: Saqué 15 almuerzos ejecutivos con trucha a 12 mil pesos por las próximas 3 horas"
              className="w-full resize-none rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3.5 pr-14 text-[15px] font-medium text-white placeholder:text-slate-600 outline-none focus:border-impulso-emerald/60"
            />
            {speech.supported && (
              <button
                onClick={() => (speech.listening ? speech.stop() : speech.start())}
                title={speech.listening ? 'Detener dictado' : 'Dictar por voz'}
                className={cx(
                  'pressable absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full',
                  speech.listening ? 'bg-impulso-rose text-white animate-pulse-soft' : 'bg-impulso-panel text-slate-300'
                )}
              >
                {speech.listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>
            )}
          </div>
          <button
            onClick={createWithAi}
            disabled={aiLoading}
            className="pressable mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 py-3.5 text-sm font-extrabold text-white shadow-card disabled:opacity-60"
          >
            {aiLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" /> La IA está creando tu oferta…
              </>
            ) : (
              <>
                <Wand2 className="h-5 w-5" /> ✨ Crear con IA
              </>
            )}
          </button>
        </div>

        {/* Formulario estructurado (editable) */}
        {aiFilled && (
          <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-impulso-mint animate-fade-in">
            <Sparkles className="h-3.5 w-3.5" /> Generado por IA — edita lo que quieras antes de publicar
          </p>
        )}

        <div className="mt-4 space-y-3">
          {/* Emoji */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {EMOJI_CHOICES.map((e) => (
              <button
                key={e}
                onClick={() => patch({ emoji_icon: e })}
                className={cx(
                  'pressable grid h-10 w-10 shrink-0 place-items-center rounded-xl border text-xl',
                  form.emoji_icon === e
                    ? 'border-impulso-emerald/60 bg-impulso-emerald/15'
                    : 'border-white/10 bg-slate-950/40'
                )}
              >
                {e}
              </button>
            ))}
          </div>

          {/* Categoría */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => patch({ category: c.id })}
                className={cx(
                  'pressable shrink-0 rounded-full border px-3.5 py-2 text-xs font-bold',
                  form.category === c.id
                    ? 'border-impulso-emerald/50 bg-impulso-emerald/15 text-impulso-mint'
                    : 'border-white/10 bg-slate-950/40 text-slate-400'
                )}
              >
                {c.emoji} {c.label}
              </button>
            ))}
          </div>

          <input
            value={form.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="Título de la oferta *"
            maxLength={90}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3.5 text-[15px] font-medium text-white placeholder:text-slate-600 outline-none focus:border-impulso-emerald/60"
          />
          <textarea
            value={form.description}
            onChange={(e) => patch({ description: e.target.value })}
            placeholder="Descripción apetitosa * (máximo 280 caracteres)"
            rows={2}
            maxLength={280}
            className="w-full resize-none rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3.5 text-[15px] font-medium text-white placeholder:text-slate-600 outline-none focus:border-impulso-emerald/60"
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              value={form.original_price}
              onChange={(e) => patch({ original_price: e.target.value.replace(/\D/g, '') })}
              placeholder="Precio normal"
              inputMode="numeric"
              className="rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-3.5 text-sm font-medium text-white placeholder:text-slate-600 outline-none focus:border-impulso-emerald/60"
            />
            <input
              value={form.promo_price}
              onChange={(e) => patch({ promo_price: e.target.value.replace(/\D/g, '') })}
              placeholder="Precio oferta *"
              inputMode="numeric"
              className="rounded-2xl border border-impulso-emerald/40 bg-impulso-emerald/5 px-3 py-3.5 text-sm font-bold text-impulso-mint placeholder:text-slate-600 outline-none"
            />
            <input
              value={form.total_quota}
              onChange={(e) => patch({ total_quota: e.target.value.replace(/\D/g, '') })}
              placeholder="Cupo *"
              inputMode="numeric"
              className="rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-3.5 text-sm font-medium text-white placeholder:text-slate-600 outline-none focus:border-impulso-emerald/60"
            />
          </div>
          {/* Foto opcional (se comprime sola a < 20 KB en el navegador) */}
          {form.image_thumb ? (
            <div className="relative overflow-hidden rounded-2xl border border-white/10">
              <img src={form.image_thumb} alt="Foto del producto" className="h-36 w-full object-cover" />
              <button
                onClick={() => patch({ image_thumb: null })}
                title="Quitar foto"
                aria-label="Quitar foto"
                className="pressable absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-slate-950/70 text-slate-200 backdrop-blur-md"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <label className="pressable flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-slate-950/40 py-3.5 text-sm font-semibold text-slate-400 transition hover:border-impulso-emerald/40 hover:text-impulso-mint">
              {compressing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Optimizando tu foto…
                </>
              ) : (
                <>
                  <Camera className="h-4 w-4" /> 📷 Subir foto del plato/producto (se optimiza sola)
                </>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void pickImage(e.target.files?.[0])}
              />
            </label>
          )}

          {/* Modalidad de entrega segura */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {DELIVERY_TYPES.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => patch({ delivery_type: d.id })}
                className={cx(
                  'pressable shrink-0 rounded-full border px-3.5 py-2 text-xs font-bold',
                  form.delivery_type === d.id
                    ? 'border-impulso-emerald/50 bg-impulso-emerald/15 text-impulso-mint'
                    : 'border-white/10 bg-slate-950/40 text-slate-400'
                )}
              >
                {d.emoji} {d.label}
              </button>
            ))}
          </div>

          <select
            value={form.duration_hours}
            onChange={(e) => patch({ duration_hours: Number(e.target.value) })}
            aria-label="Duración de la oferta"
            className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3.5 text-sm font-medium text-white outline-none focus:border-impulso-emerald/60"
          >
            {DURATION_OPTIONS.map((d) => (
              <option key={d.hours} value={d.hours}>
                ⏱ {d.label}
              </option>
            ))}
          </select>

          <button
            onClick={publish}
            disabled={publishing}
            className="pressable flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-impulso-emerald to-teal-600 py-4 text-base font-extrabold text-white shadow-glow disabled:opacity-60"
          >
            {publishing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" /> Publicando…
              </>
            ) : (
              `🚀 Publicar por ${totalPreview} · gasta 1 crédito`
            )}
          </button>
          <p className="text-center text-[11px] text-slate-500">
            Créditos disponibles: <span className="font-bold text-slate-300">{profile.credits}</span>
          </p>
        </div>
      </div>
    </ModalShell>
  );
}
