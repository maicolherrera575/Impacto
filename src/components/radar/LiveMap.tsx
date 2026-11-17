import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import { AlertTriangle, Loader2, LocateFixed } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import type { Offer } from '../../types';
import { formatCOP } from '../../utils/format';
import { EXACT_GPS_OPTIONS, EXACT_GPS_WARNING, ACCURACY_LIMIT_M, haversineMeters } from '../../utils/geo';
import type { GeoStatus, LatLng } from '../../utils/geo';
import { useToast } from '../ui/Toast';

/** Tiles libres de OpenStreetMap — sin llaves ni costos, con estilo oscuro vía CSS. */
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Pines personalizados: emoji + precio flotante en tiempo real. */
function buildPinIcon(offer: Offer): L.DivIcon {
  const html = `
    <div class="imp-pin">
      <div class="imp-pin-bubble" role="img" aria-label="${offer.emoji_icon}">${offer.emoji_icon}</div>
      <div class="imp-pin-price">${formatCOP(offer.promo_price)}</div>
      <div class="imp-pin-tip"></div>
    </div>`;
  return L.divIcon({
    className: 'imp-pin-marker',
    html,
    iconSize: [44, 68],
    iconAnchor: [22, 66],
  });
}

const PIN_ICON_CACHE = new Map<string, L.DivIcon>();

function pinIconFor(offer: Offer): L.DivIcon {
  const key = `${offer.id}|${offer.promo_price}`;
  const cached = PIN_ICON_CACHE.get(key);
  if (cached) return cached;
  const icon = buildPinIcon(offer);
  if (PIN_ICON_CACHE.size > 400) PIN_ICON_CACHE.clear();
  PIN_ICON_CACHE.set(key, icon);
  return icon;
}

