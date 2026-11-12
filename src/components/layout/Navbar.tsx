import { LogOut, MapPin, Radar, ShieldCheck, Store, Zap } from 'lucide-react';
import { MUNICIPIOS, categoryMeta } from '../../types';
import type { Profile } from '../../types';
import type { GeoStatus } from '../../utils/geo';
import { cx } from '../../utils/format';

interface NavbarProps {
  municipality: string;
  onMunicipality: (name: string) => void;
  geoStatus: GeoStatus;
  onGeoRequest: () => void;
  profile: Profile | null;
  onOpenAuth: () => void;
  onOpenDashboard: () => void;
  onOpenAdmin: () => void;
  onSignOut: () => void;
}

/**
 * Identidad de Impulso: logo editorial, selector de municipio, GPS con
 * triple estado (auto-GPS al entrar; si se niega, nunca se bloquea),
 * píldora de identidad con sesión activa y acceso a comerciantes / admin.
 */
export function Navbar({
  municipality,
  onMunicipality,
  geoStatus,
  onGeoRequest,
  profile,
  onOpenAuth,
  onOpenDashboard,
  onOpenAdmin,
  onSignOut,
}: NavbarProps) {
  const isAdmin = profile?.role === 'admin';

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-white/5 bg-impulso-night/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-4xl items-center gap-2 px-3">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-impulso-emerald to-teal-700 shadow-glow">
            <Zap className="h-5 w-5 text-white" fill="currentColor" />
          </div>
          <div className="hidden leading-tight sm:block">
            <p className="text-[17px] font-extrabold tracking-tight text-white">
              Impulso<span className="text-brand-gradient">.</span>
            </p>
            <p className="hidden text-[10px] font-medium text-slate-400 md:block">
              Radar de ofertas y comercios en vivo
            </p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {/* Selector de municipio */}
          <label className="relative">
            <MapPin className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-impulso-mint" />
            <select
              value={municipality}
              onChange={(e) => onMunicipality(e.target.value)}
              aria-label="Municipio"
              className="w-[118px] appearance-none rounded-full border border-white/10 bg-impulso-panel py-1.5 pl-8 pr-2 text-xs font-semibold text-slate-200 outline-none transition focus:border-impulso-emerald/50"
            >
              {MUNICIPIOS.map((m) => (
                <option key={m.name} value={m.name} className="bg-impulso-panel">
                  {m.name}
                </option>
              ))}
            </select>
          </label>

          {/* GPS inteligente: se activa solo al entrar; si se niega, el radar sigue en Gachetá */}
          <button
            onClick={onGeoRequest}
            title={
              geoStatus === 'active'
                ? 'Punto azul activo: ofertas ordenadas por cercanía real en vivo'
                : geoStatus === 'inexact'
                  ? 'Tu señal llegó APROXIMADA y no la usamos para no equivocarnos. Toca el candado 🔒 de la barra del navegador, elige "Ubicación exacta" y dale a Permitir'
                  : geoStatus === 'denied'
                    ? 'Ubicación no disponible: el radar se centra en Gachetá. Toca el 🎯 del mapa para reintentar'
                    : 'Activando tu ubicación…'
            }
            className={cx(
              'pressable flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold',
              geoStatus === 'active'
                ? 'border-impulso-emerald/40 bg-impulso-emerald/10 text-impulso-mint'
                : geoStatus === 'inexact'
                  ? 'border-amber-400/40 bg-amber-400/10 text-amber-300'
                  : 'border-white/10 bg-impulso-panel text-slate-300'
            )}
          >
            <Radar
              className={cx(
                'h-3.5 w-3.5',
                (geoStatus === 'active' || geoStatus === 'inexact') && 'animate-pulse-soft'
              )}
            />
            {geoStatus === 'active'
              ? 'GPS Activo'
              : geoStatus === 'inexact'
                ? 'GPS Aprox ⚠️'
                : geoStatus === 'denied'
                  ? 'Sin GPS'
                  : 'GPS…'}
          </button>

          {/* Acceso / sesión activa */}
          {profile ? (
            <div className="flex items-center gap-1.5">
              {isAdmin && (
                <button
                  onClick={onOpenAdmin}
                  title="Panel de administrador"
                  className="pressable grid h-9 w-9 place-items-center rounded-full border border-impulso-gold/40 bg-impulso-gold/10 text-impulso-gold"
                >
                  <ShieldCheck className="h-5 w-5" />
                </button>
              )}

              {/* Píldora de identidad: quién está en sesión */}
              <button
                onClick={onOpenDashboard}
                title={`${profile.business_name} — abrir mi panel`}
                className="pressable flex min-w-0 items-center gap-2 rounded-full border border-white/10 bg-impulso-panel py-1 pl-1 pr-2.5"
              >
                {profile.logo_thumb ? (
                  <img
                    src={profile.logo_thumb}
                    alt=""
                    className="h-7 w-7 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-950/60 text-sm">
                    {categoryMeta(profile.category).emoji}
                  </span>
                )}
                <span className="hidden min-w-0 max-w-[110px] truncate text-[11px] font-bold text-white sm:block">
                  {profile.business_name}
                </span>
                <span
                  title={
                    isAdmin ? 'Administrador de la plataforma' : profile.is_verified ? 'Negocio verificado' : 'En verificación'
                  }
                  className={cx(
                    'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-extrabold',
                    isAdmin
                      ? 'bg-impulso-gold/20 text-impulso-gold'
                      : profile.is_verified
                        ? 'bg-impulso-emerald/15 text-impulso-mint'
                        : 'bg-white/10 text-slate-400'
                  )}
                >
                  {isAdmin ? '👑 Admin' : profile.is_verified ? '✅' : '⏳'}
                </span>
              </button>

              <button
                onClick={onOpenDashboard}
                className="pressable hidden items-center gap-1.5 rounded-full bg-gradient-to-r from-impulso-emerald to-teal-600 px-3 py-2 text-xs font-bold text-white shadow-glow md:flex"
              >
                <Store className="h-3.5 w-3.5" />
                Mi Panel
              </button>

              {/* Cerrar sesión, siempre visible */}
              <button
                onClick={onSignOut}
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
                className="pressable grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-impulso-panel text-slate-300 transition hover:border-impulso-rose/40 hover:text-impulso-rose"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="pressable rounded-full bg-gradient-to-r from-impulso-emerald to-teal-600 px-3.5 py-2 text-xs font-bold text-white shadow-glow"
            >
              Entrar
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
