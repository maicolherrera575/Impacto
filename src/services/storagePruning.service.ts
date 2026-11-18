import { supabase } from './supabase';

/**
 * 🧹 V33.0 · Poda lógica y física de Supabase Storage:
 * Detecta cualquier URL perteneciente a Supabase Storage y elimina los objetos
 * huérfanos cuando una oferta se borra, expira o es cancelada por reportes.
 */

interface StorageRef {
  bucket: string;
  path: string;
}

export function extractSupabaseStorageRef(url: string | null | undefined): StorageRef | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith('data:')) return null;

  const match = /\/storage\/v1\/object\/(?:public|authenticated|sign)\/([^/?#]+)\/([^?#]+)/i.exec(trimmed);
  if (!match) return null;

  return {
    bucket: decodeURIComponent(match[1]),
    path: decodeURIComponent(match[2]),
  };
}

export async function pruneStorageUrls(urls: Array<string | null | undefined>): Promise<number> {
  const byBucket = new Map<string, string[]>();
  for (const url of urls) {
    const ref = extractSupabaseStorageRef(url);
    if (!ref) continue;
    const list = byBucket.get(ref.bucket) ?? [];
    if (!list.includes(ref.path)) list.push(ref.path);
    byBucket.set(ref.bucket, list);
  }

  if (byBucket.size === 0) return 0;

  let removed = 0;
  for (const [bucket, paths] of byBucket.entries()) {
    try {
      const { error } = await supabase.storage.from(bucket).remove(paths);
      if (!error) removed += paths.length;
    } catch {
      /* limpieza best-effort: no bloquea la UX si el bucket no existe */
    }
  }
  return removed;
}
