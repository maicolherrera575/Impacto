import { useEffect, useRef, useState } from 'react';
import { Fingerprint, Info, Loader2, LogIn, ShoppingBag, Store, UserPlus, X } from 'lucide-react';
import type { Category } from '../../types';
import { CATEGORIES, MUNICIPIOS } from '../../types';
import { ModalShell } from '../ui/ModalShell';
import { ImpulsoLogo } from '../ui/ImpulsoLogo';
import { useToast } from '../ui/Toast';
import { friendlyError, supabase } from '../../services/supabase';
import {
  ensureSignedInAfterSignUp,
  signIn,
  signOut,
  signUpClient,
  signUpMerchant,
  validateInviteCode,
} from '../../services/profile.service';
import {
  authenticateWithPasskey,
  isWebAuthnSupported,
  syncPasskeyVaultsOnPasswordLogin,
} from '../../services/WebAuthnService';
import { cx } from '../../utils/format';

const PASSWORD_FALLBACK_INFO_MSG =
  'Inicia sesión una vez con tu contraseña en este equipo y tu huella quedará sincronizada automáticamente.';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  /** V37.0 · Recibe el tipo de cuenta para enrutar Clientes al Radar y Comercios a su Panel. */
  onAuthed: (hintRole?: 'client' | 'merchant') => void;
  /** Abre el modal completo de Términos / Ley 1581 de 2012. */
  onOpenLegal: () => void;
}

/**
 * Acceso unificado V37.0 con separación absoluta Cliente vs Comercio:
 *  - Al iniciar sesión: correo + contraseña o huella/FaceID (con guardia anti-banner contradictorio).
 *  - Al registrarse: elección clara entre Cuenta de Comprador (gratis, favoritos/preferencias, no publica)
 *    y Cuenta de Comercio (3 créditos gratis, IA, estudio publicitario).
 */
