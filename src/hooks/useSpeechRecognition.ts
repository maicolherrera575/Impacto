import { useCallback, useEffect, useRef, useState } from 'react';

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechResultEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
}

interface SpeechResultEventLike {
  results: { length: number; [index: number]: { isFinal?: boolean; [index: number]: { transcript: string } } };
}

interface SpeechRecognitionCtor {
  new (): SpeechRecognitionLike;
}

/**
 * Dictado por voz nativo del navegador (es-CO).
 * V40.0 · Limpia siempre el buffer/instancia al enviar o detener (cero texto fantasma).
 */
export function useSpeechRecognition(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const supported =
    typeof window !== 'undefined' &&
    (Boolean((window as unknown as { SpeechRecognition?: SpeechRecognitionCtor }).SpeechRecognition) ||
      Boolean((window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor }).webkitSpeechRecognition));

  const teardown = useCallback((abortActive = false) => {
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    if (rec) {
      rec.onresult = null;
      rec.onend = null;
      rec.onerror = null;
      try {
        if (abortActive && typeof rec.abort === 'function') rec.abort();
        else rec.stop();
      } catch {
        /* instancia ya cerrada */
      }
    }
    setListening(false);
  }, []);

  const start = useCallback((): void => {
    const Ctor =
      (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor }).webkitSpeechRecognition;
    if (!Ctor) return;
    if (recognitionRef.current) {
      teardown(true);
    }

    const recognition = new Ctor();
    recognition.lang = 'es-CO';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const parts: string[] = [];
      for (let i = 0; i < (event.results?.length ?? 0); i += 1) {
        const piece = event.results[i]?.[0]?.transcript?.trim();
        if (piece) parts.push(piece);
      }
      const transcript = parts.join(' ').trim();
      teardown(false);
      if (transcript) {
        onResultRef.current(transcript);
      }
    };
    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
      }
      setListening(false);
    };
    recognition.onerror = () => {
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
      }
      setListening(false);
    };

    recognitionRef.current = recognition;
    setListening(true);
    try {
      recognition.start();
    } catch {
      teardown(true);
    }
  }, [teardown]);

  const stop = useCallback((): void => {
    teardown(true);
  }, [teardown]);

  useEffect(() => () => teardown(true), [teardown]);

  return { supported, listening, start, stop } as const;
}
