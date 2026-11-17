import { useId } from 'react';
import { cx } from '../../utils/format';

interface ImpulsoMarkProps {
  size?: number;
  className?: string;
}

/**
 * Isotipo oficial de IMPULSO (V23.0):
 *  - Radar local (arcos de cobertura geolocalizada y faro emisor)
 *  - Impulso ascendente (flecha / vector de crecimiento Esmeralda -> Cian)
 */
export function ImpulsoMark({ size = 36, className }: ImpulsoMarkProps) {
  const uid = useId().replace(/:/g, '');
  const bgId = `imp-bg-${uid}`;
  const gradId = `imp-grad-${uid}`;
  const radarId = `imp-radar-${uid}`;
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
          <stop offset="0" stopColor="#0E2034" />
          <stop offset="1" stopColor="#070D19" />
        </linearGradient>
        <linearGradient id={gradId} x1="10" y1="38" x2="39" y2="10" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#10B981" />
          <stop offset="0.55" stopColor="#34D399" />
          <stop offset="1" stopColor="#22D3EE" />
        </linearGradient>
        <linearGradient id={radarId} x1="8" y1="24" x2="38" y2="8" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#22D3EE" stopOpacity="0.85" />
          <stop offset="1" stopColor="#10B981" stopOpacity="0.2" />
        </linearGradient>
        <radialGradient
          id={glowId}
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(33 15) rotate(90) scale(18)"
        >
          <stop stopColor="#22D3EE" stopOpacity="0.34" />
          <stop offset="1" stopColor="#22D3EE" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="48" height="48" rx="14" fill={`url(#${bgId})`} />
      <rect width="48" height="48" rx="14" fill={`url(#${glowId})`} />
      <rect x="1" y="1" width="46" height="46" rx="13" stroke={`url(#${gradId})`} strokeOpacity="0.36" strokeWidth="1.2" />

      {/* Ondas de radar local / faro emisor desde el vertice superior */}
      <path
        d="M17.5 13.5C22.4 10.2 28.9 10.6 33.4 14.5C37.9 18.4 39.2 24.8 36.7 30.2"
        stroke={`url(#${radarId})`}
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeOpacity="0.55"
      />
      <path
        d="M12.5 18.5C15.5 9.8 24.7 5.2 33.5 8.1"
        stroke="#10B981"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeOpacity="0.38"
      />

      {/* Grafica de crecimiento + vector ascendente de impulso */}
      <path
        d="M10.5 34.5L18.5 26.5L23.8 31.2L34.5 16.5"
        stroke={`url(#${gradId})`}
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M27.2 15.8H35.2V23.8"
        stroke="#22D3EE"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Punto luminoso del faro local */}
      <circle cx="35.2" cy="15.8" r="2.6" fill="#A5F3FC" />
      <circle cx="10.5" cy="34.5" r="2.1" fill="#34D399" />
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
 * Identidad tipografica oficial de IMPULSO (Montserrat Black / Space Grotesk en italica).
 */
export function ImpulsoLogo({ subtitle, size = 'md', hideTextOnMobile = false, className }: ImpulsoLogoProps) {
  const iconSize = size === 'sm' ? 32 : size === 'lg' ? 42 : 36;
  const wordSize = size === 'sm' ? 'text-[17px]' : size === 'lg' ? 'text-[22px]' : 'text-[19px]';

  return (
    <div className={cx('inline-flex items-center gap-2.5 select-none', className)}>
      <div className="relative rounded-[14px] shadow-[0_0_28px_-6px_rgba(34,211,238,0.45)]">
        <ImpulsoMark size={iconSize} />
      </div>
      <div className={cx('leading-none', hideTextOnMobile ? 'hidden sm:block' : 'block')}>
        <p
          className={cx('font-black italic tracking-[-0.04em] text-white flex items-baseline', wordSize)}
          style={{ fontFamily: '"Montserrat", "Space Grotesk", system-ui, sans-serif' }}
        >
          <span>IMPULSO</span>
          <span className="ml-0.5 inline-block h-1.5 w-1.5 rounded-full bg-gradient-to-tr from-impulso-emerald to-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.85)]" />
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
