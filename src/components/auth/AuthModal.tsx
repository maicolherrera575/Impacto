import { useRef, useState } from 'react';
import { Fingerprint, Info, Loader2, LogIn, UserPlus, X } from 'lucide-react';
import type { Category } from '../../types';
import { CATEGORIES, MUNICIPIOS } from '../../types';
import { ModalShell } from '../ui/ModalShell';
import { ImpulsoLogo } from '../ui/ImpulsoLogo';
import { useToast } from '../ui/Toast';
import { friendlyError } from '../../services/supabase';
import { ensureSignedInAfterSignUp, signIn, signOut, signUpMerchant, validateInviteCode } from '../../services/profile.service';
import {
  authenticateWithPasskey,
  isWebAuthnSupported,
} from '../../services/WebAuthnService';
import { cx } from '../../utils/format';

const PASSWORD_FALLBACK_INFO_MSG =
  'Para mayor seguridad, inicia sesión con tu contraseña en este equipo nuevo. Luego podrás vincular tu huella desde el panel.';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onAuthed: () => void;
  /** Abre el modal completo de Términos / Ley 1581 de 2012. */
  onOpenLegal: () => void;
}

/**
 * Acceso de comerciantes y administrador (Supabase Auth email + contraseña).
 * El perfil se crea automáticamente vía trigger en la base de datos.
 */
