/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_GEMINI_API_KEY: string;
  readonly VITE_ADMIN_WHATSAPP?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Doble Motor V10: llave de respaldo inyectada en build time (vite define). */
declare const __APP_GEMINI_KEY__: string;
