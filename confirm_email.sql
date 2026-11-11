-- ============================================================================
--  IMPULSO — Confirmar manualmente una cuenta de usuario (parche exprés)
--  Úsalo cuando la confirmación por correo esté dando guerra.
--  Reemplaza el correo por el de la cuenta a desbloquear y ejecútalo
--  en el SQL Editor de Supabase (Authentication está fuera del alcance
--  de la app: solo tú, desde tu dashboard, puedes hacer esto).
-- ============================================================================

update auth.users
   set email_confirmed_at = now(),
       updated_at         = now()
 where email = 'maicolherrera675@gmail.com';

-- Bonus: si además quieres convertirlo en administrador en el mismo paso:
-- update public.profiles
--    set role = 'admin'
--  where id = (select id from auth.users where email = 'maicolherrera675@gmail.com');
