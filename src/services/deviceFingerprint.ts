/**
 * Huella única del dispositivo (sin cuenta, sin fricción).
 * Genera un identificador anónimo persistente en localStorage combinando
 * un UUID con un hash corto de características del navegador. Viaja en
 * cada apartado y pedido para la trazabilidad forense del lado servidor.
 */

const DEVICE_KEY = 'impulso_device_id';

/** Hash corto no-criptográfico (suficiente para desambiguar dispositivos). */
function shortHash(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

function buildFingerprint(): string {
  const parts = [
    navigator.userAgent,
    `${screen.width}x${screen.height}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'tz-unknown',
    String(navigator.language ?? ''),
  ];
  return shortHash(parts.join('|'));
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Devuelve el identificador estable del dispositivo: `uuid-hash`.
 * Se crea una sola vez y persiste aunque el usuario cierre la app.
 */
export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
  } catch {
    /* localStorage bloqueado: generamos uno efímero */
  }

  const id = `${randomId()}-${buildFingerprint()}`;
  try {
    localStorage.setItem(DEVICE_KEY, id);
  } catch {
    /* sin persistencia: el id de esta sesión se usa igual */
  }
  return id;
}
