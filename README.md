# ⚡ Impulso — Radar de ofertas y comercios en vivo

Plataforma web progresiva (PWA) transaccional, geolocalizada y asistida por IA que conecta a los comerciantes locales con los clientes cercanos: ofertas relámpago en un mapa en vivo, apartados sin registro, subasta inversa ("¿Quién tiene…?") y un Creador Mágico con **Gemini 2.5 Flash**.

---

## 🏗️ Arquitectura (escalable por capas)

```
├── supabase_schema.sql        # Esquema completo: tablas, RLS, RPC transaccionales, Realtime y semilla
├── promote_admin.sql          # Ascenso seguro a administrador (solo desde la base de datos)
├── public/
│   ├── manifest.webmanifest   # PWA instalable
│   ├── sw.js                  # Service Worker (shell offline, red primero)
│   └── icons/                 # Iconos 192/512 (any + maskable)
├── src/
│   ├── config/                # Variables de entorno validadas
│   ├── types/                 # Modelos de dominio espejo del esquema SQL
│   ├── services/              # Capa de datos: Supabase RPC, Gemini AI, auth, admin
│   ├── hooks/                 # useTick, useSpeechRecognition (voz es-CO)
│   ├── utils/                 # Geo (Haversine), formato COP, WhatsApp, storage, sonido
│   ├── components/
│   │   ├── ui/                # ModalShell (backdrop-blur), Toasts, Stars
│   │   ├── layout/            # Navbar + BottomNav estilo app nativa
│   │   ├── radar/             # LiveMap (Leaflet + CartoDB), filtros, búsqueda
│   │   ├── offers/            # Tarjetas de alta conversión + modal de reserva
│   │   ├── requests/          # Subasta inversa
│   │   ├── reservations/      # Tickets locales + calificación
│   │   ├── merchant/          # Panel del comerciante + Creador Mágico con IA
│   │   ├── admin/             # Panel exclusivo del administrador
│   │   └── legal/             # Ley 1581 de 2012
│   ├── App.tsx                # Orquestación global + Realtime + deep linking
│   └── main.tsx
```

**Stack:** React 19 · TypeScript strict · Vite 6 · Tailwind CSS · lucide-react · Leaflet + CartoDB Voyager · Supabase (Postgres + RLS + Realtime) · Google Gen AI (`gemini-2.5-flash`).

---

## 🚀 Puesta en marcha (5 pasos)

### 1. Instalar y correr

```bash
npm install
npm run dev        # http://localhost:5173
```

### 2. Crear la base de datos

Abre el **Dashboard de Supabase → SQL Editor → New query**, pega **todo el contenido** de `supabase_schema.sql` y ejecuta **una sola vez** (es idempotente: puedes volver a ejecutarlo tras cada actualización sin dañar nada). Esto crea:

- Tablas `profiles`, `offers`, `reservations`, `quick_requests` con **RLS estricto**.
- Funciones RPC `SECURITY DEFINER`: `publish_offer_rpc` (descuenta créditos atómicamente + auto-purga de 10), `reserve_offer_rpc` (bloqueo pesimista `FOR UPDATE`, cero sobreventa), `merchant_update_reservation_rpc`, `rate_reservation_rpc`, `admin_manage_merchant_rpc`, `increment_offer_views_rpc`.
- **Supabase Realtime** habilitado en las 3 tablas.
- **Modo Vitrina**: 6 comercios demo verificados en Gachetá con 8 ofertas vivas (solo si la base está vacía).
- **v1.1 — Seguridad de acceso**: registro de comerciantes **solo con código de invitación** (tabla `platform_settings`, RPC `validate_invite_rpc`) y columna `is_active` para suspender cuentas maliciosas desde el panel admin.

> 🎟️ **Código de invitación por defecto: `IMPULSO-GACHETA-2026`** — cámbialo cuando quieras ejecutando:
> `update public.platform_settings set merchant_invite_code = 'TU-NUEVO-CODIGO';`

### 3. Crear TU cuenta de administrador

1. En la app: **Entrar → Crear cuenta** con tu correo personal y una contraseña fuerte.
2. Abre `promote_admin.sql`, reemplaza `TU_CORREO@ejemplo.com` y ejecútalo en el SQL Editor.
3. Al volver a entrar verás el **escudo 🛡️** en la barra → **Panel de Administrador**.

> 🔐 El rol `admin` **solo se asigna desde la base de datos**. Las acciones del panel pasan por `admin_manage_merchant_rpc`, que valida `is_admin()` en el servidor. Nadie puede escalar privilegios desde el navegador.

### 4. Variables de entorno

El archivo `.env` ya viene configurado con tus llaves:

```env
VITE_SUPABASE_URL="https://eleedbpdvglgqmiqmmmz.supabase.co"
VITE_SUPABASE_ANON_KEY="sb_publishable_..."
VITE_GEMINI_API_KEY="..."
VITE_ADMIN_WHATSAPP="573000000000"   # ← cambia por tu WhatsApp real (recarga de créditos)
```

### 5. Instalar como app (PWA)