/** Punto azul "estás aquí": ubicación exacta del usuario en el radar. */
const YOU_ARE_HERE_ICON: L.DivIcon = L.divIcon({
  className: 'imp-you-marker',
  html: '<div class="imp-you-halo"></div><div class="imp-you-dot"></div><div class="imp-you-label">📍 Estás aquí</div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

interface MapControllerProps {
  center: LatLng;
  zoom: number;
  geoPos: LatLng | null;
  geoStatus: GeoStatus;
  locating: boolean;
  onLocateClick: () => void;
  recenterToken: number;
}

function MapController({
  center,
  zoom,
  geoPos,
  geoStatus,
  locating,
  onLocateClick,
  recenterToken,
}: MapControllerProps) {
  const map = useMap();
  const followingRef = useRef(true);
  const lastCenterRef = useRef<LatLng | null>(null);
  const lastTokenRef = useRef(recenterToken);
  const hadGeoRef = useRef(false);

  useEffect(() => {
    const onDragStart = () => {
      followingRef.current = false;
    };
    map.on('dragstart', onDragStart);
    return () => {
      map.off('dragstart', onDragStart);
    };
  }, [map]);

  useEffect(() => {
    // Al obtener la primera lectura GPS exacta, forzamos vuelo inmediato al punto azul
    if (!hadGeoRef.current && geoPos != null) {
      hadGeoRef.current = true;
      followingRef.current = true;
      lastCenterRef.current = geoPos;
      map.flyTo([geoPos.lat, geoPos.lng], Math.max(map.getZoom(), 16), { animate: true, duration: 0.7 });
      return;
    }
    if (geoPos == null) {
      hadGeoRef.current = false;
    }

    if (recenterToken !== lastTokenRef.current) {
      lastTokenRef.current = recenterToken;
      followingRef.current = true;
      lastCenterRef.current = null;
    }

    if (!followingRef.current) {
      lastCenterRef.current = center;
      return;
    }

    const last = lastCenterRef.current;
    if (last) {
      const moved = haversineMeters(last, center);
      if (moved < 20) return;
      if (moved < 800) {
        map.panTo([center.lat, center.lng], { animate: true, duration: 0.5 });
        lastCenterRef.current = center;
        return;
      }
    }

    map.setView([center.lat, center.lng], geoPos ? Math.max(zoom, 16) : zoom, { animate: true });
    lastCenterRef.current = center;
  }, [map, center.lat, center.lng, zoom, geoPos, recenterToken]);

  const geoActive = geoStatus === 'active' && geoPos != null;

  function handleTarget() {
    if (geoPos) {
      followingRef.current = true;
      lastCenterRef.current = geoPos;
      map.flyTo([geoPos.lat, geoPos.lng], Math.max(map.getZoom(), 16), { animate: true, duration: 0.6 });
    } else {
      onLocateClick();
    }
  }

  return (
    <button
      type="button"
      onClick={handleTarget}
      disabled={locating}
      title={
        locating
          ? 'Buscando tu ubicación exacta…'
          : geoActive
            ? 'Punto azul activo: centrar en mi ubicación exacta'
            : geoStatus === 'inexact'
              ? 'Señal aproximada detectada: toca para pedir ubicación exacta'
              : '📍 Encontrar ofertas exactas cerca de mí'
      }
      aria-label="Centrar en mi ubicación exacta"
      className={
        geoActive
          ? 'pressable absolute right-3 top-3 z-20 grid h-11 w-11 place-items-center rounded-full border border-blue-400/60 bg-blue-500 text-white shadow-[0_6px_18px_rgba(2,6,23,0.55)] transition hover:brightness-110'
          : geoStatus === 'inexact'
            ? 'pressable absolute right-3 top-3 z-20 grid h-11 w-11 place-items-center rounded-full border border-amber-400/60 bg-amber-500 text-slate-950 shadow-[0_6px_18px_rgba(2,6,23,0.55)] transition hover:brightness-110'
            : 'pressable absolute right-3 top-3 z-20 grid h-11 w-11 place-items-center rounded-full border border-impulso-emerald/50 bg-impulso-panel text-impulso-mint shadow-[0_6px_18px_rgba(2,6,23,0.55)] transition hover:bg-impulso-emerald hover:text-slate-950'
      }
    >
      {locating ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <LocateFixed className={geoActive ? 'h-5 w-5 animate-pulse-soft' : 'h-5 w-5'} />
      )}
    </button>
  );
}

interface LiveMapProps {
  offers: Offer[];
  center: LatLng;
  geoPos?: LatLng | null;
  zoom?: number;
  onSelect: (offer: Offer) => void;
  /** Reintenta el permiso de ubicación exacta (botón 🎯 del mapa). */
  onGeoRequest?: () => void;
  geoStatus?: GeoStatus;
  locating?: boolean;
  /** Token externo para forzar recentrado (ej: cambio de municipio). */
  recenterToken?: number;
}

/**
 * Mapa interactivo con activación explícita de GPS exacto (Ley 1581 de 2012):
 * solicita `{ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }` y
 * rechaza ubicaciones aproximadas (`accuracy > 1000 m`), conservando las
 * coordenadas únicamente en el estado efímero de React.
 */
export function LiveMap({
  offers,
  center,
  geoPos: externalGeoPos,
  zoom = 15,
  onSelect,
  onGeoRequest,
  geoStatus: externalGeoStatus = 'idle',
  locating: externalLocating = false,
  recenterToken = 0,
}: LiveMapProps) {
  const toast = useToast();
  const [localGeoPos, setLocalGeoPos] = useState<LatLng | null>(null);
  const [localStatus, setLocalStatus] = useState<GeoStatus>('idle');
  const [localLocating, setLocalLocating] = useState(false);
  const [localWarning, setLocalWarning] = useState<string | null>(null);

  const effectiveGeoPos = externalGeoPos ?? localGeoPos;
  const effectiveStatus = externalGeoPos ? 'active' : externalGeoStatus !== 'idle' ? externalGeoStatus : localStatus;
  const effectiveLocating = externalLocating || localLocating;
  const effectiveCenter = effectiveGeoPos ?? center;

  const pins = useMemo(
    () =>
      offers.map((offer) => ({
        offer,
        icon: pinIconFor(offer),
        position: [offer.lat, offer.lng] as [number, number],
      })),
    [offers],
  );

  function handleDirectLocate() {
    setLocalWarning(null);
    if (onGeoRequest) {
      onGeoRequest();
      return;
    }
    if (!('geolocation' in navigator)) {
      setLocalStatus('denied');
      setLocalWarning('Tu navegador no soporta geolocalización GPS.');
      return;
    }
    setLocalLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocalLocating(false);
        if (p.coords.accuracy > ACCURACY_LIMIT_M) {
          setLocalGeoPos(null);
          setLocalStatus('inexact');
          setLocalWarning(EXACT_GPS_WARNING);
          toast.info(EXACT_GPS_WARNING);
          return;
        }
        setLocalGeoPos({ lat: p.coords.latitude, lng: p.coords.longitude });
        setLocalStatus('active');
        setLocalWarning(null);
      },
      (err) => {
        setLocalLocating(false);
        setLocalStatus('denied');
        const msg =
          err.code === 1
            ? 'Para calcular distancias, requerimos tu ubicación. Si la bloqueaste antes, toca el candado en la barra de direcciones para habilitarla.'
            : 'No pudimos obtener señal GPS exacta. Verifica que la ubicación del dispositivo esté encendida.';
        setLocalWarning(msg);
        toast.info(msg);
      },
      EXACT_GPS_OPTIONS,
    );
  }

  return (
    <div className="space-y-2">
      <div className="imp-map relative z-0 isolate h-[300px] w-full overflow-hidden rounded-3xl border border-white/10 shadow-card">
        {/* Leyenda inferior */}
        <div className="pointer-events-none absolute bottom-2.5 left-3 z-20 rounded-full bg-slate-950/75 px-2.5 py-1 text-[10px] font-bold text-slate-300 backdrop-blur-md">
          📍 Toca un pin para reservar · 🏪 El nombre abre el comercio
        </div>

        {/* Botón rápido en mapa cuando aún no hay ubicación exacta activa */}
        {!effectiveGeoPos && (
          <button
            type="button"
            onClick={handleDirectLocate}
            disabled={effectiveLocating}
            className="pressable absolute left-3 top-3 z-20 flex items-center gap-1.5 rounded-full border border-impulso-emerald/50 bg-slate-950/85 px-3 py-1.5 text-[11px] font-extrabold text-impulso-mint shadow-card backdrop-blur-md transition hover:bg-impulso-emerald hover:text-slate-950 disabled:opacity-60"
          >
            {effectiveLocating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span>📍</span>}
            {effectiveLocating ? 'Buscando GPS exacto…' : 'Encontrar ofertas exactas cerca de mí'}
          </button>
        )}

        <MapContainer
          center={[effectiveCenter.lat, effectiveCenter.lng]}
          zoom={zoom}
          scrollWheelZoom={false}
          attributionControl
          className="h-full w-full"
        >
          <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={19} crossOrigin="anonymous" />
          <MapController
            center={effectiveCenter}
            zoom={zoom}
            geoPos={effectiveGeoPos}
            geoStatus={effectiveStatus}
            locating={effectiveLocating}
            onLocateClick={handleDirectLocate}
            recenterToken={recenterToken}
          />
          {effectiveGeoPos && (
            <Marker
              position={[effectiveGeoPos.lat, effectiveGeoPos.lng]}
              icon={YOU_ARE_HERE_ICON}
              interactive={false}
              keyboard={false}
            />
          )}
          {pins.map(({ offer, icon, position }) => (
            <Marker
              key={offer.id}
              position={position}
              icon={icon}
              eventHandlers={{ click: () => onSelect(offer) }}
              keyboard={false}
            />
          ))}
        </MapContainer>
      </div>

      {localWarning && (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-3 text-amber-200" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <p className="text-xs font-semibold leading-relaxed">{localWarning}</p>
        </div>
      )}
    </div>
  );
}
