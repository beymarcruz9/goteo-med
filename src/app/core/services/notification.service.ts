import { Injectable, inject, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { InfusionResult, ScheduledAlarm } from '../models/infusion.model';
import { AudioMetronomeService } from './audio-metronome.service';

const ALARM_STORAGE_KEY = 'goteomed_active_alarm_v1';
const ALARM_NOTIFICATION_ID = 10415;
const DEFAULT_LEAD_MINUTES = 15;

export interface AlarmActionOutcome {
  ok: boolean;
  message: string;
  alarm?: ScheduledAlarm;
}

/**
 * Gestiona la programación de alertas locales 15 minutos antes de la finalización
 * de la solución intravenosa usando @capacitor/local-notifications en nativo,
 * con respaldo inteligente (Web Notifications + temporizador activo) en PWA web.
 */
@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private readonly audio = inject(AudioMetronomeService);
  private webTimerHandle: ReturnType<typeof setTimeout> | null = null;

  readonly activeAlarm = signal<ScheduledAlarm | null>(this.restoreAlarm());
  readonly alarmTriggeredBanner = signal<string | null>(null);

  constructor() {
    const existing = this.activeAlarm();
    if (existing && existing.platform === 'web') {
      this.armWebTimer(existing);
    }
  }

  async schedulePreCompletionAlarm(
    result: InfusionResult,
    leadMinutes = DEFAULT_LEAD_MINUTES
  ): Promise<AlarmActionOutcome> {
    const nowMs = Date.now();
    const endMs = result.estimatedEndTime.getTime();
    const remainingMinutes = (endMs - nowMs) / 60_000;

    if (remainingMinutes <= 0.25) {
      return {
        ok: false,
        message: 'La infusión ya finalizó o está por terminar en menos de 15 segundos.',
      };
    }

    // Si el tiempo restante es <= 15 min, programamos aviso al finalizar la solución
    const effectiveLeadMinutes = remainingMinutes > leadMinutes ? leadMinutes : 0;
    const triggerAt = new Date(endMs - effectiveLeadMinutes * 60_000);

    await this.cancelAlarm();

    const title =
      effectiveLeadMinutes > 0
        ? `Venoclisis finaliza en ${effectiveLeadMinutes} min`
        : 'Venoclisis finalizada';

    const body =
      effectiveLeadMinutes > 0
        ? `Solución de ${Math.round(result.volumeMl)} ml (${result.roundedDropsPerMinute} gotas/min). Preparar cambio o retiro de vía.`
        : `Tu solución de ${Math.round(result.volumeMl)} ml ha alcanzado su hora estimada de finalización.`;

    if (Capacitor.isNativePlatform()) {
      try {
        const permStatus = await LocalNotifications.checkPermissions();
        let granted = permStatus.display === 'granted';
        if (!granted) {
          const requested = await LocalNotifications.requestPermissions();
          granted = requested.display === 'granted';
        }

        if (!granted) {
          return {
            ok: false,
            message: 'Permiso de notificaciones denegado en el dispositivo.',
          };
        }

        await LocalNotifications.schedule({
          notifications: [
            {
              id: ALARM_NOTIFICATION_ID,
              title,
              body,
              schedule: { at: triggerAt, allowWhileIdle: true },
              sound: 'default',
              extra: {
                volumeMl: result.volumeMl,
                dropsPerMinute: result.roundedDropsPerMinute,
              },
            },
          ],
        });

        const alarm: ScheduledAlarm = {
          id: ALARM_NOTIFICATION_ID,
          triggerAt,
          endTime: result.estimatedEndTime,
          leadMinutes: effectiveLeadMinutes,
          volumeMl: result.volumeMl,
          dropsPerMinute: result.roundedDropsPerMinute,
          platform: 'capacitor',
        };
        this.persistAlarm(alarm);

        return {
          ok: true,
          alarm,
          message:
            effectiveLeadMinutes > 0
              ? `Alarma nativa programada ${effectiveLeadMinutes} min antes (${this.formatTime(triggerAt)}).`
              : `Tiempo restante ≤ 15 min: alarma programada para el fin (${this.formatTime(triggerAt)}).`,
        };
      } catch {
        return {
          ok: false,
          message: 'No se pudo programar la notificación local nativa.',
        };
      }
    }

    // Modo Web / PWA: solicitar permiso Web Notification API si existe + temporizador interno
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        try {
          await Notification.requestPermission();
        } catch {
          // Continuar con aviso en pantalla si el usuario cierra el diálogo
        }
      }
    }

    const alarm: ScheduledAlarm = {
      id: ALARM_NOTIFICATION_ID,
      triggerAt,
      endTime: result.estimatedEndTime,
      leadMinutes: effectiveLeadMinutes,
      volumeMl: result.volumeMl,
      dropsPerMinute: result.roundedDropsPerMinute,
      platform: 'web',
    };

    this.persistAlarm(alarm);
    this.armWebTimer(alarm, title, body);

    return {
      ok: true,
      alarm,
      message:
        effectiveLeadMinutes > 0
          ? `Alarma programada 15 min antes (${this.formatTime(triggerAt)}).`
          : `Duración ≤ 15 min: alarma programada al finalizar (${this.formatTime(triggerAt)}).`,
    };
  }

  async cancelAlarm(): Promise<void> {
    if (this.webTimerHandle !== null) {
      clearTimeout(this.webTimerHandle);
      this.webTimerHandle = null;
    }

    if (Capacitor.isNativePlatform()) {
      try {
        await LocalNotifications.cancel({
          notifications: [{ id: ALARM_NOTIFICATION_ID }],
        });
      } catch {
        // Ignorar si no existía notificación pendiente
      }
    }

    this.activeAlarm.set(null);
    try {
      localStorage.removeItem(ALARM_STORAGE_KEY);
    } catch {
      // Sin acción
    }
  }

  dismissTriggeredBanner(): void {
    this.alarmTriggeredBanner.set(null);
  }

  private armWebTimer(alarm: ScheduledAlarm, customTitle?: string, customBody?: string): void {
    if (this.webTimerHandle !== null) {
      clearTimeout(this.webTimerHandle);
    }

    const delayMs = alarm.triggerAt.getTime() - Date.now();
    if (delayMs <= 0) {
      this.activeAlarm.set(null);
      return;
    }

    // setTimeout máximo seguro en JS es 2^31 - 1 (~24.8 días)
    const safeDelay = Math.min(delayMs, 2_147_483_647);

    const title =
      customTitle ??
      (alarm.leadMinutes > 0
        ? `Venoclisis finaliza en ${alarm.leadMinutes} min`
        : 'Venoclisis finalizada');
    const body =
      customBody ??
      `Solución de ${Math.round(alarm.volumeMl)} ml (${alarm.dropsPerMinute} gotas/min).`;

    this.webTimerHandle = setTimeout(() => {
      this.webTimerHandle = null;
      this.audio.playAlarmChime();
      this.alarmTriggeredBanner.set(`${title} — ${body}`);

      if (
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        try {
          new Notification(title, {
            body,
            icon: 'icons/icon.svg',
            tag: 'goteomed-infusion-alarm',
          });
        } catch {
          // Algunos navegadores móviles requieren ServiceWorkerRegistration.showNotification
        }
      }

      this.activeAlarm.set(null);
      try {
        localStorage.removeItem(ALARM_STORAGE_KEY);
      } catch {
        // Sin acción
      }
    }, safeDelay);
  }

  private persistAlarm(alarm: ScheduledAlarm): void {
    this.activeAlarm.set(alarm);
    try {
      localStorage.setItem(
        ALARM_STORAGE_KEY,
        JSON.stringify({
          ...alarm,
          triggerAt: alarm.triggerAt.toISOString(),
          endTime: alarm.endTime.toISOString(),
        })
      );
    } catch {
      // Sin acción
    }
  }

  private restoreAlarm(): ScheduledAlarm | null {
    try {
      const raw = localStorage.getItem(ALARM_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as {
        id: number;
        triggerAt: string;
        endTime: string;
        leadMinutes: number;
        volumeMl: number;
        dropsPerMinute: number;
        platform: 'capacitor' | 'web';
      };
      const triggerAt = new Date(parsed.triggerAt);
      if (triggerAt.getTime() <= Date.now()) {
        localStorage.removeItem(ALARM_STORAGE_KEY);
        return null;
      }
      return {
        ...parsed,
        triggerAt,
        endTime: new Date(parsed.endTime),
      };
    } catch {
      return null;
    }
  }

  private formatTime(date: Date): string {
    return date.toLocaleTimeString('es', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }
}
