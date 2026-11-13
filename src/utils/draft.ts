/**
 * Autoguardado de formularios en localStorage (cero pérdida de datos).
 * Si el usuario cierra la ventana por error, al volver todo sigue intacto.
 */

export function loadDraft<T>(key: string): Partial<T> | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Partial<T>) : null;
  } catch {
    return null;
  }
}

export function saveDraft(key: string, draft: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // Cuota llena (foto dataURL muy pesada): reintenta sin la foto.
    try {
      const obj = draft as Record<string, unknown>;
      if (obj && typeof obj === 'object' && 'customPhoto' in obj) {
        const { customPhoto: _omit, ...rest } = obj as { customPhoto?: unknown };
        localStorage.setItem(key, JSON.stringify(rest));
      }
    } catch {
      /* nada que hacer: se pierde solo el borrador, nunca el flujo */
    }
  }
}

export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignorar */
  }
}
