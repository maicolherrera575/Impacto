/**
 * 🏪 PERFIL PÚBLICO DEL COMERCIO (V13) — se abre con el deep link ?comercio=ID
 * desde los QR de los afiches, desde las tarjetas de oferta y desde el detalle.
 * Muestra: identidad verificada, ubicación + distancia GPS, contacto directo
 * por WhatsApp, compartir perfil y el catálogo de ofertas activas del local.
 */

import { useState } from 'react';
import { Navigation, Share2, ShieldCheck, Star } from 'lucide-react';
import type { Offer, Profile } from '../../types';
import { categoryMeta } from '../../types';
import { ModalShell } from '../ui/ModalShell';
import { useToast } from '../ui/Toast';
import { distanceText, haversineMeters } from '../../utils/geo';
import type { LatLng } from '../../utils/geo';
import { cx, formatCOP, ratingAvg } from '../../utils/format';
import { waLink } from '../../utils/whatsapp';

interface MerchantProfileModalProps {
  /** Perfil completo del comercio (fetch por id desde ?comercio=). */
  merchant: Profile | null;
  /** Ofertas activas del comercio (la App las carga junto con el perfil). */
  offers: Offer[];
  /** GPS del dispositivo para calcular la distancia al local. */
  geoPos?: LatLng | null;
  onClose: () => void;
  /** Centra el Mapa Radar en este comercio y cambia a la vista radar. */
  onFocusMap?: () => void;
  /** Abre el detalle de una oferta del catálogo (reserva en 1 clic). */
  onOpenOffer?: (offer: Offer) => void;
}

/**
 * Perfil verificado del comercio con su catálogo vivo: el destino oficial
 * de los QR "Perfil Impulso" de los afiches de la agencia IA.
 */
