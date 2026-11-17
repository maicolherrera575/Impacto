import { useEffect, useRef } from 'react';

interface ModalHistoryEntry {
  token: string;
  close: () => void;
}

const modalStack: ModalHistoryEntry[] = [];
const closedByPop = new Set<string>();
let modalSeq = 0;
let ignoringPopCount = 0;
let listenerBound = false;

function handleGlobalPopState(): void {
  if (ignoringPopCount > 0) {
    ignoringPopCount -= 1;
    return;
  }
  const top = modalStack.pop();
  if (!top) return;
  closedByPop.add(top.token);
  top.close();
}

function ensurePopStateListener(): void {
  if (listenerBound || typeof window === 'undefined') return;
  window.addEventListener('popstate', handleGlobalPopState);
  listenerBound = true;
}

/**
 * Conecta modales y vistas superpuestas con la History API del navegador/móvil.
 * Al abrir empuja un estado al historial; si el usuario toca "Atrás", cierra
 * solo el modal superior sin abandonar la aplicación.
 */
export function useModalHistory(open: boolean, onClose: () => void): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    ensurePopStateListener();

    modalSeq += 1;
    const token = `imp-modal-${modalSeq}`;
    const entry: ModalHistoryEntry = {
      token,
      close: () => onCloseRef.current(),
    };

    modalStack.push(entry);
    const currentState =
      window.history.state && typeof window.history.state === 'object'
        ? (window.history.state as Record<string, unknown>)
        : {};
    window.history.pushState({ ...currentState, modalOpen: true, __impulsoModal: token }, '');

    return () => {
      if (closedByPop.has(token)) {
        closedByPop.delete(token);
        return;
      }

      const idx = modalStack.findIndex((item) => item.token === token);
      if (idx !== -1) modalStack.splice(idx, 1);

      const activeState = window.history.state as { __impulsoModal?: string } | null;
      if (activeState?.__impulsoModal === token) {
        ignoringPopCount += 1;
        window.history.back();
      }
    };
  }, [open]);
}
