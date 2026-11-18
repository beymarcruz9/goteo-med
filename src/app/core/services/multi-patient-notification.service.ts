import { Injectable, inject, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { ComputedPatientState, PatientInfusionRecord } from '../models/shift.model';
import { AudioMetronomeService } from './audio-metronome.service';

const PRE_ALERT_MINUTES = 15;

export interface ActiveAlertNotice {
  patientId: string;
  title: string;
  body: string;
  timestamp: number;
}

/**
 * Servicio de alertas multi-paciente en segundo plano.
 * Programa notificaciones locales nativas independientes por cada paciente
 * 15 minutos antes de que termine su suero, incluso con la APK completamente cerrada.
 */
@Injectable({
  providedIn: 'root',
})
export class MultiPatientNotificationService {
  private readonly audio = inject(AudioMetronomeService);
  private readonly webTimers = new Map<string, ReturnType<typeof setTimeout>>();

  readonly permissionGranted = signal<boolean>(false);
  readonly activeBanner = signal<ActiveAlertNotice | null>(null);

  async ensurePermissions(): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      try {
        const status = await LocalNotifications.checkPermissions();
        if (status.display === 'granted') {
          this.permissionGranted.set(true);
          return true;
        }
        const requested = await LocalNotifications.requestPermissions();
        const granted = requested.display === 'granted';
        this.permissionGranted.set(granted);
        return granted;
      } catch {
        return false;
      }
    }

    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        this.permissionGranted.set(true);
        return true;
      }
      if (Notification.permission === 'default') {
        try {
          const perm = await Notification.requestPermission();
          const granted = perm === 'granted';
          this.permissionGranted.set(granted);
          return granted;
        } catch {
          return false;
        }
      }
    }

    return false;
  }

  /**
   * Programa o reprograma la alerta de -15 minutos para un paciente específico.
   */
  async syncPatientAlarm(computedState: ComputedPatientState): Promise<void> {
    const { record, remainingMinutes, estimatedEndTimeMs, solutionDisplayName, isCompleted } =
      computedState;

    await this.cancelPatientAlarm(record.id, record.notificationId);

    if (!record.alarmEnabled || isCompleted || remainingMinutes <= 0.3) {
      return;
    }

    const nowMs = Date.now();
    const leadMinutes = remainingMinutes > PRE_ALERT_MINUTES ? PRE_ALERT_MINUTES : 0;
    const triggerAtMs = Math.max(nowMs + 5_000, estimatedEndTimeMs - leadMinutes * 60_000);
    const triggerAt = new Date(triggerAtMs);

    const additivesText =
      record.additives.length > 0
        ? ` + ${record.additives.map((a) => `${a.name} ${a.dose}`).join(', ')}`
        : '';

    const locationTag = `${record.ward} · Cama ${record.bed}`;
    const title =
      leadMinutes > 0
        ? `⚠️ Suero por terminar (${leadMinutes} min) — ${locationTag}`
        : `🔴 Suero finalizado — ${locationTag}`;

    const body = `${record.patientName}: ${solutionDisplayName}${additivesText}. ${
      leadMinutes > 0 ? 'Preparar recambio o retiro de venoclisis.' : 'Revisar vía inmediatamente.'
    }`;

    if (Capacitor.isNativePlatform()) {
      try {
        const granted = await this.ensurePermissions();
        if (!granted) return;

        await LocalNotifications.schedule({
          notifications: [
            {
              id: record.notificationId,
              title,
              body,
              schedule: {
                at: triggerAt,
                allowWhileIdle: true,
              },
              sound: 'default',
              extra: {
                patientId: record.id,
                ward: record.ward,
                bed: record.bed,
              },
            },
          ],
        });
      } catch {
        // Fallo silencioso para no bloquear operaciones clínicas
      }
      return;
    }

    // Respaldo PWA Web: temporizador en memoria + Web Notification API
    const delayMs = triggerAtMs - Date.now();
    if (delayMs > 0 && delayMs <= 2_147_483_647) {
      const handle = setTimeout(() => {
        this.webTimers.delete(record.id);
        this.audio.playAlarmChime();
        this.activeBanner.set({
          patientId: record.id,
          title,
          body,
          timestamp: Date.now(),
        });

        if (
          typeof window !== 'undefined' &&
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          try {
            new Notification(title, {
              body,
              icon: 'icons/icon.svg',
              tag: `goteomed-patient-${record.notificationId}`,
            });
          } catch {
            // Sin acción
          }
        }
      }, delayMs);

      this.webTimers.set(record.id, handle);
    }
  }

  async cancelPatientAlarm(patientId: string, notificationId: number): Promise<void> {
    const existing = this.webTimers.get(patientId);
    if (existing !== undefined) {
      clearTimeout(existing);
      this.webTimers.delete(patientId);
    }

    if (Capacitor.isNativePlatform()) {
      try {
        await LocalNotifications.cancel({
          notifications: [{ id: notificationId }],
        });
      } catch {
        // Ignorar si no estaba agendada
      }
    }
  }

  async cancelAllForPatients(patients: readonly PatientInfusionRecord[]): Promise<void> {
    for (const handle of this.webTimers.values()) {
      clearTimeout(handle);
    }
    this.webTimers.clear();
    this.activeBanner.set(null);

    if (Capacitor.isNativePlatform() && patients.length > 0) {
      try {
        await LocalNotifications.cancel({
          notifications: patients.map((p) => ({ id: p.notificationId })),
        });
      } catch {
        // Ignorar
      }
    }
  }

  dismissBanner(): void {
    this.activeBanner.set(null);
  }
}
