import { useEffect, useRef, useState } from 'react';
import * as QRCode from 'qrcode';
import jsQR from 'jsqr';
import { CheckCircle2, Copy, Download, ExternalLink, Loader2, QrCode, ShieldCheck, Sparkles, Upload, X } from 'lucide-react';
import type { PaymentConfig, Profile } from '../../types';
import { CREDIT_PACKAGES } from '../../types';
import { ModalShell } from '../ui/ModalShell';
import { useToast } from '../ui/Toast';
import { compressImageToMicroWebP, compressionSummary } from '../../services/imageCompressor';
import { verifyNequiReceiptWithAI } from '../../services/gemini.service';
import type { ReceiptVerification } from '../../services/gemini.service';
import {
  autoApproveCreditOrder,
  checkReceiptAlreadyUsed,
  fetchPaymentConfig,
  submitCreditOrder,
} from '../../services/credits.service';
import { friendlyError } from '../../services/supabase';
import { cx, formatCOP } from '../../utils/format';
import { openWhatsApp } from '../../utils/whatsapp';
import { ADMIN_WHATSAPP } from '../../config/env';
import { QrScanner } from './QrScanner';

interface CreditsModalProps {
  open: boolean;
  onClose: () => void;
  profile: Profile;
  /** ⚡ V18 · Suma créditos al perfil en vivo tras la auto-aprobación. */
  onCreditsApproved?: (newCredits: number) => void;
}

type PaymentMethod = 'Nequi' | 'Daviplata' | 'Bancolombia' | 'Llave';

/**
 * ⚡ Caja de recarga de créditos V18 — Nequi 3158942112 / Llave / QR:
 * pago en 1 clic (copia o redirección), escáner de comprobante con huella
 * SHA-256, auditoría forense IA (destino, monto, fecha, estado), verificación
 * instantánea de no-reutilización y auto-aprobación cuando el Admin la activa.
 */
