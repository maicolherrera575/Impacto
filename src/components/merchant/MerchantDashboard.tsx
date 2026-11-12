import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  BellRing,
  Camera,
  CheckCircle2,
  Coins,
  Flame,
  History,
  Loader2,
  LocateFixed,
  LogOut,
  MapPin,
  MessageCircle,
  RefreshCw,
  Trash2,
  Undo2,
} from 'lucide-react';
import type { MerchantReservation, Offer, OfferForm, OfferStatus, Profile } from '../../types';
import { categoryMeta } from '../../types';
import { Stars } from '../ui/Stars';
import { ModalShell } from '../ui/ModalShell';
import { useToast } from '../ui/Toast';
import { fetchMerchantOffers } from '../../services/offers.service';
import {
  blockAbusiveClient,
  fetchMerchantReservations,
  updateReservation,
} from '../../services/reservations.service';
import { friendlyError, supabase } from '../../services/supabase';
import { compressImageToMicroWebP, compressionSummary } from '../../services/imageCompressor';
import { updateMyProfile } from '../../services/profile.service';
import { OfferCreator } from './OfferCreator';
import { LocationPicker } from './LocationPicker';
import { CreditsModal } from './CreditsModal';
import { countdownText, cx, formatCOP, ratingAvg } from '../../utils/format';
import { useTick } from '../../hooks/useTick';
import { beepAlert } from '../../utils/sound';
import { openWhatsApp, shareUrl } from '../../utils/whatsapp';
import { ADMIN_WHATSAPP } from '../../config/env';

interface MerchantDashboardProps {
  profile: Profile;
  onProfileChange: (profile: Profile) => void;
  onExit: () => void;
  onSignOut: () => Promise<void>;
  /** Abre el Panel de Administrador (solo cuenta con rol admin). */
  onOpenAdmin?: () => void;
}

/**
 * Centro de control del comerciante:
 *  - Creador Mágico con IA (texto/voz → oferta estructurada).
 *  - Reservas en vivo con alerta sonora nativa.
 *  - Créditos, republicación en 1 clic y recarga vía WhatsApp del admin.
 */
