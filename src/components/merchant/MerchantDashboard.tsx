import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  BellRing,
  Camera,
  CheckCircle2,
  Coins,
  Fingerprint,
  Flame,
  History,
  Loader2,
  LocateFixed,
  LogOut,
  MapPin,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Undo2,
} from 'lucide-react';
import type { MerchantReservation, Offer, OfferForm, OfferStatus, PaymentMethod, PaymentType, Profile } from '../../types';
import { categoryMeta, PAYMENT_TYPES, paymentTypeMeta } from '../../types';
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
import { submitKybVerification, updateMyProfile } from '../../services/profile.service';
import {
  completePreparedPasskeyEnrollment,
  getWebAuthnServerMode,
  isWebAuthnSupported,
  listMyPasskeys,
  PASSKEY_LINKED_SUCCESS_MSG,
  revokePasskey,
  verifyPasswordAndPreparePasskey,
  WEBAUTHN_CANCELLED_MSG,
} from '../../services/WebAuthnService';
import type { PasskeyDevice, PreparedPasskeyEnrollment, WebAuthnServerMode } from '../../services/WebAuthnService';
import { sha256Hex } from '../../utils/hash';
import {
  deleteMyPaymentMethod,
  fetchMerchantPaymentMethods,
  normalizePaymentNumber,
  saveMyPaymentMethod,
  validatePaymentNumber,
} from '../../services/payment-methods.service';
import { OfferCreator } from './OfferCreator';
import { LocationPicker } from './LocationPicker';
import { CreditsModal } from './CreditsModal';
import { SupportConcierge } from '../support/SupportConcierge';
import { fetchPaymentContact } from '../../services/credits.service';
import { countdownText, cx, formatCOP, ratingAvg } from '../../utils/format';
import { useTick } from '../../hooks/useTick';
import { beepAlert } from '../../utils/sound';
import { openWhatsApp, shareUrl } from '../../utils/whatsapp';
import { encodeShortUuid } from '../../utils/shortId';
import { resolveTrustLevel } from '../../types';
import type { LatLng } from '../../utils/geo';
import { ADMIN_WHATSAPP } from '../../config/env';

interface MerchantDashboardProps {
  profile: Profile;
  onProfileChange: (profile: Profile) => void;
  onExit: () => void;
  onSignOut: () => Promise<void>;
  /** Abre el Panel de Administrador (solo cuenta con rol admin). */
  onOpenAdmin?: () => void;
  /** V38.0 · Permite que Radar desde Mi Panel también salte al mapa o abra una oferta. */
  onFocusOfferOnMap?: (offer: Offer) => void;
  onReserveOffer?: (offer: Offer) => void;
  /** V40.0 · Posición GPS efímera activa en sesión (Ley 1581: solo en memoria de React). */
  geoPos?: LatLng | null;
}

/**
 * Centro de control del comerciante:
 *  - Creador Mágico con IA (texto/voz → oferta estructurada).
 *  - Reservas en vivo con alerta sonora nativa.
 *  - Créditos, republicación en 1 clic y recarga vía WhatsApp del admin.
 */
