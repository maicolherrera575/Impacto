/**
 * Motor de fotos ultraligeras — compresión extrema 100% en el navegador.
 * Convierte cualquier foto (típicamente 2-6 MB del celular) en un WebP
 * micro de 12-20 KB usando <canvas> nativo. Sin Supabase Storage, sin
 * costos: la foto vive en la propia fila de la base de datos y se libera
 * automáticamente cuando la oferta se purga.
 */

const TARGET_MAX_CHARS = 28000; // ~20 KB de base64
const FLOOR_CHARS = 16000; // ~12 KB: por debajo ya pierde nitidez

function formatKB(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

/**
 * Comprime una imagen a WebP micro. Si el navegador no soporta WebP,
 * cae con elegancia a JPEG de calidad reducida.
 */
export async function compressImageToMicroWebP(
  file: File,
  maxWidth = 420,
  quality = 0.62
): Promise<string> {
  // Carga la imagen en un elemento <img>
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

  // Dimensiones proporcionales (retrato o paisaje)
  const ratio = Math.min(1, maxWidth / img.naturalWidth, maxWidth / img.naturalHeight);
  const width = Math.max(80, Math.round(img.naturalWidth * ratio));
  const height = Math.max(80, Math.round(img.naturalHeight * ratio));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Tu navegador no permite optimizar fotos. Publica sin foto.');
  ctx.drawImage(img, 0, 0, width, height);

  // Itera bajando calidad hasta garantizar el peso objetivo
  let dataUrl = canvas.toDataURL('image/webp', quality);
  if (dataUrl.startsWith('data:image/webp') === false) {
    // Navegador sin WebP: JPEG de respaldo
    dataUrl = canvas.toDataURL('image/jpeg', Math.max(0.5, quality - 0.1));
  }

  let q = quality;
  while (dataUrl.length > TARGET_MAX_CHARS && q > 0.3) {
    q = Math.max(0.3, q - 0.08);
    dataUrl = canvas.toDataURL(dataUrl.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg', q);
  }

  // Última instancia: baja la resolución 25% y reintenta
  if (dataUrl.length > TARGET_MAX_CHARS) {
    canvas.width = Math.round(width * 0.75);
    canvas.height = Math.round(height * 0.75);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    dataUrl = canvas.toDataURL(dataUrl.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg', 0.5);
  }

  if (dataUrl.length > 35000) {
    throw new Error('La foto quedó muy pesada. Prueba con una imagen más simple.');
  }

  // Aviso amable si quedó demasiado comprimida (nitidez justa)
  if (dataUrl.length < FLOOR_CHARS) {
    console.info('[Impulso] Foto comprimida por debajo del piso ideal (12 KB): se acepta igual.');
  }

  return dataUrl;
}

/** Texto comparativo amigable para el toast del comerciante. */
export function compressionSummary(original: File, optimizedDataUrl: string): string {
  const optimizedBytes = Math.round(optimizedDataUrl.length * 0.75); // base64 → bytes aprox.
  return `📸 Foto optimizada: de ${formatKB(original.size)} a ${formatKB(optimizedBytes)} ✨`;
}