En Chrome/Android: menú → **"Instalar app"**. En iOS: Compartir → **"Agregar a inicio"**.

---

## 🧠 Cómo funciona (resumen del flujo)

| Actor | Experiencia |
|---|---|
| **Cliente (sin cuenta)** | Abre el radar → ve ofertas en el mapa con precio/emoji flotante →GPS opcional ("Ver distancia exacta"; si rechaza, se centra en el Parque de Gachetá y **nunca se bloquea**) → "Apartar el mío YA" → recibe código de 4 caracteres → ticket guardado en el dispositivo → chatea por WhatsApp → califica con ⭐. |
| **Comerciante** | Se registra (3 créditos gratis) → dicta o escribe *"Saqué 15 almuerzos con trucha a 12 mil por 3 horas"* → **✨ Crear con IA** estructura todo → publica (gasta 1 crédito) → **campanita sonora** en cada reserva → Entregado/Liberar (devuelve stock) → **🔄 Repetir oferta** en 1 clic → recarga créditos por WhatsApp con el admin. |
| **Administrador** | Escudo 🛡️ → métricas del ecosistema → **+5/+10/+20 créditos** y **verificación ✅** instantánea de comercios. |
| **Viral** | Compartir genera `tudominio.com/?oferta=UUID` → quien lo abre ve la oferta **en primer plano automáticamente**. |

---

## 🔒 Notas de seguridad

- **RLS en las 4 tablas**: el público solo lee ofertas activas vigentes; los créditos, inventarios y roles son **intocables desde el cliente** — todo pasa por RPC `SECURITY DEFINER` con `search_path` blindado y bloqueos pesimistas.
- Las llaves `VITE_*` son públicas por diseño (anon key protegida por RLS). La llave de Gemini viaja al navegador: para hardening futuro, muévela a una **Edge Function de Supabase** (`/functions/v1/gemini`) y deja el frontend sin ella.
- `accepted_terms_at` registra la aceptación de la **Ley 1581 de 2012** en el registro de cada cuenta.

---

## 🌐 Despliegue a producción — Vercel (la mejor opción para esta plataforma)

**¿Por qué Vercel?** Es la casa de Vite/React: builds en segundos, CDN global gratis, dominio propio gratis, HTTPS automático y previews de cada cambio. Alternativa válida: Netlify (casi idéntica). No uses hosting tradicional (hosting compartido): esta app necesita HTTPS y CDN para el GPS y las notificaciones.

### Pasos (15 minutos):
1. **Crea un repositorio en GitHub** y sube el proyecto (el `.gitignore` ya protege tu `.env` — tus llaves nunca se suben).
2. Entra a **vercel.com** con tu cuenta de GitHub → **Add New Project** → importa el repo. Vercel detecta Vite solo.
3. **Antes del primer deploy**, en *Environment Variables* agrega las 4 variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GEMINI_API_KEY`, `VITE_ADMIN_WHATSAPP`) con los valores de tu `.env`.
4. **Deploy** → en 2 minutos tendrás `https://impulso-tu-cuenta.vercel.app` funcionando.
5. **Supabase → Authentication → URL Configuration**: pon el **Site URL** = tu dominio de Vercel (y agrégalo en *Redirect URLs*). Así los enlaces de correo confirman directo hacia tu app.

### Correo de confirmación (fricción vs. seguridad):
- **Mientras lanzas y pruebas:** Dashboard de Supabase → **Authentication → Providers → Email** → desactiva **"Confirm email"**. Las cuentas **nuevas** entran al instante. Las cuentas ya creadas siguen pendientes: desbloquéalas ejecutando `confirm_email.sql` (confirma al usuario directamente en `auth.users`).
- **Cuando lances de verdad:** actívalo de nuevo. Con la configuración actual de la app (PKCE), el enlace del correo confirmará **y dejará al usuario dentro de la app automáticamente**.
- Para que los correos no caigan en spam con dominio propio, activa un remitente personalizado (Resend/SMTP) desde Supabase → Authentication → SMTP.

### Solución de problemas rápidos:
| Síntoma | Causa | Solución |
|---|---|---|
| "Confirma tu correo con el enlace…" al iniciar sesión | La cuenta quedó pendiente de confirmación | Ejecuta `confirm_email.sql` con ese correo, o desactiva "Confirm email" y crea la cuenta de nuevo |
| Radar sin ofertas | El esquema no se ha ejecutado (o se ejecutó una versión vieja) | Re-ejecuta `supabase_schema.sql` completo (es idempotente) |
| "Tu cuenta está suspendida" | Moderación del admin | El admin la reactiva desde el Panel (botón ♻️) |
| El mapa pide "API key" | No debería ocurrir (usa OpenStreetMap) | Recarga con Ctrl+F5 |

---

## 🧪 Scripts

| Comando | Acción |
|---|---|
| `npm run dev` | Desarrollo con HMR |
| `npm run build` | Chequeo TypeScript estricto + build de producción |
| `npm run preview` | Servir `dist/` para probar la PWA instalada |
