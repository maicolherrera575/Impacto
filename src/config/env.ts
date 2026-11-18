/**
 * Configuración central del entorno.
 * Falla temprano y con mensajes claros si falta alguna variable crítica.
 *
 * ⚠️ Lectura ESTÁTICA (import.meta.env.VITE_X): el `define` de vite.config.ts
 * inyecta en el build los valores SIN prefijo guardados en Vercel
 * (SUPABASE_URL, SUPABASE_ANON_KEY…), con fallback al .env local con VITE_.
 */

function requireValue(value: string | undefined, name: string): string {
  if (!value || value.trim() === '') {
    throw new Error(
      `[Impulso] Falta la variable de entorno ${name}. ` +
        'En Vercel guárdala SIN prefijo en modo Secreto (ej: SUPABASE_URL). ' +
        'En desarrollo local cópiala en .env con el prefijo VITE_ (ej: VITE_SUPABASE_URL).'
    );
  }
  return value.trim();
}

export const SUPABASE_URL = requireValue(import.meta.env.VITE_SUPABASE_URL, 'SUPABASE_URL / VITE_SUPABASE_URL');
export const SUPABASE_ANON_KEY = requireValue(import.meta.env.VITE_SUPABASE_ANON_KEY, 'SUPABASE_ANON_KEY / VITE_SUPABASE_ANON_KEY');

/**
 * Llave de Gemini SOLO para desarrollo local (npm run dev).
 * En producción (Vercel) la IA corre por el endpoint serverless /api/gemini
 * con la llave privada GEMINI_API_KEY: NUNCA se expone al navegador, así que
 * aquí queda vacía sin romper la app ni el build.
 */
export const GEMINI_API_KEY = (import.meta.env.VITE_GEMINI_API_KEY ?? '').trim();

/** Pool deduplicado de llaves Gemini para rotación automática ante cuota agotada (HTTP 429). */
export const GEMINI_API_KEYS: string[] = Array.from(
  new Set(
    [
      typeof __APP_GEMINI_KEY_1__ === 'string' ? __APP_GEMINI_KEY_1__ : '',
      typeof __APP_GEMINI_KEY_2__ === 'string' ? __APP_GEMINI_KEY_2__ : '',
      typeof __APP_GEMINI_KEY_3__ === 'string' ? __APP_GEMINI_KEY_3__ : '',
      typeof __APP_GEMINI_KEY__ === 'string' ? __APP_GEMINI_KEY__ : '',
      GEMINI_API_KEY,
      import.meta.env.VITE_GEMINI_API_KEY_1 ?? '',
      import.meta.env.VITE_GEMINI_API_KEY_2 ?? '',
      import.meta.env.VITE_GEMINI_API_KEY_3 ?? '',
    ]
      .map((k) => k.trim())
      .filter((k) => k.length > 0),
  ),
);

export const ADMIN_WHATSAPP = (import.meta.env.VITE_ADMIN_WHATSAPP ?? '573000000000').trim();

export const APP_NAME = 'Impulso';
export const APP_TAGLINE = 'Radar de ofertas y comercios en vivo';
