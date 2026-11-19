import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { CheckCircle2, Copy, Download, ExternalLink, Loader2, Maximize2, QrCode, ShieldCheck, Sparkles, Upload, X } from 'lucide-react';
import type { PaymentConfig, Profile } from '../../types';
import { CREDIT_PACKAGES } from '../../types';
import { ModalShell } from '../ui/ModalShell';
import { useToast } from '../ui/Toast';
import { compressImageToMicroWebP, compressionSummary } from '../../services/imageCompressor';
import type { ReceiptVerification } from '../../services/gemini.service';
import {
  checkReceiptAlreadyUsed,
  fetchPaymentConfig,
  submitVerifiedCreditOrderOnServer,
  verifyReceiptOnServer,
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
  /** 🔍 V39.0 · Vista ampliada sobre fondo blanco puro para escaneo bancario 100% confiable. */
  const [qrZoomOpen, setQrZoomOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    scannedRef.current = false;
    setErrorMsg('');
    setSuccessMsg('');
    setQrZoomOpen(false);
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

  const daviDigitsRaw = (payConfig?.daviplataPhone || '').replace(/\D/g, '');
  const daviLocal = daviDigitsRaw.length >= 10
    ? (daviDigitsRaw.startsWith('57') ? daviDigitsRaw.slice(2) : daviDigitsRaw)
    : nequiLocal;
  const daviPretty = `${daviLocal.slice(0, 3)} ${daviLocal.slice(3, 6)} ${daviLocal.slice(6)}`;

  const llave = payConfig?.llave?.trim() || '@impulso3158942112';
  const holderName = payConfig?.holderName?.trim() || 'Administrador Impulso';
  const autoApproveOn = payConfig?.autoApprove === true;

  // V39.0 · QR oficial ESTRICTO por canal (cero QR sintéticos de texto plano que rechazan las apps bancarias)
  const channelQr =
    method === 'Daviplata'
      ? (payConfig?.daviplataQrThumb?.trim() || '')
      : method === 'Llave'
        ? (payConfig?.llaveQrThumb?.trim() || '')
        : (payConfig?.qrThumb?.trim() || '');
  const hasOfficialQr = Boolean(channelQr);
  const activeCopyValue = method === 'Daviplata' ? daviLocal : method === 'Llave' ? llave : nequiLocal;
  const activePrettyLabel = method === 'Daviplata' ? daviPretty : method === 'Llave' ? llave : nequiPretty;

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

  /** 📤 Paso 2 · Auditoría forense IA + SHA-256 estrictamente en servidor (/api/verify-receipt). */
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
      // 🔍 QR embebido en la captura, si lo tiene (el servidor recalcula SHA-256 + OCR)
      const qr = await decodeQrFromImage(thumb);
      if (qr) setQrPayload(qr);
      setAnalyzing(true);
      try {
        const srv = await verifyReceiptOnServer({
          imageDataUrl: thumb,
          referenceCode: reference.trim(),
          qrPayload: qr,
        });
        setReceiptHash(srv.receiptHash);
        const result = srv.verification;
        setAiResult(result);
        if (result?.reference) setReference(result.reference);
        else if (qr && !reference.trim()) setReference(qr.replace(/[^A-Za-z0-9.\-]/g, '').slice(0, 40));

        if (srv.alreadyUsed) {
          setErrorMsg(srv.usedReason || '🚫 ESTE COMPROBANTE YA FUE UTILIZADO: cada pago solo puede canjearse una única vez.');
        } else if (result && !result.looksReal) {
          setErrorMsg('🤖 La IA del servidor no reconoció un comprobante válido. Sube la captura original de tu app.');
        } else if (result?.suspicious) {
          setErrorMsg('🚨 El auditor IA detectó señales de captura editada o pago no confirmado. Envía la captura original.');
        } else if (result && result.amountCop != null && result.amountCop !== plan.priceCop) {
          setErrorMsg(`⚠️ La IA leyó ${formatCOP(result.amountCop)} pero el plan elegido cuesta ${formatCOP(plan.priceCop)}. Verifica el monto.`);
        } else if (result && result.destinationDetected && !result.isValidDestination) {
          setErrorMsg(`🚨 El comprobante muestra destino ${result.destinationDetected} pero la cuenta oficial es ${srv.officialNequi || nequiPretty}. Ese pago NO fue a Impulso.`);
        } else if (result) {
          const partes = [
            `🤖 Servidor IA: pago ${result.amountCop ? formatCOP(result.amountCop) : 'sin monto legible'}`,
            result.isValidDestination ? `✅ destino ${srv.officialNequi || nequiLocal} confirmado` : '⚠️ destino no legible',
            result.statusOk ? '✅ estado exitoso' : '⚠️ estado no confirmado',
          ];
          toast.success(partes.join(' · '));
        }
      } catch {
        toast.error('🤖 El servidor no pudo leer automáticamente la captura. Verifica tu código manualmente');
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

  /** ⬇️ Descarga el QR oficial de pago en 1 clic. */
  function downloadQr(): void {
    if (!channelQr) return;
    const a = document.createElement('a');
    a.href = channelQr;
    a.download = `impulso-qr-oficial-${method.toLowerCase()}.png`;
    a.click();
    toast.success(`📥 QR oficial de ${method} descargado`);
  }

  /** 📤 Paso final: validación de pago segura en servidor (/api/verify-receipt). */
  async function submit() {
    setErrorMsg('');
    if (!receipt) {
      setErrorMsg('Adjunta primero la captura de tu pago Nequi/Llave para iniciar la validación de pago.');
      return;
    }
    if (reference.trim().length < 4) {
      setErrorMsg('Escribe o escanea el código del comprobante (aparece en tu app tras confirmar el pago).');
      return;
    }
    setSubmitting(true);
    try {
      if (!(await guardNotUsed(reference.trim()))) {
        setSubmitting(false);
        return;
      }

      const srv = await submitVerifiedCreditOrderOnServer({
        packageId: plan.id,
        paymentMethod: method,
        imageDataUrl: receipt,
        referenceCode: reference.trim(),
        qrPayload,
      });

      setReceiptHash(srv.receiptHash);
      if (srv.verification) setAiResult(srv.verification);

      if (srv.autoApproved) {
        const added = srv.approvedCredits || plan.credits;
        setSuccessMsg(`⚡ ¡CRÉDITOS acreditados al instante! +${added} créditos ya están en tu cuenta. ¡A publicar!`);
        toast.success(`⚡ +${added} créditos añadidos automáticamente`);
        onCreditsApproved?.((profile.credits ?? 0) + added);
        return;
      }

      setSuccessMsg(
        srv.reviewReason
          ? `✅ Comprobante recibido: ${srv.reviewReason}`
          : '✅ Comprobante recibido con verificación de seguridad: el administrador confirmará tus créditos en minutos.',
      );
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
      <div className="p-5 pt-5">
        <div className="pr-11">
          <h3 className="text-lg font-extrabold text-white">⚡ Recargar Créditos</h3>
          <p className="mt-0.5 text-xs text-slate-400">
            Pago Nequi · Daviplata · Llave · QR — Validación de Pago con Verificación de Seguridad Asegurada.
          </p>
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

        {/* 💳 V37 · Selector limpio de canal oficial (Nequi / Daviplata / Llave) + QR específico del canal */}
        <div className="mt-4 space-y-2.5 rounded-2xl border border-impulso-emerald/25 bg-impulso-emerald/5 p-3.5">
          <p className="flex items-center gap-1.5 text-xs font-bold text-impulso-mint">
            <ShieldCheck className="h-4 w-4" /> Elige tu canal y paga {formatCOP(plan.priceCop)} a {holderName}:
          </p>

          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { id: 'Nequi' as const, label: '💜 Nequi' },
                { id: 'Daviplata' as const, label: '❤️ Daviplata' },
                { id: 'Llave' as const, label: '🔑 Llave' },
              ]
            ).map((ch) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => setMethod(ch.id)}
                className={cx(
                  'pressable rounded-xl border py-2 text-xs font-extrabold transition',
                  method === ch.id
                    ? 'border-impulso-emerald/60 bg-impulso-emerald/20 text-white shadow-sm'
                    : 'border-white/10 bg-slate-950/50 text-slate-400 hover:text-white',
                )}
              >
                {ch.label}
              </button>
            ))}
          </div>

          {/* Dato oficial del canal seleccionado */}
          <div className="rounded-xl border border-white/10 bg-slate-950/45 p-2.5">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
              {method === 'Daviplata'
                ? 'Cuenta oficial Daviplata'
                : method === 'Llave'
                  ? 'Llave oficial Bre-B / Transfiya'
                  : 'Cuenta oficial Nequi'}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate font-mono text-xl font-extrabold tracking-[0.06em] text-white tabular-nums">
                {activePrettyLabel}
              </p>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard
                    .writeText(activeCopyValue)
                    .then(() => toast.success(`📋 ${method} copiado al portapapeles`))
                    .catch(() => toast.error('No se pudo copiar: escríbelo manualmente'));
                }}
                className="pressable flex shrink-0 items-center gap-1.5 rounded-xl bg-impulso-emerald px-3 py-2 text-xs font-extrabold text-slate-950"
              >
                <Copy className="h-4 w-4" /> Copiar
              </button>
            </div>
            <button
              type="button"
              onClick={openPaymentApp}
              className="pressable mt-1.5 flex w-full items-center justify-center gap-2 rounded-xl border border-impulso-emerald/40 bg-impulso-emerald/10 py-2 text-[11px] font-extrabold text-impulso-mint"
            >
              <ExternalLink className="h-3.5 w-3.5" /> 📲 Abrir {method === 'Llave' ? 'mi app bancaria' : method} para pagar
            </button>
          </div>

          {/* QR oficial bancario del canal elegido (solo imagen oficial real: cero QRs falsos) */}
          {hasOfficialQr ? (
            <div className="rounded-xl border border-impulso-emerald/30 bg-slate-950/50 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Código QR oficial · {method}
                </p>
                <span className="rounded-full bg-impulso-emerald/15 px-2 py-0.5 text-[9px] font-extrabold text-impulso-mint">
                  ✅ QR Bancario Oficial
                </span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQrZoomOpen(true)}
                  title="Toca para ampliar el QR en alta nitidez"
                  className="pressable shrink-0 rounded-2xl bg-white p-2 shadow-md ring-2 ring-impulso-emerald/40"
                >
                  <img
                    src={channelQr}
                    alt={`QR oficial ${method} del administrador`}
                    className="h-28 w-28 object-contain"
                  />
                </button>
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-[11px] font-semibold leading-relaxed text-slate-300">
                    Escanea este QR oficial directo desde {method === 'Llave' ? 'tu app bancaria' : method}, amplíalo en pantalla o descárgalo a tu galería.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setQrZoomOpen(true)}
                      className="pressable flex items-center gap-1 rounded-xl border border-impulso-emerald/40 bg-impulso-emerald/15 px-2.5 py-1.5 text-[11px] font-extrabold text-impulso-mint"
                    >
                      <Maximize2 className="h-3.5 w-3.5" /> Ampliar QR
                    </button>
                    <button
                      type="button"
                      onClick={downloadQr}
                      className="pressable flex items-center gap-1 rounded-xl border border-white/10 bg-slate-950/70 px-2.5 py-1.5 text-[11px] font-extrabold text-slate-200"
                    >
                      <Download className="h-3.5 w-3.5" /> Descargar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-400/25 bg-amber-500/[0.07] px-3 py-2.5 text-[11px] font-semibold leading-relaxed text-amber-100">
              ℹ️ El administrador aún no cargó una imagen QR para <strong>{method}</strong>. Copia el número o Llave oficial arriba y realiza tu pago directo desde tu app bancaria.
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
              <Upload className="h-4 w-4" /> O 📤 subir / capturar el comprobante (validación automática)
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
                  <Sparkles className="h-4 w-4 animate-pulse text-impulso-gold" /> 🤖 Validación de pago en curso…
                </p>
              ) : aiResult ? (
                <p className="text-[11px] font-semibold leading-relaxed text-slate-300">
                  {aiResult.suspicious ? '🚨' : aiResult.looksReal ? '✅' : '⚠️'} {aiResult.note}
                  {aiResult.amountCop != null && ` · Monto: ${formatCOP(aiResult.amountCop)}`}
                  {aiResult.destinationDetected && ` · Destino: ${aiResult.destinationDetected}`}
                  {receiptHash && ' · 🔒 Verificación de Seguridad Asegurada'}
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
          🛡️ Verificación de Seguridad Asegurada: comprobante único validado + destino {nequiLocal} confirmado.{' '}
          {autoApproveOn ? '⚡ Auto-aprobación activa: si todo cuadra, los créditos se suman al instante.' : 'El administrador confirma cada pago antes de acreditar.'}
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
      {qrZoomOpen && hasOfficialQr && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/90 p-5 backdrop-blur-md"
          onClick={() => setQrZoomOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`QR oficial ampliado de ${method}`}
        >
          <div
            className="w-full max-w-xs space-y-3 rounded-3xl border border-impulso-emerald/40 bg-slate-900 p-5 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-extrabold text-impulso-mint">QR Oficial · {method}</p>
              <button
                type="button"
                onClick={() => setQrZoomOpen(false)}
                aria-label="Cerrar vista ampliada"
                className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mx-auto rounded-2xl bg-white p-4 shadow-inner">
              <img
                src={channelQr}
                alt={`QR bancario oficial ${method}`}
                className="mx-auto h-60 w-60 object-contain"
              />
            </div>
            <p className="text-[11px] font-bold text-slate-300">
              {holderName} · <span className="font-mono text-white">{activePrettyLabel}</span>
            </p>
            <button
              type="button"
              onClick={downloadQr}
              className="pressable flex w-full items-center justify-center gap-1.5 rounded-xl bg-impulso-emerald py-2.5 text-xs font-extrabold text-slate-950"
            >
              <Download className="h-4 w-4" /> Guardar QR en mi galería
            </button>
          </div>
        </div>
      )}
    </ModalShell>
  );
}
