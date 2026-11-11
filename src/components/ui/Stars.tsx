import { cx } from '../../utils/format';

interface StarsProps {
  value: number;
  onChange?: (value: number) => void;
  size?: 'sm' | 'md';
}

/** Calificación en estrellas — lectura o selección interactiva. */
export function Stars({ value, onChange, size = 'sm' }: StarsProps) {
  const dim = size === 'sm' ? 'h-4 w-4' : 'h-7 w-7';
  const stars = [1, 2, 3, 4, 5];

  return (
    <div className="flex items-center gap-1" role={onChange ? 'radiogroup' : 'img'} aria-label="Calificación">
      {stars.map((n) => {
        const active = n <= Math.round(value);
        const Star = (
          <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" className={cx(dim, active ? 'text-impulso-gold' : 'text-slate-600')}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
            />
          </svg>
        );
        if (!onChange) return <span key={n}>{Star}</span>;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={n === Math.round(value)}
            aria-label={`${n} estrellas`}
            onClick={() => onChange(n)}
            className="pressable"
          >
            {Star}
          </button>
        );
      })}
    </div>
  );
}
