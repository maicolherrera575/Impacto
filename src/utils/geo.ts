import { useCallback, useEffect, useRef, useState } from 'react';
import { MUNICIPIOS, municipioCenter } from '../types';

/** Coordenadas por defecto: Parque Principal de Gachetá. */
export const GACHETA_CENTER = { lat: 4.8167, lng: -73.6333 } as const;

export interface LatLng {
  lat: number;
  lng: number;
}

/** Distancia real en metros (fórmula de Haversine). */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Distancia legible: "A 200 m" / "A 1.2 km". */
export function distanceText(meters: number): string {
  if (meters < 1000) return `📍 A ${Math.round(meters)} m`;
  return `📍 A ${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

/**
 * Estados del GPS:
 *  - idle:      pidiendo permiso / esperando la primera señal exacta.
 *  - active:    señal EXACTA (precisión ≤ 200 m): la app la usa con confianza.
 *  - inexact:   el navegador solo dio ubicación APROXIMADA (> 200 m):
 *               no la adoptamos — un pin equivocado arruina el radar —
 *               y seguimos escuchando por si mejora a exacta.
 *  - denied:    permiso negado o GPS apagado: fallback a Gachetá sin bloquear.
 */
export type GeoStatus = 'idle' | 'active' | 'inexact' | 'denied';

/** Precisión mínima (en metros) para considerar la ubicación EXACTA. */
const ACCURACY_LIMIT_M = 200;

/**
 * Geolocalización con modo Google Maps:
 *  1. La app PIDE la ubicación al arrancar (auto-GPS, cero clics).
 *  2. El punto azul se actualiza EN VIVO con watchPosition (como el mapa
 *     de Google: caminas y el punto te sigue).
 *  3. Si el usuario niega o falla, la app JAMÁS se bloquea: se centra en
 *     el Parque Principal de Gachetá y puede reintentar desde el mapa
 *     o desde la barra superior.
 */
export function useGeolocation() {
  const [pos, setPos] = useState<LatLng | null>(null);
  const [status, setStatus] = useState<GeoStatus>('idle');
  const watchIdRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (watchIdRef.current != null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  /** Activa el rastreo en vivo (idempotente: si ya corre, no lo duplica). */
  const request = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setStatus('denied');
      return;
    }
    if (watchIdRef.current != null) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (p) => {
        // Regla de oro: SOLO ubicación exacta. Si el navegador concede
        // "aproximada", la descartamos (no mueve el punto azul ni ordena
        // distancias) y mantenemos el watch por si llega una exacta.
        if (p.coords.accuracy > ACCURACY_LIMIT_M) {
          setStatus('inexact');
          return;
        }
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
        setStatus('active');
      },
      () => {
        // Permiso negado, timeout o GPS apagado: fallback al casco urbano
        // sin bloquear nada; el vecino puede reintentar cuando quiera.
        setStatus('denied');
        stop();
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 }
    );
  }, [stop]);

  // ── Auto-GPS: la primera acción de la app es pedir la ubicación ──────────
  useEffect(() => {
    request();
    return stop;
  }, [request, stop]);

  return { pos, status, request, center: pos ?? GACHETA_CENTER } as const;
}

export function centroDeMunicipio(nombre: string): LatLng {
  const m = municipioCenter(nombre);
  return { lat: m.lat, lng: m.lng };
}

export { MUNICIPIOS };
