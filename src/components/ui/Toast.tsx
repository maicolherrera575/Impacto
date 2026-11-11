import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { cx } from '../../utils/format';

export type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastApi {
  push: (message: string, kind?: ToastKind) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const ICONS: Record<ToastKind, ReactNode> = {
  success: <CheckCircle2 className="h-5 w-5 text-impulso-mint shrink-0" />,
  error: <XCircle className="h-5 w-5 text-impulso-rose shrink-0" />,
  info: <Info className="h-5 w-5 text-sky-400 shrink-0" />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const push = useCallback((message: string, kind: ToastKind = 'info') => {
    seq.current += 1;
    const id = seq.current;
    setItems((prev) => [...prev.slice(-3), { id, message, kind }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      push,
      success: (m) => push(m, 'success'),
      error: (m) => push(m, 'error'),
      info: (m) => push(m, 'info'),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed bottom-24 inset-x-0 z-[90] flex flex-col items-center gap-2 px-4 pointer-events-none">
        {items.map((t) => (
          <div
            key={t.id}
            className={cx(
              'pointer-events-auto flex max-w-md items-center gap-2.5 rounded-2xl border px-4 py-3 shadow-card backdrop-blur-xl animate-slide-up',
              t.kind === 'error'
                ? 'border-impulso-rose/30 bg-impulso-rose/10'
                : t.kind === 'success'
                  ? 'border-impulso-emerald/30 bg-impulso-emerald/10'
                  : 'border-white/10 bg-impulso-panel/90'
            )}
            role="status"
          >
            {ICONS[t.kind]}
            <p className="text-sm font-medium text-slate-100">{t.message}</p>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return ctx;
}
