import { Loader2 } from 'lucide-react';
import { ModalShell } from '../ui/ModalShell';

interface GpsGuideModalProps {
  open: boolean;
  onClose: () => void;
  /** Reintento con lectura fresca de alta precisión (useGeolocation.request). */
  onRetry: () => void;
  /** true mientras busca señal GPS exacta (botón con spinner). */
  retrying?: boolean;
  /** 'inexact' si el navegador dio ubicación aproximada; 'denied' si bloqueó el permiso. */
  mode?: 'inexact' | 'denied';
}

/**
 * Guía paso a paso para habilitar "Ubicación exacta" en el navegador
 * cuando la señal llegó aproximada (> 1000 m) o el permiso estaba bloqueado.
 */
export function GpsGuideModal({
  open,
  onClose,
  onRetry,
  retrying = false,
  mode = 'inexact',
}: GpsGuideModalProps) {
  return (
    <ModalShell open={open} onClose={onClose}>
      <div className="p-5 pt-14">
        <div className="mb-3 text-center">
          <p className="text-4xl">📡</p>
          <h3 className="mt-1.5 text-base font-extrabold text-white">
            {mode === 'denied' ? 'Activa el permiso de ubicación exacta' : 'Necesitamos tu ubicación EXACTA'}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            {mode === 'denied' ? (
              <>
                El navegador bloqueó el acceso al GPS. Actívalo como{' '}
                <strong className="text-impulso-mint">"Permitir + Ubicación exacta"</strong> para medir distancias reales:
              </>
            ) : (
              <>
                Para usar el radar de proximidad, requerimos tu{' '}
                <strong className="text-impulso-mint">ubicación exacta</strong>. La ubicación{' '}
                <strong className="text-amber-300">aproximada</strong> no permite calcular distancias reales.
              </>
            )}
          </p>
        </div>

        {/* Pasos Android / Chrome */}
        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3.5">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-impulso-gold">
            📱 Si usas Chrome (Android o PC)
          </p>
          <ol className="mt-2 space-y-2 text-xs font-semibold leading-relaxed text-slate-300">
            <li className="flex gap-2">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-impulso-emerald/15 text-[10px] font-extrabold text-impulso-mint">1</span>
              <span>
                Toca el <strong className="text-white">candado 🔒</strong> (o icono de ajustes) junto a la dirección de la página.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-impulso-emerald/15 text-[10px] font-extrabold text-impulso-mint">2</span>
              <span>
                Entra a <strong className="text-white">"Permisos" → "Ubicación"</strong> y deja el acceso en{' '}
                <strong className="text-white">"Permitir"</strong>.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-impulso-emerald/15 text-[10px] font-extrabold text-impulso-mint">3</span>
              <span>
                Activa el interruptor de <strong className="text-impulso-mint">"Ubicación exacta"</strong> (y verifica que el GPS del celular esté encendido).
              </span>
            </li>
          </ol>
        </div>

        {/* Pasos iPhone / Safari */}
        <div className="mt-2 rounded-2xl border border-white/10 bg-slate-950/40 p-3.5">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
            🍎 Si usas iPhone (Safari)
          </p>
          <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-300">
            Ajustes → Privacidad y seguridad → Localización → Safari → activa{' '}
            <strong className="text-impulso-mint">"Ubicación precisa"</strong>. Luego toca el botón verde de abajo.
          </p>
        </div>

        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="pressable mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-impulso-emerald py-3.5 text-sm font-extrabold text-slate-950 shadow-glow disabled:opacity-60"
        >
          {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <>✅</>}
          {retrying ? 'Verificando señal exacta…' : 'Ya la activé: intentar de nuevo'}
        </button>

        <button
          type="button"
          onClick={onClose}
          className="pressable mt-2 w-full rounded-2xl border border-white/10 py-3 text-xs font-extrabold text-slate-300 transition hover:bg-white/5"
        >
          Seguir explorando sin GPS (el radar se queda en el pueblo)
        </button>
      </div>
    </ModalShell>
  );
}
