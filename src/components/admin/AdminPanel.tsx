import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Coins,
  Flag,
  Gavel,
  Loader2,
  MessageCircle,
  Search,
  ShieldCheck,
  Store,
  Trash2,
  X,
} from 'lucide-react';
import type { CreditOrder, Offer, Profile } from '../../types';
import { deliveryMeta } from '../../types';
import { useToast } from '../ui/Toast';
import {
  adminBlockClient,
  adminCleanupExpired,
  adminDeleteOffer,
  adminUnblockClient,
  fetchAdminStatsRpc,
  fetchBlockedClients,
  fetchMerchants,
  fetchRecentReports,
  fetchRecentReservations,
  manageMerchant,
} from '../../services/admin.service';
import type { AdminStats, BlockedClient, ForensicReservation, OfferReport } from '../../services/admin.service';
import {
  fetchCreditOrders,
  fetchPaymentContact,
  resolveCreditOrder,
  setPaymentContact as savePaymentContactRpc,
} from '../../services/credits.service';
import { fetchActiveOffers } from '../../services/offers.service';
import { analyzeMerchantTrust } from '../../services/gemini.service';
import { friendlyError } from '../../services/supabase';
import { cx, formatCOP, timeAgo } from '../../utils/format';
import { openWhatsApp } from '../../utils/whatsapp';
import { ForensicInspector } from './ForensicInspector';
import type { ForensicData } from './ForensicInspector';
import { MarketingStudio } from './MarketingStudio';
import { reportReasonMeta } from '../offers/ReportModal';

interface AdminPanelProps {
  open: boolean;
  onClose: () => void;
  /** Cuenta logueada: para sincronizar créditos si el admin se recarga a sí mismo. */
  profile: Profile | null;
  /** Propaga cambios del perfil propio al estado global de la app. */
  onProfileChange: (profile: Profile) => void;
}

type Tab = 'studio' | 'merchants' | 'moderation' | 'cobros' | 'summary';

const CREDIT_PACKS = [1, 3, 10, 30] as const;

type Stats = AdminStats & { verifiedMerchants: number; reservationsToday: number; openReports: number };

/**
 * Súper panel del administrador en 3 pestañas:
 *  1. 🏪 Comercios y Créditos (recargas ±, verificación, suspensión, WhatsApp)
 *  2. 📡 Moderación en vivo (kill-switch de ofertas peligrosas)
 *  3. 📊 Resumen y limpieza de la base de datos
 * El backend valida el rol vía is_admin() en cada RPC (SECURITY DEFINER);
 * el rol de admin solo se asigna desde la base de datos, nunca desde el cliente.
 */
