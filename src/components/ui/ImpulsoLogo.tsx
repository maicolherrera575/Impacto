import { useId } from 'react';
import { cx } from '../../utils/format';

interface ImpulsoMarkProps {
  size?: number;
  className?: string;
}

/**
 * Icono vectorial de marca "Impulso": onda de impacto y pulso ascendente con
 * punta direccional en degradado esmeralda -> cian -> azul electrico.
 */
export function ImpulsoMark({ size = 36, className }: ImpulsoMarkProps) {
  const uid = useId().replace(/:/g, '');
  const bgId = `imp-bg-${uid}`;
  const pulseId = `imp-pulse-${uid}`;
  const glowId = `imp-glow-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cx('shrink-0', className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={bgId} x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#11223A" />
          <stop offset="1" stopColor="#070D19" />
        </linearGradient>
        <linearGradient id={pulseId} x1="7" y1="36" x2="41" y2="10" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#10B981" />
          <stop offset="0.55" stopColor="#22D3EE" />
          <stop offset="1" stopColor="#60A5FA" />
        </linearGradient>
        <radialGradient id={glowId} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(24 24) rotate(90) scale(22)">
          <stop stopColor="#22D3EE" stopOpacity="0.28" />
          <stop offset="1" stopColor="#22D3EE" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="48" height="48" rx="14" fill={`url(#${bgId})`} />
      <rect width="48" height="48" rx="14" fill={`url(#${glowId})`} />
      <rect x="1" y="1" width="46" height="46" rx="13" stroke={`url(#${pulseId})`} strokeOpacity="0.34" strokeWidth="1.2" />

      {/* Onda expansiva sutil */}
      <path
        d="M9 19.5C12.5 13 18.8 9.5 26 9.5"
        stroke="#34D399"
        strokeOpacity="0.45"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {/* Pulso de impacto ascendente */}
      <path
        d="M8.5 31H15.5L20 17.5L25.5 34L31.5 14L35.2 23.5H40"
        stroke={`url(#${pulseId})`}
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Vector ascendente final */}
      <circle cx="31.5" cy="14" r="2.4" fill="#A5F3FC" />
    </svg>
  );
}

interface ImpulsoLogoProps {
  subtitle?: string;
  size?: 'sm' | 'md' | 'lg';
  hideTextOnMobile?: boolean;
  className?: string;
}

/**
 * Identidad tipografica oficial de Impulso (Montserrat Black / Space Grotesk en italica).
 */
export function ImpulsoLogo({ subtitle, size = 'md', hideTextOnMobile = false, className }: ImpulsoLogoProps) {
  const iconSize = size === 'sm' ? 32 : size === 'lg' ? 42 : 36;
  const wordSize = size === 'sm' ? 'text-[17px]' : size === 'lg' ? 'text-[22px]' : 'text-[19px]';

  return (
    <div className={cx('inline-flex items-center gap-2.5 select-none', className)}>
      <div className="relative rounded-[14px] shadow-[0_0_30px_-8px_rgba(34,211,238,0.45)]">
        <ImpulsoMark size={iconSize} />
      </div>
      <div className={cx('leading-none', hideTextOnMobile ? 'hidden sm:block' : 'block')}>
        <p
          className={cx('font-black italic tracking-[-0.04em] text-white flex items-baseline', wordSize)}
          style={{ fontFamily: '"Montserrat", "Space Grotesk", system-ui, sans-serif' }}
        >
          <span>IMPULSO</span>
          <span className="ml-0.5 inline-block h-1.5 w-1.5 rounded-full bg-gradient-to-tr from-impulso-emerald to-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
        </p>
        {subtitle && (
          <p className="mt-1 hidden text-[10px] font-semibold tracking-wide text-slate-400 md:block">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
