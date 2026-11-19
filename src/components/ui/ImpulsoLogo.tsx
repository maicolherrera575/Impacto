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
  const svgWidth = Math.round(height * (152 / 36));

  return (
    <div className={cx('inline-flex items-center select-none', className)}>
      <div className="leading-none">
        <svg
          width={svgWidth}
          height={height}
          viewBox="0 0 152 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="IMPULSO"
          className={cx('block shrink-0 overflow-visible', hideTextOnMobile ? 'h-6 w-auto sm:h-7' : 'w-auto')}
        >
          <defs>
            <linearGradient id={gradId} x1="6" y1="4" x2="148" y2="32" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#10B981" />
              <stop offset="0.55" stopColor="#34D399" />
              <stop offset="1" stopColor="#22D3EE" />
            </linearGradient>
          </defs>

          {/* Pulso radar sutil y centrado con margen limpio sobre la "I" oficial de IMPULSO */}
          <circle
            cx="9.2"
            cy="9.2"
            r="3.6"
            stroke={`url(#${gradId})`}
            strokeWidth="1.25"
            className="imp-logo-radar-ring"
          />
          {/* Letra I geométrica autoritaria con cabezal radar en degradado Esmeralda -> Cian */}
          <rect x="6" y="6.5" width="6.4" height="5.4" rx="1.5" fill={`url(#${gradId})`} />
          <rect x="6" y="13.8" width="6.4" height="16.7" rx="1.5" fill="#F8FAFC" />

          {/* Tipografía pesada MPULSO con kerning óptico limpio y alineación exacta en línea base */}
          <text
            x="17"
            y="30.4"
            fill="#F8FAFC"
            fontFamily="'Montserrat', 'Space Grotesk', system-ui, -apple-system, sans-serif"
            fontSize="25.5"
            fontWeight="900"
            letterSpacing="1.35"
          >
            MPULSO
          </text>
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
