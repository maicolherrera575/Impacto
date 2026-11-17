import { useState } from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';
import type { Offer } from '../../types';
import { ModalShell } from '../ui/ModalShell';
import { cx } from '../../utils/format';

/** Catálogo de motivos (compartido con el panel del administrador). */
export interface ReportReason {
  id: string;
  emoji: string;
  label: string;
}

export const REPORT_REASONS: ReportReason[] = [
  { id: 'no_existe', emoji: '🚫', label: 'El producto no existe' },
  { id: 'precio_enganoso', emoji: '💸', label: 'El precio es engañoso' },
  { id: 'cerrado', emoji: '🕳️', label: 'El local está cerrado' },
  { id: 'estafa', emoji: '🎭', label: 'Sospecho de estafa' },
  { id: 'otro', emoji: '✍️', label: 'Otro motivo' },
];

/** Emoji + etiqueta legible a partir del código guardado en la base de datos. */
export function reportReasonMeta(reason: string): ReportReason {
  return REPORT_REASONS.find((r) => r.id === reason) ?? { id: reason, emoji: '🚩', label: reason };
}

interface ReportModalProps {
  offer: Offer | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string, detail: string) => void;
}

/**
 * Confirmación de reporte con evidencia mínima (anti-envidia):
 * exige motivo + explicación real (mín. 12 caracteres) para proteger a los
 * comercios contra ataques coordinados o denuncias sin fundamento.
 */
export function ReportModal({ offer, busy, onClose, onConfirm }: ReportModalProps) {
  const [reason, setReason] = useState<string | null>(null);
  const [detail, setDetail] = useState('');

  const detailClean = detail.trim();
  const canSubmit = reason != null && !busy && detailClean.length >= 12;

  function confirm() {
    if (!canSubmit || reason == null) return;
    onConfirm(reason, detailClean);
    setReason(null);
    setDetail('');
  }

  function handleClose() {
    setReason(null);
    setDetail('');
    onClose();
  }

  return (
    <ModalShell open={offer != null} onClose={handleClose}>
      <div className="p-5 pt-14">
        <div className="mb-3 flex items-center gap-2.5">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-impulso-rose/30 bg-impulso-rose/10">
            <ShieldAlert className="h-5 w-5 text-impulso-rose" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-extrabold text-white">Reportar irregularidad real</h3>
            <p className="truncate text-xs font-semibold text-slate-400">
              {offer?.emoji_icon} {offer?.title}
            </p>
          </div>
        </div>

        <p className="mb-3 rounded-2xl border border-white/10 bg-slate-950/40 p-3 text-xs leading-relaxed text-slate-300">
          Para proteger a los comercios honestos contra reportes falsos o por envidia, toda denuncia pasa por{' '}
          <strong className="text-white">auditoría de evidencia</strong> (comprobación de reserva, IP pública y
          descripción). Las denuncias sin sustento son desestimadas por el administrador.
        </p>

        <div className="space-y-1.5">
          {REPORT_REASONS.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setReason(r.id)}
              disabled={busy}
              className={cx(
                'pressable flex w-full items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-left text-sm font-bold transition disabled:opacity-60',
                reason === r.id
                  ? 'border-impulso-rose/60 bg-impulso-rose/10 text-white'
                  : 'border-white/10 bg-slate-950/40 text-slate-300 hover:border-impulso-rose/30',
              )}
            >
              <span className="text-lg">{r.emoji}</span>
              {r.label}
            </button>
          ))}
        </div>

        <div className="mt-3">
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Describe qué ocurrió con datos concretos (ej: fui al local a las 3pm y cobraban otro precio). Mínimo 12 letras *"
            className="w-full resize-none rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm font-medium text-white placeholder:text-slate-600 outline-none focus:border-impulso-rose/50"
            aria-label="Explicación de la denuncia"
          />
          <p className="mt-1 text-right text-[10px] font-semibold text-slate-500">
            {detailClean.length < 12
              ? `Faltan ${12 - detailClean.length} caracteres mínimos`
              : `${detailClean.length}/500 caracteres · Listo para auditoría`}
          </p>
        </div>

        <button
          type="button"
          onClick={confirm}
          disabled={!canSubmit}
          className="pressable mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-impulso-rose py-3.5 text-sm font-extrabold text-white shadow-glow disabled:opacity-40 disabled:shadow-none"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
          Enviar reporte verificado
        </button>

        <p className="mt-2.5 text-center text-[10px] leading-relaxed text-slate-500">
          El abuso de denuncias falsas o competencia desleal queda registrado con IP y huella de dispositivo (Ley 1581
          de 2012, Ley 1273 de 2009 y Ley 256 de 1996).
        </p>
      </div>
    </ModalShell>
  );
}
