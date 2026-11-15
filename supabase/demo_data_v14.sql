-- ============================================================================
--  IMPULSO V14 · OFERTAS DEMO NUEVAS (reemplaza a las que ya vencieron)
--  Ejecutar en: Supabase Dashboard → SQL Editor → New query → pegar todo → RUN
--
--  Qué hace (es idempotente: puedes correrlo las veces que quieras):
--   1. Revive TODAS las ofertas demo vencidas de los 6 comercios demo
--      (status → 'active', cupos restaurados, nueva fecha de expiración).
--   2. Verifica y activa los comercios demo (is_verified, is_active, créditos).
--   3. Inserta 10 OFERTAS NUEVAS V14 en rubros variados (comida, asados,
--      panadería, turismo, agro, transporte, ferretería, salud, belleza)
--      con expiraciones cortas para que el radar se vea vivo HOY.
--
--  Nota: reutiliza los comercios demo del "Modo Vitrina" (Panadería La Espiga,
--  El Fogón de la Abuela, La Rapidita, El Campo, El Constructor, La Salud).
-- ============================================================================

-- 1) Reactivar comercios demo (moderación RLS exige activos y verificados) ----
update public.profiles
   set is_verified = true,
       is_active   = true,
       credits     = 10
 where business_name in (
   'Panadería La Espiga', 'Restaurante El Fogón de la Abuela',
   'Transportes La Rapidita', 'Agroinsumos El Campo',
   'Ferretería El Constructor', 'Droguería La Salud'
 );

-- 2) Revive ofertas demo vencidas (aunque ya tengan apartados) ----------------
update public.offers
   set status          = 'active',
       available_quota = total_quota,
       expires_at      = now() + interval '24 hours'
 where status in ('expired', 'sold_out', 'cancelled')
   and merchant_id in (
     select id from public.profiles
      where business_name in (
        'Panadería La Espiga', 'Restaurante El Fogón de la Abuela',
        'Transportes La Rapidita', 'Agroinsumos El Campo',
        'Ferretería El Constructor', 'Droguería La Salud'
      )
   );

-- 3) OFERTAS NUEVAS V14 (se insertan una sola vez, por título único) ----------

-- 🥐 Panadería La Espiga
insert into public.offers (merchant_id, category, title, description, emoji_icon, original_price, promo_price, total_quota, available_quota, municipality, lat, lng, expires_at, status)
select p.id, 'comida', 'Docena de pandeyucas + gaseosa 1.5L',
       'Pandeyucas crujientes del horno de leña con gaseosa bien fría para compartir en familia. Solo hoy.', '🥯',
       22000, 15000, 15, 15, 'Gachetá', 4.8181, -73.6339, now() + interval '10 hours', 'active'
  from public.profiles p
 where p.business_name = 'Panadería La Espiga'
   and not exists (select 1 from public.offers o where o.title = 'Docena de pandeyucas + gaseosa 1.5L');

insert into public.offers (merchant_id, category, title, description, emoji_icon, original_price, promo_price, total_quota, available_quota, municipality, lat, lng, expires_at, status)
select p.id, 'comida', 'Mojicón relleno de arequipe 2x1',
       'Mojicones suaves rellenos de arequipe: llévale 2 y paga 1. Salen calienticos cada tarde.', '🍩',
       10000, 5000, 24, 24, 'Gachetá', 4.8181, -73.6339, now() + interval '8 hours', 'active'
  from public.profiles p
 where p.business_name = 'Panadería La Espiga'
   and not exists (select 1 from public.offers o where o.title = 'Mojicón relleno de arequipe 2x1');

-- 🍖 Restaurante El Fogón de la Abuela
insert into public.offers (merchant_id, category, title, description, emoji_icon, original_price, promo_price, total_quota, available_quota, municipality, lat, lng, expires_at, status)
select p.id, 'comida', 'Costillitas BBQ para 2 + limonada',
       'Medio kilo de costillitas bañadas en BBQ de la casa, papas criollas y 2 limonadas. Fin de semana perfecto.', '🍖',
       58000, 42000, 12, 12, 'Gachetá', 4.8152, -73.6321, now() + interval '36 hours', 'active'
  from public.profiles p
 where p.business_name = 'Restaurante El Fogón de la Abuela'
   and not exists (select 1 from public.offers o where o.title = 'Costillitas BBQ para 2 + limonada');

insert into public.offers (merchant_id, category, title, description, emoji_icon, original_price, promo_price, total_quota, available_quota, municipality, lat, lng, expires_at, status)
select p.id, 'comida', 'Sancocho de gallina criolla (domingo)',
       'El sancocho de siempre: gallina de patio, plátano, yuca y papa. Ración grande con arroz y arepa.', '🍲',
       25000, 18000, 20, 20, 'Gachetá', 4.8152, -73.6321, now() + interval '48 hours', 'active'
  from public.profiles p
 where p.business_name = 'Restaurante El Fogón de la Abuela'
   and not exists (select 1 from public.offers o where o.title = 'Sancocho de gallina criolla (domingo)');

