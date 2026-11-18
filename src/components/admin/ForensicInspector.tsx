import { useEffect, useState } from 'react';
import { Copy, Loader2, Map, ShieldBan } from 'lucide-react';
import { ModalShell } from '../ui/ModalShell';
import { useToast } from '../ui/Toast';
import { adminBlockClient } from '../../services/admin.service';
import { friendlyError } from '../../services/supabase';

export interface ForensicData {
  customerName: string;
  phone: string;
  clientIp: string | null;
  deviceId: string | null;
  clientLat: number | null;
  clientLng: number | null;
  code: string | null;
  createdAt: string | null;
}

interface IpWhoResponse {
  success?: boolean;
  ip?: string;
  connection?: { isp?: string; org?: string; asn?: string };
  city?: string;
  region?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

interface IpApiFallback {
  org?: string;
  city?: string;
  region_name?: string;
  country_name?: string;
  latitude?: number;
  longitude?: number;
}

interface GeoResult {
  isp: string;
  city: string;
  region: string;
  country: string;
  lat: number | null;
  lng: number | null;
  isLocalDemo: boolean;
}

const LOCAL_IPS = new Set(['127.0.0.1', '0.0.0.0', '::1', '']);

/**
 * 🕵️‍♂️ Ficha forense del usuario: IP pública, operador/ISP, mapa de red,
 * coordenadas GPS exactas y reporte legal listo para autoridades.
 * Consulta gratis ipwho.is (con fallback a ipapi.co) desde el navegador.
 */
export function ForensicInspector({ data, onClose }: { data: ForensicData | null; onClose: () => void }) {
  const toast = useToast();
  const [geo, setGeo] = useState<GeoResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [blockingFp, setBlockingFp] = useState(false);

  const isCgnatLikely = Boolean(
    geo &&
      (/claro|comcel|movistar|telefonica|tigo|une|colombia\s+movil|wom|avantel|etb/i.test(geo.isp) ||
        /bogot[aá]|soacha|medell[ií]n|cali/i.test(geo.city)),
  );

  async function blockByFingerprint() {
    if (!data?.deviceId || blockingFp) return;
    setBlockingFp(true);
    try {
      await adminBlockClient({
        phone: data.phone || null,
        deviceId: data.deviceId,
        clientIp: null,
        reason: `Bloqueo Forense por Device Fingerprint (${data.deviceId})`,
      });
      toast.success(`🔒 Dispositivo ${data.deviceId} bloqueado permanentemente (independiente de cambio de IP móvil)`);
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setBlockingFp(false);
    }
  }

  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    setLoading(true);
    setGeo(null);

    async function lookup() {
      const ip = data?.clientIp ?? '';
      try {
        if (LOCAL_IPS.has(ip)) {
          // Si la IP capturada fue 0.0.0.0 / localhost, no atribuir la IP del admin como si fuera del usuario
          setGeo(null);
          return;
        }
        const primary = (await fetchJson(`https://ipwho.is/${encodeURIComponent(ip)}`)) as IpWhoResponse | null;
        if (cancelled) return;
        if (primary && primary.success !== false && (primary.connection?.isp || primary.city)) {
          setGeo(toGeo(primary, false));
          return;
        }
        const fallback = (await fetchJson(`https://ipapi.co/${encodeURIComponent(ip)}/json/`)) as IpApiFallback | null;
        if (cancelled) return;
        setGeo(
          fallback
            ? {
                isp: fallback.org ?? 'No disponible',
                city: fallback.city ?? '—',
                region: fallback.region_name ?? '—',
                country: fallback.country_name ?? '—',
                lat: fallback.latitude ?? null,
                lng: fallback.longitude ?? null,
                isLocalDemo: false,
              }
            : null
        );
      } catch {
        if (!cancelled) setGeo(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void lookup();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (!data) return null;

  function gpsUrl(): string {
    if (data?.clientLat != null && data?.clientLng != null) {
      return `https://www.google.com/maps?q=${data.clientLat},${data.clientLng}`;
    }
    if (geo?.lat != null && geo?.lng != null) {
      return `https://www.google.com/maps?q=${geo.lat},${geo.lng}`;
    }
    return '';
  }

  function buildLegalReport(): string {
    const eventDate = data?.createdAt ? new Date(data.createdAt).toLocaleString('es-CO') : 'No registrada';
    const gps =
      data?.clientLat != null && data?.clientLng != null
        ? `${data.clientLat}, ${data.clientLng} (precisión de metros)`
        : 'No compartió GPS';
    const networkGps = geo?.lat != null && geo?.lng != null ? `${geo.lat}, ${geo.lng}` : 'No disponible';
    return [
      'INFORME TÉCNICO DE TRAZABILIDAD — PLATAFORMA IMPULSO',
      '──────────────────────────────────────────────',
      `Fecha del informe: ${new Date().toLocaleString('es-CO')}`,
      `Fecha del evento: ${eventDate}`,
      `Usuario reportado: ${data?.customerName ?? '—'} · Teléfono: ${data?.phone ?? '—'}`,
      `Código de reserva asociado: ${data?.code ?? '—'}`,
      '',
      `IP pública: ${data?.clientIp ?? '—'}`,
      `Operador / ISP: ${geo?.isp ?? 'Consultando…'}`,
      `Ubicación de red (ISP): ${geo ? `${geo.city}, ${geo.region}, ${geo.country}` : 'Consultando…'}`,
      `Coordenadas de red: ${networkGps}`,
      `Coordenadas GPS exactas del dispositivo: ${gps}`,
      `Huella de dispositivo: ${data?.deviceId ?? '—'}`,
      '',
      'Plataforma conforme a la Ley 1581 de 2012 (protección de datos personales)',
      'y la Ley 1273 de 2009 (delitos informáticos en Colombia).',
      'Reporte generado automáticamente por Impulso para fines de investigación.',
    ].join('\n');
  }

  return (
    <ModalShell open onClose={onClose} escClose closeLabel="Cerrar inspector" panelClassName="max-w-md">
      <div className="p-5 pt-5">
        <div className="pr-11">
          <h3 className="text-lg font-extrabold text-white">🕵️‍♂️ Ficha Forense del Usuario</h3>
          <p className="text-xs text-slate-400">Consulta de IP, operador y ubicación en vivo y gratis</p>
        </div>

        <div className="mt-4 space-y-2 text-sm">
          <Row label="👤 Usuario" value={data.customerName} />
          <Row label="📞 Teléfono reportado" value={data.phone} />
          <Row label="🌐 IP pública" value={data.clientIp ?? '—'} />
          <Row label="💻 Huella de dispositivo" value={data.deviceId ?? '—'} mono />
          <Row label="🎟️ Reserva asociada" value={data.code ?? '—'} mono />
        </div>

        {loading ? (
          <p className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-slate-950/40 p-3 text-xs font-semibold text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin text-impulso-gold" /> Consultando operador y ubicación de red…
          </p>
        ) : geo ? (
          <div className="mt-4 rounded-2xl border border-white/[0.08] bg-slate-950/40 p-3.5">
            {geo.isLocalDemo && (
              <p className="mb-2 text-[11px] font-semibold leading-relaxed text-amber-200/90">
                ⚙️ Entorno de pruebas local: cuando la plataforma esté publicada en su dominio web, aquí verás la IP pública real (Claro / Movistar / Tigo)
                de cada usuario. Esta consulta muestra la IP de tu propio navegador como demostración.
              </p>
            )}
            <Row label="📡 Operador / ISP" value={geo.isp} />
            <Row label="🏙️ Ubicación de red" value={`${geo.city}, ${geo.region}, ${geo.country}`} />
            {isCgnatLikely && (
              <p className="mt-2 rounded-xl border border-amber-400/30 bg-amber-500/10 p-2.5 text-[11px] font-semibold leading-relaxed text-amber-200">
                ⚠️ Nodo CGNAT Móvil detectado ({geo.city}): en datos móviles varios usuarios comparten IP. Usa el bloqueo por
                <strong> Huella Digital ({data.deviceId ?? 'fp_...'})</strong> abajo para impedir el acceso desde ese teléfono o navegador aunque cambie de red.
              </p>
            )}
          </div>
        ) : (
          <p className="mt-4 rounded-2xl border border-white/10 bg-slate-950/40 p-3 text-xs font-semibold text-slate-400">
            {LOCAL_IPS.has(data.clientIp ?? '')
              ? 'IP no disponible en este registro (evento creado en entorno local o sin cabecera pública X-Forwarded-For).'
              : 'No se pudo consultar el operador de esta IP (puede ser privada o sin cobertura de datos públicos).'}
          </p>
        )}

        {/* GPS exacto vs ubicación de red */}
        {gpsUrl() ? (
          <a
            href={gpsUrl()}
            target="_blank"
            rel="noreferrer"
            className="pressable mt-3 flex items-center justify-center gap-2 rounded-2xl border border-impulso-emerald/30 bg-impulso-emerald/10 py-3 text-sm font-extrabold text-impulso-mint"
          >
            <Map className="h-4 w-4" />
            {data.clientLat != null ? '🗺️ Abrir punto EXACTO en Google Maps (GPS)' : '🗺️ Abrir ubicación de red en Google Maps'}
          </a>
        ) : (
          <p className="mt-3 rounded-2xl border border-white/10 bg-slate-950/40 p-3 text-[11px] font-semibold text-slate-500">
            Este usuario no compartió GPS y su IP no tiene coordenadas públicas.
          </p>
        )}

        {data.deviceId && (
          <button
            type="button"
            onClick={() => void blockByFingerprint()}
            disabled={blockingFp}
            className="pressable mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-impulso-rose/45 bg-impulso-rose/15 py-3 text-sm font-extrabold text-impulso-rose disabled:opacity-50"
          >
            {blockingFp ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldBan className="h-4 w-4" />}
            🔒 Bloquear por Huella Digital ({data.deviceId.slice(0, 14)}…)
          </button>
        )}

        <button
          onClick={() => {
            navigator.clipboard
              .writeText(buildLegalReport())
              .then(() => toast.success('📄 Reporte legal copiado al portapapeles'))
              .catch(() => toast.error('No se pudo copiar el reporte'));
          }}
          className="pressable mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-impulso-gold py-3 text-sm font-extrabold text-slate-950"
        >
          <Copy className="h-4 w-4" /> Copiar Reporte Legal / Policial
        </button>
        <p className="mt-2 text-center text-[10px] leading-relaxed text-slate-500">
          Informe conforme a la Ley 1581 de 2012 (datos personales) y la Ley 1273 de 2009 (delitos informáticos).
          Úsalo solo para denuncias reales o bloqueo definitivo.
        </p>
      </div>
    </ModalShell>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-slate-950/40 px-3 py-2">
      <span className="shrink-0 text-[11px] font-bold text-slate-500">{label}</span>
      <span
        className={`min-w-0 truncate text-right text-xs font-semibold text-white ${mono ? 'font-mono' : ''}`}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as unknown;
}

function toGeo(raw: IpWhoResponse | null, isLocalDemo: boolean): GeoResult {
  return {
    isp: raw?.connection?.isp ?? raw?.connection?.org ?? 'No disponible',
    city: raw?.city ?? '—',
    region: raw?.region ?? '—',
    country: raw?.country ?? '—',
    lat: typeof raw?.latitude === 'number' ? raw.latitude : null,
    lng: typeof raw?.longitude === 'number' ? raw.longitude : null,
    isLocalDemo,
  };
}
