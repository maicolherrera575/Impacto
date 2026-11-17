/**
 * 🪪 V20 · Huella SHA-256 en el navegador (Web Crypto API nativa).
 * Se usa para el blindaje KYB: el documento y la foto se auditan junto con
 * su huella, y la misma imagen nunca puede "re-usarse" en otra cuenta.
 */
export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
