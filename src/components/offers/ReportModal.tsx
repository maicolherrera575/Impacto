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
 * Confirmación de reporte en 2 pasos: primero se elige el motivo y solo
 * entonces se envía. Así un toque accidental jamás reporta una oferta,
 * y el administrador recibe el motivo exacto (no solo un contador).
 */
export function ReportModal({ offer, busy, onClose, onConfirm }: ReportModalProps) {
  const [reason, setReason] = useState<string | null>(null);
  const [detail, setDetail] = useState('');

  const needsDetail = reason === 'otro';
  const canSubmit =
    reason != null && !busy && (!needsDetail || detail.trim().length >= 3);

  function confirm() {
    if (!canSubmit || reason == null) return;
    onConfirm(reason, needsDetail ? detail.trim() : '');
    setReason(null);
    setDetail('');
  }

  /** Cierre sin enviar: limpia la selección para la próxima vez. */
  function handleClose() {
    setReason(null);
    setDetail('');
    onClose();
  }

  return (
    <ModalShell open={offer != null} onClose={handleClose}>
      <div className="p-5">
        <div className="mb-3 flex items-center gap-2.5">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-impulso-rose/30 bg-impulso-rose/10">
            <ShieldAlert className="h-5 w-5 text-impulso-rose" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-extrabold text-white">¿Quieres reportar esta oferta?</h3>
            <p className="truncate text-xs font-semibold text-slate-400">
              {offer?.emoji_icon} {offer?.title}
            </p>
          </div>
        </div>

        <p className="mb-3 text-xs leading-relaxed text-slate-400">
          Dinos <strong className="text-slate-200">cuál es el motivo</strong> para que el administrador pueda revisarla
          de verdad (y no por envidia o broma 😉). Con <strong className="text-impulso-rose">3 reportes</strong> la
          oferta sale del radar automáticamente.
        </p>

        <div className="space-y-1.5">
          {REPORT_REASONS.map((r) => (
            <button
              key={r.id}
              onClick={() => setReason(r.id)}
              disabled={busy}
              className={cx(
                'pressable flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left text-sm font-bold transition disabled:opacity-60',
                reason === r.id
                  ? 'border-impulso-rose/60 bg-impulso-rose/10 text-white'
                  : 'border-white/10 bg-slate-950/40 text-slate-300 hover:border-impulso-rose/30'
              )}
            >
              <span className="text-lg">{r.emoji}</span>
              {r.label}
            </button>
          ))}
        </div>

        {needsDetail && (
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Cuéntanos qué pasa (mínimo 3 letras)…"
            className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm font-medium text-white placeholder:text-slate-600 outline-none focus:border-impulso-rose/50"
            aria-label="Detalle del reporte"
          />
        )}

        <button
          onClick={confirm}
          disabled={!canSubmit}
          className="pressable mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-impulso-rose py-3.5 text-sm font-extrabold text-white shadow-glow disabled:opacity-40 disabled:shadow-none"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
          Enviar reporte
        </button>

        <p className="mt-2.5 text-center text-[10px] leading-relaxed text-slate-500">
          Tu reporte es anónimo para el comercio, pero el administrador puede ver el motivo y la trazabilidad
          (dispositivo/IP) para evitar reportes falsos. Tratamiento de datos conforme a la Ley 1581 de 2012.
        </p>
      </div>
    </ModalShell>
  );
}
