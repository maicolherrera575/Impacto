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
  /** Reporte comunitario 🚩 de una oferta. */
  onReportOffer: (offer: Offer) => void;
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
}: RadarTabProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Category | 'all'>('all');

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
        <div className="no-scrollbar -mx-3 mt-3 flex gap-2 overflow-x-auto px-3 pb-1 lg:mx-0 lg:px-0">
          <button
            onClick={() => setCategory('all')}
            className={cx(
              'pressable shrink-0 rounded-full border px-4 py-2 text-xs font-bold',
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
                'pressable shrink-0 rounded-full border px-4 py-2 text-xs font-bold',
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
            />
          ))
        )}
      </div>
    </section>
  );
}
