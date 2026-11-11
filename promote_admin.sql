-- ============================================================================
--  IMPULSO — Administrador ÚNICO de la plataforma
--  Tu correo ya está grabado: ejecuta esto tal cual (una sola vez, o cuando
--  quieras). Hace tres cosas:
--    1. Confirma el correo de la cuenta dueña (por si el email dio guerra).
--    2. Le asigna el rol admin.
--    3. Le quita el rol admin a CUALQUIER otra cuenta (admin único garantizado).
--
--  ¿Cómo cambiar de administrador en el futuro?
--    Cambia el correo de la línea "where email = ..." por el de la nueva
--    persona y ejecuta de nuevo. El bloque de "admin único" dejará a esa
--    persona como único administrador automáticamente.
-- ============================================================================

-- Paso 1: confirmar el correo de la cuenta dueña
update auth.users
   set email_confirmed_at = coalesce(email_confirmed_at, now()),
       updated_at         = now()
 where email = 'maicolherrera675@gmail.com';

-- Paso 2: asignar el rol de administrador
update public.profiles
   set role = 'admin'
 where id = (select id from auth.users where email = 'maicolherrera675@gmail.com');

-- Paso 3: admin único — nadie más queda como admin
update public.profiles
   set role = 'user'
 where role = 'admin'
   and id <> (select id from auth.users where email = 'maicolherrera675@gmail.com');

-- Listo: al cerrar sesión y volver a entrar verás el escudo 🛡️ en la barra.
-- Solo la base de datos puede otorgar este rol; jamás se puede asignar desde
-- el navegador ni desde la app.
