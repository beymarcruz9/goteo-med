import { Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

/**
 * Servicio de vibración háptica sincronizada con cada impacto de gota.
 * Utiliza @capacitor/haptics en dispositivos nativos iOS/Android y
 * navigator.vibrate() como respaldo automático en navegadores PWA.
 */
@Injectable({
  providedIn: 'root',
})
export class HapticsService {
  readonly enabled = signal<boolean>(false);

  readonly isSupported: boolean =
    Capacitor.isNativePlatform() ||
    (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function');

  toggle(): boolean {
    const next = !this.enabled();
    this.enabled.set(next);
    if (next) {
      void this.triggerDropPulse();
    }
    return next;
  }

  setEnabled(value: boolean): void {
    this.enabled.set(value);
  }

  /**
   * Pulso háptico corto (22ms) calibrado para coincidir con el impacto de la gota.
   */
  async triggerDropPulse(): Promise<void> {
    if (!this.enabled()) return;

    try {
      if (Capacitor.isNativePlatform()) {
        await Haptics.impact({ style: ImpactStyle.Light });
        return;
      }

      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(22);
      }
    } catch {
      // Fallo silencioso si el dispositivo restringe vibración en segundo plano
    }
  }

  /**
   * Pulso táctil sutil para controles críticos (ej. ajuste fino + / -).
   */
  async triggerControlTap(): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) {
        await Haptics.selectionChanged();
        return;
      }

      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(10);
      }
    } catch {
      // Sin acción
    }
  }
}
