import { ModalShell } from '../ui/ModalShell';
import { ADMIN_WHATSAPP } from '../../config/env';
import { useToast } from '../ui/Toast';

interface LegalModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * 🛡️ Blindaje jurídico integral V18 (Colombia): naturaleza del servicio,
 * régimen de créditos SaaS prepago, datos personales y geolocalización
 * VOLUNTARIA (Ley 1581 de 2012) con borrado local en 1 clic, y prevención
 * de fraude (Ley 1273 de 2009). Cero riesgos ante Cámara de Comercio, SIC,
 * DIAN y Fiscalía.
 */
export function LegalModal({ open, onClose }: LegalModalProps) {
  const toast = useToast();

  /** 🗑️ Derecho de supresión inmediato: limpia TODO lo local del dispositivo. */
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
        <h3 className="text-xl font-extrabold text-white">Términos y Política de Datos</h3>
        <p className="mt-1 text-xs font-semibold text-slate-500">
          Impulso · Última actualización: {new Date().getFullYear()}
        </p>

        <div className="mt-4 space-y-5 text-sm leading-relaxed text-slate-300">
          {/* ── Capítulo 1 ── */}
          <section>
            <h4 className="font-extrabold text-impulso-mint">1. Naturaleza del Servicio (Ley 527 de 1999 · Art. 53 Ley 1480 de 2011)</h4>
            <p className="mt-1.5">
              <strong>Impulso</strong> es una herramienta tecnológica de <strong>anuncios clasificados temporales</strong>{' '}
              y diseño publicitario para comercios locales. <strong>NO es intermediario financiero</strong>,{' '}
              <strong>NO capta dineros del público</strong> y <strong>NO cobra comisiones</strong> sobre las ventas de
              los comercios. Cada transacción de compra y entrega se celebra <strong>directamente</strong> entre el
              consumidor y el comerciante: los precios, inventarios y calidad son responsabilidad exclusiva de cada
              comercio publicante. Impulso tampoco es vendedor, garante ni transportador de los productos.
            </p>
          </section>

          {/* ── Capítulo 2 ── */}
          <section>
            <h4 className="font-extrabold text-impulso-mint">2. Régimen de Créditos de Publicación (SaaS Prepago · Art. 437 Estatuto Tributario)</h4>
            <p className="mt-1.5">
              Cada oferta publicada consume un <strong>crédito de publicación</strong>: una unidad de uso de software
              para difusión publicitaria. Los comercios nuevos reciben 3 créditos de bienvenida. Los créditos:{' '}
              <strong>no son reembolsables en efectivo</strong>, <strong>no son depósitos electrónicos</strong> ni
              instrumentos financieros, y se adquieren exclusivamente para usar la plataforma (régimen simplificado, no
              responsable de IVA — Art. 437 ET). Se recargan directamente con el administrador oficial de la plataforma.
            </p>
          </section>

          {/* ── Capítulo 3 ── */}
          <section>
            <h4 className="font-extrabold text-impulso-mint">3. Datos Personales y Geolocalización (Ley 1581 de 2012 · Decreto 1377 de 2013)</h4>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-slate-400">
              <li>
                <strong>Responsable:</strong> Impulso (contacto: WhatsApp {ADMIN_WHATSAPP}).
              </li>
              <li>
                <strong>Datos tratados:</strong> nombre, teléfono/WhatsApp y notas voluntarias al reservar o publicar
                pedidos; datos del negocio (nombre, categoría, ubicación) al registrarse.
              </li>
              <li>
                <strong>Finalidad estricta de conexión local:</strong> gestionar reservas, permitir el contacto
                cliente–comercio y mostrar la información comercial en el radar. No vendemos ni cedemos datos a
                terceros ajenos a la transacción.
              </li>
              <li>
                <strong>Geolocalización 100% voluntaria:</strong> la ubicación del dispositivo se usa de forma{' '}
                <strong>efímera</strong> y <strong>exclusiva en tu navegador</strong> para calcular distancias y
                posicionarte en el mapa. <strong>La app nunca pide el GPS sin tu clic previo</strong>: existe una
                tarjeta de consentimiento previo e informado que puedes aceptar o rechazar, y tu decisión se respeta.
              </li>
              <li>
                <strong>Derechos del titular (art. 8, Ley 1581):</strong> conocer, actualizar, rectificar y suprimir
                sus datos; revocar la autorización; solicitar la eliminación. Canal: WhatsApp {ADMIN_WHATSAPP} con el
                asunto «Protección de datos» (máximo 15 días hábiles).
              </li>
            </ul>
            <button
              onClick={wipeLocalData}
              className="pressable mt-3 w-full rounded-2xl border border-impulso-rose/40 bg-impulso-rose/10 py-3 text-sm font-extrabold text-impulso-rose"
            >
              🗑️ Borrar mis datos locales de este dispositivo
            </button>
            <p className="mt-1.5 text-[11px] font-semibold text-slate-500">
              Limpia en 1 clic los datos guardados en este navegador (borradores, preferencias y consentimientos
              locales). Ejercicio inmediato de tu derecho de supresión sobre los datos locales.
            </p>
          </section>

          {/* ── Capítulo 4 ── */}
          <section>
            <h4 className="font-extrabold text-impulso-mint">4. Prevención de Fraude y Seguridad Ciudadana (Ley 1273 de 2009)</h4>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-slate-400">
              <li>Está prohibido publicar contenido ilegal, <strong>engañoso</strong> o que induzca a error sobre precios, cantidades o disponibilidad. Impulso retira publicaciones incumplidas y suspende cuentas maliciosas.</li>
              <li>Se realiza <strong>auditoría de seguridad</strong> de publicaciones y comprobantes, y hay colaboración con las autoridades competentes cuando la ley lo exija.</li>
              <li>Las reservas se recogen <strong>en el local físico del comercio</strong> (ubicación registrada en el radar), nunca en puntos ajenos ni domicilios particulares.</li>
              <li>Verifica la insignia <strong>✅ Verificado</strong>: la otorga el administrador tras conocer el negocio personalmente.</li>
              <li>El pago se hace <strong>directamente al recibir el producto</strong>. Jamás pagues anticipos a desconocidos con pretextos de «apartado».</li>
              <li>Si detectas una oferta engañosa, un abuso o una conducta sospechosa, repórtala de inmediato al WhatsApp {ADMIN_WHATSAPP}.</li>
            </ul>
          </section>

          {/* ── Capítulo 5 ── */}
          <section>
            <h4 className="font-extrabold text-impulso-mint">5. Aceptación</h4>
            <p className="mt-1.5">
              Al usar Impulso declaras haber leído y aceptado estos términos y la política de tratamiento de datos,
              incluida la geolocalización voluntaria descrita en el capítulo 3. Este documento hace parte del contrato
              de uso de la plataforma conforme a la legislación colombiana.
            </p>
          </section>

          <p className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-xs text-slate-400">
            Impulso es un portal de contacto y publicidad digital: <strong>no ejecuta ni garantiza pagos entre
            particulares</strong> y los comprobantes de recarga de créditos se validan con doble revisión (IA +
            administrador) antes de acreditar cualquier uso del software.
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
