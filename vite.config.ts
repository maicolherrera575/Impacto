import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Carga TODAS las variables de entorno (con o sin prefijo VITE_). Así en
  // Vercel se guardan en modo "Secreto" SIN el prefijo (SUPABASE_URL,
  // SUPABASE_ANON_KEY, GEMINI_API_KEY) sin que salga la alerta roja de
  // "elimina el prefijo público del framework", y en localhost sigue
  // funcionando igual con el .env de siempre (nombres VITE_*).
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [react()],
    define: {
      // Inyecta en el bundle los valores con fallback: primero el nombre sin
      // prefijo (Vercel "Secreto"), luego el clásico con VITE_ (.env local).
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? ''),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY ?? ''),
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY ?? env.VITE_GEMINI_API_KEY ?? ''),
      'import.meta.env.VITE_ADMIN_WHATSAPP': JSON.stringify(env.ADMIN_WHATSAPP ?? env.VITE_ADMIN_WHATSAPP ?? ''),
    },
    build: {
      target: 'es2022',
      sourcemap: false,
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          // Divide el bundle por librería: el navegador cachea cada pieza por
          // separado y las cargas repetidas del radar son mucho más rápidas.
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'lucide-react'],
            'vendor-supabase': ['@supabase/supabase-js'],
            'vendor-gemini': ['@google/generative-ai'],
            'vendor-leaflet': ['leaflet', 'react-leaflet'],
          },
        },
      },
    },
    server: {
      host: true,
      port: 5173,
    },
    preview: {
      host: true,
      port: 4173,
    },
  };
});