export function AdminPanel({ open, onClose, profile, onProfileChange }: AdminPanelProps) {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('merchants');
  const [merchants, setMerchants] = useState<Profile[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [forensics, setForensics] = useState<ForensicReservation[]>([]);
  const [blocked, setBlocked] = useState<BlockedClient[]>([]);
  /** 🚩 Reportes de la comunidad con su motivo exacto. */
  const [reports, setReports] = useState<OfferReport[]>([]);
  const [blockPhone, setBlockPhone] = useState('');
  const [blockDevice, setBlockDevice] = useState('');
  const [blockIp, setBlockIp] = useState('');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [offersLoading, setOffersLoading] = useState(false);
  const [cleanupBusy, setCleanupBusy] = useState(false);
  const [trustBusyId, setTrustBusyId] = useState<string | null>(null);
  const [blocking, setBlocking] = useState(false);
  const [creditOrders, setCreditOrders] = useState<CreditOrder[]>([]);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  /** Ficha forense abierta (inspector de IP/GPS). */
  const [inspecting, setInspecting] = useState<ForensicData | null>(null);
  /** 📱 Número oficial de Nequi/WhatsApp editable desde el panel. */
  const [paymentContact, setPaymentContact] = useState('');
  const [contactBusy, setContactBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, s, contact] = await Promise.all([fetchMerchants(), fetchAdminStatsRpc(), fetchPaymentContact()]);
      setMerchants(list);
      setStats(s);
      if (contact) setPaymentContact(contact);
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadOffers = useCallback(async () => {
    setOffersLoading(true);
    try {
      const [offersList, forensicsList, blockedList, ordersList, reportsList] = await Promise.all([
        fetchActiveOffers(''),
        fetchRecentReservations(),
        fetchBlockedClients(),
        fetchCreditOrders(),
        fetchRecentReports(),
      ]);
      setOffers(offersList);
      setForensics(forensicsList);
      setBlocked(blockedList);
      setCreditOrders(ordersList);
      setReports(reportsList);
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setOffersLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (open) {
      void load();
      void loadOffers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function act(merchant: Profile, addCredits: number, verify: boolean | null, active: boolean | null = null) {
    setBusyId(merchant.id);
    try {
      const updated = await manageMerchant(merchant.id, addCredits, verify, active);
      // Estado local inmediato con el valor REAL devuelto por la base de datos
      setMerchants((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      // Sincroniza el perfil global si el comercio modificado es el admin logueado
      if (profile && updated.id === profile.id) onProfileChange(updated);
      if (addCredits > 0) toast.success(`💰 +${addCredits} créditos para ${updated.business_name} (saldo: ${updated.credits})`);
      if (addCredits < 0) toast.info(`➖ Crédito descontado a ${updated.business_name} (saldo: ${updated.credits})`);
      if (verify !== null) toast.success(verify ? `✅ ${updated.business_name} verificado` : 'Insignia retirada');
      if (active !== null)
        toast.success(active ? `♻️ ${updated.business_name} reactivado` : `⛔ ${updated.business_name} suspendido: sus ofertas desaparecieron del radar`);
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setBusyId(null);
    }
  }

  /** 🤖 Auditoría IA del nivel de confianza de un comercio. */
  async function runTrustAnalysis(merchant: Profile) {
    setTrustBusyId(merchant.id);
    try {
      const titles = offers.filter((o) => o.merchant?.id === merchant.id).map((o) => o.title);
      const res = await analyzeMerchantTrust({
        businessName: merchant.business_name,
        category: merchant.category,
        whatsapp: merchant.whatsapp,
        municipality: merchant.municipality,
        addressReference: merchant.address_reference,
        nitOrCedula: merchant.nit_or_cedula,
        socialOrMapsLink: merchant.social_or_maps_link,
        offerTitles: titles,
      });
      if (res.level === 'green') {
        toast.push(`🟢 Comercio coherente y seguro — ${res.summary}`, 'success');
      } else {
        toast.push(`🟡 Revisar datos antes de verificar — ${res.warnings.slice(0, 2).join(' · ') || res.summary}`, 'info');
      }
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setTrustBusyId(null);
    }
  }

  /** 🚫 Bloqueo manual por teléfono / dispositivo / IP. */
  async function manualBlock() {
    if (!blockPhone.trim() && !blockDevice.trim() && !blockIp.trim()) {
      toast.error('Escribe al menos un identificador: teléfono, dispositivo o IP');
      return;
    }
    setBlocking(true);
    try {
      await adminBlockClient({
        phone: blockPhone.trim() || null,
        deviceId: blockDevice.trim() || null,
        clientIp: blockIp.trim() || null,
      });
      toast.success('🚫 Cliente bloqueado: ya no podrá apartar ni publicar pedidos');
      setBlockPhone('');
      setBlockDevice('');
      setBlockIp('');
      setBlocked(await fetchBlockedClients());
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setBlocking(false);
    }
  }

  /** 🚫 Bloquea los 3 identificadores de una reserva sospechosa. */
  async function blockReservation(row: ForensicReservation) {
    setBusyId(row.id);
    try {
      await adminBlockClient({
        phone: row.customer_phone,
        deviceId: row.device_id,
        clientIp: row.client_ip,
        reason: `Reserva sospechosa ${row.reservation_code}`,
      });
      toast.success(`🚫 Cliente de la reserva ${row.reservation_code} bloqueado (dispositivo, IP y teléfono)`);
      setBlocked(await fetchBlockedClients());
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setBusyId(null);
    }
  }

  async function unblock(id: string) {
    setBusyId(id);
    try {
      await adminUnblockClient(id);
      toast.info('♻️ Cliente desbloqueado');
      setBlocked(await fetchBlockedClients());
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setBusyId(null);
    }
  }

  /** 📱 Guarda el número oficial de Nequi/WhatsApp en la base de datos. */
  async function savePaymentContact() {
    if (paymentContact.replace(/\D/g, '').length < 10) {
      toast.error('Escribe el número completo (ej: 573101234567)');
      return;
    }
    setContactBusy(true);
    try {
      const saved = await savePaymentContactRpc(paymentContact);
      setPaymentContact(saved);
      toast.success('📱 Número oficial guardado: todos los comercios pagarán sus recargas a ese Nequi');
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setContactBusy(false);
    }
  }

  /** ✅❌ Aprobar (acredita y borra el comprobante) o rechazar una orden Nequi. */
  async function resolveOrder(order: CreditOrder, action: 'approved' | 'rejected') {
    setResolvingId(order.id);
    try {
      await resolveCreditOrder(order.id, action);
      if (action === 'approved') {
        toast.success(`✅ Acreditados ${order.credits_requested} créditos a ${order.merchant_name ?? 'el comercio'}`);
      } else {
        toast.info(`❌ Orden de ${order.merchant_name ?? 'el comercio'} rechazada`);
      }
      setCreditOrders(await fetchCreditOrders());
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setResolvingId(null);
    }
  }

  /** Cola corta de un identificador forense (discreción en pantalla). */
  function tail(value: string | null, n = 6): string {
    if (!value) return '—';
    return `…${value.slice(-n)}`;
  }

  async function killOffer(offer: Offer) {
    setBusyId(offer.id);
    try {
      await adminDeleteOffer(offer.id);
      setOffers((prev) => prev.filter((o) => o.id !== offer.id));
      toast.success(`🗑️ "${offer.title.slice(0, 40)}" tumbada al instante`);
      void load();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setBusyId(null);
    }
  }

  async function cleanup() {
    setCleanupBusy(true);
    try {
      const deleted = await adminCleanupExpired();
      toast.success(`🧹 ${deleted} ofertas vencidas eliminadas — base de datos liviana`);
      void load();
      void loadOffers();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setCleanupBusy(false);
    }
  }

  const filteredMerchants = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return merchants;
    return merchants.filter((m) => `${m.business_name} ${m.whatsapp}`.toLowerCase().includes(q));
  }, [merchants, query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-md animate-fade-in" onClick={onClose} aria-hidden="true" />
      <div className="relative max-h-[94dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-impulso-gold/25 bg-impulso-panel shadow-card sm:rounded-3xl animate-slide-up">
        {/* Cabecera */}
        <div className="sticky top-0 z-10 border-b border-white/5 bg-impulso-panel/95 px-5 py-4 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-impulso-gold/40 bg-impulso-gold/10">
              <ShieldCheck className="h-5 w-5 text-impulso-gold" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-extrabold text-white">Súper Panel 👑</h3>
              <p className="text-xs text-slate-400">Control total del municipio</p>
            </div>
            <button
              onClick={onClose}
              aria-label="Cerrar panel"
              className="pressable grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-slate-950/60 text-slate-300"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Pestañas internas */}
          <div className="mt-3 grid grid-cols-5 gap-1 rounded-2xl bg-slate-950/60 p-1">
            {(
              [
                ['studio', '🚀 Agencia'],
                ['merchants', '🏪 Comercios'],
                ['moderation', '📡 Radar'],
                ['cobros', '💳 Cobros'],
                ['summary', '📊 Resumen'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cx(
                  'pressable rounded-xl py-2 text-[10px] font-extrabold transition',
                  tab === id
                    ? id === 'studio'
                      ? 'bg-impulso-emerald/20 text-impulso-mint'
                      : 'bg-impulso-gold/20 text-impulso-gold'
                    : id === 'studio'
                      ? 'text-impulso-mint/70 hover:text-impulso-mint'
                      : 'text-slate-400 hover:text-slate-200'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ═══ Pestaña 0: 🚀 Agencia IA & Multi-WhatsApp Studio (exclusiva admin) ═══ */}
        {tab === 'studio' && <MarketingStudio merchants={merchants} offers={offers} />}

        {/* ═══ Pestaña 1: Comercios y Créditos ═══ */}
        {tab === 'merchants' && (
          <>
            <div className="px-4 pt-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por nombre o WhatsApp…"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/50 py-3 pl-11 pr-4 text-sm font-medium text-white placeholder:text-slate-600 outline-none focus:border-impulso-gold/50"
                />
              </div>
            </div>
            <div className="space-y-2.5 p-4">
              {loading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-7 w-7 animate-spin text-impulso-gold" />
                </div>
              ) : filteredMerchants.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400">
                  {merchants.length === 0 ? 'Aún no hay comercios registrados.' : 'Sin resultados para esa búsqueda.'}
                </p>
              ) : (
                filteredMerchants.map((m) => (
                  <article key={m.id} className="rounded-3xl border border-white/10 bg-impulso-card p-4">
                    {m.role === 'admin' && (
                      <p className="mb-2 flex items-center gap-1.5 rounded-xl bg-impulso-gold/15 px-2.5 py-1.5 text-[11px] font-extrabold text-impulso-gold">
                        👑 Tu Cuenta Admin (Pruebas y Publicaciones)
                      </p>
                    )}
                    <div className="flex items-center gap-3">
                      {m.logo_thumb ? (
                        <img src={m.logo_thumb} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover" />
                      ) : (
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-950/50 text-lg">
                          ✨
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 truncate text-sm font-extrabold text-white">
                          <Store className="h-3.5 w-3.5 text-slate-500" />
                          {m.business_name}
                        </p>
                        <p className="truncate text-xs font-semibold text-slate-400">
                          {m.municipality} · {m.whatsapp}
                        </p>
                      </div>
                      <div
                        className={cx(
                          'flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold',
                          m.credits <= 1 ? 'bg-impulso-rose/15 text-impulso-rose' : 'bg-impulso-emerald/10 text-impulso-mint'
                        )}
                      >
                        <Coins className="h-3.5 w-3.5" />
                        {m.credits}
                      </div>
                    </div>

                    {/* Recargas rápidas */}
                    <div className="mt-3 flex items-center gap-2">
                      {CREDIT_PACKS.map((n) => (
                        <button
                          key={n}
                          onClick={() => void act(m, n, null)}
                          disabled={busyId === m.id}
                          className="pressable flex-1 rounded-xl border border-impulso-emerald/30 bg-impulso-emerald/10 py-2 text-xs font-extrabold text-impulso-mint disabled:opacity-50"
                        >
                          +{n}
                        </button>
                      ))}
                      <button
                        onClick={() => void act(m, -1, null)}
                        disabled={busyId === m.id || m.credits < 1}
                        title="Corregir una recarga equivocada"
                        className="pressable flex-1 rounded-xl border border-white/10 bg-slate-950/40 py-2 text-xs font-extrabold text-slate-300 disabled:opacity-40"
                      >
                        -1
                      </button>
                    </div>

                    {/* Verificación + suspensión + WhatsApp + IA de confianza */}
                    <div className="mt-2 grid grid-cols-[1fr_auto_auto] gap-2">
                      <button
                        onClick={() => void act(m, 0, !m.is_verified)}
                        disabled={busyId === m.id}
                        title={m.is_verified ? 'Quitar verificación' : 'Otorgar insignia de verificado'}
                        className={cx(
                          'pressable flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-extrabold disabled:opacity-50',
                          m.is_verified
                            ? 'border-impulso-gold/40 bg-impulso-gold/10 text-impulso-gold'
                            : 'border-white/10 bg-slate-950/40 text-slate-300'
                        )}
                      >
                        <BadgeCheck className="h-4 w-4" />
                        {m.is_verified ? '✅ Verificado' : 'Verificar'}
                      </button>
                      <button
                        onClick={() => void act(m, 0, null, !m.is_active)}
                        disabled={busyId === m.id}
                        title={m.is_active ? 'Suspender cuenta (sus ofertas dejarán de verse)' : 'Reactivar cuenta'}
                        className={cx(
                          'pressable grid h-9 w-9 place-items-center rounded-xl border text-xs disabled:opacity-50',
                          m.is_active
                            ? 'border-impulso-rose/30 bg-impulso-rose/5 text-impulso-rose/80 hover:text-impulso-rose'
                            : 'border-impulso-emerald/40 bg-impulso-emerald/10 text-impulso-mint'
                        )}
                      >
                        {m.is_active ? '🚫' : '♻️'}
                      </button>
                      <button
                        onClick={() => openWhatsApp(m.whatsapp, `Hola ${m.business_name}! Te escribe el equipo de Impulso 💚`)}
                        title={`Escribirle por WhatsApp a ${m.business_name}`}
                        className="pressable grid h-9 w-9 place-items-center rounded-xl border border-impulso-emerald/30 bg-impulso-emerald/10 text-impulso-mint"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Auditoría IA de confianza + datos que dio el comercio */}
                    <div className="mt-2 flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-slate-950/40 p-2.5">
                      <p className="min-w-0 truncate text-[10px] font-semibold text-slate-500">
                        🪪 {m.nit_or_cedula ?? 'Sin NIT/cédula'} · 🌐 {m.social_or_maps_link ? 'con link social' : 'sin link social'}
                      </p>
                      <button
                        onClick={() => void runTrustAnalysis(m)}
                        disabled={trustBusyId === m.id}
                        title="Analizar nivel de confianza del comercio con IA"
                        className="pressable flex shrink-0 items-center gap-1 rounded-xl border border-impulso-gold/30 bg-impulso-gold/5 px-2.5 py-1.5 text-[11px] font-extrabold text-impulso-gold disabled:opacity-50"
                      >
                        {trustBusyId === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '🤖'} Confianza IA
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </>
        )}

        {/* ═══ Pestaña 2: Moderación en vivo (kill-switch) ═══ */}
        {tab === 'moderation' && (
          <div className="space-y-2.5 p-4">
            {offersLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-7 w-7 animate-spin text-impulso-gold" />
              </div>
            ) : offers.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">No hay ofertas activas ahora mismo.</p>
            ) : (
              offers.map((o) => (
                <article
                  key={o.id}
                  className={cx(
                    'rounded-3xl border bg-impulso-card p-4',
                    o.reports_count >= 1 ? 'border-impulso-rose/40' : 'border-white/10'
                  )}
                >
                  <div className="flex items-start gap-3">
                    {o.image_thumb ? (
                      <img src={o.image_thumb} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-950/50 text-xl">
                        {o.emoji_icon}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-extrabold text-white">{o.title}</p>
                      <p className="truncate text-xs font-semibold text-slate-400">
                        {o.merchant?.business_name ?? '—'} · {formatCOP(o.promo_price)} · {deliveryMeta(o.delivery_type).emoji}{' '}
                        {deliveryMeta(o.delivery_type).label}
                      </p>
                      {o.reports_count >= 1 && (
                        <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-impulso-rose">
                          <Flag className="h-3 w-3" /> {o.reports_count} reporte{o.reports_count === 1 ? '' : 's'} de la
                          comunidad
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => void killOffer(o)}
                      disabled={busyId === o.id}
                      className="pressable flex shrink-0 items-center gap-1.5 rounded-xl border border-impulso-rose/40 bg-impulso-rose/10 px-3 py-2 text-xs font-extrabold text-impulso-rose disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Tumbar
                    </button>
                  </div>
                </article>
              ))
            )}
            <p className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/40 p-3 text-[11px] font-semibold text-slate-400">
              <Gavel className="h-4 w-4 shrink-0 text-impulso-gold" />
              Las ofertas con 3+ reportes 🚩 se tumban automáticamente. Aquí puedes tumbar cualquiera de una vez.
            </p>

            {/* ── 🚩 Reportes de la comunidad: el motivo exacto que eligió el vecino ── */}
            <div className="mt-4 rounded-3xl border border-impulso-rose/25 bg-impulso-rose/5 p-3.5">
              <p className="flex items-center gap-1.5 text-sm font-extrabold text-impulso-rose">
                <Flag className="h-4 w-4" /> 🚩 Reportes de la comunidad (motivos)
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                Lo que la gente eligió al reportar cada oferta, con trazabilidad para detectar reportes falsos.
                Un dispositivo solo puede reportar cada oferta 1 vez.
              </p>
              {offersLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-impulso-rose" />
                </div>
              ) : reports.length === 0 ? (
                <p className="py-3 text-center text-[11px] text-slate-500">Aún no hay reportes. Radar limpio ✨</p>
              ) : (
                <div className="mt-2.5 space-y-1.5">
                  {reports.map((r) => {
                    const meta = reportReasonMeta(r.reason);
                    return (
                      <div key={r.id} className="rounded-xl border border-white/10 bg-slate-950/50 px-2.5 py-2">
                        <p className="text-[11px] font-extrabold text-white">
                          {meta.emoji} {meta.label}
                        </p>
                        {r.detail && (
                          <p className="mt-0.5 line-clamp-2 text-[10px] font-semibold italic text-slate-300">
                            ✍️ "{r.detail}"
                          </p>
                        )}
                        <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-400">
                          🛍️ {r.offer_title} · 🏪 {r.merchant_name ?? '—'}
                          {r.offer_status === 'cancelled' ? ' · ⛔ ya tumbada' : ''}
                        </p>
                        <p className="truncate font-mono text-[10px] font-semibold text-slate-500">
                          💻 {tail(r.device_id)} · 🌐 {tail(r.client_ip, 8)} · ⏱️ {timeAgo(r.created_at, Date.now())}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Trazabilidad forense y bloqueos ── */}
            <div className="mt-4 rounded-3xl border border-impulso-rose/25 bg-impulso-rose/5 p-3.5">
              <p className="flex items-center gap-1.5 text-sm font-extrabold text-impulso-rose">
                <Flag className="h-4 w-4" /> 🛡️ Trazabilidad y bloqueos
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                Cada apartado y pedido registra IP (capturada en el servidor), dispositivo y teléfono. Bloquea a
                bromeadores, saboteadores o estafadores para que no vuelvan a usar Impulso.
              </p>

              {/* Bloqueo manual */}
              <div className="mt-3 space-y-1.5">
                <input
                  value={blockPhone}
                  onChange={(e) => setBlockPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="Teléfono a bloquear (ej: 3201234567)"
                  inputMode="tel"
                  maxLength={10}
                  className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2.5 text-xs font-medium text-white placeholder:text-slate-600 outline-none focus:border-impulso-rose/50"
                />
                <input
                  value={blockDevice}
                  onChange={(e) => setBlockDevice(e.target.value)}
                  placeholder="ID de dispositivo (si lo tienes)"
                  className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2.5 text-xs font-medium text-white placeholder:text-slate-600 outline-none focus:border-impulso-rose/50"
                />
                <input
                  value={blockIp}
                  onChange={(e) => setBlockIp(e.target.value)}
                  placeholder="IP a bloquear (ej: 190.85.x.x)"
                  className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2.5 text-xs font-medium text-white placeholder:text-slate-600 outline-none focus:border-impulso-rose/50"
                />
                <button
                  onClick={() => void manualBlock()}
                  disabled={blocking}
                  className="pressable flex w-full items-center justify-center gap-1.5 rounded-xl bg-impulso-rose py-2.5 text-xs font-extrabold text-white disabled:opacity-50"
                >
                  {blocking ? <Loader2 className="h-4 w-4 animate-spin" /> : '🚫'} Bloquear cliente
                </button>
              </div>

              {/* Lista negra vigente */}
              {blocked.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Bloqueados ({blocked.length})
                  </p>
                  {blocked.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/50 px-2.5 py-2 text-[11px] font-semibold text-slate-300"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {b.phone ? `📞 ${b.phone}` : ''}
                        {b.device_id ? ` 💻 ${tail(b.device_id)}` : ''}
                        {b.client_ip ? ` 🌐 ${tail(b.client_ip, 8)}` : ''}
                      </span>
                      <button
                        onClick={() => void unblock(b.id)}
                        disabled={busyId === b.id}
                        title="Quitar bloqueo"
                        className="pressable shrink-0 rounded-lg border border-white/10 px-2 py-1 text-[10px] font-bold text-slate-400 disabled:opacity-50"
                      >
                        ♻️
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Últimas reservas con sus identificadores */}
              <div className="mt-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Últimas reservas (forense)</p>
                {offersLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-impulso-rose" />
                  </div>
                ) : forensics.length === 0 ? (
                  <p className="py-3 text-center text-[11px] text-slate-500">Aún no hay reservas registradas.</p>
                ) : (
                  <div className="mt-1.5 space-y-1.5">
                    {forensics.slice(0, 12).map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/50 px-2.5 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11px] font-bold text-white">
                            {r.customer_name} · 📞 {r.customer_phone} · {r.reservation_code}
                          </p>
                          <p className="truncate text-[10px] font-semibold text-slate-500">
                            💻 {tail(r.device_id)} · 🌐 {tail(r.client_ip, 8)} · {r.merchant_name ?? '—'}
                            {r.client_lat != null ? ' · 📍GPS' : ''}
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            setInspecting({
                              customerName: r.customer_name,
                              phone: r.customer_phone,
                              clientIp: r.client_ip,
                              deviceId: r.device_id,
                              clientLat: r.client_lat,
                              clientLng: r.client_lng,
                              code: r.reservation_code,
                              createdAt: r.created_at,
                            })
                          }
                          title="🕵️‍♂️ Investigar IP, operador y ubicación"
                          className="pressable shrink-0 rounded-lg border border-impulso-gold/40 bg-impulso-gold/10 px-2 py-1 text-[10px] font-extrabold text-impulso-gold"
                        >
                          🕵️‍♂️
                        </button>
                        <button
                          onClick={() => void blockReservation(r)}
                          disabled={busyId === r.id}
                          title="Bloquear dispositivo, IP y teléfono de esta reserva"
                          className="pressable flex shrink-0 items-center gap-1 rounded-lg border border-impulso-rose/40 bg-impulso-rose/10 px-2 py-1 text-[10px] font-extrabold text-impulso-rose disabled:opacity-50"
                        >
                          🚫
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ Pestaña 3: Cobros Nequi (bandeja de aprobación en 1 clic) ═══ */}
        {tab === 'cobros' && (
          <div className="space-y-2.5 p-4">
            <p className="rounded-2xl border border-white/[0.08] bg-slate-950/40 p-3 text-[11px] font-semibold leading-relaxed text-slate-400">
              💳 Comprobantes Nequi/Daviplata enviados por los comercios. La IA ya leyó cada captura: verifica contra
              tu app Nequi y aprueba para acreditar los créditos al instante (el comprobante se borra al aprobar).
            </p>

            {offersLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-7 w-7 animate-spin text-impulso-gold" />
              </div>
            ) : creditOrders.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">
                Sin órdenes de recarga por ahora. Cuando un comercio pague, aparecerá aquí 📥
              </p>
            ) : (
              creditOrders.map((c) => (
                <article
                  key={c.id}
                  className={cx(
                    'rounded-3xl border bg-impulso-card p-4',
                    c.status === 'pending' ? 'border-impulso-gold/30' : 'border-white/[0.08] opacity-70'
                  )}
                >
                  <div className="flex items-start gap-3">
                    {c.receipt_thumb ? (
                      <img
                        src={c.receipt_thumb}
                        alt={`Comprobante de ${c.merchant_name ?? 'comercio'}`}
                        className="h-16 w-16 shrink-0 cursor-zoom-in rounded-xl border border-white/10 object-cover"
                        onClick={() => window.open(c.receipt_thumb ?? '', '_blank', 'noopener')}
                      />
                    ) : (
                      <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl border border-white/10 bg-slate-950/50 text-2xl">
                        🧾
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-extrabold text-white">{c.merchant_name ?? 'Comercio'}</p>
                      <p className="text-xs font-bold text-impulso-mint tabular-nums tracking-tight">
                        {formatCOP(c.amount_cop)} · {c.package_name} ({c.credits_requested} créditos)
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[10px] font-semibold text-slate-500">
                        Ref: {c.reference_code} · {c.payment_method}
                      </p>
                      {c.ai_verification_note && (
                        <p className="mt-1 line-clamp-2 rounded-lg bg-slate-950/50 px-2 py-1 text-[10px] font-semibold text-slate-300">
                          🤖 {c.ai_verification_note}
                        </p>
                      )}
                      {c.status !== 'pending' && (
                        <p
                          className={cx(
                            'mt-1 text-[10px] font-extrabold uppercase',
                            c.status === 'approved' ? 'text-impulso-mint' : 'text-impulso-rose'
                          )}
                        >
                          {c.status === 'approved' ? '✅ Aprobada' : '❌ Rechazada'}
                        </p>
                      )}
                    </div>
                  </div>

                  {c.status === 'pending' && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => void resolveOrder(c, 'approved')}
                        disabled={resolvingId === c.id}
                        className="pressable flex items-center justify-center gap-1.5 rounded-xl bg-impulso-emerald py-2.5 text-xs font-extrabold text-slate-950 disabled:opacity-50"
                      >
                        {resolvingId === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : '✅'} Aprobar y Acreditar
                      </button>
                      <button
                        onClick={() => void resolveOrder(c, 'rejected')}
                        disabled={resolvingId === c.id}
                        className="pressable rounded-xl border border-impulso-rose/40 bg-impulso-rose/10 py-2.5 text-xs font-extrabold text-impulso-rose disabled:opacity-50"
                      >
                        ❌ Rechazar
                      </button>
                    </div>
                  )}
                </article>
              ))
            )}

            <p className="text-center text-[10px] leading-relaxed text-slate-500">
              Venta de licencias de uso de software / créditos publicitarios prepagados bajo régimen simplificado · no
              responsable de IVA (Art. 437 ET Colombia).
            </p>
          </div>
        )}

        {/* ═══ Pestaña 4: Resumen y limpieza ═══ */}
        {tab === 'summary' && (
          <div className="space-y-3 p-4">
            {stats ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-slate-950/50 p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Comercios</p>
                  <p className="text-xl font-extrabold text-white">{stats.merchants}</p>
                </div>
                <div className="rounded-2xl bg-slate-950/50 p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">✅ Verificados</p>
                  <p className="text-xl font-extrabold text-impulso-gold">{stats.verifiedMerchants}</p>
                </div>
                <div className="rounded-2xl bg-slate-950/50 p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Ofertas activas</p>
                  <p className="text-xl font-extrabold text-impulso-mint">{stats.activeOffers}</p>
                </div>
                <div className="rounded-2xl bg-slate-950/50 p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Reservas hoy</p>
                  <p className="text-xl font-extrabold text-white">{stats.reservationsToday}</p>
                </div>
                <div className="col-span-2 rounded-2xl border border-impulso-rose/25 bg-impulso-rose/5 p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-impulso-rose/70">🚩 Reportes activos</p>
                  <p className="text-xl font-extrabold text-impulso-rose">{stats.openReports}</p>
                </div>
              </div>
            ) : (
              <div className="flex justify-center py-10">
                <Loader2 className="h-7 w-7 animate-spin text-impulso-gold" />
              </div>
            )}

            {/* 📱 Número oficial de recargas (protegido en la base de datos) */}
            <section className="rounded-3xl border border-impulso-emerald/25 bg-impulso-panel p-4">
              <p className="text-sm font-bold text-impulso-mint">📱 Mi Número Oficial de Nequi / WhatsApp para Recargas</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                Los comercios verán este número al pagar sus créditos y te escribirán a él al enviar el comprobante.
                Vive protegido en la base de datos: cámbialo aquí cuando quieras, sin redeploy.
              </p>
              <input
                value={paymentContact}
                onChange={(e) => setPaymentContact(e.target.value.replace(/[^\d+]/g, ''))}
                placeholder="Ej: 573101234567"
                inputMode="tel"
                maxLength={13}
                className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 font-mono text-sm font-bold tracking-wider text-white placeholder:text-slate-600 outline-none focus:border-impulso-emerald/60"
              />
              <button
                onClick={() => void savePaymentContact()}
                disabled={contactBusy}
                className="pressable mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-impulso-emerald py-3 text-sm font-extrabold text-slate-950 disabled:opacity-60"
              >
                {contactBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : '💾'} Guardar número oficial
              </button>
            </section>

            <button
              onClick={() => void cleanup()}
              disabled={cleanupBusy}
              className="pressable flex w-full items-center justify-center gap-2 rounded-2xl border border-impulso-gold/40 bg-impulso-gold/10 py-3.5 text-sm font-extrabold text-impulso-gold disabled:opacity-50"
            >
              {cleanupBusy ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> Purgando…
                </>
              ) : (
                '🧹 Purgar Ofertas Vencidas Ahora'
              )}
            </button>
            <p className="text-center text-[11px] leading-relaxed text-slate-500">
              Borra todas las ofertas vencidas de la base de datos (incluidas sus fotos), manteniendo la capa gratuita
              de Supabase liviana para siempre.
            </p>
          </div>
        )}
      </div>

      {/* 🕵️‍♂️ Ficha forense de IP / GPS / dispositivo */}
      <ForensicInspector data={inspecting} onClose={() => setInspecting(null)} />
    </div>
  );
}