-- 🏊 Turismo: cabaña con piscina (usa el perfil del Fogón para la vitrina)
insert into public.offers (merchant_id, category, title, description, emoji_icon, original_price, promo_price, total_quota, available_quota, municipality, lat, lng, expires_at, status)
select p.id, 'hoteles_turismo', 'Plan cabaña + piscina 1 noche (hasta 6 personas)',
       'Cabaña campestre con piscina, BBQ y zona de hamacas. Ideal para plan familiar cerca del pueblo.', '🏊',
       220000, 160000, 4, 4, 'Gachetá', 4.8210, -73.6400, now() + interval '96 hours', 'active'
  from public.profiles p
 where p.business_name = 'Restaurante El Fogón de la Abuela'
   and not exists (select 1 from public.offers o where o.title = 'Plan cabaña + piscina 1 noche (hasta 6 personas)');

-- 🚜 Agroinsumos El Campo
insert into public.offers (merchant_id, category, title, description, emoji_icon, original_price, promo_price, total_quota, available_quota, municipality, lat, lng, expires_at, status)
select p.id, 'agro_mercado', 'Saco de concentrado vacuno 40kg',
       'Concentrado para engorde de ganado con proteína garantizada. Precio de bodega al por mayor.', '🐄',
       128000, 105000, 20, 20, 'Gachetá', 4.8141, -73.6352, now() + interval '72 hours', 'active'
  from public.profiles p
 where p.business_name = 'Agroinsumos El Campo'
   and not exists (select 1 from public.offers o where o.title = 'Saco de concentrado vacuno 40kg');

insert into public.offers (merchant_id, category, title, description, emoji_icon, original_price, promo_price, total_quota, available_quota, municipality, lat, lng, expires_at, status)
select p.id, 'agro_mercado', 'Jornada de vacunación para perros y gatos',
       'Vacuna múltiple + desparasitación interna a precio solidario. Cuota limitada este mes.', '💉',
       45000, 30000, 16, 16, 'Gachetá', 4.8141, -73.6352, now() + interval '96 hours', 'active'
  from public.profiles p
 where p.business_name = 'Agroinsumos El Campo'
   and not exists (select 1 from public.offers o where o.title = 'Jornada de vacunación para perros y gatos');

-- 🚚 Transportes La Rapidita
insert into public.offers (merchant_id, category, title, description, emoji_icon, original_price, promo_price, total_quota, available_quota, municipality, lat, lng, expires_at, status)
select p.id, 'transporte_flete', 'Mudanza completa dentro de Gachetá',
       'Camioneta con ayudante: carga, transporte y descarga de tu mudanza en el casco urbano.', '🛻',
       150000, 95000, 8, 8, 'Gachetá', 4.8195, -73.6360, now() + interval '60 hours', 'active'
  from public.profiles p
 where p.business_name = 'Transportes La Rapidita'
   and not exists (select 1 from public.offers o where o.title = 'Mudanza completa dentro de Gachetá');

-- 🛠️ Ferretería El Constructor
insert into public.offers (merchant_id, category, title, description, emoji_icon, original_price, promo_price, total_quota, available_quota, municipality, lat, lng, expires_at, status)
select p.id, 'hogar_construccion', 'Bulto de cemento + 2 sacos de arena',
       'Combo de obra listo para tu remodelación: cemento de 50kg con dos sacos de arena de mina.', '🧱',
       68000, 55000, 14, 14, 'Gachetá', 4.8172, -73.6310, now() + interval '72 hours', 'active'
  from public.profiles p
 where p.business_name = 'Ferretería El Constructor'
   and not exists (select 1 from public.offers o where o.title = 'Bulto de cemento + 2 sacos de arena');

-- 💇 Belleza y salud (usa el perfil de la Droguería para la vitrina)
insert into public.offers (merchant_id, category, title, description, emoji_icon, original_price, promo_price, total_quota, available_quota, municipality, lat, lng, expires_at, status)
select p.id, 'salud_belleza', 'Corte + brushing para señora y niña',
       'Combo de salón: corte a tijera y brushing para dos personas el mismo día.', '💇',
       55000, 38000, 10, 10, 'Gachetá', 4.8160, -73.6341, now() + interval '48 hours', 'active'
  from public.profiles p
 where p.business_name = 'Droguería La Salud'
   and not exists (select 1 from public.offers o where o.title = 'Corte + brushing para señora y niña');

-- 4) Resultado visible en el SQL Editor ---------------------------------------
select business_name, count(o.id) as ofertas_activas
  from public.profiles p
  left join public.offers o
         on o.merchant_id = p.id and o.status = 'active' and o.expires_at > now()
 where p.business_name in (
   'Panadería La Espiga', 'Restaurante El Fogón de la Abuela',
   'Transportes La Rapidita', 'Agroinsumos El Campo',
   'Ferretería El Constructor', 'Droguería La Salud'
 )
 group by business_name
 order by ofertas_activas desc;
