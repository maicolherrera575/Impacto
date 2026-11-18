import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * ⚡ V36.0 · Feed Público Cacheado en Edge CDN (Supervivencia Supabase Free Tier 1k–100k visitas).
 *
 * Sirve exclusivamente ofertas activas públicas (cero datos privados ni PII) con cabecera:
 *   `Cache-Control: public, s-maxage=30, stale-while-revalidate=120`
 * Así, aunque 10.000 personas abran Impulso en el mismo minuto, el Edge de Vercel absorbe
 * el tráfico y Supabase recibe solo ~2 consultas por minuto por municipio.
 */

type VercelRes = ServerResponse & {
  status?: (code: number) => VercelRes;
  json?: (body: unknown) => void;
};

const OFFER_PUBLIC_COLUMNS = [
  'id',
  'merchant_id',
  'category',
  'title',
  'description',
  'emoji_icon',
  'original_price',
  'promo_price',
  'total_quota',
  'available_quota',
  'municipality',
  'lat',
  'lng',
  'expires_at',
  'status',
  'views_count',
  'image_thumb',
  'delivery_type',
  'reports_count',
  'created_at',
  'merchant:merchant_id(id,business_name,is_verified,trust_level,lifetime_orders_count,is_active,is_suspended,category,whatsapp,municipality,logo_thumb,rating_sum,rating_count)',
].join(',');

function sendJson(res: VercelRes, statusCode: number, body: unknown, cacheHeader: string): void {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cacheHeader);
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

export default async function handler(req: IncomingMessage, res: VercelRes): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendJson(res, 405, { error: 'Método no permitido' }, 'no-store');
    return;
  }

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const anonKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
  if (!supabaseUrl || !anonKey) {
    sendJson(res, 500, { error: 'Configuración incompleta' }, 'no-store');
    return;
  }

  const urlObj = new URL(req.url || '/api/public-offers', 'https://tuimpulso.vercel.app');
  const municipality = (urlObj.searchParams.get('municipality') || '').trim().slice(0, 60);
  const limitRaw = Number(urlObj.searchParams.get('limit') || '80');
  const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(10, Math.round(limitRaw))) : 80;

  const params = new URLSearchParams({
    select: OFFER_PUBLIC_COLUMNS,
    status: 'eq.active',
    expires_at: `gt.${new Date().toISOString()}`,
    order: 'created_at.desc',
    limit: String(limit),
  });
  if (municipality) {
    params.set('municipality', `eq.${municipality}`);
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5_000);

  try {
    const upstream = await fetch(`${supabaseUrl}/rest/v1/offers?${params.toString()}`, {
      method: 'GET',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: 'application/json',
      },
      signal: ctrl.signal,
    });
    if (!upstream.ok) {
      sendJson(res, 502, { error: 'Error consultando ofertas públicas' }, 'no-store');
      return;
    }
    const rows = (await upstream.json().catch(() => [])) as Array<{
      merchant?: { is_active?: boolean; is_suspended?: boolean } | null;
    }>;
    const active = Array.isArray(rows)
      ? rows.filter((o) => o.merchant?.is_active !== false && o.merchant?.is_suspended !== true)
      : [];

    sendJson(
      res,
      200,
      { offers: active, cachedAt: new Date().toISOString() },
      'public, s-maxage=30, stale-while-revalidate=120',
    );
  } catch {
    sendJson(res, 504, { error: 'Timeout al consultar el feed público' }, 'no-store');
  } finally {
    clearTimeout(timer);
  }
}
