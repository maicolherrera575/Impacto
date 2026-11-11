import { useRef, useState } from 'react';

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechResultEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechResultEventLike {
  results: { length: number; [index: number]: { [index: number]: { transcript: string } } };
}

interface SpeechRecognitionCtor {
  new (): SpeechRecognitionLike;
}

/**
 * Dictado por voz nativo del navegador (es-CO) para el Creador Mágico.
 * Si el navegador no lo soporta, la interfaz degrada con elegancia.
 */
export function useSpeechRecognition(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const supported =
    typeof window !== 'undefined' &&
    !!(window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor; SpeechRecognition?: SpeechRecognitionCtor })
      .SpeechRecognition ||
    typeof window !== 'undefined' &&
    !!(window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor }).webkitSpeechRecognition;

  function start(): void {
    const Ctor =
      (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor }).webkitSpeechRecognition;
    if (!Ctor || listening) return;

    const recognition = new Ctor();
    recognition.lang = 'es-CO';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const result = event.results?.[0]?.[0]?.transcript;
      if (result) onResult(result.trim());
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  function stop(): void {
    recognitionRef.current?.stop();
    setListening(false);
  }

  return { supported, listening, start, stop } as const;
}
