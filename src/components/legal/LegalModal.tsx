import { ModalShell } from '../ui/ModalShell';
import { ADMIN_WHATSAPP } from '../../config/env';

interface LegalModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Blindaje legal: términos y política de tratamiento de datos personales
 * conforme a la Ley 1581 de 2012 (Colombia) y su Decreto reglamentario 1377 de 2013.
 */
export function LegalModal({ open, onClose }: LegalModalProps) {
  return (
    <ModalShell open={open} onClose={onClose} panelClassName="max-w-lg">
      <div className="p-5 pt-14">
        <h3 className="text-xl font-extrabold text-white">Términos y Política de Datos</h3>
        <p className="mt-1 text-xs font-semibold text-slate-500">
          Impulso · Última actualización: {new Date().getFullYear()}
        </p>

        <div className="mt-4 space-y-5 text-sm leading-relaxed text-slate-300">
          <section>
            <h4 className="font-extrabold text-impulso-mint">1. Naturaleza de la plataforma</h4>
            <p className="mt-1.5">
              <strong>Impulso</strong> es una plataforma tecnológica <strong>informativa</strong> de difusión comercial y
              reserva previa. <strong>No realiza intermediación financiera</strong>: no procesa pagos, no retiene
              dineros, no actúa como vendedor ni garante. Los pagos se realizan directamente entre el cliente y el
              comercio al momento de la entrega, y los precios, inventarios y calidad de los productos son responsabilidad
              exclusiva de cada comercio publicante.
            </p>
          </section>

          <section>
            <h4 className="font-extrabold text-impulso-mint">2. Reservas y cupos</h4>
            <p className="mt-1.5">
              El apartado de productos (reserva) es gratuito, no constituye una compra automatizada y está sujeto a la
              disponibilidad real del comercio. Si un producto no está disponible, el comerciante podrá liberar la
              reserva, devolviendo el cupo al radar. El código de reserva es personal y debe presentarse al recoger el
              pedido.
            </p>
          </section>

          <section>
            <h4 className="font-extrabold text-impulso-mint">3. Tratamiento de datos personales (Ley 1581 de 2012)</h4>
            <p className="mt-1.5">
              En cumplimiento de la <strong>Ley 1581 de 2012</strong> y el <strong>Decreto 1377 de 2013</strong>,
              informamos:
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-slate-400">
              <li>
                <strong>Responsable:</strong> Impulso (contacto: WhatsApp {ADMIN_WHATSAPP}).
              </li>
              <li>
                <strong>Datos tratados:</strong> nombre, teléfono/WhatsApp y notas voluntarias suministradas al reservar
                o publicar necesidades; datos del negocio (nombre, categoría, ubicación) tratados al registrarse.
              </li>
              <li>
                <strong>Finalidad:</strong> gestionar reservas, permitir el contacto cliente–comercio, mostrar la
                información comercial en el radar y mejorar el servicio. No vendemos ni cedemos datos a terceros ajenos
                a la transacción.
              </li>
              <li>
                <strong>Derechos del titular (art. 8, Ley 1581):</strong> conocer, actualizar, rectificar y suprimir sus
                datos; solicitar prueba de autorización; revocar la autorización y solicitar la eliminación cuando no
                exista deber legal de conservarlos.
              </li>
              <li>
                <strong>Canal para ejercer derechos:</strong> escribe a nuestro WhatsApp {ADMIN_WHATSAPP} con el asunto
                &laquo;Protección de datos&raquo;. Responderemos en los términos legales (máximo 15 días hábiles).
              </li>
            </ul>
          </section>

          <section>
            <h4 className="font-extrabold text-impulso-mint">4. Uso aceptable</h4>
            <p className="mt-1.5">
              Está prohibido publicar contenido ilegal, engañoso, discriminatorio o que induzca a error sobre precios,
              cantidades o disponibilidad. Impulso puede retirar publicaciones que incumplan estas reglas y suspender
              cuentas maliciosas.
            </p>
          </section>

          <section>
            <h4 className="font-extrabold text-impulso-mint">5. Créditos de publicación</h4>
            <p className="mt-1.5">
              Cada oferta publicada por un comercio consume un crédito de publicación. Los comercios nuevos reciben 3
              créditos de bienvenida. Los créditos se recargan directamente con el administrador oficial de la plataforma.
            </p>
          </section>

          <section>
            <h4 className="font-extrabold text-impulso-mint">6. Seguridad comunitaria</h4>
            <p className="mt-1.5">
              Para proteger a compradores y comerciantes:
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-slate-400">
              <li>Las reservas se recogen <strong>en el local físico del comercio</strong> (ubicación registrada en el radar), nunca en puntos ajenos ni domicilios particulares.</li>
              <li>Verifica la insignia <strong>✅ Verificado</strong>: la otorga el administrador tras conocer el negocio personalmente.</li>
              <li>No entregues datos innecesarios (dirección de casa, datos bancarios); la reserva solo requiere nombre y WhatsApp.</li>
              <li>El pago se hace <strong>directamente en el local, al recibir el producto</strong>. Jamás pagues anticipos a desconocidos con pretextos de &laquo;apartado&raquo;.</li>
              <li>Si detectas una oferta engañosa, un abuso o una conducta sospechosa, repórtala de inmediato al WhatsApp {ADMIN_WHATSAPP}: la cuenta puede suspenderse y las publicaciones retirarse.</li>
            </ul>
          </section>

          <p className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-xs text-slate-400">
            Al usar Impulso declaras haber leído y aceptado estos términos y la política de tratamiento de datos. Este
            documento hace parte del contrato de uso de la plataforma conforme a la legislación colombiana.
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
