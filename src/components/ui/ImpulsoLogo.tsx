import { useId } from 'react';
import { cx } from '../../utils/format';

interface ImpulsoMarkProps {
  size?: number;
  className?: string;
}

/**
 * Emblema minimalista oficial de IMPULSO (V24.0):
 *  - Nucleo y ondas de radar local limpias en gradiente Esmeralda -> Cian.
 *  - Alta costura corporativa, sin flechas ni barras retro.
 */
export function ImpulsoMark({ size = 36, className }: ImpulsoMarkProps) {
  const uid = useId().replace(/:/g, '');
  const bgId = `imp-bg-${uid}`;
  const ringId = `imp-ring-${uid}`;
  const flareId = `imp-flare-${uid}`;

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
          <stop offset="0" stopColor="#0E1B30" />
          <stop offset="1" stopColor="#050914" />
        </linearGradient>
        <linearGradient id={ringId} x1="8" y1="40" x2="40" y2="8" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#10B981" />
          <stop offset="1" stopColor="#22D3EE" />
        </linearGradient>
        <radialGradient
          id={flareId}
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(24 18) rotate(90) scale(18)"
        >
          <stop stopColor="#22D3EE" stopOpacity="0.32" />
          <stop offset="1" stopColor="#22D3EE" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="48" height="48" rx="14" fill={`url(#${bgId})`} />
      <rect width="48" height="48" rx="14" fill={`url(#${flareId})`} />
      <rect x="1" y="1" width="46" height="46" rx="13" stroke="white" strokeOpacity="0.09" strokeWidth="1" />

      {/* Arco exterior de radar */}
      <circle cx="24" cy="24" r="14.5" stroke={`url(#${ringId})`} strokeOpacity="0.28" strokeWidth="1.5" />
      <path
        d="M13.8 13.8A14.5 14.5 0 0 1 34.2 13.8"
        stroke={`url(#${ringId})`}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      {/* Monograma "I" minimalista con punto de destello Esmeralda/Cian */}
      <rect x="21.4" y="21" width="5.2" height="14" rx="2.6" fill="#F8FAFC" />
      <circle cx="24" cy="14.5" r="3.4" fill={`url(#${ringId})`} />
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
 * Logotipo corporativo puro en SVG (V24.0):
 *  - Tipografia gruesa y extendida ("IMPULSO") codificada en SVG.
 *  - Destello de radar minimalista en gradiente Esmeralda -> Cian sobre la "I".
 */
export function ImpulsoLogo({ subtitle, size = 'md', hideTextOnMobile = false, className }: ImpulsoLogoProps) {
  const uid = useId().replace(/:/g, '');
  const gradId = `imp-word-grad-${uid}`;
  const glowId = `imp-word-glow-${uid}`;

  const height = size === 'sm' ? 28 : size === 'lg' ? 38 : 32;
  const markSize = size === 'sm' ? 30 : size === 'lg' ? 38 : 34;

  const svgWidth = Math.round(height * (162 / 40));

  return (
    <div className={cx('inline-flex items-center gap-2.5 select-none', className)}>
      {/* Emblema oficial con la "i" de radar: visible consistentemente en móvil y PC */}
      <ImpulsoMark size={markSize} />

      <div className={cx('leading-none', hideTextOnMobile ? 'hidden sm:block' : 'block')}>
        <svg
          width={svgWidth}
          height={height}
          viewBox="0 0 162 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="IMPULSO"
          className="block shrink-0"
        >
          <defs>
            <linearGradient id={gradId} x1="4" y1="6" x2="152" y2="34" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#10B981" />
              <stop offset="0.55" stopColor="#34D399" />
              <stop offset="1" stopColor="#22D3EE" />
            </linearGradient>
            <radialGradient
              id={glowId}
              cx="0"
              cy="0"
              r="1"
              gradientUnits="userSpaceOnUse"
              gradientTransform="translate(9 12) rotate(90) scale(10)"
            >
              <stop stopColor="#22D3EE" stopOpacity="0.45" />
              <stop offset="1" stopColor="#22D3EE" stopOpacity="0" />
            </radialGradient>
          </defs>

          <circle cx="9" cy="12" r="9" fill={`url(#${glowId})`} />
          <text
            x="2"
            y="29"
            fill="#F8FAFC"
            fontFamily="'Space Grotesk', 'Montserrat', system-ui, -apple-system, sans-serif"
            fontSize="24"
            fontWeight="900"
            letterSpacing="3.2"
          >
            IMPULSO
          </text>
          <circle cx="154" cy="25.5" r="2.6" fill={`url(#${gradId})`} />
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