export function MerchantDashboard({ profile, onProfileChange, onExit, onSignOut, onOpenAdmin }: MerchantDashboardProps) {
  const toast = useToast();
  const now = useTick(1000);
  const [myOffers, setMyOffers] = useState<Offer[]>([]);
  const [reservations, setReservations] = useState<MerchantReservation[]>([]);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [initialForm, setInitialForm] = useState<OfferForm | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [confirmRelease, setConfirmRelease] = useState<MerchantReservation | null>(null);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [nitInput, setNitInput] = useState(profile.nit_or_cedula ?? '');
  const [socialInput, setSocialInput] = useState(profile.social_or_maps_link ?? '');
  const [trustBusy, setTrustBusy] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  /** Sube el logo comprimido a micro-WebP (160px) y lo guarda en el perfil. */
  const pickLogo = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setLogoBusy(true);
      try {
        const thumb = await compressImageToMicroWebP(file, 160, 0.66);
        const updated = await updateMyProfile({ logoThumb: thumb });
        onProfileChange(updated);
        toast.success(compressionSummary(file, thumb));
      } catch (err) {
        toast.error(friendlyError(err));
      } finally {
        setLogoBusy(false);
      }
    },
    [onProfileChange, toast]
  );

  const removeLogo = useCallback(async () => {
    setLogoBusy(true);
    try {
      const updated = await updateMyProfile({ logoThumb: '' });
      onProfileChange(updated);
      toast.info('Logo quitado. Tu emoji del rubro seguirá representándote');
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setLogoBusy(false);
    }
  }, [onProfileChange, toast]);

  const refreshReservations = useCallback(async () => {
    try {
      setReservations(await fetchMerchantReservations(profile.id));
    } catch (err) {
      console.warn('[Impulso] reservas:', friendlyError(err));
    }
  }, [profile.id]);

  const refreshOffers = useCallback(async () => {
    try {
      setMyOffers(await fetchMerchantOffers(profile.id));
    } catch (err) {
      console.warn('[Impulso] ofertas:', friendlyError(err));
    }
  }, [profile.id]);

  // Carga inicial + Realtime de reservas con alerta sonora
  useEffect(() => {
    void refreshReservations();
    void refreshOffers();

    const channel = supabase
      .channel(`merchant-${profile.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reservations', filter: `merchant_id=eq.${profile.id}` },
        () => {
          beepAlert();
          toast.push('🔔 ¡Nueva reserva! Alguien apartó tu producto', 'success');
          void refreshReservations();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'reservations', filter: `merchant_id=eq.${profile.id}` },
        () => void refreshReservations()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${profile.id}` },
        (payload) => {
          // Créditos verificación o suspensión aprobados por el admin: reflejo instantáneo
          if (payload.new) onProfileChange(payload.new as unknown as Profile);
        }
      )
      .subscribe();
    channelRef.current = channel;

    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id, refreshOffers, refreshReservations]);

  const pending = reservations.filter((r) => r.status === 'pending');
  const history = reservations.filter((r) => r.status !== 'pending');
  const activeOffers = myOffers.filter((o) => o.status === 'active' && new Date(o.expires_at).getTime() > now);
  const rating = ratingAvg(profile.rating_sum, profile.rating_count);

  // ── Motor de adicción: termómetro de dinero ganado (ROI en vivo + eterno) ─
  const totalSales = reservations
    .filter((r) => r.status !== 'released' && r.offer)
    .reduce((sum, r) => sum + r.quantity * Number(r.offer?.promo_price ?? 0), 0);
  const totalViews = myOffers.reduce((sum, o) => sum + o.views_count, 0);
  // Los acumuladores eternos de la BD garantizan que el contador NUNCA se
  // borre con la purga: se muestra el mayor entre lo vivo y lo histórico.
  const lifetimeSales = Math.max(totalSales, Number(profile.lifetime_sales_cop ?? 0));
  const lifetimeOrders = Math.max(reservations.length, Number(profile.lifetime_orders_count ?? 0));

  async function handleReservation(id: string, action: 'completed' | 'released') {
    setUpdating(id);
    const target = reservations.find((r) => r.id === id);
    try {
      await updateReservation(id, action);
      // Actualización optimista INMEDIATA: cero necesidad de F5
      if (target) {
        setReservations((prev) => prev.map((r) => (r.id === id ? { ...r, status: action } : r)));
        if (action === 'released') {
          setMyOffers((prev) =>
            prev.map((o) => {
              if (o.id !== target.offer_id) return o;
              const available = Math.min(o.total_quota, o.available_quota + target.quantity);
              const status: OfferStatus =
                o.status === 'sold_out' && available > 0 ? 'active' : o.status;
              return { ...o, available_quota: available, status };
            })
          );
        }
      }
      toast.success(action === 'completed' ? '✅ Pedido entregado' : '↩️ Stock devuelto al radar');
      // Refresco silencioso en segundo plano con los valores reales del servidor
      void refreshReservations();
      void refreshOffers();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setUpdating(null);
    }
  }

  /** Confirma la liberación en 2 pasos (evita toques accidentales en el celular). */
  async function confirmReleaseAction() {
    if (!confirmRelease) return;
    const target = confirmRelease;
    setConfirmRelease(null);
    await handleReservation(target.id, 'released');
  }

  /** 🚫 Bloquea a un cliente que hizo reservas falsas en tus ofertas. */
  async function blockClientOf(reservation: MerchantReservation) {
    try {
      await blockAbusiveClient({
        phone: reservation.customer_phone,
        deviceId: reservation.device_id,
        clientIp: reservation.client_ip,
      });
      toast.success('🚫 Cliente bloqueado: ya no podrá apartar en tus ofertas ni publicar pedidos');
    } catch (err) {
      toast.error(friendlyError(err));
    }
  }

  /** 💾 Guarda los datos de confianza del negocio (los revisa el admin con IA). */
  async function saveTrustData() {
    setTrustBusy(true);
    try {
      const updated = await updateMyProfile({ nitOrCedula: nitInput, socialOrMapsLink: socialInput });
      onProfileChange(updated);
      toast.success('✅ Datos de confianza guardados: el administrador los revisará con IA');
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setTrustBusy(false);
    }
  }

  /** 📲 Copia el texto magnético para el Estado de WhatsApp del comerciante. */
  async function copyStatus(offer: Offer) {
    const url = shareUrl(offer.id);
    const lines = [
      `${offer.emoji_icon} ${offer.title.toUpperCase()}`,
      offer.original_price != null && Number(offer.original_price) > Number(offer.promo_price)
        ? `❌ Antes ${formatCOP(offer.original_price)} → ✅ HOY ${formatCOP(offer.promo_price)}`
        : `✅ HOY solo ${formatCOP(offer.promo_price)}`,
      `🎟️ Quedan ${offer.available_quota} cupos`,
      `🏪 ${profile.business_name} · ${profile.municipality}`,
      `👉 ${url}`,
      'Aparta el tuyo YA en Impulso 📲✨',
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast.success('📲 Texto copiado: pégalo en tu Estado de WhatsApp y vende al instante');
    } catch {
      toast.error('No se pudo copiar el texto');
    }
  }

  function repeatOffer(offer: Offer) {
    setInitialForm({
      emoji_icon: offer.emoji_icon,
      category: offer.category,
      title: offer.title,
      description: offer.description,
      original_price: offer.original_price ? String(Math.round(Number(offer.original_price))) : '',
      promo_price: String(Math.round(Number(offer.promo_price))),
      total_quota: String(offer.total_quota),
      duration_hours: 3,
      image_thumb: null,
      delivery_type: offer.delivery_type,
    });
    setCreatorOpen(true);
  }

  const creditsLow = profile.credits <= 1;

  return (
    <div className="min-h-dvh pb-24">
      {/* Cabecera del panel */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-impulso-night/90 px-3 pt-3 backdrop-blur-xl">
        <div className="mx-auto max-w-xl">
          <div className="flex items-center gap-3 pb-3">
            <button
              onClick={onExit}
              className="pressable grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-impulso-panel text-slate-300"
              aria-label="Volver al radar"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-extrabold text-white">
                {profile.business_name} {profile.is_verified && '✅'}
              </p>
              <p className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                <span>⭐ {rating}</span>
                <span>·</span>
                <span>{categoryMeta(profile.category).label}</span>
                <span>·</span>
                <span>{profile.municipality}</span>
              </p>
            </div>
            <button
              onClick={() => void onSignOut()}
              title="Cerrar sesión"
              className="pressable grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-impulso-panel text-slate-400 hover:text-impulso-rose"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>

          {/* Métricas clave */}
          <div className="grid grid-cols-3 gap-2 pb-3">
            <button
              onClick={() => {
                setInitialForm(null);
                setCreatorOpen(true);
              }}
              className={cx(
                'pressable rounded-2xl border p-3 text-left',
                creditsLow ? 'border-impulso-rose/40 bg-impulso-rose/10' : 'border-impulso-emerald/30 bg-impulso-emerald/10'
              )}
            >
              <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <Coins className="h-3 w-3" /> Créditos
              </p>
              <p className={cx('text-2xl font-extrabold', creditsLow ? 'text-impulso-rose' : 'text-impulso-mint')}>
                {profile.credits}
              </p>
            </button>
            <div className="rounded-2xl border border-white/10 bg-impulso-panel p-3">
              <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <Flame className="h-3 w-3" /> Activas
              </p>
              <p className="text-2xl font-extrabold text-white">{activeOffers.length}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-impulso-panel p-3">
              <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <BellRing className="h-3 w-3" /> Pendientes
              </p>
              <p className={cx('text-2xl font-extrabold', pending.length > 0 ? 'text-impulso-gold' : 'text-white')}>
                {pending.length}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-5 px-3 pt-4">
        {/* Suspensión → aviso claro y canal directo */}
        {!profile.is_active && (
          <div className="rounded-3xl border border-impulso-rose/40 bg-impulso-rose/10 p-4">
            <p className="text-sm font-extrabold text-impulso-rose">⛔ Tu cuenta está suspendida temporalmente</p>
            <p className="mt-1 text-xs text-slate-300">
              Tus ofertas no aparecen en el radar. Si crees que es un error, escríbele al administrador.
            </p>
            <button
              onClick={() =>
                openWhatsApp(
                  ADMIN_WHATSAPP,
                  `Hola, soy ${profile.business_name}. Mi cuenta aparece suspendida en Impulso y quiero entender por qué 🙏`
                )
              }
              className="pressable mt-2.5 flex items-center gap-2 rounded-xl bg-impulso-rose py-2.5 px-4 text-xs font-extrabold text-white"
            >
              <MessageCircle className="h-4 w-4" /> Hablar con el administrador
            </button>
          </div>
        )}

        {/* 💰 Termómetro de impacto y ventas (ROI adictivo, histórico eterno) */}
        <section className="rounded-3xl border border-impulso-gold/40 bg-gradient-to-br from-impulso-gold/15 via-impulso-panel to-impulso-panel p-4">
          <p className="text-sm font-extrabold text-impulso-gold">💰 Tu Impacto y Ventas con Impulso</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-slate-950/50 p-2.5">
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Ventas generadas</p>
              <p className="mt-0.5 text-base font-extrabold text-impulso-mint tabular-nums tracking-tight">
                {formatCOP(lifetimeSales)}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-950/50 p-2.5">
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Clientes</p>
              <p className="mt-0.5 text-base font-extrabold text-white tabular-nums tracking-tight">{lifetimeOrders}</p>
            </div>
            <div className="rounded-2xl bg-slate-950/50 p-2.5">
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Interés 👀</p>
              <p className="mt-0.5 text-base font-extrabold text-white tabular-nums tracking-tight">{totalViews}</p>
            </div>
          </div>
          <p className="mt-2.5 text-xs font-semibold leading-relaxed text-slate-300">
            {lifetimeSales > 0
              ? creditsLow
                ? '🔥 ¡Tus ofertas están moviendo tu negocio! No te quedes sin créditos para el fin de semana.'
                : '🔥 ¡Vas en racha! Sigue publicando ofertas relámpago para no perder el impulso.'
              : '🚀 Publica tu primera oferta y este termómetro empieza a contar tu dinero en ventas.'}
          </p>
          <button
            onClick={() => setCreditsOpen(true)}
            className="pressable mt-2.5 flex w-full items-center justify-center gap-2 rounded-2xl bg-impulso-gold py-3 text-sm font-extrabold text-slate-950"
          >
            <MessageCircle className="h-4 w-4" /> Recargar créditos por Nequi
          </button>
        </section>

        {/* CTA principal */}
        <button
          onClick={() => {
            setInitialForm(null);
            setCreatorOpen(true);
          }}
          className="pressable flex w-full items-center justify-center gap-2 rounded-3xl bg-gradient-to-r from-impulso-emerald to-teal-600 py-4 text-base font-extrabold text-white shadow-glow"
        >
          ✨ Crear oferta con IA
        </button>

        {/* Créditos bajos → caja de recarga con IA Vision */}
        {creditsLow && (
          <button
            onClick={() => setCreditsOpen(true)}
            className="pressable flex w-full items-center justify-between gap-3 rounded-3xl border border-impulso-gold/40 bg-impulso-gold/10 p-4 text-left"
          >
            <div>
              <p className="text-sm font-extrabold text-impulso-gold">⚡ Recargar créditos</p>
              <p className="text-xs text-slate-300">Nequi / Daviplata · activación en minutos con IA</p>
            </div>
            <MessageCircle className="h-6 w-6 shrink-0 text-impulso-gold" />
          </button>
        )}

        {/* Apartados pendientes por entregar (se vacían al instante, sin F5) */}
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-slate-400">
            <BellRing className="h-4 w-4 text-impulso-gold" /> Apartados pendientes por entregar
            {pending.length > 0 && (
              <span className="rounded-full bg-impulso-gold/15 px-2 py-0.5 text-[10px] font-bold text-impulso-gold">
                {pending.length} activas
              </span>
            )}
          </h2>
          {pending.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 bg-impulso-panel/60 p-6 text-center">
              <p className="text-2xl">🛎️</p>
              <p className="mt-1.5 text-sm font-semibold text-slate-300">
                Suena una campanita cada vez que un cliente aparte 🎟️
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {pending.map((r) => (
                <article key={r.id} className="rounded-3xl border border-impulso-gold/30 bg-impulso-gold/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold text-white">
                        {r.offer?.emoji_icon ?? '🛒'} {r.offer?.title ?? 'Oferta'} · ×{r.quantity}
                      </p>
                      <p className="truncate text-xs font-semibold text-slate-400">
                        👤 {r.customer_name} · 📞 {r.customer_phone}
                      </p>
                      {(r.device_id || r.client_ip) && (
                        <p className="truncate text-[10px] font-semibold text-slate-500">
                          💻 {r.device_id ? `…${r.device_id.slice(-6)}` : '—'} · 🌐{' '}
                          {r.client_ip ? `…${r.client_ip.slice(-8)}` : '—'}
                        </p>
                      )}
                      {r.customer_note && <p className="mt-1 text-xs italic text-slate-500">“{r.customer_note}”</p>}
                      <p className="mt-1 font-mono text-lg font-extrabold tracking-[0.2em] text-impulso-gold">
                        {r.reservation_code}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-bold text-slate-300">
                      🟡 Pendiente
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => openWhatsApp(r.customer_phone, `Hola ${r.customer_name}! Confirmamos tu reserva ${r.reservation_code} en ${profile.business_name} 🙌`)}
                      className="pressable flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#25D366] py-2.5 text-xs font-extrabold text-white"
                    >
                      <MessageCircle className="h-4 w-4" /> Contactar
                    </button>
                    <button
                      onClick={() => void handleReservation(r.id, 'completed')}
                      disabled={updating === r.id}
                      className="pressable flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-impulso-emerald py-2.5 text-xs font-extrabold text-white disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Entregado
                    </button>
                    <button
                      onClick={() => setConfirmRelease(r)}
                      disabled={updating === r.id}
                      className="pressable flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-slate-950/40 py-2.5 text-xs font-bold text-slate-300 disabled:opacity-50"
                    >
                      <Undo2 className="h-4 w-4" /> Liberar
                    </button>
                    <button
                      onClick={() => void blockClientOf(r)}
                      title="🚫 Bloquear cliente sospechoso (dispositivo, IP y teléfono)"
                      className="pressable grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-impulso-rose/30 bg-impulso-rose/5 text-xs text-impulso-rose/80 hover:text-impulso-rose"
                    >
                      🚫
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Historial de entregados/liberados hoy (se actualiza en vivo) */}
        {history.length > 0 && (
          <section>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-slate-400">
              <History className="h-4 w-4 text-impulso-mint" /> Historial de entregados / liberados
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold text-slate-400">
                {history.length}
              </span>
            </h2>
            <div className="space-y-2">
              {history.slice(0, 10).map((r) => (
                <article
                  key={r.id}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-impulso-card p-3 opacity-80"
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-950/50 text-base">
                    {r.offer?.emoji_icon ?? '🛒'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-white">
                      {r.offer?.title ?? 'Oferta'} · ×{r.quantity} · {r.customer_name}
                    </p>
                    <p className="font-mono text-[10px] font-bold tracking-[0.2em] text-slate-500">
                      {r.reservation_code}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-white/5 px-2 py-1 text-[10px] font-bold text-slate-300">
                    {r.status === 'completed' ? '✅ Entregado' : '↩️ Liberado'}
                  </span>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Historial + republicación */}
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-slate-400">
            <History className="h-4 w-4 text-impulso-mint" /> Mis últimas ofertas
          </h2>
          {myOffers.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 bg-impulso-panel/60 p-6 text-center text-sm text-slate-400">
              Publica tu primera oferta y aparecerá aquí para republicarla en 1 clic.
            </div>
          ) : (
            <div className="space-y-2.5">
              {myOffers.map((o) => {
                const cd = countdownText(o.expires_at, now);
                return (
                  <article key={o.id} className="flex items-center gap-3 rounded-3xl border border-white/10 bg-impulso-card p-3.5">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-950/50 text-xl">
                      {o.emoji_icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-white">{o.title}</p>
                      <p className="text-xs font-semibold text-slate-400">
                        {formatCOP(o.promo_price)} · {o.status === 'active' && !cd.expired ? cd.text : '⏳ Finalizada'} ·{' '}
                        {o.views_count} 👀
                      </p>
                    </div>
                    <button
                      onClick={() => void copyStatus(o)}
                      title="📲 Texto listo para tu Estado de WhatsApp"
                      className="pressable grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-slate-950/40 text-sm"
                    >
                      📲
                    </button>
                    <button
                      onClick={() => repeatOffer(o)}
                      title="Republicar esta oferta"
                      className="pressable flex shrink-0 items-center gap-1.5 rounded-xl border border-impulso-emerald/40 bg-impulso-emerald/10 px-3 py-2 text-xs font-extrabold text-impulso-mint"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Repetir
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Ubicación y legal */}
        <section className="flex items-center justify-between rounded-3xl border border-white/10 bg-impulso-panel p-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-bold text-white">
              <MapPin className="h-4 w-4 text-impulso-mint" /> Ubicación del negocio
            </p>
            <p className="truncate text-xs text-slate-400">
              {profile.address_reference ?? 'Casco Urbano'} · {profile.municipality}
            </p>
          </div>
          <button
            onClick={() => setPickerOpen(true)}
            className="pressable flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-xs font-bold text-slate-200"
          >
            <LocateFixed className="h-3.5 w-3.5" />
            Ubicar en el mapa
          </button>
        </section>

        {/* Logo del negocio (micro-WebP < 20 KB, comprimido en el navegador) */}
        <section className="flex items-center justify-between rounded-3xl border border-white/10 bg-impulso-panel p-4">
          <div className="flex min-w-0 items-center gap-3">
            {profile.logo_thumb ? (
              <img src={profile.logo_thumb} alt="Logo del negocio" className="h-11 w-11 rounded-xl object-cover" />
            ) : (
              <span className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-slate-950/50 text-xl">
                {categoryMeta(profile.category).emoji}
              </span>
            )}
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-bold text-white">
                <Camera className="h-4 w-4 text-impulso-mint" /> Logo del negocio
              </p>
              <p className="truncate text-xs text-slate-400">
                {profile.logo_thumb ? 'Tu marca ya se ve en el radar' : 'Aparece junto a tu nombre en todo el pueblo'}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <label className="pressable flex cursor-pointer items-center gap-1.5 rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-xs font-bold text-slate-200">
              {logoBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
              Subir
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void pickLogo(e.target.files?.[0])}
              />
            </label>
            {profile.logo_thumb && (
              <button
                onClick={() => void removeLogo()}
                title="Quitar logo"
                aria-label="Quitar logo"
                className="pressable grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-slate-950/40 text-slate-400 hover:text-impulso-rose"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </section>

        {/* Calificación del comercio */}
        <section className="flex items-center justify-between rounded-3xl border border-white/10 bg-impulso-panel p-4">
          <div>
            <p className="text-sm font-bold text-white">Reputación</p>
            <p className="text-xs text-slate-400">
              {profile.rating_count} calificación{profile.rating_count === 1 ? '' : 'es'} recibida
              {profile.rating_count === 1 ? '' : 's'}
            </p>
          </div>
          <Stars value={Number(rating)} size="md" />
        </section>

        {/* 🪪 Datos de confianza: el admin los audita con IA para verificar más rápido */}
        <section className="rounded-3xl border border-white/10 bg-impulso-panel p-4">
          <p className="text-sm font-bold text-white">🪪 Datos de confianza (recomendados)</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            El administrador audita estos datos con IA para otorgarte la insignia ✅ Verificado más rápido: tu NIT o
            cédula y un link de tu Facebook, Instagram o Google Maps.
          </p>
          <div className="mt-3 space-y-2">
            <input
              value={nitInput}
              onChange={(e) => setNitInput(e.target.value)}
              placeholder="NIT o cédula (ej: 900123456-7 o 1023456789)"
              className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm font-medium text-white placeholder:text-slate-600 outline-none focus:border-impulso-emerald/60"
            />
            <input
              value={socialInput}
              onChange={(e) => setSocialInput(e.target.value)}
              placeholder="Link de Facebook / Instagram / Google Maps"
              className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm font-medium text-white placeholder:text-slate-600 outline-none focus:border-impulso-emerald/60"
            />
            <button
              onClick={() => void saveTrustData()}
              disabled={trustBusy}
              className="pressable flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-impulso-emerald to-teal-600 py-3 text-sm font-extrabold text-white disabled:opacity-60"
            >
              {trustBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : '💾'} Guardar datos de confianza
            </button>
          </div>
        </section>

        {/* Panel de Administrador: solo visible con el rol admin (asignado en la BD) */}
        {profile.role === 'admin' && onOpenAdmin && (
          <button
            onClick={onOpenAdmin}
            className="pressable flex w-full items-center justify-between rounded-3xl border border-impulso-gold/30 bg-impulso-gold/10 p-4 text-left"
          >
            <div>
              <p className="flex items-center gap-1.5 text-sm font-bold text-impulso-gold">
                🛡️ Panel de Administrador
              </p>
              <p className="text-xs text-amber-200/60">
                Recargar créditos · Verificar ✅ · Suspender comercios
              </p>
            </div>
            <span className="shrink-0 rounded-xl bg-impulso-gold/20 px-3 py-2 text-xs font-bold text-impulso-gold">
              Abrir
            </span>
          </button>
        )}
      </main>

      {/* Creador Mágico */}
      <OfferCreator
        open={creatorOpen}
        onClose={() => {
          setCreatorOpen(false);
          setInitialForm(null);
        }}
        profile={profile}
        initialForm={initialForm}
        onPublished={() => {
          void refreshOffers();
          // Reconsultar perfil para reflejar créditos en vivo
          void supabase
            .from('profiles')
            .select('*')
            .eq('id', profile.id)
            .single()
            .then(({ data }) => {
              if (data) onProfileChange(data as unknown as Profile);
            });
        }}
      />

      {/* Ubicación del negocio en el mapa */}
      <LocationPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        profile={profile}
        onProfileChange={onProfileChange}
      />

      {/* Caja de recarga de créditos (Nequi + IA Vision) */}
      <CreditsModal open={creditsOpen} onClose={() => setCreditsOpen(false)} profile={profile} />

      {/* Confirmación en 2 pasos de "Liberar" (evita toques accidentales) */}
      <ModalShell open={confirmRelease !== null} onClose={() => !updating && setConfirmRelease(null)}>
        {confirmRelease && (
          <div className="p-5 pt-14 text-center">
            <p className="text-4xl">⚠️</p>
            <h3 className="mt-2 text-lg font-extrabold text-white">
              ¿Confirmas que {confirmRelease.customer_name} (código {confirmRelease.reservation_code}) no recogió el
              pedido?
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-400">
              Al confirmar, este apartado se cerrará y las {confirmRelease.quantity} unidades volverán a estar
              disponibles en tu oferta activa.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => setConfirmRelease(null)}
                disabled={updating !== null}
                className="pressable rounded-2xl border border-white/10 bg-slate-950/40 py-3.5 text-sm font-bold text-slate-200 disabled:opacity-50"
              >
                Volver
              </button>
              <button
                onClick={() => void confirmReleaseAction()}
                disabled={updating !== null}
                className="pressable flex items-center justify-center gap-2 rounded-2xl bg-impulso-rose py-3.5 text-sm font-extrabold text-white disabled:opacity-60"
              >
                {updating !== null ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Sí, liberar y recuperar stock'}
              </button>
            </div>
          </div>
        )}
      </ModalShell>
    </div>
  );
}
