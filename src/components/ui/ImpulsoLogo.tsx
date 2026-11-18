import { useId } from 'react';
import { cx } from '../../utils/format';

interface ImpulsoMarkProps {
  size?: number;
  className?: string;
}

/**
 * Monograma geométrico minimalista oficial de IMPULSO (V28.0).
 * Sin arcos ni decoraciones redundantes: pilar "I" sólido + remate Esmeralda -> Cian.
 */
export function ImpulsoMark({ size = 36, className }: ImpulsoMarkProps) {
  const uid = useId().replace(/:/g, '');
  const bgId = `imp-bg-${uid}`;
  const accentId = `imp-acc-${uid}`;

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
          <stop offset="0" stopColor="#0F172A" />
          <stop offset="1" stopColor="#020617" />
        </linearGradient>
        <linearGradient id={accentId} x1="16" y1="10" x2="32" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#10B981" />
          <stop offset="1" stopColor="#22D3EE" />
        </linearGradient>
      </defs>

      <rect width="48" height="48" rx="12" fill={`url(#${bgId})`} />
      <rect x="1" y="1" width="46" height="46" rx="11" stroke="white" strokeOpacity="0.1" strokeWidth="1" />
      <rect x="20.5" y="11" width="7" height="6.2" rx="1.8" fill={`url(#${accentId})`} />
      <rect x="20.5" y="20" width="7" height="17" rx="2" fill="#F8FAFC" />
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
 * Wordmark corporativo oficial IMPULSO (V28.0):
 *  - Tipografía pesada y autoritaria sin íconos sueltos tipo Wi-Fi.
 *  - Remate de la "I" integrado al trazo geométrico en degradado Esmeralda -> Cian.
 */
export function ImpulsoLogo({ subtitle, size = 'md', hideTextOnMobile = false, className }: ImpulsoLogoProps) {
  const uid = useId().replace(/:/g, '');
  const gradId = `imp-word-grad-${uid}`;

  const height = size === 'sm' ? 24 : size === 'lg' ? 34 : 28;
  const svgWidth = Math.round(height * (172 / 34));

  return (
    <div className={cx('inline-flex items-center select-none', className)}>
      <div className="leading-none">
        <svg
          width={svgWidth}
          height={height}
          viewBox="0 0 172 34"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="IMPULSO"
          className={cx('block shrink-0', hideTextOnMobile ? 'h-6 w-auto sm:h-7' : 'w-auto')}
        >
          <defs>
            <linearGradient id={gradId} x1="2" y1="4" x2="170" y2="30" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#10B981" />
              <stop offset="0.55" stopColor="#34D399" />
              <stop offset="1" stopColor="#22D3EE" />
            </linearGradient>
          </defs>

          {/* Letra I geométrica autoritaria con punto/cabezal integrado en degradado Esmeralda -> Cian */}
          <rect x="2" y="5" width="6.4" height="5.4" rx="1.4" fill={`url(#${gradId})`} />
          <rect x="2" y="12.2" width="6.4" height="16.8" rx="1.4" fill="#F8FAFC" />

          {/* Tipografía pesada MPULSO alineada exactamente en línea base */}
          <text
            x="13"
            y="29"
            fill="#F8FAFC"
            fontFamily="'Montserrat', 'Space Grotesk', system-ui, -apple-system, sans-serif"
            fontSize="26"
            fontWeight="900"
            letterSpacing="1.8"
          >
            MPULSO
          </text>

          {/* Acento sutil integrado en el cierre */}
          <circle cx="166.5" cy="25.5" r="2.7" fill={`url(#${gradId})`} />
        </svg>
        {subtitle && (
          <p className="mt-0.5 hidden pl-0.5 text-[10px] font-medium tracking-wide text-slate-400 md:block">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
