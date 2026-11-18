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
  cleanupExpiredData,
  clearMerchantReports,
  clearOfferReports,
  dismissReport,
  fetchAdminStatsRpc,
  fetchBlockedClients,
  fetchKybPending,
  fetchMerchants,
  fetchRecentReports,
  fetchRecentReservations,
  manageMerchant,
  reviewKyb,
} from '../../services/admin.service';
import type { AdminStats, BlockedClient, ForensicReservation, KybVerification, OfferReport } from '../../services/admin.service';
import {
  fetchCreditOrders,
  fetchPaymentConfig,
  resolveCreditOrder,
  setPaymentConfig,
} from '../../services/credits.service';
import { fetchActiveOffers } from '../../services/offers.service';
import { analyzeKybForensic, analyzeMerchantTrust, auditCommunityReportWithAI } from '../../services/gemini.service';
import type { KybForensicResult, ReportFraudAuditResult } from '../../services/gemini.service';
import { friendlyError } from '../../services/supabase';
import { prepareCrispQrImage } from '../../services/imageCompressor';
import {
  fetchAdminSupportTickets,
  updateSupportTicketStatus,
} from '../../services/support.service';
import type { SupportStatus, SupportTicket } from '../../services/support.service';
import { cx, formatCOP, timeAgo } from '../../utils/format';
import { openWhatsApp } from '../../utils/whatsapp';
import { ForensicInspector } from './ForensicInspector';
import type { ForensicData } from './ForensicInspector';
import { MarketingStudio } from './MarketingStudio';
import { reportReasonMeta } from '../offers/ReportModal';
import { ImpulsoLogo } from '../ui/ImpulsoLogo';
import { useModalHistory } from '../../hooks/useModalHistory';

interface AdminPanelProps {
  open: boolean;
  onClose: () => void;
  /** Cuenta logueada: para sincronizar créditos si el admin se recarga a sí mismo. */
  profile: Profile | null;
  /** Propaga cambios del perfil propio al estado global de la app. */
  onProfileChange: (profile: Profile) => void;
}

