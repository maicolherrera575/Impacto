/**
 * 🛡️ Proxy serverless de Gemini (Vercel Functions).
 *
 * La llave NUNCA se expone al navegador: vive en la variable de entorno
 * GEMINI_API_KEY (o VITE_GEMINI_API_KEY como respaldo) configurada en
 * Vercel → Settings → Environment Variables. El frontend llama a
 * /api/gemini con { model, payload } y este archivo reenvía la petición
 * a la API REST oficial con blindajes:
 *   - Solo POST.
 *   - Lista blanca de modelos (cero sorpresas de facturación).
 *   - Límite de tamaño del payload (evita abusos con imágenes gigantes).
 *   - Validación de la estructura mínima del payload de Gemini.
 *   - La respuesta de Google se reenvía tal cual (estado + JSON).
 */

const ALLOWED_MODELS = new Set(['gemini-2.5-flash', 'gemini-2.5-flash-lite']);

/** ~2.5 MB: sobrado para una oferta y miniaturas de comprobante de ~35 KB. */
const MAX_BODY_BYTES = 2_500_000;

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

interface VercelLikeRequest {
  method?: string;
  on(event: 'data', listener: (chunk: string) => void): void;
  on(event: 'end', listener: () => void): void;
  on(event: 'error', listener: (err: Error) => void): void;
}

interface VercelLikeResponse {
  status(code: number): VercelLikeResponse;
  json(body: unknown): void;
}

interface PayloadPart {
  text?: unknown;
  inlineData?: { mimeType?: unknown; data?: unknown };
}

interface GeminiPayload {
  contents?: { role?: unknown; parts?: PayloadPart[] }[];
  generationConfig?: Record<string, unknown>;
  systemInstruction?: unknown;
}

/** Lee el body crudo con tope de tamaño (destruye la conexión al excederlo). */
function readBody(req: VercelLikeRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    let data = '';
    req.on('data', (chunk: string) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        req.on('data', () => undefined); // drena el resto sin procesarlo
        reject(new Error('PAYLOAD_TOO_LARGE'));
        return;
      }
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', (err) => reject(err));
  });
}

/** Valida que el payload sea un request de Gemini razonable y seguro. */
function validPayload(raw: unknown): GeminiPayload | null {
  if (raw == null || typeof raw !== 'object') return null;
  const p = raw as GeminiPayload;
  if (!Array.isArray(p.contents) || p.contents.length === 0) return null;
  // Cada parte solo puede ser texto o imagen inline con data base64 acotada.
  for (const content of p.contents) {
    if (!Array.isArray(content.parts) || content.parts.length === 0) return null;
    for (const part of content.parts) {
      const hasText = typeof part.text === 'string';
      const hasImage =
        part.inlineData != null &&
        typeof part.inlineData === 'object' &&
        typeof part.inlineData.mimeType === 'string' &&
        typeof part.inlineData.data === 'string';
      if (!hasText && !hasImage) return null;
    }
  }
  return p;
}

export default async function handler(req: VercelLikeRequest, res: VercelLikeResponse): Promise<void> {
  // Solo POST: nada de GET (no filtra nada) ni otros métodos.
  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'Método no permitido' } });
    return;
  }

  // La llave solo existe del lado del servidor.
  const apiKey = (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    res.status(500).json({
      error: { message: 'El servidor no tiene la llave de IA. Configura GEMINI_API_KEY en Vercel → Environment Variables.' },
    });
    return;
  }

  let rawBody = '';
  try {
    rawBody = await readBody(req);
  } catch (err) {
    if (err instanceof Error && err.message === 'PAYLOAD_TOO_LARGE') {
      res.status(413).json({ error: { message: 'El archivo es demasiado grande. Intenta con una captura más liviana.' } });
    } else {
      res.status(400).json({ error: { message: 'No se pudo leer la petición' } });
    }
    return;
  }

  let parsed: { model?: unknown; payload?: unknown };
  try {
    parsed = JSON.parse(rawBody) as { model?: unknown; payload?: unknown };
  } catch {
    res.status(400).json({ error: { message: 'Petición inválida' } });
    return;
  }

  // Lista blanca de modelos: nadie puede pedir modelos caros a tu nombre.
  if (typeof parsed.model !== 'string' || !ALLOWED_MODELS.has(parsed.model)) {
    res.status(400).json({ error: { message: 'Modelo de IA no permitido' } });
    return;
  }

  const payload = validPayload(parsed.payload);
  if (!payload) {
    res.status(400).json({ error: { message: 'El contenido de la petición de IA no es válido' } });
    return;
  }

  try {
    const upstream = await fetch(`${GEMINI_BASE}/${parsed.model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json: unknown = await upstream.json().catch(() => ({ error: { message: 'Respuesta ilegible de la IA' } }));
    res.status(upstream.status).json(json);
  } catch {
    res.status(502).json({ error: { message: 'No se pudo contactar la IA en este momento. Intenta de nuevo.' } });
  }
}
