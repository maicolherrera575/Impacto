import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import {
  AlertTriangle,
  ExternalLink,
  Loader2,
  LocateFixed,
  Maximize2,
  Minimize2,
  Navigation,
  Ticket,
  X,
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import type { Offer } from '../../types';
import { cx, formatCOP } from '../../utils/format';
import { ACCURACY_LIMIT_M, EXACT_GPS_OPTIONS, EXACT_GPS_WARNING, distanceText, haversineMeters } from '../../utils/geo';
import type { GeoStatus, LatLng } from '../../utils/geo';
import { useToast } from '../ui/Toast';

type MapStyleId = 'streets' | 'satellite' | 'dark';

const MAP_STYLE_STORAGE_KEY = 'impulso:map_style_v2';

/**
 * 🗺️ V38.0 · Capas 100% LIBRES sin API Key ni marcas de agua ("API KEY REQUIRED" erradicado):
 *  - Calles: OpenStreetMap estándar oficial (gratuito, detallado para Gachetá y El Guavio).
 *  - Satélite: Esri World Imagery libre (con respaldo automático a OSM si un tile falla).
 *  - Nocturno: OpenStreetMap con paleta oscura calibrada vía CSS (0 tokens, 0 límites).
 */
const OSM_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const TILE_LAYERS: Record<
  MapStyleId,
  {
    label: string;
    emoji: string;
    url: string;
    attribution: string;
    maxNativeZoom: number;
    dataStyle: 'streets' | 'satellite' | 'osm-dark';
  }
> = {
  streets: {
    label: 'Calles',
    emoji: '🗺️',
    url: OSM_URL,
    attribution: OSM_ATTR,
    maxNativeZoom: 19,
    dataStyle: 'streets',
  },
  satellite: {
    label: 'Satélite',
    emoji: '🛰️',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri World Imagery',
    maxNativeZoom: 18,
    dataStyle: 'satellite',
  },
  dark: {
    label: 'Nocturno',
    emoji: '🌙',
    url: OSM_URL,
    attribution: OSM_ATTR,
    maxNativeZoom: 19,
    dataStyle: 'osm-dark',
  },
};

function safeCoord(val: unknown): number | null {
  const n = typeof val === 'number' ? val : Number(val);
  return Number.isFinite(n) && Math.abs(n) > 0.001 ? n : null;
}

/** Pines personalizados: emoji + precio flotante en tiempo real (+ anillo radar si está enfocado). */
function buildPinIcon(offer: Offer, focused: boolean): L.DivIcon {
  const html = `
    <div class="imp-pin ${focused ? 'imp-pin-focused' : ''}">
      ${focused ? '<div class="imp-pin-pulse"></div>' : ''}
      <div class="imp-pin-bubble" role="img" aria-label="${offer.emoji_icon}">${offer.emoji_icon}</div>
      <div class="imp-pin-price">${formatCOP(offer.promo_price)}</div>
      <div class="imp-pin-tip"></div>
    </div>`;
  return L.divIcon({
    className: 'imp-pin-marker',
    html,
    iconSize: [48, 72],
    iconAnchor: [24, 70],
  });
}

const PIN_ICON_CACHE = new Map<string, L.DivIcon>();

function pinIconFor(offer: Offer, focused: boolean): L.DivIcon {
  const key = `${offer.id}|${offer.promo_price}|${focused ? '1' : '0'}`;
  const cached = PIN_ICON_CACHE.get(key);
  if (cached) return cached;
  const icon = buildPinIcon(offer, focused);
  if (PIN_ICON_CACHE.size > 500) PIN_ICON_CACHE.clear();
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
  focusedCoords: LatLng | null;
  focusToken: number;
  hasExplicitFocus: boolean;
  expanded: boolean;
  mapStyle: MapStyleId;
}

function MapController({
  center,
  zoom,
  geoPos,
  geoStatus,
  locating,
  onLocateClick,
  recenterToken,
  focusedCoords,
  focusToken,
  hasExplicitFocus,
  expanded,
  mapStyle,
}: MapControllerProps) {
  const map = useMap();
  const followingRef = useRef(true);
  const lastCenterRef = useRef<LatLng | null>(null);
  const lastTokenRef = useRef(recenterToken);
  const lastFocusTokenRef = useRef(0);
  const hadGeoRef = useRef(false);

  // 🔄 Refresco estricto de dimensiones (`invalidateSize`) al montar, redimensionar, expandir o cambiar de pestaña
  useEffect(() => {
    const refresh = () => {
      try {
        map.invalidateSize({ animate: false, pan: false });
      } catch {
        /* instancia desmontada */
      }
    };
    refresh();
    const t1 = window.setTimeout(refresh, 140);
    const t2 = window.setTimeout(refresh, 420);

    const container = map.getContainer();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && container) {
      ro = new ResizeObserver(() => refresh());
      ro.observe(container);
    }
    window.addEventListener('resize', refresh);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      ro?.disconnect();
      window.removeEventListener('resize', refresh);
    };
  }, [map, expanded, mapStyle, recenterToken, focusToken]);

  useEffect(() => {
    const onDragStart = () => {
      followingRef.current = false;
    };
    map.on('dragstart', onDragStart);
    return () => {
      map.off('dragstart', onDragStart);
    };
  }, [map]);

  // 🎯 Prioridad absoluta #1: salto explícito "Ver en mapa" desde Radar o Perfil (doble pulso tras cierre de modal)
  useEffect(() => {
    if (!focusedCoords || focusToken === 0 || focusToken === lastFocusTokenRef.current) return;
    lastFocusTokenRef.current = focusToken;
    followingRef.current = false;
    lastCenterRef.current = focusedCoords;

    const flyNow = () => {
      try {
        map.invalidateSize({ animate: false, pan: false });
        map.flyTo([focusedCoords.lat, focusedCoords.lng], 17, { animate: true, duration: 0.7 });
      } catch {
        /* desmontado */
      }
    };

    flyNow();
    const retry = window.setTimeout(flyNow, 240);
    return () => window.clearTimeout(retry);
  }, [map, focusedCoords, focusToken]);

  // 🧭 Sincronización de centro por municipio, foco de comercio o GPS
  useEffect(() => {
    if (focusedCoords && focusToken > 0 && focusToken === lastFocusTokenRef.current) {
      return;
    }

    if (recenterToken !== lastTokenRef.current) {
      lastTokenRef.current = recenterToken;
      followingRef.current = true;
      lastCenterRef.current = null;
      map.invalidateSize({ animate: false, pan: false });
      map.flyTo([center.lat, center.lng], hasExplicitFocus ? 17 : geoPos ? Math.max(zoom, 16) : zoom, {
        animate: true,
        duration: 0.65,
      });
      lastCenterRef.current = center;
      return;
    }

    if (!hadGeoRef.current && geoPos != null && !hasExplicitFocus) {
      hadGeoRef.current = true;
      followingRef.current = true;
      lastCenterRef.current = geoPos;
      map.flyTo([geoPos.lat, geoPos.lng], Math.max(map.getZoom(), 16), { animate: true, duration: 0.7 });
      return;
    }
    if (geoPos == null) {
      hadGeoRef.current = false;
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

    map.setView([center.lat, center.lng], hasExplicitFocus ? 17 : geoPos ? Math.max(zoom, 16) : zoom, { animate: true });
    lastCenterRef.current = center;
  }, [map, center.lat, center.lng, zoom, geoPos, recenterToken, hasExplicitFocus, focusedCoords, focusToken]);

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
          ? 'pressable absolute right-3 top-3 z-20 grid h-10 w-10 place-items-center rounded-full border border-blue-400/60 bg-blue-500 text-white shadow-[0_6px_18px_rgba(2,6,23,0.55)] transition hover:brightness-110'
          : geoStatus === 'inexact'
            ? 'pressable absolute right-3 top-3 z-20 grid h-10 w-10 place-items-center rounded-full border border-amber-400/60 bg-amber-500 text-slate-950 shadow-[0_6px_18px_rgba(2,6,23,0.55)] transition hover:brightness-110'
            : 'pressable absolute right-3 top-3 z-20 grid h-10 w-10 place-items-center rounded-full border border-impulso-emerald/50 bg-slate-950/90 text-impulso-mint shadow-[0_6px_18px_rgba(2,6,23,0.55)] backdrop-blur-md transition hover:bg-impulso-emerald hover:text-slate-950'
      }
    >
      {locating ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <LocateFixed className={geoActive ? 'h-4 w-4 animate-pulse-soft' : 'h-4 w-4'} />
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
  onQuickReserve?: (offer: Offer) => void;
  onGeoRequest?: () => void;
  geoStatus?: GeoStatus;
  locating?: boolean;
  recenterToken?: number;
  hasExplicitFocus?: boolean;
  focusedOffer?: Offer | null;
  focusToken?: number;
  onClearFocus?: () => void;
  onOpenMerchant?: (merchantId: string) => void;
}

