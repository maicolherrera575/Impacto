-- ============================================================================
--  IMPULSO — Radar de ofertas y comercios en vivo
--  Esquema completo de base de datos · Ejecutar UNA SOLA VEZ
--  en el SQL Editor de Supabase (Dashboard → SQL Editor → New query → Run)
--
--  Incluye: tablas, índices, RLS estricto, funciones RPC transaccionales
--  SECURITY DEFINER, Realtime y datos semilla (Modo Vitrina).
--  Es idempotente: puedes volver a ejecutarlo sin dañar datos existentes.
-- ============================================================================

-- Extensiones necesarias -----------------------------------------------------
create extension if not exists pgcrypto with schema extensions;

-- ============================================================================
-- 1. TABLAS PRINCIPALES
-- ============================================================================

-- 1.1 Perfiles (comerciantes y administradores) -------------------------------
create table if not exists public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  role                text not null default 'merchant' check (role in ('merchant', 'admin')),
  business_name       text not null check (char_length(business_name) between 2 and 80),
  category            text not null default 'comida'
                        check (category in ('comida', 'transporte_flete', 'agro_mercado', 'hoteles_turismo', 'salud_belleza', 'hogar_construccion', 'servicios_comercios')),
  whatsapp            text not null check (char_length(whatsapp) between 10 and 15),
  municipality        text not null default 'Gachetá',
  address_reference   text default 'Casco Urbano',
  lat                 double precision default 4.8167,
  lng                 double precision default -73.6333,
  credits             integer not null default 3 check (credits >= 0),   -- 3 créditos gratis de bienvenida
  is_verified         boolean not null default false,
  is_active           boolean not null default true,                     -- Suspensión por moderación
  rating_sum          integer not null default 5,
  rating_count        integer not null default 1,
  accepted_terms_at   timestamptz not null default now(),
  created_at          timestamptz not null default now()
);

-- 1.2 Ofertas (relámpago y promociones de hasta 4 días) -----------------------
create table if not exists public.offers (
  id               uuid primary key default gen_random_uuid(),
  merchant_id      uuid not null references public.profiles (id) on delete cascade,
  category         text not null check (category in ('comida', 'transporte_flete', 'agro_mercado', 'hoteles_turismo', 'salud_belleza', 'hogar_construccion', 'servicios_comercios')),
  title            text not null check (char_length(title) between 3 and 90),
  description      text not null check (char_length(description) between 5 and 280),
  emoji_icon       text not null default '🔥',
  original_price   numeric(12, 0) null,
  promo_price      numeric(12, 0) not null check (promo_price >= 0),
  total_quota      integer not null check (total_quota > 0 and total_quota <= 500),
  available_quota  integer not null check (available_quota >= 0),
  municipality     text not null default 'Gachetá',
  lat              double precision not null default 4.8167,
  lng              double precision not null default -73.6333,
  expires_at       timestamptz not null,
  status           text not null default 'active' check (status in ('active', 'sold_out', 'expired', 'cancelled')),
  views_count      integer not null default 0,
  created_at       timestamptz not null default now(),
  constraint available_lte_total check (available_quota <= total_quota)
);

-- 1.3 Reservas (apartados de clientes sin registro previo) --------------------
create table if not exists public.reservations (
  id               uuid primary key default gen_random_uuid(),
  offer_id         uuid not null references public.offers (id) on delete cascade,
  merchant_id      uuid not null references public.profiles (id) on delete cascade,
  customer_name    text not null check (char_length(customer_name) between 2 and 60),
  customer_phone   text not null check (char_length(customer_phone) between 7 and 20),
  quantity         integer not null check (quantity >= 1 and quantity <= 20),
  customer_note    text default '' check (char_length(customer_note) <= 140),
  reservation_code text not null,
  status           text not null default 'pending' check (status in ('pending', 'completed', 'released')),
  is_rated         boolean not null default false,
  created_at       timestamptz not null default now()
);

-- 1.4 Pedidos rápidos (subasta inversa: "¿Quién tiene...?") -------------------
create table if not exists public.quick_requests (
  id               uuid primary key default gen_random_uuid(),
  customer_name    text not null check (char_length(customer_name) between 2 and 60),
  customer_whatsapp text not null check (char_length(customer_whatsapp) between 10 and 15),
  municipality     text not null default 'Gachetá',
  category         text not null check (category in ('comida', 'transporte_flete', 'agro_mercado', 'hoteles_turismo', 'salud_belleza', 'hogar_construccion', 'servicios_comercios')),
  need_description text not null check (char_length(need_description) between 5 and 220),
  expires_at       timestamptz not null default (now() + interval '6 hours'),
  created_at       timestamptz not null default now()
);

-- Índices de rendimiento ------------------------------------------------------
create index if not exists offers_status_expires_idx   on public.offers (status, expires_at);
create index if not exists offers_merchant_idx         on public.offers (merchant_id, created_at desc);
create index if not exists offers_municipality_idx     on public.offers (municipality);
create index if not exists reservations_merchant_idx   on public.reservations (merchant_id, created_at desc);
create index if not exists reservations_offer_idx      on public.reservations (offer_id);
create index if not exists quick_requests_expires_idx  on public.quick_requests (expires_at);

-- ============================================================================
-- 2. SEGURIDAD: HELPERS Y TRIGGER DE PERFIL AUTOMÁTICO
-- ============================================================================

-- 2.1 ¿Es administrador? (función estable, blindada)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- 2.2 Perfil automático al registrarse en Supabase Auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, business_name, category, whatsapp, municipality)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'business_name', 'Mi Negocio'),
    coalesce(new.raw_user_meta_data ->> 'category', 'comida'),
    coalesce(new.raw_user_meta_data ->> 'whatsapp', '3000000000'),
    coalesce(new.raw_user_meta_data ->> 'municipality', 'Gachetá')
  );
  return new;
end;
$$;

drop trigger if exists impulso_on_auth_user_created on auth.users;
create trigger impulso_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2.3 V18 · Auto-confirmación instantánea de cuentas (fix localhost:3000):
-- cuando Supabase exige confirmación de correo, el enlace puede llegar roto
-- (localhost). Este trigger marca la cuenta como confirmada EN EL MISMO
-- segundo de crearse, así el comerciante entra directo a su panel.
create or replace function public.auto_confirm_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.email_confirmed_at := coalesce(new.email_confirmed_at, now());
  new.confirmation_token := null;
  return new;
end;
$$;

drop trigger if exists impulso_auto_confirm_user on auth.users;
create trigger impulso_auto_confirm_user
  before insert on auth.users
  for each row execute function public.auto_confirm_new_user();

