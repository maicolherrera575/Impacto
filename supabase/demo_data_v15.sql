-- ============================================================================
--  IMPULSO V15 · NUEVA TANDA DE OFERTAS DEMO (solo para visualizar la página
--  en etapa de desarrollo — las anteriores ya cumplieron su tiempo)
--
--  Ejecutar en: Supabase Dashboard → SQL Editor → New query → pegar TODO → RUN
--  Es idempotente: puedes correrlo las veces que quieras sin duplicar nada.
--
--  Qué hace:
--   1. Reactiva y verifica los 6 comercios demo (moderación RLS los exige
--      activos para que aparezcan en el radar).
--   2. REVIVE todas las ofertas demo vencidas (nueva expiración + cupos).
--   3. Inserta 12 OFERTAS DEMO NUEVAS con títulos diferentes (empanadas,
--      chuzo, picada, licuados, almuerzo, pizza, glamping, pintura,
--      boutique, truchas, moto-transporte y odontología) con vencimientos
--      frescos de 2 a 4 días para que el radar se vea vivo HOY.
-- ============================================================================

-- 1) Reactivar comercios demo -------------------------------------------------
update public.profiles
   set is_verified = true,
       is_active   = true,
       credits     = 10
 where business_name in (
   'Panadería La Espiga', 'Restaurante El Fogón de la Abuela',
   'Transportes La Rapidita', 'Agroinsumos El Campo',
   'Ferretería El Constructor', 'Droguería La Salud'
 );

-- 2) Revive ofertas demo vencidas (aunque tengan apartados) -------------------
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

-- 3) OFERTAS DEMO NUEVAS V15 (una sola vez, por título único) ------------------

-- 🥟 Panadería La Espiga (comida)
insert into public.offers (merchant_id, category, title, description, emoji_icon, original_price, promo_price, total_quota, available_quota, municipality, lat, lng, expires_at, status)
select p.id, 'comida', 'Docena de empanadas de pollo con aji',
       'Empanadas doraditas recién fritas con ají de la casa. La docena ideal para la tarde con la familia.', '🥟',
       24000, 16000, 18, 18, 'Gachetá', 4.8181, -73.6339, now() + interval '9 hours', 'active'
  from public.profiles p
 where p.business_name = 'Panadería La Espiga'
   and not exists (select 1 from public.offers o where o.title = 'Docena de empanadas de pollo con aji');

insert into public.offers (merchant_id, category, title, description, emoji_icon, original_price, promo_price, total_quota, available_quota, municipality, lat, lng, expires_at, status)
select p.id, 'comida', 'Almojábanas + café por solo hoy',
       'Media docena de almojábanas calienticas con un café de la montaña. Desayuno completo express.', '🧆',
       12000, 8000, 25, 25, 'Gachetá', 4.8181, -73.6339, now() + interval '6 hours', 'active'
  from public.profiles p
 where p.business_name = 'Panadería La Espiga'
   and not exists (select 1 from public.offers o where o.title = 'Almojábanas + café por solo hoy');

-- 🍢 Restaurante El Fogón de la Abuela (comida)
insert into public.offers (merchant_id, category, title, description, emoji_icon, original_price, promo_price, total_quota, available_quota, municipality, lat, lng, expires_at, status)
select p.id, 'comida', 'Chuzo de pollo + papa criolla',
       'Chuzo jugoso asado al carbón con papa criolla y arepa. Especial de viernes y sábado.', '🍢',
       20000, 14000, 22, 22, 'Gachetá', 4.8152, -73.6321, now() + interval '40 hours', 'active'
  from public.profiles p
 where p.business_name = 'Restaurante El Fogón de la Abuela'
   and not exists (select 1 from public.offers o where o.title = 'Chuzo de pollo + papa criolla');

insert into public.offers (merchant_id, category, title, description, emoji_icon, original_price, promo_price, total_quota, available_quota, municipality, lat, lng, expires_at, status)
select p.id, 'comida', 'Picada familiar para 4 personas',
       'Picada abundante: carne, pollo, chorizo, papa, yuca y plátano. Para compartir entre 4 sin pelearse 🤣', '🍱',
       76000, 58000, 10, 10, 'Gachetá', 4.8152, -73.6321, now() + interval '48 hours', 'active'
  from public.profiles p
 where p.business_name = 'Restaurante El Fogón de la Abuela'
   and not exists (select 1 from public.offers o where o.title = 'Picada familiar para 4 personas');

insert into public.offers (merchant_id, category, title, description, emoji_icon, original_price, promo_price, total_quota, available_quota, municipality, lat, lng, expires_at, status)
select p.id, 'comida', 'Pizza artesanal de la casa 2x1',
       'Pizza de masa artesanal con queso extra: pide una y te llevamos dos. Solo por este fin de semana.', '🍕',
       38000, 19000, 14, 14, 'Gachetá', 4.8152, -73.6321, now() + interval '56 hours', 'active'
  from public.profiles p
 where p.business_name = 'Restaurante El Fogón de la Abuela'
   and not exists (select 1 from public.offers o where o.title = 'Pizza artesanal de la casa 2x1');

