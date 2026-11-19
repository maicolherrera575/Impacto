import { ModalShell } from '../ui/ModalShell';
import { ADMIN_WHATSAPP } from '../../config/env';
import { useToast } from '../ui/Toast';

interface LegalModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * 🛡️ Blindaje jurídico integral V37.0 (Colombia):
 *  - Ley 527 de 1999 (Validez jurídica de mensajes de datos y aceptación electrónica)
 *  - Ley 1480 de 2011 — Estatuto del Consumidor (Art. 53: portal de contacto sin retención de dinero)
 *  - Ley 1581 de 2012 & Decreto 1377 de 2013 (Habeas Data, GPS voluntario efímero + purga 7 días)
 *  - Ley 1273 de 2009 (Prevención de delitos informáticos y fraude en comprobantes)
 *  - Ley 256 de 1996 (Protección contra denuncias maliciosas / competencia desleal)
 */
export function LegalModal({ open, onClose }: LegalModalProps) {
  const toast = useToast();

  /** 🗑️ Derecho de supresión inmediato (Art. 8 Ley 1581): limpia TODO lo local del dispositivo. */
  function wipeLocalData(): void {
    try {
      localStorage.clear();
      sessionStorage.clear();
      toast.success('🗑️ Datos locales borrados de este dispositivo. La página se recargará limpia.');
      setTimeout(() => window.location.reload(), 1200);
    } catch {
      toast.error('No se pudieron borrar los datos locales en este navegador.');
    }
  }

  return (
    <ModalShell open={open} onClose={onClose} escClose panelClassName="max-w-lg">
      <div className="p-5 pt-14">
        <h3 className="text-xl font-extrabold text-white">Términos de Uso y Política de Datos</h3>
        <p className="mt-1 text-xs font-semibold text-slate-500">
          Impulso · Marco legal colombiano vigente · Actualización {new Date().getFullYear()}
        </p>

        <div className="mt-4 space-y-5 text-sm leading-relaxed text-slate-300">
          {/* ── Capítulo 1: Naturaleza & Ley 1480 ── */}
          <section>
            <h4 className="font-extrabold text-impulso-mint">
              1. Portal de Contacto y Protección al Consumidor (Art. 53 · Ley 1480 de 2011)
            </h4>
            <p className="mt-1.5">
              <strong>Impulso</strong> actúa exclusivamente como un <strong>portal tecnológico de contacto, anuncios clasificados temporales y herramientas de difusión comercial</strong>.{' '}
              <strong>NO es intermediario financiero</strong>, <strong>NO capta, custodia ni retiene dinero entre compradores y comercios</strong>, y{' '}
              <strong>NO cobra comisiones sobre las ventas</strong>.
            </p>
            <p className="mt-1.5 text-slate-400">
              Conforme al Estatuto del Consumidor (Ley 1480 de 2011), toda relación de consumo, precio publicado, calidad, idoneidad, garantía, entrega y pago se celebra directa y exclusivamente entre el <strong>comercio anunciante</strong> y el <strong>consumidor</strong>. Impulso no es vendedor, fabricante, garante ni transportador.
            </p>
          </section>

          {/* ── Capítulo 2: Validez Electrónica (Ley 527) & Roles ── */}
          <section>
            <h4 className="font-extrabold text-impulso-mint">
              2. Validez Electrónica, Separación de Cuentas y Créditos (Ley 527 de 1999)
            </h4>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-slate-400">
              <li>
                <strong>Mensajes de datos (Ley 527 de 1999):</strong> la aceptación de estos términos, los códigos de apartado, las validaciones biométricas (WebAuthn) y los registros de recarga constituyen mensajes de datos válidos con fuerza probatoria e integridad técnica.
              </li>
              <li>
                <strong>Separación estricta de roles:</strong> las cuentas de <strong>Cliente / Comprador</strong> son gratuitas, sirven únicamente para guardar favoritos, preferencias y apartados, y jamás pueden publicar ofertas comerciales. Las cuentas de <strong>Comercio</strong> están destinadas a negocios locales verificables.
              </li>
              <li>
                <strong>Créditos SaaS prepago (Art. 437 ET):</strong> cada oferta publicada consume un crédito de software publicitario (3 gratis al abrir cuenta comercial). Los créditos no son depósitos electrónicos ni reembolsables en efectivo y se adquieren únicamente en los canales oficiales del administrador (Nequi, Daviplata o Llave oficial).
              </li>
            </ul>
          </section>

          {/* ── Capítulo 3: Habeas Data (Ley 1581) ── */}
          <section>
            <h4 className="font-extrabold text-impulso-mint">
              3. Tratamiento de Datos Personales y GPS Voluntario (Ley 1581 de 2012 · Decreto 1377 de 2013)
            </h4>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-slate-400">
              <li>
                <strong>Responsable:</strong> Impulso (canal oficial de atención y habeas data: WhatsApp {ADMIN_WHATSAPP}).
              </li>
              <li>
                <strong>Principio de minimización:</strong> recolectamos solo lo estrictamente necesario (nombre, WhatsApp y notas al apartar o publicar pedidos; preferencias ligeras opcionales; y datos comerciales/KYB al registrar un negocio). Jamás vendemos ni cedemos bases de datos a terceros.
              </li>
              <li>
                <strong>Geolocalización 100% voluntaria y efímera:</strong> nunca activamos el GPS sin tu clic previo. Tus coordenadas se usan únicamente en tu navegador para ordenar distancias; cualquier coordenada temporal asociada a prevención de fraude se purga automáticamente a los <strong>7 días</strong>.
              </li>
              <li>
                <strong>Derechos del titular (Art. 8, Ley 1581):</strong> conocer, actualizar, rectificar y suprimir tus datos o revocar autorización escribiendo a WhatsApp {ADMIN_WHATSAPP} con el asunto &laquo;Protección de datos&raquo; (respuesta en máximo 15 días hábiles).
              </li>
            </ul>
            <button
              onClick={wipeLocalData}
              className="pressable mt-3 w-full rounded-2xl border border-impulso-rose/40 bg-impulso-rose/10 py-3 text-sm font-extrabold text-impulso-rose"
            >
              🗑️ Borrar mis datos y preferencias locales de este dispositivo
            </button>
            <p className="mt-1.5 text-[11px] font-semibold text-slate-500">
              Ejercicio inmediato de supresión local: elimina favoritos, borradores, tickets locales y caché en 1 clic.
            </p>
          </section>

          {/* ── Capítulo 4: Seguridad, Anti-Fraude & Anti-Abuso ── */}
          <section>
            <h4 className="font-extrabold text-impulso-mint">
              4. Seguridad, Unicidad de Comprobantes y Prevención de Fraude (Ley 1273 de 2009 · Ley 256 de 1996)
            </h4>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-slate-400">
              <li>
                <strong>Unicidad estricta de recargas:</strong> cada comprobante y referencia de pago se valida en servidor contra cuenta destino oficial, monto exacto y huella única irrepetible; queda prohibido reutilizar o alterar comprobantes.
              </li>
              <li>
                <strong>Recomendación contra estafas:</strong> para tu seguridad, especialmente en comercios nuevos (Nivel 1), paga únicamente <strong>contra entrega al recibir tu producto</strong> en el local físico o punto acordado. No realices anticipos a desconocidos.
              </li>
              <li>
                <strong>Protección contra denuncias maliciosas (Ley 256 de 1996):</strong> aplicamos controles de tasa anti-abuso y auditoría humana sobre reportes comunitarios para proteger a comercios honestos de competencia desleal.
              </li>
              <li>
                <strong>Suspensión y colaboración legal:</strong> Impulso podrá pausar ofertas engañosas, bloquear dispositivos abusivos y conservar evidencia técnica cuando sea requerida por autoridad competente (SIC / Fiscalía).
              </li>
            </ul>
          </section>

          <p className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-xs text-slate-400">
            Al navegar, crear una cuenta o apartar en Impulso confirmas que leíste y aceptas íntegramente estos
            términos conforme a las leyes 527 de 1999, 1480 de 2011, 1581 de 2012 y 1273 de 2009 de la República de
            Colombia.
          </p>
        </div>

        <button
          onClick={onClose}
          className="pressable mt-5 w-full rounded-2xl bg-gradient-to-r from-impulso-emerald to-teal-600 py-3.5 text-sm font-extrabold text-white shadow-glow"
        >
          Entendido
        </button>
      </div>
    </ModalShell>
  );
}
