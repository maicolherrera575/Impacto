import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { AlertTriangle, Check, LocateFixed, Loader2, MapPin } from 'lucide-react';
import { ModalShell } from '../ui/ModalShell';
import { useToast } from '../ui/Toast';
import type { Profile } from '../../types';
import { updateProfileLocation } from '../../services/profile.service';
import { friendlyError } from '../../services/supabase';
import { GACHETA_CENTER, centroDeMunicipio } from '../../utils/geo';

interface LocationPickerProps {
  open: boolean;
  onClose: () => void;
  profile: Profile;
  onProfileChange: (profile: Profile) => void;
}

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const PICKER_PIN_ICON: L.DivIcon = L.divIcon({
  className: 'imp-pin-marker',
  html: `
    <div class="imp-pin">
      <div class="imp-pin-bubble" aria-hidden="true">🏪</div>
      <div class="imp-pin-price">Mi local</div>
      <div class="imp-pin-tip"></div>
    </div>`,
  iconSize: [44, 68],
  iconAnchor: [22, 66],
});

function MapBehavior({
  lat,
  lng,
  onPick,
}: {
  lat: number;
  lng: number;
  onPick: (newLat: number, newLng: number) => void;
}) {
  const map = useMap();

  useEffect(() => {
    const t = window.setTimeout(() => map.invalidateSize(), 260);
    return () => window.clearTimeout(t);
  }, [map]);

  useEffect(() => {
    map.setView([lat, lng], Math.max(map.getZoom(), 16), { animate: true });
  }, [lat, lng, map]);

  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });

  return null;
}

/**
 * 📍 Ubicación del negocio (V19.0):
 *  - Pin personalizado visible en producción (sin iconos rotos de Leaflet).
 *  - Toca cualquier punto del mapa o arrastra el pin hasta la puerta del local.
 *  - Botón GPS estricto (`enableHighAccuracy: true, timeout: 10000, maximumAge: 0`).
 *  - Persistencia garantizada en Supabase (`profiles` + ofertas activas) con estado visual claro.
 */
export function LocationPicker({ open, onClose, profile, onProfileChange }: LocationPickerProps) {
  const toast = useToast();
  const fallback = centroDeMunicipio(profile.municipality || 'Gachetá');
  const [lat, setLat] = useState(profile.lat ?? fallback.lat ?? GACHETA_CENTER.lat);
  const [lng, setLng] = useState(profile.lng ?? fallback.lng ?? GACHETA_CENTER.lng);
  const [address, setAddress] = useState(profile.address_reference ?? '');
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [gpsWarning, setGpsWarning] = useState('');
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (open) {
      const center = centroDeMunicipio(profile.municipality || 'Gachetá');
      setLat(profile.lat ?? center.lat);
      setLng(profile.lng ?? center.lng);
      setAddress(profile.address_reference ?? '');
      setErrorMsg('');
      setGpsWarning('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function useGps() {
    setErrorMsg('');
    setGpsWarning('');
    if (!('geolocation' in navigator)) {
      setErrorMsg('Tu dispositivo o navegador no soporta GPS. Toca directamente en el mapa para ubicar tu local.');
      return;
    }
    if (!window.isSecureContext) {
      setErrorMsg('El GPS requiere conexión segura HTTPS. Ubica tu local tocando el mapa.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        if (p.coords.accuracy > 1000) {
          setGpsWarning(
            `Tu navegador entregó una señal aproximada (±${Math.round(p.coords.accuracy)} m). Ajusta el pin manualmente en el mapa o activa "Ubicación exacta".`,
          );
          toast.info('Señal aproximada detectada: ajusta el pin manualmente en tu cuadra');
          return;
        }
        setLat(p.coords.latitude);
        setLng(p.coords.longitude);
        toast.success(`📍 GPS exacto (±${Math.round(p.coords.accuracy)} m). Ajusta el pin si hace falta.`);
      },
      (err) => {
        setLocating(false);
        const msg =
          err.code === err.PERMISSION_DENIED
            ? 'Permiso de ubicación bloqueado. Actívalo en el candado 🔒 del navegador o toca el mapa manualmente.'
            : 'No pudimos obtener señal GPS exacta ahora. Toca o arrastra el pin en el mapa hasta tu local.';
        setErrorMsg(msg);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  }

  async function save() {
    setErrorMsg('');
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setErrorMsg('Las coordenadas del mapa no son válidas. Toca un punto del mapa.');
      return;
    }
    setSaving(true);
    try {
      const updated = await updateProfileLocation({
        lat,
        lng,
        addressReference: address.trim() || 'Casco Urbano',
      });
      onProfileChange(updated);
      toast.success('📍 ¡Ubicación de tu negocio guardada y sincronizada en el radar!');
      onClose();
    } catch (err) {
      const msg = friendlyError(err);
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell open={open} onClose={() => !saving && onClose()} panelClassName="max-w-lg">
      <div className="p-5 pt-14">
        <h3 className="flex items-center gap-2 text-lg font-extrabold text-white">
          <MapPin className="h-5 w-5 text-impulso-mint" /> Ubicación de tu negocio
        </h3>
        <p className="mt-1 text-sm text-slate-400">
          Toca cualquier punto del mapa, arrastra el pin 🏪 hasta la puerta de tu local o captura tu GPS exacto.
        </p>

        <div className="imp-map relative mt-4 h-[300px] w-full overflow-hidden rounded-3xl border border-white/10 shadow-card">
          <MapContainer center={[lat, lng]} zoom={16} scrollWheelZoom className="h-full w-full">
            <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={19} crossOrigin="anonymous" />
            <MapBehavior
              lat={lat}
              lng={lng}
              onPick={(newLat, newLng) => {
                setLat(newLat);
                setLng(newLng);
                setGpsWarning('');
              }}
            />
            <Marker
              position={[lat, lng]}
              icon={PICKER_PIN_ICON}
              draggable
              ref={markerRef}
              eventHandlers={{
                dragend: () => {
                  const p = markerRef.current?.getLatLng();
                  if (p) {
                    setLat(p.lat);
                    setLng(p.lng);
                    setGpsWarning('');
                  }
                },
              }}
            />
          </MapContainer>
          <div className="pointer-events-none absolute bottom-2.5 left-3 z-20 rounded-full border border-white/10 bg-slate-950/80 px-2.5 py-1 font-mono text-[10px] font-bold text-impulso-mint backdrop-blur-md">
            {lat.toFixed(5)}, {lng.toFixed(5)}
          </div>
        </div>

        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Referencia de dirección (ej: Frente al Parque Principal)"
          maxLength={120}
          className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3.5 text-[15px] font-medium text-white placeholder:text-slate-600 outline-none focus:border-impulso-emerald/60"
        />

        {gpsWarning && (
          <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-3 text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <p className="text-xs font-semibold leading-relaxed">{gpsWarning}</p>
          </div>
        )}

        {errorMsg && (
          <div className="mt-3 flex items-start gap-2 rounded-2xl border border-red-500/40 bg-red-500/15 p-3 text-red-200" role="alert">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-xs font-semibold leading-relaxed">{errorMsg}</p>
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={useGps}
            disabled={locating || saving}
            className="pressable flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-slate-950/40 py-3.5 text-sm font-bold text-slate-200 disabled:opacity-50"
          >
            {locating ? <Loader2 className="h-5 w-5 animate-spin" /> : <LocateFixed className="h-5 w-5" />}
            {locating ? 'Ubicando…' : 'Usar mi GPS'}
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || locating}
            className="pressable flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-impulso-emerald to-teal-600 py-3.5 text-sm font-extrabold text-white shadow-glow disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
