/**
 * Motor de fotos ultraligeras — compresión agresiva 100% en el navegador (V33).
 * Redimensiona CUALQUIER imagen a un máximo de 800px por lado y exporta en
 * `image/webp` (calidad 0.6–0.7), garantizando archivos finales ≤ 50–80 KB para
 * proteger al máximo los límites gratuitos de Supabase (DB + Storage).
 */

const HARD_MAX_EDGE_PX = 800;
const DEFAULT_MAX_BYTES = 75 * 1024; // 75 KB tope estricto (< 80 KB)
const MICRO_MAX_BYTES = 24 * 1024; // ~24 KB para miniaturas embebidas en fila
const FLOOR_BYTES = 10 * 1024;

function formatKB(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function clampQuality(q: number): number {
  return Math.min(0.7, Math.max(0.6, q));
}

function canvasToBlobAsync(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (typeof canvas.toBlob !== 'function') {
      resolve(null);
      return;
    }
    canvas.toBlob((blob) => resolve(blob), mime, quality);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('No se pudo leer el archivo WebP comprimido.'));
    reader.readAsDataURL(blob);
  });
}

export interface WebPCompressionResult {
  blob: Blob | null;
  dataUrl: string;
  sizeBytes: number;
}

/**
 * Redimensiona una imagen usando `<canvas>` oculto (máx. 800px) y la exporta
 * en WebP (calidad 0.6–0.7) garantizando peso final ≤ `maxBytes` (por defecto 75 KB).
 */
export async function compressImageToWebPBlob(
  file: File,
  options?: { maxWidth?: number; quality?: number; maxBytes?: number },
): Promise<WebPCompressionResult> {
  const targetEdge = Math.min(HARD_MAX_EDGE_PX, Math.max(80, options?.maxWidth ?? HARD_MAX_EDGE_PX));
  const maxBytes = Math.min(DEFAULT_MAX_BYTES, Math.max(12 * 1024, options?.maxBytes ?? DEFAULT_MAX_BYTES));
  const initialQuality = clampQuality(options?.quality ?? 0.65);

  const url = URL.createObjectURL(file);
  let img: HTMLImageElement;
  try {
    img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('No se pudo leer la imagen. Intenta con otra foto.'));
      el.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }

  const ratio = Math.min(1, targetEdge / img.naturalWidth, targetEdge / img.naturalHeight);
  let width = Math.max(80, Math.round(img.naturalWidth * ratio));
  let height = Math.max(80, Math.round(img.naturalHeight * ratio));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Tu navegador no permite optimizar fotos. Publica sin foto.');
  ctx.drawImage(img, 0, 0, width, height);

  const encode = async (q: number): Promise<WebPCompressionResult> => {
    const blob = await canvasToBlobAsync(canvas, 'image/webp', q);
    if (blob && blob.type === 'image/webp') {
      const dataUrl = await blobToDataUrl(blob);
      return { blob, dataUrl, sizeBytes: blob.size };
    }
    let dataUrl = canvas.toDataURL('image/webp', q);
    if (!dataUrl.startsWith('data:image/webp')) {
      dataUrl = canvas.toDataURL('image/jpeg', Math.max(0.5, q - 0.08));
    }
    const approxBytes = Math.round(dataUrl.length * 0.75);
    return { blob, dataUrl, sizeBytes: approxBytes };
  };

  let q = initialQuality;
  let result = await encode(q);

  while (result.sizeBytes > maxBytes && q > 0.32) {
    q = Math.max(0.32, Number((q - 0.08).toFixed(2)));
    result = await encode(q);
  }

  // Si aún excede maxBytes, reduce resolución en pasos hasta cumplir el tope estricto (<= 80 KB)
  for (let shrink = 0; shrink < 3 && result.sizeBytes > maxBytes; shrink += 1) {
    width = Math.max(80, Math.round(width * 0.78));
    height = Math.max(80, Math.round(height * 0.78));
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(img, 0, 0, width, height);
    result = await encode(Math.min(0.6, q));
  }

  if (result.sizeBytes > 80 * 1024) {
    throw new Error('La foto quedó muy pesada incluso tras optimizarla. Prueba con una imagen más simple.');
  }

  if (result.sizeBytes < FLOOR_BYTES) {
    console.info('[Impulso] Foto comprimida ultra liviana (<10 KB): optimización máxima aplicada.');
  }

  return result;
}

/**
 * Comprime cualquier imagen a WebP optimizado (máx 800px, calidad 0.6–0.7).
 * Devuelve el dataURL listo para Supabase / preview.
 */
export async function compressImageToMicroWebP(
  file: File,
  maxWidth = HARD_MAX_EDGE_PX,
  quality = 0.65,
  maxBytes = MICRO_MAX_BYTES,
): Promise<string> {
  const { dataUrl } = await compressImageToWebPBlob(file, {
    maxWidth: Math.min(HARD_MAX_EDGE_PX, maxWidth),
    quality,
    maxBytes: maxWidth >= 700 ? Math.max(maxBytes, 68 * 1024) : maxBytes,
  });
  return dataUrl;
}

/**
 * 💳 Optimiza el QR oficial del administrador (Nequi / Daviplata PNG o JPG)
 * manteniendo bordes afilados sobre fondo blanco puro para escaneo bancario 100% confiable.
 */
export async function prepareCrispQrImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  let img: HTMLImageElement;
  try {
    img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('No se pudo leer la imagen del QR. Prueba con PNG o JPG.'));
      el.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }

  const maxDim = 600;
  const ratio = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(120, Math.round(img.naturalWidth * ratio));
  const height = Math.max(120, Math.round(img.naturalHeight * ratio));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Tu navegador no permite procesar la imagen del QR.');

  // Fondo blanco puro detrás de PNGs transparentes de Nequi/Daviplata
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, width, height);

  const SAFE_DB_CHARS = 34000;
  let dataUrl = canvas.toDataURL('image/png');
  if (dataUrl.length <= SAFE_DB_CHARS) return dataUrl;

  for (const q of [0.94, 0.88, 0.8, 0.72]) {
    const candidate = canvas.toDataURL('image/webp', q);
    if (candidate.startsWith('data:image/webp') && candidate.length <= SAFE_DB_CHARS) {
      return candidate;
    }
    const jpgCandidate = canvas.toDataURL('image/jpeg', q);
    if (jpgCandidate.length <= SAFE_DB_CHARS) {
      return jpgCandidate;
    }
  }

  canvas.width = Math.round(width * 0.78);
  canvas.height = Math.round(height * 0.78);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  dataUrl = canvas.toDataURL('image/webp', 0.78);
  if (!dataUrl.startsWith('data:image/webp') || dataUrl.length > SAFE_DB_CHARS) {
    dataUrl = canvas.toDataURL('image/jpeg', 0.76);
  }
  return dataUrl;
}

/** Texto comparativo amigable para el toast del comerciante. */
export function compressionSummary(original: File, optimizedDataUrl: string): string {
  const optimizedBytes = Math.round(optimizedDataUrl.length * 0.75); // base64 → bytes aprox.
  return `📸 Foto optimizada: de ${formatKB(original.size)} a ${formatKB(optimizedBytes)} ✨`;
}
