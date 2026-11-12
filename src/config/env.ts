/**
 * Configuración central del entorno.
 * Falla temprano y con mensajes claros si falta alguna variable crítica.
 */

function requireEnv(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `[Impulso] Falta la variable de entorno ${name}. ` +
        'Copia .env.example como .env y completa los valores reales.'
    );
  }
  return value.trim();
}

export const SUPABASE_URL = requireEnv('VITE_SUPABASE_URL');
export const SUPABASE_ANON_KEY = requireEnv('VITE_SUPABASE_ANON_KEY');

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