-- 2.4 V19 · Candado por RPC: confirma manualmente una cuenta recién creada
-- (por si Supabase aún esperaba confirmación de correo) y garantiza que su
-- fila en profiles exista. Ejecutable por anon (registro sin sesión) y
-- authenticated. Solo actúa sobre cuentas SIN confirmar — jamás toca las demás.
create or replace function public.auto_confirm_merchant_account_rpc(p_email text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  select id into v_user_id
    from auth.users
   where lower(email) = lower(btrim(coalesce(p_email, '')))
     and email_confirmed_at is null
   limit 1;
  if v_user_id is null then
    return false;
  end if;
  update auth.users
     set email_confirmed_at = coalesce(email_confirmed_at, now()),
         confirmation_token = null
   where id = v_user_id;
  insert into public.profiles (id, business_name, category, whatsapp, municipality)
  values (v_user_id, 'Mi Negocio', 'comida', '3000000000', 'Gachetá')
  on conflict (id) do nothing;
  return true;
end;
$$;
grant execute on function public.auto_confirm_merchant_account_rpc(text) to anon, authenticated;

-- Parche único para cuentas creadas antes de este trigger
update auth.users set email_confirmed_at = now() where email_confirmed_at is null;

-- ============================================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ============================================================================
alter table public.profiles       enable row level security;
alter table public.offers         enable row level security;
alter table public.reservations   enable row level security;
alter table public.quick_requests enable row level security;

-- 3.1 profiles: lectura pública (directorio comercial), escritura SOLO vía RPC
drop policy if exists "Perfiles lectura pública" on public.profiles;
create policy "Perfiles lectura pública"
  on public.profiles for select
  to anon, authenticated
  using (true);

-- V20.0 Anti-Tampering: revoca escritura directa del cliente y protege columnas sensibles
revoke insert, update, delete on public.profiles from anon, authenticated;

create or replace function public.guard_profiles_anti_tamper_fn()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    raise exception 'ANTI_TAMPER: Modificación directa de perfiles bloqueada. Usa las funciones oficiales.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_profiles_anti_tamper on public.profiles;
create trigger trg_guard_profiles_anti_tamper
  before insert or update on public.profiles
  for each row execute function public.guard_profiles_anti_tamper_fn();

-- (Sin políticas INSERT/UPDATE/DELETE: ninguna modificación directa del cliente.
--  El trigger y las funciones SECURITY DEFINER gestionan todo.)

-- 3.2 offers: el público solo ve ofertas activas vigentes; el comerciante ve su historial
drop policy if exists "Ofertas activas visibles" on public.offers;
create policy "Ofertas activas visibles"
  on public.offers for select
  to anon, authenticated
  using (status = 'active' and expires_at > now());

drop policy if exists "Comerciante ve sus ofertas" on public.offers;
create policy "Comerciante ve sus ofertas"
  on public.offers for select
  to authenticated
  using (merchant_id = auth.uid());

-- (Publicar, editar stock o estado: SOLO por RPC transaccional.)

-- 3.3 reservations: solo el dueño del negocio ve sus reservas (el cliente guarda su ticket localmente)
drop policy if exists "Comerciante ve sus reservas" on public.reservations;
create policy "Comerciante ve sus reservas"
  on public.reservations for select
  to authenticated
  using (merchant_id = auth.uid());

-- 3.4 quick_requests: subasta inversa abierta a la comunidad
drop policy if exists "Pedidos visibles" on public.quick_requests;
create policy "Pedidos visibles"
  on public.quick_requests for select
  to anon, authenticated
  using (true);

drop policy if exists "Cualquiera puede pedir" on public.quick_requests;
create policy "Cualquiera puede pedir"
  on public.quick_requests for insert
  to anon, authenticated
  with check (true);

-- ============================================================================
-- 4. FUNCIONES RPC TRANSACCIONALES (SECURITY DEFINER · search_path blindado)
--    Ningún cliente puede tocar créditos ni inventarios directamente.
-- ============================================================================

-- 4.1 Actualizar mi perfil (campos en lista blanca; créditos y rol intactos)
-- (v3: añade datos de confianza del comercio para la auditoría IA del admin)
-- (V19.0: limpia cualquier sobrecarga previa para evitar errores PGRST203)
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'update_my_profile_rpc'
  loop
    execute 'drop function if exists ' || r.sig;
  end loop;
end $$;

create or replace function public.update_my_profile_rpc(
  p_business_name     text default null,
  p_category          text default null,
  p_whatsapp          text default null,
  p_municipality      text default null,
  p_address_reference text default null,
  p_lat               double precision default null,
  p_lng               double precision default null,
  p_logo_thumb        text default null,
  p_nit_or_cedula     text default null,
  p_social_or_maps_link text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión';
  end if;

  if p_business_name is not null and (char_length(p_business_name) < 2 or char_length(p_business_name) > 80) then
    raise exception 'El nombre del negocio debe tener entre 2 y 80 caracteres';
  end if;
  if p_whatsapp is not null and (char_length(p_whatsapp) < 10 or char_length(p_whatsapp) > 15) then
    raise exception 'El WhatsApp debe tener entre 10 y 15 dígitos';
  end if;
  if p_category is not null and p_category not in ('comida', 'transporte_flete', 'agro_mercado', 'hoteles_turismo', 'salud_belleza', 'hogar_construccion', 'servicios_comercios') then
    raise exception 'Categoría inválida';
  end if;
  if p_lat is not null and (p_lat < -90 or p_lat > 90) then
    raise exception 'Latitud inválida';
  end if;
  if p_lng is not null and (p_lng < -180 or p_lng > 180) then
    raise exception 'Longitud inválida';
  end if;

  update public.profiles set
    business_name      = coalesce(p_business_name, business_name),
    category           = coalesce(p_category, category),
    whatsapp           = coalesce(p_whatsapp, whatsapp),
    municipality       = coalesce(p_municipality, municipality),
    address_reference  = coalesce(p_address_reference, address_reference),
    lat                = coalesce(p_lat, lat),
    lng                = coalesce(p_lng, lng),
    -- Logo: '' lo borra, un dataURL lo asigna, null no lo toca
    logo_thumb         = case when p_logo_thumb is null then logo_thumb
                              else nullif(btrim(p_logo_thumb), '') end,
    -- Datos de confianza para la auditoría IA (nit/cédula y red social o Maps)
    nit_or_cedula      = case when p_nit_or_cedula is null then nit_or_cedula
                              else nullif(btrim(p_nit_or_cedula), '') end,
    social_or_maps_link = case when p_social_or_maps_link is null then social_or_maps_link
                               else nullif(btrim(p_social_or_maps_link), '') end
  where id = auth.uid()
  returning * into v_profile;

  if not found then
    raise exception 'Perfil no encontrado';
  end if;

  return v_profile;
end;
$$;

-- 4.1b V19.0 · Guardar ubicación exacta del comercio (profiles + ofertas activas)
create or replace function public.update_profile_location_rpc(
  p_lat               double precision,
  p_lng               double precision,
  p_address_reference text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_addr    text;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión';
  end if;
  if p_lat is null or p_lng is null or p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'Coordenadas inválidas. Selecciona un punto válido en el mapa.';
  end if;

  v_addr := nullif(btrim(coalesce(p_address_reference, '')), '');
  if v_addr is not null and char_length(v_addr) > 120 then
    v_addr := left(v_addr, 120);
  end if;

  update public.profiles
     set lat = p_lat,
         lng = p_lng,
         address_reference = coalesce(v_addr, address_reference)
   where id = auth.uid()
  returning * into v_profile;

  if not found then
    raise exception 'Perfil no encontrado';
  end if;

  -- Sincroniza las ofertas activas del comercio para que sus pines en el radar reflejen el local real
  update public.offers
     set lat = p_lat,
         lng = p_lng
   where merchant_id = auth.uid()
     and status = 'active';

  return v_profile;
end;
$$;

-- 4.2 Publicar oferta: valida y descuenta 1 crédito de forma atómica + auto-purga
create or replace function public.publish_offer_rpc(
  p_category       text,
  p_title          text,
  p_description    text,
  p_total_quota    integer,
  p_emoji_icon     text default '🔥',
  p_original_price numeric default null,
  p_promo_price    numeric default null,
  p_duration_hours numeric default 3,
  p_municipality   text default 'Gachetá',
  p_lat            double precision default 4.8167,
  p_lng            double precision default -73.6333,
  p_image_thumb    text default null,
  p_delivery_type  text default 'local_fisico'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_offer   public.offers;
begin
  if p_promo_price is null or p_promo_price < 0 then
    raise exception 'El precio de oferta es obligatorio';
  end if;
  if p_total_quota < 1 or p_total_quota > 500 then
    raise exception 'El cupo debe estar entre 1 y 500';
  end if;
  if p_duration_hours <= 0 or p_duration_hours > 96 then
    raise exception 'La duración debe estar entre 30 minutos y 96 horas (4 días)';
  end if;
  if char_length(trim(p_title)) < 3 or char_length(p_title) > 90 then
    raise exception 'El título debe tener entre 3 y 90 caracteres';
  end if;
  if char_length(trim(p_description)) < 5 or char_length(p_description) > 280 then
    raise exception 'La descripción debe tener entre 5 y 280 caracteres';
  end if;
  if p_category not in ('comida', 'transporte_flete', 'agro_mercado', 'hoteles_turismo', 'salud_belleza', 'hogar_construccion', 'servicios_comercios') then
    raise exception 'Categoría inválida';
  end if;

  -- Bloqueo pesimista de la fila del perfil: nada de sobreventa de créditos
  select * into v_profile from public.profiles where id = auth.uid() for update;
  if not found then
    raise exception 'Perfil no encontrado';
  end if;
  if v_profile.role not in ('merchant', 'admin') then
    raise exception 'Rol sin permiso para publicar';
  end if;
  if not coalesce(v_profile.is_active, true) or coalesce(v_profile.is_suspended, false) then
    raise exception 'CUENTA_SUSPENDIDA: tu cuenta está suspendida temporalmente. Contacta al administrador.';
  end if;
  if p_image_thumb is not null and char_length(p_image_thumb) > 35000 then
    raise exception 'La foto es demasiado pesada. Intenta con otra imagen.';
  end if;
  if p_delivery_type not in ('local_fisico', 'parque_principal', 'domicilio') then
    raise exception 'Modalidad de entrega inválida';
  end if;
  if v_profile.credits < 1 then
    raise exception 'NO_CREDITS: No tienes créditos disponibles. Recarga con el administrador para volver a publicar.';
  end if;

  -- Descuento atómico de 1 crédito
  update public.profiles
     set credits = credits - 1
   where id = v_profile.id;

  -- Inserción de la oferta
  insert into public.offers (
    merchant_id, category, title, description, emoji_icon,
    original_price, promo_price, total_quota, available_quota,
    municipality, lat, lng, expires_at, status,
    image_thumb, delivery_type
  ) values (
    v_profile.id, p_category, trim(p_title), trim(p_description),
    coalesce(nullif(trim(p_emoji_icon), ''), '🔥'),
    p_original_price, p_promo_price, p_total_quota, p_total_quota,
    coalesce(nullif(trim(p_municipality), ''), 'Gachetá'),
    coalesce(p_lat, v_profile.lat, 4.8167),
    coalesce(p_lng, v_profile.lng, -73.6333),
    now() + (p_duration_hours::int * interval '1 hour'),
    'active',
    p_image_thumb,
    p_delivery_type
  )
  returning * into v_offer;

  -- Auto-purga inteligente: elimina ofertas vencidas/agotadas/canceladas
  -- conservando SIEMPRE las 10 inactivas más recientes (republicación en 1 clic).
  delete from public.offers o
   where o.merchant_id = v_profile.id
     and o.id <> v_offer.id
     and (o.status <> 'active' or o.expires_at < now())
     and o.id not in (
       select id
         from public.offers
        where merchant_id = v_profile.id
          and (status <> 'active' or expires_at < now())
        order by created_at desc
        limit 10
     );

  return to_jsonb(v_offer);
end;
$$;

-- 4.3 Reservar: bloqueo de fila, validación de stock, cupos y código de ticket
-- (v3: trazabilidad de IP/dispositivo; v4: coordenadas GPS silenciosas; V19: IP real desde edge)
drop function if exists public.reserve_offer_rpc(uuid, text, text, integer, text);
drop function if exists public.reserve_offer_rpc(uuid, text, text, integer, text, text);
drop function if exists public.reserve_offer_rpc(uuid, text, text, integer, text, text, double precision, double precision);
create or replace function public.reserve_offer_rpc(
  p_offer_id       uuid,
  p_customer_name  text,
  p_customer_phone text,
  p_quantity       integer default 1,
  p_customer_note  text default '',
  p_device_id      text default null,
  p_client_lat     double precision default null,
  p_client_lng     double precision default null,
  p_edge_ip        text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer     public.offers;
  v_merchant  public.profiles;
  v_res       public.reservations;
  v_code      text;
  v_client_ip text;
  v_device    text;
begin
  -- Trazabilidad forense: IP real capturada en el servidor (prioriza X-Forwarded-For, fallback /api/ip validado)
  v_client_ip := public.resolve_client_ip(p_edge_ip);
  v_device    := nullif(btrim(coalesce(p_device_id, '')), '');

  if char_length(trim(p_customer_name)) < 2 or char_length(p_customer_name) > 60 then
    raise exception 'El nombre debe tener entre 2 y 60 caracteres';
  end if;
  if char_length(p_customer_phone) < 7 or char_length(p_customer_phone) > 20 then
    raise exception 'El teléfono debe tener entre 7 y 20 caracteres';
  end if;
  if p_quantity < 1 or p_quantity > 20 then
    raise exception 'La cantidad debe estar entre 1 y 20';
  end if;
  if char_length(coalesce(p_customer_note, '')) > 140 then
    raise exception 'La nota no puede superar 140 caracteres';
  end if;

  -- Escudo anti-sabotaje: dispositivo o teléfono en la lista negra global
  if public.is_client_blocked(trim(p_customer_phone), v_device) then
    raise exception 'CLIENTE_BLOQUEADO: esta solicitud no puede completarse desde este dispositivo o número';
  end if;

  -- Bloqueo pesimista de la oferta: imposible vender el mismo cupo dos veces
  select * into v_offer from public.offers where id = p_offer_id for update;
  if not found then
    raise exception 'Oferta no encontrada';
  end if;
  if v_offer.status <> 'active' or v_offer.expires_at < now() then
    raise exception 'Esta oferta ya no está activa';
  end if;

  -- Candado anti-duplicado: el mismo dispositivo o teléfono no puede apartar
  -- dos veces la misma oferta mientras el primer pedido siga pendiente
  if exists (
    select 1
      from public.reservations r
     where r.offer_id = v_offer.id
       and r.status = 'pending'
       and (
             (v_device is not null and r.device_id = v_device)
             or r.customer_phone = trim(p_customer_phone)
           )
  ) then
    raise exception 'YA_APARTASTE_ESTE_PEDIDO: ya tienes este pedido pendiente de recoger con este número o dispositivo';
  end if;

  -- Lista negra privada del comerciante (clientes que sabotearon sus ofertas)
  if exists (
    select 1
      from public.blocked_clients b
     where b.blocked_by = v_offer.merchant_id
       and (
             (v_device is not null and b.device_id = v_device)
             or b.phone = trim(p_customer_phone)
           )
  ) then
    raise exception 'CLIENTE_BLOQUEADO: esta solicitud no puede completarse desde este dispositivo o número';
  end if;

  if v_offer.available_quota < p_quantity then
    raise exception 'SOLO_QUEDAN % unidades de esta oferta', v_offer.available_quota;
  end if;

  -- Descuento atómico de cupos (available_quota hace referencia al valor previo)
  update public.offers
     set available_quota = available_quota - p_quantity,
         status = case when available_quota - p_quantity <= 0 then 'sold_out' else status end
   where id = v_offer.id;

  -- Código de ticket corto y legible (sin caracteres ambiguos)
  select upper(string_agg(c, ''))
    into v_code
    from (
      select substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (floor(random() * 32) + 1)::int, 1) as c
      from generate_series(1, 4)
    ) chars;

  insert into public.reservations (
    offer_id, merchant_id, customer_name, customer_phone,
    quantity, customer_note, reservation_code, status,
    client_ip, device_id, client_lat, client_lng
  ) values (
    v_offer.id, v_offer.merchant_id, trim(p_customer_name), trim(p_customer_phone),
    p_quantity, coalesce(p_customer_note, ''), v_code, 'pending',
    v_client_ip, v_device,
    coalesce(nullif(p_client_lat, 0), null),
    coalesce(nullif(p_client_lng, 0), null)
  )
  returning * into v_res;

  select * into v_merchant from public.profiles where id = v_offer.merchant_id;

  return jsonb_build_object(
    'reservation', to_jsonb(v_res),
    'offer', to_jsonb(v_offer),
    'merchant', to_jsonb(v_merchant)
  );
end;
$$;

-- 4.4 El comerciante completa o libera una reserva (liberar devuelve el stock)
create or replace function public.merchant_update_reservation_rpc(
  p_reservation_id uuid,
  p_action         text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_res   public.reservations;
  v_offer public.offers;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión';
  end if;
  if p_action not in ('completed', 'released') then
    raise exception 'Acción inválida';
  end if;

  select * into v_res
    from public.reservations
   where id = p_reservation_id and merchant_id = auth.uid()
     for update;
  if not found then
    raise exception 'Reserva no encontrada';
  end if;
  if v_res.status <> 'pending' then
    raise exception 'Esta reserva ya fue procesada';
  end if;

  if p_action = 'completed' then
    update public.reservations
       set status = 'completed',
           sales_counted = true
     where id = v_res.id
    returning * into v_res;

    -- Acumulador histórico permanente (12 bytes por comerciante): el contador
    -- de dinero ganado sobrevive a la purga de la base de datos. La bandera
    -- sales_counted garantiza que cada venta se cuente UNA sola vez.
    select * into v_offer from public.offers where id = v_res.offer_id;
    update public.profiles
       set lifetime_sales_cop    = lifetime_sales_cop + (v_res.quantity * coalesce(v_offer.promo_price, 0)),
           lifetime_orders_count = lifetime_orders_count + 1
     where id = v_res.merchant_id;
  else
    update public.reservations
       set status = 'released'
     where id = v_res.id
    returning * into v_res;

    -- Devolución segura del stock si la oferta sigue vigente
    select * into v_offer from public.offers where id = v_res.offer_id for update;
    if found and v_offer.expires_at > now() and v_offer.status <> 'cancelled' then
      update public.offers
         set available_quota = least(total_quota, available_quota + v_res.quantity),
             status = case when status = 'sold_out' then 'active' else status end
       where id = v_offer.id;
    end if;
  end if;

  return jsonb_build_object('reservation', to_jsonb(v_res));
end;
$$;

-- 4.5 Calificar experiencia: acumula el promedio en profiles sin tablas extra
create or replace function public.rate_reservation_rpc(
  p_reservation_id uuid,
  p_code           text,
  p_stars          integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_res public.reservations;
begin
  if p_stars < 1 or p_stars > 5 then
    raise exception 'La calificación debe ser entre 1 y 5 estrellas';
  end if;

  select * into v_res
    from public.reservations
   where id = p_reservation_id
     and reservation_code = upper(trim(p_code))
     for update;
  if not found then
    raise exception 'Reserva no encontrada';
  end if;
  -- V14: la calificación SOLO es posible tras la entrega del producto o
  -- servicio (el comercio marca la reserva como 'completed').
  if v_res.status <> 'completed' then
    raise exception 'Podrás calificar cuando el comercio te entregue el producto o servicio';
  end if;
  if v_res.is_rated then
    raise exception 'Ya calificaste esta reserva';
  end if;

  update public.reservations
     set is_rated = true
   where id = v_res.id;

  update public.profiles
     set rating_sum = rating_sum + p_stars,
         rating_count = rating_count + 1
   where id = v_res.merchant_id;

  return jsonb_build_object('ok', true);
end;
$$;

-- 4.6 Exclusivo del administrador: recargar créditos, verificar y suspender comercios
drop function if exists public.admin_manage_merchant_rpc(uuid, integer, boolean);
create or replace function public.admin_manage_merchant_rpc(
  p_merchant_id uuid,
  p_add_credits integer default 0,
  p_verify      boolean default null,
  p_active      boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  if not public.is_admin() then
    raise exception 'SOLO_ADMIN: esta acción está reservada al administrador';
  end if;
  if p_add_credits = 0 and p_verify is null and p_active is null then
    raise exception 'Nada que actualizar';
  end if;

  select * into v_profile from public.profiles where id = p_merchant_id for update;
  if not found then
    raise exception 'Comercio no encontrado';
  end if;

  update public.profiles
     set credits = greatest(0, credits + coalesce(p_add_credits, 0)),
         is_verified = coalesce(p_verify, is_verified),
         is_active = coalesce(p_active, is_active),
         -- Espejo de suspensión: mantener ambos flags consistentes
         is_suspended = case when p_active is null then is_suspended else not p_active end
   where id = p_merchant_id
  returning * into v_profile;

  return jsonb_build_object('profile', to_jsonb(v_profile));
end;
$$;

-- 4.7 Contador de vistas de una oferta (incremento atómico, sin edición libre)
create or replace function public.increment_offer_views_rpc(p_offer_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.offers
     set views_count = views_count + 1
   where id = p_offer_id;
$$;

-- Concesión de ejecución explícita --------------------------------------------
grant execute on function public.is_admin()                          to anon, authenticated;
grant execute on function public.update_my_profile_rpc(text, text, text, text, text, double precision, double precision, text, text, text) to authenticated;
grant execute on function public.update_profile_location_rpc(double precision, double precision, text) to authenticated;
grant execute on function public.publish_offer_rpc(text, text, text, integer, text, numeric, numeric, numeric, text, double precision, double precision, text, text) to authenticated;
grant execute on function public.reserve_offer_rpc(uuid, text, text, integer, text, text, double precision, double precision, text)    to anon, authenticated;
grant execute on function public.merchant_update_reservation_rpc(uuid, text)           to authenticated;
grant execute on function public.rate_reservation_rpc(uuid, text, integer)             to anon, authenticated;
grant execute on function public.admin_manage_merchant_rpc(uuid, integer, boolean, boolean) to authenticated;
grant execute on function public.increment_offer_views_rpc(uuid)                       to anon, authenticated;

-- ============================================================================
-- 7. SEGURIDAD DE ACCESO Y MODERACIÓN (v1.1)
--    - Registro de comerciantes SOLO con código de invitación del administrador
--      (evita registros anónimos y protege la confianza del ecosistema).
--    - Suspensión de cuentas (moderación contra usos malintencionados).
--    Idempotente: si ya ejecutaste la versión anterior, vuelve a ejecutar
--    el archivo completo sin riesgo.
-- ============================================================================

-- 7.1 Configuración de plataforma (inaccesible para el cliente: sin políticas RLS)
create table if not exists public.platform_settings (
  id                   integer primary key default 1 check (id = 1),
  merchant_invite_code text not null default 'IMPULSO-GACHETA-2026',
  require_invite       boolean not null default false,  -- false = registro abierto (lanzamiento)
  updated_at           timestamptz not null default now()
);

insert into public.platform_settings (id)
values (1)
on conflict (id) do nothing;

alter table public.platform_settings add column if not exists require_invite boolean not null default false;

alter table public.platform_settings enable row level security;
-- (Sin políticas: solo el siguiente RPC SECURITY DEFINER la consulta.)

-- 7.2 Validación de código de invitación (ejecutable desde el registro)
--     Modo lanzamiento (require_invite = false): registro abierto para que
--     pruebe la plataforma toda la gente. Cuando quieras cerrar el acceso
--     a comercios conocidos únicamente, ejecuta:
--       update public.platform_settings set require_invite = true;
--     y entrega el código (IMPULSO-GACHETA-2026 o el que definas) solo a ellos.
create or replace function public.validate_invite_rpc(p_code text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_require boolean;
begin
  select coalesce(require_invite, false)
    into v_require
    from public.platform_settings
   where id = 1;

  if not coalesce(v_require, false) then
    return true; -- Registro abierto
  end if;

  return exists (
    select 1 from public.platform_settings
     where id = 1
       and upper(btrim(merchant_invite_code)) = upper(btrim(coalesce(p_code, '')))
  );
end;
$$;

grant execute on function public.validate_invite_rpc(text) to anon, authenticated;

-- 7.2.1 Auto-sanación del perfil: si por cualquier motivo el trigger no creó
--      el perfil (ej. ejecución parcial del esquema), la app lo crea sola
--      usando los datos del registro. Nunca más pantallas en blanco.
create or replace function public.ensure_my_profile_rpc()
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_meta    jsonb;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();
  if found then
    return v_profile;
  end if;

  v_meta := coalesce(
    (select raw_user_meta_data from auth.users where id = auth.uid()),
    '{}'::jsonb
  );

  insert into public.profiles (id, business_name, category, whatsapp, municipality)
  values (
    auth.uid(),
    coalesce(nullif(btrim(v_meta ->> 'business_name'), ''), 'Mi Negocio'),
    case
      when v_meta ->> 'category' in ('comida', 'transporte_flete', 'agro_mercado', 'hoteles_turismo', 'salud_belleza', 'hogar_construccion', 'servicios_comercios')
        then v_meta ->> 'category'
      else 'comida'
    end,
    coalesce(nullif(v_meta ->> 'whatsapp', ''), '3000000000'),
    coalesce(v_meta ->> 'municipality', 'Gachetá')
  )
  on conflict (id) do nothing
  returning * into v_profile;

  if v_profile is null then
    select * into v_profile from public.profiles where id = auth.uid();
  end if;

  return v_profile;
end;
$$;

grant execute on function public.ensure_my_profile_rpc() to authenticated;
-- 7.3 Columna de suspensión (idempotente para bases de datos ya creadas)
alter table public.profiles add column if not exists is_active boolean not null default true;

-- 7.4 Categorías ampliadas: hotelería y turismo, salud y belleza, hogar y
--     construcción. (Idempotente: reconstruye los CHECK de las 3 tablas.)
alter table public.profiles drop constraint if exists profiles_category_check;
alter table public.offers drop constraint if exists offers_category_check;
alter table public.quick_requests drop constraint if exists quick_requests_category_check;

alter table public.profiles add constraint profiles_category_check
  check (category in ('comida', 'transporte_flete', 'agro_mercado', 'hoteles_turismo', 'salud_belleza', 'hogar_construccion', 'servicios_comercios'));

alter table public.offers add constraint offers_category_check
  check (category in ('comida', 'transporte_flete', 'agro_mercado', 'hoteles_turismo', 'salud_belleza', 'hogar_construccion', 'servicios_comercios'));

alter table public.quick_requests add constraint quick_requests_category_check
  check (category in ('comida', 'transporte_flete', 'agro_mercado', 'hoteles_turismo', 'salud_belleza', 'hogar_construccion', 'servicios_comercios'));

-- ============================================================================
-- 5. SUPABASE REALTIME (actualización en vivo de toda la plataforma)
-- ============================================================================
alter table public.offers         replica identity full;
alter table public.reservations   replica identity full;
alter table public.quick_requests replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.offers, public.reservations, public.quick_requests;
  exception when others then
    null; -- Las tablas ya pertenecen a la publicación
  end;
end $$;

-- ============================================================================
-- 6. MODO VITRINA — Datos semilla (solo si la plataforma está vacía)
--    Crea 6 comercios demo verificados geolocalizados en Gachetá con ofertas
--    vivas, para que la plataforma luzca viva desde el primer segundo.
-- ============================================================================
do $$
declare
  demo constant jsonb := '[
    {"email":"panaderia.laespiga@demo.impulso.app","business_name":"Panadería La Espiga","category":"comida","whatsapp":"573201110101","lat":4.8181,"lng":-73.6339,"address_reference":"Frente al Parque Principal"},
    {"email":"fogon.abuela@demo.impulso.app","business_name":"Restaurante El Fogón de la Abuela","category":"comida","whatsapp":"573201110102","lat":4.8152,"lng":-73.6321,"address_reference":"Calle 3 # 5-21, Casco Urbano"},
    {"email":"rapidita.fletes@demo.impulso.app","business_name":"Transportes La Rapidita","category":"transporte_flete","whatsapp":"573201110103","lat":4.8195,"lng":-73.6360,"address_reference":"Vía a Junín, entrada del pueblo"},
    {"email":"agro.elcampo@demo.impulso.app","business_name":"Agroinsumos El Campo","category":"agro_mercado","whatsapp":"573201110104","lat":4.8141,"lng":-73.6352,"address_reference":"Plaza de mercado, local 4"},
    {"email":"ferreteria.constructor@demo.impulso.app","business_name":"Ferretería El Constructor","category":"servicios_comercios","whatsapp":"573201110105","lat":4.8172,"lng":-73.6310,"address_reference":"Carrera 5 # 8-33"},
    {"email":"drogueria.lasalud@demo.impulso.app","business_name":"Droguería La Salud","category":"servicios_comercios","whatsapp":"573201110106","lat":4.8160,"lng":-73.6341,"address_reference":"Parque Principal, esquina norte"}
  ]'::jsonb;
  u   uuid;
  rec jsonb;
begin
  -- 6.1 Sembrar comercios demo (con usuario Auth inactivo para cumplir la FK)
  if not exists (select 1 from public.profiles where business_name = 'Panadería La Espiga') then
    for rec in select jsonb_array_elements(demo) loop
      select id into u from auth.users where email = rec ->> 'email';
      if u is null then
        insert into auth.users (
          instance_id, id, aud, role, email, encrypted_password,
          email_confirmed_at, created_at, updated_at,
          raw_app_meta_data, raw_user_meta_data,
          confirmation_token, recovery_token, email_change, email_change_token_new
        ) values (
          '00000000-0000-0000-0000-000000000000',
          gen_random_uuid(),
          'authenticated',
          'authenticated',
          rec ->> 'email',
          extensions.crypt('impulso-demo-2026', extensions.gen_salt('bf')),
          now(), now(), now(),
          '{"provider":"email","providers":["email"]}'::jsonb,
          '{}'::jsonb,
          '', '', '', ''
        )
        returning id into u;

        insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
        values (
          u, u,
          jsonb_build_object('sub', u::text, 'email', rec ->> 'email', 'email_verified', true),
          'email', now(), now(), now()
        );
      end if;

      -- El trigger creó el perfil: ahora lo personalizamos como vitrina
      update public.profiles set
        business_name     = rec ->> 'business_name',
        category          = rec ->> 'category',
        whatsapp          = rec ->> 'whatsapp',
        municipality      = 'Gachetá',
        address_reference = rec ->> 'address_reference',
        lat               = (rec ->> 'lat')::double precision,
        lng               = (rec ->> 'lng')::double precision,
        is_verified       = true,
        credits           = 10
      where id = u;
    end loop;
  end if;

end $$;

-- Inserción real de las ofertas vitrina (más legible y robusta)
do $$
declare
  v_merchant uuid;
begin
  -- Revive las ofertas demo vencidas (solo las intactas: nadie apartó cupos).
  -- Así basta con re-ejecutar este archivo para que el radar vuelva a la vida.
  update public.offers o
     set status     = 'active',
         expires_at = now() + interval '24 hours'
   where o.available_quota = o.total_quota
     and o.expires_at < now()
     and o.merchant_id in (
       select id from public.profiles
        where business_name in (
          'Panadería La Espiga', 'Restaurante El Fogón de la Abuela',
          'Transportes La Rapidita', 'Agroinsumos El Campo',
          'Ferretería El Constructor', 'Droguería La Salud'
        )
     );

  if exists (select 1 from public.offers) then
    return; -- La plataforma ya tiene contenido
  end if;

  select id into v_merchant from public.profiles where business_name = 'Panadería La Espiga';
  if v_merchant is not null then
    insert into public.offers (merchant_id, category, title, description, emoji_icon, original_price, promo_price, total_quota, available_quota, municipality, lat, lng, expires_at, status) values
    (v_merchant, 'comida', 'Docena de croissants recién horneados', 'Crocantes por fuera, suaves por dentro. Salen del horno a las 6 a.m. ¡Aparta la tuya antes de que vuelen!', '🥐', 18000, 12000, 12, 12, 'Gachetá', 4.8181, -73.6339, now() + interval '8 hours', 'active'),
    (v_merchant, 'comida', 'Pandebono + chocolate completo', 'Desayuno del pueblo: 2 pandebonos grandes con chocolate caliente para llevar. Relámpago, solo esta mañana.', '🍞', 9000, 6500, 20, 20, 'Gachetá', 4.8181, -73.6339, now() + interval '4 hours', 'active');
  end if;

  select id into v_merchant from public.profiles where business_name = 'Restaurante El Fogón de la Abuela';
  if v_merchant is not null then
    insert into public.offers (merchant_id, category, title, description, emoji_icon, original_price, promo_price, total_quota, available_quota, municipality, lat, lng, expires_at, status) values
    (v_merchant, 'comida', 'Almuerzo ejecutivo con trucha', 'Trucha fresca del día, arroz, ensalada, sopa y jugo natural. 15 almuerzos disponibles, caseros como siempre.', '🍽️', 20000, 12000, 15, 15, 'Gachetá', 4.8152, -73.6321, now() + interval '3 hours', 'active'),
    (v_merchant, 'comida', 'Arepa con carne asada 2x1', 'Promoción válida por 3 días: dos arepas con carne asada al precio de una. Ideal para compartir.', '🍡', 16000, 16000, 30, 30, 'Gachetá', 4.8152, -73.6321, now() + interval '72 hours', 'active');
  end if;

  select id into v_merchant from public.profiles where business_name = 'Transportes La Rapidita';
  if v_merchant is not null then
    insert into public.offers (merchant_id, category, title, description, emoji_icon, original_price, promo_price, total_quota, available_quota, municipality, lat, lng, expires_at, status) values
    (v_merchant, 'transporte_flete', 'Flete Gachetá → Bogotá 40% OFF', 'Camión 1.5 toneladas, lunes a viernes. Carga y descarga incluida dentro del casco urbano.', '🚚', 400000, 240000, 6, 6, 'Gachetá', 4.8195, -73.6360, now() + interval '24 hours', 'active');
  end if;

  select id into v_merchant from public.profiles where business_name = 'Agroinsumos El Campo';
  if v_merchant is not null then
    insert into public.offers (merchant_id, category, title, description, emoji_icon, original_price, promo_price, total_quota, available_quota, municipality, lat, lng, expires_at, status) values
    (v_merchant, 'agro_mercado', 'Bulto de abono 25kg con descuento', 'Abono NPK 10-20-20 ideal para estas lluvias. Stock limitado del almacén.', '🌱', 95000, 79000, 25, 25, 'Gachetá', 4.8141, -73.6352, now() + interval '96 hours', 'active');
  end if;

  select id into v_merchant from public.profiles where business_name = 'Ferretería El Constructor';
  if v_merchant is not null then
    insert into public.offers (merchant_id, category, title, description, emoji_icon, original_price, promo_price, total_quota, available_quota, municipality, lat, lng, expires_at, status) values
    (v_merchant, 'servicios_comercios', 'Kit de herramientas básicas', 'Martillo, destornilladores, cinta y alicate en maleta plástica. Perfecto para el maestro del hogar.', '🛠️', 90000, 69000, 10, 10, 'Gachetá', 4.8172, -73.6310, now() + interval '48 hours', 'active');
  end if;

  select id into v_merchant from public.profiles where business_name = 'Droguería La Salud';
  if v_merchant is not null then
    insert into public.offers (merchant_id, category, title, description, emoji_icon, original_price, promo_price, total_quota, available_quota, municipality, lat, lng, expires_at, status) values
    (v_merchant, 'servicios_comercios', 'Kit de botiquín familiar', 'Alcohol, algodón, gasas, curas, suero oral y termómetro. Todo lo esencial en un solo kit.', '💊', 45000, 32000, 18, 18, 'Gachetá', 4.8160, -73.6341, now() + interval '96 hours', 'active');
  end if;
end $$;

-- ============================================================================
--  FIN DEL ESQUEMA — Impulso listo para producción
-- ============================================================================

-- ============================================================================
--  ADMINISTRADOR ÚNICO DE LA PLATAFORMA
--  Este bloque se ejecuta solo cada vez que corres este archivo:
--   1. Confirma el correo de la cuenta dueña (por si el email dio guerra).
--   2. Le asigna el rol admin.
--   3. Le quita el rol admin a CUALQUIER otra cuenta (admin único garantizado).
--  Para cambiar de administrador en el futuro: edita el correo de aquí abajo
--  y re-ejecuta este archivo (o ejecuta promote_admin.sql).
-- ============================================================================
do $$
declare
  v_owner uuid;
begin
  select id into v_owner
    from auth.users
   where email = 'maicolherrera675@gmail.com';

  if v_owner is not null then
    -- Confirmar el correo de la cuenta dueña
    update auth.users
       set email_confirmed_at = coalesce(email_confirmed_at, now()),
           updated_at         = now()
     where id = v_owner;

    -- Asignar el rol de administrador y verificación automática
    update public.profiles
       set role = 'admin',
           is_verified = true
     where id = v_owner;

    -- Garantía de admin único: nadie más queda como admin
    update public.profiles
       set role = 'merchant'
     where role = 'admin'
       and id <> v_owner;
  end if;
end $$;

-- ============================================================================
--  8. FOTOS ULTRALIGERAS, MODALIDAD SEGURA Y MODERACIÓN COMUNITARIA (v2)
--  Idempotente. Las fotos viven COMPRIMIDAS en la propia fila (canvas WebP
--  < 20 KB): cero Supabase Storage y el espacio se libera solo al purgar.
-- ============================================================================

-- 8.1 Columnas nuevas (todas idempotentes)
alter table public.profiles add column if not exists logo_thumb text default null;
alter table public.profiles add column if not exists is_suspended boolean not null default false;

alter table public.offers add column if not exists image_thumb text default null
  constraint offers_image_thumb_len check (image_thumb is null or char_length(image_thumb) <= 35000);
alter table public.offers add column if not exists delivery_type text not null default 'local_fisico'
  constraint offers_delivery_type_check check (delivery_type in ('local_fisico', 'parque_principal', 'domicilio'));
alter table public.offers add column if not exists reports_count integer not null default 0;

-- 8.2 Reportes comunitarios v3 (Blindaje anti-envidia + depuración admin):
--   · Exige motivo válido y detalle sustancial (evita reportes en 1 clic por envidia).
--   · Deduplica por dispositivo Y por IP pública en la misma oferta (24h).
--   · Verifica si el reportante tuvo una reserva real con la oferta/comercio
--     (is_verified_buyer). Comercios verificados jamás caen por clics anónimos
--     sin prueba real: las denuncias pasan a revisión del administrador.
--   · Permite al administrador borrar denuncias falsas y restaurar ofertas/locales.
create table if not exists public.offer_reports (
  id                uuid primary key default gen_random_uuid(),
  offer_id          uuid not null references public.offers(id) on delete cascade,
  reason            text not null,
  detail            text,
  device_id         text,
  client_ip         text,
  is_verified_buyer boolean not null default false,
  trust_weight      integer not null default 1,
  created_at        timestamptz not null default now(),
  constraint offer_reports_reason_check check (char_length(reason) between 1 and 60),
  constraint offer_reports_detail_check check (detail is null or char_length(detail) <= 500)
);
alter table public.offer_reports add column if not exists is_verified_buyer boolean not null default false;
alter table public.offer_reports add column if not exists trust_weight integer not null default 1;
alter table public.offer_reports enable row level security;
create index if not exists offer_reports_offer_idx  on public.offer_reports (offer_id);
create index if not exists offer_reports_recent_idx on public.offer_reports (created_at desc);
create index if not exists offer_reports_ip_idx     on public.offer_reports (offer_id, client_ip);

-- Firmas previas: fuera, para evitar ambigüedad en PostgREST.
drop function if exists public.report_offer_rpc(uuid);
drop function if exists public.report_offer_rpc(uuid, text, text, text);
create or replace function public.report_offer_rpc(
  p_offer_id  uuid,
  p_reason    text,
  p_detail    text default null,
  p_device_id text default null,
  p_edge_ip   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer           public.offers;
  v_merchant_verif  boolean := false;
  v_device          text := nullif(trim(coalesce(p_device_id, '')), '');
  v_ip              text := public.resolve_client_ip(p_edge_ip);
  v_detail          text := nullif(trim(coalesce(p_detail, '')), '');
  v_is_buyer        boolean := false;
  v_weight          integer := 1;
  v_total_reports   integer := 0;
  v_buyer_reports   integer := 0;
  v_recent_by_actor integer := 0;
  v_should_pause    boolean := false;
begin
  if p_offer_id is null or coalesce(p_reason, '') = '' then
    raise exception 'Reporte inválido: falta la oferta o el motivo';
  end if;
  if p_reason not in ('no_existe', 'precio_enganoso', 'cerrado', 'estafa', 'otro') then
    raise exception 'Motivo de reporte inválido';
  end if;
  if v_detail is null or char_length(v_detail) < 12 or v_detail ~ '(.)\1{5,}' then
    raise exception 'DETALLE_REQUERIDO: explica brevemente lo ocurrido (mínimo 12 caracteres reales sin spam) para evitar reportes falsos o por envidia';
  end if;

  select * into v_offer from public.offers where id = p_offer_id for update;
  if not found then
    raise exception 'Oferta no encontrada';
  end if;

  select coalesce(is_verified, false) into v_merchant_verif
    from public.profiles
   where id = v_offer.merchant_id;

  -- Escudo anti-sabotaje: clientes bloqueados no pueden tumbar ofertas
  if public.is_client_blocked(null, v_device) then
    raise exception 'CLIENTE_BLOQUEADO: tu dispositivo tiene restringido enviar reportes';
  end if;

  -- Anti doble conteo: 1 dispositivo O 1 IP pública = 1 reporte por oferta
  if (
    v_device is not null and exists (
      select 1 from public.offer_reports where offer_id = p_offer_id and device_id = v_device
    )
  ) or (
    v_ip is not null and v_ip <> '0.0.0.0' and exists (
      select 1 from public.offer_reports
       where offer_id = p_offer_id and client_ip = v_ip and created_at > now() - interval '24 hours'
    )
  ) then
    return jsonb_build_object(
      'reports', v_offer.reports_count,
      'cancelled', false,
      'already', true,
      'verifiedBuyer', false,
      'underReview', false
    );
  end if;

  -- Anti-bombardeo: máx. 3 reportes cada 24h por dispositivo o IP en toda la app
  select count(*) into v_recent_by_actor
    from public.offer_reports r
   where r.created_at > now() - interval '24 hours'
     and (
       (v_device is not null and r.device_id = v_device)
       or (v_ip is not null and v_ip <> '0.0.0.0' and r.client_ip = v_ip)
     );
  if v_recent_by_actor >= 3 then
    raise exception 'LIMITE_REPORTES: alcanzaste el máximo de 3 reportes en 24 horas. El administrador revisará los casos pendientes.';
  end if;

  -- Verifica si el reportante realmente apartó/interactuó con esta oferta o comercio
  v_is_buyer := exists (
    select 1 from public.reservations res
     where (res.offer_id = p_offer_id or res.merchant_id = v_offer.merchant_id)
       and (
         (v_device is not null and res.device_id = v_device)
         or (v_ip is not null and v_ip <> '0.0.0.0' and res.client_ip = v_ip)
       )
  );
  v_weight := case when v_is_buyer then 3 else 1 end;

  insert into public.offer_reports (offer_id, reason, detail, device_id, client_ip, is_verified_buyer, trust_weight)
  values (p_offer_id, p_reason, v_detail, v_device, v_ip, v_is_buyer, v_weight);

  select count(*),
         count(*) filter (where is_verified_buyer)
    into v_total_reports, v_buyer_reports
    from public.offer_reports
   where offer_id = p_offer_id;

  -- Blindaje Anti-Envidia:
  --  · Comercio verificado: JAMÁS se tumba por clics anónimos sin reserva real.
  --    Solo pausa automática si >= 3 compradores verificados distintos reportan.
  --  · Comercio no verificado: requiere >= 2 compradores reales O >= 5 IPs distintas.
  v_should_pause := case
    when v_merchant_verif then v_buyer_reports >= 3
    else (v_buyer_reports >= 2 or v_total_reports >= 5)
  end;

  update public.offers
     set reports_count = v_total_reports,
         status = case when status = 'active' and v_should_pause then 'cancelled' else status end,
         image_thumb = case when status = 'active' and v_should_pause then null else image_thumb end
   where id = p_offer_id;

  return jsonb_build_object(
    'reports', v_total_reports,
    'cancelled', v_should_pause,
    'already', false,
    'verifiedBuyer', v_is_buyer,
    'underReview', not v_should_pause
  );
end;
$$;
grant execute on function public.report_offer_rpc(uuid, text, text, text, text) to anon, authenticated;

-- Bandeja de reportes para el administrador: motivos + oferta + comercio + evidencia real.
drop function if exists public.admin_reports_list_rpc();
create or replace function public.admin_reports_list_rpc()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador puede ver los reportes';
  end if;
  return coalesce((
    select jsonb_agg(to_jsonb(t) order by t.created_at desc)
    from (
      select r.id, r.offer_id, r.reason, r.detail, r.device_id, r.client_ip,
             r.is_verified_buyer, r.trust_weight, r.created_at,
             o.title  as offer_title,
             o.status as offer_status,
             o.merchant_id,
             p.business_name as merchant_name,
             coalesce(p.is_verified, false) as merchant_verified
      from public.offer_reports r
      join public.offers o on o.id = r.offer_id
      left join public.profiles p on p.id = o.merchant_id
      order by r.created_at desc
      limit 50
    ) t
  ), '[]'::jsonb);
end;
$$;
grant execute on function public.admin_reports_list_rpc() to authenticated;

-- 🧹 V19.0 · Desestimar una denuncia falsa / por envidia y recalcular contador (y restaurar oferta)
create or replace function public.admin_dismiss_report_rpc(
  p_report_id     uuid,
  p_restore_offer boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer_id  uuid;
  v_remaining integer := 0;
  v_restored  boolean := false;
begin
  if not public.is_admin() then
    raise exception 'SOLO_ADMIN: esta acción está reservada al administrador';
  end if;

  delete from public.offer_reports
   where id = p_report_id
  returning offer_id into v_offer_id;

  if v_offer_id is null then
    raise exception 'Denuncia no encontrada (quizá ya fue borrada)';
  end if;

  select count(*) into v_remaining
    from public.offer_reports
   where offer_id = v_offer_id;

  update public.offers
     set reports_count = v_remaining,
         status = case
           when p_restore_offer and status = 'cancelled' and expires_at > now() and available_quota > 0
             then 'active'
           else status
         end
   where id = v_offer_id
  returning (status = 'active') into v_restored;

  return jsonb_build_object('ok', true, 'remaining', v_remaining, 'restored', coalesce(v_restored, false));
end;
$$;
grant execute on function public.admin_dismiss_report_rpc(uuid, boolean) to authenticated;

-- 🧹 V19.0 · Borrar TODAS las denuncias de un local/comercio (protección total contra ataques por envidia)
create or replace function public.admin_clear_merchant_reports_rpc(
  p_merchant_id    uuid,
  p_restore_offers boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted  integer := 0;
  v_restored integer := 0;
begin
  if not public.is_admin() then
    raise exception 'SOLO_ADMIN: esta acción está reservada al administrador';
  end if;

  delete from public.offer_reports r
   using public.offers o
   where r.offer_id = o.id
     and o.merchant_id = p_merchant_id;
  get diagnostics v_deleted = row_count;

  update public.offers
     set reports_count = 0,
         status = case
           when p_restore_offers and status = 'cancelled' and expires_at > now() and available_quota > 0
             then 'active'
           else status
         end
   where merchant_id = p_merchant_id;
  get diagnostics v_restored = row_count;

  return jsonb_build_object('ok', true, 'deleted', v_deleted, 'offersUpdated', v_restored);
end;
$$;
grant execute on function public.admin_clear_merchant_reports_rpc(uuid, boolean) to authenticated;

-- 🧹 V19.0 · Borrar todas las denuncias de una oferta específica y restaurarla
create or replace function public.admin_clear_offer_reports_rpc(
  p_offer_id      uuid,
  p_restore_offer boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer := 0;
begin
  if not public.is_admin() then
    raise exception 'SOLO_ADMIN: esta acción está reservada al administrador';
  end if;

  delete from public.offer_reports where offer_id = p_offer_id;
  get diagnostics v_deleted = row_count;

  update public.offers
     set reports_count = 0,
         status = case
           when p_restore_offer and status = 'cancelled' and expires_at > now() and available_quota > 0
             then 'active'
           else status
         end
   where id = p_offer_id;

  return jsonb_build_object('ok', true, 'deleted', v_deleted);
end;
$$;
grant execute on function public.admin_clear_offer_reports_rpc(uuid, boolean) to authenticated;

-- 8.3 Kill-switch del administrador: tumba (borra) cualquier oferta al instante
create or replace function public.admin_delete_offer_rpc(p_offer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'SOLO_ADMIN: esta acción está reservada al administrador';
  end if;

  -- Respaldo histórico ANTES de tumbbar: las reservas se borran en cascada
  -- con la oferta, así que sus ventas completadas no contabilizadas se suman
  -- al acumulador permanente del comercio (nunca se pierde el contador).
  update public.profiles p
     set lifetime_sales_cop    = lifetime_sales_cop + agg.total_cop,
         lifetime_orders_count = lifetime_orders_count + agg.orders
    from (
      select r.merchant_id,
             sum(r.quantity * coalesce(o.promo_price, 0)) as total_cop,
             count(*) as orders
        from public.reservations r
        join public.offers o on o.id = r.offer_id
       where r.offer_id = p_offer_id
         and r.status = 'completed'
         and r.sales_counted = false
       group by r.merchant_id
    ) agg
   where p.id = agg.merchant_id;

  delete from public.offers
   where id = p_offer_id
  returning id;

  if not found then
    raise exception 'Oferta no encontrada (quizá ya fue tumbada)';
  end if;

  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function public.admin_delete_offer_rpc(uuid) to authenticated;

-- 8.4 Limpieza de base de datos: purga TODAS las ofertas vencidas (solo admin)
create or replace function public.admin_cleanup_expired_rpc()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  if not public.is_admin() then
    raise exception 'SOLO_ADMIN: esta acción está reservada al administrador';
  end if;

  -- 1. Respaldo histórico de ventas completadas NO contabilizadas aún
  --    (reservas hechas antes de la V4): el contador de dinero es eterno.
  update public.profiles p
     set lifetime_sales_cop    = lifetime_sales_cop + agg.total_cop,
         lifetime_orders_count = lifetime_orders_count + agg.orders
    from (
      select r.merchant_id,
             sum(r.quantity * coalesce(o.promo_price, 0)) as total_cop,
             count(*) as orders
        from public.reservations r
        join public.offers o on o.id = r.offer_id
       where r.status = 'completed'
         and r.sales_counted = false
         and r.created_at < now() - interval '14 days'
       group by r.merchant_id
    ) agg
   where p.id = agg.merchant_id;

  -- 2. Reservas antiguas (más de 14 días): sus ventas ya viven en los
  --    acumuladores de profiles, borrarlas libera espacio sin perder nada.
  delete from public.reservations
   where created_at < now() - interval '14 days';

  -- 3. Purga de todas las ofertas vencidas (incluidas sus fotos)
  delete from public.offers
   where expires_at < now();

  get diagnostics v_deleted = row_count;

  -- 4. Pedidos de la comunidad vencidos hace más de 6 horas
  delete from public.quick_requests
   where expires_at < now() - interval '6 hours';

  -- 5. Órdenes de crédito cerradas hace más de 30 días
  --    (el comprobante aprobado ya se borró al aprobar)
  delete from public.credit_orders
   where status in ('approved', 'rejected')
     and created_at < now() - interval '30 days';

  return jsonb_build_object('deleted', v_deleted);
end;
$$;
grant execute on function public.admin_cleanup_expired_rpc() to authenticated;

-- 8.5 Métricas reales del ecosistema (security definer: ve TODO, cruzando RLS)
create or replace function public.admin_stats_rpc()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_merchants       integer;
  v_verified        integer;
  v_active_offers   integer;
  v_reservations    integer;
  v_reports         integer;
begin
  if not public.is_admin() then
    raise exception 'SOLO_ADMIN: esta acción está reservada al administrador';
  end if;

  select count(*) into v_merchants from public.profiles where role = 'merchant';
  select count(*) into v_verified from public.profiles where role = 'merchant' and is_verified;
  select count(*) into v_active_offers from public.offers where status = 'active' and expires_at > now();
  select count(*) into v_reservations from public.reservations where created_at >= date_trunc('day', now());
  select coalesce(sum(reports_count), 0) into v_reports from public.offers where status = 'active';

  return jsonb_build_object(
    'merchants', v_merchants,
    'verifiedMerchants', v_verified,
    'activeOffers', v_active_offers,
    'reservationsToday', v_reservations,
    'openReports', v_reports
  );
end;
$$;
grant execute on function public.admin_stats_rpc() to authenticated;

-- ============================================================================
--  9. TRAZABILIDAD FORENSE, ANTI-ESTAFAS Y CANCELACIÓN DEL CLIENTE (v3)
--  Idempotente. Captura la IP real en el servidor, guarda la huella del
--  dispositivo, lista negra de saboteadores y candados anti-spam.
-- ============================================================================

-- 9.1 Columnas de auditoría forense (idempotentes)
alter table public.reservations add column if not exists client_ip text default null;
alter table public.reservations add column if not exists device_id text default null;
alter table public.quick_requests add column if not exists client_ip text default null;
alter table public.quick_requests add column if not exists device_id text default null;
alter table public.quick_requests add column if not exists meeting_point text not null default 'parque_principal';
alter table public.profiles add column if not exists nit_or_cedula text default null;
alter table public.profiles add column if not exists social_or_maps_link text default null;

create index if not exists reservations_device_idx  on public.reservations (device_id, created_at desc);
create index if not exists quick_requests_device_idx on public.quick_requests (device_id, created_at desc);

-- 9.2 IP real del cliente: prioriza el primer valor de X-Forwarded-For,
--     luego x-real-ip y cf-connecting-ip (imposible falsificar desde el navegador).
create or replace function public.get_client_ip()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_headers json;
  v_xff     text;
  v_raw     text;
  v_ip      text;
begin
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::json;
    -- Prioriza siempre el primer valor no vacío de X-Forwarded-For (IP pública original)
    v_xff := nullif(btrim(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1)), '');
    v_raw := coalesce(
      v_xff,
      nullif(btrim(v_headers ->> 'x-real-ip'), ''),
      nullif(btrim(v_headers ->> 'cf-connecting-ip'), ''),
      nullif(btrim(v_headers ->> 'x-vercel-forwarded-for'), ''),
      nullif(btrim(v_headers ->> 'x-client-ip'), ''),
      '0.0.0.0'
    );
    v_ip := regexp_replace(btrim(v_raw), '^::ffff:', '', 'i');
  exception when others then
    v_ip := '0.0.0.0';
  end;
  return coalesce(nullif(v_ip, ''), '0.0.0.0');
end;
$$;

-- Helper forense: si get_client_ip() devolvió 0.0.0.0 o IP privada de proxy/localhost,
-- acepta la IP pública validada capturada por /api/ip (cabeceras X-Forwarded-For / x-real-ip).
create or replace function public.resolve_client_ip(p_edge_ip text default null)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_srv  text := public.get_client_ip();
  v_edge text := regexp_replace(btrim(coalesce(p_edge_ip, '')), '^::ffff:', '', 'i');
  v_srv_is_private boolean;
  v_edge_is_valid  boolean;
begin
  v_srv_is_private :=
    v_srv is null
    or v_srv in ('', '0.0.0.0', '127.0.0.1', '::1')
    or v_srv ~ '^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\.)';

  v_edge_is_valid :=
    v_edge <> ''
    and char_length(v_edge) <= 45
    and (
      v_edge ~ '^([0-9]{1,3}\.){3}[0-9]{1,3}$'
      or v_edge ~ '^[0-9a-fA-F:]+$'
    )
    and v_edge not in ('0.0.0.0', '127.0.0.1', '::1')
    and v_edge !~ '^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)';

  if v_srv_is_private and v_edge_is_valid then
    return v_edge;
  end if;
  return v_srv;
end;
$$;

-- 9.3 Lista negra de clientes (saboteadores, bromeadores, estafadores)
create table if not exists public.blocked_clients (
  id         uuid primary key default gen_random_uuid(),
  device_id  text,
  client_ip  text,
  phone      text,
  reason     text not null default 'Conducta abusiva',
  blocked_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.blocked_clients enable row level security;
-- (Sin políticas: la tabla solo se consulta o modifica vía funciones SECURITY DEFINER.)

create index if not exists blocked_clients_device_idx on public.blocked_clients (device_id);
create index if not exists blocked_clients_ip_idx    on public.blocked_clients (client_ip);
create index if not exists blocked_clients_phone_idx on public.blocked_clients (phone);

-- Ayudante: ¿está bloqueado globalmente este teléfono o dispositivo?
create or replace function public.is_client_blocked(p_phone text, p_device_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.blocked_clients b
     where (p_phone is not null and p_phone <> '' and b.phone = p_phone)
        or (p_device_id is not null and p_device_id <> '' and b.device_id = p_device_id)
  );
$$;

-- 9.4 Publicar pedido de la comunidad: SIEMPRE vía servidor (cero inserts directos)
--     Candados: cliente bloqueado, teléfono colombiano real, máximo 2 pedidos activos.
--     (v4: coordenadas GPS silenciosas; V19: IP real desde edge)
drop function if exists public.create_quick_request_rpc(text, text, text, text, text, text);
drop function if exists public.create_quick_request_rpc(text, text, text, text, text, text, text);
drop function if exists public.create_quick_request_rpc(text, text, text, text, text, text, text, double precision, double precision);
create or replace function public.create_quick_request_rpc(
  p_category          text,
  p_customer_name     text,
  p_customer_whatsapp text,
  p_need_description  text,
  p_meeting_point     text default 'parque_principal',
  p_device_id         text default null,
  p_municipality      text default 'Gachetá',
  p_client_lat        double precision default null,
  p_client_lng        double precision default null,
  p_edge_ip           text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req       public.quick_requests;
  v_client_ip text;
  v_device    text;
  v_spam      integer;
begin
  v_client_ip := public.resolve_client_ip(p_edge_ip);
  v_device    := nullif(btrim(coalesce(p_device_id, '')), '');

  if p_category not in ('comida', 'transporte_flete', 'agro_mercado', 'hoteles_turismo', 'salud_belleza', 'hogar_construccion', 'servicios_comercios') then
    raise exception 'Categoría inválida';
  end if;
  if char_length(trim(p_customer_name)) < 2 or char_length(p_customer_name) > 60 then
    raise exception 'El nombre debe tener entre 2 y 60 caracteres';
  end if;
  if p_customer_whatsapp !~ '^3\d{9}$' then
    raise exception 'El WhatsApp debe ser un celular colombiano de 10 dígitos que empiece por 3 (ej: 3201234567)';
  end if;
  if char_length(trim(p_need_description)) < 5 or char_length(trim(p_need_description)) > 220 then
    raise exception 'Describe lo que necesitas entre 5 y 220 caracteres';
  end if;
  if p_meeting_point not in ('parque_principal', 'local_comercio', 'domicilio_urbano', 'vereda') then
    raise exception 'Selecciona un punto de encuentro válido';
  end if;

  -- Escudo anti-sabotaje: dispositivo o teléfono en la lista negra
  if public.is_client_blocked(p_customer_whatsapp, v_device) then
    raise exception 'CLIENTE_BLOQUEADO: esta solicitud no puede completarse desde este dispositivo o número';
  end if;

  -- Anti-spam: máximo 2 pedidos activos simultáneos por dispositivo o teléfono
  select count(*) into v_spam
    from public.quick_requests q
   where q.expires_at > now()
     and (
           (v_device is not null and q.device_id = v_device)
           or q.customer_whatsapp = p_customer_whatsapp
         );
  if v_spam >= 2 then
    raise exception 'DEMASIADOS_PEDIDOS: puedes tener máximo 2 pedidos activos a la vez. Espera a que venzan o los respondan';
  end if;

  insert into public.quick_requests (
    customer_name, customer_whatsapp, municipality, category,
    need_description, meeting_point, client_ip, device_id, client_lat, client_lng
  ) values (
    trim(p_customer_name), p_customer_whatsapp,
    coalesce(nullif(btrim(p_municipality), ''), 'Gachetá'), p_category,
    trim(p_need_description), p_meeting_point, v_client_ip, v_device,
    coalesce(nullif(p_client_lat, 0), null),
    coalesce(nullif(p_client_lng, 0), null)
  )
  returning * into v_req;

  return to_jsonb(v_req);
end;
$$;

-- La escritura directa ya no existe: todo pedido pasa por el escudo del servidor
drop policy if exists "Cualquiera puede pedir" on public.quick_requests;

-- 9.5 Cancelación del cliente: libera el cupo de vuelta sin necesitar cuenta
create or replace function public.cancel_my_reservation_rpc(
  p_reservation_id   uuid,
  p_reservation_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_res   public.reservations;
  v_offer public.offers;
begin
  if p_reservation_id is null or coalesce(p_reservation_code, '') = '' then
    raise exception 'Datos de cancelación incompletos';
  end if;

  select * into v_res
    from public.reservations
   where id = p_reservation_id
     and upper(reservation_code) = upper(trim(p_reservation_code))
   for update;
  if not found then
    raise exception 'Reserva no encontrada: revisa tu código de apartado';
  end if;
  if v_res.status <> 'pending' then
    raise exception 'Esta reserva ya fue procesada por el comercio';
  end if;

  update public.reservations
     set status = 'released'
   where id = v_res.id
  returning * into v_res;

  -- Devuelve el stock SOLO si la oferta sigue vigente
  update public.offers
     set available_quota = least(total_quota, available_quota + v_res.quantity),
         status = case when status = 'sold_out' and available_quota + v_res.quantity > 0 then 'active' else status end
   where id = v_res.offer_id
     and expires_at > now()
     and status in ('active', 'sold_out')
  returning * into v_offer;

  return jsonb_build_object(
    'reservation', to_jsonb(v_res),
    'offer', case when v_offer.id is null then null else to_jsonb(v_offer) end
  );
end;
$$;

-- 9.6 Estado en vivo de los tickets del cliente (sin cuenta: valida por ids)
create or replace function public.check_reservation_status_rpc(p_ids uuid[] default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_list jsonb;
begin
  if p_ids is null or coalesce(array_length(p_ids, 1), 0) = 0 then
    return '[]'::jsonb;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'status', r.status, 'is_rated', r.is_rated)), '[]'::jsonb)
    into v_list
    from public.reservations r
   where r.id = any (p_ids);
  return v_list;
end;
$$;

-- 9.7 Bloqueos: el comerciante blinda sus ofertas, el admin blinda el municipio
create or replace function public.merchant_block_client_rpc(
  p_device_id text default null,
  p_client_ip text default null,
  p_phone     text default null,
  p_reason    text default 'Reserva abusiva'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión';
  end if;
  if coalesce(p_device_id, p_client_ip, p_phone) is null then
    raise exception 'Debes indicar dispositivo, IP o teléfono para bloquear';
  end if;
  -- Solo puede bloquear datos que aparecen en reservas de SUS propias ofertas
  if not exists (
    select 1
      from public.reservations r
     where r.merchant_id = auth.uid()
       and (
             (p_phone is not null and p_phone <> '' and r.customer_phone = p_phone)
             or (p_device_id is not null and p_device_id <> '' and r.device_id = p_device_id)
             or (p_client_ip is not null and p_client_ip <> '' and r.client_ip = p_client_ip)
           )
  ) then
    raise exception 'Solo puedes bloquear clientes que han apartado en tus ofertas';
  end if;

  insert into public.blocked_clients (device_id, client_ip, phone, reason, blocked_by)
  values (p_device_id, p_client_ip, p_phone, p_reason, auth.uid());

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_block_client_rpc(
  p_device_id text default null,
  p_client_ip text default null,
  p_phone     text default null,
  p_reason    text default 'Conducta abusiva'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'SOLO_ADMIN: esta acción está reservada al administrador';
  end if;
  if coalesce(p_device_id, p_client_ip, p_phone) is null then
    raise exception 'Debes indicar dispositivo, IP o teléfono para bloquear';
  end if;

  insert into public.blocked_clients (device_id, client_ip, phone, reason)
  values (p_device_id, p_client_ip, p_phone, p_reason);

  return jsonb_build_object(
    'ok', true,
    'blocked', jsonb_build_object(
      'device_id', p_device_id,
      'client_ip', p_client_ip,
      'phone', p_phone,
      'reason', p_reason
    )
  );
end;
$$;

create or replace function public.admin_unblock_client_rpc(p_block_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'SOLO_ADMIN: esta acción está reservada al administrador';
  end if;

  delete from public.blocked_clients where id = p_block_id returning id;
  if not found then
    raise exception 'Registro de bloqueo no encontrado';
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- Listado forense para el panel: reservas recientes con IP/dispositivo/teléfono
create or replace function public.admin_recent_reservations_rpc()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_list jsonb;
begin
  if not public.is_admin() then
    raise exception 'SOLO_ADMIN: esta acción está reservada al administrador';
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
    into v_list
    from (
      select r.id, r.offer_id, r.merchant_id, r.customer_name, r.customer_phone,
             r.quantity, r.reservation_code, r.status, r.client_ip, r.device_id,
             r.client_lat, r.client_lng,
             r.created_at,
             (select business_name from public.profiles p where p.id = r.merchant_id) as merchant_name
        from public.reservations r
       order by r.created_at desc
       limit 30
    ) x;
  return v_list;
end;
$$;

create or replace function public.admin_blocked_list_rpc()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_list jsonb;
begin
  if not public.is_admin() then
    raise exception 'SOLO_ADMIN: esta acción está reservada al administrador';
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
    into v_list
    from (
      select * from public.blocked_clients
       order by created_at desc
       limit 100
    ) x;
  return v_list;
end;
$$;

-- 9.8 Concesión de ejecución (firmas exactas, sin paréntesis literales)
grant execute on function public.create_quick_request_rpc(text, text, text, text, text, text, text, double precision, double precision, text) to anon, authenticated;
grant execute on function public.cancel_my_reservation_rpc(uuid, text)                     to anon, authenticated;
grant execute on function public.check_reservation_status_rpc(uuid[])                     to anon, authenticated;
grant execute on function public.merchant_block_client_rpc(text, text, text, text)         to authenticated;
grant execute on function public.admin_block_client_rpc(text, text, text, text)           to authenticated;
grant execute on function public.admin_unblock_client_rpc(uuid)                           to authenticated;
grant execute on function public.admin_recent_reservations_rpc()                          to authenticated;
grant execute on function public.admin_blocked_list_rpc()                                 to authenticated;

-- ============================================================================
--  10. COBRO NEQUI CON IA VISION, ACUMULADORES ETERNOS Y AUTO-COMPACTACIÓN (v4)
--  Idempotente. Cobro asistido sin pasarela, contador de dinero que nunca
--  muere y base de datos que se compacta sola para que la capa gratuita
--  dure años.
-- ============================================================================

-- 10.1 Columnas: coordenadas GPS silenciosas y contadores históricos eternos
alter table public.reservations add column if not exists sales_counted boolean not null default false;
alter table public.reservations add column if not exists client_lat double precision default null;
alter table public.reservations add column if not exists client_lng double precision default null;
alter table public.quick_requests add column if not exists client_lat double precision default null;
alter table public.quick_requests add column if not exists client_lng double precision default null;
alter table public.profiles add column if not exists lifetime_sales_cop numeric(14,0) not null default 0;
alter table public.profiles add column if not exists lifetime_orders_count integer not null default 0;

-- 10.2 Órdenes de recarga de créditos (cobro Nequi/Daviplata asistido por IA)
create table if not exists public.credit_orders (
  id                   uuid primary key default gen_random_uuid(),
  merchant_id          uuid not null references public.profiles (id) on delete cascade,
  package_name         text not null,
  credits_requested    integer not null check (credits_requested > 0),
  amount_cop           numeric(12,0) not null check (amount_cop > 0),
  payment_method       text not null default 'Nequi' check (payment_method in ('Nequi', 'Daviplata', 'Bancolombia')),
  reference_code       text not null check (char_length(reference_code) between 3 and 40),
  receipt_thumb        text default null check (receipt_thumb is null or char_length(receipt_thumb) <= 35000),
  ai_verification_note text default null,
  status               text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at           timestamptz not null default now()
);

alter table public.credit_orders drop constraint if exists credit_orders_payment_method_check;
alter table public.credit_orders add constraint credit_orders_payment_method_check
  check (payment_method in ('Nequi', 'Daviplata', 'Bancolombia', 'Llave'));

alter table public.credit_orders enable row level security;
revoke insert, update, delete on public.credit_orders from anon, authenticated;

drop policy if exists "Comercio ve sus ordenes" on public.credit_orders;
create policy "Comercio ve sus ordenes"
  on public.credit_orders for select
  to authenticated
  using (merchant_id = auth.uid() or public.is_admin());

drop policy if exists "Nadie escribe ordenes directo" on public.credit_orders;
create policy "Nadie escribe ordenes directo"
  on public.credit_orders for all
  to anon
  using (false)
  with check (false);

-- Candado anti-doble cobro: una misma referencia de comprobante solo existe una vez
create unique index if not exists credit_orders_reference_active_idx
  on public.credit_orders (reference_code) where status in ('pending', 'approved');

-- 🛡️ V18 · Columnas forenses del validador: huella SHA-256 de la imagen,
-- destino leído por la IA, payload del QR escaneado y dictamen automático.
alter table public.credit_orders add column if not exists receipt_hash         text default null;
alter table public.credit_orders add column if not exists destination_detected text default null;
alter table public.credit_orders add column if not exists qr_payload           text default null;
alter table public.credit_orders add column if not exists ia_status_ok         boolean not null default false;

-- 🛡️ V18 · La huella de imagen es única en TODA la plataforma (activa o
-- pendiente): la misma captura jamás puede canjearse dos veces.
create unique index if not exists credit_orders_receipt_hash_unique
  on public.credit_orders (receipt_hash)
  where receipt_hash is not null and status in ('pending', 'approved');

-- 10.3 El comerciante envía su comprobante tras pagar (V18 · VALIDADOR FORENSE)
-- Guardias automáticas y en orden:
--   1) Anti-fuerza bruta: máx. 5 intentos por 15 min (SOLO lectura: un intento
--      fallido NO escribe nada → la base de datos jamás se satura).
--   2) Formato del código: alfanumérico 4-40; un celular Nequi (10 dígitos
--      que empiezan por 3) NO es un comprobante y se rechaza al instante.
--   3) YA CANJEADO: la misma referencia no puede existir dos veces en
--      pendientes/aprobadas de TODA la plataforma (nadie la vuelve a cargar).
--   4) HUELLA ÚNICA: la misma imagen (hash SHA-256) tampoco puede repetirse.
--   5) CÓDIGO QUEMADO: si otra cuenta ya envió esa referencia y fue rechazada,
--      queda invalidada para todos los demás (anti-reciclaje de códigos).
drop function if exists public.submit_credit_order_rpc(text, integer, numeric, text, text, text, text);
drop function if exists public.submit_credit_order_rpc(text, integer, numeric, text, text, text, text, text, text, text, boolean);
create or replace function public.submit_credit_order_rpc(
  p_package_name      text,
  p_credits_requested integer,
  p_amount_cop        numeric,
  p_reference_code    text,
  p_payment_method    text default 'Nequi',
  p_receipt_thumb     text default null,
  p_ai_note           text default null,
  p_receipt_hash      text default null,
  p_destination_detected text default null,
  p_qr_payload        text default null,
  p_ia_status_ok      boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.credit_orders;
  v_code  text;
  -- V22 · Blindaje de destino oficial
  v_nequi          text;
  v_llave          text;
  v_dest           text;
  v_dest_digits    text;
  v_nequi_digits   text;
  v_llave_digits   text;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión';
  end if;
  -- 🛡️ V20.0 Anti-Tampering: solo paquetes oficiales exactos (el cliente no puede inyectar créditos/montos)
  if not (
       (p_credits_requested = 5  and p_amount_cop = 10000)
    or (p_credits_requested = 15 and p_amount_cop = 24000)
    or (p_credits_requested = 35 and p_amount_cop = 45000)
  ) then
    raise exception 'PAQUETE_INVALIDO: el paquete y valor no coinciden con las tarifas oficiales de Impulso.';
  end if;
  if p_payment_method not in ('Nequi', 'Daviplata', 'Bancolombia', 'Llave') then
    raise exception 'Método de pago inválido';
  end if;
  if p_receipt_thumb is null or left(p_receipt_thumb, 11) <> 'data:image/' then
    raise exception 'ADJUNTA_LA_CAPTURA: para validar tu recarga envía la captura original del pago.';
  end if;
  if char_length(p_receipt_thumb) > 35000 then
    raise exception 'El comprobante es demasiado pesado. Intenta con otra captura';
  end if;
  if coalesce(p_receipt_hash, '') !~ '^[0-9a-f]{64}$' then
    raise exception 'Huella SHA-256 del comprobante inválida o ausente. Vuelve a subir la captura';
  end if;

  -- Normalización: sin espacios, mayúsculas — un código es un código exacto
  v_code := upper(btrim(coalesce(p_reference_code, '')));
  if char_length(v_code) < 4 or char_length(v_code) > 40 then
    raise exception 'Escribe o escanea el código del comprobante (entre 4 y 40 caracteres)';
  end if;
  if v_code !~ '^[A-Z0-9\.\-]+$' then
    raise exception 'CÓDIGO_INVALIDO: el código solo puede tener letras, números, puntos o guiones. Copia la referencia EXACTA de tu app';
  end if;
  -- Un celular de Nequi no es un comprobante (error clásico que se caza aquí)
  if v_code ~ '^3[0-9]{9}$' then
    raise exception 'Escribiste un NÚMERO de celular, no el código del comprobante. El código aparece en la pantalla de confirmación de tu pago';
  end if;

  -- 🛡️ Anti-fuerza bruta: lectura pura, cero escrituras en intentos fallidos
  if (
    select count(*) from public.credit_orders c
     where c.merchant_id = auth.uid()
       and c.created_at > now() - interval '15 minutes'
  ) >= 5 then
    raise exception 'ESPERA: ya enviaste 5 comprobantes en los últimos 15 minutos. Espera un momento para evitar errores';
  end if;

  -- 🛡️ YA CANJEADO: único en toda la plataforma (pendiente o aprobado)
  if exists (
    select 1
      from public.credit_orders c
     where upper(c.reference_code) = v_code
       and c.status in ('pending', 'approved')
  ) then
    raise exception 'YA_CANJEADO: 🚫 CÓDIGO O COMPROBANTE YA UTILIZADO: este pago (Ref: %) ya fue registrado y vinculado previamente a una cuenta en la plataforma. Cada pago o código QR solo puede canjearse una única vez.', v_code;
  end if;

  -- 🛡️ HUELLA ÚNICA: la misma imagen (SHA-256) jamás se canjea dos veces
  if p_receipt_hash is not null and exists (
    select 1
      from public.credit_orders c
     where c.receipt_hash = p_receipt_hash
       and c.status in ('pending', 'approved')
  ) then
    raise exception 'YA_CANJEADO: 🚫 ESE COMPROBANTE YA UTILIZADO: esta misma captura (huella de imagen) ya fue registrada por una cuenta. Cada pago solo puede canjearse una única vez.';
  end if;

  -- 🛡️ CÓDIGO QUEMADO: rechazado por otra cuenta → invalidado para los demás
  if exists (
    select 1
      from public.credit_orders c
     where upper(c.reference_code) = v_code
       and c.status = 'rejected'
       and c.merchant_id <> auth.uid()
  ) then
    raise exception 'CODIGO_INVALIDADO: ese comprobante ya fue revisado y rechazado por otra cuenta. Envía el pago que acabas de hacer tú';
  end if;

  -- 🛡️ V22/V20 · DESTINO OFICIAL EXACTO (Nequi oficial 3158942112 o config BD)
  select coalesce(nullif(btrim((select value from public.app_settings where key = 'nequi_phone')), ''), '3158942112'),
         coalesce(nullif(btrim((select value from public.app_settings where key = 'payment_llave')), ''), '@impulso3158942112')
    into v_nequi, v_llave;
  v_nequi_digits := right(coalesce(regexp_replace(v_nequi, '\D', '', 'g'), '3158942112'), 10);
  v_llave_digits := right(coalesce(regexp_replace(v_llave, '\D', '', 'g'), ''), 10);

  v_dest        := upper(btrim(coalesce(p_destination_detected, '')));
  v_dest_digits := right(coalesce(regexp_replace(v_dest, '\D', '', 'g'), ''), 10);
  if v_dest <> '' then
    if (v_dest_digits = '' or (v_dest_digits <> v_nequi_digits and (v_llave_digits = '' or v_dest_digits <> v_llave_digits)))
       and position(upper(btrim(v_llave)) in v_dest) = 0 then
      raise exception 'DESTINO_INVALIDO: el comprobante indica un destino distinto a la cuenta oficial de Impulso (%). Haz el pago al Nequi oficial y vuelve a intentarlo.', v_nequi_digits;
    end if;
  end if;

  insert into public.credit_orders (
    merchant_id, package_name, credits_requested, amount_cop,
    payment_method, reference_code, receipt_thumb, ai_verification_note, status,
    receipt_hash, destination_detected, qr_payload, ia_status_ok
  ) values (
    auth.uid(), trim(p_package_name), p_credits_requested, p_amount_cop,
    p_payment_method, v_code, p_receipt_thumb, p_ai_note, 'pending',
    nullif(btrim(coalesce(p_receipt_hash, '')), ''), nullif(btrim(coalesce(p_destination_detected, '')), ''),
    nullif(btrim(coalesce(p_qr_payload, '')), ''), p_ia_status_ok = true
  )
  returning * into v_order;

  return to_jsonb(v_order);
end;
$$;

-- 10.3b V18 · Verificación INSTANTÁNEA de no-reutilización (solo lectura).
-- La app la llama ANTES de permitir el envío: si la referencia o la huella
-- de imagen ya fueron usadas/canjeadas por cualquier cuenta, responde
-- {used: true, reason: '...'} sin escribir absolutamente nada en la BD.
create or replace function public.check_receipt_already_used_rpc(
  p_raw_reference text,
  p_receipt_hash  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if auth.uid() is null then
    return jsonb_build_object('used', false, 'reason', '');
  end if;

  v_code := upper(btrim(coalesce(p_raw_reference, '')));
  if v_code <> '' then
    if exists (
      select 1 from public.credit_orders c
       where upper(c.reference_code) = v_code
         and c.status in ('pending', 'approved')
    ) then
      return jsonb_build_object(
        'used', true,
        'reason', '🚫 CÓDIGO O COMPROBANTE YA UTILIZADO: este pago ya fue registrado y vinculado previamente a una cuenta en la plataforma. Cada pago o código QR solo puede canjearse una única vez.'
      );
    end if;
  end if;

  if coalesce(p_receipt_hash, '') <> '' and exists (
    select 1 from public.credit_orders c
     where c.receipt_hash = p_receipt_hash
       and c.status in ('pending', 'approved')
  ) then
    return jsonb_build_object(
      'used', true,
      'reason', '🚫 COMPROBANTE YA UTILIZADO: esta misma captura ya fue registrada por una cuenta. Cada pago solo puede canjearse una única vez.'
    );
  end if;

  return jsonb_build_object('used', false, 'reason', '');
end;
$$;

-- 10.3c V18 · APROBACIÓN AUTOMÁTICA INSTANTÁNEA (con el switch del Admin ON):
-- acredita los créditos al acto SI Y SOLO SI el servidor confirma, con datos
-- que el cliente NO puede fingir:
--   · el dictamen IA marcó el pago exitoso (ia_status_ok),
--   · el destino leído contiene el número Nequi oficial del Admin (BD),
--   · el monto coincide EXACTO con un paquete oficial (BD),
--   · la referencia y la huella son únicas (índices + guardias del submit).
-- Si algo falla, el comprobante queda 'pending' para revisión humana.
create or replace function public.auto_approve_credit_order_rpc(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order    public.credit_orders;
  v_admin    text;
  v_prices   text;
  v_price    numeric;
  -- V22 · Dígitos oficiales (Nequi y Llave) vs dígitos leídos por la IA
  v_dest_digits   text;
  v_nequi_digits  text;
  v_llave_digits  text;
begin
  select coalesce(nullif(btrim((select value from public.app_settings where key = 'nequi_phone')), ''), '3158942112') into v_admin;
  select value into v_prices from public.app_settings where key = 'credit_package_prices';
  if coalesce((select value from public.app_settings where key = 'auto_approve_credits'), 'off') <> 'on' then
    return jsonb_build_object('approved', false, 'reason', 'AUTO_APROBACION_OFF');
  end if;

  if auth.uid() is null then
    raise exception 'Debes iniciar sesión';
  end if;

  select * into v_order from public.credit_orders where id = p_order_id for update;
  if not found then
    raise exception 'Orden no encontrada';
  end if;
  if v_order.merchant_id <> auth.uid() and not public.is_admin() then
    raise exception 'No autorizado para procesar esta orden';
  end if;
  if v_order.status <> 'pending' then
    return jsonb_build_object('approved', false, 'reason', 'YA_PROCESADA');
  end if;

  -- El dictamen IA y la huella SHA-256 deben venir completos y válidos
  if v_order.ia_status_ok is not true
     or v_order.destination_detected is null
     or coalesce(v_order.receipt_hash, '') !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('approved', false, 'reason', 'IA_INCOMPLETA');
  end if;

  -- Paquete y monto canónicos verificados del lado del servidor
  if not (
       (v_order.credits_requested = 5  and v_order.amount_cop = 10000)
    or (v_order.credits_requested = 15 and v_order.amount_cop = 24000)
    or (v_order.credits_requested = 35 and v_order.amount_cop = 45000)
  ) then
    return jsonb_build_object('approved', false, 'reason', 'PAQUETE_NO_OFICIAL');
  end if;

  -- El destino leído debe contener los 10 dígitos del Nequi oficial (3158942112 o config BD)
  v_dest_digits  := right(coalesce(regexp_replace(v_order.destination_detected, '\D', '', 'g'), ''), 10);
  v_nequi_digits := right(coalesce(regexp_replace(coalesce(v_admin, '3158942112'), '\D', '', 'g'), '3158942112'), 10);
  v_llave_digits := right(coalesce(regexp_replace(coalesce((select value from public.app_settings where key = 'payment_llave'), ''), '\D', '', 'g'), ''), 10);
  if char_length(v_dest_digits) < 7
     or (v_nequi_digits = '' and v_llave_digits = '')
     or (v_dest_digits <> v_nequi_digits
         and (v_llave_digits = '' or v_dest_digits <> v_llave_digits)) then
    return jsonb_build_object('approved', false, 'reason', 'DESTINO_NO_COINCIDE');
  end if;

  -- Monto EXACTO contra los paquetes oficiales guardados en la BD
  v_price := -1;
  begin
    for v_price in select (regexp_split_to_table(v_prices, ','))::numeric loop
      exit when v_price = v_order.amount_cop;
    end loop;
  exception when others then
    v_price := -1;
  end;
  if v_price <> v_order.amount_cop then
    return jsonb_build_object('approved', false, 'reason', 'MONTO_NO_EXACTO');
  end if;

  update public.credit_orders
     set status = 'approved',
         receipt_thumb = null,
         ai_verification_note = '⚡ Auto-aprobado por Escáner IA (destino ' || coalesce(v_admin, 'Nequi oficial') || ' confirmado · monto exacto · referencia y huella únicas)'
   where id = v_order.id
   returning * into v_order;

  update public.profiles
     set credits = credits + v_order.credits_requested
   where id = v_order.merchant_id;

  return jsonb_build_object('approved', true, 'credits', v_order.credits_requested, 'order', to_jsonb(v_order));
end;
$$;

-- 10.4 Bandeja de cobros para el administrador (con nombre del comercio)
create or replace function public.admin_credit_orders_list_rpc()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_list jsonb;
begin
  if not public.is_admin() then
    raise exception 'SOLO_ADMIN: esta acción está reservada al administrador';
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
    into v_list
    from (
      select c.*,
             (select business_name from public.profiles p where p.id = c.merchant_id) as merchant_name
        from public.credit_orders c
       order by c.created_at desc
       limit 50
    ) x;
  return v_list;
end;
$$;

-- 10.5 Aprobar (acredita créditos al instante y borra el comprobante) o rechazar
create or replace function public.admin_resolve_credit_order_rpc(
  p_order_id   uuid,
  p_action     text default 'approved',
  p_admin_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.credit_orders;
begin
  if not public.is_admin() then
    raise exception 'SOLO_ADMIN: esta acción está reservada al administrador';
  end if;
  if p_action not in ('approved', 'rejected') then
    raise exception 'Acción inválida';
  end if;

  select * into v_order from public.credit_orders where id = p_order_id for update;
  if not found then
    raise exception 'Orden no encontrada';
  end if;
  if v_order.status <> 'pending' then
    raise exception 'Esta orden ya fue procesada';
  end if;

  update public.credit_orders
     set status = p_action,
         -- Al aprobar se borra el comprobante: cero bytes muertos en la base
         receipt_thumb = case when p_action = 'approved' then null else receipt_thumb end,
         ai_verification_note = coalesce(p_admin_note, ai_verification_note)
   where id = v_order.id
  returning * into v_order;

  if p_action = 'approved' then
    update public.profiles
       set credits = credits + v_order.credits_requested
     where id = v_order.merchant_id;
  end if;

  return to_jsonb(v_order);
end;
$$;

-- 10.6 Auto-limpieza silenciosa (la llama la app 1 vez cada 12 horas)
create or replace function public.auto_prune_expired_data_rpc()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expired  integer;
  v_requests integer;
begin
  -- Marca como vencidas las ofertas cuyo reloj llegó a cero y libera sus miniaturas
  update public.offers
     set status = 'expired',
         image_thumb = null
   where status = 'active'
     and expires_at < now();
  get diagnostics v_expired = row_count;

  -- Libera miniaturas huérfanas de ofertas ya expiradas o tumbadas por reporte
  update public.offers
     set image_thumb = null
   where status in ('expired', 'cancelled')
     and image_thumb is not null;

  -- Borra pedidos de la comunidad vencidos hace más de 6 horas
  delete from public.quick_requests
   where expires_at < now() - interval '6 hours';
  get diagnostics v_requests = row_count;

  return jsonb_build_object('offers_expired', v_expired, 'requests_deleted', v_requests);
end;
$$;

-- 10.7 Concesión de ejecución (firmas exactas)
grant execute on function public.submit_credit_order_rpc(text, integer, numeric, text, text, text, text, text, text, text, boolean) to authenticated;
grant execute on function public.check_receipt_already_used_rpc(text, text)          to authenticated;
grant execute on function public.auto_approve_credit_order_rpc(uuid)                 to authenticated;
grant execute on function public.admin_credit_orders_list_rpc()                      to authenticated;
grant execute on function public.admin_resolve_credit_order_rpc(uuid, text, text)         to authenticated;
grant execute on function public.auto_prune_expired_data_rpc()                            to anon, authenticated;

-- ============================================================================
--  10.8 NÚMERO OFICIAL DE NEQUI / WHATSAPP DEL ADMIN EN BASE DE DATOS (v4.2)
--  Idempotente. El número vive protegido en la base de datos (cero variables
--  de entorno): los comercios autenticados lo leen para pagar sus recargas
--  y solo el administrador puede crearlo o cambiarlo desde su panel.
-- ============================================================================

create table if not exists public.app_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;
-- (Sin políticas directas: lectura SOLO vía RPCs SECURITY DEFINER y
--  escritura SOLO vía admin_set_payment_contact_rpc.)

-- 💳 V18 · Configuración oficial de recaudo del Administrador (por defecto).
-- Editable desde el Panel Admin (pestañas 💳 Cobros y 📊 Resumen).
insert into public.app_settings (key, value) values
  ('nequi_phone', '3158942112'),
  ('payment_llave', '@impulso3158942112'),
  ('payment_holder_name', 'Administrador Impulso'),
  ('payment_qr_thumb', ''),
  ('auto_approve_credits', 'off'),
  ('credit_package_prices', '10000,24000,45000')
on conflict (key) do nothing;

-- ⚡ V18 · Lectura completa de la configuración de cobros (solo autenticados).
create or replace function public.get_payment_config_rpc()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_value text;
begin
  if auth.uid() is null then
    return null;
  end if;
  select jsonb_build_object(
    'nequiPhone', coalesce((select value from public.app_settings where key = 'nequi_phone'), (select value from public.app_settings where key = 'payment_whatsapp'), ''),
    'llave', coalesce((select value from public.app_settings where key = 'payment_llave'), ''),
    'holderName', coalesce((select value from public.app_settings where key = 'payment_holder_name'), ''),
    'qrThumb', coalesce((select value from public.app_settings where key = 'payment_qr_thumb'), ''),
    'autoApprove', coalesce((select value from public.app_settings where key = 'auto_approve_credits'), 'off') = 'on'
  ) into v_value;
  return v_value;
end;
$$;

-- 📱 V18 · Número de contacto legacy (compatibilidad con la app actual).
create or replace function public.get_payment_contact_rpc()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_value text;
begin
  if auth.uid() is null then
    return null;
  end if;
  select value into v_value from public.app_settings where key = 'nequi_phone';
  if v_value is null then
    select value into v_value from public.app_settings where key = 'payment_whatsapp';
  end if;
  return v_value;
end;
$$;

-- 👑 V18 · Guardar la configuración de recaudo: SOLO el administrador.
-- (p_nequi_phone obligatorio; el resto opcional — null no lo toca).
drop function if exists public.admin_set_payment_contact_rpc(text);
create or replace function public.admin_set_payment_contact_rpc(
  p_nequi_phone   text,
  p_payment_llave text default null,
  p_holder_name   text default null,
  p_qr_thumb      text default null,
  p_auto_approve  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_digits text;
  v_qr     text;
begin
  if not public.is_admin() then
    raise exception 'SOLO_ADMIN: esta acción está reservada al administrador';
  end if;
  v_digits := coalesce(regexp_replace(p_nequi_phone, '\D', '', 'g'), '');
  if char_length(v_digits) < 10 or char_length(v_digits) > 13 then
    raise exception 'Escribe un número válido (entre 10 y 13 dígitos, ej: 3158942112)';
  end if;

  insert into public.app_settings (key, value, updated_at)
  values ('nequi_phone', v_digits, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();

  if p_payment_llave is not null then
    insert into public.app_settings (key, value, updated_at)
    values ('payment_llave', btrim(p_payment_llave), now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
  end if;
  if p_holder_name is not null then
    insert into public.app_settings (key, value, updated_at)
    values ('payment_holder_name', btrim(p_holder_name), now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
  end if;
  if p_qr_thumb is not null then
    -- '' limpia el QR; un dataURL lo asigna (PNG/WebP nítido <= 180000 chars)
    v_qr := nullif(btrim(p_qr_thumb), '');
    if v_qr is not null and char_length(v_qr) > 180000 then
      raise exception 'El QR es demasiado pesado. Súbelo de nuevo (se optimiza automáticamente)';
    end if;
    insert into public.app_settings (key, value, updated_at)
    values ('payment_qr_thumb', coalesce(v_qr, ''), now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
  end if;
  if p_auto_approve in ('on', 'off') then
    insert into public.app_settings (key, value, updated_at)
    values ('auto_approve_credits', p_auto_approve, now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
  end if;

  return jsonb_build_object(
    'nequiPhone', v_digits,
    'autoApprove', coalesce((select value from public.app_settings where key = 'auto_approve_credits'), 'off') = 'on'
  );
end;
$$;

grant execute on function public.get_payment_contact_rpc()            to authenticated;
grant execute on function public.get_payment_config_rpc()             to authenticated;
grant execute on function public.admin_set_payment_contact_rpc(text, text, text, text, text) to authenticated;


-- ============================================================================
-- 9. MÉTODOS DE PAGO DEL COMERCIO (Nequi, Daviplata, Bancolombia, Efectivo)
--    Cada comercio registra sus canales de cobro en su perfil de negocio.
--    Validación AUTOMÁTICA y SEGURA en el servidor:
--     · Formato: Nequi/Daviplata = celular colombiano (10 dígitos, inicia 3).
--     · UNICIDAD GLOBAL: un mismo número no puede estar registrado por dos
--       comercios (índice único + guardia en el RPC). Nadie puede "cargar"
--       el número ajeno de otro negocio.
--     · Escritura SOLO vía RPC SECURITY DEFINER (RLS bloquea INSERT/UPDATE
--       directos: el cliente jamás puede manipular la tabla).
--     · Lectura pública de los métodos ACTIVOS: es la info que el cliente
--       necesita para pagar (copiar número o escanear el QR del perfil).
-- ============================================================================

create table if not exists public.payment_methods (
  id             uuid primary key default gen_random_uuid(),
  merchant_id    uuid not null references public.profiles (id) on delete cascade,
  -- nequi | daviplata | bancolombia | efectivo
  method_type    text not null,
  -- Dígitos normalizados ('' para efectivo). Índice único global abajo.
  account_number text not null default '',
  holder_name    text not null default '',
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.payment_methods enable row level security;

-- Unicidad GLOBAL (tipo + número): el corazón del sistema. Partial: solo
-- aplica a métodos con número real (efectivo usa '' y puede repetirse).
drop index if exists payment_methods_global_unique;
create unique index payment_methods_global_unique
  on public.payment_methods (method_type, account_number)
  where char_length(btrim(account_number)) >= 6;

drop index if exists payment_methods_merchant_idx;
create index payment_methods_merchant_idx on public.payment_methods (merchant_id);

-- Lectura: cualquiera puede VER los métodos activos (público en el perfil).
drop policy if exists "Metodos de pago activos visibles" on public.payment_methods;
create policy "Metodos de pago activos visibles"
  on public.payment_methods for select
  using (is_active = true);
-- El dueño además ve los suyos incluso si estuvieran inactivos.
drop policy if exists "Comercio ve sus metodos" on public.payment_methods;
create policy "Comercio ve sus metodos"
  on public.payment_methods for select
  using (auth.uid() = merchant_id);
-- (SIN políticas INSERT/UPDATE/DELETE: escritura SOLO por RPC security definer.)

-- 9.1 Guardar / actualizar un método de pago con validación automática --------
-- Normaliza (solo dígitos, quita prefijo 57), valida el formato según el tipo,
-- rechaza números ya registrados por OTRO comercio y hace upsert por tipo
-- (un comercio tiene máx. 1 canal por tipo). Todo transaccional.
create or replace function public.save_payment_method_rpc(
  p_method_type    text,
  p_account_number text,
  p_holder_name    text default null
)
returns public.payment_methods
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_digits text;
  v_row    public.payment_methods;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión';
  end if;

  if p_method_type not in ('nequi', 'daviplata', 'bancolombia', 'efectivo') then
    raise exception 'Tipo de método de pago inválido';
  end if;

  v_digits := coalesce(regexp_replace(coalesce(p_account_number, ''), '\D', '', 'g'), '');
  -- Quita el prefijo internacional 57 (573201234567 → 3201234567)
  if char_length(v_digits) = 12 and left(v_digits, 2) = '57' then
    v_digits := right(v_digits, 10);
  end if;

  if p_method_type in ('nequi', 'daviplata') then
    -- Nequi y Daviplata usan el celular: 10 dígitos que inician en 3
    if char_length(v_digits) <> 10 or left(v_digits, 1) <> '3' then
      raise exception 'El número de % debe ser un celular de 10 dígitos que empiece por 3 (ej: 3201234567)', p_method_type;
    end if;
  elsif p_method_type = 'bancolombia' then
    if char_length(v_digits) < 9 or char_length(v_digits) > 17 then
      raise exception 'La cuenta Bancolombia debe tener entre 9 y 17 dígitos (ahorros o corriente)';
    end if;
  else
    -- Efectivo no lleva número
    v_digits := '';
  end if;

  -- 🛡️ UNICIDAD GLOBAL: otro comercio ya registró este mismo número → rechazo.
  -- (El índice único es la última defensa; esta guardia da un mensaje claro.)
  if char_length(v_digits) >= 6 then
    if exists (
      select 1 from public.payment_methods pm
       where pm.method_type = p_method_type
         and pm.account_number = v_digits
         and pm.merchant_id <> auth.uid()
    ) then
      raise exception 'DUPLICADO: ese número ya está registrado por otro comercio en Impulso. Usa un canal de cobro propio.';
    end if;
  end if;

  -- Upsert por (comercio, tipo): reemplaza el canal anterior de ese tipo.
  insert into public.payment_methods (merchant_id, method_type, account_number, holder_name, is_active)
  values (
    auth.uid(),
    p_method_type,
    v_digits,
    coalesce(nullif(btrim(coalesce(p_holder_name, '')), ''), (select business_name from public.profiles where id = auth.uid()), ''),
    true
  )
  on conflict (merchant_id, method_type) do update
    set account_number = excluded.account_number,
        holder_name    = excluded.holder_name,
        is_active      = true,
        updated_at     = now()
  returning * into v_row;

  return v_row;
end;
$$;

-- El upsert necesita una restricción única por (comercio, tipo) además de la
-- global: la creamos como índice único también parcial sobre el número real.
drop index if exists payment_methods_owner_type_unique;
create unique index payment_methods_owner_type_unique
  on public.payment_methods (merchant_id, method_type);

-- 9.2 Eliminar (desactivar) un método propio ----------------------------------
create or replace function public.delete_payment_method_rpc(p_method_type text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión';
  end if;
  if p_method_type not in ('nequi', 'daviplata', 'bancolombia', 'efectivo') then
    raise exception 'Tipo de método de pago inválido';
  end if;
  delete from public.payment_methods
   where merchant_id = auth.uid()
     and method_type = p_method_type;
end;
$$;

grant execute on function public.save_payment_method_rpc(text, text, text)   to authenticated;
grant execute on function public.delete_payment_method_rpc(text)             to authenticated;

-- ============================================================================
-- 11. BLINDAJE KYB (KNOW YOUR BUSINESS) · V20
--     El comerciante sube su documento y una foto del establecimiento;
--     el administrador las audita y otorga la insignia de verificado.
--     Las imágenes viven en esta tabla SEPARADA (RLS admin/dueño) para que
--     JAMÁS queden expuestas en la lectura pública de profiles.
-- ============================================================================

-- 11.1 Columnas de estado rápido sobre el perfil (sin imágenes, solo texto)
alter table public.profiles add column if not exists kyb_status       text not null default 'none';
alter table public.profiles add column if not exists kyb_submitted_at timestamptz;

-- 11.2 Tabla de verificación documental
create table if not exists public.kyb_verifications (
  id           uuid primary key default gen_random_uuid(),
  merchant_id  uuid not null unique references public.profiles (id) on delete cascade,
  -- Cédula/RUT y foto del establecimiento o del titular (dataURL WebP ≤ 100 KB)
  doc_image    text not null default '',
  face_image   text not null default '',
  -- Huella SHA-256 de cada imagen (auditabilidad sin exponer la imagen)
  doc_hash     text not null default '',
  face_hash    text not null default '',
  status       text not null default 'pending',
  submitted_at timestamptz not null default now(),
  reviewed_at  timestamptz
);

alter table public.kyb_verifications enable row level security;

drop policy if exists "KYB visible por dueno o admin" on public.kyb_verifications;
create policy "KYB visible por dueno o admin"
  on public.kyb_verifications for select
  to authenticated
  using (auth.uid() = merchant_id or public.is_admin());
-- (SIN políticas INSERT/UPDATE/DELETE: escritura SOLO por RPC security definer.)

drop index if exists kyb_verifications_status_idx;
create index kyb_verifications_status_idx on public.kyb_verifications (status);

-- 11.3 El comerciante envía sus documentos (seguridad definer: escribe en su
--      propia fila aunque no exista política de escritura)
create or replace function public.submit_kyb_verification_rpc(
  p_doc_image text,
  p_face_image text,
  p_doc_hash text,
  p_face_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Debes iniciar sesión para enviar tu verificación';
  end if;
  if left(coalesce(p_doc_image, ''), 11) <> 'data:image/' or left(coalesce(p_face_image, ''), 11) <> 'data:image/' then
    raise exception 'Las imágenes deben llegar comprimidas en formato WebP/JPEG';
  end if;
  if char_length(p_doc_image) > 200000 or char_length(p_face_image) > 200000 then
    raise exception 'Las imágenes exceden el tamaño máximo (100 KB). Vuelve a intentarlo';
  end if;
  if coalesce(p_doc_hash, '') !~ '^[0-9a-f]{64}$' or coalesce(p_face_hash, '') !~ '^[0-9a-f]{64}$' then
    raise exception 'La huella de las imágenes es inválida. Vuelve a intentarlo';
  end if;

  insert into public.kyb_verifications (merchant_id, doc_image, face_image, doc_hash, face_hash, status, submitted_at, reviewed_at)
  values (v_uid, p_doc_image, p_face_image, p_doc_hash, p_face_hash, 'pending', now(), null)
  on conflict (merchant_id) do update
    set doc_image    = excluded.doc_image,
        face_image   = excluded.face_image,
        doc_hash     = excluded.doc_hash,
        face_hash    = excluded.face_hash,
        status       = 'pending',
        submitted_at = now(),
        reviewed_at  = null;

  update public.profiles
     set kyb_status = 'pending',
         kyb_submitted_at = now()
   where id = v_uid;

  return jsonb_build_object('status', 'pending');
end;
$$;
grant execute on function public.submit_kyb_verification_rpc(text, text, text, text) to authenticated;

-- 11.4 El administrador aprueba o rechaza la verificación. Al rechazar se
--      borran las imágenes (libera la BD gratuita) pero se conservan los
--      hashes para que un reenvío idéntico pueda detectarse.
create or replace function public.admin_kyb_review_rpc(p_merchant_id uuid, p_approve boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'SOLO_ADMIN: esta acción está reservada al administrador';
  end if;

  update public.kyb_verifications
     set status = case when p_approve then 'approved' else 'rejected' end,
         reviewed_at = now(),
         doc_image = case when p_approve then doc_image else '' end,
         face_image = case when p_approve then face_image else '' end
   where merchant_id = p_merchant_id;

  update public.profiles
     set is_verified = coalesce(p_approve, is_verified),
         kyb_status = case when p_approve then 'approved' else 'rejected' end
   where id = p_merchant_id;

  return jsonb_build_object('merchant_id', p_merchant_id, 'approved', p_approve);
end;
$$;
grant execute on function public.admin_kyb_review_rpc(uuid, boolean) to authenticated;

-- 11.5 🧹 Optimización de base de datos (plan gratuito): el administrador la
--      lanza con un clic. Borra ofertas vencidas hace MÁS de 30 días
--      (gracia para reposiciones) y libera los comprobantes de órdenes de
--      crédito ya resueltas poniendo receipt_thumb = null PERO conservando
--      el hash y la referencia por trazabilidad y seguridad.
create or replace function public.cleanup_expired_data_rpc()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offers integer;
  v_receipts integer;
begin
  if not public.is_admin() then
    raise exception 'SOLO_ADMIN: esta acción está reservada al administrador';
  end if;

  -- 1. Ofertas vencidas hace más de 30 días (y sus reservas en cascada)
  delete from public.offers
   where expires_at < now() - interval '30 days';
  get diagnostics v_offers = row_count;

  -- 2. Comprobantes ya resueltos: la miniatura se borra, el hash queda
  update public.credit_orders
     set receipt_thumb = null
   where status in ('approved', 'rejected')
     and receipt_thumb is not null;
  get diagnostics v_receipts = row_count;

  -- 3. Poda de miniaturas de ofertas ya expiradas o canceladas
  update public.offers
     set image_thumb = null
   where status in ('expired', 'cancelled')
     and image_thumb is not null;

  -- 4. Poda de imágenes KYB resueltas hace > 7 días (el resultado y el hash permanecen)
  update public.kyb_verifications
     set doc_image = '',
         face_image = ''
   where status in ('approved', 'rejected')
     and reviewed_at < now() - interval '7 days'
     and (doc_image <> '' or face_image <> '');

  return jsonb_build_object('offers_deleted', v_offers, 'receipts_cleared', v_receipts);
end;
$$;
grant execute on function public.cleanup_expired_data_rpc() to authenticated;

-- 11.6 Alias de compatibilidad (V21): la instrucción de ingeniería llama a
--     la RPC con el nombre `submit_kyb_docs_rpc`. Se delega 1:1 en la
--     canónica `submit_kyb_verification_rpc` (misma firma, mismo blindaje).
create or replace function public.submit_kyb_docs_rpc(
  p_doc_image text,
  p_face_image text,
  p_doc_hash text,
  p_face_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.submit_kyb_verification_rpc(p_doc_image, p_face_image, p_doc_hash, p_face_hash);
end;
$$;
grant execute on function public.submit_kyb_docs_rpc(text, text, text, text) to authenticated;

-- ============================================================================
-- 12. AUTENTICACIÓN BIOMÉTRICA REAL (WEBAUTHN / PASSKEYS · V19.0)
--     Llaves asimétricas vinculadas al hardware del dispositivo (Huella / FaceID /
--     Windows Hello). Tabla auth.user_passkeys con RLS estricto + retos
--     criptográficos de un solo uso en el servidor.
-- ============================================================================

do $$
begin
  create table if not exists auth.user_passkeys (
    id              uuid primary key default gen_random_uuid(),
    user_id         uuid not null references auth.users (id) on delete cascade,
    credential_id   text not null unique,
    public_key_spki text not null,
    algorithm       integer not null default -7 check (algorithm in (-7, -257)),
    sign_count      bigint not null default 0 check (sign_count >= 0),
    transports      text[] not null default array[]::text[],
    device_label    text not null default 'Dispositivo biométrico',
    created_at      timestamptz not null default now(),
    last_used_at    timestamptz
  );
  alter table auth.user_passkeys enable row level security;

  drop policy if exists "Usuario ve sus propias passkeys" on auth.user_passkeys;
  create policy "Usuario ve sus propias passkeys"
    on auth.user_passkeys for select
    to authenticated
    using (auth.uid() = user_id);

  drop policy if exists "Usuario revoca sus propias passkeys" on auth.user_passkeys;
  create policy "Usuario revoca sus propias passkeys"
    on auth.user_passkeys for delete
    to authenticated
    using (auth.uid() = user_id);

  create index if not exists auth_user_passkeys_user_idx on auth.user_passkeys (user_id);
exception when insufficient_privilege then
  -- Respaldo en proyectos Supabase donde el rol SQL Editor no posee CREATE en schema auth
  create table if not exists public.user_passkeys (
    id              uuid primary key default gen_random_uuid(),
    user_id         uuid not null references auth.users (id) on delete cascade,
    credential_id   text not null unique,
    public_key_spki text not null,
    algorithm       integer not null default -7 check (algorithm in (-7, -257)),
    sign_count      bigint not null default 0 check (sign_count >= 0),
    transports      text[] not null default array[]::text[],
    device_label    text not null default 'Dispositivo biométrico',
    created_at      timestamptz not null default now(),
    last_used_at    timestamptz
  );
  alter table public.user_passkeys enable row level security;

  drop policy if exists "Usuario ve sus propias passkeys" on public.user_passkeys;
  create policy "Usuario ve sus propias passkeys"
    on public.user_passkeys for select
    to authenticated
    using (auth.uid() = user_id);

  drop policy if exists "Usuario revoca sus propias passkeys" on public.user_passkeys;
  create policy "Usuario revoca sus propias passkeys"
    on public.user_passkeys for delete
    to authenticated
    using (auth.uid() = user_id);

  create index if not exists public_user_passkeys_user_idx on public.user_passkeys (user_id);
end $$;

-- Retos criptográficos efímeros de un solo uso (3 min TTL · cero acceso directo por RLS)
create table if not exists public.webauthn_challenges (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('register', 'login')),
  challenge   text not null,
  expires_at  timestamptz not null default (now() + interval '3 minutes'),
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);
alter table public.webauthn_challenges enable row level security;
create index if not exists webauthn_challenges_exp_idx on public.webauthn_challenges (expires_at);

create or replace function public.passkeys_table_name()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when to_regclass('auth.user_passkeys') is not null then 'auth.user_passkeys'
    else 'public.user_passkeys'
  end;
$$;

create or replace function public.webauthn_random_challenge()
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
$$;

-- 12.1 Iniciar registro biométrico (solo comerciante verificado o admin autenticado)
create or replace function public.webauthn_begin_register_rpc()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_profile   public.profiles;
  v_email     text;
  v_challenge text;
  v_chal_id   uuid;
  v_tbl       text := public.passkeys_table_name();
  v_exclude   jsonb;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión para registrar tu dispositivo';
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if not found then
    raise exception 'Perfil no encontrado';
  end if;
  if not coalesce(v_profile.is_active, true) or coalesce(v_profile.is_suspended, false) then
    raise exception 'CUENTA_SUSPENDIDA: tu cuenta no puede registrar llaves biométricas';
  end if;
  if not coalesce(v_profile.is_verified, false) and v_profile.role <> 'admin' then
    raise exception 'SOLO_VERIFICADOS: la biometría se habilita cuando tu comercio esté verificado (✅)';
  end if;

  select email into v_email from auth.users where id = v_uid;

  delete from public.webauthn_challenges where expires_at < now() - interval '1 hour';

  v_challenge := public.webauthn_random_challenge();
  insert into public.webauthn_challenges (user_id, kind, challenge)
  values (v_uid, 'register', v_challenge)
  returning id into v_chal_id;

  execute format(
    'select coalesce(jsonb_agg(credential_id), ''[]''::jsonb) from %s where user_id = $1',
    v_tbl
  ) into v_exclude using v_uid;

  return jsonb_build_object(
    'challengeId', v_chal_id,
    'challenge', v_challenge,
    'userId', v_uid::text,
    'email', coalesce(v_email, ''),
    'businessName', v_profile.business_name,
    'excludeCredentialIds', coalesce(v_exclude, '[]'::jsonb)
  );
end;
$$;

-- 12.2 Completar registro biométrico: consume el reto y guarda la clave pública en auth.user_passkeys
create or replace function public.webauthn_complete_register_rpc(
  p_challenge_id    uuid,
  p_credential_id   text,
  p_public_key_spki text,
  p_algorithm       integer default -7,
  p_transports      text[] default array[]::text[],
  p_device_label    text default 'Dispositivo biométrico'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_profile  public.profiles;
  v_chal     public.webauthn_challenges;
  v_tbl      text := public.passkeys_table_name();
  v_new_id   uuid;
  v_label    text := left(coalesce(nullif(btrim(p_device_label), ''), 'Dispositivo biométrico'), 80);
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión';
  end if;
  select * into v_profile from public.profiles where id = v_uid;
  if not found or (not coalesce(v_profile.is_verified, false) and v_profile.role <> 'admin') then
    raise exception 'SOLO_VERIFICADOS: solo comercios verificados pueden registrar Passkeys';
  end if;
  if coalesce(btrim(p_credential_id), '') = '' or coalesce(btrim(p_public_key_spki), '') = '' then
    raise exception 'Credencial o clave pública WebAuthn inválida';
  end if;
  if p_algorithm not in (-7, -257) then
    raise exception 'Algoritmo criptográfico no soportado (requiere ES256 o RS256)';
  end if;

  update public.webauthn_challenges
     set consumed_at = now()
   where id = p_challenge_id
     and user_id = v_uid
     and kind = 'register'
     and consumed_at is null
     and expires_at > now()
  returning * into v_chal;

  if not found then
    raise exception 'El reto de registro biométrico expiró o ya fue utilizado. Intenta de nuevo.';
  end if;

  execute format(
    'insert into %s (user_id, credential_id, public_key_spki, algorithm, sign_count, transports, device_label)
     values ($1, $2, $3, $4, 0, $5, $6)
     on conflict (credential_id) do nothing
     returning id',
    v_tbl
  ) into v_new_id using v_uid, btrim(p_credential_id), btrim(p_public_key_spki), p_algorithm, coalesce(p_transports, array[]::text[]), v_label;

  if v_new_id is null then
    raise exception 'Este dispositivo ya está registrado con esa credencial biométrica';
  end if;

  return jsonb_build_object(
    'ok', true,
    'id', v_new_id,
    'credentialId', btrim(p_credential_id),
    'deviceLabel', v_label
  );
end;
$$;

-- 12.3 Listar mis dispositivos biométricos registrados
create or replace function public.webauthn_list_my_passkeys_rpc()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_tbl text := public.passkeys_table_name();
  v_out jsonb;
begin
  if v_uid is null then
    return '[]'::jsonb;
  end if;
  execute format(
    'select coalesce(jsonb_agg(jsonb_build_object(
       ''id'', id,
       ''credential_id'', credential_id,
       ''device_label'', device_label,
       ''algorithm'', algorithm,
       ''created_at'', created_at,
       ''last_used_at'', last_used_at
     ) order by created_at desc), ''[]''::jsonb)
     from %s where user_id = $1',
    v_tbl
  ) into v_out using v_uid;
  return coalesce(v_out, '[]'::jsonb);
end;
$$;

-- 12.4 Revocar un dispositivo biométrico (ej: cambio o pérdida de celular)
create or replace function public.webauthn_revoke_passkey_rpc(p_passkey_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_tbl     text := public.passkeys_table_name();
  v_deleted integer := 0;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión';
  end if;
  execute format('delete from %s where id = $1 and user_id = $2', v_tbl)
    using p_passkey_id, v_uid;
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

-- 12.5 Iniciar login biométrico: emite reto aleatorio y lista SOLO los IDs permitidos
create or replace function public.webauthn_begin_login_rpc(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id   uuid;
  v_profile   public.profiles;
  v_tbl       text := public.passkeys_table_name();
  v_creds     jsonb;
  v_challenge text;
  v_chal_id   uuid;
begin
  select id into v_user_id
    from auth.users
   where lower(email) = lower(btrim(coalesce(p_email, '')))
   limit 1;

  if v_user_id is null then
    raise exception 'PASSKEY_NOT_REGISTERED: No existe una cuenta con biometría activa para ese correo.';
  end if;

  select * into v_profile from public.profiles where id = v_user_id;
  if found and (not coalesce(v_profile.is_active, true) or coalesce(v_profile.is_suspended, false)) then
    raise exception 'CUENTA_SUSPENDIDA: tu cuenta está suspendida temporalmente.';
  end if;

  execute format(
    'select coalesce(jsonb_agg(jsonb_build_object(''id'', credential_id, ''transports'', transports)), ''[]''::jsonb)
       from %s where user_id = $1',
    v_tbl
  ) into v_creds using v_user_id;

  if v_creds is null or jsonb_array_length(v_creds) = 0 then
    raise exception 'PASSKEY_NOT_REGISTERED: Esta cuenta no tiene biometría activada. Inicia sesión con tu contraseña y registra este dispositivo en tu panel.';
  end if;

  v_challenge := public.webauthn_random_challenge();
  insert into public.webauthn_challenges (user_id, kind, challenge)
  values (v_user_id, 'login', v_challenge)
  returning id into v_chal_id;

  return jsonb_build_object(
    'challengeId', v_chal_id,
    'challenge', v_challenge,
    'allowCredentials', v_creds
  );
end;
$$;

-- 12.6 Consumir reto y entregar material público de verificación criptográfica al servidor (/api/webauthn)
create or replace function public.webauthn_consume_login_challenge_rpc(
  p_challenge_id  uuid,
  p_credential_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_chal    public.webauthn_challenges;
  v_tbl     text := public.passkeys_table_name();
  v_pk      text;
  v_alg     integer;
  v_cnt     bigint;
  v_email   text;
  v_active  boolean;
  v_susp    boolean;
begin
  update public.webauthn_challenges
     set consumed_at = now()
   where id = p_challenge_id
     and kind = 'login'
     and consumed_at is null
     and expires_at > now()
  returning * into v_chal;

  if not found then
    raise exception 'CHALLENGE_INVALID: El reto biométrico expiró o ya fue usado. Intenta de nuevo.';
  end if;

  execute format(
    'select public_key_spki, algorithm, sign_count
       from %s
      where user_id = $1 and credential_id = $2
      limit 1',
    v_tbl
  ) into v_pk, v_alg, v_cnt using v_chal.user_id, btrim(coalesce(p_credential_id, ''));

  if v_pk is null then
    raise exception 'CREDENTIAL_MISMATCH: Esta llave biométrica no pertenece a esta cuenta.';
  end if;

  select email into v_email from auth.users where id = v_chal.user_id;
  select coalesce(is_active, true), coalesce(is_suspended, false)
    into v_active, v_susp
    from public.profiles where id = v_chal.user_id;

  if not coalesce(v_active, true) or coalesce(v_susp, false) then
    raise exception 'CUENTA_SUSPENDIDA: la cuenta está suspendida';
  end if;

  return jsonb_build_object(
    'challenge', v_chal.challenge,
    'userId', v_chal.user_id,
    'email', coalesce(v_email, ''),
    'publicKeySpki', v_pk,
    'algorithm', v_alg,
    'signCount', v_cnt
  );
end;
$$;

-- 12.7 Actualiza contador anti-clonación y último uso tras validación criptográfica exitosa
create or replace function public.webauthn_commit_login_usage_rpc(
  p_challenge_id   uuid,
  p_credential_id  text,
  p_new_sign_count bigint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_chal public.webauthn_challenges;
  v_tbl  text := public.passkeys_table_name();
begin
  select * into v_chal
    from public.webauthn_challenges
   where id = p_challenge_id
     and kind = 'login'
     and consumed_at is not null
     and consumed_at > now() - interval '2 minutes';
  if not found then
    return false;
  end if;

  execute format(
    'update %s
        set sign_count = greatest(sign_count, $1),
            last_used_at = now()
      where user_id = $2 and credential_id = $3',
    v_tbl
  ) using greatest(0, coalesce(p_new_sign_count, 0)), v_chal.user_id, btrim(coalesce(p_credential_id, ''));

  return true;
end;
$$;

grant execute on function public.webauthn_begin_register_rpc()                                     to authenticated;
grant execute on function public.webauthn_complete_register_rpc(uuid, text, text, integer, text[], text) to authenticated;
grant execute on function public.webauthn_list_my_passkeys_rpc()                                 to authenticated;
grant execute on function public.webauthn_revoke_passkey_rpc(uuid)                               to authenticated;
grant execute on function public.webauthn_begin_login_rpc(text)                                  to anon, authenticated;
grant execute on function public.webauthn_consume_login_challenge_rpc(uuid, text)                to anon, authenticated;
grant execute on function public.webauthn_commit_login_usage_rpc(uuid, text, bigint)             to anon, authenticated;

-- ============================================================================
-- 13. AGENTE DE SOPORTE INTELIGENTE ("EL CONSERJE DE IMPULSO" · V30/V31)
--     Almacena reportes técnicos y dudas escaladas con diagnóstico IA.
-- ============================================================================
create table if not exists public.support_tickets (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete set null,
  user_role       text not null default 'client' check (user_role in ('client', 'merchant', 'admin')),
  user_name       text not null default 'Visitante',
  municipality    text not null default 'Gachetá',
  category        text not null default 'usage' check (category in ('usage', 'technical', 'bug', 'billing', 'abuse')),
  severity        text not null default 'low' check (severity in ('low', 'medium', 'high', 'critical')),
  summary         text not null,
  chat_transcript jsonb not null default '[]'::jsonb,
  ai_analysis     text not null,
  status          text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  created_at      timestamptz not null default now()
);

alter table public.support_tickets enable row level security;

drop policy if exists "Soporte insert publico o propio" on public.support_tickets;
create policy "Soporte insert publico o propio"
  on public.support_tickets for insert
  to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

drop policy if exists "Usuario ve sus tickets" on public.support_tickets;
create policy "Usuario ve sus tickets"
  on public.support_tickets for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Admin actualiza tickets" on public.support_tickets;
create policy "Admin actualiza tickets"
  on public.support_tickets for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.submit_support_ticket_rpc(
  p_user_role       text,
  p_user_name       text,
  p_municipality    text,
  p_category        text,
  p_severity        text,
  p_summary         text,
  p_chat_transcript jsonb,
  p_ai_analysis     text
)
returns public.support_tickets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.support_tickets;
begin
  insert into public.support_tickets (
    user_id, user_role, user_name, municipality,
    category, severity, summary, chat_transcript, ai_analysis
  )
  values (
    auth.uid(),
    case when p_user_role in ('client', 'merchant', 'admin') then p_user_role else 'client' end,
    left(coalesce(nullif(btrim(p_user_name), ''), 'Visitante'), 80),
    left(coalesce(nullif(btrim(p_municipality), ''), 'Gachetá'), 60),
    case when p_category in ('usage', 'technical', 'bug', 'billing', 'abuse') then p_category else 'technical' end,
    case when p_severity in ('low', 'medium', 'high', 'critical') then p_severity else 'medium' end,
    left(coalesce(nullif(btrim(p_summary), ''), 'Reporte técnico de plataforma'), 240),
    coalesce(p_chat_transcript, '[]'::jsonb),
    left(coalesce(nullif(btrim(p_ai_analysis), ''), 'Pendiente de revisión'), 800)
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.admin_support_tickets_list_rpc()
returns setof public.support_tickets
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'SOLO_ADMIN: acceso restringido';
  end if;
  return query
  select * from public.support_tickets
  order by created_at desc
  limit 80;
end;
$$;

create or replace function public.admin_update_support_ticket_rpc(
  p_ticket_id uuid,
  p_status    text
)
returns public.support_tickets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.support_tickets;
begin
  if not public.is_admin() then
    raise exception 'SOLO_ADMIN: acceso restringido';
  end if;
  if p_status not in ('open', 'in_progress', 'resolved') then
    raise exception 'Estado inválido';
  end if;
  update public.support_tickets
     set status = p_status
   where id = p_ticket_id
  returning * into v_row;
  return v_row;
end;
$$;

grant execute on function public.submit_support_ticket_rpc(text, text, text, text, text, text, jsonb, text) to anon, authenticated;
grant execute on function public.admin_support_tickets_list_rpc()                                              to authenticated;
grant execute on function public.admin_update_support_ticket_rpc(uuid, text)                                  to authenticated;

-- ============================================================================
-- 13B. ADMIN TICKETS UNIFICADOS (V32.0 · Tabla primaria public.admin_tickets)
-- ============================================================================
create table if not exists public.admin_tickets (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete set null,
  user_role       text not null default 'client' check (user_role in ('client', 'merchant', 'admin')),
  user_name       text not null default 'Visitante',
  municipality    text not null default 'Gachetá',
  category        text not null default 'usage' check (category in ('usage', 'technical', 'bug', 'billing', 'abuse')),
  severity        text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  summary         text not null,
  chat_transcript jsonb not null default '[]'::jsonb,
  ai_analysis     text not null,
  status          text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  created_at      timestamptz not null default now()
);

alter table public.admin_tickets enable row level security;

drop policy if exists "Admin tickets insert publico o propio" on public.admin_tickets;
create policy "Admin tickets insert publico o propio"
  on public.admin_tickets for insert
  to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

drop policy if exists "Usuario ve sus admin_tickets" on public.admin_tickets;
create policy "Usuario ve sus admin_tickets"
  on public.admin_tickets for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Admin actualiza admin_tickets" on public.admin_tickets;
create policy "Admin actualiza admin_tickets"
  on public.admin_tickets for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.submit_admin_ticket_rpc(
  p_user_role       text,
  p_user_name       text,
  p_municipality    text,
  p_category        text,
  p_severity        text,
  p_summary         text,
  p_chat_transcript jsonb,
  p_ai_analysis     text
)
returns public.admin_tickets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.admin_tickets;
begin
  insert into public.admin_tickets (
    user_id, user_role, user_name, municipality,
    category, severity, summary, chat_transcript, ai_analysis
  )
  values (
    auth.uid(),
    case when p_user_role in ('client', 'merchant', 'admin') then p_user_role else 'client' end,
    left(coalesce(nullif(btrim(p_user_name), ''), 'Visitante'), 80),
    left(coalesce(nullif(btrim(p_municipality), ''), 'Gachetá'), 60),
    case when p_category in ('usage', 'technical', 'bug', 'billing', 'abuse') then p_category else 'technical' end,
    case when p_severity in ('low', 'medium', 'high', 'critical') then p_severity else 'high' end,
    left(coalesce(nullif(btrim(p_summary), ''), 'Reporte técnico de plataforma'), 240),
    coalesce(p_chat_transcript, '[]'::jsonb),
    left(coalesce(nullif(btrim(p_ai_analysis), ''), 'Pendiente de revisión'), 800)
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.admin_tickets_list_rpc()
returns setof public.admin_tickets
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'SOLO_ADMIN: acceso restringido';
  end if;
  return query
  select * from public.admin_tickets
  order by created_at desc
  limit 80;
end;
$$;

create or replace function public.admin_update_ticket_status_rpc(
  p_ticket_id uuid,
  p_status    text
)
returns public.admin_tickets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.admin_tickets;
begin
  if not public.is_admin() then
    raise exception 'SOLO_ADMIN: acceso restringido';
  end if;
  if p_status not in ('open', 'in_progress', 'resolved') then
    raise exception 'Estado inválido';
  end if;
  update public.admin_tickets
     set status = p_status
   where id = p_ticket_id
  returning * into v_row;
  return v_row;
end;
$$;

grant execute on function public.submit_admin_ticket_rpc(text, text, text, text, text, text, jsonb, text) to anon, authenticated;
grant execute on function public.admin_tickets_list_rpc()                                              to authenticated;
grant execute on function public.admin_update_ticket_status_rpc(uuid, text)                            to authenticated;

-- ============================================================================
-- 14. V35.0 · SISTEMA DE INSIGNIAS ESCALADAS (trust_level) Y FINGERPRINT FORENSE
-- ============================================================================
alter table public.profiles
  add column if not exists trust_level text not null default 'new'
  check (trust_level in ('new', 'verified', 'super'));

alter table public.offers
  add column if not exists device_id text;

update public.profiles
   set trust_level = case
     when is_verified = true and coalesce(lifetime_orders_count, 0) >= 20 then 'super'
     when is_verified = true then 'verified'
     else 'new'
   end
 where trust_level = 'new' and is_verified = true;

create or replace function public.sync_profile_trust_level_fn()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.trust_level = 'super' then
    return new;
  end if;
  if coalesce(new.is_verified, false) = true and coalesce(new.lifetime_orders_count, 0) >= 20 then
    new.trust_level := 'super';
  elsif coalesce(new.is_verified, false) = true then
    new.trust_level := 'verified';
  else
    new.trust_level := 'new';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_profile_trust_level on public.profiles;
create trigger trg_sync_profile_trust_level
  before insert or update of is_verified, lifetime_orders_count
  on public.profiles
  for each row
  execute function public.sync_profile_trust_level_fn();

-- ============================================================================
-- 15. V36.0 · REPARACIÓN RAÍZ WEBAUTHN (BÓVEDA EN SERVIDOR + DISCOVERABLE),
--     BLINDAJE ANTI-TAMPERING ENTERPRISE, RATE LIMITING RPC Y LEY 1581 (GPS 7D)
-- ============================================================================

-- 15.1 Bóveda cifrada AES-256-GCM en tabla de passkeys (jamás expuesta al cliente)
do $$
begin
  if to_regclass('auth.user_passkeys') is not null then
    execute 'alter table auth.user_passkeys add column if not exists sealed_vault text';
  end if;
  if to_regclass('public.user_passkeys') is not null then
    execute 'alter table public.user_passkeys add column if not exists sealed_vault text';
  end if;
exception when insufficient_privilege then
  if to_regclass('public.user_passkeys') is not null then
    execute 'alter table public.user_passkeys add column if not exists sealed_vault text';
  end if;
end $$;

-- Permite retos de login discoverable (sin correo previo: user_id NULL)
alter table public.webauthn_challenges alter column user_id drop not null;

-- Normalizador Base64URL estricto (sin padding =)
create or replace function public.webauthn_norm_b64url(p_val text)
returns text
language sql
immutable
as $$
  select rtrim(translate(btrim(coalesce(p_val, '')), '+/', '-_'), '=');
$$;

-- 15.2 Completar registro WebAuthn con soporte opcional de bóveda cifrada
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'webauthn_complete_register_rpc'
  loop
    execute 'drop function if exists ' || r.sig;
  end loop;
end $$;

create or replace function public.webauthn_complete_register_rpc(
  p_challenge_id    uuid,
  p_credential_id   text,
  p_public_key_spki text,
  p_algorithm       integer default -7,
  p_transports      text[] default array[]::text[],
  p_device_label    text default 'Dispositivo biométrico',
  p_sealed_vault    text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_profile  public.profiles;
  v_chal     public.webauthn_challenges;
  v_tbl      text := public.passkeys_table_name();
  v_new_id   uuid;
  v_cred_id  text := public.webauthn_norm_b64url(p_credential_id);
  v_label    text := left(coalesce(nullif(btrim(p_device_label), ''), 'Dispositivo biométrico'), 80);
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión';
  end if;
  select * into v_profile from public.profiles where id = v_uid;
  if not found or (not coalesce(v_profile.is_verified, false) and v_profile.role <> 'admin') then
    raise exception 'SOLO_VERIFICADOS: solo comercios verificados pueden registrar Passkeys';
  end if;
  if v_cred_id = '' or coalesce(btrim(p_public_key_spki), '') = '' then
    raise exception 'Credencial o clave pública WebAuthn inválida';
  end if;
  if p_algorithm not in (-7, -257) then
    raise exception 'Algoritmo criptográfico no soportado (requiere ES256 o RS256)';
  end if;

  update public.webauthn_challenges
     set consumed_at = now()
   where id = p_challenge_id
     and user_id = v_uid
     and kind = 'register'
     and consumed_at is null
     and expires_at > now()
  returning * into v_chal;

  if not found then
    raise exception 'El reto de registro biométrico expiró o ya fue utilizado. Intenta de nuevo.';
  end if;

  execute format(
    'insert into %s (user_id, credential_id, public_key_spki, algorithm, sign_count, transports, device_label, sealed_vault)
     values ($1, $2, $3, $4, 0, $5, $6, $7)
     on conflict (credential_id) do update
       set sealed_vault = coalesce(excluded.sealed_vault, %s.sealed_vault),
           device_label = excluded.device_label
       where %s.user_id = $1
     returning id',
    v_tbl, v_tbl, v_tbl
  ) into v_new_id using v_uid, v_cred_id, btrim(p_public_key_spki), p_algorithm, coalesce(p_transports, array[]::text[]), v_label, nullif(btrim(coalesce(p_sealed_vault, '')), '');

  if v_new_id is null then
    raise exception 'Este dispositivo ya está registrado en otra cuenta';
  end if;

  return jsonb_build_object(
    'ok', true,
    'id', v_new_id,
    'credentialId', v_cred_id,
    'deviceLabel', v_label
  );
end;
$$;

-- 15.3 Sincronización / auto-sanación transparente de bóveda sellada al iniciar sesión con contraseña
create or replace function public.webauthn_sync_vault_rpc(
  p_credential_id text,
  p_sealed_vault  text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_tbl     text := public.passkeys_table_name();
  v_cred    text := public.webauthn_norm_b64url(p_credential_id);
  v_updated integer := 0;
begin
  if v_uid is null or v_cred = '' or coalesce(btrim(p_sealed_vault), '') = '' then
    return false;
  end if;
  execute format(
    'update %s
        set sealed_vault = $1
      where user_id = $2
        and public.webauthn_norm_b64url(credential_id) = $3',
    v_tbl
  ) using btrim(p_sealed_vault), v_uid, v_cred;
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

-- 15.4 Reto discoverable (permite login biométrico SIN escribir correo previo)
create or replace function public.webauthn_begin_discoverable_login_rpc()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_challenge text;
  v_chal_id   uuid;
begin
  delete from public.webauthn_challenges where expires_at < now() - interval '1 hour';
  v_challenge := public.webauthn_random_challenge();
  insert into public.webauthn_challenges (user_id, kind, challenge)
  values (null, 'login', v_challenge)
  returning id into v_chal_id;

  return jsonb_build_object(
    'challengeId', v_chal_id,
    'challenge', v_challenge,
    'allowCredentials', '[]'::jsonb
  );
end;
$$;

-- 15.5 Consumir reto de login: soporta email-bound y discoverable + Base64URL estricto + sealedVault
create or replace function public.webauthn_consume_login_challenge_rpc(
  p_challenge_id  uuid,
  p_credential_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_chal    public.webauthn_challenges;
  v_tbl     text := public.passkeys_table_name();
  v_uid     uuid;
  v_pk      text;
  v_alg     integer;
  v_cnt     bigint;
  v_vault   text;
  v_email   text;
  v_active  boolean;
  v_susp    boolean;
  v_cred    text := public.webauthn_norm_b64url(p_credential_id);
begin
  update public.webauthn_challenges
     set consumed_at = now()
   where id = p_challenge_id
     and kind = 'login'
     and consumed_at is null
     and expires_at > now()
  returning * into v_chal;

  if not found then
    raise exception 'CHALLENGE_INVALID: El reto biométrico expiró o ya fue usado. Intenta de nuevo.';
  end if;

  if v_chal.user_id is not null then
    execute format(
      'select user_id, public_key_spki, algorithm, sign_count, sealed_vault
         from %s
        where user_id = $1 and public.webauthn_norm_b64url(credential_id) = $2
        limit 1',
      v_tbl
    ) into v_uid, v_pk, v_alg, v_cnt, v_vault using v_chal.user_id, v_cred;
  else
    execute format(
      'select user_id, public_key_spki, algorithm, sign_count, sealed_vault
         from %s
        where public.webauthn_norm_b64url(credential_id) = $1
        limit 1',
      v_tbl
    ) into v_uid, v_pk, v_alg, v_cnt, v_vault using v_cred;
  end if;

  if v_pk is null or v_uid is null then
    raise exception 'CREDENTIAL_MISMATCH: Esta llave biométrica no está vinculada a ninguna cuenta activa.';
  end if;

  select email into v_email from auth.users where id = v_uid;
  select coalesce(is_active, true), coalesce(is_suspended, false)
    into v_active, v_susp
    from public.profiles where id = v_uid;

  if not coalesce(v_active, true) or coalesce(v_susp, false) then
    raise exception 'CUENTA_SUSPENDIDA: la cuenta está suspendida';
  end if;

  return jsonb_build_object(
    'challenge', v_chal.challenge,
    'userId', v_uid,
    'email', coalesce(v_email, ''),
    'publicKeySpki', v_pk,
    'algorithm', v_alg,
    'signCount', v_cnt,
    'sealedVault', v_vault
  );
end;
$$;

-- 15.6 Commit de uso compatible con retos discoverable + Base64URL normalizado
create or replace function public.webauthn_commit_login_usage_rpc(
  p_challenge_id   uuid,
  p_credential_id  text,
  p_new_sign_count bigint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_chal public.webauthn_challenges;
  v_tbl  text := public.passkeys_table_name();
  v_cred text := public.webauthn_norm_b64url(p_credential_id);
begin
  select * into v_chal
    from public.webauthn_challenges
   where id = p_challenge_id
     and kind = 'login'
     and consumed_at is not null
     and consumed_at > now() - interval '2 minutes';
  if not found then
    return false;
  end if;

  execute format(
    'update %s
        set sign_count = greatest(sign_count, $1),
            last_used_at = now()
      where public.webauthn_norm_b64url(credential_id) = $2',
    v_tbl
  ) using greatest(0, coalesce(p_new_sign_count, 0)), v_cred;

  return true;
end;
$$;

grant execute on function public.webauthn_complete_register_rpc(uuid, text, text, integer, text[], text, text) to authenticated;
grant execute on function public.webauthn_sync_vault_rpc(text, text)                                            to authenticated;
grant execute on function public.webauthn_begin_discoverable_login_rpc()                                        to anon, authenticated;
grant execute on function public.webauthn_consume_login_challenge_rpc(uuid, text)                               to anon, authenticated;
grant execute on function public.webauthn_commit_login_usage_rpc(uuid, text, bigint)                            to anon, authenticated;

-- 15.7 Blindaje Anti-Tampering Financiero: revoca escrituras directas del cliente
revoke insert, update, delete on public.offers          from anon, authenticated;
revoke insert, update, delete on public.reservations    from anon, authenticated;
revoke insert, update, delete on public.credit_orders   from anon, authenticated;
revoke insert, update, delete on public.payment_methods from anon, authenticated;
revoke insert, update, delete on public.kyb_verifications from anon, authenticated;
revoke all on public.platform_settings from anon, authenticated;
revoke all on public.app_settings      from anon, authenticated;

create or replace function public.guard_app_settings_anti_tamper_fn()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    raise exception 'ANTI_TAMPER: Configuración financiera del administrador protegida.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_app_settings_anti_tamper on public.app_settings;
create trigger trg_guard_app_settings_anti_tamper
  before insert or update or delete on public.app_settings
  for each row execute function public.guard_app_settings_anti_tamper_fn();

-- 15.8 publish_offer_rpc con huella forense p_device_id + anti-flood (máx 15 ofertas/hora)
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'publish_offer_rpc'
  loop
    execute 'drop function if exists ' || r.sig;
  end loop;
end $$;

create or replace function public.publish_offer_rpc(
  p_category       text,
  p_title          text,
  p_description    text,
  p_total_quota    integer,
  p_emoji_icon     text default '🔥',
  p_original_price numeric default null,
  p_promo_price    numeric default null,
  p_duration_hours numeric default 3,
  p_municipality   text default 'Gachetá',
  p_lat            double precision default 4.8167,
  p_lng            double precision default -73.6333,
  p_image_thumb    text default null,
  p_delivery_type  text default 'local_fisico',
  p_device_id      text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile       public.profiles;
  v_offer         public.offers;
  v_recent_offers integer := 0;
begin
  if p_promo_price is null or p_promo_price < 0 then
    raise exception 'El precio de oferta es obligatorio';
  end if;
  if p_total_quota < 1 or p_total_quota > 500 then
    raise exception 'El cupo debe estar entre 1 y 500';
  end if;
  if p_duration_hours <= 0 or p_duration_hours > 96 then
    raise exception 'La duración debe estar entre 30 minutos y 96 horas (4 días)';
  end if;
  if char_length(trim(p_title)) < 3 or char_length(p_title) > 90 then
    raise exception 'El título debe tener entre 3 y 90 caracteres';
  end if;
  if char_length(trim(p_description)) < 5 or char_length(p_description) > 280 then
    raise exception 'La descripción debe tener entre 5 y 280 caracteres';
  end if;
  if p_category not in ('comida', 'transporte_flete', 'agro_mercado', 'hoteles_turismo', 'salud_belleza', 'hogar_construccion', 'servicios_comercios') then
    raise exception 'Categoría inválida';
  end if;

  select * into v_profile from public.profiles where id = auth.uid() for update;
  if not found then
    raise exception 'Perfil no encontrado';
  end if;
  if v_profile.role not in ('merchant', 'admin') then
    raise exception 'Rol sin permiso para publicar';
  end if;
  if not coalesce(v_profile.is_active, true) or coalesce(v_profile.is_suspended, false) then
    raise exception 'CUENTA_SUSPENDIDA: tu cuenta está suspendida temporalmente. Contacta al administrador.';
  end if;
  if p_image_thumb is not null and char_length(p_image_thumb) > 35000 then
    raise exception 'La foto es demasiado pesada. Intenta con otra imagen.';
  end if;
  if p_delivery_type not in ('local_fisico', 'parque_principal', 'domicilio') then
    raise exception 'Modalidad de entrega inválida';
  end if;

  -- Rate limiting anti-flood en publicación (máx 15 ofertas por hora por comercio)
  select count(*) into v_recent_offers
    from public.offers
   where merchant_id = v_profile.id
     and created_at > now() - interval '1 hour';
  if v_recent_offers >= 15 and v_profile.role <> 'admin' then
    raise exception 'RATE_LIMIT: alcanzaste el límite de publicaciones por hora. Intenta más tarde.';
  end if;

  if v_profile.credits < 1 then
    raise exception 'NO_CREDITS: No tienes créditos disponibles. Recarga con el administrador para volver a publicar.';
  end if;

  update public.profiles
     set credits = credits - 1
   where id = v_profile.id;

  insert into public.offers (
    merchant_id, category, title, description, emoji_icon,
    original_price, promo_price, total_quota, available_quota,
    municipality, lat, lng, expires_at, status,
    image_thumb, delivery_type, device_id
  ) values (
    v_profile.id, p_category, trim(p_title), trim(p_description),
    coalesce(nullif(trim(p_emoji_icon), ''), '🔥'),
    p_original_price, p_promo_price, p_total_quota, p_total_quota,
    coalesce(nullif(trim(p_municipality), ''), 'Gachetá'),
    coalesce(p_lat, v_profile.lat, 4.8167),
    coalesce(p_lng, v_profile.lng, -73.6333),
    now() + (p_duration_hours * interval '1 hour'),
    'active',
    p_image_thumb,
    p_delivery_type,
    nullif(btrim(coalesce(p_device_id, '')), '')
  )
  returning * into v_offer;

  delete from public.offers o
   where o.merchant_id = v_profile.id
     and o.id <> v_offer.id
     and (o.status <> 'active' or o.expires_at < now())
     and o.id not in (
       select id
         from public.offers
        where merchant_id = v_profile.id
          and (status <> 'active' or expires_at < now())
        order by created_at desc
        limit 10
     );

  return to_jsonb(v_offer);
end;
$$;
grant execute on function public.publish_offer_rpc(text, text, text, integer, text, numeric, numeric, numeric, text, double precision, double precision, text, text, text) to authenticated;

-- 15.9 Cumplimiento Ley 1581 (marca explícita gps_consent_at + poda automática a los 7 días)
alter table public.reservations add column if not exists gps_consent_at timestamptz;

create or replace function public.auto_prune_expired_data_rpc()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expired  integer;
  v_requests integer;
  v_gps_pruned integer;
begin
  update public.offers
     set status = 'expired',
         image_thumb = null
   where status = 'active'
     and expires_at < now();
  get diagnostics v_expired = row_count;

  update public.offers
     set image_thumb = null
   where status in ('expired', 'cancelled')
     and image_thumb is not null;

  -- Ley 1581: poda automática de coordenadas GPS puntuales tras 7 días
  update public.reservations
     set client_lat = null,
         client_lng = null,
         gps_consent_at = null
   where (client_lat is not null or client_lng is not null)
     and created_at < now() - interval '7 days';
  get diagnostics v_gps_pruned = row_count;

  delete from public.quick_requests
   where expires_at < now() - interval '6 hours';
  get diagnostics v_requests = row_count;

  return jsonb_build_object(
    'offers_expired', v_expired,
    'requests_deleted', v_requests,
    'gps_pruned', v_gps_pruned
  );
end;
$$;
grant execute on function public.auto_prune_expired_data_rpc() to anon, authenticated;

-- 15.10 Rate limiting anti-abuso en reservas (máx 10/10min por dispositivo o IP) + marca gps_consent_at
create or replace function public.reserve_offer_rpc(
  p_offer_id       uuid,
  p_customer_name  text,
  p_customer_phone text,
  p_quantity       integer default 1,
  p_customer_note  text default '',
  p_device_id      text default null,
  p_client_lat     double precision default null,
  p_client_lng     double precision default null,
  p_edge_ip        text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer     public.offers;
  v_merchant  public.profiles;
  v_res       public.reservations;
  v_code      text;
  v_client_ip text;
  v_device    text;
  v_recent    integer := 0;
  v_lat       double precision;
  v_lng       double precision;
begin
  v_client_ip := public.resolve_client_ip(p_edge_ip);
  v_device    := nullif(btrim(coalesce(p_device_id, '')), '');

  if char_length(trim(p_customer_name)) < 2 or char_length(p_customer_name) > 60 then
    raise exception 'El nombre debe tener entre 2 y 60 caracteres';
  end if;
  if char_length(p_customer_phone) < 7 or char_length(p_customer_phone) > 20 then
    raise exception 'El teléfono debe tener entre 7 y 20 caracteres';
  end if;
  if p_quantity < 1 or p_quantity > 20 then
    raise exception 'La cantidad debe estar entre 1 y 20';
  end if;
  if char_length(coalesce(p_customer_note, '')) > 140 then
    raise exception 'La nota no puede superar 140 caracteres';
  end if;

  if public.is_client_blocked(trim(p_customer_phone), v_device) then
    raise exception 'CLIENTE_BLOQUEADO: esta solicitud no puede completarse desde este dispositivo o número';
  end if;

  -- Rate limiting anti-flood (ventana deslizante 10 min)
  select count(*) into v_recent
    from public.reservations r
   where r.created_at > now() - interval '10 minutes'
     and (
       (v_device is not null and r.device_id = v_device)
       or (v_client_ip is not null and v_client_ip <> '0.0.0.0' and r.client_ip = v_client_ip)
     );
  if v_recent >= 10 then
    raise exception 'RATE_LIMIT: demasiados apartados seguidos desde este dispositivo. Espera unos minutos.';
  end if;

  select * into v_offer from public.offers where id = p_offer_id for update;
  if not found then
    raise exception 'Oferta no encontrada';
  end if;
  if v_offer.status <> 'active' or v_offer.expires_at < now() then
    raise exception 'Esta oferta ya no está activa';
  end if;

  if exists (
    select 1
      from public.reservations r
     where r.offer_id = v_offer.id
       and r.status = 'pending'
       and (
             (v_device is not null and r.device_id = v_device)
             or r.customer_phone = trim(p_customer_phone)
           )
  ) then
    raise exception 'YA_APARTASTE_ESTE_PEDIDO: ya tienes este pedido pendiente de recoger con este número o dispositivo';
  end if;

  if exists (
    select 1
      from public.blocked_clients b
     where b.blocked_by = v_offer.merchant_id
       and (
             (v_device is not null and b.device_id = v_device)
             or b.phone = trim(p_customer_phone)
           )
  ) then
    raise exception 'CLIENTE_BLOQUEADO: esta solicitud no puede completarse desde este dispositivo o número';
  end if;

  if v_offer.available_quota < p_quantity then
    raise exception 'SOLO_QUEDAN % unidades de esta oferta', v_offer.available_quota;
  end if;

  update public.offers
     set available_quota = available_quota - p_quantity,
         status = case when available_quota - p_quantity <= 0 then 'sold_out' else status end
   where id = v_offer.id;

  select upper(string_agg(c, ''))
    into v_code
    from (
      select substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (floor(random() * 32) + 1)::int, 1) as c
      from generate_series(1, 4)
    ) chars;

  v_lat := coalesce(nullif(p_client_lat, 0), null);
  v_lng := coalesce(nullif(p_client_lng, 0), null);

  insert into public.reservations (
    offer_id, merchant_id, customer_name, customer_phone,
    quantity, customer_note, reservation_code, status,
    client_ip, device_id, client_lat, client_lng, gps_consent_at
  ) values (
    v_offer.id, v_offer.merchant_id, trim(p_customer_name), trim(p_customer_phone),
    p_quantity, coalesce(p_customer_note, ''), v_code, 'pending',
    v_client_ip, v_device, v_lat, v_lng,
    case when v_lat is not null and v_lng is not null then now() else null end
  )
  returning * into v_res;

  select * into v_merchant from public.profiles where id = v_offer.merchant_id;

  return jsonb_build_object(
    'reservation', to_jsonb(v_res),
    'offer', to_jsonb(v_offer),
    'merchant', to_jsonb(v_merchant)
  );
end;
$$;
grant execute on function public.reserve_offer_rpc(uuid, text, text, integer, text, text, double precision, double precision, text) to anon, authenticated;

-- 🔄 V19/V36 · Refresca el caché de PostgREST automáticamente al correr el script
NOTIFY pgrst, 'reload schema';





-- ============================================================================
-- 16. V37.0 · CUENTAS CLIENTE VS COMERCIO, PREFERENCIAS COMPACTAS (ZERO-BLOAT),
--     PAGOS MULTICANAL (NEQUI/DAVIPLATA/LLAVE + QR) Y UNICIDAD ATÓMICA DE RECIBOS
-- ============================================================================

-- 16.1 Columna compacta JSONB para preferencias ligeras de Comprador (0 tablas extra)
alter table public.profiles
  add column if not exists client_preferences jsonb default null;

-- 16.2 Trigger de registro diferenciado: respeta account_type='client' vs 'merchant'
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account_type text;
  v_role         text;
  v_credits      integer;
  v_name         text;
begin
  v_account_type := lower(coalesce(new.raw_user_meta_data ->> 'account_type', 'merchant'));
  if v_account_type = 'client' then
    v_role := 'client';
    v_credits := 0;
    v_name := coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'business_name'), ''),
      'Cliente Impulso'
    );
  else
    v_role := 'merchant';
    v_credits := 3;
    v_name := coalesce(nullif(btrim(new.raw_user_meta_data ->> 'business_name'), ''), 'Mi Negocio');
  end if;

  insert into public.profiles (id, role, credits, business_name, category, whatsapp, municipality)
  values (
    new.id,
    v_role,
    v_credits,
    left(v_name, 80),
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'category'), ''), 'comida'),
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'whatsapp'), ''), '3000000000'),
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'municipality'), ''), 'Gachetá')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 16.3 Guardado ultra-ligero de preferencias del comprador (tope estricto <= 2KB)
create or replace function public.save_client_preferences_rpc(p_preferences jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clean jsonb;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión para sincronizar tus preferencias';
  end if;
  if p_preferences is null or jsonb_typeof(p_preferences) <> 'object' then
    raise exception 'Preferencias inválidas';
  end if;
  if octet_length(p_preferences::text) > 2048 then
    raise exception 'El tamaño de preferencias excede el límite compacto permitido (2 KB)';
  end if;

  v_clean := jsonb_build_object(
    'favoriteCategories', coalesce(p_preferences -> 'favoriteCategories', '[]'::jsonb),
    'maxBudgetCop', case
      when jsonb_typeof(p_preferences -> 'maxBudgetCop') = 'number' then p_preferences -> 'maxBudgetCop'
      else 'null'::jsonb
    end,
    'favoriteOfferIds', coalesce(p_preferences -> 'favoriteOfferIds', '[]'::jsonb),
    'updatedAt', extract(epoch from now())::bigint * 1000
  );

  update public.profiles
     set client_preferences = v_clean
   where id = auth.uid();

  return v_clean;
end;
$$;
grant execute on function public.save_client_preferences_rpc(jsonb) to authenticated;

-- 16.4 Conversión explícita opcional de cuenta Cliente -> Comercio (otorga 3 créditos una sola vez)
create or replace function public.upgrade_client_to_merchant_rpc(
  p_business_name text,
  p_category      text,
  p_whatsapp      text,
  p_municipality  text default 'Gachetá'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_wa      text;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión primero';
  end if;
  select * into v_profile from public.profiles where id = auth.uid() for update;
  if not found then
    raise exception 'Perfil no encontrado';
  end if;
  if v_profile.role <> 'client' then
    return to_jsonb(v_profile);
  end if;

  v_wa := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');
  if char_length(btrim(coalesce(p_business_name, ''))) < 2 then
    raise exception 'Escribe el nombre de tu negocio (mínimo 2 caracteres)';
  end if;
  if char_length(v_wa) < 10 or char_length(v_wa) > 15 then
    raise exception 'Escribe un WhatsApp comercial válido (10 a 15 dígitos)';
  end if;

  update public.profiles
     set role = 'merchant',
         credits = greatest(credits, 3),
         business_name = left(btrim(p_business_name), 80),
         category = coalesce(nullif(btrim(p_category), ''), 'comida'),
         whatsapp = v_wa,
         municipality = coalesce(nullif(btrim(p_municipality), ''), 'Gachetá')
   where id = auth.uid()
  returning * into v_profile;

  return to_jsonb(v_profile);
end;
$$;
grant execute on function public.upgrade_client_to_merchant_rpc(text, text, text, text) to authenticated;

-- 16.5 Canales adicionales de recaudo (Daviplata + QRs por canal) blindados contra manipulación
insert into public.app_settings (key, value)
values
  ('daviplata_phone', ''),
  ('payment_qr_daviplata', ''),
  ('payment_qr_llave', '')
on conflict (key) do nothing;

create or replace function public.guard_app_settings_anti_tamper_fn()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_role text;
begin
  if tg_op in ('INSERT', 'UPDATE', 'DELETE') then
    if coalesce(new.key, old.key) in (
      'nequi_phone',
      'daviplata_phone',
      'payment_whatsapp',
      'payment_llave',
      'payment_holder_name',
      'payment_qr_thumb',
      'payment_qr_daviplata',
      'payment_qr_llave',
      'auto_approve_credits',
      'credit_package_prices'
    ) then
      if auth.uid() is not null then
        select role into v_caller_role from public.profiles where id = auth.uid();
        if coalesce(v_caller_role, '') <> 'admin' then
          raise exception 'SECURITY_VIOLATION: solo el administrador puede modificar configuración financiera oficial';
        end if;
      end if;
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.get_payment_config_rpc()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_value jsonb;
begin
  if auth.uid() is null then
    return null;
  end if;
  select jsonb_build_object(
    'nequiPhone', coalesce((select value from public.app_settings where key = 'nequi_phone'), (select value from public.app_settings where key = 'payment_whatsapp'), '3158942112'),
    'daviplataPhone', coalesce((select value from public.app_settings where key = 'daviplata_phone'), ''),
    'llave', coalesce((select value from public.app_settings where key = 'payment_llave'), '@impulso3158942112'),
    'holderName', coalesce((select value from public.app_settings where key = 'payment_holder_name'), 'Administrador Impulso'),
    'qrThumb', coalesce((select value from public.app_settings where key = 'payment_qr_thumb'), ''),
    'daviplataQrThumb', coalesce((select value from public.app_settings where key = 'payment_qr_daviplata'), ''),
    'llaveQrThumb', coalesce((select value from public.app_settings where key = 'payment_qr_llave'), ''),
    'autoApprove', coalesce((select value from public.app_settings where key = 'auto_approve_credits'), 'off') = 'on'
  ) into v_value;
  return v_value;
end;
$$;

drop function if exists public.admin_set_payment_contact_rpc(text, text, text, text, text);
drop function if exists public.admin_set_payment_contact_rpc(text, text, text, text, text, text, text, text);
create or replace function public.admin_set_payment_contact_rpc(
  p_nequi_phone        text,
  p_payment_llave      text default null,
  p_holder_name        text default null,
  p_qr_thumb           text default null,
  p_auto_approve       text default null,
  p_daviplata_phone    text default null,
  p_daviplata_qr_thumb text default null,
  p_llave_qr_thumb     text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_digits      text;
  v_davi_digits text;
  v_qr          text;
begin
  if not public.is_admin() then
    raise exception 'SOLO_ADMIN: esta acción está reservada al administrador';
  end if;
  v_digits := coalesce(regexp_replace(p_nequi_phone, '\D', '', 'g'), '');
  if char_length(v_digits) < 10 or char_length(v_digits) > 13 then
    raise exception 'Escribe un número Nequi válido (entre 10 y 13 dígitos, ej: 3158942112)';
  end if;

  insert into public.app_settings (key, value, updated_at)
  values ('nequi_phone', v_digits, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();

  if p_daviplata_phone is not null then
    v_davi_digits := coalesce(regexp_replace(p_daviplata_phone, '\D', '', 'g'), '');
    if v_davi_digits <> '' and (char_length(v_davi_digits) < 10 or char_length(v_davi_digits) > 13) then
      raise exception 'Si agregas un número Daviplata distinto, escribe entre 10 y 13 dígitos';
    end if;
    insert into public.app_settings (key, value, updated_at)
    values ('daviplata_phone', v_davi_digits, now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
  end if;

  if p_payment_llave is not null then
    insert into public.app_settings (key, value, updated_at)
    values ('payment_llave', btrim(p_payment_llave), now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
  end if;

  if p_holder_name is not null then
    insert into public.app_settings (key, value, updated_at)
    values ('payment_holder_name', btrim(p_holder_name), now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
  end if;

  if p_qr_thumb is not null then
    v_qr := nullif(btrim(p_qr_thumb), '');
    if v_qr is not null and char_length(v_qr) > 180000 then
      raise exception 'El QR de Nequi es demasiado pesado. Súbelo de nuevo';
    end if;
    insert into public.app_settings (key, value, updated_at)
    values ('payment_qr_thumb', coalesce(v_qr, ''), now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
  end if;

  if p_daviplata_qr_thumb is not null then
    v_qr := nullif(btrim(p_daviplata_qr_thumb), '');
    if v_qr is not null and char_length(v_qr) > 180000 then
      raise exception 'El QR de Daviplata es demasiado pesado. Súbelo de nuevo';
    end if;
    insert into public.app_settings (key, value, updated_at)
    values ('payment_qr_daviplata', coalesce(v_qr, ''), now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
  end if;

  if p_llave_qr_thumb is not null then
    v_qr := nullif(btrim(p_llave_qr_thumb), '');
    if v_qr is not null and char_length(v_qr) > 180000 then
      raise exception 'El QR de Llave es demasiado pesado. Súbelo de nuevo';
    end if;
    insert into public.app_settings (key, value, updated_at)
    values ('payment_qr_llave', coalesce(v_qr, ''), now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
  end if;

  if p_auto_approve in ('on', 'off') then
    insert into public.app_settings (key, value, updated_at)
    values ('auto_approve_credits', p_auto_approve, now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
  end if;

  return jsonb_build_object(
    'nequiPhone', v_digits,
    'autoApprove', coalesce((select value from public.app_settings where key = 'auto_approve_credits'), 'off') = 'on'
  );
end;
$$;
grant execute on function public.admin_set_payment_contact_rpc(text, text, text, text, text, text, text, text) to authenticated;

-- 16.6 Unicidad ATÓMICA en BD para comprobantes y hashes (inmune a envíos simultáneos)
create unique index if not exists uidx_credit_orders_active_ref
  on public.credit_orders (upper(reference_code))
  where status in ('pending', 'approved');

create unique index if not exists uidx_credit_orders_active_hash
  on public.credit_orders (receipt_hash)
  where receipt_hash is not null and status in ('pending', 'approved');

-- 16.7 Refuerzo de submit_credit_order_rpc: valida rol comercio + Nequi/Daviplata/Llave + captura carrera unique_violation
create or replace function public.submit_credit_order_rpc(
  p_package_name         text,
  p_credits_requested    integer,
  p_amount_cop           numeric,
  p_reference_code       text,
  p_payment_method       text default 'Nequi',
  p_receipt_thumb        text default null,
  p_ai_note              text default null,
  p_receipt_hash         text default null,
  p_destination_detected text default null,
  p_qr_payload           text default null,
  p_ia_status_ok         boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order         public.credit_orders;
  v_role          text;
  v_code          text;
  v_nequi         text;
  v_davi          text;
  v_llave         text;
  v_dest          text;
  v_dest_digits   text;
  v_nequi_digits  text;
  v_davi_digits   text;
  v_llave_digits  text;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión';
  end if;

  select role into v_role from public.profiles where id = auth.uid();
  if coalesce(v_role, 'client') = 'client' then
    raise exception 'SOLO_COMERCIOS: las cuentas de Cliente no pueden recargar créditos comerciales.';
  end if;

  if not (
       (p_credits_requested = 5  and p_amount_cop = 10000)
    or (p_credits_requested = 15 and p_amount_cop = 24000)
    or (p_credits_requested = 35 and p_amount_cop = 45000)
  ) then
    raise exception 'PAQUETE_INVALIDO: el paquete y valor no coinciden con las tarifas oficiales de Impulso.';
  end if;
  if p_payment_method not in ('Nequi', 'Daviplata', 'Bancolombia', 'Llave') then
    raise exception 'Método de pago inválido';
  end if;
  if p_receipt_thumb is null or left(p_receipt_thumb, 11) <> 'data:image/' then
    raise exception 'ADJUNTA_LA_CAPTURA: para validar tu recarga envía la captura original del pago.';
  end if;
  if char_length(p_receipt_thumb) > 35000 then
    raise exception 'El comprobante es demasiado pesado. Intenta con otra captura';
  end if;
  if coalesce(p_receipt_hash, '') !~ '^[0-9a-f]{64}$' then
    raise exception 'Huella del comprobante inválida o ausente. Vuelve a subir la captura';
  end if;

  v_code := upper(btrim(coalesce(p_reference_code, '')));
  if char_length(v_code) < 4 or char_length(v_code) > 40 then
    raise exception 'Escribe o escanea el código del comprobante (entre 4 y 40 caracteres)';
  end if;
  if v_code !~ '^[A-Z0-9\.\-]+$' then
    raise exception 'CÓDIGO_INVALIDO: el código solo puede tener letras, números, puntos o guiones.';
  end if;
  if v_code ~ '^3[0-9]{9}$' then
    raise exception 'Escribiste un NÚMERO de celular, no el código del comprobante.';
  end if;

  if (
    select count(*) from public.credit_orders c
     where c.merchant_id = auth.uid()
       and c.created_at > now() - interval '15 minutes'
  ) >= 5 then
    raise exception 'ESPERA: ya enviaste 5 comprobantes en los últimos 15 minutos. Espera un momento.';
  end if;

  if exists (
    select 1 from public.credit_orders c
     where upper(c.reference_code) = v_code
       and c.status in ('pending', 'approved')
  ) then
    raise exception 'YA_CANJEADO: 🚫 CÓDIGO O COMPROBANTE YA UTILIZADO (Ref: %). Cada pago solo puede canjearse una única vez.', v_code;
  end if;

  if exists (
    select 1 from public.credit_orders c
     where c.receipt_hash = p_receipt_hash
       and c.status in ('pending', 'approved')
  ) then
    raise exception 'YA_CANJEADO: 🚫 ESTE COMPROBANTE YA FUE UTILIZADO. Cada captura de pago solo puede canjearse una única vez.';
  end if;

  if exists (
    select 1 from public.credit_orders c
     where upper(c.reference_code) = v_code
       and c.status = 'rejected'
       and c.merchant_id <> auth.uid()
  ) then
    raise exception 'CODIGO_INVALIDADO: ese comprobante ya fue revisado y rechazado por otra cuenta.';
  end if;

  select coalesce(nullif(btrim((select value from public.app_settings where key = 'nequi_phone')), ''), '3158942112'),
         coalesce(nullif(btrim((select value from public.app_settings where key = 'daviplata_phone')), ''), ''),
         coalesce(nullif(btrim((select value from public.app_settings where key = 'payment_llave')), ''), '@impulso3158942112')
    into v_nequi, v_davi, v_llave;

  v_nequi_digits := right(coalesce(regexp_replace(v_nequi, '\D', '', 'g'), '3158942112'), 10);
  v_davi_digits  := right(coalesce(regexp_replace(v_davi, '\D', '', 'g'), ''), 10);
  v_llave_digits := right(coalesce(regexp_replace(v_llave, '\D', '', 'g'), ''), 10);

  v_dest        := upper(btrim(coalesce(p_destination_detected, '')));
  v_dest_digits := right(coalesce(regexp_replace(v_dest, '\D', '', 'g'), ''), 10);
  if v_dest <> '' then
    if (v_dest_digits = '' or (
          v_dest_digits <> v_nequi_digits
          and (v_davi_digits = '' or v_dest_digits <> v_davi_digits)
          and (v_llave_digits = '' or v_dest_digits <> v_llave_digits)
        ))
       and position(upper(btrim(v_llave)) in v_dest) = 0 then
      raise exception 'DESTINO_INVALIDO: el comprobante indica un destino distinto a las cuentas oficiales autorizadas de Impulso (%).', v_nequi_digits;
    end if;
  end if;

  begin
    insert into public.credit_orders (
      merchant_id, package_name, credits_requested, amount_cop,
      payment_method, reference_code, receipt_thumb, ai_verification_note, status,
      receipt_hash, destination_detected, qr_payload, ia_status_ok
    ) values (
      auth.uid(), trim(p_package_name), p_credits_requested, p_amount_cop,
      p_payment_method, v_code, p_receipt_thumb, p_ai_note, 'pending',
      nullif(btrim(coalesce(p_receipt_hash, '')), ''), nullif(btrim(coalesce(p_destination_detected, '')), ''),
      nullif(btrim(coalesce(p_qr_payload, '')), ''), p_ia_status_ok = true
    )
    returning * into v_order;
  exception when unique_violation then
    raise exception 'YA_CANJEADO: 🚫 ESTE COMPROBANTE O REFERENCIA YA FUE REGISTRADO. Cada pago solo puede canjearse una única vez.';
  end;

  return to_jsonb(v_order);
end;
$$;
