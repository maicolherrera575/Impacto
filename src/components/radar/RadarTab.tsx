import { useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Search, ShieldCheck } from 'lucide-react';
import type { Category, Offer } from '../../types';
import { CATEGORIES } from '../../types';
import { LiveMap } from './LiveMap';
import { OfferCard } from '../offers/OfferCard';
import { EXACT_GPS_WARNING, haversineMeters } from '../../utils/geo';
import type { GeoStatus, LatLng } from '../../utils/geo';
import { cx } from '../../utils/format';

interface RadarTabProps {
  offers: Offer[];
  center: LatLng;
  geoPos: LatLng | null;
  /** Estado del GPS para el botón 🎯 flotante del mapa. */
  geoStatus: GeoStatus;
  /** True mientras el navegador busca la lectura exacta del GPS. */
  geoLocating?: boolean;
  /** Precisión actual en metros (solo informativa en UI). */
  geoAccuracy?: number | null;
  /** Advertencia o error explícito del GPS (ej. ubicación aproximada > 1000m). */
  geoError?: string | null;
  /** Solicita permiso y lectura exacta al navegador. */
  onGeoRequest: () => void;
  /** Apaga/revoca la ubicación efímera (Ley 1581). */
  onGeoRevoke?: () => void;
  /** Abre la guía visual paso a paso de Ubicación Exacta. */
  onOpenGpsGuide?: () => void;
  /** Token para forzar el recentrado del mapa (cambio de municipio). */
  recenterToken: number;
  onSelectOffer: (offer: Offer) => void;
  onShareOffer: (offer: Offer) => void;
  /** 📲 Texto para el Estado de WhatsApp en 1 clic. */
  onStatusOffer: (offer: Offer) => void;
  /** Reporte comunitario 🛡️ de una oferta (abre el modal de motivos). */
  onReportOffer: (offer: Offer) => void;
  /** Ofertas ya reportadas desde este dispositivo (botón deshabilitado). */
  reportedIds: Set<string>;
  /** V13 · Abre el Perfil Público del comercio desde la tarjeta. */
  onOpenMerchant: (merchantId: string) => void;
}

