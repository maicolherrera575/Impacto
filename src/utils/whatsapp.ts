import type { Ticket } from '../types';

/** Enlace directo a WhatsApp con mensaje prellenado. */
export function waLink(phone: string, message: string): string {
  const digits = phone.replace(/[^\d]/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function openWhatsApp(phone: string, message: string): void {
  window.open(waLink(phone, message), '_blank', 'noopener,noreferrer');
}

/** Mensaje del cliente hacia el comerciante al contactar por su ticket. */
export function ticketContactMessage(ticket: Ticket): string {
  return (
    `Hola ${ticket.merchantName}! 👋 Soy ${ticket.customerName}. ` +
    `Aparté ${ticket.quantity} de "${ticket.offerTitle}" en Impulso. ` +
    `Mi código de reserva es: ${ticket.code}. ¿Cuándo puedo pasar por mi pedido?`
  );
}

/** Enlace viral para compartir una oferta. */
export function shareUrl(offerId: string): string {
  return `${window.location.origin}${window.location.pathname}?oferta=${offerId}`;
}

export function shareText(offerTitle: string, emoji: string, promoPrice: string, merchantName: string): string {
  return `${emoji} ${offerTitle} — ${promoPrice} en ${merchantName} 🔥 ¡Aparta el tuyo en Impulso!`;
}
