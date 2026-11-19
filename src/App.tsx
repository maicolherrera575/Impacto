import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';

import type { ClientPreferences, Offer, Profile, QuickRequest, Ticket } from './types';
import { MUNICIPIOS, municipioCenter } from './types';
import type { Tab } from './types/navigation';

import { supabase, friendlyError } from './services/supabase';
import {
  fetchActiveOffers,
  fetchActiveOffersByMerchant,
  fetchOfferById,
  reportOffer,
  autoPruneData,
} from './services/offers.service';
import { fetchActiveRequests } from './services/requests.service';
import { cancelMyReservation, fetchTicketStatuses } from './services/reservations.service';
import { fetchMyProfile, ensureMyProfile, fetchPublicProfileById, signOut } from './services/profile.service';
import {
  loadLocalClientPreferences,
  mergeClientPreferences,
  persistClientPreferencesNow,
  saveLocalClientPreferences,
  scheduleSyncClientPreferences,
} from './services/preferences.service';

import { useGeolocation } from './utils/geo';
import type { LatLng } from './utils/geo';
import { formatCOP } from './utils/format';
import { decodeShortUuid } from './utils/shortId';
import { shareText, shareUrl } from './utils/whatsapp';
import { loadTickets, patchTicket, removeTicket, saveTicket } from './utils/storage';

