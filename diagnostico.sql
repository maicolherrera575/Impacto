-- ============================================================================
--  IMPULSO — Diagnóstico de la plataforma (solo lectura, no modifica nada)
--  Ejecútalo completo en el SQL Editor de Supabase y revisa la columna ESTADO.
--  Todo debe salir ✅. Lo que salga ❌ te dice qué paso falta.
-- ============================================================================

-- 1. ¿Existen las tablas?
select 'Tabla profiles'   as item, case when to_regclass('public.profiles')       is not null then '✅ existe' else '❌ FALTA — ejecuta supabase_schema.sql' end as estado
union all
select 'Tabla offers',            case when to_regclass('public.offers')          is not null then '✅ existe' else '❌ FALTA — ejecuta supabase_schema.sql' end
union all
select 'Tabla reservations',      case when to_regclass('public.reservations')    is not null then '✅ existe' else '❌ FALTA — ejecuta supabase_schema.sql' end
union all
select 'Tabla quick_requests',    case when to_regclass('public.quick_requests')  is not null then '✅ existe' else '❌ FALTA — ejecuta supabase_schema.sql' end;

-- 2. ¿Existen las funciones que usa la app?
select 'Función ensure_my_profile_rpc' as item, case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'ensure_my_profile_rpc') then '✅ existe' else '❌ FALTA — ejecuta supabase_schema.sql' end as estado
union all
select 'Función validate_invite_rpc',   case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'validate_invite_rpc')   then '✅ existe' else '❌ FALTA — ejecuta supabase_schema.sql' end
union all
select 'Función publish_offer_rpc',     case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'publish_offer_rpc')     then '✅ existe' else '❌ FALTA — ejecuta supabase_schema.sql' end
union all
select 'Función is_admin',              case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'is_admin')              then '✅ existe' else '❌ FALTA — ejecuta supabase_schema.sql' end
union all
select 'Trigger de perfil nuevo',       case when exists (select 1 from pg_trigger where tgname = 'impulso_on_auth_user_created' and not tgisinternal) then '✅ existe' else '❌ FALTA — ejecuta supabase_schema.sql' end;

-- 3. ¿Tu cuenta y tu perfil están bien?
select 'Tu usuario en auth' as item,
       coalesce((select email from auth.users where email = 'maicolherrera675@gmail.com'), '❌ no existe la cuenta') as estado
union all
select 'Tu perfil comercial',
       coalesce((select '✅ ' || business_name from public.profiles p join auth.users u on u.id = p.id where u.email = 'maicolherrera675@gmail.com'), '❌ sin perfil (re-ejecuta el schema)')
union all
select 'Tu rol',
       coalesce((select case p.role when 'admin' then '🛡️ admin' else '⚠️ user (ejecuta promote_admin.sql)' end
                 from public.profiles p join auth.users u on u.id = p.id where u.email = 'maicolherrera675@gmail.com'), '❌ sin perfil')
union all
select 'Correo confirmado',
       coalesce((select case when u.email_confirmed_at is not null then '✅ confirmado' else '⚠️ pendiente (ejecuta confirm_email.sql)' end
                 from auth.users u where u.email = 'maicolherrera675@gmail.com'), '❌ sin cuenta');

-- 4. ¿El radar tiene ofertas vivas?
select 'Ofertas activas en Gachetá' as item,
       coalesce((select count(*)::text || ' ofertas · la más próxima vence ' || to_char(min(expires_at) at time zone 'America/Bogota', 'DD/MM HH24:MI')
                 from public.offers
                where status = 'active' and expires_at > now() and municipality = 'Gachetá'), '0') as estado
union all
select 'Ofertas totales (todas)',
       (select count(*)::text from public.offers)
union all
select 'Comercios registrados',
       (select count(*)::text || ' comercios' from public.profiles where role = 'merchant');

-- 5. Configuración de plataforma (registro abierto o con invitación)
select 'Registro de comercios' as item,
       case when require_invite then '🔒 con código de invitación' else '✅ abierto (lanzamiento)' end as estado
  from public.platform_settings where id = 1;
