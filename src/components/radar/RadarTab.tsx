import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { Category, Offer } from '../../types';
import { CATEGORIES } from '../../types';
import { LiveMap } from './LiveMap';
import { OfferCard } from '../offers/OfferCard';
import { haversineMeters } from '../../utils/geo';
import type { GeoStatus, LatLng } from '../../utils/geo';
import { cx } from '../../utils/format';

interface RadarTabProps {
  offers: Offer[];
  center: LatLng;
  geoPos: LatLng | null;
  /** Estado del GPS para el botón 🎯 flotante del mapa. */
  geoStatus: GeoStatus;
  /** Reintenta el permiso de ubicación (botón 🎯 del mapa). */
  onGeoRequest: () => void;
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
  onGeoRequest,
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
  /** 📍 V18 · GPS VOLUNTARIO: el permiso SOLO se pide con clic explícito.
   *  El consentimiento queda guardado; "sin GPS" oculta la tarjeta. */
  const [gpsDeniedLocal, setGpsDeniedLocal] = useState(
    () => localStorage.getItem('impulso_gps_consent') === 'denied',
  );

  /** Activa el GPS solo con consentimiento explícito y lo recuerda. */
  function grantGpsConsent(): void {
    localStorage.setItem('impulso_gps_consent', 'granted');
    setGpsDeniedLocal(false);
    onGeoRequest();
  }

  /** Explora sin GPS: se respeta y no se vuelve a preguntar. */
  function skipGps(): void {
    localStorage.setItem('impulso_gps_consent', 'denied');
    setGpsDeniedLocal(true);
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
        (a, b) => haversineMeters(geoPos, { lat: a.lat, lng: a.lng }) - haversineMeters(geoPos, { lat: b.lat, lng: b.lng })
      );
    }
    return filtered;
  }, [offers, search, category, geoPos]);

  return (
    <section className="mx-auto max-w-6xl px-3 pt-3 lg:flex lg:items-start lg:gap-6">
      {/* Columna izquierda: mapa + búsqueda + filtros (anclada en escritorio) */}
      <div className="lg:sticky lg:top-20 lg:w-[46%] lg:shrink-0">
        <LiveMap
          offers={visible}
          center={center}
          geoPos={geoPos}
          geoStatus={geoStatus}
          onGeoRequest={onGeoRequest}
          recenterToken={recenterToken}
          onSelect={onSelectOffer}
        />

        {/* 📍 V18 · Radar de Cercanía VOLUNTARIO (Ley 1581 de 2012):
            el permiso de GPS se pide SOLO con consentimiento explícito. */}
        {!geoPos && !gpsDeniedLocal && geoStatus !== 'active' && (
          <div className="mt-3 rounded-2xl border border-impulso-emerald/25 bg-impulso-emerald/[0.06] p-3.5">
            <p className="text-xs font-semibold leading-relaxed text-slate-300">
              📍 <span className="font-extrabold text-impulso-mint">Radar de Cercanía Voluntario:</span> si deseas ver a
              cuántos metros estás de cada local y ver tu punto en el mapa, activa tu ubicación aquí. (Uso exclusivo en
              tu pantalla, conforme a la Ley 1581 de 2012).
            </p>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                onClick={grantGpsConsent}
                className="pressable rounded-xl bg-impulso-emerald py-2.5 text-xs font-extrabold text-slate-950"
              >
                📍 Activar mi ubicación ahora
              </button>
              <button
                onClick={skipGps}
                className="pressable rounded-xl border border-white/10 bg-slate-950/40 py-2.5 text-xs font-extrabold text-slate-400"
              >
                ✕ Explorar sin GPS
              </button>
            </div>
          </div>
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

        {/* Filtros por categoría (V18 · swipe táctil fluido en celular, wrap en PC) */}
        <div className="-mx-3 mt-3 flex items-center gap-2 overflow-x-auto touch-pan-x overscroll-x-contain scroll-smooth py-1.5 px-3 -mb-1.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0">
          <button
            onClick={() => setCategory('all')}
            className={cx(
              'pressable shrink-0 whitespace-nowrap select-none rounded-full border px-4 py-2 text-xs font-bold',
              category === 'all'
                ? 'border-impulso-emerald/50 bg-impulso-emerald/15 text-impulso-mint'
                : 'border-white/10 bg-impulso-panel text-slate-400'
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
                  : 'border-white/10 bg-impulso-panel text-slate-400'
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
