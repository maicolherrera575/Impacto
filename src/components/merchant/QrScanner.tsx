import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, Loader2, X } from 'lucide-react';
import { useModalHistory } from '../../hooks/useModalHistory';

interface QrScannerProps {
  open: boolean;
  /** Código/contenido crudo leído del QR del comprobante. */
  onScan: (raw: string) => void;
  onClose: () => void;
  /** Texto de instrucción encima de la cámara. */
  hint?: string;
}

/**
 * 📷 Escáner de QR nativo con la cámara del teléfono (sin apps externas):
 * decodifica el QR del comprobante de Nequi/Daviplata en vivo con jsQR.
 * Apagado limpio del stream y de cada frame al cerrar (cero fugas).
 */
export function QrScanner({ open, onScan, onClose, hint }: QrScannerProps) {
  useModalHistory(open, onClose);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const doneRef = useRef(false);
  /** Ref del callback: la cámara NO se reinicia si el padre re-renderiza. */
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    if (!open) return;
    doneRef.current = false;
    setError(null);
    setStarting(true);

    let cancelled = false;

    async function start(): Promise<void> {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        const tick = (): void => {
          if (cancelled || doneRef.current) return;
          const v = videoRef.current;
          if (v && v.readyState === v.HAVE_ENOUGH_DATA && ctx) {
            const w = 420;
            const h = Math.round((v.videoHeight / v.videoWidth) * 420) || 420;
            canvas.width = w;
            canvas.height = h;
            ctx.drawImage(v, 0, 0, w, h);
            const img = ctx.getImageData(0, 0, w, h);
            const found = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
            if (found && found.data) {
              doneRef.current = true;
              onScanRef.current(found.data);
              return;
            }
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
        setStarting(false);
      } catch {
        if (!cancelled) {
          setError('No se pudo abrir la cámara. Autorízala en tu navegador o escribe el código manualmente.');
          setStarting(false);
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      const v = videoRef.current;
      if (v) v.srcObject = null;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex flex-col bg-slate-950">
      {/* Cabecera */}
      <div className="flex items-center justify-between p-4">
        <p className="text-sm font-extrabold text-white">📷 Escáner del comprobante</p>
        <button
          onClick={onClose}
          aria-label="Cerrar escáner"
          className="pressable grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-slate-900/80 text-slate-200"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <Camera className="h-12 w-12 text-slate-600" />
          <p className="text-sm font-semibold text-slate-300">{error}</p>
          <button
            onClick={onClose}
            className="pressable rounded-2xl bg-impulso-emerald px-5 py-3 text-sm font-extrabold text-slate-950"
          >
            Escribir el código manualmente
          </button>
        </div>
      ) : (
        <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            playsInline
            muted
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* Marco guía + scanline */}
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="relative h-64 w-64 rounded-3xl border-2 border-impulso-emerald/70 shadow-[0_0_0_9999px_rgba(2,6,23,0.55)]">
              <div className="absolute inset-x-6 top-1/2 h-0.5 animate-pulse bg-impulso-emerald" />
            </div>
          </div>
          <p className="absolute bottom-8 max-w-xs px-6 text-center text-xs font-bold leading-relaxed text-white">
            {starting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Abriendo la cámara…
              </span>
            ) : (
              hint ?? 'Apunta al QR que te mostró Nequi al confirmar tu pago'
            )}
          </p>
        </div>
      )}
    </div>
  );
}
