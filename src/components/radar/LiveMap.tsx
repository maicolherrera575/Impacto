import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import { LocateFixed } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import type { Offer } from '../../types';
import { formatCOP } from '../../utils/format';
import { haversineMeters } from '../../utils/geo';
import type { GeoStatus, LatLng } from '../../utils/geo';

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

/** Punto azul "estás aquí": ubicación exacta del usuario en el radar. */
const YOU_ARE_HERE_ICON: L.DivIcon = L.divIcon({
  className: 'imp-you-marker',
  html: '<div class="imp-you-dot"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

interface MapControllerProps {
  center: LatLng;
  zoom: number;
  geoPos: LatLng | null;
  geoStatus: GeoStatus;
  onGeoRequest?: () => void;
  recenterToken: number;
}

/**
 * 🧭 Cerebro del mapa (modo Google Maps):
 *  - MODO SEGUIR: mientras el usuario no toque el mapa, el radar sigue al
 *    punto azul en vivo con paneos suaves (cero parpadeo, cero tirones).
 *  - Umbral anti-ruido GPS de 20 m: las micro-variance de la señal jamás
 *    mueven el mapa (ese era el parpadeo cada 1–2 segundos).
 *  - Si el usuario arrastra el mapa, se respeta SU cámara: el modo seguir
 *    se pausa y solo el botón 🎯 lo reactiva.
 *  - Cambio de municipio (recenterToken) → recentrado forzado.
 *  - Botón 🎯 flotante: activa/ubica el punto azul en 1 clic.
 */
function MapController({ center, zoom, geoPos, geoStatus, onGeoRequest, recenterToken }: MapControllerProps) {
  const map = useMap();
  const followingRef = useRef(true);
  const lastCenterRef = useRef<LatLng | null>(null);
  const lastTokenRef = useRef(recenterToken);

  // Arrastre manual = el usuario exploró por su cuenta → pausa el modo seguir
  useEffect(() => {
    const onDragStart = () => {
      followingRef.current = false;
    };
    map.on('dragstart', onDragStart);
    return () => {
      map.off('dragstart', onDragStart);
    };
  }, [map]);

  // Recentra con inteligencia SOLO cuando el punto de referencia de verdad cambia
  useEffect(() => {
    // Cambio externo forzado (municipio): reactiva el modo seguir
    if (recenterToken !== lastTokenRef.current) {
      lastTokenRef.current = recenterToken;
      followingRef.current = true;
      lastCenterRef.current = null;
    }

    // El usuario está explorando: respetamos su cámara
    if (!followingRef.current) {
      lastCenterRef.current = center;
      return;
    }

    const last = lastCenterRef.current;
    if (last) {
      const moved = haversineMeters(last, center);
      if (moved < 20) return; // ruido GPS: el mapa quieto, sin parpadeo
      if (moved < 800) {
        // Movimiento humano: paneo suave que conserva el zoom elegido
        map.panTo([center.lat, center.lng], { animate: true, duration: 0.5 });
        lastCenterRef.current = center;
        return;
      }
    }

    // Salto grande (primera fix, cambio de ciudad): recentrado con zoom pro
    const firstFix = last === null && geoPos != null;
    map.setView([center.lat, center.lng], firstFix ? Math.max(zoom, 16) : zoom, { animate: true });
    lastCenterRef.current = center;
  }, [map, center.lat, center.lng, zoom, geoPos, recenterToken]);

  const geoActive = geoStatus === 'active' && geoPos != null;

  function handleTarget() {
    if (geoPos) {
      followingRef.current = true;
      lastCenterRef.current = geoPos;
      map.flyTo([geoPos.lat, geoPos.lng], Math.max(map.getZoom(), zoom), { animate: true, duration: 0.6 });
    } else {
      onGeoRequest?.();
    }
  }

  return (
    <button
      onClick={handleTarget}
      title={
        geoActive
          ? 'Punto azul activo: te seguimos en vivo mientras te mueves'
          : geoStatus === 'denied'
            ? 'Ubicación no disponible: toca para reintentar (el radar sigue en Gachetá)'
            : '🎯 Activar mi punto azul de ubicación en el mapa'
      }
      aria-label="Centrar en mi ubicación"
      className={
        geoActive
          ? 'pressable absolute right-3 top-3 z-20 grid h-11 w-11 place-items-center rounded-full border border-blue-400/60 bg-blue-500 text-white shadow-[0_6px_18px_rgba(2,6,23,0.55)] transition hover:brightness-110'
          : 'pressable absolute right-3 top-3 z-20 grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-impulso-panel text-slate-200 shadow-[0_6px_18px_rgba(2,6,23,0.55)] transition hover:border-impulso-emerald/40 hover:text-impulso-mint'
      }
    >
      <LocateFixed className={geoActive ? 'h-5 w-5 animate-pulse-soft' : 'h-5 w-5'} />
    </button>
  );
}

interface LiveMapProps {
  offers: Offer[];
  center: LatLng;
  geoPos?: LatLng | null;
  zoom?: number;
  onSelect: (offer: Offer) => void;
  /** 🎯 Reintenta el permiso de ubicación (botón flotante del mapa). */
  onGeoRequest?: () => void;
  geoStatus?: GeoStatus;
  /** Token externo para forzar recentrado (ej: cambio de municipio). */
  recenterToken?: number;
}

/**
 * Mapa interactivo inteligente: pide ubicación al entrar y, apenas la
 * aceptan, vuela directo al punto azul con zoom de calle. Si se niega,
 * se centra en el casco urbano mostrando todas las ofertas activas.
 * Un clic en un pin abre la reserva en segundos.
 */
export function LiveMap({
  offers,
  center,
  geoPos,
  zoom = 15,
  onSelect,
  onGeoRequest,
  geoStatus = 'idle',
  recenterToken = 0,
}: LiveMapProps) {
  const pins = useMemo(
    () =>
      offers.map((offer) => ({
        offer,
        icon: buildPinIcon(offer),
        position: [offer.lat, offer.lng] as [number, number],
      })),
    [offers]
  );

  return (
    <div className="imp-map relative h-[300px] w-full overflow-hidden rounded-3xl border border-white/10 shadow-card">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        scrollWheelZoom={false}
        attributionControl
        className="h-full w-full"
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={19} crossOrigin="anonymous" />
        <MapController
          center={center}
          zoom={zoom}
          geoPos={geoPos ?? null}
          geoStatus={geoStatus}
          onGeoRequest={onGeoRequest}
          recenterToken={recenterToken}
        />
        {geoPos && (
          <Marker position={[geoPos.lat, geoPos.lng]} icon={YOU_ARE_HERE_ICON} interactive={false} keyboard={false} />
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
  );
}
