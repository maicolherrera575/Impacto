/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_GEMINI_API_KEY: string;
  readonly VITE_GEMINI_API_KEY_1?: string;
  readonly VITE_GEMINI_API_KEY_2?: string;
  readonly VITE_GEMINI_API_KEY_3?: string;
  readonly VITE_GEMINI_API_KEY_4?: string;
  readonly VITE_ADMIN_WHATSAPP?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Doble Motor V10 / V36 Multi-Key (4+ proyectos): llaves inyectadas en build time (vite define). */
declare const __APP_GEMINI_KEY__: string;
declare const __APP_GEMINI_KEY_1__: string;
declare const __APP_GEMINI_KEY_2__: string;
declare const __APP_GEMINI_KEY_3__: string;
declare const __APP_GEMINI_KEY_4__: string;
