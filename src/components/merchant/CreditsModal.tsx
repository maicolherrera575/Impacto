import { useState } from 'react';
import { CheckCircle2, Copy, Loader2, ShieldCheck, Sparkles, Upload, X } from 'lucide-react';
import type { Profile } from '../../types';
import { CREDIT_PACKAGES } from '../../types';
import { ModalShell } from '../ui/ModalShell';
import { useToast } from '../ui/Toast';
import { compressImageToMicroWebP, compressionSummary } from '../../services/imageCompressor';
import { verifyNequiReceiptWithAI } from '../../services/gemini.service';
import type { ReceiptVerification } from '../../services/gemini.service';
import { submitCreditOrder } from '../../services/credits.service';
import { friendlyError } from '../../services/supabase';
import { cx, formatCOP } from '../../utils/format';
import { openWhatsApp } from '../../utils/whatsapp';
import { ADMIN_WHATSAPP } from '../../config/env';

interface CreditsModalProps {
  open: boolean;
  onClose: () => void;
  profile: Profile;
}

type PaymentMethod = 'Nequi' | 'Daviplata' | 'Bancolombia';

/**
 * Caja de recarga de créditos: 3 planes, pago Nequi/Daviplata con el
 * número del administrador, comprobante leído por IA Vision y envío
 * con candado anti-doble cobro. Sin pasarela, sin comisiones bancarias.
 */