-- 🏊 Turismo: glamping / truchas (usa perfiles demo como vitrina)
insert into public.offers (merchant_id, category, title, description, emoji_icon, original_price, promo_price, total_quota, available_quota, municipality, lat, lng, expires_at, status)
select p.id, 'hoteles_turismo', 'Glamping para 2 con desayuno campesino',
       'Carpa transparente para ver las estrellas, fogata y desayuno de la montaña. Escápate al Guavio.', '⛺',
       180000, 130000, 5, 5, 'Gachetá', 4.8230, -73.6450, now() + interval '96 hours', 'active'
  from public.profiles p
 where p.business_name = 'Restaurante El Fogón de la Abuela'
   and not exists (select 1 from public.offers o where o.title = 'Glamping para 2 con desayuno campesino');

insert into public.offers (merchant_id, category, title, description, emoji_icon, original_price, promo_price, total_quota, available_quota, municipality, lat, lng, expires_at, status)
select p.id, 'hoteles_turismo', 'Día de pesca de trucha + asado',
       'Lago de truchas con carnada, asado al carbón y pasabocas. Plan familiar de un día completo.', '🎣',
       90000, 65000, 8, 8, 'Gachetá', 4.8240, -73.6480, now() + interval '80 hours', 'active'
  from public.profiles p
 where p.business_name = 'Agroinsumos El Campo'
   and not exists (select 1 from public.offers o where o.title = 'Día de pesca de trucha + asado');

-- 🚜 Agroinsumos El Campo (agro_mercado)
insert into public.offers (merchant_id, category, title, description, emoji_icon, original_price, promo_price, total_quota, available_quota, municipality, lat, lng, expires_at, status)
select p.id, 'agro_mercado', 'Kit de semillas de cebolla y lechuga',
       'Kit completo de semillas certificadas para tu huerta o cultivo, con guía de siembra incluida.', '🧅',
       35000, 25000, 20, 20, 'Gachetá', 4.8141, -73.6352, now() + interval '72 hours', 'active'
  from public.profiles p
 where p.business_name = 'Agroinsumos El Campo'
   and not exists (select 1 from public.offers o where o.title = 'Kit de semillas de cebolla y lechuga');

-- 🚚 Transportes La Rapidita (transporte_flete)
insert into public.offers (merchant_id, category, title, description, emoji_icon, original_price, promo_price, total_quota, available_quota, municipality, lat, lng, expires_at, status)
select p.id, 'transporte_flete', 'Viaje Gachetá → Bogotá en moto-transporte',
       'Llevamos maletas, paquetes y encomiendas a Bogotá el mismo día. Recogida a domicilio.', '🏍️',
       90000, 60000, 12, 12, 'Gachetá', 4.8195, -73.6360, now() + interval '60 hours', 'active'
  from public.profiles p
 where p.business_name = 'Transportes La Rapidita'
   and not exists (select 1 from public.offers o where o.title = 'Viaje Gachetá → Bogotá en moto-transporte');

-- 🛠️ Ferretería El Constructor (hogar_construccion)
insert into public.offers (merchant_id, category, title, description, emoji_icon, original_price, promo_price, total_quota, available_quota, municipality, lat, lng, expires_at, status)
select p.id, 'hogar_construccion', 'Galón de pintura + rodillo y brocha',
       'Pinta tu casa con un galón de pintura interior del color que elijas + kit de rodillo y brocha.', '🎨',
       115000, 89000, 10, 10, 'Gachetá', 4.8172, -73.6310, now() + interval '72 hours', 'active'
  from public.profiles p
 where p.business_name = 'Ferretería El Constructor'
   and not exists (select 1 from public.offers o where o.title = 'Galón de pintura + rodillo y brocha');

-- 💊 Droguería La Salud (salud_belleza)
insert into public.offers (merchant_id, category, title, description, emoji_icon, original_price, promo_price, total_quota, available_quota, municipality, lat, lng, expires_at, status)
select p.id, 'salud_belleza', 'Toma de presión + glucosa gratis con compra',
       'Controla tu salud: medimos tu presión y glucosa GRATIS con cualquier compra sobre $30.000.', '🩺',
       30000, 30000, 30, 30, 'Gachetá', 4.8160, -73.6341, now() + interval '48 hours', 'active'
  from public.profiles p
 where p.business_name = 'Droguería La Salud'
   and not exists (select 1 from public.offers o where o.title = 'Toma de presión + glucosa gratis con compra');

insert into public.offers (merchant_id, category, title, description, emoji_icon, original_price, promo_price, total_quota, available_quota, municipality, lat, lng, expires_at, status)
select p.id, 'salud_belleza', 'Kit de limpieza facial 3 pasos',
       'Rutina completa: limpiador, tónico y crema hidratante para el cuidado de tu piel.', '🧴',
       68000, 49000, 12, 12, 'Gachetá', 4.8160, -73.6341, now() + interval '96 hours', 'active'
  from public.profiles p
 where p.business_name = 'Droguería La Salud'
   and not exists (select 1 from public.offers o where o.title = 'Kit de limpieza facial 3 pasos');

-- 4) Resultado visible al final del RUN ---------------------------------------
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