export function MerchantDashboard({
  profile,
  onProfileChange,
  onExit,
  onSignOut,
  onOpenAdmin,
  onFocusOfferOnMap,
  onReserveOffer,
  geoPos = null,
}: MerchantDashboardProps) {
  const toast = useToast();
  const now = useTick(1000);
  const [myOffers, setMyOffers] = useState<Offer[]>([]);
  const [reservations, setReservations] = useState<MerchantReservation[]>([]);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [initialForm, setInitialForm] = useState<OfferForm | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    reservation: MerchantReservation;
    type: 'completed' | 'released';
  } | null>(null);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [nitInput, setNitInput] = useState(profile.nit_or_cedula ?? '');
  const [socialInput, setSocialInput] = useState(profile.social_or_maps_link ?? '');
  const [trustBusy, setTrustBusy] = useState(false);
  /** 🪪 V20 · Blindaje KYB: cédula/RUT + foto del establecimiento (WebP ≤ 100 KB). */
  const [kybDoc, setKybDoc] = useState<string | null>(null);
  const [kybFace, setKybFace] = useState<string | null>(null);
  const [kybBusy, setKybBusy] = useState(false);
  /** 💳 V16 · Métodos de pago del comercio (Nequi/Daviplata/Bancolombia/efectivo). */
  const [payMethods, setPayMethods] = useState<PaymentMethod[]>([]);
  const [payType, setPayType] = useState<PaymentType>('nequi');
  const [payNumber, setPayNumber] = useState('');
  const [payHolder, setPayHolder] = useState('');
  const [payBusy, setPayBusy] = useState(false);
  const [payDeleting, setPayDeleting] = useState<PaymentType | null>(null);
  /** 🔐 V20.0 · Biometría real (WebAuthn / Passkeys con validación obligatoria de contraseña). */
  const [passkeys, setPasskeys] = useState<PasskeyDevice[]>([]);
  const [, setPasskeyMode] = useState<WebAuthnServerMode>('unconfigured');
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [vaultPwdPrompt, setVaultPwdPrompt] = useState(false);
  const [vaultPassword, setVaultPassword] = useState('');
  const [vaultError, setVaultError] = useState('');
  const [passkeyNotice, setPasskeyNotice] = useState('');
  const [preparedPasskey, setPreparedPasskey] = useState<PreparedPasskeyEnrollment | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  /** 📱 Número oficial de recargas/soporte (BD del admin, fallback al .env). */
  const [paymentContact, setPaymentContact] = useState(ADMIN_WHATSAPP);

  const refreshPasskeys = useCallback(async () => {
    if (!isWebAuthnSupported()) return;
    try {
      const [list, srvMode] = await Promise.all([listMyPasskeys(), getWebAuthnServerMode()]);
      setPasskeys(list);
      setPasskeyMode(srvMode);
    } catch {
      /* si aún falta correr el SQL de passkeys, la tarjeta lo indica sin romper */
    }
  }, []);

  useEffect(() => {
    void refreshPasskeys();
  }, [refreshPasskeys]);

  async function finalizePreparedPasskey(prepared: PreparedPasskeyEnrollment, isManualRetry = false) {
    setPasskeyBusy(true);
    setVaultError('');
    try {
      await completePreparedPasskeyEnrollment(prepared);
      setPreparedPasskey(null);
      setVaultPwdPrompt(false);
      setVaultPassword('');
      setPasskeyNotice(PASSKEY_LINKED_SUCCESS_MSG);
      toast.success(PASSKEY_LINKED_SUCCESS_MSG);
      await refreshPasskeys();
    } catch (err) {
      if (err instanceof Error && err.message === 'GESTURE_OR_CANCELLED') {
        if (isManualRetry) {
          setPreparedPasskey(null);
          setVaultPwdPrompt(false);
          setVaultPassword('');
          toast.info(WEBAUTHN_CANCELLED_MSG);
        } else {
          setPreparedPasskey(prepared);
          setVaultError(
            'Contraseña confirmada ✅. Toca el botón verde "Escanear Huella ahora" para abrir el lector biométrico.',
          );
        }
      } else {
        setPreparedPasskey(null);
        const msg = friendlyError(err);
        setVaultError(msg);
        toast.error(msg);
      }
    } finally {
      setPasskeyBusy(false);
    }
  }

  async function enrollPasskey(pwd: string) {
    setPasskeyBusy(true);
    setVaultError('');
    setPasskeyNotice('');
    try {
      const prepared = await verifyPasswordAndPreparePasskey(pwd);
      await finalizePreparedPasskey(prepared);
    } catch (err) {
      const msg = friendlyError(err);
      setVaultError(msg);
      toast.error(msg);
      setPasskeyBusy(false);
    }
  }

  function handleActivateBiometric() {
    setVaultError('');
    setPasskeyNotice('');
    setPreparedPasskey(null);
    setVaultPwdPrompt(true);
  }

  async function handleRevokePasskey(p: PasskeyDevice) {
    setRevokingId(p.id);
    try {
      await revokePasskey(p.id, p.credential_id);
      setPasskeys((prev) => prev.filter((x) => x.id !== p.id));
      toast.info('🔓 Dispositivo biométrico revocado');
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setRevokingId(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetchPaymentContact()
      .then((value) => {
        if (!cancelled && value) setPaymentContact(value);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  /** 💳 V16 · Carga los métodos de pago registrados al abrir el panel. */
  const refreshPayMethods = useCallback(async () => {
    try {
      setPayMethods(await fetchMerchantPaymentMethods(profile.id));
    } catch (err) {
      console.warn('[Impulso] métodos de pago:', friendlyError(err));
    }
  }, [profile.id]);

  useEffect(() => {
    void refreshPayMethods();
  }, [refreshPayMethods]);

  /** Guarda un método de pago: el servidor valida formato + unicidad global. */
  async function savePayMethod() {
    const liveError = validatePaymentNumber(payType, payNumber);
    if (payType !== 'efectivo' && liveError) {
      toast.error(liveError);
      return;
    }
    setPayBusy(true);
    try {
      const saved = await saveMyPaymentMethod(payType, payNumber, payHolder.trim() || undefined);
      setPayMethods((prev) => {
        const others = prev.filter((m) => m.method_type !== saved.method_type);
        return [...others, saved];
      });
      setPayNumber('');
      setPayHolder('');
      toast.success(`${paymentTypeMeta(saved.method_type).emoji} ${paymentTypeMeta(saved.method_type).label} guardado y verificado: ya aparece en tu perfil público`);
    } catch (err) {
      // El servidor trae el mensaje exacto (formato o DUPLICADO global)
      toast.error(friendlyError(err));
    } finally {
      setPayBusy(false);
    }
  }

  /** Elimina un método de pago propio. */
  async function removePayMethod(type: PaymentType) {
    setPayDeleting(type);
    try {
      await deleteMyPaymentMethod(type);
      setPayMethods((prev) => prev.filter((m) => m.method_type !== type));
      toast.info('Método de pago eliminado de tu perfil');
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setPayDeleting(null);
    }
  }

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
        (payload) => {
          beepAlert();
          toast.push('🔔 ¡Nueva reserva! Alguien apartó tu producto', 'success');
          const inserted = payload.new as Partial<MerchantReservation> | null;
          const insertedId = inserted?.id;
          if (insertedId && inserted) {
            setReservations((prev) => {
              if (prev.some((r) => r.id === insertedId)) return prev;
              const optimistic: MerchantReservation = {
                id: insertedId,
                offer_id: inserted.offer_id ?? '',
                merchant_id: inserted.merchant_id ?? profile.id,
                customer_name: inserted.customer_name ?? 'Cliente cercano',
                customer_phone: inserted.customer_phone ?? '',
                quantity: Number(inserted.quantity ?? 1),
                customer_note: inserted.customer_note ?? '',
                reservation_code: inserted.reservation_code ?? '----',
                status: inserted.status ?? 'pending',
                is_rated: Boolean(inserted.is_rated),
                client_ip: inserted.client_ip ?? null,
                device_id: inserted.device_id ?? null,
                created_at: inserted.created_at ?? new Date().toISOString(),
              };
              return [optimistic, ...prev];
            });
          }
          void refreshReservations();
          void refreshOffers();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'reservations', filter: `merchant_id=eq.${profile.id}` },
        () => {
          void refreshReservations();
          void refreshOffers();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${profile.id}` },
        (payload) => {
          // Créditos verificación o suspensión aprobados por el admin: reflejo instantáneo
          if (payload.new) onProfileChange(payload.new as unknown as Profile);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'offers', filter: `merchant_id=eq.${profile.id}` },
        () => {
          void refreshOffers();
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
      toast.success(
        action === 'completed' ? '✅ Vendido / Entregado' : '✕ Cancelado / Vuelto a Stock'
      );
      // Refresco silencioso en segundo plano con los valores reales del servidor
      void refreshReservations();
      void refreshOffers();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setUpdating(null);
    }
  }

  /** Confirma en 2 pasos (evita toques accidentales al entregar o cancelar una reserva). */
  async function executeConfirmedAction() {
    if (!confirmAction) return;
    const { reservation, type } = confirmAction;
    setConfirmAction(null);
    await handleReservation(reservation.id, type);
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

  /** 🪪 V20 · Blindaje KYB: comprime cada imagen a WebP ≤ 100 KB (canvas en
   *  el navegador, máximo 800px) y calcula su huella SHA-256 antes de enviar. */
  const pickKybImage = useCallback(
    async (file: File | undefined, slot: 'doc' | 'face') => {
      if (!file) return;
      try {
        const webp = await compressImageToMicroWebP(file, 800, 0.65, 72 * 1024);
        if (slot === 'doc') setKybDoc(webp);
        else setKybFace(webp);
        toast.success(`🪪 Imagen WebP optimizada: de ${Math.round(file.size / 1024)} KB a ${Math.round((webp.length * 0.75) / 1024)} KB`);
      } catch (err) {
        toast.error(friendlyError(err));
      }
    },
    [toast],
  );

  /** 🪪 V20 · Envía el expediente: hash SHA-256 de cada imagen + RPC security
   *  definer. El administrador lo audita visualmente desde el Súper Panel. */
  async function submitKyb() {
    if (!kybDoc || !kybFace) {
      toast.error('Sube tu documento (cédula/RUT) y la foto del establecimiento o de ti');
      return;
    }
    setKybBusy(true);
    try {
      const [docHash, faceHash] = await Promise.all([sha256Hex(kybDoc), sha256Hex(kybFace)]);
      await submitKybVerification({ docImage: kybDoc, faceImage: kybFace, docHash, faceHash });
      onProfileChange({ ...profile, kyb_status: 'pending' });
      toast.success('🪪 Verificación enviada: el administrador auditará tus documentos');
      setKybDoc(null);
      setKybFace(null);
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setKybBusy(false);
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
        <div className="mx-auto max-w-xl lg:max-w-[1440px]">
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

      <main className="mx-auto max-w-xl space-y-5 px-3 pt-4 lg:max-w-[1440px] lg:grid lg:grid-cols-12 lg:gap-6 lg:space-y-0 lg:items-start lg:px-4">
        <div className="space-y-5 lg:col-span-7">
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
                  paymentContact,
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
          <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              onClick={() => setCreditsOpen(true)}
              className="pressable flex w-full items-center justify-center gap-2 rounded-2xl bg-impulso-gold py-3 text-sm font-extrabold text-slate-950"
            >
              <MessageCircle className="h-4 w-4" /> Recargar créditos por Nequi
            </button>
            <button
              type="button"
              onClick={() => {
                const link = `${window.location.origin}${window.location.pathname}?c=${encodeShortUuid(profile.id)}`;
                const text = `🏪 Visita ${profile.business_name} en Impulso (${profile.municipality}) y aparta nuestras ofertas activas 👉 ${link}`;
                if (navigator.share) {
                  void navigator.share({ title: profile.business_name, text, url: link }).catch(() => undefined);
                } else {
                  void navigator.clipboard
                    .writeText(text)
                    .then(() => toast.success('📢 Enlace de tu Perfil Público copiado para WhatsApp e Instagram'))
                    .catch(() => toast.error('No se pudo copiar el enlace'));
                }
              }}
              className="pressable flex w-full items-center justify-center gap-2 rounded-2xl border border-impulso-emerald/40 bg-impulso-emerald/15 py-3 text-sm font-extrabold text-impulso-mint"
            >
              📢 Compartir mi Perfil Público
            </button>
          </div>

          {/* 👑 V36.0 · Gamificación de Nivel de Confianza (motor de retención y calidad) */}
          {(() => {
            const level = resolveTrustLevel(profile);
            const pct = Math.min(100, Math.round((lifetimeOrders / 20) * 100));
            return (
              <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/55 p-3">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-extrabold text-white">
                    {level === 'super'
                      ? '👑 Nivel 3 · Súper Comercio Activo'
                      : level === 'verified'
                        ? '✓ Nivel 2 · Comercio Verificado'
                        : '🌱 Nivel 1 · Comercio Nuevo'}
                  </span>
                  <span className="font-bold text-impulso-gold">
                    {level === 'super' ? 'Halo Dorado Activo' : `${Math.min(lifetimeOrders, 20)}/20 entregas`}
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={cx(
                      'h-full rounded-full transition-all duration-500',
                      level === 'super'
                        ? 'bg-gradient-to-r from-amber-400 to-yellow-300'
                        : 'bg-gradient-to-r from-impulso-emerald to-sky-400',
                    )}
                    style={{ width: `${level === 'super' ? 100 : Math.max(8, pct)}%` }}
                  />
                </div>
                <p className="mt-1.5 text-[10px] font-semibold leading-relaxed text-slate-400">
                  {level === 'super'
                    ? '¡Felicitaciones! Tus ofertas destacan con borde dorado y máxima confianza en el radar.'
                    : level === 'verified'
                      ? `Te faltan ${Math.max(0, 20 - lifetimeOrders)} entregas completadas para desbloquear el borde dorado 👑 Súper Comercio.`
                      : 'Completa tu verificación KYB abajo para quitar el aviso de comercio nuevo y ganar el check azul Verificado.'}
                </p>
              </div>
            );
          })()}
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
                      onClick={() => setConfirmAction({ reservation: r, type: 'completed' })}
                      disabled={updating === r.id}
                      className="pressable flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-impulso-emerald py-2.5 text-xs font-extrabold text-white disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Marcar como Entregado
                    </button>
                    <button
                      onClick={() => setConfirmAction({ reservation: r, type: 'released' })}
                      disabled={updating === r.id}
                      className="pressable flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-impulso-rose/30 bg-impulso-rose/10 py-2.5 text-xs font-bold text-impulso-rose disabled:opacity-50"
                    >
                      <Undo2 className="h-4 w-4" /> Cancelar Reserva
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

        {/* Historial de ventas y cancelaciones (se actualiza en vivo) */}
        {history.length > 0 && (
          <section>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-slate-400">
              <History className="h-4 w-4 text-impulso-mint" /> Historial de ventas y cancelaciones
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold text-slate-400">
                {history.length}
              </span>
            </h2>
            <div className="space-y-2">
              {history.slice(0, 10).map((r) => (
                <article
                  key={r.id}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-impulso-card p-3 opacity-85"
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
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-extrabold ${
                      r.status === 'completed'
                        ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                        : 'border-rose-500/25 bg-rose-500/10 text-rose-300'
                    }`}
                  >
                    {r.status === 'completed' ? '✅ Vendido / Entregado' : '✕ Cancelado / Vuelto a Stock'}
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
        </div>

        <div className="space-y-5 lg:col-span-5">
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

        {/* 🔐 V19.0 · Seguridad Biométrica Real (WebAuthn / Passkeys) */}
        {isWebAuthnSupported() && (
          <section className="rounded-3xl border border-impulso-emerald/25 bg-impulso-panel p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-bold text-white">
                  <Fingerprint className="h-4 w-4 text-impulso-mint" /> Acceso con Huella / FaceID
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-300">
                  🔒 Cada celular o computador guarda su propia llave biométrica cifrada. Si abres tu cuenta en un equipo nuevo o el navegador te pide escanear un código QR sin llaves disponibles, entra primero con tu contraseña y toca activar huella en ese equipo.
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-impulso-emerald/30 bg-impulso-emerald/10 px-2.5 py-1 text-[10px] font-extrabold text-impulso-mint">
                {passkeys.length} activo{passkeys.length === 1 ? '' : 's'}
              </span>
            </div>

            {!profile.is_verified && profile.role !== 'admin' ? (
              <p className="mt-3 rounded-2xl border border-impulso-gold/30 bg-impulso-gold/10 p-3 text-xs font-semibold leading-relaxed text-amber-200/90">
                🛡️ Disponible al completar tu verificación de identidad (✅ Verificado). Así garantizamos que solo comercios verificados registren llaves biométricas.
              </p>
            ) : (
              <>
                {passkeys.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {passkeys.map((pk) => (
                      <div
                        key={pk.id}
                        className="flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-extrabold text-white">🔐 {pk.device_label}</p>
                          <p className="truncate text-[10px] font-semibold text-slate-500">
                            Registrado {new Date(pk.created_at).toLocaleDateString('es-CO')}
                            {pk.last_used_at ? ` · Último uso ${new Date(pk.last_used_at).toLocaleDateString('es-CO')}` : ''}
                          </p>
                        </div>
                        <button
                          onClick={() => void handleRevokePasskey(pk)}
                          disabled={revokingId === pk.id}
                          title="Revocar este dispositivo"
                          className="pressable shrink-0 rounded-xl border border-impulso-rose/30 bg-impulso-rose/10 px-2.5 py-1.5 text-[10px] font-extrabold text-impulso-rose disabled:opacity-50"
                        >
                          {revokingId === pk.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Revocar'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {passkeyNotice && (
                  <p className="mt-3 rounded-2xl border border-impulso-emerald/40 bg-impulso-emerald/15 p-3 text-xs font-bold leading-relaxed text-impulso-mint">
                    ✅ {passkeyNotice}
                  </p>
                )}

                {vaultPwdPrompt ? (
                  <div className="mt-3 space-y-2.5 rounded-2xl border border-impulso-emerald/30 bg-slate-950/50 p-3">
                    {preparedPasskey ? (
                      <>
                        <p className="text-xs font-bold leading-relaxed text-impulso-mint">
                          ✅ Contraseña validada correctamente. Toca el botón para registrar tu huella o FaceID en este equipo:
                        </p>
                        {vaultError && (
                          <p className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-2.5 text-[11px] font-semibold text-amber-200">
                            {vaultError}
                          </p>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setPreparedPasskey(null);
                              setVaultPwdPrompt(false);
                              setVaultPassword('');
                              setVaultError('');
                              toast.info(WEBAUTHN_CANCELLED_MSG);
                            }}
                            className="pressable rounded-xl border border-white/10 py-2.5 text-xs font-bold text-slate-400"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            disabled={passkeyBusy}
                            onClick={() => void finalizePreparedPasskey(preparedPasskey, true)}
                            className="pressable flex items-center justify-center gap-1.5 rounded-xl bg-impulso-emerald py-2.5 text-xs font-extrabold text-slate-950 disabled:opacity-50"
                          >
                            {passkeyBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Fingerprint className="h-3.5 w-3.5" />}
                            Escanear Huella ahora
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-[11px] font-bold text-slate-300">
                          Por seguridad, confirma tu contraseña actual antes de vincular la huella en este dispositivo:
                        </p>
                        <input
                          type="password"
                          value={vaultPassword}
                          onChange={(e) => {
                            setVaultPassword(e.target.value);
                            if (vaultError) setVaultError('');
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && vaultPassword.length >= 6 && !passkeyBusy) {
                              void enrollPasskey(vaultPassword);
                            }
                          }}
                          placeholder="Tu contraseña actual"
                          autoComplete="current-password"
                          className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-sm font-medium text-white placeholder:text-slate-600 outline-none focus:border-impulso-emerald/60"
                        />
                        {vaultError && (
                          <p className="rounded-xl border border-impulso-rose/40 bg-impulso-rose/10 p-2.5 text-[11px] font-semibold text-impulso-rose">
                            {vaultError}
                          </p>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setVaultPwdPrompt(false);
                              setVaultPassword('');
                              setVaultError('');
                            }}
                            className="pressable rounded-xl border border-white/10 py-2 text-xs font-bold text-slate-400"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            disabled={passkeyBusy || vaultPassword.length < 6}
                            onClick={() => void enrollPasskey(vaultPassword)}
                            className="pressable flex items-center justify-center gap-1.5 rounded-xl bg-impulso-emerald py-2 text-xs font-extrabold text-slate-950 disabled:opacity-50"
                          >
                            {passkeyBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Fingerprint className="h-3.5 w-3.5" />}
                            Vincular Huella
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleActivateBiometric}
                    disabled={passkeyBusy}
                    className="pressable mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-impulso-emerald/40 bg-impulso-emerald/15 py-3 text-xs font-extrabold text-impulso-mint disabled:opacity-50"
                  >
                    {passkeyBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4" />}
                    {passkeyBusy ? 'Esperando huella / FaceID…' : 'Activar Huella / FaceID en este dispositivo'}
                  </button>
                )}
              </>
            )}
          </section>
        )}

        {/* 🛡️ V40.0 · Verificación Ágil de Comercio (rápida en 2 minutos + segura anti-estafas) */}
        <section className="rounded-3xl border border-white/10 bg-impulso-panel p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-extrabold text-white">
                <ShieldCheck className="h-4 w-4 text-impulso-mint" />
                Verificación Ágil de Comercio {profile.is_verified ? '✅' : ''}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                Obtén la insignia <span className="font-bold text-impulso-mint">✅ Verificado</span> en menos de 2 minutos para vender con máxima confianza (cero formularios largos).
              </p>
            </div>
            <span
              className={cx(
                'shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase',
                profile.is_verified
                  ? 'bg-impulso-emerald/15 text-impulso-mint'
                  : profile.kyb_status === 'pending'
                    ? 'bg-impulso-gold/15 text-impulso-gold'
                    : 'bg-white/10 text-slate-300',
              )}
            >
              {profile.is_verified ? 'Verificado' : profile.kyb_status === 'pending' ? 'En revisión' : '2 pasos'}
            </span>
          </div>

          {/* Paso 1 rápido: enlace o documento básico */}
          <div className="mt-3 space-y-2 rounded-2xl border border-white/[0.07] bg-slate-950/40 p-3">
            <p className="text-[11px] font-extrabold text-slate-200">
              Paso 1 · Datos básicos de respaldo (opcional pero acelera la aprobación)
            </p>
            <input
              value={socialInput}
              onChange={(e) => setSocialInput(e.target.value)}
              placeholder="Link de Google Maps, Instagram o Facebook del negocio"
              className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3.5 py-2.5 text-xs font-medium text-white placeholder:text-slate-600 outline-none focus:border-impulso-emerald/60"
            />
            <input
              value={nitInput}
              onChange={(e) => setNitInput(e.target.value)}
              placeholder="Cédula o NIT del titular (ej: 1023456789)"
              className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3.5 py-2.5 text-xs font-medium text-white placeholder:text-slate-600 outline-none focus:border-impulso-emerald/60"
            />
            <button
              onClick={() => void saveTrustData()}
              disabled={trustBusy}
              className="pressable flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-impulso-emerald to-teal-600 py-2.5 text-xs font-extrabold text-white disabled:opacity-60"
            >
              {trustBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : '💾'} Guardar respaldo rápido
            </button>
          </div>

          {/* Paso 2: 2 fotos rápidas en WebP o verificación exprés por WhatsApp */}
          <div className="mt-3 rounded-2xl border border-impulso-gold/25 bg-impulso-gold/5 p-3">
            <p className="flex items-center gap-1.5 text-xs font-extrabold text-impulso-gold">
              <ShieldCheck className="h-4 w-4" /> Paso 2 · Confirmación visual (2 fotos rápidas)
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              Toma o sube foto de tu <span className="font-bold text-slate-200">cédula/RUT</span> y de tu{' '}
              <span className="font-bold text-slate-200">local o producto real</span>. Se optimizan solas al instante.
            </p>
            {profile.kyb_status === 'pending' && (
              <p className="mt-2 rounded-xl border border-impulso-gold/30 bg-impulso-gold/10 px-3 py-2 text-xs font-bold text-impulso-gold">
                ⏳ Solicitud recibida: el administrador está revisando tu insignia ✅
              </p>
            )}
            {profile.kyb_status === 'approved' && (
              <p className="mt-2 rounded-xl border border-impulso-emerald/30 bg-impulso-emerald/10 px-3 py-2 text-xs font-bold text-impulso-mint">
                ✅ Comercio verificado: tus ofertas ya muestran el sello de confianza
              </p>
            )}
            {profile.kyb_status === 'rejected' && (
              <p className="mt-2 rounded-xl border border-impulso-rose/30 bg-impulso-rose/10 px-3 py-2 text-xs font-bold text-impulso-rose">
                Las fotos anteriores estaban borrosas: súbelas de nuevo con buena luz
              </p>
            )}
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <label className="pressable flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-slate-950/50 px-2 py-3 text-center text-xs font-bold text-slate-300">
                {kybDoc ? (
                  <img src={kybDoc} alt="Documento" className="h-14 w-full rounded-lg object-cover" />
                ) : (
                  <>
                    <span className="text-lg">🪪</span>
                    Cédula / RUT
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void pickKybImage(e.target.files?.[0], 'doc')}
                />
              </label>
              <label className="pressable flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-slate-950/50 px-2 py-3 text-center text-xs font-bold text-slate-300">
                {kybFace ? (
                  <img src={kybFace} alt="Establecimiento" className="h-14 w-full rounded-lg object-cover" />
                ) : (
                  <>
                    <span className="text-lg">🏪</span>
                    Foto del local
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void pickKybImage(e.target.files?.[0], 'face')}
                />
              </label>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              <button
                onClick={() => void submitKyb()}
                disabled={kybBusy || profile.kyb_status === 'pending'}
                className="pressable flex items-center justify-center gap-1.5 rounded-xl border border-impulso-gold/40 bg-impulso-gold/15 py-2.5 text-xs font-extrabold text-impulso-gold disabled:opacity-50"
              >
                {kybBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {profile.kyb_status === 'pending' ? 'En revisión…' : 'Solicitar insignia ✅'}
              </button>
              <button
                type="button"
                onClick={() =>
                  openWhatsApp(
                    paymentContact,
                    `¡Hola! Soy ${profile.business_name} en ${profile.municipality} y quiero agilizar mi verificación ✅ en Impulso.${socialInput.trim() ? ` Link: ${socialInput.trim()}` : ''}`,
                  )
                }
                className="pressable flex items-center justify-center gap-1.5 rounded-xl border border-impulso-emerald/35 bg-impulso-emerald/10 py-2.5 text-xs font-bold text-impulso-mint"
              >
                <MessageCircle className="h-3.5 w-3.5" /> Verificar por WhatsApp
              </button>
            </div>
          </div>
        </section>

        {/* 💳 V16 · Métodos de pago: Nequi/Daviplata validados y únicos en la plataforma */}
        <section className="rounded-3xl border border-white/10 bg-impulso-panel p-4">
          <p className="text-sm font-bold text-white">💳 Métodos de pago (para que te paguen al instante)</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Registra tu Nequi, Daviplata, cuenta Bancolombia o pago en efectivo. Impulso valida cada número
            automáticamente: si el formato es inválido o <span className="font-bold text-slate-300">otro comercio ya lo
            registró</span>, el sistema lo rechaza. Tus canales aparecen con QR y botón de copia en tu perfil público.
          </p>

          {/* Métodos ya registrados */}
          {payMethods.length > 0 && (
            <div className="mt-3 space-y-2">
              {payMethods.map((m) => {
                const meta = paymentTypeMeta(m.method_type);
                return (
                  <div key={m.id} className="flex items-center justify-between gap-2 rounded-2xl border border-impulso-emerald/25 bg-impulso-emerald/10 p-3">
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-impulso-mint">
                        {meta.emoji} {meta.label} · ✅ Verificado
                      </p>
                      <p className="truncate text-sm font-bold tabular-nums text-white">
                        {m.method_type === 'efectivo' ? 'Al momento de la entrega' : m.account_number}
                      </p>
                      {m.holder_name && <p className="truncate text-[10px] font-semibold text-slate-400">Titular: {m.holder_name}</p>}
                    </div>
                    <button
                      onClick={() => void removePayMethod(m.method_type)}
                      disabled={payDeleting === m.method_type}
                      title="Eliminar método"
                      aria-label={`Eliminar ${meta.label}`}
                      className="pressable grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-slate-950/40 text-slate-400 hover:text-impulso-rose disabled:opacity-50"
                    >
                      {payDeleting === m.method_type ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Selector de tipo en cascada */}
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {PAYMENT_TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setPayType(t.id);
                  setPayNumber('');
                }}
                className={cx(
                  'pressable rounded-xl border px-2 py-2 text-left text-[11px] font-extrabold transition',
                  payType === t.id ? 'border-impulso-gold/60 bg-impulso-gold/15 text-impulso-gold' : 'border-white/10 bg-slate-950/40 text-slate-400',
                )}
              >
                {t.emoji} {t.label}
                <span className="mt-0.5 block font-semibold opacity-70">{t.hint}</span>
              </button>
            ))}
          </div>

          {/* Formulario del número (oculto para efectivo) */}
          {payType !== 'efectivo' && (
            <div className="mt-3 space-y-2">
              <input
                value={payNumber}
                onChange={(e) => setPayNumber(e.target.value.replace(/\D/g, '').slice(0, 12))}
                inputMode="numeric"
                autoComplete="off"
                placeholder={payType === 'bancolombia' ? 'Número de cuenta (ej: 34512345678)' : 'Número de celular (ej: 3201234567)'}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm font-bold tabular-nums text-white placeholder:font-medium placeholder:text-slate-600 outline-none focus:border-impulso-emerald/60"
              />
              {/* Validación en vivo: formato correcto o el error exacto */}
              {payNumber.length > 0 && (
                <p className={cx('text-[11px] font-bold', validatePaymentNumber(payType, payNumber) ? 'text-impulso-rose' : 'text-impulso-mint')}>
                  {validatePaymentNumber(payType, payNumber) ? `⚠️ ${validatePaymentNumber(payType, payNumber)}` : `✅ Formato válido: ${normalizePaymentNumber(payNumber)}`}
                </p>
              )}
              <input
                value={payHolder}
                onChange={(e) => setPayHolder(e.target.value.slice(0, 60))}
                placeholder={`Titular de la cuenta (opcional: ${profile.business_name})`}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm font-medium text-white placeholder:text-slate-600 outline-none focus:border-impulso-emerald/60"
              />
            </div>
          )}
          <button
            onClick={() => void savePayMethod()}
            disabled={payBusy}
            className="pressable mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-impulso-emerald to-teal-600 py-3 text-sm font-extrabold text-white disabled:opacity-60"
          >
            {payBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : '💾'} {payType === 'efectivo' ? 'Activar pago en efectivo' : 'Guardar y verificar método de pago'}
          </button>
          <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
            🛡️ Verificación automática y segura: formato colombiano válido y protección exclusiva para tu cuenta. Nadie
            más puede registrar tu mismo canal de cobro.
          </p>
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
        </div>
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
      <CreditsModal
        open={creditsOpen}
        onClose={() => setCreditsOpen(false)}
        profile={profile}
        onCreditsApproved={(newCredits) => onProfileChange({ ...profile, credits: newCredits })}
      />

      {/* Confirmación en 2 pasos para "Marcar como Entregado" y "Cancelar Reserva" */}
      <ModalShell open={confirmAction !== null} onClose={() => !updating && setConfirmAction(null)}>
        {confirmAction && (
          <div className="p-5 pt-14 text-center">
            <p className="text-4xl">{confirmAction.type === 'completed' ? '✅' : '⚠️'}</p>
            <h3 className="mt-2 text-lg font-extrabold text-white">
              {confirmAction.type === 'completed'
                ? '¿Estás seguro de marcar este pedido como entregado?'
                : `¿Cancelar la reserva de ${confirmAction.reservation.customer_name} (código ${confirmAction.reservation.reservation_code})?`}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-400">
              {confirmAction.type === 'completed'
                ? `Se registrará la venta de ×${confirmAction.reservation.quantity} para ${confirmAction.reservation.customer_name} como "Vendido / Entregado".`
                : `Al confirmar, el pedido quedará marcado como "Cancelado / Vuelto a Stock" y las ${confirmAction.reservation.quantity} unidades regresarán a tu oferta activa.`}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => setConfirmAction(null)}
                disabled={updating !== null}
                className="pressable rounded-2xl border border-white/10 bg-slate-950/40 py-3.5 text-sm font-bold text-slate-200 disabled:opacity-50"
              >
                Volver
              </button>
              <button
                onClick={() => void executeConfirmedAction()}
                disabled={updating !== null}
                className={`pressable flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-extrabold text-white disabled:opacity-60 ${
                  confirmAction.type === 'completed' ? 'bg-impulso-emerald' : 'bg-impulso-rose'
                }`}
              >
                {updating !== null ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : confirmAction.type === 'completed' ? (
                  'Sí, marcar como entregado'
                ) : (
                  'Sí, cancelar y volver a stock'
                )}
              </button>
            </div>
          </div>
        )}
      </ModalShell>

      <SupportConcierge
        userRole={profile.role === 'admin' ? 'admin' : 'merchant'}
        userName={profile.business_name}
        municipality={profile.municipality}
        offers={myOffers}
        geoPos={geoPos}
        onFocusOfferOnMap={onFocusOfferOnMap}
        onReserveOffer={onReserveOffer}
        bottomOffsetClass="bottom-5 right-4 sm:bottom-6 sm:right-6"
      />
    </div>
  );
}