export function CreditsModal({ open, onClose, profile }: CreditsModalProps) {
  const toast = useToast();
  const [planIdx, setPlanIdx] = useState(1);
  const [method, setMethod] = useState<PaymentMethod>('Nequi');
  const [receipt, setReceipt] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<ReceiptVerification | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [compressing, setCompressing] = useState(false);

  const plan = CREDIT_PACKAGES[planIdx];
  const nequiDigits = ADMIN_WHATSAPP.replace(/\D/g, '');
  const nequiLocal = nequiDigits.startsWith('57') ? nequiDigits.slice(2) : nequiDigits;

  async function pickReceipt(file: File | undefined) {
    if (!file) return;
    setCompressing(true);
    setAiResult(null);
    try {
      const thumb = await compressImageToMicroWebP(file, 420, 0.6);
      setReceipt(thumb);
      toast.success(compressionSummary(file, thumb));
      // IA Vision lee el comprobante en ~2 segundos
      setAnalyzing(true);
      try {
        const result = await verifyNequiReceiptWithAI(thumb);
        setAiResult(result);
        if (result.reference) setReference(result.reference);
        if (result.looksReal) {
          toast.success(`🤖 IA: comprobante de ${result.amountCop ? formatCOP(result.amountCop) : 'valor no legible'} leído correctamente`);
        } else {
          toast.error('🤖 La IA no reconoció un comprobante válido. Verifica que sea la captura del pago');
        }
      } catch (aiErr) {
        toast.error('🤖 La IA no pudo leer la captura. Puedes escribir la referencia manualmente');
        void aiErr;
      } finally {
        setAnalyzing(false);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : friendlyError(err));
    } finally {
      setCompressing(false);
    }
  }

  async function submit() {
    if (!/^3\d{9}$/.test(nequiDigits)) {
      toast.error('El administrador aún no configuró su número de Nequi. Avísale por WhatsApp');
      return;
    }
    if (reference.trim().length < 3) {
      toast.error('Escribe la referencia del comprobante (aparece en tu captura de Nequi)');
      return;
    }
    setSubmitting(true);
    try {
      await submitCreditOrder({
        packageName: plan.name,
        creditsRequested: plan.credits,
        amountCop: plan.priceCop,
        referenceCode: reference.trim(),
        paymentMethod: method,
        receiptThumb: receipt,
        aiNote: aiResult
          ? `${aiResult.looksReal ? 'Comprobante válido' : 'IA dudosa'} · ${aiResult.amountCop ? `monto leído ${aiResult.amountCop}` : 'monto no legible'} · ${aiResult.note}`
          : null,
      });
      toast.success('✅ Comprobante enviado: el administrador lo activará en minutos');
      openWhatsApp(
        ADMIN_WHATSAPP,
        `Hola! Soy ${profile.business_name} (${profile.municipality}). Envié el comprobante ${method} por ${formatCOP(plan.priceCop)} — ${plan.name} (${plan.credits} créditos), referencia ${reference.trim()}. ¡Quedo atento a la activación! 🙌`
      );
      onClose();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell open={open} onClose={onClose} closeLabel="Cerrar caja de créditos">
      <div className="p-5 pt-14">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-extrabold text-white">⚡ Recargar Créditos</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              Cada crédito publica 1 oferta. Pago directo con Nequi, sin comisiones.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="pressable grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-slate-950/60 text-slate-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Planes */}
        <div className="mt-4 space-y-2">
          {CREDIT_PACKAGES.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setPlanIdx(i)}
              className={cx(
                'pressable flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-all duration-300',
                planIdx === i
                  ? 'border-impulso-emerald/50 bg-impulso-emerald/10 shadow-glow'
                  : 'border-white/[0.08] bg-slate-950/40 hover:border-impulso-emerald/25'
              )}
            >
              <span className="text-2xl">{p.emoji}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-extrabold text-white">
                  {p.name}
                  {p.best && (
                    <span className="rounded-full bg-impulso-gold/20 px-1.5 py-0.5 text-[9px] font-extrabold text-impulso-gold">
                      MÁS ELEGIDO
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-[11px] font-semibold text-slate-400">{p.note}</span>
              </span>
              <span className="text-right">
                <span className="block text-base font-extrabold text-impulso-mint tabular-nums tracking-tight">
                  {formatCOP(p.priceCop)}
                </span>
                <span className="block text-[10px] font-bold text-slate-500 tabular-nums">{p.credits} créditos</span>
              </span>
            </button>
          ))}
        </div>

        {/* Número de Nequi del administrador */}
        <div className="mt-4 rounded-2xl border border-impulso-emerald/25 bg-impulso-emerald/5 p-3.5">
          <p className="flex items-center gap-1.5 text-xs font-bold text-impulso-mint">
            <ShieldCheck className="h-4 w-4" /> Paga {formatCOP(plan.priceCop)} al Nequi / Daviplata:
          </p>
          <div className="mt-2 flex items-center gap-2">
            <p className="flex-1 font-mono text-2xl font-extrabold tracking-[0.15em] text-white tabular-nums">
              {nequiLocal || '—'}
            </p>
            <button
              onClick={() => {
                navigator.clipboard
                  .writeText(nequiLocal)
                  .then(() => toast.success('📋 Número Nequi copiado'))
                  .catch(() => toast.error('No se pudo copiar: escríbelo manualmente'));
              }}
              className="pressable flex items-center gap-1.5 rounded-xl bg-impulso-emerald px-3 py-2.5 text-xs font-extrabold text-slate-950"
            >
              <Copy className="h-4 w-4" /> Copiar
            </button>
          </div>
        </div>

        {/* Comprobante + IA Vision */}
        <label className="pressable mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-slate-950/40 py-3.5 text-sm font-semibold text-slate-400 transition hover:border-impulso-emerald/40 hover:text-impulso-mint">
          {compressing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Optimizando tu captura…
            </>
          ) : receipt ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-impulso-mint" /> Captura cargada (toca para cambiarla)
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" /> 📷 Subir captura del pago (se optimiza y la lee la IA)
            </>
          )}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => void pickReceipt(e.target.files?.[0])} />
        </label>

        {receipt && (
          <div className="mt-2 flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-slate-950/40 p-2.5">
            <img src={receipt} alt="Comprobante" className="h-14 w-14 rounded-xl object-cover" />
            <div className="min-w-0 flex-1">
              {analyzing ? (
                <p className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                  <Sparkles className="h-4 w-4 animate-pulse text-impulso-gold" /> 🤖 La IA está leyendo tu comprobante…
                </p>
              ) : aiResult ? (
                <p className="text-[11px] font-semibold leading-relaxed text-slate-300">
                  {aiResult.looksReal ? '✅' : '⚠️'} {aiResult.note}
                  {aiResult.amountCop != null && ` · Monto: ${formatCOP(aiResult.amountCop)}`}
                </p>
              ) : (
                <p className="text-xs font-semibold text-slate-400">Escribe la referencia manualmente abajo 👇</p>
              )}
            </div>
          </div>
        )}

        {/* Referencia + método */}
        <input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Referencia del comprobante (ej: M12345 o 0098756)"
          maxLength={40}
          className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm font-medium text-white placeholder:text-slate-600 outline-none focus:border-impulso-emerald/60"
        />
        <div className="mt-2 flex gap-2">
          {(['Nequi', 'Daviplata', 'Bancolombia'] as PaymentMethod[]).map((m) => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              className={cx(
                'pressable flex-1 rounded-xl border py-2 text-xs font-bold',
                method === m
                  ? 'border-impulso-emerald/50 bg-impulso-emerald/15 text-impulso-mint'
                  : 'border-white/10 bg-slate-950/40 text-slate-400'
              )}
            >
              {m}
            </button>
          ))}
        </div>

        <button
          onClick={() => void submit()}
          disabled={submitting || analyzing || compressing}
          className="pressable mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-impulso-emerald to-teal-600 py-4 text-sm font-extrabold text-white shadow-glow disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : '📤'} Enviar Comprobante para Activación
        </button>
        <p className="mt-2 text-center text-[10px] leading-relaxed text-slate-500">
          Modalidad de venta de licencias de uso de software / créditos publicitarios prepagados bajo régimen
          simplificado / no responsable de IVA (Art. 437 ET Colombia).
        </p>
      </div>
    </ModalShell>
  );
}
