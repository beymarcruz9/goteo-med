import { Injectable, signal } from '@angular/core';

/**
 * Servicio de metrónomo de audio de cero latencia usando Web Audio API pura.
 * Sintetiza un pulso tipo "tick" / gota clínica sin archivos MP3 externos ni
 * retrasos de decodificación, sincronizado al milisegundo con el Canvas.
 */
@Injectable({
  providedIn: 'root',
})
export class AudioMetronomeService {
  private audioCtx: AudioContext | null = null;
  readonly enabled = signal<boolean>(true);

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    const AudioContextCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioContextCtor) return null;

    if (!this.audioCtx) {
      this.audioCtx = new AudioContextCtor({ latencyHint: 'interactive' });
    }

    if (this.audioCtx.state === 'suspended') {
      void this.audioCtx.resume();
    }

    return this.audioCtx;
  }

  /**
   * Debe invocarse dentro de un gesto del usuario (click/touch) para desbloquear
   * el AudioContext en navegadores móviles iOS/Android.
   */
  unlock(): void {
    this.ensureContext();
  }

  toggle(): boolean {
    const next = !this.enabled();
    this.enabled.set(next);
    if (next) {
      this.unlock();
      this.playDropTick();
    }
    return next;
  }

  setEnabled(value: boolean): void {
    this.enabled.set(value);
    if (value) {
      this.unlock();
    }
  }

  /**
   * Emite el sonido exacto de impacto de gota con ataque instantáneo (<2ms).
   */
  playDropTick(): void {
    if (!this.enabled()) return;
    const ctx = this.ensureContext();
    if (!ctx || ctx.state !== 'running') return;

    const now = ctx.currentTime;

    // Oscilador principal: timbre limpio de gota médica / metrónomo clínico
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1180, now);
    osc.frequency.exponentialRampToValueAtTime(620, now + 0.045);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.28, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.06);

    // Transiente breve de alta frecuencia para claridad en ambientes ruidosos (APH/ambulancia)
    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(2400, now);

    clickGain.gain.setValueAtTime(0.0001, now);
    clickGain.gain.linearRampToValueAtTime(0.09, now + 0.001);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.014);

    clickOsc.connect(clickGain);
    clickGain.connect(ctx.destination);

    clickOsc.start(now);
    clickOsc.stop(now + 0.016);
  }

  /**
   * Señal sonora suave para alarma de fin de infusión en modo PWA navegador.
   */
  playAlarmChime(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    const baseTime = ctx.currentTime;
    const notes = [880, 1174.66, 1318.51]; // A5 - D6 - E6 alerta clínica amable

    notes.forEach((freq, idx) => {
      const start = baseTime + idx * 0.18;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.24, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.3);
    });
  }
}
