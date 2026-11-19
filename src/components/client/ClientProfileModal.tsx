import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Fingerprint,
  Heart,
  Loader2,
  LogOut,
  MapPin,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Store,
  Ticket as TicketIcon,
  Trash2,
} from 'lucide-react';
import type { Category, ClientPreferences, Offer, Profile, Ticket } from '../../types';
import { CATEGORIES, MUNICIPIOS } from '../../types';
import { ModalShell } from '../ui/ModalShell';
import { useToast } from '../ui/Toast';
import { friendlyError } from '../../services/supabase';
import { upgradeClientToMerchant } from '../../services/profile.service';
import {
  completePreparedPasskeyEnrollment,
  isWebAuthnSupported,
  listMyPasskeys,
  PASSKEY_LINKED_SUCCESS_MSG,
  revokePasskey,
  verifyPasswordAndPreparePasskey,
  WEBAUTHN_CANCELLED_MSG,
} from '../../services/WebAuthnService';
import type { PasskeyDevice, PreparedPasskeyEnrollment } from '../../services/WebAuthnService';
import { cx, formatCOP } from '../../utils/format';

interface ClientProfileModalProps {
  open: boolean;
  onClose: () => void;
  profile: Profile | null;
  preferences: ClientPreferences;
  offers: Offer[];
  tickets: Ticket[];
  onSavePreferences: (next: ClientPreferences, applyFilterNow?: boolean) => Promise<void>;
  onToggleFavorite: (offerId: string) => void;
  onReserveOffer: (offer: Offer) => void;
  onFocusOfferOnMap: (offer: Offer) => void;
  onOpenAuth: () => void;
  onSignOut: () => Promise<void>;
  onUpgradedToMerchant: (newProfile: Profile) => void;
}

const BUDGET_PRESETS: Array<{ label: string; value: number | null }> = [
  { label: 'Hasta $15.000', value: 15_000 },
  { label: 'Hasta $30.000', value: 30_000 },
  { label: 'Hasta $50.000', value: 50_000 },
  { label: 'Cualquier precio', value: null },
];

type ClientTab = 'prefs' | 'favorites' | 'account';

/**
 * 🛍️ V37.0 · Hub Exclusivo del Comprador / Explorador:
 *  - Identidad visual 100% separada del Panel de Comercio (cero confusión entre cliente y negocio).
 *  - Preferencias ultra-ligeras (máx 5 categorías + presupuesto + máx 20 favoritos) que ahorran BD.
 *  - Termómetro de ahorro real + nivel de Vecino VIP + vinculación biométrica + conversión opcional a Comercio.
 */
