import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';

import type { Offer, Profile, QuickRequest, Ticket } from './types';
import type { Tab } from './types/navigation';
import { municipioCenter } from './types';

import { supabase, friendlyError } from './services/supabase';
import { fetchActiveOffers, fetchOfferById, reportOffer, autoPruneData } from './services/offers.service';
import { fetchActiveRequests } from './services/requests.service';
import { cancelMyReservation, fetchTicketStatuses } from './services/reservations.service';
import { fetchMyProfile, ensureMyProfile, signOut } from './services/profile.service';

import { useGeolocation } from './utils/geo';
import type { LatLng } from './utils/geo';
import { formatCOP } from './utils/format';
import { shareText, shareUrl } from './utils/whatsapp';
import { loadTickets, patchTicket, removeTicket, saveTicket } from './utils/storage';

import { Navbar } from './components/layout/Navbar';
import { BottomNav } from './components/layout/BottomNav';
import { RadarTab } from './components/radar/RadarTab';
import { RequestsTab } from './components/requests/RequestsTab';
import { ReservationsTab } from './components/reservations/ReservationsTab';
import { OfferDetailModal } from './components/offers/OfferDetailModal';
import { AuthModal } from './components/auth/AuthModal';
import { LegalModal } from './components/legal/LegalModal';
import { AdminPanel } from './components/admin/AdminPanel';
import { MerchantDashboard } from './components/merchant/MerchantDashboard';
import { useToast } from './components/ui/Toast';

/**
 * Impulso — Radar comercial en vivo.
 * Orquesta el estado global de la plataforma: sesión, radar, pedidos,
 * tickets locales y modales. Los datos se mantienen al día con Supabase
 * Realtime (ofertas, reservas y pedidos de la comunidad).
 */