import { Navbar } from './components/layout/Navbar';
import { BottomNav } from './components/layout/BottomNav';
import { GpsGuideModal } from './components/layout/GpsGuideModal';
import { RadarTab } from './components/radar/RadarTab';
import { RequestsTab } from './components/requests/RequestsTab';
import { ReservationsTab } from './components/reservations/ReservationsTab';
import { OfferDetailModal } from './components/offers/OfferDetailModal';
import { ReportModal } from './components/offers/ReportModal';
import { MerchantProfileModal } from './components/radar/MerchantProfileModal';
import { SupportConcierge } from './components/support/SupportConcierge';
import { ClientProfileModal } from './components/client/ClientProfileModal';
import { AuthModal } from './components/auth/AuthModal';
import { LegalModal } from './components/legal/LegalModal';
import { AdminPanel } from './components/admin/AdminPanel';
import { MerchantDashboard } from './components/merchant/MerchantDashboard';
import { useToast } from './components/ui/Toast';
import { useModalHistory } from './hooks/useModalHistory';

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
  /** IDs recién publicados vía Realtime (animación suave de entrada en el radar). */
  const [freshOfferIds, setFreshOfferIds] = useState<Set<string>>(() => new Set());
  const [requests, setRequests] = useState<QuickRequest[]>([]);
  const [municipality, setMunicipality] = useState('Gachetá');

  // ── Sesión / permisos / modales ───────────────────────────────────────────
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [offerModalInitialStep, setOfferModalInitialStep] = useState<'detail' | 'form'>('detail');
  const [radarExternalPrompt, setRadarExternalPrompt] = useState<{ text: string; seq: number } | null>(null);
  /** V13 · Perfil Público del comercio (?comercio=UUID) + su catálogo vivo. */
  const [selectedMerchant, setSelectedMerchant] = useState<Profile | null>(null);
  const [merchantOffers, setMerchantOffers] = useState<Offer[]>([]);
  /** V13/V37 · Enfoque del mapa: coordenadas + oferta exacta ("Ver en mapa"). */
  const [mapFocus, setMapFocus] = useState<LatLng | null>(null);
  const [focusedOffer, setFocusedOffer] = useState<Offer | null>(null);
  const [focusToken, setFocusToken] = useState(0);
  /** 🛍️ V37 · Preferencias ligeras y modal exclusivo de Comprador (separado del Comercio). */
  const [clientPrefs, setClientPrefs] = useState<ClientPreferences>(() => loadLocalClientPreferences());
  const [clientProfileOpen, setClientProfileOpen] = useState(false);
  const [forYouTriggerSeq, setForYouTriggerSeq] = useState(0);
  const [authOpen, setAuthOpen] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>(() => loadTickets());
  /** Token de recentrado del mapa: sube al cambiar de municipio. */
  const [recenterToken, setRecenterToken] = useState(0);
  /** 🛡️ Reporte comunitario: oferta esperando motivo en el ReportModal. */
  const [reporting, setReporting] = useState<Offer | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  /** Ofertas ya reportadas desde este dispositivo (dedupe visual). */  const [reportedIds, setReportedIds] = useState<Set<string>>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('impulso:reported_offers') ?? '[]');
      return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []);
    } catch {
      return new Set();
    }
  });
  /** 📡 Guía de "Ubicación exacta" (se abre sola si el GPS llega aproximado). */
  const [gpsGuideOpen, setGpsGuideOpen] = useState(false);

  const geo = useGeolocation();

  // Botón "Atrás" en móvil regresa del Panel del Comerciante al Radar sin salir de la app
  useModalHistory(view === 'dashboard', () => setView('radar'));

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
        // Si la sesión ya quedó autenticada (ej. Passkey/biometría), cerramos AuthModal limpio sin errores
        setAuthOpen(false);
        // Si es cuenta de Comprador, jamás dejarlo atrapado en la vista del Panel Comercial
        if (p.role === 'client') {
          setView('radar');
        }
        // Fusionar preferencias ligeras del comprador (0 lecturas extra: ya vienen en profiles)
        if (p.client_preferences) {
          setClientPrefs((prev) => saveLocalClientPreferences(mergeClientPreferences(prev, p.client_preferences)));
        }
      } else {
        setProfileError(
          'Tu cuenta existe, pero no encontramos tu perfil comercial todavía. Intenta nuevamente o contacta al equipo de soporte.'
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

  // ── Radar de ofertas (Edge CDN adaptativo 15s→30s→60s + Realtime debounced 1.5s) ──
  const offersSigRef = useRef('');
  const lastOffersSyncAtRef = useRef(0);
  const lastUserActivityAtRef = useRef(Date.now());
  const syncInFlightRef = useRef(false);

  const applyOffersIfChanged = useCallback((next: Offer[]) => {
    const sig = next
      .map((o) => `${o.id}:${o.available_quota}:${o.promo_price}:${o.status}:${o.expires_at}:${o.title}`)
      .join('|');
    if (sig !== offersSigRef.current) {
      offersSigRef.current = sig;
      setOffers(next);
    }
  }, []);

  const refetchOffers = useCallback(
    async (forceFresh = false, opts?: { bypassClientCache?: boolean; edgeOnly?: boolean }) => {
      if (syncInFlightRef.current && !forceFresh) return;
      syncInFlightRef.current = true;
      try {
        const next = await fetchActiveOffers(municipality, {
          forceFresh,
          bypassClientCache: opts?.bypassClientCache,
          edgeOnly: opts?.edgeOnly,
        });
        lastOffersSyncAtRef.current = Date.now();
        applyOffersIfChanged(next);
      } catch (err) {
        console.warn('[Impulso] ofertas:', friendlyError(err));
      } finally {
        syncInFlightRef.current = false;
      }
    },
    [municipality, applyOffersIfChanged],
  );

  useEffect(() => {
    offersSigRef.current = '';
    void refetchOffers(false);
    // Debounce de 1.5s (V36 Free Tier Resilience): agrupa ráfagas de Realtime
    // (vistas, apartados simultáneos) para no saturar consultas ni provocar re-renders.
    let timer: number | null = null;
    let pollTimer: number | null = null;
    const clearTimers: number[] = [];
    const scheduleRefetch = (payload?: { eventType?: string; new?: Record<string, unknown> }) => {
      if (payload?.eventType === 'INSERT' && payload.new && typeof payload.new.id === 'string') {
        const newId = payload.new.id;
        const insertedMuni = typeof payload.new.municipality === 'string' ? payload.new.municipality : null;
        if (!insertedMuni || insertedMuni === municipality) {
          const title = typeof payload.new.title === 'string' ? payload.new.title : 'Oferta relámpago';
          setFreshOfferIds((prev) => new Set(prev).add(newId));
          toast.info(`⚡ Nueva oferta en vivo (${municipality}): ${title}`);
          const t = window.setTimeout(() => {
            setFreshOfferIds((prev) => {
              if (!prev.has(newId)) return prev;
              const next = new Set(prev);
              next.delete(newId);
              return next;
            });
          }, 7000);
          clearTimers.push(t);
        }
      }
      if (timer != null) window.clearTimeout(timer);
      timer = window.setTimeout(() => void refetchOffers(true), 1500);
    };
    const channel = supabase
      .channel('impulso:offers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'offers' }, (payload) =>
        scheduleRefetch(payload as { eventType?: string; new?: Record<string, unknown> }),
      )
      .subscribe();

    // ⚡ V39.0 · Auto-Sync Adaptativo vía Edge CDN (15s activo -> 30s tibio -> 60s inactivo -> 0s oculto):
    // garantiza que ofertas nuevas o [DEMO] aparezcan en celulares sin recargar y sin saturar Supabase Free.
    const markActivity = () => {
      lastUserActivityAtRef.current = Date.now();
    };
    const computeNextIntervalMs = (): number => {
      const idleMs = Date.now() - lastUserActivityAtRef.current;
      const base = idleMs < 120_000 ? 15_000 : idleMs < 300_000 ? 30_000 : 60_000;
      const jitter = Math.floor(Math.random() * 2_500);
      return base + jitter;
    };
    const scheduleNextPoll = () => {
      if (pollTimer != null) window.clearTimeout(pollTimer);
      pollTimer = window.setTimeout(() => {
        if (document.visibilityState === 'visible' && navigator.onLine !== false) {
          void refetchOffers(false, { bypassClientCache: true, edgeOnly: true });
        }
        scheduleNextPoll();
      }, computeNextIntervalMs());
    };
    const handleResumeSync = () => {
      if (document.visibilityState === 'visible') {
        markActivity();
        if (Date.now() - lastOffersSyncAtRef.current >= 10_000) {
          void refetchOffers(false, { bypassClientCache: true, edgeOnly: true });
        }
      }
    };

    scheduleNextPoll();
    window.addEventListener('pointerdown', markActivity, { passive: true });
    window.addEventListener('keydown', markActivity, { passive: true });
    window.addEventListener('scroll', markActivity, { passive: true });
    window.addEventListener('online', handleResumeSync);
    document.addEventListener('visibilitychange', handleResumeSync);

    return () => {
      if (timer != null) window.clearTimeout(timer);
      if (pollTimer != null) window.clearTimeout(pollTimer);
      clearTimers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener('pointerdown', markActivity);
      window.removeEventListener('keydown', markActivity);
      window.removeEventListener('scroll', markActivity);
      window.removeEventListener('online', handleResumeSync);
      document.removeEventListener('visibilitychange', handleResumeSync);
      void supabase.removeChannel(channel);
    };
  }, [refetchOffers, municipality, toast]);

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

  // ── Deep linking viral: ?o=ID_CORTO o ?oferta=UUID ────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rawOffer = params.get('o') || params.get('oferta');
    const offerId = rawOffer ? decodeShortUuid(rawOffer) : '';
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

  // ── V13/V25 · Deep linking del Perfil Público: ?c=ID_CORTO o ?comercio=UUID ─
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rawMerchant = params.get('c') || params.get('comercio');
    const merchantId = rawMerchant ? decodeShortUuid(rawMerchant) : '';
    if (!merchantId) return;
    void (async () => {
      try {
        const [m, offs] = await Promise.all([
          fetchPublicProfileById(merchantId),
          fetchActiveOffersByMerchant(merchantId),
        ]);
        if (!m) {
          toast.error('🏪 No encontramos ese comercio en el radar de Impulso');
        } else if (m.is_active === false || m.is_suspended === true) {
          toast.error('🏪 Este comercio no está disponible temporalmente');
        } else {
          setMerchantOffers(offs);
          setSelectedMerchant(m);
        }
      } catch (err) {
        console.warn('[Impulso] deep link comercio:', friendlyError(err));
      }
      window.history.replaceState({}, '', window.location.pathname);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
                row.status === 'completed'
                  ? '✅ ¡Tu pedido fue marcado como Vendido / Entregado!'
                  : '✕ Pedido cancelado / vuelto a stock por el comercio',
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

  // ── Ubicación EXACTA nativa (Ley 1581 · cero modal intrusivo):
  //   • Al abrir la app NO se solicita GPS; solo cuando el usuario pulsa el botón verde.
  //   • Solo si error.code === 1 o accuracy > 1500m se muestra un aviso amable no bloqueante.
  useEffect(() => {
    if (geo.requestSeq === 0) return;
    if (geo.errorCode === 1) {
      toast.info(
        geo.errorMessage ||
          'Para calcular distancias, requerimos tu ubicación. Si la bloqueaste antes, toca el candado en la barra de direcciones para habilitarla.'
      );
    } else if (geo.status === 'inexact') {
      toast.info('Por favor, activa la ubicación exacta para medir distancias reales.');
    } else if (geo.errorMessage) {
      toast.info(geo.errorMessage);
    }
  }, [geo.requestSeq, geo.status, geo.errorCode, geo.errorMessage, toast]);

  useEffect(() => {
    if (geo.status === 'active' && gpsGuideOpen) {
      setGpsGuideOpen(false);
      toast.success('🎯 ¡Ubicación exacta activada! Radar preciso en vivo');
    }
  }, [geo.status, gpsGuideOpen, toast]);

  /** 🎯 Botón de GPS (barra superior + mapa + tarjeta): pide ubicación exacta directa. */
  const handleGeoRequest = useCallback(() => {
    geo.request();
  }, [geo]);

  /**
   * Reporte comunitario v2 🛡️: llega con motivo confirmado en el modal.
   * Doble anti-doble-conteo: el servidor deduplica por dispositivo Y
   * localmente marcamos la oferta para deshabilitar el botón al instante.
   */
  const handleReportConfirm = useCallback(
    async (reason: string, detail: string) => {
      const offer = reporting;
      if (!offer) return;
      setReportBusy(true);
      try {
        const res = await reportOffer(offer.id, reason, detail || null);
        if (res.already) {
          toast.info('✋ Ya habías reportado esta oferta desde este dispositivo. ¡Gracias igual! 🙏');
        } else {
          const next = new Set(reportedIds);
          next.add(offer.id);
          setReportedIds(next);
          try {
            localStorage.setItem('impulso:reported_offers', JSON.stringify([...next]));
          } catch {
            /* almacenamiento no disponible: el servidor deduplica igual */
          }
          if (res.cancelled) {
            toast.info('🚩 Oferta pausada para revisión por reportes verificados. Gracias por proteger la comunidad');
          } else {
            toast.success('🛡️ Reporte recibido y enviado a auditoría del administrador (protegido contra reportes falsos)');
          }
        }
        setReporting(null);
        void refetchOffers();
      } catch (err) {
        toast.error(friendlyError(err));
      } finally {
        setReportBusy(false);
      }
    },
    [reporting, reportedIds, toast, refetchOffers]
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

  /** Cambio de municipio: refresca datos y recentra el radar con fuerza. */
  const handleMunicipality = useCallback((name: string) => {
    setMunicipality(name);
    setMapFocus(null);
    setFocusedOffer(null);
    setRecenterToken((t) => t + 1);
  }, []);

  /**
   * V13 · Abre el Perfil Público de un comercio: trae el perfil completo
   * (lat/lng, dirección, verificación) + sus ofertas activas en paralelo.
   */
  const openMerchantProfile = useCallback(async (merchantId: string) => {
    try {
      const [m, offs] = await Promise.all([
        fetchPublicProfileById(merchantId),
        fetchActiveOffersByMerchant(merchantId),
      ]);
      if (!m) {
        toast.error('🏪 No encontramos ese comercio en el radar de Impulso');
        return;
      }
      if (m.is_active === false || m.is_suspended === true) {
        toast.error('🏪 Este comercio no está disponible temporalmente');
        return;
      }
      setMerchantOffers(offs);
      setSelectedMerchant(m);
    } catch (err) {
      toast.error(friendlyError(err));
    }
  }, [toast]);

  /**
   * V13/V37 · "Ver en el Mapa Radar": cierra el perfil, salta a la pestaña de
   * ofertas y centra el radar en las coordenadas exactas del comercio.
   */
  const handleFocusMerchantMap = useCallback(() => {
    const m = selectedMerchant;
    const firstOffer = merchantOffers[0] ?? null;
    setSelectedMerchant(null);
    setView('radar');
    setTab('ofertas');
    if (m?.lat != null && m?.lng != null) setMapFocus({ lat: m.lat, lng: m.lng });
    if (firstOffer) {
      setFocusedOffer(firstOffer);
      setFocusToken((t) => t + 1);
    }
    if (m && MUNICIPIOS.some((x) => x.name === m.municipality)) setMunicipality(m.municipality);
    setRecenterToken((t) => t + 1);
  }, [selectedMerchant, merchantOffers]);

  /**
   * 🎯 V37.0 · Salto real "Ver en mapa" desde Radar / Favoritos:
   *  1) Vuelve al radar principal y a la pestaña 'ofertas'.
   *  2) Fija coordenadas + oferta exacta (`focusedOffer` + `focusToken`) para hacer `flyTo`,
   *     resaltar el pin con halo pulsante y abrir la tarjeta flotante en el mapa.
   */
  const handleFocusOfferOnMap = useCallback((offer: Offer) => {
    setView('radar');
    setTab('ofertas');
    if (offer.lat != null && offer.lng != null) {
      setMapFocus({ lat: offer.lat, lng: offer.lng });
    }
    setFocusedOffer(offer);
    setFocusToken((t) => t + 1);
    if (offer.municipality && MUNICIPIOS.some((x) => x.name === offer.municipality)) {
      setMunicipality(offer.municipality);
    }
    setRecenterToken((t) => t + 1);
    toast.info(`📍 Mapa centrado en ${offer.merchant?.business_name ?? offer.title}`);
  }, [toast]);

  const handleToggleFavorite = useCallback(
    (offerId: string) => {
      setClientPrefs((prev) => {
        const exists = prev.favoriteOfferIds.includes(offerId);
        const nextIds = exists
          ? prev.favoriteOfferIds.filter((id) => id !== offerId)
          : [offerId, ...prev.favoriteOfferIds].slice(0, 20);
        const saved = saveLocalClientPreferences({ ...prev, favoriteOfferIds: nextIds });
        scheduleSyncClientPreferences(saved, Boolean(profile?.id));
        toast.info(exists ? '💔 Quitada de tus favoritos' : '❤️ Guardada en tus favoritos');
        return saved;
      });
    },
    [profile?.id, toast],
  );

  const handleSaveClientPreferences = useCallback(
    async (next: ClientPreferences, applyFilterNow = false) => {
      const saved = await persistClientPreferencesNow(next, Boolean(profile?.id));
      setClientPrefs(saved);
      if (applyFilterNow) {
        setView('radar');
        setTab('ofertas');
        setForYouTriggerSeq((s) => s + 1);
      }
    },
    [profile?.id],
  );

  const handleOpenOfferQuickReserve = useCallback((offer: Offer) => {
    setOfferModalInitialStep('form');
    setSelectedOffer(offer);
  }, []);

  const handleAskRadarFromSearch = useCallback((query: string) => {
    setRadarExternalPrompt((prev) => ({ text: query, seq: (prev?.seq ?? 0) + 1 }));
  }, []);

  // ── Punto de referencia del mapa (GPS con fallback al casco urbano).
  // V13: si el usuario pidió "Ver en el Mapa", manda el foco del comercio. ──
  const mapCenter = useMemo<LatLng>(
    () =>
      mapFocus ??
      (geo.status === 'active' && geo.pos ? geo.pos : municipioCenter(municipality)),
    [mapFocus, geo.status, geo.pos, municipality]
  );

  const pendingTickets = useMemo(() => tickets.filter((t) => t.status === 'pending').length, [tickets]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-impulso-night">
      {view === 'radar' ? (
        <>
          <Navbar
            municipality={municipality}
            onMunicipality={handleMunicipality}
            geoStatus={geo.status}
            onGeoRequest={handleGeoRequest}
            profile={profile}
            favoritesCount={clientPrefs.favoriteOfferIds.length}
            onOpenAuth={() => setAuthOpen(true)}
            onOpenClientProfile={() => setClientProfileOpen(true)}
            onOpenDashboard={() => {
              if (profile?.role === 'client') {
                setView('radar');
                setClientProfileOpen(true);
              } else if (profile) {
                setView('dashboard');
              } else {
                setAuthOpen(true);
              }
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
                geoStatus={geo.status}
                geoLocating={geo.locating}
                geoRecalibrating={geo.recalibrating}
                geoAccuracy={geo.accuracy}
                geoError={geo.errorMessage}
                onGeoRequest={handleGeoRequest}
                onGeoRecalibrate={geo.recalibrate}
                onGeoRevoke={geo.revoke}
                onOpenGpsGuide={() => setGpsGuideOpen(true)}
                recenterToken={recenterToken}
                hasExplicitFocus={Boolean(mapFocus || focusedOffer)}
                focusedOffer={focusedOffer}
                focusToken={focusToken}
                onClearFocus={() => {
                  setFocusedOffer(null);
                  setMapFocus(null);
                }}
                onSelectOffer={(o) => {
                  setOfferModalInitialStep('detail');
                  setSelectedOffer(o);
                }}
                onQuickReserve={handleOpenOfferQuickReserve}
                onShareOffer={(o) => void shareOffer(o)}
                onStatusOffer={(o) => void handleStatusShare(o)}
                onReportOffer={setReporting}
                reportedIds={reportedIds}
                clientPrefs={clientPrefs}
                onToggleFavorite={handleToggleFavorite}
                onOpenPreferences={() => setClientProfileOpen(true)}
                forYouTriggerSeq={forYouTriggerSeq}
                freshOfferIds={freshOfferIds}
                onOpenMerchant={(id) => void openMerchantProfile(id)}
                onAskRadar={handleAskRadarFromSearch}
                onGoToRequests={() => setTab('pedir')}
              />
            )}
            {tab === 'pedir' && (
              <RequestsTab
                requests={requests}
                municipality={municipality}
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
              <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">
                Impulso es un portal tecnológico de contacto y publicidad. Las transacciones, pagos y entregas se realizan
                exclusivamente entre el cliente y el comercio. Impulso no retiene dinero ni interviene en la venta.
              </p>
            </footer>
          </main>

          <BottomNav active={tab} onChange={setTab} pendingTickets={pendingTickets} />
          <SupportConcierge
            userRole={profile?.role === 'admin' ? 'admin' : profile?.role === 'merchant' ? 'merchant' : 'client'}
            userName={profile?.business_name ?? 'Cliente'}
            municipality={municipality}
            offers={offers}
            geoPos={geo.status === 'active' && geo.pos ? geo.pos : null}
            onReserveOffer={handleOpenOfferQuickReserve}
            onFocusOfferOnMap={handleFocusOfferOnMap}
            externalPrompt={radarExternalPrompt}
            bottomOffsetClass="bottom-20 right-4 sm:bottom-24 sm:right-6"
          />
        </>
      ) : profile && profile.role !== 'client' ? (
        <MerchantDashboard
          profile={profile}
          onProfileChange={setProfile}
          onExit={() => setView('radar')}
          onSignOut={handleSignOut}
          onOpenAdmin={() => setAdminOpen(true)}
          onFocusOfferOnMap={handleFocusOfferOnMap}
          onReserveOffer={handleOpenOfferQuickReserve}
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
        initialStep={offerModalInitialStep}
        onClose={() => {
          setSelectedOffer(null);
          setOfferModalInitialStep('detail');
        }}
        onReserved={handleReserved}
        onViewTickets={() => {
          setView('radar');
          setTab('apartados');
        }}
        onOpenMerchant={(id) => void openMerchantProfile(id)}
      />
      {/* V13 · Perfil Público del comercio (?comercio=UUID) */}
      <MerchantProfileModal
        merchant={selectedMerchant}
        offers={merchantOffers}
        geoPos={geo.status === 'active' && geo.pos ? geo.pos : null}
        onClose={() => {
          setSelectedMerchant(null);
          setMerchantOffers([]);
        }}
        onFocusMap={handleFocusMerchantMap}
        onOpenOffer={(o) => {
          setSelectedMerchant(null);
          setMerchantOffers([]);
          setSelectedOffer(o);
        }}
      />
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthed={(hintRole) => {
          if (hintRole === 'client') {
            setView('radar');
            setClientProfileOpen(true);
            return;
          }
          if (hintRole === 'merchant') {
            setView('dashboard');
            return;
          }
          // Login de cuenta existente: resolvemos el rol real sin dejar atrapado a un Cliente en dashboard
          void supabase.auth.getUser().then(async ({ data }) => {
            if (!data.user) return;
            const p = await fetchMyProfile(data.user.id).catch(() => null);
            if (p) {
              setProfile(p);
              setView(p.role === 'client' ? 'radar' : 'dashboard');
            }
          });
        }}
        onOpenLegal={() => setLegalOpen(true)}
      />
      <ClientProfileModal
        open={clientProfileOpen}
        onClose={() => setClientProfileOpen(false)}
        profile={profile?.role === 'client' ? profile : null}
        preferences={clientPrefs}
        offers={offers}
        tickets={tickets}
        onSavePreferences={handleSaveClientPreferences}
        onToggleFavorite={handleToggleFavorite}
        onReserveOffer={handleOpenOfferQuickReserve}
        onFocusOfferOnMap={handleFocusOfferOnMap}
        onOpenAuth={() => setAuthOpen(true)}
        onSignOut={handleSignOut}
        onUpgradedToMerchant={(newProfile) => {
          setProfile(newProfile);
          setView('dashboard');
        }}
      />
      <LegalModal open={legalOpen} onClose={() => setLegalOpen(false)} />
      <GpsGuideModal
        open={gpsGuideOpen}
        onClose={() => setGpsGuideOpen(false)}
        onRetry={handleGeoRequest}
        retrying={geo.locating}
        mode={geo.status === 'denied' ? 'denied' : 'inexact'}
      />
      <ReportModal
        offer={reporting}
        busy={reportBusy}
        onClose={() => setReporting(null)}
        onConfirm={(reason, detail) => void handleReportConfirm(reason, detail)}
      />
      <AdminPanel open={adminOpen} onClose={() => setAdminOpen(false)} profile={profile} onProfileChange={setProfile} />
    </div>
  );
}
