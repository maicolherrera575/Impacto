/**
 * 🛡️ V19.0 · Servicio de IP Real Forense (/api/ip).
 * Consulta el endpoint serverless que prioriza el primer valor de
 * `X-Forwarded-For` sobre `x-real-ip` y `cf-connecting-ip` para capturar
 * la IP pública real del usuario (y no la del último nodo proxy).
 */

interface IpCache {
  ip: string;
  fetchedAt: number;
}

let cachedIp: IpCache | null = null;
const IP_TTL_MS = 120_000;

export async function getEdgeClientIp(): Promise<string | null> {
  if (cachedIp && Date.now() - cachedIp.fetchedAt < IP_TTL_MS) {
    return cachedIp.ip;
  }
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? window.setTimeout(() => ctrl.abort(), 1400) : null;
  try {
    const res = await fetch('/api/ip', {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: ctrl?.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json().catch(() => null)) as { ip?: unknown } | null;
    const ip = typeof json?.ip === 'string' ? json.ip.trim() : '';
    if (!ip || ip === '0.0.0.0' || ip === '127.0.0.1' || ip === '::1') return null;
    cachedIp = { ip, fetchedAt: Date.now() };
    return ip;
  } catch {
    return null;
  } finally {
    if (timer != null) window.clearTimeout(timer);
  }
}
