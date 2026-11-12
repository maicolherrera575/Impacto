import { Loader2 } from 'lucide-react';
import { ModalShell } from '../ui/ModalShell';

interface GpsGuideModalProps {
  open: boolean;
  onClose: () => void;
  /** Reintento con lectura fresca de alta precisión (useGeolocation.request). */
  onRetry: () => void;
  /** true mientras el GPS sigue en modo aproximado (botón con spinner). */
  retrying?: boolean;
}

/**
 * Guía de rescate del GPS: cuando el navegador solo concede ubicación
 * APROXIMADA, enseñamos al vecino (paso a paso, como para su abuelita)
 * cómo cambiarla a EXACTA en los ajustes del navegador. En cuanto la
 * señal mejora, la app se activa sola (sin recargar).
 */
export function GpsGuideModal({ open, onClose, onRetry, retrying = false }: GpsGuideModalProps) {
  return (
    <ModalShell open={open} onClose={onClose}>
      <div className="p-5">
        <div className="mb-3 text-center">
          <p className="text-4xl">📡</p>
          <h3 className="mt-1.5 text-base font-extrabold text-white">
            Necesitamos tu ubicación EXACTA
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            El navegador nos dio una ubicación <strong className="text-amber-300">aproximada</strong> y en Impulso no
            la usamos para no mostrarte ofertas equivocadas. Cámbiala a <strong className="text-impulso-mint">"Ubicación exacta"</strong> en
            4 pasitos:
          </p>
        </div>

        {/* Pasos Android / Chrome */}
        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3.5">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-impulso-gold">
            📱 Si usas Chrome (Android)
          </p>
          <ol className="mt-2 space-y-2 text-xs font-semibold leading-relaxed text-slate-300">
            <li className="flex gap-2">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-impulso-emerald/15 text-[10px] font-extrabold text-impulso-mint">1</span>
              Toca el <strong className="text-white">candado 🔒</strong> (o el ⓘ) que aparece junto a la dirección de la página, arriba de todo.
            </li>
            <li className="flex gap-2">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-impulso-emerald/15 text-[10px] font-extrabold text-impulso-mint">2</span>
              Entra a <strong className="text-white">"Permisos"</strong> y luego a <strong className="text-white">"Ubicación"</strong>.
            </li>
            <li className="flex gap-2">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-impulso-emerald/15 text-[10px] font-extrabold text-impulso-mint">3</span>
              Elige <strong className="text-impulso-mint">"Ubicación exacta"</strong> (y deja el acceso en <strong className="text-white">"Permitir"</strong>).
            </li>
            <li className="flex gap-2">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-impulso-emerald/15 text-[10px] font-extrabold text-impulso-mint">4</span>
              Vuelve aquí y toca el botón verde de abajo. En cuanto llegue la señal exacta, el radar se activa solo ✨.
            </li>
          </ol>
        </div>

        {/* Pasos iPhone / Safari */}
        <div className="mt-2 rounded-2xl border border-white/10 bg-slate-950/40 p-3.5">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
            🍎 Si usas iPhone (Safari)
          </p>
          <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-300">
            Ajustes → Safari → <strong className="text-white">"Ubicación"</strong> → elige
            <strong className="text-impulso-mint"> "Preguntar"</strong>. Luego cierra y vuelve a abrir la página y
            acepta el aviso que sale.
          </p>
        </div>

        <button
          onClick={onRetry}
          disabled={retrying}
          className="pressable mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-impulso-emerald py-3.5 text-sm font-extrabold text-slate-950 shadow-glow disabled:opacity-60"
        >
          {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <>✅</>}
          Ya la cambié: intentar de nuevo
        </button>
        <p className="mt-1.5 text-center text-[10px] leading-relaxed text-slate-500">
          Si el botón ámbar ⚠️ sigue encendido, la señal aún llega aproximada: repite los pasos y cierra y abre la
          página. No necesitamos instalar nada — esto es solo un permiso del navegador.
        </p>

        <button
          onClick={onClose}
          className="pressable mt-2 w-full rounded-2xl border border-white/10 py-3 text-xs font-extrabold text-slate-300 transition hover:bg-white/5"
        >
          Seguir sin GPS (el radar se queda en Gachetá)
        </button>
      </div>
    </ModalShell>
  );
}
