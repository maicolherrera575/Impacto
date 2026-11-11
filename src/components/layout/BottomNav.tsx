import { Flame, Megaphone, Ticket } from 'lucide-react';
import type { Tab } from '../../types/navigation';
import { cx } from '../../utils/format';

interface BottomNavProps {
  active: Tab;
  onChange: (tab: Tab) => void;
  pendingTickets?: number;
}

const ITEMS: Array<{ id: Tab; label: string; Icon: typeof Flame }> = [
  { id: 'ofertas', label: 'Ofertas', Icon: Flame },
  { id: 'pedir', label: 'Pedir', Icon: Megaphone },
  { id: 'apartados', label: 'Apartados', Icon: Ticket },
];

/** Navegación inferior estilo app nativa con área segura del sistema. */
export function BottomNav({ active, onChange, pendingTickets }: BottomNavProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/5 bg-impulso-night/90 backdrop-blur-xl safe-bottom">
      <div className="mx-auto flex max-w-xl items-center justify-around px-4 pt-2">
        {ITEMS.map(({ id, label, Icon }) => {
          const isActive = active === id;
          const badge = id === 'apartados' && (pendingTickets ?? 0) > 0;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              aria-current={isActive ? 'page' : undefined}
              className={cx(
                'pressable relative flex min-w-[88px] flex-col items-center gap-1 rounded-2xl py-1.5 transition',
                isActive ? 'text-impulso-mint' : 'text-slate-500'
              )}
            >
              <span
                className={cx(
                  'relative grid h-9 w-14 place-items-center rounded-xl transition',
                  isActive ? 'bg-impulso-emerald/15' : 'bg-transparent'
                )}
              >
                <Icon className="h-5 w-5" />
                {badge && (
                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-impulso-gold ring-2 ring-impulso-night" />
                )}
              </span>
              <span className={cx('text-[11px] font-bold tracking-tight', isActive && 'text-impulso-mint')}>
                {label}
              </span>
              {isActive && (
                <span className="absolute -bottom-0.5 h-1 w-6 rounded-full bg-gradient-to-r from-impulso-emerald to-teal-400" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
