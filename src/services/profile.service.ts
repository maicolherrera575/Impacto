import { supabase } from './supabase';
import type { Category, Profile } from '../types';

/** Perfil del usuario autenticado. */
export async function fetchMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return (data as unknown as Profile) ?? null;
}

/**
 * Auto-sanación: crea el perfil del usuario autenticado si por algún
 * motivo el trigger no lo creó (ejecución parcial del esquema).
 */
export async function ensureMyProfile(): Promise<Profile | null> {
  try {
    const { data, error } = await supabase.rpc('ensure_my_profile_rpc');
    if (error) throw error;
    return (data as unknown as Profile) ?? null;
  } catch {
    return null;
  }
}

export interface UpdateProfileInput {
  businessName?: string;
  category?: Category;
  whatsapp?: string;
  municipality?: string;
  addressReference?: string;
  lat?: number;
  lng?: number;
  /** Logo micro-WebP: '' lo borra, un dataURL lo asigna, undefined no lo toca. */
  logoThumb?: string;
  /** Nit o cédula del negocio (dato de confianza, opcional). */
  nitOrCedula?: string;
  /** Link de Facebook/Instagram/Google Maps o referencia conocida (opcional). */
  socialOrMapsLink?: string;
}

/** Actualiza el perfil propio vía RPC (créditos, rol y verificación intocables). */
export async function updateMyProfile(input: UpdateProfileInput): Promise<Profile> {
  const { data, error } = await supabase.rpc('update_my_profile_rpc', {
    p_business_name: input.businessName ?? null,
    p_category: input.category ?? null,
    p_whatsapp: input.whatsapp ?? null,
    p_municipality: input.municipality ?? null,
    p_address_reference: input.addressReference ?? null,
    p_lat: input.lat ?? null,
    p_lng: input.lng ?? null,
    p_logo_thumb: input.logoThumb !== undefined ? input.logoThumb : null,
    p_nit_or_cedula: input.nitOrCedula !== undefined ? input.nitOrCedula : null,
    p_social_or_maps_link: input.socialOrMapsLink !== undefined ? input.socialOrMapsLink : null,
  });
  if (error) throw error;
  return data as unknown as Profile;
}

export interface SignUpMerchantInput {
  email: string;
  password: string;
  businessName: string;
  category: Category;
  whatsapp: string;
  municipality: string;
}

/** Registro del comerciante: el trigger de Supabase crea su perfil automáticamente. */
export async function signUpMerchant(input: SignUpMerchantInput): Promise<boolean> {
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        business_name: input.businessName,
        category: input.category,
        whatsapp: input.whatsapp,
        municipality: input.municipality,
      },
    },
  });
  if (error) throw error;
  // Si Supabase exige confirmación de correo, la sesión llega null:
  // la app debe avisarle al usuario en lugar de quedarse en blanco.
  return Boolean(data.session);
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

/**
 * Valida el código de invitación del administrador antes de permitir
 * el registro: solo comercios previamente conocidos pueden publicar.
 */
export async function validateInviteCode(code: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('validate_invite_rpc', { p_code: code });
  if (error) throw error;
  return Boolean(data);
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
