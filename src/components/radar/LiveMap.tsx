import { useMemo } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import { LocateFixed } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import type { Offer } from '../../types';
import { formatCOP } from '../../utils/format';
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

/** Recentra el mapa cuando cambia el punto de referencia. */
function CenterUpdater({ center, zoom }: { center: LatLng; zoom: number }) {
  const map = useMap();
  map.setView([center.lat, center.lng], zoom, { animate: true });
  return null;
}

/** Punto azul "estás aquí": ubicación exacta del usuario en el radar. */
const YOU_ARE_HERE_ICON: L.DivIcon = L.divIcon({
  className: 'imp-you-marker',
  html: '<div class="imp-you-dot"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

interface LiveMapProps {
  offers: Offer[];
  center: LatLng;
  geoPos?: LatLng | null;
  zoom?: number;
  onSelect: (offer: Offer) => void;
  /** 🎯 Botón GPS estilo Google Maps flotando sobre el propio mapa. */
  onGeoRequest?: () => void;
  geoStatus?: GeoStatus;
}

/**
 * Mapa interactivo inteligente: pide ubicación al entrar y, si se niega,
 * se centra instantáneamente en el casco urbano mostrando todas las
 * ofertas activas. Botón flotante 🎯 para activar el punto azul en 1
 * clic sin depender de la barra superior. Un clic en un pin abre la
 * reserva en segundos.
 */
export function LiveMap({ offers, center, geoPos, zoom = 15, onSelect, onGeoRequest, geoStatus = 'idle' }: LiveMapProps) {
  const pins = useMemo(
    () =>
      offers.map((offer) => ({
        offer,
        icon: buildPinIcon(offer),
        position: [offer.lat, offer.lng] as [number, number],
      })),
    [offers]
  );

  const geoActive = geoStatus === 'active' && geoPos != null;

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
        <CenterUpdater center={center} zoom={zoom} />
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

      {/* 🎯 Botón de ubicación estilo Google Maps (encima de las panes del mapa) */}
      {onGeoRequest && (
        <button
          onClick={onGeoRequest}
          title={
            geoActive
              ? 'Punto azul activo: te seguimos en vivo mientras te mueves'
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
      )}
    </div>
  );
}
