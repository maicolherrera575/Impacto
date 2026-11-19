import { supabase } from './supabase';
import type { Category, ClientPreferences } from '../types';
import { CATEGORIES } from '../types';

/**
 * 🛍️ V37.0 · Preferencias Ultra-Ligeras del Comprador (Zero-Bloat Supabase Free):
 *  - Almacenamiento local inmediato (<1.5 KB en localStorage) para invitados y usuarios.
 *  - Sincronización debounced hacia la columna JSONB `profiles.client_preferences`
 *    cuando hay sesión activa (0 tablas nuevas, 0 lecturas periódicas extra).
 *  - Topes estrictos: máx 5 categorías favoritas y máx 20 ofertas guardadas.
 */

const STORAGE_KEY = 'impulso:client_prefs_v1';
const VALID_CATS = new Set<string>(CATEGORIES.map((c) => c.id));
const MAX_CATEGORIES = 5;
const MAX_FAVORITES = 20;

export const DEFAULT_CLIENT_PREFS: ClientPreferences = {
  favoriteCategories: [],
  maxBudgetCop: null,
  favoriteOfferIds: [],
  updatedAt: 0,
};

export function sanitizeClientPreferences(raw: unknown): ClientPreferences {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_CLIENT_PREFS };
  const obj = raw as Record<string, unknown>;

  const cats = Array.isArray(obj.favoriteCategories)
    ? Array.from(
        new Set(
          obj.favoriteCategories.filter((c): c is Category => typeof c === 'string' && VALID_CATS.has(c)),
        ),
      ).slice(0, MAX_CATEGORIES)
    : [];

  const favs = Array.isArray(obj.favoriteOfferIds)
    ? Array.from(
        new Set(
          obj.favoriteOfferIds
            .filter((id): id is string => typeof id === 'string' && id.trim().length >= 8 && id.trim().length <= 64)
            .map((id) => id.trim()),
        ),
      ).slice(0, MAX_FAVORITES)
    : [];

  const rawBudget = typeof obj.maxBudgetCop === 'number' && Number.isFinite(obj.maxBudgetCop) ? Math.round(obj.maxBudgetCop) : null;
  const maxBudgetCop = rawBudget != null && rawBudget >= 2000 && rawBudget <= 50_000_000 ? rawBudget : null;

  const municipality =
    typeof obj.municipality === 'string' && obj.municipality.trim().length > 0
      ? obj.municipality.trim().slice(0, 40)
      : undefined;

  const updatedAt = typeof obj.updatedAt === 'number' && Number.isFinite(obj.updatedAt) ? obj.updatedAt : Date.now();

  return {
    favoriteCategories: cats,
    maxBudgetCop,
    favoriteOfferIds: favs,
    ...(municipality ? { municipality } : {}),
    updatedAt,
  };
}

export function loadLocalClientPreferences(): ClientPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CLIENT_PREFS };
    return sanitizeClientPreferences(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_CLIENT_PREFS };
  }
}

export function saveLocalClientPreferences(prefs: ClientPreferences): ClientPreferences {
  const clean = sanitizeClientPreferences({ ...prefs, updatedAt: Date.now() });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
  } catch {
    /* almacenamiento bloqueado */
  }
  return clean;
}

/** Fusiona preferencias locales y remotas priorizando el timestamp más reciente sin perder favoritos. */
export function mergeClientPreferences(
  local: ClientPreferences,
  remote: ClientPreferences | null | undefined,
): ClientPreferences {
  if (!remote) return local;
  const cleanRemote = sanitizeClientPreferences(remote);
  const newest = cleanRemote.updatedAt > local.updatedAt ? cleanRemote : local;
  const combinedFavs = Array.from(
    new Set([...newest.favoriteOfferIds, ...local.favoriteOfferIds, ...cleanRemote.favoriteOfferIds]),
  ).slice(0, MAX_FAVORITES);

  return sanitizeClientPreferences({
    ...newest,
    favoriteOfferIds: combinedFavs,
    updatedAt: Math.max(local.updatedAt, cleanRemote.updatedAt, Date.now()),
  });
}

let syncTimer: number | null = null;

/** Sincroniza preferencias compactas en Supabase con debounce de 1.2s (protege cuota gratuita). */
export function scheduleSyncClientPreferences(prefs: ClientPreferences, isAuthenticated: boolean): void {
  if (!isAuthenticated) return;
  if (syncTimer != null) window.clearTimeout(syncTimer);
  const clean = sanitizeClientPreferences(prefs);
  syncTimer = window.setTimeout(() => {
    void supabase
      .rpc('save_client_preferences_rpc', { p_preferences: clean })
      .then(() => undefined, () => undefined);
  }, 1200);
}

/** Guardado inmediato explícito (cuando el comprador pulsa "Guardar preferencias"). */
export async function persistClientPreferencesNow(
  prefs: ClientPreferences,
  isAuthenticated: boolean,
): Promise<ClientPreferences> {
  const clean = saveLocalClientPreferences(prefs);
  if (isAuthenticated) {
    try {
      await supabase.rpc('save_client_preferences_rpc', { p_preferences: clean });
    } catch {
      /* si el SQL V37 aún no corrió, el valor local ya quedó guardado sin romper UX */
    }
  }
  return clean;
}
