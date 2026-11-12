import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { ToastProvider } from './components/ui/Toast';

// Portal web 100% por enlace seguro: SIN Service Worker ni manifest.
// Así el navegador jamás ofrece "Instalar aplicación" y el contenido
// publicado siempre llega fresco al municipio (cero caché vieja).
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>
);