export function CreditsModal({ open, onClose, profile, onCreditsApproved }: CreditsModalProps) {
  const toast = useToast();
  const [planIdx, setPlanIdx] = useState(1);
  const [method, setMethod] = useState<PaymentMethod>('Nequi');
  const [receipt, setReceipt] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<ReceiptVerification | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [compressing, setCompressing] = useState(false);
  /** ⚠️ V18 · Errores DENTRO del modal (nunca detrás, invisibles). */
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  /** 📱 V18 · Config de recaudo del Admin (Nequi 3158942112 por defecto). */
  const [payConfig, setPayConfig] = useState<PaymentConfig | null>(null);
  /** 🔍 Forense: huella SHA-256 de la imagen y payload del QR leído. */
  const [receiptHash, setReceiptHash] = useState<string | null>(null);
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  /** 📷 Escáner nativo de cámara + guardia anti doble lectura. */
  const [scannerOpen, setScannerOpen] = useState(false);
  const scannedRef = useRef(false);
  /** 🟡 QR de pago generado en pantalla si el Admin aún no sube el suyo. */
  const [generatedQr, setGeneratedQr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    scannedRef.current = false;
    setErrorMsg('');
    setSuccessMsg('');
    let cancelled = false;
    fetchPaymentConfig()
      .then((config) => {
        if (!cancelled) setPayConfig(config);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open]);

  const plan = CREDIT_PACKAGES[planIdx];
  const nequiDigits = ((payConfig?.nequiPhone || ADMIN_WHATSAPP) || '3158942112').replace(/\D/g, '');
  const nequiLocal = nequiDigits.startsWith('57') ? nequiDigits.slice(2) : nequiDigits;
  const nequiPretty = `${nequiLocal.slice(0, 3)} ${nequiLocal.slice(3, 6)} ${nequiLocal.slice(6)}`;
  const llave = payConfig?.llave?.trim() || '@impulso3158942112';
  const holderName = payConfig?.holderName?.trim() || 'Administrador Impulso';
  const adminQr = payConfig?.qrThumb?.trim() || '';
  const autoApproveOn = payConfig?.autoApprove === true;

  /** QR de pago en pantalla: el oficial del Admin o el generado al vuelo. */
  useEffect(() => {
    if (!open) return;
    if (adminQr) {
      setGeneratedQr(adminQr);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(
      `PAGO IMPULSO | Nequi ${nequiLocal} | ${holderName} | ${method}`,
      { width: 480, margin: 1, errorCorrectionLevel: 'M' },
    )
      .then((url) => {
        if (!cancelled) setGeneratedQr(url);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open, adminQr, nequiLocal, holderName, method]);

  /** 🔐 Paso 1 · Huella SHA-256 de los píxeles normalizados de la imagen. */
  async function hashReceiptImage(dataUrl: string): Promise<string | null> {
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('img'));
        el.src = dataUrl;
      });
      const size = 64;
      const off = document.createElement('canvas');
      off.width = size;
      off.height = size;
      const ctx = off.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;
      // Normalizado: luminancia en pasos de 8 (resistente a recompresión leve)
      const bytes = new Uint8Array(size * size);
      for (let i = 0; i < size * size; i++) {
        const r = data[i * 4];
        const g = data[i * 4 + 1];
        const b = data[i * 4 + 2];
        bytes[i] = Math.min(31, Math.floor((0.299 * r + 0.587 * g + 0.114 * b) / 8));
      }
      const digest = await crypto.subtle.digest('SHA-256', bytes.buffer);
      return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      return null;
    }
  }

  /** 🔍 Decodifica un QR dentro de una imagen subida (jsQR sobre canvas). */
  async function decodeQrFromImage(dataUrl: string): Promise<string | null> {
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('img'));
        el.src = dataUrl;
      });
      const w = Math.min(1200, img.width);
      const h = Math.round((img.height / img.width) * w);
      const off = document.createElement('canvas');
      off.width = w;
      off.height = h;
      const ctx = off.getContext('2d', { willReadFrequently: true });
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, w, h);
      const found = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'attemptBoth' });
      return found?.data?.trim() || null;
    } catch {
      return null;
    }
  }

  /** 🚫 Paso 3 · Verificación instantánea de no-reutilización (solo lectura). */
  async function guardNotUsed(code: string): Promise<boolean> {
    const { used, reason } = await checkReceiptAlreadyUsed(code, receiptHash);
    if (used) {
      setErrorMsg(reason || '🚫 CÓDIGO O COMPROBANTE YA UTILIZADO: cada pago solo puede canjearse una única vez.');
      return false;
    }
    return true;
  }

  /** 📤 Paso 2 · Auditoría forense IA tras subir/escanear la captura. */
  async function pickReceipt(file: File | undefined) {
    if (!file) return;
    setCompressing(true);
    setErrorMsg('');
    setAiResult(null);
    setReceiptHash(null);
    setQrPayload(null);
    try {
      const thumb = await compressImageToMicroWebP(file, 420, 0.6);
      setReceipt(thumb);
      toast.success(compressionSummary(file, thumb));
      // 🔐 Huella única de imagen (SHA-256 normalizado)
      const hash = await hashReceiptImage(thumb);
      if (hash) setReceiptHash(hash);
      // 🔍 QR embebido en la captura, si lo tiene
      const qr = await decodeQrFromImage(thumb);
      if (qr) setQrPayload(qr);
      // 🤖 Auditoría forense con IA Vision (destino oficial 3158942112)
      setAnalyzing(true);
      try {
        const result = await verifyNequiReceiptWithAI(thumb, { adminPhone: nequiLocal, adminKey: llave });
        setAiResult(result);
        if (result.reference) setReference(result.reference);
        if (qr && !result.reference) setReference(qr.replace(/[^A-Za-z0-9.\-]/g, '').slice(0, 40));
        if (!result.looksReal) {
          setErrorMsg('🤖 La IA no reconoció un comprobante válido. Sube la captura original de tu app de pago.');
        } else if (result.suspicious) {
          setErrorMsg('🚨 La IA detectó señales de captura editada o pago no confirmado. Envía la captura original.');
        } else if (result.amountCop != null && result.amountCop !== plan.priceCop) {
          setErrorMsg(`⚠️ La IA leyó ${formatCOP(result.amountCop)} pero el plan elegido cuesta ${formatCOP(plan.priceCop)}. Verifica el monto.`);
        } else if (result.destinationDetected && !result.isValidDestination) {
          setErrorMsg(`🚨 El comprobante muestra destino ${result.destinationDetected} pero la cuenta oficial es ${nequiPretty}. Ese pago NO fue a Impulso.`);
        } else {
          const partes = [
            `🤖 IA: pago ${result.amountCop ? formatCOP(result.amountCop) : 'sin monto legible'}`,
            result.isValidDestination ? `✅ destino ${nequiLocal} confirmado` : '⚠️ destino no legible',
            result.statusOk ? '✅ estado exitoso' : '⚠️ estado no confirmado',
          ];
          toast.success(partes.join(' · '));
        }
      } catch (aiErr) {
        toast.error('🤖 La IA no pudo leer la captura. Puedes escribir el código manualmente');
        void aiErr;
      } finally {
        setAnalyzing(false);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : friendlyError(err));
    } finally {
      setCompressing(false);
    }
  }

  /** 📷 Procesa el contenido crudo del QR escaneado con la cámara. */
  function handleScanned(raw: string): void {
    setScannerOpen(false);
    if (scannedRef.current) return;
    const code = raw.trim();
    if (/^3\d{9}$/.test(code)) {
      setErrorMsg('Ese QR era un número de celular, no el comprobante. Escanea el QR de la PANTALLA DE CONFIRMACIÓN del pago.');
      return;
    }
    if (/^https?:/i.test(code)) {
      setErrorMsg('Ese QR era un enlace web. Escanea el QR de confirmación de tu app de pago.');
      return;
    }
    if (code.length < 4 || code.length > 40) {
      setErrorMsg('El QR leído no parece un comprobante. Puedes escribir el código manualmente.');
      return;
    }
    scannedRef.current = true;
    setQrPayload(code);
    setReference(code);
    toast.success(`✅ QR leído: código cargado. Verifica y envía`);
  }

  /** 📲 Abre la app del método elegido (deep link → tienda como plan B). */
  function openPaymentApp(): void {
    const schemes: Record<PaymentMethod, string> = {
      Nequi: 'nequi://',
      Daviplata: 'daviplata://',
      Bancolombia: 'bancolombia://',
      Llave: 'nequi://',
    };
    const stores: Record<PaymentMethod, string> = {
      Nequi: 'https://play.google.com/store/apps/details?id=com.nequi.mobileApp',
      Daviplata: 'https://play.google.com/store/apps/details?id=com.pedralta.daviplataapp',
      Bancolombia: 'https://play.google.com/store/apps/details?id=com.bancolombia.app',
      Llave: 'https://play.google.com/store/search?q=transfiya&c=apps',
    };
    const fallback = window.setTimeout(() => {
      if (document.visibilityState !== 'hidden') {
        window.open(stores[method], '_blank', 'noopener,noreferrer');
      }
    }, 1400);
    const onHide = (): void => {
      if (document.visibilityState === 'hidden') window.clearTimeout(fallback);
      document.removeEventListener('visibilitychange', onHide);
    };
    document.addEventListener('visibilitychange', onHide);
    window.location.href = schemes[method];
  }

  /** ⬇️ Descarga el QR de pago en 1 clic. */
  function downloadQr(): void {
    if (!generatedQr) return;
    const a = document.createElement('a');
    a.href = generatedQr;
    a.download = 'impulso-qr-pago.png';
    a.click();
    toast.success('📥 QR de pago descargado');
  }

  /** 📤 Paso final: envío con todas las guardias + auto-aprobación instantánea. */
  async function submit() {
    setErrorMsg('');
    if (reference.trim().length < 4) {
      setErrorMsg('Escribe o escanea el código del comprobante (aparece en tu app tras confirmar el pago).');
      return;
    }
    setSubmitting(true);
    try {
      // Guardia instantánea ANTES de gastar el intento
      if (!(await guardNotUsed(reference.trim()))) {
        setSubmitting(false);
        return;
      }
      const ok = aiResult?.looksReal && !aiResult?.suspicious && aiResult?.statusOk && aiResult?.isValidDestination && aiResult?.amountCop === plan.priceCop;
      const note = aiResult
        ? [
            aiResult.looksReal ? 'Comprobante válido' : 'IA no lo reconoce',
            aiResult.suspicious ? '🚨 POSIBLE FRAUDE (captura editada/pendiente)' : '',
            aiResult.amountCop ? `monto leído ${aiResult.amountCop}` : 'monto no legible',
            aiResult.destinationDetected ? `destino ${aiResult.destinationDetected}` : 'destino no legible',
            aiResult.isValidDestination ? '✅ destino oficial confirmado' : '⚠️ destino no confirmado',
            aiResult.statusOk ? '✅ pago exitoso' : '⚠️ estado no confirmado',
            aiResult.dateDetected ? `fecha ${aiResult.dateDetected}` : '',
            aiResult.note,
          ].filter(Boolean).join(' · ')
        : null;

      const order = await submitCreditOrder({
        packageName: plan.name,
        creditsRequested: plan.credits,
        amountCop: plan.priceCop,
        referenceCode: reference.trim(),
        paymentMethod: method,
        receiptThumb: receipt,
        aiNote: note,
        receiptHash,
        destinationDetected: aiResult?.destinationDetected ?? null,
        qrPayload,
        iaStatusOk: Boolean(ok),
      });

      // ⚡ Auto-aprobación instantánea (si el Admin la activó y todo cuadra)
      if (ok && autoApproveOn) {
        const res = await autoApproveCreditOrder(order.id);
        if (res.approved) {
          setSuccessMsg(`⚡ ¡CRÉDITOS Acreditados AL INSTANTE! +${res.credits ?? plan.credits} créditos ya están en tu cuenta. ¡A publicar!`);
          toast.success(`⚡ +${res.credits ?? plan.credits} créditos añadidos automáticamente`);
          onCreditsApproved?.((profile.credits ?? 0) + (res.credits ?? plan.credits));
          setSubmitting(false);
          return;
        }
      }

      setSuccessMsg('✅ Comprobante validado y registrado con huella única: el administrador lo confirmará en minutos.');
      openWhatsApp(
        nequiDigits,
        `Hola! Soy ${profile.business_name} (${profile.municipality}). Envié el comprobante ${method} por ${formatCOP(plan.priceCop)} — ${plan.name} (${plan.credits} créditos), código ${reference.trim()}. ¡Quedo atento a la activación! 🙌`,
      );
    } catch (err) {
      setErrorMsg(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell open={open} onClose={onClose} closeLabel="Cerrar caja de créditos">
      <div className="p-5 pt-14">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-extrabold text-white">⚡ Recargar Créditos</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              Pago Nequi · Llave · QR — validado con huella única, jamás se canjea dos veces.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="pressable grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-slate-950/60 text-slate-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Planes */}
        <div className="mt-4 space-y-2">
          {CREDIT_PACKAGES.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setPlanIdx(i)}
              className={cx(
                'pressable flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-all duration-300',
                planIdx === i
                  ? 'border-impulso-emerald/50 bg-impulso-emerald/10 shadow-glow'
                  : 'border-white/[0.08] bg-slate-950/40 hover:border-impulso-emerald/25',
              )}
            >
              <span className="text-2xl">{p.emoji}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-extrabold text-white">
                  {p.name}
                  {p.best && (
                    <span className="rounded-full bg-impulso-gold/20 px-1.5 py-0.5 text-[9px] font-extrabold text-impulso-gold">
                      MÁS ELEGIDO
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-[11px] font-semibold text-slate-400">{p.note}</span>
              </span>
              <span className="text-right">
                <span className="block text-base font-extrabold text-impulso-mint tabular-nums tracking-tight">
                  {formatCOP(p.priceCop)}
                </span>
                <span className="block text-[10px] font-bold text-slate-500 tabular-nums">{p.credits} créditos</span>
              </span>
            </button>
          ))}
        </div>

        {/* 💳 V18 · Las 3 opciones de pago hacia el Admin */}
        <div className="mt-4 space-y-2 rounded-2xl border border-impulso-emerald/25 bg-impulso-emerald/5 p-3.5">
          <p className="flex items-center gap-1.5 text-xs font-bold text-impulso-mint">
            <ShieldCheck className="h-4 w-4" /> Paga {formatCOP(plan.priceCop)} a {holderName}:
          </p>
          {/* Opción 1: Nequi / Daviplata */}
          <div className="rounded-xl border border-white/10 bg-slate-950/40 p-2.5">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Opción 1 · Número Nequi / Daviplata</p>
            <div className="mt-1 flex items-center gap-2">
              <p className="flex-1 font-mono text-2xl font-extrabold tracking-[0.1em] text-white tabular-nums">
                {nequiPretty}
              </p>
              <button
                onClick={() => {
                  navigator.clipboard
                    .writeText(nequiLocal)
                    .then(() => toast.success('📋 Número Nequi copiado'))
                    .catch(() => toast.error('No se pudo copiar: escríbelo manualmente'));
                }}
                className="pressable flex items-center gap-1.5 rounded-xl bg-impulso-emerald px-3 py-2.5 text-xs font-extrabold text-slate-950"
              >
                <Copy className="h-4 w-4" /> Copiar número
              </button>
            </div>
            <button
              onClick={openPaymentApp}
              className="pressable mt-1.5 flex w-full items-center justify-center gap-2 rounded-xl border border-impulso-emerald/40 bg-impulso-emerald/10 py-2 text-[11px] font-extrabold text-impulso-mint"
            >
              <ExternalLink className="h-3.5 w-3.5" /> 📲 Ya copié: abrir {method === 'Llave' ? 'Nequi' : method} para recargar
            </button>
          </div>
          {/* Opción 2: Llave Bre-B / Transfiya */}
          <div className="rounded-xl border border-white/10 bg-slate-950/40 p-2.5">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Opción 2 · Llave Bancaria (Bre-B / Transfiya)</p>
            <div className="mt-1 flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate font-mono text-lg font-extrabold text-white">{llave}</p>
              <button
                onClick={() => {
                  navigator.clipboard
                    .writeText(llave)
                    .then(() => toast.success('🔑 Llave copiada: pégala en tu app bancaria'))
                    .catch(() => toast.error('No se pudo copiar la Llave'));
                }}
                className="pressable flex shrink-0 items-center gap-1.5 rounded-xl border border-impulso-gold/40 bg-impulso-gold/15 px-3 py-2.5 text-xs font-extrabold text-impulso-gold"
              >
                <Copy className="h-4 w-4" /> Copiar Llave
              </button>
            </div>
          </div>
          {/* Opción 3: QR de pago (oficial del Admin o generado) */}
          {generatedQr && (
            <div className="rounded-xl border border-white/10 bg-slate-950/40 p-2.5">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Opción 3 · Código QR de pago</p>
              <div className="mt-1 flex items-center gap-3">
                <img src={generatedQr} alt="QR de pago del administrador" className="h-28 w-28 shrink-0 rounded-xl bg-white p-1" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="text-[11px] font-semibold leading-relaxed text-slate-400">
                    Escanéalo desde otro celular o descárgalo para mostrarlo en tu mostrador.
                  </p>
                  <button
                    onClick={downloadQr}
                    className="pressable flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-[11px] font-extrabold text-slate-200"
                  >
                    <Download className="h-3.5 w-3.5" /> Descargar QR
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ⚠️ Errores y ✅ éxitos DENTRO del modal (nunca detrás) */}
        {errorMsg && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/15 p-3 text-red-200" role="alert">
            <X className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-xs font-semibold leading-relaxed">{errorMsg}</p>
          </div>
        )}
        {successMsg && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-impulso-emerald/40 bg-impulso-emerald/15 p-3 text-impulso-mint" role="status">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-xs font-semibold leading-relaxed">{successMsg}</p>
          </div>
        )}

        {/* 🔍 Validación y escaneo del pago realizado */}
        <button
          onClick={() => setScannerOpen(true)}
          className="pressable mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-impulso-gold to-amber-500 py-3.5 text-sm font-extrabold text-slate-950 shadow-glow"
        >
          <QrCode className="h-5 w-5" /> 📷 Ya pagué: escanear el QR del comprobante
        </button>
        <label className="pressable mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-slate-950/40 py-3 text-xs font-semibold text-slate-400 transition hover:border-impulso-emerald/40 hover:text-impulso-mint">
          {compressing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Optimizando tu captura…
            </>
          ) : receipt ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-impulso-mint" /> Captura cargada (toca para cambiarla)
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" /> O 📤 subir / capturar el comprobante (la IA lo audita)
            </>
          )}
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void pickReceipt(e.target.files?.[0])} />
        </label>

        {receipt && (
          <div className="mt-2 flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-slate-950/40 p-2.5">
            <img src={receipt} alt="Comprobante" className="h-14 w-14 rounded-xl object-cover" />
            <div className="min-w-0 flex-1">
              {analyzing ? (
                <p className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                  <Sparkles className="h-4 w-4 animate-pulse text-impulso-gold" /> 🤖 Auditoría forense en curso…
                </p>
              ) : aiResult ? (
                <p className="text-[11px] font-semibold leading-relaxed text-slate-300">
                  {aiResult.suspicious ? '🚨' : aiResult.looksReal ? '✅' : '⚠️'} {aiResult.note}
                  {aiResult.amountCop != null && ` · Monto: ${formatCOP(aiResult.amountCop)}`}
                  {aiResult.destinationDetected && ` · Destino: ${aiResult.destinationDetected}`}
                  {receiptHash && ' · 🔐 Huella única registrada'}
                </p>
              ) : (
                <p className="text-xs font-semibold text-slate-400">Escribe el código manualmente abajo 👇</p>
              )}
            </div>
          </div>
        )}

        {/* Código + método */}
        <input
          value={reference}
          onChange={(e) => setReference(e.target.value.toUpperCase())}
          placeholder="Código del comprobante (ej: M12345 o CUS...) — o escanéalo arriba"
          maxLength={40}
          className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm font-medium uppercase text-white placeholder:font-normal placeholder:normal-case placeholder:text-slate-600 outline-none focus:border-impulso-emerald/60"
        />
        <div className="mt-2 flex gap-2">
          {(['Nequi', 'Daviplata', 'Llave', 'Bancolombia'] as PaymentMethod[]).map((m) => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              className={cx(
                'pressable flex-1 rounded-xl border py-2 text-xs font-bold',
                method === m
                  ? 'border-impulso-emerald/50 bg-impulso-emerald/15 text-impulso-mint'
                  : 'border-white/10 bg-slate-950/40 text-slate-400',
              )}
            >
              {m}
            </button>
          ))}
        </div>

        <button
          onClick={() => void submit()}
          disabled={submitting || analyzing || compressing}
          className="pressable mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-impulso-emerald to-teal-600 py-4 text-sm font-extrabold text-white shadow-glow disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : '📤'} Enviar para Validación {autoApproveOn ? 'y Activación Automática' : 'y Activación'}
        </button>
        <p className="mt-2 text-center text-[10px] leading-relaxed text-slate-500">
          🛡️ Validador forense: huella SHA-256 de la imagen + código único en toda la plataforma + destino {nequiLocal}
          confirmado por IA. {autoApproveOn ? '⚡ Auto-aprobación activa: si todo cuadra, los créditos se suman al instante.' : 'El administrador confirma cada pago antes de acreditar.'}
        </p>
        <p className="mt-1 text-center text-[10px] leading-relaxed text-slate-600">
          Modalidad de venta de licencias de uso de software / créditos publicitarios prepagados bajo régimen
          simplificado / no responsable de IVA (Art. 437 ET Colombia).
        </p>
      </div>
      <QrScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScanned}
        hint="Apunta al QR del comprobante que te mostró la app al confirmar el pago"
      />
    </ModalShell>
  );
}
