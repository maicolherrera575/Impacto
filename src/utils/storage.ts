import type { ReservationStatus, Ticket } from '../types';

const TICKETS_KEY = 'impulso:tickets:v1';

/** Carga los tickets guardados en este dispositivo. */
export function loadTickets(): Ticket[] {
  try {
    const raw = localStorage.getItem(TICKETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Ticket[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(tickets: Ticket[]): void {
  try {
    localStorage.setItem(TICKETS_KEY, JSON.stringify(tickets));
  } catch {
    /* almacenamiento lleno o bloqueado: la app sigue funcionando */
  }
}

/** Agrega un ticket nuevo (los más recientes primero). */
export function saveTicket(ticket: Ticket): Ticket[] {
  const tickets = [ticket, ...loadTickets()];
  persist(tickets);
  return tickets;
}

/** Actualiza estado/calificación de un ticket por id de reserva. */
export function patchTicket(
  reservationId: string,
  patch: Partial<Pick<Ticket, 'status' | 'isRated'>>
): Ticket[] {
  const tickets = loadTickets().map((t) =>
    t.reservationId === reservationId ? { ...t, ...patch } : t
  );
  persist(tickets);
  return tickets;
}

/** Elimina un ticket del dispositivo. */
export function removeTicket(reservationId: string): Ticket[] {
  const tickets = loadTickets().filter((t) => t.reservationId !== reservationId);
  persist(tickets);
  return tickets;
}

export function ticketStatusLabel(status: ReservationStatus): string {
  switch (status) {
    case 'pending':
      return '🟡 Pendiente';
    case 'completed':
      return '✅ Entregado';
    case 'released':
      return '⚪ Liberado';
  }
}