/** Pestaña 1: Radar de ofertas en vivo (mapa + filtros + tarjetas). */
export function RadarTab({
  offers,
  center,
  geoPos,
  geoStatus,
  geoLocating = false,
  geoAccuracy = null,
  geoError = null,
  onGeoRequest,
  onGeoRevoke,
  onOpenGpsGuide,
  recenterToken,
  onSelectOffer,
  onShareOffer,
  onStatusOffer,
  onReportOffer,
  reportedIds,
  onOpenMerchant,
}: RadarTabProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [gpsDeniedLocal, setGpsDeniedLocal] = useState(
    () => {
      try {
        return localStorage.getItem('impulso_gps_consent') === 'denied';
      } catch {
        return false;
      }
    },
  );

  /** Activa el GPS exacto directamente dentro del gesto de clic del usuario. */
  function grantGpsConsent(): void {
    try {
      localStorage.setItem('impulso_gps_consent', 'granted');
    } catch {
      /* almacenamiento no disponible */
    }
    setGpsDeniedLocal(false);
    onGeoRequest();
  }

  /** Explora sin GPS: se respeta y limpia cualquier coordenada en memoria. */
  function skipGps(): void {
    try {
      localStorage.setItem('impulso_gps_consent', 'denied');
    } catch {
      /* almacenamiento no disponible */
    }
    setGpsDeniedLocal(true);
    onGeoRevoke?.();
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = offers.filter((o) => {
      if (category !== 'all' && o.category !== category) return false;
      if (!q) return true;
      const haystack = `${o.title} ${o.description} ${o.merchant?.business_name ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });

    if (geoPos) {
      return [...filtered].sort(
        (a, b) => haversineMeters(geoPos, { lat: a.lat, lng: a.lng }) - haversineMeters(geoPos, { lat: b.lat, lng: b.lng }),
      );
    }
    return filtered;
  }, [offers, search, category, geoPos]);

  const warningText = geoStatus === 'inexact' ? EXACT_GPS_WARNING : geoError;

  return (
    <section className="mx-auto max-w-6xl px-3 pt-3 lg:flex lg:items-start lg:gap-6">
      {/* Columna izquierda: mapa + búsqueda + filtros (anclada en escritorio) */}
      <div className="lg:sticky lg:top-20 lg:w-[46%] lg:shrink-0">
        <LiveMap
          offers={visible}
          center={center}
          geoPos={geoPos}
          geoStatus={geoStatus}
          locating={geoLocating}
          onGeoRequest={grantGpsConsent}
          recenterToken={recenterToken}
          onSelect={onSelectOffer}
        />

        {/* Advertencia clara cuando el navegador solo concede ubicación aproximada o bloqueada */}
        {warningText && !geoPos && (
          <div className="mt-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-3.5 text-amber-100" role="alert">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold leading-relaxed">{warningText}</p>
                {geoStatus === 'inexact' && geoAccuracy != null && (
                  <p className="mt-1 text-[11px] font-semibold text-amber-200/80">
                    Señal detectada con margen de error de ±{geoAccuracy.toLocaleString('es-CO')} m (máximo permitido: 1.500 m).
                  </p>
                )}
              </div>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={grantGpsConsent}
                disabled={geoLocating}
                className="pressable flex items-center gap-1.5 rounded-xl bg-amber-400 px-3 py-2 text-[11px] font-extrabold text-slate-950 disabled:opacity-60"
              >
                {geoLocating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '🔄'}
                Reintentar ubicación exacta
              </button>
              {onOpenGpsGuide && (
                <button
                  type="button"
                  onClick={onOpenGpsGuide}
                  className="pressable rounded-xl border border-amber-300/40 bg-slate-950/50 px-3 py-2 text-[11px] font-bold text-amber-200"
                >
                  🛠️ Cómo activar Ubicación Exacta
                </button>
              )}
            </div>
          </div>
        )}

        {/* Indicador cuando el GPS exacto está activo (solo en memoria del navegador) */}
        {geoPos && geoStatus === 'active' && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl border border-impulso-emerald/30 bg-impulso-emerald/10 px-3.5 py-2.5">
            <p className="flex items-center gap-2 text-[11px] font-bold text-impulso-mint">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span>
                Radar exacto activo{geoAccuracy != null ? ` (±${geoAccuracy} m)` : ''} · Solo en tu pantalla (Ley 1581)
              </span>
            </p>
            <button
              type="button"
              onClick={skipGps}
              className="pressable shrink-0 rounded-lg border border-white/10 bg-slate-950/50 px-2.5 py-1 text-[10px] font-bold text-slate-300 hover:text-white"
            >
              Apagar
            </button>
          </div>
        )}

        {/* Radar de Cercanía VOLUNTARIO (Ley 1581 de 2012) */}
        {!geoPos && !gpsDeniedLocal && geoStatus !== 'active' && (
          <div className="mt-3 rounded-2xl border border-impulso-emerald/25 bg-impulso-emerald/[0.06] p-3.5">
            <p className="text-xs font-semibold leading-relaxed text-slate-300">
              📍 <span className="font-extrabold text-impulso-mint">Radar de Cercanía Voluntario:</span> si deseas ver a
              cuántos metros estás de cada local, autoriza tu <strong className="text-white">ubicación exacta</strong>.
              (Efímera en tu navegador, jamás se guarda en base de datos — Ley 1581 de 2012).
            </p>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={grantGpsConsent}
                disabled={geoLocating}
                className="pressable flex items-center justify-center gap-1.5 rounded-xl bg-impulso-emerald py-2.5 px-3 text-xs font-extrabold text-slate-950 shadow-glow disabled:opacity-60"
              >
                {geoLocating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {geoLocating ? 'Buscando señal exacta…' : '📍 Encontrar ofertas exactas cerca de mí'}
              </button>
              <button
                type="button"
                onClick={skipGps}
                className="pressable rounded-xl border border-white/10 bg-slate-950/40 py-2.5 text-xs font-extrabold text-slate-400"
              >
                ✕ Explorar sin GPS
              </button>
            </div>
          </div>
        )}

        {/* Si eligió explorar sin GPS, siempre queda el botón directo */}
        {gpsDeniedLocal && !geoPos && (
          <button
            type="button"
            onClick={grantGpsConsent}
            disabled={geoLocating}
            className="pressable mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-impulso-emerald/30 bg-impulso-emerald/10 py-2.5 text-xs font-extrabold text-impulso-mint disabled:opacity-60"
          >
            {geoLocating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {geoLocating ? 'Solicitando ubicación exacta…' : '📍 Encontrar ofertas exactas cerca de mí'}
          </button>
        )}

        {/* Búsqueda instantánea */}
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Busca: trucha, flete, abono, pandebono…"
            className="w-full rounded-2xl border border-white/10 bg-impulso-panel py-3.5 pl-11 pr-4 text-[15px] font-medium text-white placeholder:text-slate-500 outline-none focus:border-impulso-emerald/60"
            aria-label="Buscar ofertas"
          />
        </div>

        {/* Filtros por categoría */}
        <div className="-mx-3 mt-3 flex items-center gap-2 overflow-x-auto touch-pan-x overscroll-x-contain scroll-smooth py-1.5 px-3 -mb-1.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0">
          <button
            onClick={() => setCategory('all')}
            className={cx(
              'pressable shrink-0 whitespace-nowrap select-none rounded-full border px-4 py-2 text-xs font-bold',
              category === 'all'
                ? 'border-impulso-emerald/50 bg-impulso-emerald/15 text-impulso-mint'
                : 'border-white/10 bg-impulso-panel text-slate-400',
            )}
          >
            ✨ Todo
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={cx(
                'pressable shrink-0 whitespace-nowrap select-none rounded-full border px-4 py-2 text-xs font-bold',
                category === c.id
                  ? 'border-impulso-emerald/50 bg-impulso-emerald/15 text-impulso-mint'
                  : 'border-white/10 bg-impulso-panel text-slate-400',
              )}
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Columna derecha: listado de ofertas */}
      <div className="mt-3 min-w-0 flex-1 space-y-3 pb-2 lg:mt-0">
        {visible.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 bg-impulso-panel/60 p-8 text-center">
            <p className="text-3xl">🛰️</p>
            <p className="mt-2 font-bold text-white">Sin ofertas en este radar</p>
            <p className="mt-1 text-sm text-slate-400">
              Prueba otro municipio o categoría. Los comercios están publicando ofertas relámpago todo el día.
            </p>
          </div>
        ) : (
          visible.map((offer) => (
            <OfferCard
              key={offer.id}
              offer={offer}
              distance={geoPos ? haversineMeters(geoPos, { lat: offer.lat, lng: offer.lng }) : null}
              onOpen={() => onSelectOffer(offer)}
              onShare={() => onShareOffer(offer)}
              onStatus={() => onStatusOffer(offer)}
              onReport={() => onReportOffer(offer)}
              reported={reportedIds.has(offer.id)}
              onOpenMerchant={onOpenMerchant}
            />
          ))
        )}
      </div>
    </section>
  );
}