export function AuthModal({ open, onClose, onAuthed, onOpenLegal }: AuthModalProps) {
  const toast = useToast();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [category, setCategory] = useState<Category>('comida');
  const [municipality, setMunicipality] = useState('Gachetá');
  const [inviteCode, setInviteCode] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  /** ⚠️ V18 · Errores de formulario DENTRO del modal. */
  const [errorMsg, setErrorMsg] = useState('');
  /** ℹ️ V27 · Aviso azul amigable cuando no hay passkey local (nunca error rojo restrictivo). */
  const [infoMsg, setInfoMsg] = useState('');
  const passwordInputRef = useRef<HTMLInputElement | null>(null);
  const emailOk = /.+@.+\..+/.test(email.trim());
  const passOk = password.length >= 6;

  /** 🔐 V19.0 · Autenticación biométrica real (WebAuthn / Passkeys). */
  const passkeyAvailable = isWebAuthnSupported();

  async function passkeyLogin() {
    setErrorMsg('');
    setInfoMsg('');
    if (!emailOk) {
      setErrorMsg('Escribe tu correo para validar tu huella / FaceID');
      return;
    }
    setLoading(true);
    try {
      await authenticateWithPasskey(email.trim());
      toast.success('🔐 ¡Identidad biométrica verificada! Bienvenido 👋');
      onAuthed();
      onClose();
    } catch {
      // V27 Anti-frustración: ante cualquier fallo o falta de llave local/roaming,
      // mostramos toast informativo azul y devolvemos el foco al ingreso con contraseña.
      toast.info(PASSWORD_FALLBACK_INFO_MSG);
      setInfoMsg(PASSWORD_FALLBACK_INFO_MSG);
      window.setTimeout(() => passwordInputRef.current?.focus(), 40);
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
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

    setLoading(true);
    try {
      if (mode === 'login') {
        await signIn(email.trim(), password);
        toast.success('¡Bienvenido de vuelta! 👋');
        onAuthed();
        onClose();
      } else {
        if (businessName.trim().length < 2) {
          setErrorMsg('Escribe el nombre de tu negocio');
          setLoading(false);
          return;
        }
        if (whatsapp.trim().length < 10 || whatsapp.trim().length > 15) {
          setErrorMsg('El WhatsApp debe tener entre 10 y 15 dígitos');
          setLoading(false);
          return;
        }
        if (!acceptedTerms) {
          setErrorMsg('Debes aceptar los términos para continuar');
          setLoading(false);
          return;
        }
        // El código de invitación es OPCIONAL: solo se valida si el
        // administrador activó el modo "solo invitados" en la plataforma.
        if (inviteCode.trim().length > 0) {
          try {
            const valid = await validateInviteCode(inviteCode);
            if (!valid) {
              setErrorMsg('Código de invitación inválido. Verifícalo con el administrador 🛡️');
              setLoading(false);
              return;
            }
          } catch (err) {
            setErrorMsg(friendlyError(err));
            setLoading(false);
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
          toast.success('¡Cuenta creada! Tienes 3 créditos gratis 🎁');
          onAuthed();
          onClose();
        } else {
          // V18: auto-entrada inmediata con las mismas credenciales (la
          // cuenta ya queda auto-confirmada por el trigger del servidor).
          const entered = await ensureSignedInAfterSignUp(email.trim(), password);
          if (entered) {
            toast.success('¡Cuenta creada y verificada! Tienes 3 créditos gratis 🎁');
            onAuthed();
            onClose();
          } else {
            setErrorMsg('La cuenta quedó creada, pero no se pudo entrar automático. Entra con tu correo y contraseña.');
            setMode('login');
          }
        }
      }
    } catch (err) {
      setErrorMsg(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalShell open={open} onClose={onClose}>
      <div className="p-5 pt-12">
        <div className="mb-3">
          <ImpulsoLogo size="sm" />
        </div>
        <h3 className="text-xl font-extrabold text-white">🏪 Acceso para Comercios y Servicios</h3>
        <p className="mt-1 text-sm text-slate-400">
          Registro exclusivo para comercios, productores y transportadores locales.
        </p>
        {mode === 'signup' && (
          <p className="mt-1 text-sm text-slate-400">Empieza con 3 créditos gratis para publicar tus primeras ofertas.</p>
        )}
        <p className="mt-3 flex items-start gap-2 rounded-2xl border border-impulso-emerald/25 bg-impulso-emerald/5 p-3 text-xs font-semibold leading-relaxed text-impulso-mint">
          <span className="text-base leading-none">🛍️</span>
          <span>¿Vienes a comprar o apartar una oferta? ¡No necesitas crear cuenta! Cierra esta ventana y aparta directo en cualquier tarjeta.</span>
        </p>

        {/* Cambio de modo */}
        <div className="mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-slate-950/50 p-1">
          {(['login', 'signup'] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setErrorMsg('');
                setInfoMsg('');
              }}
              className={cx(
                'pressable rounded-xl py-2.5 text-sm font-bold transition',
                mode === m ? 'bg-impulso-emerald text-white' : 'text-slate-400'
              )}
            >
              {m === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
            </button>
          ))}
        </div>

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

          {mode === 'signup' && (
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
                placeholder="Código de invitación (opcional · solo si el administrador lo exige)"
                maxLength={40}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3.5 text-[15px] font-medium text-white placeholder:text-slate-600 outline-none focus:border-impulso-emerald/60"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Category)}
                  aria-label="Categoría del negocio"
                  className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3.5 text-sm font-medium text-white outline-none focus:border-impulso-emerald/60"
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
                  className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3.5 text-sm font-medium text-white outline-none focus:border-impulso-emerald/60"
                >
                  {MUNICIPIOS.map((m) => (
                    <option key={m.name} value={m.name}>
                      📍 {m.name}
                    </option>
                  ))}
                </select>
              </div>
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
                    términos y la política de datos (Ley 1581 de 2012)
                  </button>{' '}
                  de Impulso — tócalos para leerlos completos.
                </span>
              </label>
            </>
          )}

          {/* ℹ️ V27 · Aviso informativo sutil (azul/info) para flujo anti-frustración */}
          {infoMsg && (
            <div className="flex items-start gap-2 rounded-xl border border-sky-400/35 bg-sky-500/10 p-3 text-sky-200" role="status">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
              <p className="text-xs font-semibold leading-relaxed">{infoMsg}</p>
            </div>
          )}

          {/* ⚠️ V18 · Error de validación de formulario DENTRO del modal */}
          {errorMsg && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/15 p-3 text-red-200" role="alert">
              <X className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="text-xs font-semibold leading-relaxed">{errorMsg}</p>
            </div>
          )}

          <button
            onClick={submit}
            disabled={loading}
            className="pressable flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-impulso-emerald to-teal-600 py-3.5 text-sm font-extrabold text-white shadow-glow disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : mode === 'login' ? (
              <>
                <LogIn className="h-5 w-5" /> Ingresar con Contraseña
              </>
            ) : (
              <>
                <UserPlus className="h-5 w-5" /> Crear mi cuenta
              </>
            )}
          </button>

          {/* 🫆 V27 · Opción secundaria tipo outline debajo del acceso principal por contraseña */}
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
        </div>
      </div>
    </ModalShell>
  );
}

export { signOut };
