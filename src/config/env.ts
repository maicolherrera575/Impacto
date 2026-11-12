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

export const ADMIN_WHATSAPP = (import.meta.env.VITE_ADMIN_WHATSAPP ?? '573000000000').trim();

export const APP_NAME = 'Impulso';
export const APP_TAGLINE = 'Radar de ofertas y comercios en vivo';
