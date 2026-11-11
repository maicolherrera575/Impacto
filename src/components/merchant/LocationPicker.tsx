import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Check, LocateFixed, Loader2 } from 'lucide-react';
import { ModalShell } from '../ui/ModalShell';
import { useToast } from '../ui/Toast';
import type { Profile } from '../../types';
import { updateMyProfile } from '../../services/profile.service';
import { friendlyError } from '../../services/supabase';
import { GACHETA_CENTER } from '../../utils/geo';

interface LocationPickerProps {
  open: boolean;
  onClose: () => void;
  profile: Profile;
  onProfileChange: (profile: Profile) => void;
}

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom(), { animate: true });
  }, [lat, lng, map]);
  return null;
}

/**
 * Ubicación del negocio: el comerciante la toma con GPS o la arrastra
 * manualmente en el mapa (ideal si el GPS falla en zonas rurales). Es la
 * coordenada que usará el radar para calcular distancias reales.
 */
export function LocationPicker({ open, onClose, profile, onProfileChange }: LocationPickerProps) {
  const toast = useToast();
  const [lat, setLat] = useState(profile.lat ?? GACHETA_CENTER.lat);
  const [lng, setLng] = useState(profile.lng ?? GACHETA_CENTER.lng);
  const [address, setAddress] = useState(profile.address_reference ?? '');
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (open) {
      setLat(profile.lat ?? GACHETA_CENTER.lat);
      setLng(profile.lng ?? GACHETA_CENTER.lng);
      setAddress(profile.address_reference ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function useGps() {
    if (!('geolocation' in navigator)) {
      toast.error('Tu dispositivo no soporta GPS');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLat(p.coords.latitude);
        setLng(p.coords.longitude);
        setLocating(false);
        toast.info('📍 Ubicación GPS capturada: ajústala arrastrando el pin si hace falta');
      },
      () => {
        setLocating(false);
        toast.error('No pudimos leer tu GPS. Arrastra el pin manualmente en el mapa.');
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }

  async function save() {
    setSaving(true);
    try {
      const updated = await updateMyProfile({
        lat,
        lng,
        addressReference: address.trim() || 'Casco Urbano',
      });
      onProfileChange(updated);
      toast.success('📍 Ubicación del negocio guardada');
      onClose();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell open={open} onClose={onClose} panelClassName="max-w-lg">
      <div className="p-5 pt-14">
        <h3 className="text-lg font-extrabold text-white">📍 Ubicación de tu negocio</h3>
        <p className="mt-1 text-sm text-slate-400">
          Así te encontrarán los clientes en el radar. Toma tu posición con GPS o arrastra el pin 📌 hasta la puerta de tu local.
        </p>

        <div className="imp-map mt-4 h-[300px] w-full overflow-hidden rounded-3xl border border-white/10 shadow-card">
          <MapContainer center={[lat, lng]} zoom={16} scrollWheelZoom className="h-full w-full">
            <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={19} crossOrigin="anonymous" />
            <Recenter lat={lat} lng={lng} />
            <Marker
              position={[lat, lng]}
              draggable
              ref={markerRef}
              eventHandlers={{
                dragend: () => {
                  const p = markerRef.current?.getLatLng();
                  if (p) {
                    setLat(p.lat);
                    setLng(p.lng);
                  }
                },
              }}
            />
          </MapContainer>
        </div>

        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Referencia de dirección (ej: Frente al Parque Principal)"
          maxLength={80}
          className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3.5 text-[15px] font-medium text-white placeholder:text-slate-600 outline-none focus:border-impulso-emerald/60"
        />

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={useGps}
            disabled={locating}
            className="pressable flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-slate-950/40 py-3.5 text-sm font-bold text-slate-200 disabled:opacity-50"
          >
            {locating ? <Loader2 className="h-5 w-5 animate-spin" /> : <LocateFixed className="h-5 w-5" />}
            Usar mi GPS
          </button>
          <button
            onClick={() => void save()}
            disabled={saving}
            className="pressable flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-impulso-emerald to-teal-600 py-3.5 text-sm font-extrabold text-white shadow-glow disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
            Guardar
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
