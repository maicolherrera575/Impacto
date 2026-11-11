import { useEffect, useState } from 'react';

/** Reloj compartido que re-renderiza cada `intervalMs` (cuentas regresivas). */
export function useTick(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
