import { useMemo } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { Offer } from '../../types';
import { formatCOP } from '../../utils/format';
import type { LatLng } from '../../utils/geo';

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
}

/**
 * Mapa interactivo inteligente: si el usuario rechaza la ubicación,
 * se centra instantáneamente en el casco urbano y muestra todas las
 * ofertas activas. Un clic en un pin abre la reserva en segundos.
 */
export function LiveMap({ offers, center, geoPos, zoom = 15, onSelect }: LiveMapProps) {
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
    <div className="imp-map h-[300px] w-full overflow-hidden rounded-3xl border border-white/10 shadow-card">
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
    </div>
  );
}