export function AuthModal({ open, onClose, onAuthed, onOpenLegal }: AuthModalProps) {
  const toast = useToast();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [accountType, setAccountType] = useState<'client' | 'merchant'>('client');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [category, setCategory] = useState<Category>('comida');
  const [municipality, setMunicipality] = useState('Gachetá');
  const [inviteCode, setInviteCode] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const passwordInputRef = useRef<HTMLInputElement | null>(null);
  const authInFlightRef = useRef(false);
  const emailOk = /.+@.+\..+/.test(email.trim());
  const passOk = password.length >= 6;
  const passkeyAvailable = isWebAuthnSupported();

  // Limpia cualquier aviso o error viejo al abrir/cerrar el modal
  useEffect(() => {
    if (open) {
      setErrorMsg('');
      setInfoMsg('');
      authInFlightRef.current = false;
    }
  }, [open]);

  async function passkeyLogin() {
    if (authInFlightRef.current || loading) return;
    authInFlightRef.current = true;
    setErrorMsg('');
    setInfoMsg('');
    setLoading(true);
    try {
      await authenticateWithPasskey(emailOk ? email.trim() : undefined);
      setErrorMsg('');
      setInfoMsg('');
      toast.success('🔐 ¡Identidad biométrica verificada! Bienvenido 👋');
      onAuthed();
      onClose();
    } catch (err) {
      // 🛡️ V37.0 Fix Banner Biométrico: si la sesión YA quedó establecida (ej. race cross-device/caBLE),
      // jamás mostrar un error contradictorio pidiendo reiniciar en otro dispositivo.
      const { data } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
      if (data.session?.user) {
        setErrorMsg('');
        setInfoMsg('');
        onAuthed();
        onClose();
        return;
      }

      const raw = err instanceof Error ? err.message : friendlyError(err);
      const cleanMsg =
        raw && !/JSON|fetch|rpc|status\s+\d{3}|reinicia el proceso/i.test(raw)
          ? raw
          : PASSWORD_FALLBACK_INFO_MSG;
      setInfoMsg(cleanMsg);
      window.setTimeout(() => passwordInputRef.current?.focus(), 40);
    } finally {
      authInFlightRef.current = false;
      setLoading(false);
    }
  }

  async function submit() {
    if (authInFlightRef.current || loading) return;
    setErrorMsg('');
    setInfoMsg('');
    if (!emailOk) {
      setErrorMsg('Escribe un correo válido');
      return;
    }
    if (!passOk) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    authInFlightRef.current = true;
    setLoading(true);
    try {
      if (mode === 'login') {
        await signIn(email.trim(), password);
        void syncPasskeyVaultsOnPasswordLogin(email.trim(), password);
        setErrorMsg('');
        setInfoMsg('');
        toast.success('¡Bienvenido de vuelta! 👋');
        onAuthed();
        onClose();
        return;
      }

      // ── Registro diferenciado: Cliente / Comprador vs Comercio / Negocio ──
      if (!acceptedTerms) {
        setErrorMsg('Debes aceptar los términos y la política de datos (Ley 1581) para continuar');
        return;
      }

      if (accountType === 'client') {
        if (fullName.trim().length < 2) {
          setErrorMsg('Escribe tu nombre o apodo (mínimo 2 letras)');
          return;
        }
        const cleanWa = whatsapp.replace(/\D/g, '');
        if (cleanWa.length > 0 && (cleanWa.length < 10 || cleanWa.length > 15)) {
          setErrorMsg('Si agregas tu WhatsApp, debe tener entre 10 y 15 dígitos');
          return;
        }
        const hasSession = await signUpClient({
          email: email.trim(),
          password,
          fullName: fullName.trim(),
          whatsapp: cleanWa || undefined,
          municipality,
          favoriteCategory: category,
        });
        if (hasSession) {
          toast.success('🛍️ ¡Perfil de Comprador creado! Ya puedes guardar favoritos y personalizar tu Radar.');
          onAuthed('client');
          onClose();
        } else {
          const entered = await ensureSignedInAfterSignUp(email.trim(), password);
          if (entered) {
            toast.success('🛍️ ¡Perfil de Comprador listo! Disfruta Impulso.');
            onAuthed('client');
            onClose();
          } else {
            setErrorMsg('Tu cuenta quedó creada. Inicia sesión con tu correo y contraseña.');
            setMode('login');
          }
        }
        return;
      }

      // ── Registro de Comercio ──
      if (businessName.trim().length < 2) {
        setErrorMsg('Escribe el nombre de tu negocio');
        return;
      }
      if (whatsapp.trim().length < 10 || whatsapp.trim().length > 15) {
        setErrorMsg('El WhatsApp comercial debe tener entre 10 y 15 dígitos');
        return;
      }
      if (inviteCode.trim().length > 0) {
        const valid = await validateInviteCode(inviteCode);
        if (!valid) {
          setErrorMsg('Código de invitación inválido. Verifícalo con el administrador 🛡️');
          return;
        }
      }

      const hasSession = await signUpMerchant({
        email: email.trim(),
        password,
        businessName: businessName.trim(),
        category,
        whatsapp: whatsapp.trim(),
        municipality,
      });
      if (hasSession) {
        toast.success('🏪 ¡Cuenta comercial creada! Tienes 3 créditos gratis 🎁');
        onAuthed('merchant');
        onClose();
      } else {
        const entered = await ensureSignedInAfterSignUp(email.trim(), password);
        if (entered) {
          toast.success('🏪 ¡Cuenta comercial creada y verificada! Tienes 3 créditos gratis 🎁');
          onAuthed('merchant');
          onClose();
        } else {
          setErrorMsg('La cuenta quedó creada. Inicia sesión con tu correo y contraseña.');
          setMode('login');
        }
      }
    } catch (err) {
      setErrorMsg(friendlyError(err));
    } finally {
      authInFlightRef.current = false;
      setLoading(false);
    }
  }

  return (
    <ModalShell open={open} onClose={onClose}>
      <div className="p-5 pt-12">
        <div className="mb-3">
          <ImpulsoLogo size="sm" />
        </div>
        <h3 className="text-xl font-extrabold text-white">
          {mode === 'login' ? 'Ingresar a Impulso' : accountType === 'client' ? '🛍️ Crear Perfil de Comprador' : '🏪 Registrar mi Comercio'}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          {mode === 'login'
            ? 'Accede a tu cuenta de Comprador o a tu Panel de Comercio.'
            : accountType === 'client'
              ? 'Guarda tus favoritos, filtra por tus gustos y controla tu ahorro. Esta cuenta nunca aparece como negocio.'
              : 'Publica ofertas relámpago con IA y recibe 3 créditos gratis de bienvenida.'}
        </p>

        {/* Cambio de modo: Iniciar sesión / Crear cuenta */}
        <div className="mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-slate-950/50 p-1">
          {(['login', 'signup'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setErrorMsg('');
                setInfoMsg('');
              }}
              className={cx(
                'pressable rounded-xl py-2.5 text-sm font-bold transition',
                mode === m ? 'bg-impulso-emerald text-white' : 'text-slate-400',
              )}
            >
              {m === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
            </button>
          ))}
        </div>

        {/* Selector explícito de rol al registrarse (cero confusión Cliente vs Comercio) */}
        {mode === 'signup' && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setAccountType('client');
                setErrorMsg('');
              }}
              className={cx(
                'pressable flex flex-col items-start rounded-2xl border p-3 text-left transition',
                accountType === 'client'
                  ? 'border-sky-400/70 bg-sky-500/15 ring-1 ring-sky-400/30'
                  : 'border-white/10 bg-slate-950/40 hover:border-white/20',
              )}
            >
              <span className="flex items-center gap-1.5 text-xs font-extrabold text-white">
                <ShoppingBag className="h-4 w-4 text-sky-400" /> Soy Cliente
              </span>
              <span className="mt-1 text-[10px] font-semibold leading-snug text-slate-400">
                Favoritos, gustos y ahorro · Gratis (no vende)
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAccountType('merchant');
                setErrorMsg('');
              }}
              className={cx(
                'pressable flex flex-col items-start rounded-2xl border p-3 text-left transition',
                accountType === 'merchant'
                  ? 'border-impulso-emerald/70 bg-impulso-emerald/15 ring-1 ring-impulso-emerald/30'
                  : 'border-white/10 bg-slate-950/40 hover:border-white/20',
              )}
            >
              <span className="flex items-center gap-1.5 text-xs font-extrabold text-white">
                <Store className="h-4 w-4 text-impulso-mint" /> Soy Comercio
              </span>
              <span className="mt-1 text-[10px] font-semibold leading-snug text-slate-400">
                Publica ofertas + IA · 3 créditos gratis
              </span>
            </button>
          </div>
        )}

        <div className="mt-4 space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Correo electrónico"
            autoComplete="email"
            className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3.5 text-[15px] font-medium text-white placeholder:text-slate-600 outline-none focus:border-impulso-emerald/60"
          />
          <input
            ref={passwordInputRef}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña (mínimo 6 caracteres)"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            className={cx(
              'w-full rounded-2xl border bg-slate-950/50 px-4 py-3.5 text-[15px] font-medium text-white placeholder:text-slate-600 outline-none transition',
              infoMsg ? 'border-sky-400/70 ring-2 ring-sky-400/20' : 'border-white/10 focus:border-impulso-emerald/60',
            )}
          />

          {mode === 'signup' && accountType === 'client' && (
            <>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Tu nombre * (ej: Laura Gómez)"
                maxLength={60}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3.5 text-[15px] font-medium text-white placeholder:text-slate-600 outline-none focus:border-sky-400/60"
              />
              <input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, ''))}
                placeholder="Tu WhatsApp (opcional · agiliza apartados)"
                inputMode="tel"
                maxLength={15}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3.5 text-[15px] font-medium text-white placeholder:text-slate-600 outline-none focus:border-sky-400/60"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Category)}
                  aria-label="Categoría favorita"
                  className="rounded-2xl border border-white/10 bg-slate-950/50 px-3.5 py-3.5 text-sm font-medium text-white outline-none focus:border-sky-400/60"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.emoji} {c.label}
                    </option>
                  ))}
                </select>
                <select
                  value={municipality}
                  onChange={(e) => setMunicipality(e.target.value)}
                  aria-label="Tu municipio"
                  className="rounded-2xl border border-white/10 bg-slate-950/50 px-3.5 py-3.5 text-sm font-medium text-white outline-none focus:border-sky-400/60"
                >
                  {MUNICIPIOS.map((m) => (
                    <option key={m.name} value={m.name}>
                      📍 {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {mode === 'signup' && accountType === 'merchant' && (
            <>
              <input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Nombre de tu negocio * (ej: Panadería La Espiga)"
                maxLength={80}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3.5 text-[15px] font-medium text-white placeholder:text-slate-600 outline-none focus:border-impulso-emerald/60"
              />
              <input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, ''))}
                placeholder="WhatsApp del negocio * (ej: 3201234567)"
                inputMode="tel"
                maxLength={15}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3.5 text-[15px] font-medium text-white placeholder:text-slate-600 outline-none focus:border-impulso-emerald/60"
              />
              <input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="Código de invitación (opcional)"
                maxLength={40}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3.5 text-[15px] font-medium text-white placeholder:text-slate-600 outline-none focus:border-impulso-emerald/60"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Category)}
                  aria-label="Categoría del negocio"
                  className="rounded-2xl border border-white/10 bg-slate-950/50 px-3.5 py-3.5 text-sm font-medium text-white outline-none focus:border-impulso-emerald/60"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.emoji} {c.label}
                    </option>
                  ))}
                </select>
                <select
                  value={municipality}
                  onChange={(e) => setMunicipality(e.target.value)}
                  aria-label="Municipio"
                  className="rounded-2xl border border-white/10 bg-slate-950/50 px-3.5 py-3.5 text-sm font-medium text-white outline-none focus:border-impulso-emerald/60"
                >
                  {MUNICIPIOS.map((m) => (
                    <option key={m.name} value={m.name}>
                      📍 {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {mode === 'signup' && (
            <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-3.5">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#10B981]"
              />
              <span className="text-xs leading-relaxed text-slate-400">
                Acepto los{' '}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onOpenLegal();
                  }}
                  className="font-bold text-impulso-mint underline underline-offset-2 hover:brightness-110"
                >
                  términos, Ley 1480 y política de datos (Ley 1581 de 2012)
                </button>{' '}
                de Impulso.
              </span>
            </label>
          )}

          {infoMsg && (
            <div className="flex items-start gap-2 rounded-xl border border-sky-400/35 bg-sky-500/10 p-3 text-sky-200" role="status">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
              <p className="text-xs font-semibold leading-relaxed">{infoMsg}</p>
            </div>
          )}

          {errorMsg && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/15 p-3 text-red-200" role="alert">
              <X className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="text-xs font-semibold leading-relaxed">{errorMsg}</p>
            </div>
          )}

          <button
            type="button"
            onClick={() => void submit()}
            disabled={loading}
            className={cx(
              'pressable flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-extrabold text-white shadow-glow disabled:opacity-60',
              mode === 'signup' && accountType === 'client'
                ? 'bg-gradient-to-r from-sky-500 to-cyan-600'
                : 'bg-gradient-to-r from-impulso-emerald to-teal-600',
            )}
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : mode === 'login' ? (
              <>
                <LogIn className="h-5 w-5" /> Ingresar con Contraseña
              </>
            ) : accountType === 'client' ? (
              <>
                <ShoppingBag className="h-5 w-5" /> Crear mi cuenta de Comprador
              </>
            ) : (
              <>
                <UserPlus className="h-5 w-5" /> Crear cuenta de Comercio
              </>
            )}
          </button>

          {mode === 'login' && passkeyAvailable && (
            <button
              type="button"
              onClick={() => void passkeyLogin()}
              disabled={loading}
              className="pressable flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-transparent py-2.5 text-xs font-semibold text-slate-300 transition hover:border-white/30 hover:bg-white/[0.04] hover:text-white disabled:opacity-60"
            >
              <Fingerprint className="h-4 w-4 text-impulso-mint/85" />
              Entrar con huella / FaceID
            </button>
          )}

          <p className="text-center text-[11px] font-medium text-slate-500">
            🛍️ También puedes apartar ofertas sin crear cuenta cerrando esta ventana.
          </p>
        </div>
      </div>
    </ModalShell>
  );
}

export { signOut };