export default function App() {
  const toast = useToast();

  // ── Navegación ────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<Tab>('ofertas');
  const [view, setView] = useState<'radar' | 'dashboard'>('radar');

  // ── Datos en vivo ─────────────────────────────────────────────────────────
  const [offers, setOffers] = useState<Offer[]>([]);
  const [requests, setRequests] = useState<QuickRequest[]>([]);
  const [municipality, setMunicipality] = useState('Gachetá');

  // ── Sesión / permisos / modales ───────────────────────────────────────────
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>(() => loadTickets());

  const geo = useGeolocation();

  // ── Interceptor de errores de URL (enlaces expirados o denegados) ────────
  // Si Supabase redirige con #error=access_denied&error_code=otp_expired,
  // la cadena fea desaparece de la barra y el vecino recibe un mensaje amable.
  useEffect(() => {
    const { search, hash } = window.location;
    const hasError = /error=|error_code=/i.test(search) || /error=|error_code=/i.test(hash);
    if (hasError) {
      window.history.replaceState(null, '', window.location.pathname);
      toast.info('ℹ️ El enlace anterior ya expiró. Puedes iniciar sesión directamente con tu correo y contraseña.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-compactación de la base de datos (1 vez cada 12 horas) ──────────
  useEffect(() => {
    const PRUNE_KEY = 'impulso:last_db_prune';
    const TWELVE_HOURS = 12 * 60 * 60 * 1000;
    try {
      if (Date.now() - Number(localStorage.getItem(PRUNE_KEY) ?? 0) < TWELVE_HOURS) return;
    } catch {
      return;
    }
    autoPruneData()
      .then(() => {
        localStorage.setItem(PRUNE_KEY, String(Date.now()));
      })
      .catch(() => {
        /* silencioso: la limpieza no debe molestar nunca al usuario */
      });
  }, []);

  // ── Perfil autenticado (con auto-sanación: nunca más pantalla en blanco) ──
  const loadProfile = useCallback(async (userId: string) => {
    try {
      let p = await fetchMyProfile(userId);
      if (!p) {
        // El trigger no creó el perfil (ejecución parcial del SQL): lo creamos solos
        p = await ensureMyProfile();
      }
      if (p) {
        setProfile(p);
        setProfileError(null);
      } else {
        setProfileError(
          'Tu cuenta existe, pero no encontramos tu perfil en la base de datos. Ejecuta supabase_schema.sql completo en el SQL Editor de Supabase y vuelve a intentar.'
        );
      }
    } catch (err) {
      console.warn('[Impulso] perfil:', friendlyError(err));
      setProfileError(`No pudimos cargar tu perfil: ${friendlyError(err)}`);
    }
  }, []);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) void loadProfile(data.session.user.id);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) void loadProfile(session.user.id);
      else setProfile(null);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  // ── Radar de ofertas (fetch + Realtime) ──────────────────────────────────
  const refetchOffers = useCallback(async () => {
    try {
      setOffers(await fetchActiveOffers(municipality));
    } catch (err) {
      console.warn('[Impulso] ofertas:', friendlyError(err));
    }
  }, [municipality]);

  useEffect(() => {
    void refetchOffers();
    const channel = supabase
      .channel('impulso:offers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'offers' }, () => void refetchOffers())
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [refetchOffers]);

  // ── Pedidos de la comunidad (fetch + Realtime) ───────────────────────────
  const refetchRequests = useCallback(async () => {
    try {
      setRequests(await fetchActiveRequests(municipality));
    } catch (err) {
      console.warn('[Impulso] pedidos:', friendlyError(err));
    }
  }, [municipality]);

  useEffect(() => {
    void refetchRequests();
    const channel = supabase
      .channel('impulso:quick_requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quick_requests' }, () => void refetchRequests())
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [refetchRequests]);

  // ── Deep linking viral: ?oferta=UUID ─────────────────────────────────────
  useEffect(() => {
    const offerId = new URLSearchParams(window.location.search).get('oferta');
    if (!offerId) return;
    void (async () => {
      try {
        const offer = await fetchOfferById(offerId);
        if (offer) setSelectedOffer(offer);
      } catch (err) {
        console.warn('[Impulso] deep link:', friendlyError(err));
      }
      window.history.replaceState({}, '', window.location.pathname);
    })();
  }, []);

  // ── Acciones ──────────────────────────────────────────────────────────────
  const handleReserved = useCallback((ticket: Ticket) => {
    setTickets(saveTicket(ticket));
  }, []);

  const handleRate = useCallback(async (ticket: Ticket) => {
    setTickets(patchTicket(ticket.reservationId, { isRated: true }));
  }, []);

  const handleRemoveTicket = useCallback((reservationId: string) => {
    setTickets(removeTicket(reservationId));
  }, []);

  /**
   * Cancelación del cliente: la RPC devuelve el cupo al comercio y el
   * ticket desaparece del dispositivo. Cero necesidad de recargar.
   */
  const handleCancelTicket = useCallback(
    async (ticket: Ticket) => {
      await cancelMyReservation(ticket.reservationId, ticket.code);
      setTickets(removeTicket(ticket.reservationId));
      void refetchOffers();
    },
    [refetchOffers]
  );

  // ── Estado en vivo de los tickets (el cliente no tiene cuenta: sondeo RPC) ─
  useEffect(() => {
    if (tickets.length === 0) return;
    let cancelled = false;

    const sync = async () => {
      try {
        const rows = await fetchTicketStatuses(tickets.map((t) => t.reservationId));
        if (cancelled) return;
        const byId = new Map(rows.map((r) => [r.id, r]));
        for (const t of tickets) {
          const row = byId.get(t.reservationId);
          if (!row) continue;
          if (row.status !== t.status || (row.is_rated && !t.isRated)) {
            setTickets(patchTicket(t.reservationId, { status: row.status, isRated: row.is_rated || t.isRated }));
            if (t.status === 'pending' && row.status !== 'pending') {
              toast.push(
                row.status === 'completed' ? '✅ ¡Tu pedido fue entregado!' : '🔄 El comercio liberó tu apartado',
                'info'
              );
              void refetchOffers();
            }
          }
        }
      } catch (err) {
        console.warn('[Impulso] tickets:', friendlyError(err));
      }
    };

    const timer = window.setInterval(() => void sync(), 25000);
    void sync();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickets]);

  const shareOffer = useCallback(
    async (offer: Offer) => {
      const url = shareUrl(offer.id);
      const text = shareText(offer.title, offer.emoji_icon, formatCOP(offer.promo_price), offer.merchant?.business_name ?? 'un comercio local');
      try {
        if (navigator.share) {
          await navigator.share({ title: offer.title, text, url });
        } else {
          await navigator.clipboard.writeText(`${text} 👉 ${url}`);
          toast.success('Enlace copiado: pégalo en WhatsApp 📲');
        }
      } catch {
        /* El usuario canceló compartir: sin fricción */
      }
    },
    [toast]
  );

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
    } finally {
      setProfile(null);
      setView('radar');
      setAdminOpen(false);
      toast.info('Sesión cerrada. ¡Vuelve pronto! 👋');
    }
  }, [toast]);

  /** Reporte comunitario 🚩: con 3 reportes la oferta se tumba sola. */
  const handleReportOffer = useCallback(
    async (offer: Offer) => {
      try {
        const res = await reportOffer(offer.id);
        if (res.cancelled) {
          toast.info('🚩 Oferta tumbada por la comunidad. Gracias por proteger el pueblo');
        } else {
          toast.success(`🚩 Reporte registrado (${res.reports}). Con 3 se retira del radar`);
        }
        void refetchOffers();
      } catch (err) {
        toast.error(friendlyError(err));
      }
    },
    [toast, refetchOffers]
  );

  /** 📲 Texto magnético para el Estado de WhatsApp (viral, 1 clic). */
  const handleStatusShare = useCallback(
    async (offer: Offer) => {
      const url = shareUrl(offer.id);
      const lines = [
        `${offer.emoji_icon} ${offer.title.toUpperCase()}`,
        offer.original_price != null && Number(offer.original_price) > Number(offer.promo_price)
          ? `❌ Antes ${formatCOP(offer.original_price)} → ✅ HOY ${formatCOP(offer.promo_price)}`
          : `✅ HOY solo ${formatCOP(offer.promo_price)}`,
        `🎟️ Quedan ${offer.available_quota} cupos`,
        `🏪 ${offer.merchant?.business_name ?? 'Comercio local'} · ${offer.municipality}`,
        `👉 ${url}`,
        'Aparta el tuyo YA en Impulso 📲✨',
      ];
      try {
        await navigator.clipboard.writeText(lines.join('\n'));
        toast.success('📲 Texto copiado: pégalo en tu Estado de WhatsApp y vendes al instante');
      } catch {
        toast.error('No se pudo copiar. Mantén presionado para copiar manualmente');
      }
    },
    [toast]
  );

  // ── Punto de referencia del mapa (GPS con fallback al casco urbano) ──────
  const mapCenter = useMemo<LatLng>(
    () => (geo.status === 'active' && geo.pos ? geo.pos : municipioCenter(municipality)),
    [geo.status, geo.pos, municipality]
  );

  const pendingTickets = useMemo(() => tickets.filter((t) => t.status === 'pending').length, [tickets]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-impulso-night">
      {view === 'radar' ? (
        <>
          <Navbar
            municipality={municipality}
            onMunicipality={setMunicipality}
            geoStatus={geo.status}
            geoPos={geo.pos}
            onGeoRequest={geo.request}
            profile={profile}
            onOpenAuth={() => setAuthOpen(true)}
            onOpenDashboard={() => {
              if (profile) setView('dashboard');
              else setAuthOpen(true);
            }}
            onOpenAdmin={() => {
              if (profile?.role === 'admin') setAdminOpen(true);
            }}
            onSignOut={() => void handleSignOut()}
          />

          <main className="pb-24 pt-[72px]">
            {tab === 'ofertas' && (
              <RadarTab
                offers={offers}
                center={mapCenter}
                geoPos={geo.status === 'active' && geo.pos ? geo.pos : null}
                onSelectOffer={setSelectedOffer}
                onShareOffer={(o) => void shareOffer(o)}
                onStatusOffer={(o) => void handleStatusShare(o)}
                onReportOffer={(o) => void handleReportOffer(o)}
              />
            )}
            {tab === 'pedir' && (
              <RequestsTab
                requests={requests}
                municipality={municipality}
                geoPos={geo.status === 'active' && geo.pos ? geo.pos : null}
                onCreated={() => void refetchRequests()}
              />
            )}
            {tab === 'apartados' && (
              <ReservationsTab
                tickets={tickets}
                onRate={handleRate}
                onRemove={handleRemoveTicket}
                onCancel={(t) => handleCancelTicket(t)}
              />
            )}

            {/* Pie editorial + blindaje legal */}
            <footer className="mx-auto mt-6 max-w-xl px-3 pb-2 text-center">
              <button
                onClick={() => setLegalOpen(true)}
                className="mx-auto flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 transition hover:text-slate-300"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Términos y política de datos · Ley 1581 de 2012
              </button>
              <p className="mt-1 text-[10px] text-slate-600">
                Impulso es una plataforma informativa de difusión y reserva previa, sin intermediación financiera.
              </p>
            </footer>
          </main>

          <BottomNav active={tab} onChange={setTab} pendingTickets={pendingTickets} />
        </>
      ) : profile ? (
        <MerchantDashboard
          profile={profile}
          onProfileChange={setProfile}
          onExit={() => setView('radar')}
          onSignOut={handleSignOut}
          onOpenAdmin={() => setAdminOpen(true)}
        />
      ) : (
        <div className="grid min-h-dvh place-items-center px-4">
          {profileError ? (
            <div className="max-w-sm text-center">
              <p className="text-4xl">🛠️</p>
              <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-300">{profileError}</p>
              <div className="mt-5 flex flex-col gap-2">
                <button
                  onClick={() => {
                    setProfileError(null);
                    void supabase.auth.getUser().then(({ data }) => {
                      if (data.user) void loadProfile(data.user.id);
                    });
                  }}
                  className="rounded-2xl bg-impulso-emerald px-5 py-3 text-sm font-bold text-slate-950 transition hover:brightness-110"
                >
                  Reintentar
                </button>
                <button
                  onClick={() => setView('radar')}
                  className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/5"
                >
                  Volver al radar
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-impulso-emerald" />
              <p className="mt-3 text-sm font-semibold text-slate-400">Preparando tu panel…</p>
            </div>
          )}
        </div>
      )}

      {/* Modales globales */}
      <OfferDetailModal
        offer={selectedOffer}
        geoPos={geo.status === 'active' && geo.pos ? geo.pos : null}
        onClose={() => setSelectedOffer(null)}
        onReserved={handleReserved}
        onViewTickets={() => {
          setView('radar');
          setTab('apartados');
        }}
      />
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthed={() => setView('dashboard')}
        onOpenLegal={() => setLegalOpen(true)}
      />
      <LegalModal open={legalOpen} onClose={() => setLegalOpen(false)} />
      <AdminPanel open={adminOpen} onClose={() => setAdminOpen(false)} profile={profile} onProfileChange={setProfile} />
    </div>
  );
}
