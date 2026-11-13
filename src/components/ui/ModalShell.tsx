import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cx } from '../../utils/format';

type ModalSize = 'md' | 'lg' | 'xl' | 'full';

interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Tamaño del panel: 'full' = widescreen de panel completo en PC. */
  size?: ModalSize;
  /** Ancho máximo explícito (compatibilidad con usos anteriores; tiene prioridad). */
  panelClassName?: string;
  closeLabel?: string;
  /** Permite cerrar con Escape: SOLO para modales de solo lectura (sin formularios). */
  escClose?: boolean;
}

const SIZE_CLASSES: Record<ModalSize, string> = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
  full: 'max-w-lg md:w-[96vw] md:max-w-[1440px] md:h-[92dvh] md:max-h-[92dvh]',
};

/**
 * Base de todos los modales de Impulso:
 * desenfoque de fondo y transiciones nativas tipo app.
 * REGLA V7.1: tocar el fondo oscuro NUNCA cierra el modal (protege los
 * formularios largos); solo se cierra con el botón ✕ o acciones explícitas.
 */
export function ModalShell({ open, onClose, children, size = 'md', panelClassName, closeLabel = 'Cerrar', escClose = false }: ModalShellProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (escClose && e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, escClose, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      {/* Sin onClick: hacer clic fuera del cuadro JAMÁS cierra el modal. */}
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-md animate-fade-in" aria-hidden="true" />
      <div
        className={cx(
          'relative my-auto w-full overflow-y-auto rounded-t-3xl border border-white/[0.08] bg-impulso-panel/95 backdrop-blur-xl shadow-[0_12px_40px_-12px_rgba(0,0,0,0.7)] sm:rounded-3xl animate-slide-up',
          'max-h-[90dvh]',
          panelClassName ?? SIZE_CLASSES[size],
        )}
      >
        <button
          onClick={onClose}
          aria-label={closeLabel}
          className="pressable absolute right-3.5 top-3.5 z-10 grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-slate-950/60 text-slate-300 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
        {children}
      </div>
    </div>
  );
}
