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
  'Por favor, activa la ubicación exacta para medir distancias reales.';

export const EXACT_GPS_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 15000,
};

/**
 * ⚖️ V25.0 · Geolocalización EXACTA, HARDWARE FORZADO y VOLUNTARIA (Ley 1581 de 2012):
 *  1. Usa estrictamente `{ enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }`.
 *  2. Soporta recalibración profunda vía `navigator.geolocation.watchPosition` por unos
 *     segundos para obligar al chip GPS a entregar la lectura más fresca sin caché.
 *  3. Rechaza lecturas aproximadas (`accuracy > 1500` m) con aviso toast sin bloquear modal.
 *  4. Mantiene las coordenadas exclusivamente en el estado efímero de React (jamás en BD).
 */
export function useGeolocation() {
  const [pos, setPos] = useState<LatLng | null>(null);
  const [status, setStatus] = useState<GeoStatus>('idle');
  const [locating, setLocating] = useState(false);
  const [recalibrating, setRecalibrating] = useState(false);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<number | null>(null);
  const [requestSeq, setRequestSeq] = useState(0);
  const watchIdRef = useRef<number | null>(null);
  const recalWatchRef = useRef<number | null>(null);
  const recalTimerRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (recalTimerRef.current != null) {
      window.clearTimeout(recalTimerRef.current);
      recalTimerRef.current = null;
    }
    if (recalWatchRef.current != null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(recalWatchRef.current);
      recalWatchRef.current = null;
    }
    if (watchIdRef.current != null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setRecalibrating(false);
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
      EXACT_GPS_OPTIONS,
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
          'Para calcular distancias, requerimos tu ubicación. Si la bloqueaste antes, toca el candado en la barra de direcciones para habilitarla.',
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
   * Carga inicial 100% pasiva (cero auto-invocación al entrar · Ley 1581).
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
      EXACT_GPS_OPTIONS,
    );

    setLocating(true);
    setErrorMessage(null);
    setErrorCode(null);
  }, [adoptFix, onError, startWatch]);

  /**
   * ↻ Recalibración forzada del hardware GPS (NO usa getCurrentPosition):
   * abre `navigator.geolocation.watchPosition` por 4.5s para descartar caché/Wi-Fi,
   * conserva la mejor lectura obtenida y luego detiene el watcher limpiamente.
   */
  const recalibrate = useCallback(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setStatus('denied');
      setErrorMessage('Este navegador no soporta geolocalización GPS.');
      return;
    }
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setStatus('denied');
      setErrorMessage('El navegador bloqueó el GPS porque la página no está bajo HTTPS seguro.');
      return;
    }

    stop();
    setRecalibrating(true);
    setErrorMessage(null);
    setErrorCode(null);

    let bestFix: GeolocationPosition | null = null;
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      if (recalTimerRef.current != null) {
        window.clearTimeout(recalTimerRef.current);
        recalTimerRef.current = null;
      }
      if (recalWatchRef.current != null) {
        navigator.geolocation.clearWatch(recalWatchRef.current);
        recalWatchRef.current = null;
      }
      setRecalibrating(false);

      if (bestFix) {
        adoptFix(bestFix);
        if (bestFix.coords.accuracy <= ACCURACY_LIMIT_M) {
          startWatch();
        }
      } else {
        setErrorMessage(
          'No se recibió señal fresca del chip GPS al recalibrar. Acércate a un espacio abierto e intenta de nuevo.',
        );
      }
    };

    recalWatchRef.current = navigator.geolocation.watchPosition(
      (p) => {
        if (!bestFix || p.coords.accuracy <= bestFix.coords.accuracy) {
          bestFix = p;
        }
        if (p.coords.accuracy <= ACCURACY_LIMIT_M) {
          setAccuracy(Math.round(p.coords.accuracy));
          setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
          setStatus('active');
        }
      },
      (err) => {
        if (err.code === 1) {
          settled = true;
          stop();
          onError(err);
        }
      },
      EXACT_GPS_OPTIONS,
    );

    recalTimerRef.current = window.setTimeout(finish, 4500);
  }, [adoptFix, onError, startWatch, stop]);

  /** Revoca el uso efímero del GPS (Ley 1581 de 2012). */
  const revoke = useCallback(() => {
    stop();
    setPos(null);
    setAccuracy(null);
    setStatus('idle');
    setLocating(false);
    setRecalibrating(false);
    setErrorMessage(null);
    setErrorCode(null);
  }, [stop]);

  useEffect(() => stop, [stop]);

  return {
    pos,
    status,
    locating,
    recalibrating,
    accuracy,
    errorMessage,
    errorCode,
    requestSeq,
    request,
    recalibrate,
    revoke,
    center: pos ?? GACHETA_CENTER,
  } as const;
}

export function centroDeMunicipio(nombre: string): LatLng {
  const m = municipioCenter(nombre);
  return { lat: m.lat, lng: m.lng };
}

export { MUNICIPIOS };