export function ClientProfileModal({
  open,
  onClose,
  profile,
  preferences,
  offers,
  tickets,
  onSavePreferences,
  onToggleFavorite,
  onReserveOffer,
  onFocusOfferOnMap,
  onOpenAuth,
  onSignOut,
  onUpgradedToMerchant,
}: ClientProfileModalProps) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<ClientTab>('prefs');
  const [selectedCats, setSelectedCats] = useState<Category[]>(preferences.favoriteCategories);
  const [budget, setBudget] = useState<number | null>(preferences.maxBudgetCop);
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Passkeys (solo cuando el comprador tiene cuenta iniciada)
  const [passkeys, setPasskeys] = useState<PasskeyDevice[]>([]);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [showPwdForm, setShowPwdForm] = useState(false);
  const [pwdInput, setPwdInput] = useState('');
  const [prepared, setPrepared] = useState<PreparedPasskeyEnrollment | null>(null);

  // Conversión explícita a Comercio (si el cliente abre un negocio real)
  const [showUpgradeForm, setShowUpgradeForm] = useState(false);
  const [bizName, setBizName] = useState('');
  const [bizWa, setBizWa] = useState(profile?.whatsapp ?? '');
  const [bizCat, setBizCat] = useState<Category>('comida');
  const [bizMuni, setBizMuni] = useState(profile?.municipality ?? 'Gachetá');
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedCats(preferences.favoriteCategories);
    setBudget(preferences.maxBudgetCop);
    setShowPwdForm(false);
    setPrepared(null);
    setPwdInput('');
    setShowUpgradeForm(false);
    if (profile) {
      setBizWa(profile.whatsapp || '');
      setBizMuni(profile.municipality || 'Gachetá');
      if (isWebAuthnSupported()) {
        void listMyPasskeys()
          .then(setPasskeys)
          .catch(() => setPasskeys([]));
      }
    }
  }, [open, preferences, profile]);

  const favoriteOffers = useMemo(() => {
    const favSet = new Set(preferences.favoriteOfferIds);
    return offers.filter((o) => favSet.has(o.id));
  }, [offers, preferences.favoriteOfferIds]);

  const savingsStats = useMemo(() => {
    let savedCop = 0;
    let totalOrders = 0;
    for (const t of tickets) {
      if (t.status === 'released') continue;
      totalOrders += 1;
      if (t.originalPrice && t.originalPrice > t.promoPrice) {
        savedCop += (t.originalPrice - t.promoPrice) * t.quantity;
      }
    }
    const rank =
      totalOrders >= 10
        ? { label: '💎 Vecino VIP', next: 10, pct: 100 }
        : totalOrders >= 3
          ? { label: '🧭 Explorador Local', next: 10, pct: Math.min(100, Math.round((totalOrders / 10) * 100)) }
          : { label: '🌱 Nuevo Vecino', next: 3, pct: Math.min(100, Math.round((totalOrders / 3) * 100)) };
    return { savedCop, totalOrders, rank };
  }, [tickets]);

  function toggleCategory(cat: Category) {
    setSelectedCats((prev) => {
      if (prev.includes(cat)) return prev.filter((c) => c !== cat);
      if (prev.length >= 5) {
        toast.info('Puedes elegir hasta 5 categorías favoritas para mantener tu Radar ágil.');
        return prev;
      }
      return [...prev, cat];
    });
  }

  async function handleSave(applyFilterNow: boolean) {
    setSavingPrefs(true);
    try {
      await onSavePreferences(
        {
          ...preferences,
          favoriteCategories: selectedCats,
          maxBudgetCop: budget,
          updatedAt: Date.now(),
        },
        applyFilterNow,
      );
      toast.success(applyFilterNow ? '✨ ¡Preferencias guardadas y Radar personalizado!' : '✨ Preferencias guardadas');
      if (applyFilterNow) onClose();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSavingPrefs(false);
    }
  }

  async function handlePreparePasskey() {
    setPasskeyBusy(true);
    try {
      const p = await verifyPasswordAndPreparePasskey(pwdInput);
      setPrepared(p);
      setPwdInput('');
      toast.info('Contraseña validada. Ahora toca "Vincular huella ahora" para activar tu sensor.');
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setPasskeyBusy(false);
    }
  }

  async function handleCompletePasskey() {
    if (!prepared) return;
    setPasskeyBusy(true);
    try {
      await completePreparedPasskeyEnrollment(prepared);
      setPrepared(null);
      setShowPwdForm(false);
      setPasskeys(await listMyPasskeys());
      toast.success(PASSKEY_LINKED_SUCCESS_MSG);
    } catch (err) {
      const msg = err instanceof Error && err.message === 'GESTURE_OR_CANCELLED' ? WEBAUTHN_CANCELLED_MSG : friendlyError(err);
      toast.info(msg);
    } finally {
      setPasskeyBusy(false);
    }
  }

  async function handleRevoke(pk: PasskeyDevice) {
    try {
      await revokePasskey(pk.id, pk.credential_id);
      setPasskeys((prev) => prev.filter((x) => x.id !== pk.id));
      toast.info('Llave biométrica eliminada de este equipo.');
    } catch (err) {
      toast.error(friendlyError(err));
    }
  }

  async function handleUpgradeToMerchant() {
    if (bizName.trim().length < 2) {
      toast.error('Escribe el nombre oficial de tu negocio.');
      return;
    }
    if (bizWa.replace(/\D/g, '').length < 10) {
      toast.error('Escribe el número WhatsApp del negocio (10 dígitos).');
      return;
    }
    setUpgrading(true);
    try {
      const nextProfile = await upgradeClientToMerchant({
        businessName: bizName.trim(),
        category: bizCat,
        whatsapp: bizWa.replace(/\D/g, ''),
        municipality: bizMuni,
      });
      toast.success('🏪 ¡Bienvenido como Comercio! Recibiste 3 créditos gratis para publicar tus ofertas.');
      onUpgradedToMerchant(nextProfile);
      onClose();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setUpgrading(false);
    }
  }

  return (
    <ModalShell open={open} onClose={onClose} escClose closeLabel="Cerrar perfil de comprador" panelClassName="max-w-lg">
      <div className="p-5 pt-5">
        {/* Cabecera identidad de Comprador (100% distinta al panel de Comercio) */}
        <div className="flex items-start gap-3 pr-10">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-sky-400/40 bg-gradient-to-br from-sky-500/25 to-cyan-500/15 text-2xl shadow-lg">
            🛍️
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-lg font-extrabold text-white">
                {profile ? profile.business_name : 'Tu Radar Personal'}
              </h3>
              <span className="rounded-full border border-sky-400/40 bg-sky-500/15 px-2 py-0.5 text-[10px] font-extrabold text-sky-300">
                {profile ? 'Cuenta Comprador' : 'Modo Explorador'}
              </span>
            </div>
            <p className="mt-0.5 text-xs font-semibold text-slate-400">
              {savingsStats.rank.label} · {favoriteOffers.length} favorito{favoriteOffers.length === 1 ? '' : 's'} ·{' '}
              {savingsStats.savedCop > 0 ? `Has ahorrado ${formatCOP(savingsStats.savedCop)}` : 'Personaliza tus gustos'}
            </p>
          </div>
        </div>

        {/* Barra de gamificación / ahorro */}
        <div className="mt-3.5 rounded-2xl border border-sky-400/20 bg-sky-500/[0.06] p-3">
          <div className="flex items-center justify-between text-[11px] font-bold">
            <span className="text-sky-200">{savingsStats.rank.label}</span>
            <span className="text-slate-400">
              {savingsStats.totalOrders}/{savingsStats.rank.next} apartados
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-400 to-impulso-emerald transition-all duration-500"
              style={{ width: `${Math.max(10, savingsStats.rank.pct)}%` }}
            />
          </div>
        </div>

        {/* Pestañas internas */}
        <div className="mt-3.5 grid grid-cols-3 gap-1 rounded-2xl bg-slate-950/60 p-1">
          {(
            [
              { id: 'prefs', label: 'Preferencias', icon: SlidersHorizontal },
              { id: 'favorites', label: `Favoritos (${favoriteOffers.length})`, icon: Heart },
              { id: 'account', label: 'Mi Cuenta', icon: ShieldCheck },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={cx(
                  'pressable flex items-center justify-center gap-1.5 rounded-xl py-2 text-[11px] font-extrabold transition',
                  activeTab === t.id ? 'bg-sky-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="truncate">{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── TAB 1: PREFERENCIAS DE RADAR ── */}
        {activeTab === 'prefs' && (
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-xs font-extrabold text-white">✨ ¿Qué te gusta encontrar primero? (hasta 5)</p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Al tocar el filtro &laquo;✨ Para ti&raquo; en el radar, verás al instante solo lo que encaja contigo.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {CATEGORIES.map((c) => {
                  const picked = selectedCats.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCategory(c.id)}
                      className={cx(
                        'pressable rounded-full border px-3 py-1.5 text-xs font-bold transition',
                        picked
                          ? 'border-sky-400/60 bg-sky-500/20 text-sky-200'
                          : 'border-white/10 bg-slate-950/50 text-slate-400 hover:border-white/20 hover:text-white',
                      )}
                    >
                      {c.emoji} {c.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-xs font-extrabold text-white">💰 Presupuesto habitual</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {BUDGET_PRESETS.map((p) => {
                  const active = budget === p.value;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setBudget(p.value)}
                      className={cx(
                        'pressable rounded-xl border px-3 py-2 text-xs font-bold transition',
                        active
                          ? 'border-impulso-emerald/60 bg-impulso-emerald/15 text-impulso-mint'
                          : 'border-white/10 bg-slate-950/50 text-slate-400 hover:text-white',
                      )}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void handleSave(true)}
                disabled={savingPrefs}
                className="pressable flex items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-sky-500 to-impulso-emerald py-3 text-xs font-extrabold text-slate-950 shadow-glow disabled:opacity-60"
              >
                {savingPrefs ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Guardar y ver &laquo;Para ti&raquo;
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedCats([]);
                  setBudget(null);
                }}
                className="pressable rounded-2xl border border-white/10 bg-slate-950/50 py-3 text-xs font-bold text-slate-300 hover:text-white"
              >
                Limpiar selección
              </button>
            </div>
          </div>
        )}

        {/* ── TAB 2: FAVORITOS GUARDADOS ❤️ ── */}
        {activeTab === 'favorites' && (
          <div className="mt-4 space-y-2.5">
            {favoriteOffers.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-6 text-center">
                <p className="text-3xl">❤️</p>
                <p className="mt-2 text-sm font-extrabold text-white">Aún no guardas favoritos</p>
                <p className="mt-1 text-xs text-slate-400">
                  Toca el corazón en cualquier oferta del radar para tenerla a la mano aquí (máx. 20 vigentes).
                </p>
              </div>
            ) : (
              <div className="max-h-[42dvh] space-y-2 overflow-y-auto pr-1">
                {favoriteOffers.map((offer) => (
                  <article
                    key={offer.id}
                    className="rounded-2xl border border-white/10 bg-slate-950/60 p-3"
                  >
                    <div className="flex items-start gap-2.5">
                      {offer.image_thumb ? (
                        <img
                          src={offer.image_thumb}
                          alt={offer.title}
                          className="h-11 w-11 shrink-0 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-900 text-2xl">
                          {offer.emoji_icon}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-extrabold text-white">{offer.title}</p>
                        <p className="truncate text-[11px] font-semibold text-slate-400">
                          {offer.merchant?.business_name ?? 'Comercio'} ·{' '}
                          <span className="font-extrabold text-impulso-mint">{formatCOP(offer.promo_price)}</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onToggleFavorite(offer.id)}
                        title="Quitar de favoritos"
                        className="pressable grid h-8 w-8 shrink-0 place-items-center rounded-full bg-impulso-rose/15 text-impulso-rose"
                      >
                        <Heart className="h-4 w-4 fill-current" />
                      </button>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onReserveOffer(offer);
                        }}
                        className="pressable flex items-center justify-center gap-1 rounded-xl bg-impulso-emerald py-1.5 text-[11px] font-extrabold text-slate-950"
                      >
                        <TicketIcon className="h-3.5 w-3.5" /> Apartar ahora
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onFocusOfferOnMap(offer);
                        }}
                        className="pressable flex items-center justify-center gap-1 rounded-xl border border-white/15 bg-slate-900 py-1.5 text-[11px] font-bold text-slate-200"
                      >
                        <MapPin className="h-3.5 w-3.5" /> Ver en mapa
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: CUENTA, BIOMETRÍA Y SEPARACIÓN CLARA CLIENTE vs COMERCIO ── */}
        {activeTab === 'account' && (
          <div className="mt-4 space-y-3">
            {!profile ? (
              <div className="rounded-2xl border border-sky-400/25 bg-sky-500/10 p-4 text-center">
                <p className="text-sm font-extrabold text-white">Guarda tus favoritos en cualquier celular</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-300">
                  Tus preferencias ya funcionan gratis en este equipo. Si creas una cuenta gratuita de{' '}
                  <strong className="text-sky-300">Cliente / Comprador</strong>, se sincronizan en la nube sin
                  confundirse jamás con un comercio.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAuth();
                  }}
                  className="pressable mt-3 w-full rounded-2xl bg-sky-500 py-3 text-xs font-extrabold text-slate-950"
                >
                  🛍️ Crear mi cuenta de Comprador (gratis)
                </button>
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-sky-400/25 bg-sky-500/[0.07] p-3.5 text-xs text-slate-300">
                  <p className="flex items-center gap-1.5 font-extrabold text-sky-300">
                    <CheckCircle2 className="h-4 w-4" /> Cuenta exclusiva de Comprador
                  </p>
                  <p className="mt-1 leading-relaxed text-slate-400">
                    Esta cuenta es únicamente para comprar, apartar y guardar favoritos. No aparece como negocio en el
                    mapa ni puede publicar ofertas comerciales.
                  </p>
                </div>

                {/* Biometría rápida */}
                {isWebAuthnSupported() && (
                  <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-xs font-extrabold text-white">
                        <Fingerprint className="h-4 w-4 text-impulso-mint" /> Acceso con Huella / FaceID
                      </p>
                      {!showPwdForm && (
                        <button
                          type="button"
                          onClick={() => setShowPwdForm(true)}
                          className="pressable rounded-xl border border-impulso-emerald/40 bg-impulso-emerald/15 px-2.5 py-1 text-[11px] font-extrabold text-impulso-mint"
                        >
                          + Vincular
                        </button>
                      )}
                    </div>
                    {passkeys.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {passkeys.map((pk) => (
                          <div
                            key={pk.id}
                            className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-[11px]"
                          >
                            <span className="truncate font-semibold text-slate-200">{pk.device_label}</span>
                            <button
                              type="button"
                              onClick={() => void handleRevoke(pk)}
                              className="text-slate-400 hover:text-impulso-rose"
                              title="Revocar llave"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {showPwdForm && (
                      <div className="mt-2.5 space-y-2">
                        {!prepared ? (
                          <>
                            <input
                              type="password"
                              value={pwdInput}
                              onChange={(e) => setPwdInput(e.target.value)}
                              placeholder="Confirma tu contraseña actual"
                              className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-impulso-emerald/60"
                            />
                            <button
                              type="button"
                              onClick={() => void handlePreparePasskey()}
                              disabled={passkeyBusy || pwdInput.length < 6}
                              className="pressable w-full rounded-xl bg-impulso-emerald py-2 text-xs font-extrabold text-slate-950 disabled:opacity-50"
                            >
                              {passkeyBusy ? 'Validando…' : '1. Validar contraseña'}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleCompletePasskey()}
                            disabled={passkeyBusy}
                            className="pressable w-full rounded-xl bg-gradient-to-r from-impulso-emerald to-teal-500 py-2.5 text-xs font-extrabold text-slate-950 disabled:opacity-50"
                          >
                            {passkeyBusy ? 'Activando sensor…' : '2. Vincular huella / FaceID ahora'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Conversión explícita a Comercio si el usuario abre un negocio real */}
                <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3.5">
                  {!showUpgradeForm ? (
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-white">¿Tienes un negocio y quieres vender?</p>
                        <p className="text-[11px] text-slate-400">
                          Convierte tu cuenta a Comercio y recibe 3 créditos gratis.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowUpgradeForm(true)}
                        className="pressable shrink-0 rounded-xl border border-impulso-emerald/40 bg-impulso-emerald/10 px-3 py-2 text-[11px] font-extrabold text-impulso-mint"
                      >
                        <Store className="mr-1 inline h-3.5 w-3.5" /> Activar Comercio
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs font-extrabold text-impulso-mint">🏪 Activar perfil de Comercio</p>
                      <input
                        value={bizName}
                        onChange={(e) => setBizName(e.target.value)}
                        placeholder="Nombre de tu negocio *"
                        maxLength={80}
                        className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-xs text-white outline-none focus:border-impulso-emerald/60"
                      />
                      <input
                        value={bizWa}
                        onChange={(e) => setBizWa(e.target.value.replace(/\D/g, ''))}
                        placeholder="WhatsApp comercial * (10 dígitos)"
                        maxLength={15}
                        className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-xs text-white outline-none focus:border-impulso-emerald/60"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={bizCat}
                          onChange={(e) => setBizCat(e.target.value as Category)}
                          className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white outline-none"
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.emoji} {c.label}
                            </option>
                          ))}
                        </select>
                        <select
                          value={bizMuni}
                          onChange={(e) => setBizMuni(e.target.value)}
                          className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white outline-none"
                        >
                          {MUNICIPIOS.map((m) => (
                            <option key={m.name} value={m.name}>
                              📍 {m.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => void handleUpgradeToMerchant()}
                          disabled={upgrading}
                          className="pressable rounded-xl bg-impulso-emerald py-2.5 text-xs font-extrabold text-slate-950 disabled:opacity-50"
                        >
                          {upgrading ? 'Activando…' : 'Confirmar Comercio'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowUpgradeForm(false)}
                          className="pressable rounded-xl border border-white/10 py-2.5 text-xs font-bold text-slate-400"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    void onSignOut();
                  }}
                  className="pressable flex w-full items-center justify-center gap-2 rounded-2xl border border-impulso-rose/35 bg-impulso-rose/10 py-2.5 text-xs font-extrabold text-impulso-rose"
                >
                  <LogOut className="h-4 w-4" /> Cerrar sesión
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </ModalShell>
  );
}
