import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cx } from '../../utils/format';

interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Ancho máximo del panel (clases Tailwind). */
  panelClassName?: string;
  closeLabel?: string;
}

/**
 * Base de todos los modales de Impulso:
 * desenfoque de fondo, transiciones nativas tipo app y cierre seguro.
 */
export function ModalShell({ open, onClose, children, panelClassName, closeLabel = 'Cerrar' }: ModalShellProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-md animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cx(
          'relative my-auto w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/[0.08] bg-impulso-panel/95 backdrop-blur-xl shadow-[0_12px_40px_-12px_rgba(0,0,0,0.7)] sm:rounded-3xl animate-slide-up',
          'max-h-[90dvh]',
          panelClassName
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
