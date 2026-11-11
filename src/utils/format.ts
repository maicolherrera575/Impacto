/** Utilidades de formato moneda, tiempo y texto. */

export function formatCOP(value: number | string | null | undefined): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (n === null || n === undefined || Number.isNaN(n)) return '$0';
  return `$${Math.round(n).toLocaleString('es-CO')}`;
}

export function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

export interface CountdownState {
  text: string;
  urgent: boolean;
  expired: boolean;
}

/**
 * Reloj dinámico inteligente:
 *  - Ofertas relámpago (≤ 24h): cuenta regresiva segundo a segundo.
 *  - Promociones extendidas: etiqueta limpia de días.
 */
export function countdownText(expiresAt: string, now: number): CountdownState {
  const diff = new Date(expiresAt).getTime() - now;
  if (diff <= 0) {
    return { text: '⏳ Finalizada', urgent: false, expired: true };
  }
  const totalSec = Math.floor(diff / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  if (h < 24) {
    return {
      text: `⏳ Termina en ${pad2(h)}:${pad2(m)}:${pad2(s)}`,
      urgent: h < 2,
      expired: false,
    };
  }
  const days = Math.floor(h / 24);
  const restH = h % 24;
  return {
    text: `📅 Válido por ${days} día${days > 1 ? 's' : ''}${restH > 0 ? ` y ${restH}h` : ''}`,
    urgent: false,
    expired: false,
  };
}

/** Etiqueta compacta de tiempo restante (pedidos / subasta inversa). */
export function timeLeftLabel(expiresAt: string, now: number): string {
  const diff = new Date(expiresAt).getTime() - now;
  if (diff <= 0) return 'Finalizado';
  const hours = diff / 3_600_000;
  if (hours < 1) return `⏱ Quedan ${Math.max(1, Math.round(diff / 60_000))} min`;
  return `⏱ Quedan ${Math.ceil(hours)}h`;
}

/** Tiempo transcurrido en lenguaje natural ("hace 5 min"). */
export function timeAgo(iso: string, now: number): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'hace instantes';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  return `hace ${d} día${d > 1 ? 's' : ''}`;
}

/** Calificación promedio (5 estrellas) acumulada en el perfil. */
export function ratingAvg(sum: number, count: number): string {
  if (count <= 0) return '5.0';
  return (sum / count).toFixed(1);
}

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
