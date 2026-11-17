import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * 🛡️ V19.0 · Captura forense de la IP pública real del cliente.
 *
 * Lee las cabeceras de proxy en orden estricto de prioridad:
 *   1. Primer valor válido de `X-Forwarded-For` (IP original del dispositivo, no del último proxy)
 *   2. `x-real-ip`
 *   3. `cf-connecting-ip`
 *   4. `x-vercel-forwarded-for` / `true-client-ip` / `socket.remoteAddress`
 */

function firstHeader(headers: IncomingMessage['headers'], name: string): string {
  const val = headers[name.toLowerCase()];
  if (Array.isArray(val)) return val[0] ?? '';
  return typeof val === 'string' ? val : '';
}

function normalizeIp(raw: string): string {
  return raw.trim().replace(/^::ffff:/i, '');
}

function isValidIp(ip: string): boolean {
  if (!ip || ip.toLowerCase() === 'unknown' || ip.length > 45) return false;
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) || /^[0-9a-fA-F:]+$/.test(ip);
}

function isPrivateOrLoopback(ip: string): boolean {
  return (
    ip === '0.0.0.0' ||
    ip === '127.0.0.1' ||
    ip === '::1' ||
    /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(ip) ||
    /^(fc|fd|fe80)/i.test(ip)
  );
}

export function extractClientIp(req: IncomingMessage): { ip: string; source: string } {
  const xffRaw = firstHeader(req.headers, 'x-forwarded-for');
  if (xffRaw) {
    const candidates = xffRaw
      .split(',')
      .map((part) => normalizeIp(part))
      .filter((ip) => isValidIp(ip));

    // Prioriza siempre el primer valor público de X-Forwarded-For
    const firstPublic = candidates.find((ip) => !isPrivateOrLoopback(ip));
    if (firstPublic) return { ip: firstPublic, source: 'x-forwarded-for' };
    if (candidates[0]) return { ip: candidates[0], source: 'x-forwarded-for' };
  }

  const fallbacks: Array<[string, string]> = [
    ['x-real-ip', firstHeader(req.headers, 'x-real-ip')],
    ['cf-connecting-ip', firstHeader(req.headers, 'cf-connecting-ip')],
    ['x-vercel-forwarded-for', firstHeader(req.headers, 'x-vercel-forwarded-for')],
    ['true-client-ip', firstHeader(req.headers, 'true-client-ip')],
  ];

  for (const [name, raw] of fallbacks) {
    const ip = normalizeIp(raw.split(',')[0] ?? '');
    if (isValidIp(ip)) return { ip, source: name };
  }

  const remote = normalizeIp(req.socket?.remoteAddress ?? '');
  if (isValidIp(remote)) return { ip: remote, source: 'socket' };

  return { ip: '0.0.0.0', source: 'none' };
}

type VercelRes = ServerResponse & {
  status?: (code: number) => VercelRes;
  json?: (body: unknown) => void;
};

function sendJson(res: VercelRes, statusCode: number, body: unknown): void {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    const next = res.status(statusCode);
    if (typeof next.json === 'function') {
      next.json(body);
      return;
    }
  }
  res.statusCode = statusCode;
  res.end(JSON.stringify(body));
}

export default function handler(req: IncomingMessage, res: VercelRes): void {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendJson(res, 405, { error: 'Método no permitido' });
    return;
  }

  const { ip, source } = extractClientIp(req);
  const city = decodeURIComponent(firstHeader(req.headers, 'x-vercel-ip-city') || '');
  const region = decodeURIComponent(firstHeader(req.headers, 'x-vercel-ip-country-region') || '');
  const country = firstHeader(req.headers, 'x-vercel-ip-country') || '';

  sendJson(res, 200, {
    ip,
    source,
    ...(city || region || country ? { geo: { city, region, country } } : {}),
  });
}
