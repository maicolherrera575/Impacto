import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
});
