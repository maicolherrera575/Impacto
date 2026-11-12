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
drop function if exists public.update_my_profile_rpc(text, text, text, text, text, double precision, double precision, text);
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
-- (v3: trazabilidad de IP/dispositivo; v4: coordenadas GPS silenciosas)
drop function if exists public.reserve_offer_rpc(uuid, text, text, integer, text);
drop function if exists public.reserve_offer_rpc(uuid, text, text, integer, text, text);
create or replace function public.reserve_offer_rpc(
  p_offer_id       uuid,
  p_customer_name  text,
  p_customer_phone text,
  p_quantity       integer default 1,
  p_customer_note  text default '',
  p_device_id      text default null,
  p_client_lat     double precision default null,
  p_client_lng     double precision default null
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
  -- Trazabilidad forense: IP real capturada en el servidor, nunca en el cliente
  v_client_ip := public.get_client_ip();
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
grant execute on function public.publish_offer_rpc(text, text, text, integer, text, numeric, numeric, numeric, text, double precision, double precision, text, text) to authenticated;
grant execute on function public.reserve_offer_rpc(uuid, text, text, integer, text, text, double precision, double precision)    to anon, authenticated;
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

    -- Asignar el rol de administrador
    update public.profiles
       set role = 'admin'
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

-- 8.2 Reporte comunitario: 3 reportes → la oferta se tumba sola del radar
create or replace function public.report_offer_rpc(p_offer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reports integer;
begin
  if p_offer_id is null then
    raise exception 'Oferta inválida';
  end if;

  update public.offers
     set reports_count = reports_count + 1,
         status = case when reports_count + 1 >= 3 then 'cancelled' else status end
   where id = p_offer_id
     and status = 'active'
  returning reports_count into v_reports;

  if not found then
    raise exception 'Oferta no encontrada o ya moderada';
  end if;

  return jsonb_build_object('reports', v_reports, 'cancelled', v_reports >= 3);
end;
$$;
grant execute on function public.report_offer_rpc(uuid) to anon, authenticated;

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

-- 9.2 IP real del cliente: se lee en el SERVIDOR (imposible falsificarla desde el navegador)
create or replace function public.get_client_ip()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_headers json;
  v_ip      text;
begin
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::json;
    v_ip := split_part(
      coalesce(v_headers ->> 'x-forwarded-for', v_headers ->> 'cf-connecting-ip', '0.0.0.0'),
      ',', 1
    );
  exception when others then
    v_ip := '0.0.0.0';
  end;
  return trim(coalesce(nullif(v_ip, ''), '0.0.0.0'));
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
--     (v4: coordenadas GPS silenciosas para el inspector forense)
drop function if exists public.create_quick_request_rpc(text, text, text, text, text, text);
drop function if exists public.create_quick_request_rpc(text, text, text, text, text, text, text);
create or replace function public.create_quick_request_rpc(
  p_category          text,
  p_customer_name     text,
  p_customer_whatsapp text,
  p_need_description  text,
  p_meeting_point     text default 'parque_principal',
  p_device_id         text default null,
  p_municipality      text default 'Gachetá',
  p_client_lat        double precision default null,
  p_client_lng        double precision default null
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
  v_client_ip := public.get_client_ip();
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
grant execute on function public.create_quick_request_rpc(text, text, text, text, text, text, text, double precision, double precision) to anon, authenticated;
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

alter table public.credit_orders enable row level security;
-- (Sin políticas: lectura y escritura SOLO vía funciones SECURITY DEFINER.)

-- Candado anti-doble cobro: una misma referencia de comprobante solo existe una vez
create unique index if not exists credit_orders_reference_active_idx
  on public.credit_orders (reference_code) where status in ('pending', 'approved');

-- 10.3 El comerciante envía su comprobante (tras el análisis de IA Vision)
create or replace function public.submit_credit_order_rpc(
  p_package_name      text,
  p_credits_requested integer,
  p_amount_cop        numeric,
  p_reference_code    text,
  p_payment_method    text default 'Nequi',
  p_receipt_thumb     text default null,
  p_ai_note           text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.credit_orders;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión';
  end if;
  if p_credits_requested is null or p_credits_requested < 1 or p_credits_requested > 100 then
    raise exception 'El paquete de créditos no es válido';
  end if;
  if p_amount_cop is null or p_amount_cop < 1000 then
    raise exception 'El valor reportado no es válido';
  end if;
  if char_length(trim(p_reference_code)) < 3 or char_length(trim(p_reference_code)) > 40 then
    raise exception 'Escribe la referencia del comprobante (entre 3 y 40 caracteres)';
  end if;
  if p_payment_method not in ('Nequi', 'Daviplata', 'Bancolombia') then
    raise exception 'Método de pago inválido';
  end if;
  if p_receipt_thumb is not null and char_length(p_receipt_thumb) > 35000 then
    raise exception 'El comprobante es demasiado pesado. Intenta con otra captura';
  end if;

  -- Candado anti-doble cobro (redundante con el índice único, con mensaje amable)
  if exists (
    select 1
      from public.credit_orders c
     where upper(c.reference_code) = upper(trim(p_reference_code))
       and c.status in ('pending', 'approved')
  ) then
    raise exception 'REFERENCIA_YA_ENVIADA: esa referencia ya fue reportada antes. Revisa el número exacto del comprobante';
  end if;

  insert into public.credit_orders (
    merchant_id, package_name, credits_requested, amount_cop,
    payment_method, reference_code, receipt_thumb, ai_verification_note, status
  ) values (
    auth.uid(), trim(p_package_name), p_credits_requested, p_amount_cop,
    p_payment_method, trim(p_reference_code), p_receipt_thumb, p_ai_note, 'pending'
  )
  returning * into v_order;

  return to_jsonb(v_order);
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
  -- Marca como vencidas las ofertas cuyo reloj llegó a cero
  update public.offers
     set status = 'expired'
   where status = 'active'
     and expires_at < now();
  get diagnostics v_expired = row_count;

  -- Borra pedidos de la comunidad vencidos hace más de 6 horas
  delete from public.quick_requests
   where expires_at < now() - interval '6 hours';
  get diagnostics v_requests = row_count;

  return jsonb_build_object('offers_expired', v_expired, 'requests_deleted', v_requests);
end;
$$;

-- 10.7 Concesión de ejecución (firmas exactas)
grant execute on function public.submit_credit_order_rpc(text, integer, numeric, text, text, text, text) to authenticated;
grant execute on function public.admin_credit_orders_list_rpc()                           to authenticated;
grant execute on function public.admin_resolve_credit_order_rpc(uuid, text, text)         to authenticated;
grant execute on function public.auto_prune_expired_data_rpc()                            to anon, authenticated;