type Tab = 'studio' | 'merchants' | 'moderation' | 'cobros' | 'soporte' | 'summary';

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
  useModalHistory(open, onClose);
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('merchants');
  const [merchants, setMerchants] = useState<Profile[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [forensics, setForensics] = useState<ForensicReservation[]>([]);
  const [blocked, setBlocked] = useState<BlockedClient[]>([]);
  /** 🚩 Reportes de la comunidad con su motivo exacto. */
  const [reports, setReports] = useState<OfferReport[]>([]);
  /** 🪪 V20 · Expedientes KYB pendientes de auditoría visual. */
  const [kybPending, setKybPending] = useState<KybVerification[]>([]);
  const [kybBusyId, setKybBusyId] = useState<string | null>(null);
  /** 🤖 V21 · Score de Confianza Forense (Gemini Vision) del expediente inspeccionado. */
  const [kybForensic, setKybForensic] = useState<{ merchantId: string; result: KybForensicResult } | null>(null);
  const [kybForensicBusy, setKybForensicBusy] = useState<string | null>(null);
  const [blockPhone, setBlockPhone] = useState('');
  const [blockDevice, setBlockDevice] = useState('');
  const [blockIp, setBlockIp] = useState('');
  const [query, setQuery] = useState('');
  /** 🔍 V20.0 · Buscador universal dentro de la pestaña Radar (ofertas, comercios, denuncias e IDs). */
  const [radarQuery, setRadarQuery] = useState('');
  /** 🧠 V20.0 · Auditorías IA antifraude/antienvidia por ID de denuncia. */
  const [reportAudits, setReportAudits] = useState<Record<string, ReportFraudAuditResult>>({});
  const [reportAuditBusyId, setReportAuditBusyId] = useState<string | null>(null);
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
  /** 📱 V18 · Config de recaudo (Nequi 3158942112 / Llave / QR / auto-aprobar). */
  const [paymentContact, setPaymentContact] = useState('');
  const [llaveInput, setLlaveInput] = useState('');
  const [holderInput, setHolderInput] = useState('');
  const [qrThumb, setQrThumb] = useState('');
  const [autoApprove, setAutoApprove] = useState(false);
  const [qrBusy, setQrBusy] = useState(false);
  const [contactBusy, setContactBusy] = useState(false);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [ticketBusyId, setTicketBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, s, config] = await Promise.all([fetchMerchants(), fetchAdminStatsRpc(), fetchPaymentConfig()]);
      setMerchants(list);
      setStats(s);
      if (config) {
        setPaymentContact(config.nequiPhone || '');
        setLlaveInput(config.llave || '');
        setHolderInput(config.holderName || '');
        setQrThumb(config.qrThumb || '');
        setAutoApprove(config.autoApprove);
      }
      // 🪪 V20 · Expedientes KYB pendientes (silencioso: si la tabla aún no
      // existe porque falta correr el SQL, el panel NO se rompe).
      try {
        setKybPending(await fetchKybPending());
      } catch {
        setKybPending([]);
      }
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadOffers = useCallback(async () => {
    setOffersLoading(true);
    try {
      const [offersList, forensicsList, blockedList, ordersList, reportsList, ticketsList] = await Promise.all([
        fetchActiveOffers(''),
        fetchRecentReservations(),
        fetchBlockedClients(),
        fetchCreditOrders(),
        fetchRecentReports(),
        fetchAdminSupportTickets().catch(() => [] as SupportTicket[]),
      ]);
      setOffers(offersList);
      setForensics(forensicsList);
      setBlocked(blockedList);
      setCreditOrders(ordersList);
      setReports(reportsList);
      setSupportTickets(ticketsList);
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

  /** 💳 V18 · Guarda toda la configuración de recaudo (Nequi/Llave/titular/QR/auto). */
  async function savePaymentContact() {
    if (paymentContact.replace(/\D/g, '').length < 10) {
      toast.error('Escribe el número completo (ej: 3158942112)');
      return;
    }
    setContactBusy(true);
    try {
      const saved = await setPaymentConfig({
        nequiPhone: paymentContact,
        llave: llaveInput.trim() || null,
        holderName: holderInput.trim() || null,
        qrThumb: qrThumb, // '' limpia; dataURL lo asigna; undefined no lo toca
        autoApprove: autoApprove ? 'on' : 'off',
      });
      setPaymentContact(saved.nequiPhone);
      toast.success('💳 Configuración de cobros guardada: los comercios ya ven tu Nequi, Llave y QR');
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setContactBusy(false);
    }
  }

  /** 🖼️ Sube el QR oficial de Nequi/Daviplata en formato nítido PNG/WebP para 100% compatibilidad bancaria. */
  async function pickAdminQr(file: File | undefined) {
    if (!file) return;
    setQrBusy(true);
    try {
      const crisp = await prepareCrispQrImage(file);
      setQrThumb(crisp);
      toast.success(`✅ QR oficial listo (${Math.round((crisp.length * 0.75) / 1024)} KB) — guarda para publicar`);
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setQrBusy(false);
    }
  }

  /** 🛠️ Cambia el estado de un ticket enviado por El Conserje de Impulso. */
  async function handleSupportStatus(ticketId: string, nextStatus: SupportStatus) {
    setTicketBusyId(ticketId);
    try {
      const updated = await updateSupportTicketStatus(ticketId, nextStatus);
      setSupportTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      toast.success(nextStatus === 'resolved' ? '✅ Ticket marcado como resuelto' : '🛠️ Estado del ticket actualizado');
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setTicketBusyId(null);
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

  /** 🧹 V19.0 · Desestima una denuncia falsa/por envidia y restaura la oferta. */
  async function handleDismissReport(report: OfferReport) {
    setBusyId(report.id);
    try {
      const res = await dismissReport(report.id, true);
      setReports((prev) => prev.filter((r) => r.id !== report.id));
      toast.success(
        res.restored
          ? '🧹 Denuncia falsa borrada y oferta restaurada en el radar'
          : '🧹 Denuncia desestimada y borrada del historial',
      );
      void load();
      void loadOffers();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setBusyId(null);
    }
  }

  /** 🧹 V19.0 · Limpia TODAS las denuncias de un local y restaura sus ofertas vigentes. */
  async function handleClearMerchantReports(merchantId: string, merchantName: string) {
    setBusyId(merchantId);
    try {
      const res = await clearMerchantReports(merchantId, true);
      setReports((prev) => prev.filter((r) => r.merchant_id !== merchantId));
      toast.success(
        `🛡️ ${merchantName}: ${res.deleted} denuncia${res.deleted === 1 ? '' : 's'} eliminada${res.deleted === 1 ? '' : 's'} y ofertas restauradas`,
      );
      void load();
      void loadOffers();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setBusyId(null);
    }
  }

  /** 🧹 V19.0 · Limpia reportes acumulados sobre una oferta activa. */
  async function handleClearOfferReports(offer: Offer) {
    setBusyId(offer.id);
    try {
      await clearOfferReports(offer.id, true);
      setOffers((prev) => prev.map((o) => (o.id === offer.id ? { ...o, reports_count: 0 } : o)));
      setReports((prev) => prev.filter((r) => r.offer_id !== offer.id));
      toast.success(`🧹 Reportes limpiados en "${offer.title.slice(0, 32)}"`);
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
      // 🧹 V20 · Purga profunda: ofertas vencidas hace más de 30 días +
      // miniaturas de comprobantes resueltos liberadas (el hash queda).
      let cleared = 0;
      try {
        const deep = await cleanupExpiredData();
        cleared = deep.receipts_cleared;
      } catch {
        // Si la RPC nueva aún no está instalada, la limpieza clásica ya corrió.
      }
      toast.success(`🧹 ${deleted} ofertas vencidas eliminadas${cleared ? ` · ${cleared} comprobantes liberados` : ''} — base liviana`);
      void load();
      void loadOffers();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setCleanupBusy(false);
    }
  }

  /** 🪪 V20 · Aprueba o rechaza un expediente KYB (el rechazo libera las imágenes). */
  async function reviewKybExpedient(merchantId: string, approve: boolean) {
    setKybBusyId(merchantId);
    try {
      await reviewKyb(merchantId, approve);
      setKybPending((prev) => prev.filter((k) => k.merchant_id !== merchantId));
      toast.success(approve ? '🪪 Identidad verificada: insignia otorgada' : 'Expediente KYB rechazado e imágenes liberadas');
      void load();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setKybBusyId(null);
    }
  }

  /** 🤖 V21 · Gemini Vision lee el documento del expediente, lo cruza con el
   *  nombre del negocio y su NIT/cédula declarada, y entrega un score 0–100. */
  async function runKybForensic(k: KybVerification) {
    setKybForensicBusy(k.merchant_id);
    setKybForensic(null);
    try {
      const merchant = merchants.find((m) => m.id === k.merchant_id);
      const result = await analyzeKybForensic({
        docImageDataUrl: k.doc_image,
        merchantName: merchant?.business_name ?? 'Comercio de Gachetá',
        declaredId: merchant?.nit_or_cedula ?? null,
      });
      setKybForensic({ merchantId: k.merchant_id, result });
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setKybForensicBusy(null);
    }
  }

  /** 🧠 V20.0 · Audita un reporte comunitario con Gemini 2.5 Flash (/api/gemini). */
  async function runReportFraudAudit(r: OfferReport) {
    setReportAuditBusyId(r.id);
    try {
      const offer = offers.find((o) => o.id === r.offer_id);
      const sameIpCount = r.client_ip ? reports.filter((x) => x.client_ip === r.client_ip).length : 0;
      const sameDeviceCount = r.device_id ? reports.filter((x) => x.device_id === r.device_id).length : 0;
      const relatedReservations = forensics
        .filter((f) => (r.client_ip && f.client_ip === r.client_ip) || (r.device_id && f.device_id === r.device_id))
        .slice(0, 6)
        .map((f) => `${f.reservation_code} en ${f.merchant_name ?? 'local'} (${f.status})`);

      const audit = await auditCommunityReportWithAI({
        reason: r.reason,
        detail: r.detail,
        clientIp: r.client_ip,
        deviceId: r.device_id,
        isVerifiedBuyer: r.is_verified_buyer === true,
        sameIpReportsCount: sameIpCount,
        sameDeviceReportsCount: sameDeviceCount,
        reservationsHistorySummary: relatedReservations,
        offerTitle: r.offer_title,
        offerDescription: offer?.description,
        offerPromoPrice: offer?.promo_price,
        merchantName: r.merchant_name,
        merchantVerified: offer?.merchant?.is_verified,
        totalOfferReports: offer?.reports_count ?? 1,
      });
      setReportAudits((prev) => ({ ...prev, [r.id]: audit }));
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setReportAuditBusyId(null);
    }
  }

  const filteredMerchants = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return merchants;
    return merchants.filter((m) => `${m.business_name} ${m.whatsapp}`.toLowerCase().includes(q));
  }, [merchants, query]);

  const filteredOffers = useMemo(() => {
    const q = radarQuery.trim().toLowerCase();
    if (!q) return offers;
    return offers.filter((o) =>
      `${o.id} ${o.title} ${o.description} ${o.category} ${o.municipality} ${o.merchant?.business_name ?? ''} ${o.merchant?.id ?? ''}`
        .toLowerCase()
        .includes(q),
    );
  }, [offers, radarQuery]);

  const filteredReports = useMemo(() => {
    const q = radarQuery.trim().toLowerCase();
    if (!q) return reports;
    return reports.filter((r) =>
      `${r.id} ${r.offer_id} ${r.offer_title} ${r.merchant_name ?? ''} ${r.merchant_id ?? ''} ${r.reason} ${r.detail ?? ''} ${r.client_ip ?? ''}`
        .toLowerCase()
        .includes(q),
    );
  }, [reports, radarQuery]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      {/* Sin onClick: tocar el fondo NUNCA cierra el Súper Panel (protege el trabajo del admin). */}
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md animate-fade-in" aria-hidden="true" />
      <div className="relative max-h-[94dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-[#070B14] shadow-[0_0_80px_-20px_rgba(59,130,246,0.22)] ring-1 ring-white/[0.07] sm:rounded-3xl md:w-[96vw] md:max-w-[1440px] md:h-[92dvh] md:max-h-[92dvh] animate-slide-up">
        {/* Cabecera Dark Mode Premium (Apple / Vercel) */}
        <div className="sticky top-0 z-10 bg-slate-950/85 px-5 py-4 backdrop-blur-2xl">
          <div className="flex items-center gap-4">
            <ImpulsoLogo size="sm" />
            <div className="h-6 w-px bg-white/[0.08] hidden sm:block" />
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-extrabold tracking-tight text-white">Súper Panel</h3>
              <p className="text-[11px] font-medium text-slate-400">Control total del municipio</p>
            </div>
            <button
              onClick={onClose}
              aria-label="Cerrar panel"
              className="pressable grid h-9 w-9 place-items-center rounded-full bg-white/[0.05] text-slate-300 transition hover:bg-white/[0.1] hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Pestañas internas con scroll horizontal móvil nativo */}
          <div className="mt-4 flex items-center gap-1.5 overflow-x-auto touch-pan-x overscroll-x-contain whitespace-nowrap rounded-2xl bg-slate-900/60 p-1.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {(
              [
                ['studio', '🚀 Agencia'],
                ['merchants', '🏪 Comercios'],
                ['moderation', '📡 Radar'],
                ['cobros', '💳 Cobros'],
                ['soporte', `🛠️ Soporte${supportTickets.some((t) => t.status === 'open') ? ` (${supportTickets.filter((t) => t.status === 'open').length})` : ''}`],
                ['summary', '📊 Resumen'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cx(
                  'pressable shrink-0 rounded-xl px-3 py-2.5 text-[11px] font-extrabold transition',
                  tab === id
                    ? id === 'studio'
                      ? 'bg-impulso-emerald/20 text-impulso-mint shadow-[0_0_30px_-8px_rgba(16,185,129,0.4)]'
                      : 'bg-white/[0.08] text-white shadow-[0_0_35px_-12px_rgba(59,130,246,0.35)]'
                    : id === 'studio'
                      ? 'text-impulso-mint/70 hover:bg-white/[0.03] hover:text-impulso-mint'
                      : 'text-slate-400 hover:bg-white/[0.03] hover:text-slate-200'
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
            {/* 🪪 V20 · Bandeja de verificación de identidad (KYB) pendiente */}
            {kybPending.length > 0 && (
              <div className="px-4 pt-4">
                <div className="rounded-3xl border border-impulso-gold/30 bg-impulso-gold/5 p-4">
                  <p className="flex items-center gap-2 text-sm font-extrabold text-impulso-gold">
                    <BadgeCheck className="h-4 w-4" /> Verificación de identidad pendiente ({kybPending.length})
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    Audita el documento y la foto de cada comercio antes de otorgar la insignia ✅ Verificado.
                  </p>
                  <div className="mt-3 space-y-3">
                    {kybPending.map((k) => {
                      const merchant = merchants.find((m) => m.id === k.merchant_id);
                      return (
                        <div key={k.merchant_id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-3">
                          <p className="truncate text-xs font-extrabold text-white">
                            {merchant?.business_name ?? k.merchant_id} · {new Date(k.submitted_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                          </p>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <img src={k.doc_image} alt="Documento" className="h-32 w-full rounded-xl border border-white/10 object-cover" />
                            <img src={k.face_image} alt="Establecimiento" className="h-32 w-full rounded-xl border border-white/10 object-cover" />
                          </div>
                          <p className="mt-1.5 truncate font-mono text-[9px] text-slate-500">
                            🧬 doc {k.doc_hash.slice(0, 16)}… · 🧬 foto {k.face_hash.slice(0, 16)}…
                          </p>
                          {/* 🤖 V21 · Score de Confianza Forense con Gemini Vision:
                              cruza el texto del documento con el nombre y NIT/cédula */}
                          <button
                            onClick={() => void runKybForensic(k)}
                            disabled={kybForensicBusy === k.merchant_id}
                            className="pressable mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-impulso-gold/40 bg-impulso-gold/10 py-2 text-xs font-extrabold text-impulso-gold disabled:opacity-50"
                          >
                            {kybForensicBusy === k.merchant_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                            Score de Confianza Forense (IA)
                          </button>
                          {kybForensic?.merchantId === k.merchant_id && (
                            <div
                              className={cx(
                                'mt-2 rounded-2xl border p-3',
                                kybForensic.result.score >= 70
                                  ? 'border-impulso-emerald/40 bg-impulso-emerald/10'
                                  : kybForensic.result.score >= 40
                                    ? 'border-impulso-gold/40 bg-impulso-gold/10'
                                    : 'border-impulso-rose/40 bg-impulso-rose/10',
                              )}
                            >
                              <p className="flex items-baseline gap-2">
                                <span className="text-2xl font-black leading-none text-white">{kybForensic.result.score}</span>
                                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">/ 100 confianza</span>
                                <span className="ml-auto text-[10px] font-bold text-slate-300">
                                  {kybForensic.result.docReadable ? (kybForensic.result.docType ?? 'documento') : 'ilegible'} ·{' '}
                                  {kybForensic.result.nameMatch ? 'nombre coincide' : 'nombre NO coincide'}
                                </span>
                              </p>
                              <p className="mt-1.5 text-xs font-semibold leading-relaxed text-slate-200">{kybForensic.result.summary}</p>
                              {kybForensic.result.warnings.length > 0 && (
                                <ul className="mt-1.5 space-y-0.5">
                                  {kybForensic.result.warnings.map((w, i) => (
                                    <li key={i} className="text-[11px] font-semibold text-impulso-rose/90">⚠ {w}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <button
                              onClick={() => void reviewKybExpedient(k.merchant_id, true)}
                              disabled={kybBusyId === k.merchant_id}
                              className="pressable flex items-center justify-center gap-1.5 rounded-xl border border-impulso-emerald/40 bg-impulso-emerald/10 py-2 text-xs font-extrabold text-impulso-mint disabled:opacity-50"
                            >
                              {kybBusyId === k.merchant_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BadgeCheck className="h-3.5 w-3.5" />}
                              Aprobar verificación
                            </button>
                            <button
                              onClick={() => void reviewKybExpedient(k.merchant_id, false)}
                              disabled={kybBusyId === k.merchant_id}
                              className="pressable flex items-center justify-center gap-1.5 rounded-xl border border-impulso-rose/40 bg-impulso-rose/10 py-2 text-xs font-extrabold text-impulso-rose disabled:opacity-50"
                            >
                              <X className="h-3.5 w-3.5" /> Rechazar
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
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
            <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3 md:items-start">
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
                  <article key={m.id} className="rounded-3xl bg-slate-900/55 p-5 shadow-[0_0_40px_-18px_rgba(59,130,246,0.14)] ring-1 ring-white/[0.04] transition hover:bg-slate-900/75">
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
                          {m.kyb_status === 'pending' && (
                            <span className="rounded-md border border-impulso-gold/40 bg-impulso-gold/10 px-1.5 py-0.5 text-[9px] font-extrabold text-impulso-gold">
                              🪪 KYB en revisión
                            </span>
                          )}
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

                    {/* Auditoría IA de confianza + limpiar denuncias del local */}
                    <div className="mt-2 flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-slate-950/40 p-2.5">
                      <p className="min-w-0 truncate text-[10px] font-semibold text-slate-500">
                        🪪 {m.nit_or_cedula ?? 'Sin NIT/cédula'} · 🌐 {m.social_or_maps_link ? 'con link social' : 'sin link social'}
                      </p>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          onClick={() => void handleClearMerchantReports(m.id, m.business_name)}
                          disabled={busyId === m.id}
                          title="Borrar denuncias falsas o por envidia de este local"
                          className="pressable rounded-xl border border-impulso-emerald/30 bg-impulso-emerald/10 px-2 py-1.5 text-[10px] font-extrabold text-impulso-mint disabled:opacity-50"
                        >
                          🧹 Limpiar denuncias
                        </button>
                        <button
                          onClick={() => void runTrustAnalysis(m)}
                          disabled={trustBusyId === m.id}
                          title="Analizar nivel de confianza del comercio con IA"
                          className="pressable flex shrink-0 items-center gap-1 rounded-xl border border-impulso-gold/30 bg-impulso-gold/5 px-2.5 py-1.5 text-[11px] font-extrabold text-impulso-gold disabled:opacity-50"
                        >
                          {trustBusyId === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '🤖'} Confianza IA
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </>
        )}

        {/* ═══ Pestaña 2: Moderación en vivo (kill-switch) ═══ */}
        {tab === 'moderation' && (
          <div className="p-4 lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start">
            {/* 🔍 V20.0 · Buscador Universal del Radar (nombre de comercio, palabra clave o ID) */}
            <div className="mb-4 lg:col-span-2 lg:mb-0">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={radarQuery}
                  onChange={(e) => setRadarQuery(e.target.value)}
                  placeholder="Buscador universal Radar: nombre del comercio, producto, palabra clave o ID…"
                  aria-label="Buscador universal en Radar"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 py-3 pl-11 pr-24 text-sm font-medium text-white placeholder:text-slate-500 outline-none focus:border-impulso-gold/60"
                />
                {radarQuery.trim() && (
                  <button
                    type="button"
                    onClick={() => setRadarQuery('')}
                    className="pressable absolute right-3 top-1/2 -translate-y-1/2 rounded-xl border border-white/10 bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-slate-300 hover:text-white"
                  >
                    Limpiar ✕
                  </button>
                )}
              </div>
              <p className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-500">
                <span>📡 Ofertas visibles: {filteredOffers.length} de {offers.length}</span>
                <span>🚩 Denuncias visibles: {filteredReports.length} de {reports.length}</span>
              </p>
            </div>

            <div className="space-y-2.5">
            {offersLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-7 w-7 animate-spin text-impulso-gold" />
              </div>
            ) : filteredOffers.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">
                {offers.length === 0 ? 'No hay ofertas activas ahora mismo.' : 'Ninguna oferta coincide con esa búsqueda en el Radar.'}
              </p>
            ) : (
              filteredOffers.map((o) => (
                <article
                  key={o.id}
                  className={cx(
                    'rounded-3xl bg-slate-900/55 p-4 ring-1 transition hover:bg-slate-900/75',
                    o.reports_count >= 1
                      ? 'shadow-[0_0_40px_-15px_rgba(244,63,94,0.24)] ring-impulso-rose/30'
                      : 'ring-white/[0.04]'
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
                    <div className="flex shrink-0 flex-col gap-1.5">
                      {o.reports_count >= 1 && (
                        <button
                          onClick={() => void handleClearOfferReports(o)}
                          disabled={busyId === o.id}
                          title="Borrar denuncias falsas de esta oferta"
                          className="pressable flex items-center justify-center gap-1 rounded-xl border border-impulso-emerald/40 bg-impulso-emerald/10 px-2.5 py-1.5 text-[10px] font-extrabold text-impulso-mint disabled:opacity-50"
                        >
                          🧹 Absolver
                        </button>
                      )}
                      <button
                        onClick={() => void killOffer(o)}
                        disabled={busyId === o.id}
                        className="pressable flex items-center justify-center gap-1.5 rounded-xl border border-impulso-rose/40 bg-impulso-rose/10 px-3 py-2 text-xs font-extrabold text-impulso-rose disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Tumbar
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}
            <p className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/40 p-3 text-[11px] font-semibold text-slate-400">
              <Gavel className="h-4 w-4 shrink-0 text-impulso-gold" />
              Blindaje anti-envidia activo: los comercios verificados nunca caen por clics anónimos sin reserva real. Aquí puedes tumbar ofertas peligrosas o absolver denuncias falsas.
            </p>
            </div>

            <div className="mt-4 space-y-4 lg:mt-0">
            {/* ── 🚩 Reportes de la comunidad: evidencia real y depuración anti-envidia ── */}
            <div className="mt-4 rounded-3xl border border-impulso-rose/25 bg-impulso-rose/5 p-3.5">
              <p className="flex items-center gap-1.5 text-sm font-extrabold text-impulso-rose">
                <Flag className="h-4 w-4" /> 🚩 Denuncias de la comunidad (auditoría real)
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                Verifica si el reportante apartó realmente o si es un ataque por envidia. Puedes borrar denuncias falsas,
                limpiar todo el local o inspeccionar la IP del reportante.
              </p>
              {offersLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-impulso-rose" />
                </div>
              ) : filteredReports.length === 0 ? (
                <p className="py-3 text-center text-[11px] text-slate-500">
                  {reports.length === 0 ? 'Aún no hay reportes. Radar limpio ✨' : 'Sin denuncias para esa búsqueda.'}
                </p>
              ) : (
                <div className="mt-2.5 space-y-2">
                  {filteredReports.map((r) => {
                    const meta = reportReasonMeta(r.reason);
                    const audit = reportAudits[r.id];
                    return (
                      <div key={r.id} className="rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] font-extrabold text-white">
                            {meta.emoji} {meta.label}
                          </p>
                          <span
                            className={cx(
                              'shrink-0 rounded-full px-2 py-0.5 text-[9px] font-extrabold',
                              r.is_verified_buyer
                                ? 'bg-impulso-emerald/15 text-impulso-mint'
                                : 'bg-amber-400/15 text-amber-300',
                            )}
                          >
                            {r.is_verified_buyer ? '🎟️ Comprador real' : '👤 Visitante sin reserva'}
                          </span>
                        </div>
                        {r.detail && (
                          <p className="mt-1 rounded-lg bg-slate-900/70 px-2 py-1 text-[10px] font-semibold italic text-slate-200">
                            ✍️ "{r.detail}"
                          </p>
                        )}
                        <p className="mt-1 truncate text-[10px] font-semibold text-slate-400">
                          🛍️ {r.offer_title} · 🏪 {r.merchant_name ?? '—'}
                          {r.offer_status === 'cancelled' ? ' · ⛔ pausada' : ''}
                        </p>
                        <p className="truncate font-mono text-[10px] font-semibold text-slate-500">
                          💻 {tail(r.device_id)} · 🌐 {r.client_ip ?? '—'} · ⏱️ {timeAgo(r.created_at, Date.now())}
                        </p>

                        {/* 🧠 V20.0 · Dictamen Forense Gemini 2.5 Flash */}
                        {audit && (
                          <div
                            className={cx(
                              'mt-2 rounded-xl border p-2.5',
                              audit.classification === 'fake_envy'
                                ? 'border-impulso-emerald/40 bg-impulso-emerald/10'
                                : audit.classification === 'real_alert'
                                  ? 'border-impulso-rose/50 bg-impulso-rose/15'
                                  : 'border-amber-400/40 bg-amber-400/10',
                            )}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-1.5">
                              <span className="rounded-md bg-slate-950/70 px-2 py-0.5 font-mono text-[10px] font-black text-white">
                                [Score de Fraude: {audit.fraudScore}/10]
                              </span>
                              <span
                                className={cx(
                                  'text-[10px] font-extrabold uppercase tracking-wide',
                                  audit.classification === 'fake_envy'
                                    ? 'text-impulso-mint'
                                    : audit.classification === 'real_alert'
                                      ? 'text-impulso-rose'
                                      : 'text-amber-300',
                                )}
                              >
                                {audit.classification === 'fake_envy'
                                  ? '🛡️ Probable envidia / ataque falso'
                                  : audit.classification === 'real_alert'
                                    ? '🚨 Alerta crítica real'
                                    : '⚠️ Revisión recomendada'}
                              </span>
                            </div>
                            <p className="mt-1.5 text-[11px] font-bold leading-snug text-white">{audit.conclusion}</p>
                            {audit.signals.length > 0 && (
                              <ul className="mt-1 space-y-0.5">
                                {audit.signals.map((sig, idx) => (
                                  <li key={idx} className="text-[10px] font-medium text-slate-300">
                                    • {sig}
                                  </li>
                                ))}
                              </ul>
                            )}
                            <p className="mt-1 text-[10px] font-extrabold text-slate-400">
                              👉 Sugerencia: {audit.recommendedAction}
                            </p>
                          </div>
                        )}

                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <button
                            onClick={() => void runReportFraudAudit(r)}
                            disabled={reportAuditBusyId === r.id}
                            className="pressable flex items-center gap-1 rounded-lg border border-violet-400/40 bg-violet-500/15 px-2.5 py-1 text-[10px] font-extrabold text-violet-200 disabled:opacity-50"
                          >
                            {reportAuditBusyId === r.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              '🧠'
                            )}{' '}
                            Analizar Reporte con IA
                          </button>
                          <button
                            onClick={() => void handleDismissReport(r)}
                            disabled={busyId === r.id}
                            className="pressable flex items-center gap-1 rounded-lg border border-impulso-emerald/40 bg-impulso-emerald/10 px-2.5 py-1 text-[10px] font-extrabold text-impulso-mint disabled:opacity-50"
                          >
                            🗑️ Borrar denuncia
                          </button>
                          {r.merchant_id && (
                            <button
                              onClick={() => void handleClearMerchantReports(r.merchant_id!, r.merchant_name ?? 'Local')}
                              disabled={busyId === r.merchant_id}
                              className="pressable flex items-center gap-1 rounded-lg border border-white/15 bg-slate-900 px-2.5 py-1 text-[10px] font-extrabold text-slate-200 disabled:opacity-50"
                            >
                              🧹 Limpiar local
                            </button>
                          )}
                          {(r.client_ip || r.device_id) && (
                            <button
                              onClick={() =>
                                setInspecting({
                                  customerName: 'Reportante anónimo',
                                  phone: '—',
                                  clientIp: r.client_ip,
                                  deviceId: r.device_id,
                                  clientLat: null,
                                  clientLng: null,
                                  code: `REP-${r.id.slice(0, 6).toUpperCase()}`,
                                  createdAt: r.created_at,
                                })
                              }
                              className="pressable rounded-lg border border-impulso-gold/40 bg-impulso-gold/10 px-2 py-1 text-[10px] font-extrabold text-impulso-gold"
                            >
                              🕵️‍♂️ IP
                            </button>
                          )}
                        </div>
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
            </div>
        )}

        {/* ═══ Pestaña 3: Cobros Nequi (bandeja de aprobación en 1 clic) ═══ */}
        {tab === 'cobros' && (
          <div className="space-y-2.5 p-4">
            {/* 💳 V18 · Configuración de recaudo + aprobación automática */}
            <section className="rounded-3xl border border-impulso-emerald/25 bg-impulso-panel p-4">
              <p className="text-sm font-bold text-impulso-mint">💳 Mi Configuración de Recaudo</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                Los comercios pagan a estos datos y los ven en su ventana de recarga. Por defecto: Nequi 3158942112.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Número Nequi / Daviplata</p>
                  <input
                    value={paymentContact}
                    onChange={(e) => setPaymentContact(e.target.value.replace(/\D/g, ''))}
                    placeholder="3158942112"
                    inputMode="tel"
                    maxLength={13}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2.5 font-mono text-sm font-bold tracking-wider text-white placeholder:text-slate-600 outline-none focus:border-impulso-emerald/60"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Llave Bre-B / Transfiya</p>
                  <input
                    value={llaveInput}
                    onChange={(e) => setLlaveInput(e.target.value.slice(0, 40))}
                    placeholder="@impulso3158942112"
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2.5 font-mono text-sm font-bold text-white placeholder:text-slate-600 outline-none focus:border-impulso-emerald/60"
                  />
                </div>
                <div className="sm:col-span-2">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Titular de la cuenta</p>
                  <input
                    value={holderInput}
                    onChange={(e) => setHolderInput(e.target.value.slice(0, 60))}
                    placeholder="Administrador Impulso"
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2.5 text-sm font-bold text-white placeholder:text-slate-600 outline-none focus:border-impulso-emerald/60"
                  />
                </div>
                <div className="sm:col-span-2">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                    Tu Código QR oficial de Nequi / Daviplata (PNG o JPG)
                  </p>
                  <div className="mt-1.5 flex items-center gap-3">
                    {qrThumb ? (
                      <img
                        src={qrThumb}
                        alt="QR oficial de recaudo"
                        className="h-20 w-20 shrink-0 rounded-xl border border-impulso-emerald/35 bg-white object-contain p-1"
                      />
                    ) : (
                      <div className="grid h-20 w-20 shrink-0 place-items-center rounded-xl border border-dashed border-white/20 bg-slate-950/50 text-2xl">
                        📷
                      </div>
                    )}
                    <div className="flex flex-1 flex-wrap gap-1.5">
                      <label className="pressable flex cursor-pointer items-center gap-1.5 rounded-xl border border-impulso-emerald/40 bg-impulso-emerald/10 px-3 py-2 text-[11px] font-extrabold text-impulso-mint">
                        {qrBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '📤'} Subir QR oficial (PNG/JPG)
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/*"
                          className="hidden"
                          onChange={(e) => void pickAdminQr(e.target.files?.[0])}
                        />
                      </label>
                      {qrThumb && (
                        <button
                          onClick={() => setQrThumb('')}
                          className="pressable rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-[11px] font-bold text-slate-400"
                        >
                          🗑️ Quitar
                        </button>
                      )}
                      <p className="w-full text-[10px] font-semibold leading-relaxed text-slate-400">
                        Sube la imagen descargada directamente desde tu app Nequi o Daviplata para garantizar 100% de
                        lectura en los pagos de tus comercios.
                      </p>
                    </div>
                  </div>
                </div>
                {/* ⚡ Switch de aprobación automática */}
                <button
                  onClick={() => setAutoApprove((v) => !v)}
                  className={cx(
                    'pressable flex items-center justify-between gap-3 rounded-2xl border p-3 text-left transition sm:col-span-2',
                    autoApprove ? 'border-impulso-gold/50 bg-impulso-gold/10' : 'border-white/10 bg-slate-950/40',
                  )}
                >
                  <span>
                    <span className={cx('block text-xs font-extrabold', autoApprove ? 'text-impulso-gold' : 'text-slate-300')}>
                      ⚡ Aprobación Automática Instantánea {autoApprove ? '· ACTIVA' : '· apagada'}
                    </span>
                    <span className="mt-0.5 block text-[10px] font-semibold leading-relaxed text-slate-500">
                      Acredita los créditos al acto solo si la IA confirma: destino a tu cuenta + monto exacto del plan +
                      referencia y huella de imagen únicas. Todo queda auditado aquí.
                    </span>
                  </span>
                  <span
                    className={cx(
                      'relative h-6 w-11 shrink-0 rounded-full transition',
                      autoApprove ? 'bg-impulso-gold' : 'bg-slate-700',
                    )}
                  >
                    <span
                      className={cx(
                        'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all',
                        autoApprove ? 'left-[1.4rem]' : 'left-0.5',
                      )}
                    />
                  </span>
                </button>
              </div>
              <button
                onClick={() => void savePaymentContact()}
                disabled={contactBusy}
                className="pressable mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-impulso-emerald py-3 text-sm font-extrabold text-slate-950 disabled:opacity-60"
              >
                {contactBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : '💾'} Guardar configuración de cobros
              </button>
            </section>

            <p className="rounded-2xl border border-white/[0.08] bg-slate-950/40 p-3 text-[11px] font-semibold leading-relaxed text-slate-400">
              💳 Comprobantes Nequi/Daviplata/Llave enviados por los comercios. La IA forense ya leyó cada captura
              (destino, monto, fecha y estado): verifica contra tu app y aprueba para acreditar los créditos al instante.
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
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 md:items-start">
              {creditOrders.map((c) => (
                <article
                  key={c.id}
                  className={cx(
                    'rounded-3xl bg-slate-900/55 p-4 ring-1 transition',
                    c.status === 'pending'
                      ? 'shadow-[0_0_40px_-15px_rgba(245,158,11,0.22)] ring-impulso-gold/25'
                      : 'opacity-70 ring-white/[0.04]'
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
                      {/* 🟢 V18 · Sello del validador forense (IA + destino + unicidad) */}
                      {c.ia_status_ok && (
                        <p className="mt-1 rounded-lg bg-impulso-emerald/10 px-2 py-1 text-[10px] font-extrabold text-impulso-mint">
                          🟢 Validado por Escáner IA{c.destination_detected ? ` (destino ${c.destination_detected} confirmado · Único uso)` : ' (Único uso)'}
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
              ))}
              </div>
            )}

            <p className="text-center text-[10px] leading-relaxed text-slate-500">
              Venta de licencias de uso de software / créditos publicitarios prepagados bajo régimen simplificado · no
              responsable de IVA (Art. 437 ET Colombia).
            </p>
          </div>
        )}

        {/* ═══ Pestaña 4 · Bandeja del Conserje Inteligente (support_tickets) ═══ */}
        {tab === 'soporte' && (
          <div className="space-y-3 p-4">
            <div className="rounded-3xl border border-impulso-emerald/25 bg-impulso-panel p-4">
              <p className="text-sm font-extrabold text-impulso-mint">🛠️ Bandeja de Soporte Técnico (Conserje IA)</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                Reportes técnicos y casos escalados automáticamente desde el Conserje de clientes y comercios.
              </p>
            </div>

            {supportTickets.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-slate-950/40 p-6 text-center text-xs font-semibold text-slate-500">
                Sin tickets de soporte pendientes. ¡La plataforma opera con normalidad! ✅
              </p>
            ) : (
              <div className="space-y-2.5">
                {supportTickets.map((t) => {
                  const sevCls =
                    t.severity === 'critical' || t.severity === 'high'
                      ? 'border-impulso-rose/40 bg-impulso-rose/15 text-impulso-rose'
                      : t.severity === 'medium'
                        ? 'border-impulso-gold/40 bg-impulso-gold/15 text-impulso-gold'
                        : 'border-white/10 bg-white/5 text-slate-300';
                  return (
                    <article
                      key={t.id}
                      className="rounded-2xl border border-white/10 bg-impulso-panel p-3.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={cx('rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase', sevCls)}>
                            {t.severity}
                          </span>
                          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                            {t.user_role === 'merchant' ? '🏪 Comercio' : '🛍️ Cliente'} · {t.user_name}
                          </span>
                        </div>
                        <span className="text-[10px] font-semibold text-slate-500">
                          {t.municipality} · {timeAgo(t.created_at, Date.now())}
                        </span>
                      </div>

                      <p className="mt-2 text-sm font-extrabold text-white">{t.summary}</p>
                      <p className="mt-1 rounded-xl border border-white/[0.06] bg-slate-950/60 p-2.5 text-xs leading-relaxed text-slate-300">
                        <span className="font-extrabold text-impulso-mint">Diagnóstico IA:</span> {t.ai_analysis}
                      </p>

                      {Array.isArray(t.chat_transcript) && t.chat_transcript.length > 0 && (
                        <details className="mt-2 rounded-xl border border-white/[0.06] bg-slate-950/40 p-2.5 text-xs text-slate-400">
                          <summary className="cursor-pointer font-bold text-slate-300">
                            Ver transcripción del chat ({t.chat_transcript.length} mensajes)
                          </summary>
                          <div className="mt-2 space-y-1.5">
                            {t.chat_transcript.map((msg, i) => (
                              <p key={i} className="leading-relaxed">
                                <span className="font-extrabold text-slate-200">
                                  {msg.role === 'user' ? 'Usuario:' : 'Conserje:'}
                                </span>{' '}
                                {msg.text}
                              </p>
                            ))}
                          </div>
                        </details>
                      )}

                      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                        <span
                          className={cx(
                            'rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase',
                            t.status === 'resolved'
                              ? 'bg-impulso-emerald/15 text-impulso-mint'
                              : t.status === 'in_progress'
                                ? 'bg-impulso-gold/15 text-impulso-gold'
                                : 'bg-impulso-rose/15 text-impulso-rose',
                          )}
                        >
                          {t.status === 'resolved' ? '✅ Resuelto' : t.status === 'in_progress' ? '⚙️ En revisión' : '🔴 Abierto'}
                        </span>
                        <div className="flex gap-1.5">
                          {t.status !== 'in_progress' && (
                            <button
                              type="button"
                              disabled={ticketBusyId === t.id}
                              onClick={() => void handleSupportStatus(t.id, 'in_progress')}
                              className="pressable rounded-xl border border-impulso-gold/40 bg-impulso-gold/10 px-2.5 py-1.5 text-[11px] font-bold text-impulso-gold disabled:opacity-50"
                            >
                              En revisión
                            </button>
                          )}
                          {t.status !== 'resolved' && (
                            <button
                              type="button"
                              disabled={ticketBusyId === t.id}
                              onClick={() => void handleSupportStatus(t.id, 'resolved')}
                              className="pressable rounded-xl bg-impulso-emerald px-3 py-1.5 text-[11px] font-extrabold text-slate-950 disabled:opacity-50"
                            >
                              {ticketBusyId === t.id ? 'Guardando…' : 'Marcar resuelto'}
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══ Pestaña 5: Resumen y limpieza ═══ */}
        {tab === 'summary' && (
          <div className="space-y-3 p-4">
            {stats ? (
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
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
                <div className="col-span-2 lg:col-span-4 rounded-2xl border border-impulso-rose/25 bg-impulso-rose/5 p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-impulso-rose/70">🚩 Reportes activos</p>
                  <p className="text-xl font-extrabold text-impulso-rose">{stats.openReports}</p>
                </div>
              </div>
            ) : (
              <div className="flex justify-center py-10">
                <Loader2 className="h-7 w-7 animate-spin text-impulso-gold" />
              </div>
            )}

            {/* 💳 V18 · La configuración completa de recaudo vive en la pestaña Cobros */}
            <section className="rounded-3xl border border-impulso-emerald/25 bg-impulso-panel p-4">
              <p className="text-sm font-bold text-impulso-mint">
                💳 Cobros Nequi {paymentContact || '3158942112'} · {autoApprove ? '⚡ Auto-aprobación ACTIVA' : '⏳ Aprobación manual'}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                Número Nequi, Llave Bre-B, titular, QR oficial y el switch de aprobación automática se editan en la
                pestaña 💳 Cobros. Todo vive protegido en la base de datos, sin redeploy.
              </p>
              <button
                onClick={() => setTab('cobros')}
                className="pressable mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-impulso-emerald/40 bg-impulso-emerald/10 py-2.5 text-xs font-extrabold text-impulso-mint"
              >
                Abrir 💳 Cobros
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
              Borra todas las ofertas vencidas (incluidas sus fotos) para mantener la plataforma rápida y ligera siempre.
            </p>
          </div>
        )}
      </div>

      {/* 🕵️‍♂️ Ficha forense de IP / GPS / dispositivo */}
      <ForensicInspector data={inspecting} onClose={() => setInspecting(null)} />
    </div>
  );
}
