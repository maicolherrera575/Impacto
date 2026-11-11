/**
 * Alerta sonora nativa (sin assets): doble tono cristalino generado
 * con la Web Audio API. Se dispara al llegar una reserva en vivo.
 */
export function beepAlert(): void {
  try {
    const Ctx: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;

    const ctx = new Ctx();
    const now = ctx.currentTime;

    const tones: Array<[number, number]> = [
      [880, 0], // La5
      [1318.5, 0.16], // Mi6
    ];

    for (const [freq, offset] of tones) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = now + offset;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.22, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.17);
    }

    window.setTimeout(() => void ctx.close().catch(() => undefined), 800);
  } catch {
    /* El sonido es un extra: nunca rompe la experiencia */
  }
}