export function MerchantProfileModal({ merchant, offers, geoPos, onClose, onFocusMap, onOpenOffer }: MerchantProfileModalProps) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const profileUrl = merchant
    ? `${window.location.origin}${window.location.pathname}?comercio=${merchant.id}`
    : '';

  const dist =
    merchant && geoPos && merchant.lat != null && merchant.lng != null
      ? distanceText(haversineMeters(geoPos, { lat: merchant.lat, lng: merchant.lng }))
      : null;

  async function shareProfile(): Promise<void> {
    if (!merchant) return;
    const data: ShareData = {
      title: `${merchant.business_name} en Impulso`,
      text: `🏪 Conoce ${merchant.business_name} (${categoryMeta(merchant.category).label}) en ${merchant.municipality} — perfil oficial, ubicación y ofertas en Impulso`,
      url: profileUrl,
    };
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share(data);
        return;
      }
      throw new Error('no-share');
    } catch {
      try {
        await navigator.clipboard.writeText(profileUrl);
        setCopied(true);
        toast.success('🔗 Enlace del perfil copiado: pégalo en WhatsApp o donde quieras');
        setTimeout(() => setCopied(false), 4000);
      } catch {
        toast.error('No se pudo copiar el enlace: inténtalo de nuevo');
      }
    }
  }

  return (
    <ModalShell open={!!merchant} onClose={onClose} size="lg" escClose closeLabel="Cerrar perfil">
      {merchant && (() => {
        const cat = categoryMeta(merchant.category);
        const rating = ratingAvg(merchant.rating_sum ?? 5, merchant.rating_count ?? 1);
        return (
          <div className="animate-fade-in p-5">
            {/* ── Cabecera: identidad + verificación + rating ── */}
            <div className="flex items-start gap-4">
              {merchant.logo_thumb ? (
                <img
                  src={merchant.logo_thumb}
                  alt={merchant.business_name}
                  className="h-16 w-16 shrink-0 rounded-2xl border border-white/10 object-cover"
                />
              ) : (
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-white/10 bg-slate-950/50 text-4xl">
                  {cat.emoji}
                </div>
              )}
              <div className="min-w-0 flex-1">
                {merchant.is_verified ? (
                  <span className="flex items-center gap-1.5 rounded-full bg-impulso-emerald/15 px-2.5 py-1 text-[11px] font-extrabold text-impulso-mint">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Comercio Verificado en Impulso
                  </span>
                ) : (
                  <span className="rounded-full bg-impulso-gold/10 px-2.5 py-1 text-[11px] font-bold text-amber-200/90">
                    🛡️ En verificación local
                  </span>
                )}
                <h2 className="mt-1.5 truncate text-xl font-extrabold leading-tight text-white">
                  {merchant.business_name}
                </h2>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-semibold text-slate-400">
                  <span className="flex items-center gap-1 text-impulso-gold">
                    <Star className="h-3 w-3" fill="currentColor" />
                    {rating} {merchant.rating_count > 0 ? `· ${merchant.rating_count} reseña${merchant.rating_count === 1 ? '' : 's'}` : ''}
                  </span>
                  <span>·</span>
                  <span>{cat.emoji} {cat.label}</span>
                  <span>·</span>
                  <span>📍 {merchant.municipality}</span>
                </p>
              </div>
            </div>

            {/* ── Ubicación: referencia, distancia GPS y ruta ── */}
            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/40 p-3.5">
              <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Ubicación del local</p>
              <p className="mt-1.5 text-sm font-bold text-white">
                🏠 {merchant.address_reference?.trim() || 'Dirección de referencia no registrada'}
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-400">
                {dist ?? (merchant.lat != null && merchant.lng != null ? '📍 Activa el GPS para ver tu distancia' : '📍 Ubicación exacta disponible en el mapa')}
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {onFocusMap && (
                  <button
                    onClick={onFocusMap}
                    className="pressable flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-950/40 py-2.5 text-xs font-extrabold text-impulso-mint transition hover:bg-impulso-emerald/10"
                  >
                    🗺️ Ver en el Mapa Radar de Impulso
                  </button>
                )}
                {merchant.lat != null && merchant.lng != null && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${merchant.lat},${merchant.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className={cx(
                      'pressable flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-950/40 py-2.5 text-xs font-extrabold text-impulso-mint transition hover:bg-impulso-emerald/10',
                      !onFocusMap && 'sm:col-span-2',
                    )}
                  >
                    <Navigation className="h-3.5 w-3.5" />
                    Cómo llegar con Google Maps
                  </a>
                )}
              </div>
            </div>

            {/* ── Contacto directo: WhatsApp + compartir perfil ── */}
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {merchant.whatsapp && (
                <a
                  href={waLink(
                    merchant.whatsapp,
                    `Hola ${merchant.business_name}! 👋 Vi tu perfil oficial en Impulso y quiero más información sobre tus ofertas 🙌`,
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="pressable flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-impulso-emerald to-teal-600 py-3 text-sm font-extrabold text-white shadow-glow"
                >
                  💬 Escribirle por WhatsApp
                </a>
              )}
              <button
                onClick={shareProfile}
                className="pressable flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-slate-950/40 py-3 text-sm font-extrabold text-slate-200 transition hover:bg-impulso-emerald/10"
              >
                <Share2 className="h-4 w-4" />
                {copied ? '✅ Enlace copiado' : '🔗 Compartir Perfil'}
              </button>
            </div>

            {/* ── Catálogo de ofertas activas del comercio ── */}
            <div className="mt-5">
              <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                🔥 Ofertas activas del local ({offers.length})
              </p>
              {offers.length === 0 ? (
                <p className="mt-2 rounded-2xl border border-white/10 bg-slate-950/40 p-3.5 text-center text-xs font-semibold text-slate-400">
                  Este comercio no tiene ofertas activas ahora mismo.
                  <br />
                  💬 Escríbele directo al WhatsApp para preguntar por sus promociones.
                </p>
              ) : (
                <div className="mt-2 space-y-2">
                  {offers.map((o) => (
                    <div
                      key={o.id}
                      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-3"
                    >
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/5 text-2xl">
                        {o.emoji_icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-white">{o.title}</p>
                        <p className="flex items-baseline gap-2 text-xs">
                          {o.original_price != null && Number(o.original_price) > Number(o.promo_price) && (
                            <span className="font-medium text-slate-500 line-through">{formatCOP(o.original_price)}</span>
                          )}
                          <span className="text-base font-extrabold text-impulso-mint tabular-nums">
                            {o.promo_price > 0 ? formatCOP(o.promo_price) : 'Cotización'}
                          </span>
                          <span className="font-semibold text-slate-400">· Quedan {o.available_quota}</span>
                        </p>
                      </div>
                      {onOpenOffer && (
                        <button
                          onClick={() => onOpenOffer(o)}
                          className="pressable shrink-0 rounded-xl bg-impulso-emerald/15 px-3 py-2 text-[11px] font-extrabold text-impulso-mint transition hover:bg-impulso-emerald/25"
                        >
                          Apartar el mío YA
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className="mt-4 text-center text-[10px] font-semibold text-slate-600">
              Perfil oficial verificado en Impulso · {merchant.municipality} 🇨🇴
            </p>
          </div>
        );
      })()}
    </ModalShell>
  );
}
