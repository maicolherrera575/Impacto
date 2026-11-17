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
 *  - idle:    esperando consentimiento explícito del usuario.
 *  - active:  señal EXACTA (accuracy ≤ 1000 m): usada solo en estado de React.
 *  - inexact: el navegador devolvió ubicación APROXIMADA (accuracy > 1000 m):
 *             se descarta y se advierte al usuario.
 *  - denied:  permiso bloqueado o GPS indisponible: fallback a Gachetá.
 */
export type GeoStatus = 'idle' | 'active' | 'inexact' | 'denied';

/** Límite máximo de radio de error permitido (en metros) para considerar la señal exacta. */
export const ACCURACY_LIMIT_M = 1500;

export const EXACT_GPS_WARNING =
  'Para calcular distancias reales, tu dispositivo debe permitir la ubicación exacta, no aproximada.';

export const EXACT_GPS_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 8000,
  maximumAge: 0,
};

/**
 * ⚖️ V20.0 · Geolocalización EXACTA y VOLUNTARIA (Ley 1581 de 2012):
 *  1. Invoca `navigator.geolocation.getCurrentPosition` directamente con
 *     `{ enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }`.
 *  2. Solo expone `errorCode === 1` cuando el permiso fue realmente denegado.
 *  3. Rechaza lecturas aproximadas (`accuracy > 1500` m) con aviso toast sin bloquear modal.
 *  4. Mantiene las coordenadas exclusivamente en el estado efímero de React (jamás en BD).
 */
export function useGeolocation() {
  const [pos, setPos] = useState<LatLng | null>(null);
  const [status, setStatus] = useState<GeoStatus>('idle');
  const [locating, setLocating] = useState(false);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<number | null>(null);
  const [requestSeq, setRequestSeq] = useState(0);
  const watchIdRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (watchIdRef.current != null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  /** Regla de oro: solo adoptamos lecturas con accuracy <= 1500 m. */
  const adoptFix = useCallback(
    (p: GeolocationPosition) => {
      setLocating(false);
      setErrorCode(null);
      const acc = Math.round(p.coords.accuracy);
      setAccuracy(acc);

      if (p.coords.accuracy > ACCURACY_LIMIT_M) {
        setPos(null);
        setStatus('inexact');
        setErrorMessage(EXACT_GPS_WARNING);
        setRequestSeq((n) => n + 1);
        stop();
        return;
      }

      setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
      setStatus('active');
      setErrorMessage(null);
    },
    [stop],
  );

  const startWatch = useCallback(() => {
    if (watchIdRef.current != null || typeof navigator === 'undefined' || !('geolocation' in navigator)) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (p) => {
        if (p.coords.accuracy <= ACCURACY_LIMIT_M) {
          setAccuracy(Math.round(p.coords.accuracy));
          setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
          setStatus('active');
          setErrorMessage(null);
          setErrorCode(null);
        }
      },
      (err) => {
        if (err.code === 1) {
          setStatus('denied');
          setErrorCode(1);
          setPos(null);
          stop();
        }
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 5_000 },
    );
  }, [stop]);

  const onError = useCallback(
    (err: GeolocationPositionError) => {
      setLocating(false);
      setErrorCode(err.code);
      if (err.code === 1) {
        setPos(null);
        setStatus('denied');
        setErrorMessage(
          'Permiso de ubicación denegado. Toca el candado 🔒 en la barra del navegador, activa "Ubicación" y selecciona "Ubicación exacta".',
        );
        stop();
      } else if (err.code === 2) {
        setErrorMessage(
          'No pudimos obtener señal GPS del dispositivo. Verifica que el GPS / Ubicación del celular esté encendido e intenta de nuevo.',
        );
      } else {
        setErrorMessage(
          'Tiempo de espera agotado buscando señal exacta. Verifica que el GPS esté activo y vuelve a intentarlo.',
        );
      }
      setRequestSeq((n) => n + 1);
    },
    [stop],
  );

  /**
   * Invoca directamente `navigator.geolocation.getCurrentPosition` dentro del
   * gesto del usuario para disparar la alerta nativa del navegador sin fricción.
   */
  const request = useCallback(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setStatus('denied');
      setErrorCode(null);
      setErrorMessage('Este navegador no soporta geolocalización GPS.');
      setRequestSeq((n) => n + 1);
      return;
    }
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setStatus('denied');
      setErrorCode(null);
      setErrorMessage('El navegador bloqueó el GPS porque la página no está bajo HTTPS seguro.');
      setRequestSeq((n) => n + 1);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (p) => {
        adoptFix(p);
        if (p.coords.accuracy <= ACCURACY_LIMIT_M) {
          startWatch();
        }
      },
      onError,
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );

    setLocating(true);
    setErrorMessage(null);
    setErrorCode(null);
    try {
      localStorage.setItem('impulso_gps_consent', 'granted');
    } catch {
      /* sin almacenamiento */
    }
  }, [adoptFix, onError, startWatch]);

  /** Revoca el uso efímero del GPS (Ley 1581 de 2012). */
  const revoke = useCallback(() => {
    stop();
    setPos(null);
    setAccuracy(null);
    setStatus('idle');
    setLocating(false);
    setErrorMessage(null);
    setErrorCode(null);
    try {
      localStorage.setItem('impulso_gps_consent', 'denied');
    } catch {
      /* sin almacenamiento */
    }
  }, [stop]);

  useEffect(() => {
    try {
      if (localStorage.getItem('impulso_gps_consent') === 'granted') {
        request();
      }
    } catch {
      /* sin almacenamiento */
    }
    return stop;
  }, [request, stop]);

  return {
    pos,
    status,
    locating,
    accuracy,
    errorMessage,
    errorCode,
    requestSeq,
    request,
    revoke,
    center: pos ?? GACHETA_CENTER,
  } as const;
}

export function centroDeMunicipio(nombre: string): LatLng {
  const m = municipioCenter(nombre);
  return { lat: m.lat, lng: m.lng };
}

export { MUNICIPIOS };