export function LiveMap({
  offers,
  center,
  geoPos: externalGeoPos,
  zoom = 15,
  onSelect,
  onQuickReserve,
  onGeoRequest,
  geoStatus: externalGeoStatus = 'idle',
  locating: externalLocating = false,
  recenterToken = 0,
  hasExplicitFocus = false,
  focusedOffer = null,
  focusToken = 0,
  onClearFocus,
  onOpenMerchant,
}: LiveMapProps) {
  const toast = useToast();
  const mapSectionRef = useRef<HTMLDivElement | null>(null);
  const [localGeoPos, setLocalGeoPos] = useState<LatLng | null>(null);
  const [localStatus, setLocalStatus] = useState<GeoStatus>('idle');
  const [localLocating, setLocalLocating] = useState(false);
  const [localWarning, setLocalWarning] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [satelliteFailed, setSatelliteFailed] = useState(false);
  const tileErrCountRef = useRef(0);
  const [mapStyle, setMapStyle] = useState<MapStyleId>(() => {
    try {
      const saved = localStorage.getItem(MAP_STYLE_STORAGE_KEY);
      if (saved === 'streets' || saved === 'satellite' || saved === 'dark') return saved;
    } catch {
      /* ignorar */
    }
    return 'streets';
  });

  const effectiveGeoPos = externalGeoPos ?? localGeoPos;
  const effectiveStatus = externalGeoPos ? 'active' : externalGeoStatus !== 'idle' ? externalGeoStatus : localStatus;
  const effectiveLocating = externalLocating || localLocating;

  const focusedCoords = useMemo<LatLng | null>(() => {
    if (!focusedOffer) return null;
    const lat = safeCoord(focusedOffer.lat);
    const lng = safeCoord(focusedOffer.lng);
    if (lat != null && lng != null) return { lat, lng };
    return center;
  }, [focusedOffer, center]);

  const effectiveCenter: LatLng =
    focusedCoords ?? (hasExplicitFocus ? center : effectiveGeoPos ?? center);

  // Scroll suave garantizado al mapa (tras liberar bloqueo de scroll del modal de Radar)
  useEffect(() => {
    if (!focusedOffer || focusToken === 0) return;
    const t = window.setTimeout(() => {
      mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 240);
    return () => window.clearTimeout(t);
  }, [focusedOffer, focusToken]);

  function changeMapStyle(next: MapStyleId) {
    setMapStyle(next);
    setSatelliteFailed(false);
    tileErrCountRef.current = 0;
    try {
      localStorage.setItem(MAP_STYLE_STORAGE_KEY, next);
    } catch {
      /* ignorar */
    }
  }

  const mergedOffers = useMemo(() => {
    if (!focusedOffer) return offers;
    return offers.some((o) => o.id === focusedOffer.id) ? offers : [focusedOffer, ...offers];
  }, [offers, focusedOffer]);

  const pins = useMemo(
    () =>
      mergedOffers
        .map((offer) => {
          const lat = safeCoord(offer.lat);
          const lng = safeCoord(offer.lng);
          if (lat == null || lng == null) return null;
          const isFocused = focusedOffer?.id === offer.id;
          return {
            offer,
            isFocused,
            icon: pinIconFor(offer, isFocused),
            position: [lat, lng] as [number, number],
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
    [mergedOffers, focusedOffer],
  );

  const effectiveStyleId: MapStyleId = mapStyle === 'satellite' && satelliteFailed ? 'streets' : mapStyle;
  const activeLayer = TILE_LAYERS[effectiveStyleId];

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

  const focusedDistance =
    focusedCoords && effectiveGeoPos ? haversineMeters(effectiveGeoPos, focusedCoords) : null;

  return (
    <div ref={mapSectionRef} className="space-y-2">
      <div
        data-style={activeLayer.dataStyle}
        className={cx(
          'imp-map relative z-0 isolate w-full overflow-hidden rounded-3xl border border-white/15 shadow-card transition-[height] duration-300',
          expanded ? 'h-[480px] sm:h-[540px]' : 'h-[330px] sm:h-[360px] lg:h-[395px]',
        )}
      >
        {/* Selector de estilo libre sin API key (Calles · Satélite · Nocturno) */}
        <div className="absolute left-3 top-3 z-20 flex items-center gap-1 rounded-full border border-white/15 bg-slate-950/85 p-1 shadow-lg backdrop-blur-md">
          {(['streets', 'satellite', 'dark'] as MapStyleId[]).map((id) => {
            const cfg = TILE_LAYERS[id];
            const active = mapStyle === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => changeMapStyle(id)}
                className={cx(
                  'pressable rounded-full px-2.5 py-1 text-[10px] font-extrabold transition',
                  active
                    ? 'bg-impulso-emerald text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white',
                )}
              >
                {cfg.emoji} <span className="hidden xs:inline sm:inline">{cfg.label}</span>
              </button>
            );
          })}
        </div>

        {/* Botón ampliar/compactar mapa */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          title={expanded ? 'Compactar mapa' : 'Ampliar mapa'}
          aria-label={expanded ? 'Compactar mapa' : 'Ampliar mapa'}
          className="pressable absolute right-3 top-14 z-20 grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-slate-950/85 text-slate-200 shadow-md backdrop-blur-md transition hover:border-impulso-emerald/50 hover:text-impulso-mint"
        >
          {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>

        {/* Tarjeta flotante de oferta enfocada (al pulsar "Ver en mapa" desde Radar) */}
        {focusedOffer && focusedCoords ? (
          <div className="absolute inset-x-2.5 bottom-2.5 z-30 rounded-2xl border border-impulso-emerald/55 bg-slate-950/92 p-3 shadow-[0_14px_36px_rgba(0,0,0,0.75)] backdrop-blur-xl">
            <div className="flex items-start gap-2.5">
              {focusedOffer.image_thumb ? (
                <img
                  src={focusedOffer.image_thumb}
                  alt={focusedOffer.title}
                  className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-white/15"
                />
              ) : (
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-white/10 bg-slate-900 text-2xl">
                  {focusedOffer.emoji_icon}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-xs font-extrabold text-white">{focusedOffer.title}</p>
                  {onClearFocus && (
                    <button
                      type="button"
                      onClick={onClearFocus}
                      aria-label="Cerrar tarjeta del mapa"
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10 text-slate-300 hover:bg-white/20 hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-300">
                  <button
                    type="button"
                    onClick={() => focusedOffer.merchant?.id && onOpenMerchant?.(focusedOffer.merchant.id)}
                    className="truncate text-impulso-mint underline decoration-dotted underline-offset-2"
                  >
                    🏪 {focusedOffer.merchant?.business_name ?? 'Comercio local'}
                  </button>
                  <span>·</span>
                  <span className="font-extrabold text-white">{formatCOP(focusedOffer.promo_price)}</span>
                  {focusedDistance != null && (
                    <span className="text-sky-300">· 📍 {distanceText(focusedDistance)}</span>
                  )}
                </p>
              </div>
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => (onQuickReserve ? onQuickReserve(focusedOffer) : onSelect(focusedOffer))}
                className="pressable flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-impulso-emerald to-teal-600 py-2 text-[11px] font-extrabold text-white shadow-glow"
              >
                <Ticket className="h-3.5 w-3.5" /> Apartar ahora
              </button>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${focusedCoords.lat},${focusedCoords.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="pressable flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-slate-900 py-2 text-[11px] font-bold text-slate-200 transition hover:border-sky-400/50 hover:text-sky-300"
              >
                <Navigation className="h-3.5 w-3.5" /> Cómo llegar
                <ExternalLink className="h-3 w-3 opacity-70" />
              </a>
            </div>
          </div>
        ) : (
          <div className="pointer-events-none absolute bottom-2.5 left-3 z-20 rounded-full border border-white/10 bg-slate-950/80 px-2.5 py-1 text-[10px] font-bold text-slate-200 backdrop-blur-md">
            📍 {pins.length} oferta{pins.length === 1 ? '' : 's'} en el radar · Toca un pin para apartar
          </div>
        )}

        <MapContainer
          center={[effectiveCenter.lat, effectiveCenter.lng]}
          zoom={focusedCoords ? 17 : zoom}
          scrollWheelZoom={false}
          attributionControl
          className="h-full w-full"
        >
          <TileLayer
            key={effectiveStyleId}
            url={activeLayer.url}
            attribution={activeLayer.attribution}
            maxZoom={20}
            maxNativeZoom={activeLayer.maxNativeZoom}
            eventHandlers={{
              tileerror: () => {
                if (effectiveStyleId === 'satellite') {
                  tileErrCountRef.current += 1;
                  if (tileErrCountRef.current >= 3) {
                    setSatelliteFailed(true);
                  }
                }
              },
            }}
          />
          <MapController
            center={effectiveCenter}
            zoom={zoom}
            geoPos={effectiveGeoPos}
            geoStatus={effectiveStatus}
            locating={effectiveLocating}
            onLocateClick={handleDirectLocate}
            recenterToken={recenterToken}
            focusedCoords={focusedCoords}
            focusToken={focusToken}
            hasExplicitFocus={hasExplicitFocus}
            expanded={expanded}
            mapStyle={effectiveStyleId}
          />
          {effectiveGeoPos && (
            <Marker
              position={[effectiveGeoPos.lat, effectiveGeoPos.lng]}
              icon={YOU_ARE_HERE_ICON}
              interactive={false}
              keyboard={false}
            />
          )}
          {pins.map(({ offer, isFocused, icon, position }) => (
            <Marker
              key={offer.id}
              position={position}
              icon={icon}
              zIndexOffset={isFocused ? 1000 : 0}
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
