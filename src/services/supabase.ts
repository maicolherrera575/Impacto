import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/env';

/**
 * Cliente único de Supabase para toda la plataforma.
 * La llave pública está protegida por Row Level Security: el anonkey
 * jamás puede modificar créditos, inventarios ni perfiles directamente.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Al abrir el enlace de confirmación del correo, la app recoge la
    // sesión automáticamente y el usuario queda dentro sin re-loguearse.
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
  realtime: {
    params: { eventsPerSecond: 8 },
  },
});

/**
 * Traduce errores crudos de la base de datos a mensajes claros,
 * cálidos y accionables para el usuario final.
 */
type Replacement = string | ((match: RegExpMatchArray) => string);

const ERROR_MAP: Array<[RegExp, Replacement]> = [
  [/NO_CREDITS[:\s]*/i, 'No tienes créditos disponibles. Recarga con el administrador 💚'],
  [/SOLO_QUEDAN\s*(\d+)/i, (m) => `¡Fue rápido! Solo quedan ${m[1]} unidades`],
  [/SOLO_ADMIN/i, 'Acción exclusiva del administrador'],
  [/CUENTA_SUSPENDIDA/i, 'Tu cuenta está suspendida temporalmente. Escribe al administrador 🛡️'],
  [/Failed to fetch|NetworkError|network/i, 'Sin conexión. Verifica tu internet e intenta de nuevo.'],
  [/Invalid login credentials/i, 'Correo o contraseña incorrectos'],
  [/User already registered|already been registered/i, 'Este correo ya está registrado. Inicia sesión.'],
  [/Password should be at least/i, 'La contraseña debe tener al menos 6 caracteres'],
  [/Email not confirmed/i, 'Confirma tu correo con el enlace que te enviamos'],
  [/JWT|token/i, 'Tu sesión expiró. Vuelve a iniciar sesión.'],
  [/row-level security|permission denied/i, 'No tienes permiso para esta acción'],
  [/duplicate key/i, 'Este registro ya existe'],
];

export function friendlyError(err: unknown): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : // Errores de PostgREST/Supabase: objetos planos con .message
          (err !== null && typeof err === 'object' && typeof (err as { message?: unknown }).message === 'string'
            ? (err as { message: string }).message
            : 'Algo salió mal. Intenta de nuevo.');

  for (const [pattern, replacement] of ERROR_MAP) {
    const match = raw.match(pattern);
    if (match) {
      return typeof replacement === 'function' ? replacement(match) : replacement;
    }
  }

  // Mensajes de excepción de PL/pgSQL: quedan con contexto útil tras el ":"
  const colon = raw.indexOf(': ');
  const clean = colon > 0 ? raw.slice(colon + 2) : raw;
  return clean.length > 160 ? `${clean.slice(0, 157)}…` : clean;
}
