import { useState } from 'react';
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

export type GeoStatus = 'idle' | 'active' | 'denied';

/**
 * Geolocalización con fallback automático y cero fricción:
 * si el usuario rechaza o ignora el permiso, la app jamás se bloquea —
 * se centra en el Parque Principal de Gachetá.
 */
export function useGeolocation() {
  const [pos, setPos] = useState<LatLng | null>(null);
  const [status, setStatus] = useState<GeoStatus>('idle');

  function request(): void {
    if (!('geolocation' in navigator)) {
      setStatus('denied');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
        setStatus('active');
      },
      () => setStatus('denied'),
      { enableHighAccuracy: true, timeout: 8_000, maximumAge: 30_000 }
    );
  }

  return { pos, status, request, center: pos ?? GACHETA_CENTER } as const;
}

export function centroDeMunicipio(nombre: string): LatLng {
  const m = municipioCenter(nombre);
  return { lat: m.lat, lng: m.lng };
}

export { MUNICIPIOS };
