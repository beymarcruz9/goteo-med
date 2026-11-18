import { Injectable, OnDestroy, computed, inject, signal } from '@angular/core';
import {
  ComputedPatientState,
  PatientFormPayload,
  PatientInfusionRecord,
  PersistedShiftState,
  ShiftDurationPreset,
  ShiftSession,
  UrgencyLevel,
} from '../models/shift.model';
import { MultiPatientNotificationService } from './multi-patient-notification.service';
import { ShiftStorageService } from './shift-storage.service';

const MIN_DROPS_PER_MINUTE = 1;
const MAX_DROPS_PER_MINUTE = 600;

/**
 * Función pura basada en timestamps (Date.now() vs anchorStartTimeMs).
 * Garantiza exactitud matemática aunque la aplicación permanezca cerrada horas.
 */
export function computePatientInfusionState(
  record: PatientInfusionRecord,
  nowMs: number,
  shiftEndTimeMs: number | null
): ComputedPatientState {
  const solutionDisplayName =
    record.solutionType === 'Otro' && record.customSolutionName?.trim()
      ? record.customSolutionName.trim()
      : record.solutionType;

  const safeMlPerHour = Math.max(0.01, record.mlPerHour);
  const elapsedMs = Math.max(0, nowMs - record.anchorStartTimeMs);
  const elapsedHours = elapsedMs / 3_600_000;

  const infusedSinceAnchorMl = elapsedHours * safeMlPerHour;
  const remainingMl = Math.max(0, record.anchorVolumeMl - infusedSinceAnchorMl);
  const infusedThisShiftMl = Math.max(0, record.receivedVolumeMl - remainingMl);

  const remainingMinutes = (remainingMl / safeMlPerHour) * 60;
  const isCompleted = remainingMl <= 0.05;

  const totalDurationFromAnchorMs = (record.anchorVolumeMl / safeMlPerHour) * 3_600_000;
  const estimatedEndTimeMs = record.anchorStartTimeMs + totalDurationFromAnchorMs;

  const safeBagTotal = Math.max(1, record.bagTotalVolumeMl);
  const remainingPercent = Math.min(100, Math.max(0, (remainingMl / safeBagTotal) * 100));
  const progressPercent = Math.min(100, Math.max(0, 100 - remainingPercent));

  let urgency: UrgencyLevel;
  if (isCompleted || remainingMinutes < 15) {
    urgency = 'critical';
  } else if (remainingMinutes <= 45) {
    urgency = 'warning';
  } else {
    urgency = 'stable';
  }

  const secondsPerDrop = 60 / Math.max(0.1, record.exactDropsPerMinute);
  const intervalMs = secondsPerDrop * 1000;
  const mlPerMinute = safeMlPerHour / 60;
  const roundedDropsPerMinute = Math.max(1, Math.round(record.exactDropsPerMinute));
  const fineTuneDelta = record.exactDropsPerMinute - record.baselineDropsPerMinute;
  const isFineTuned = Math.abs(fineTuneDelta) >= 0.05;

  // Proyección para Entrega de Turno (al momento exacto de shiftEndTimeMs)
  const effectiveShiftEndMs = shiftEndTimeMs ?? nowMs;
  const hoursUntilShiftEnd = Math.max(0, (effectiveShiftEndMs - nowMs) / 3_600_000);
  const projectedRemainingAtShiftEndMl = Math.max(
    0,
    remainingMl - hoursUntilShiftEnd * safeMlPerHour
  );
  const projectedInfusedByShiftEndMl = Math.max(
    0,
    record.receivedVolumeMl - projectedRemainingAtShiftEndMl
  );
  const willFinishBeforeShiftEnd = estimatedEndTimeMs <= effectiveShiftEndMs;

  return {
    record,
    solutionDisplayName,
    remainingMl,
    infusedThisShiftMl,
    remainingMinutes,
    estimatedEndTimeMs,
    isCompleted,
    progressPercent,
    remainingPercent,
    urgency,
    secondsPerDrop,
    intervalMs,
    mlPerMinute,
    roundedDropsPerMinute,
    isFineTuned,
    fineTuneDelta,
    projectedRemainingAtShiftEndMl,
    projectedInfusedByShiftEndMl,
    willFinishBeforeShiftEnd,
  };
}

@Injectable({
  providedIn: 'root',
})
export class ShiftManagerService implements OnDestroy {
  private readonly storage = inject(ShiftStorageService);
  private readonly notifications = inject(MultiPatientNotificationService);

  private readonly _shift = signal<ShiftSession | null>(null);
  private readonly _patients = signal<PatientInfusionRecord[]>([]);
  private readonly _nowMs = signal<number>(Date.now());
  private nextNotificationId = 20_001;

  private tickerHandle: ReturnType<typeof setInterval> | null = null;
  private visibilityListener: (() => void) | null = null;

  readonly activeShift = this._shift.asReadonly();
  readonly patients = this._patients.asReadonly();
  readonly nowMs = this._nowMs.asReadonly();

  readonly hasActiveShift = computed(() => this._shift() !== null);

  readonly shiftRemainingMs = computed(() => {
    const s = this._shift();
    if (!s) return 0;
    return Math.max(0, s.endTimeMs - this._nowMs());
  });

  readonly isShiftOver = computed(() => {
    const s = this._shift();
    return s !== null && this._nowMs() >= s.endTimeMs;
  });

  readonly shiftProgressPercent = computed(() => {
    const s = this._shift();
    if (!s) return 0;
    const total = Math.max(1, s.endTimeMs - s.startTimeMs);
    const elapsed = Math.max(0, this._nowMs() - s.startTimeMs);
    return Math.min(100, (elapsed / total) * 100);
  });

  /**
   * Lista reactiva de todos los pacientes con estado recalculado contra Date.now(),
   * ordenada automáticamente por semáforo de urgencia (menos tiempo restante arriba).
   */
  readonly computedPatients = computed<ComputedPatientState[]>(() => {
    const now = this._nowMs();
    const shiftEnd = this._shift()?.endTimeMs ?? null;
    const list = this._patients().map((record) =>
      computePatientInfusionState(record, now, shiftEnd)
    );

    return list.sort((a, b) => {
      // Orden estricto: terminados y más urgentes primero
      if (a.remainingMinutes !== b.remainingMinutes) {
        return a.remainingMinutes - b.remainingMinutes;
      }
      return a.record.ward.localeCompare(b.record.ward) || a.record.bed.localeCompare(b.record.bed);
    });
  });

  readonly urgencyCounts = computed(() => {
    let critical = 0;
    let warning = 0;
    let stable = 0;
    for (const p of this.computedPatients()) {
      if (p.urgency === 'critical') critical++;
      else if (p.urgency === 'warning') warning++;
      else stable++;
    }
    return { critical, warning, stable, total: critical + warning + stable };
  });

  readonly availableWards = computed<string[]>(() => {
    const set = new Set<string>();
    for (const p of this._patients()) {
      const ward = p.ward.trim();
      if (ward) set.add(ward);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  });

  constructor() {
    // 1. Carga síncrona inmediata desde localStorage
    const syncState = this.storage.loadSync();
    if (syncState) {
      this.applyPersistedState(syncState);
    }

    // 2. Hidratación asíncrona desde @capacitor/preferences (respaldo nativo Android/iOS)
    void this.hydrateFromNativeStorage();

    // 3. Reloj ligero de 1s solo para refrescar el cálculo basado en Date.now()
    if (typeof window !== 'undefined') {
      this.tickerHandle = setInterval(() => {
        this._nowMs.set(Date.now());
      }, 1000);

      // Recálculo inmediato al volver de segundo plano o desbloquear el celular
      this.visibilityListener = () => {
        if (document.visibilityState === 'visible') {
          this._nowMs.set(Date.now());
        }
      };
      document.addEventListener('visibilitychange', this.visibilityListener);
      window.addEventListener('focus', this.visibilityListener);
    }
  }

  ngOnDestroy(): void {
    if (this.tickerHandle !== null) {
      clearInterval(this.tickerHandle);
      this.tickerHandle = null;
    }
    if (this.visibilityListener && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityListener);
      window.removeEventListener('focus', this.visibilityListener);
    }
  }

  getComputedPatientById(patientId: string): ComputedPatientState | null {
    return this.computedPatients().find((p) => p.record.id === patientId) ?? null;
  }

  /**
   * Inicia un nuevo turno clínico (6h, 12h o personalizado).
   */
  startShift(preset: ShiftDurationPreset, customHours?: number, customLabel?: string): void {
    const now = Date.now();
    const durationHours =
      preset === '6h'
        ? 6
        : preset === '12h'
          ? 12
          : Math.min(48, Math.max(1, Number(customHours) || 8));

    const defaultLabel =
      preset === '6h'
        ? 'Turno 6h (Mañana/Tarde)'
        : preset === '12h'
          ? 'Turno 12h (Noche)'
          : `Turno Personalizado (${durationHours}h)`;

    const session: ShiftSession = {
      id: this.generateId('shift'),
      label: customLabel?.trim() || defaultLabel,
      durationPreset: preset,
      durationHours,
      startTimeMs: now,
      endTimeMs: now + durationHours * 3_600_000,
    };

    this._shift.set(session);
    this._nowMs.set(now);
    void this.persist();
    void this.notifications.ensurePermissions();
  }

  /**
   * Agrega un nuevo paciente al turno activo con timestamp exacto Date.now().
   */
  addPatient(payload: PatientFormPayload): PatientInfusionRecord {
    const now = Date.now();
    const mlPerHour = (payload.exactDropsPerMinute / payload.dripFactor) * 60;
    const bagTotal = Math.max(payload.bagTotalVolumeMl, payload.receivedVolumeMl);

    const record: PatientInfusionRecord = {
      id: this.generateId('pat'),
      notificationId: this.nextNotificationId++,
      ward: payload.ward.trim(),
      bed: payload.bed.trim(),
      patientName: payload.patientName.trim(),
      solutionType: payload.solutionType,
      customSolutionName: payload.customSolutionName?.trim(),
      additives: payload.additives.map((a) => ({
        id: a.id || this.generateId('med'),
        name: a.name.trim(),
        dose: a.dose.trim(),
      })),
      origin: payload.origin,
      bagTotalVolumeMl: bagTotal,
      receivedVolumeMl: payload.receivedVolumeMl,
      dripFactor: payload.dripFactor,
      exactDropsPerMinute: payload.exactDropsPerMinute,
      baselineDropsPerMinute: payload.exactDropsPerMinute,
      mlPerHour,
      anchorStartTimeMs: now,
      anchorVolumeMl: payload.receivedVolumeMl,
      createdAtMs: now,
      alarmEnabled: payload.alarmEnabled,
    };

    this._patients.update((list) => [...list, record]);
    this._nowMs.set(now);
    void this.persist();

    const computedState = computePatientInfusionState(
      record,
      now,
      this._shift()?.endTimeMs ?? null
    );
    void this.notifications.syncPatientAlarm(computedState);

    return record;
  }

  /**
   * Edita los datos o parámetros de un paciente existente.
   * Si cambian los volúmenes o velocidad, reancla limpiamente al timestamp actual.
   */
  updatePatient(patientId: string, payload: PatientFormPayload): void {
    const now = Date.now();
    const existing = this._patients().find((p) => p.id === patientId);
    if (!existing) return;

    const prevComputed = computePatientInfusionState(
      existing,
      now,
      this._shift()?.endTimeMs ?? null
    );

    const mlPerHour = (payload.exactDropsPerMinute / payload.dripFactor) * 60;
    const bagTotal = Math.max(payload.bagTotalVolumeMl, payload.receivedVolumeMl);

    // Si el usuario modificó el volumen recibido o el origen, usamos el nuevo volumen como ancla;
    // si solo editó nombre/sala/agregados/goteo, conservamos el volumen restante real en este segundo.
    const volumeChanged =
      Math.abs(payload.receivedVolumeMl - existing.receivedVolumeMl) > 0.1 ||
      payload.origin !== existing.origin;

    const nextAnchorVolume = volumeChanged ? payload.receivedVolumeMl : prevComputed.remainingMl;

    const updated: PatientInfusionRecord = {
      ...existing,
      ward: payload.ward.trim(),
      bed: payload.bed.trim(),
      patientName: payload.patientName.trim(),
      solutionType: payload.solutionType,
      customSolutionName: payload.customSolutionName?.trim(),
      additives: payload.additives.map((a) => ({
        id: a.id || this.generateId('med'),
        name: a.name.trim(),
        dose: a.dose.trim(),
      })),
      origin: payload.origin,
      bagTotalVolumeMl: bagTotal,
      receivedVolumeMl: payload.receivedVolumeMl,
      dripFactor: payload.dripFactor,
      exactDropsPerMinute: payload.exactDropsPerMinute,
      baselineDropsPerMinute: payload.exactDropsPerMinute,
      mlPerHour,
      anchorStartTimeMs: now,
      anchorVolumeMl: nextAnchorVolume,
      alarmEnabled: payload.alarmEnabled,
    };

    this._patients.update((list) => list.map((p) => (p.id === patientId ? updated : p)));
    this._nowMs.set(now);
    void this.persist();

    const nextComputed = computePatientInfusionState(
      updated,
      now,
      this._shift()?.endTimeMs ?? null
    );
    void this.notifications.syncPatientAlarm(nextComputed);
  }

  /**
   * Ajuste fino (+ / -) de la llave reguladora para un paciente específico.
   * Congela el volumen ya pasado hasta Date.now() y aplica la nueva tasa hacia adelante.
   */
  adjustPatientDrops(patientId: string, step: number): void {
    const now = Date.now();
    const existing = this._patients().find((p) => p.id === patientId);
    if (!existing || step === 0) return;

    const currentState = computePatientInfusionState(
      existing,
      now,
      this._shift()?.endTimeMs ?? null
    );

    const isAlreadyInteger =
      Math.abs(existing.exactDropsPerMinute - Math.round(existing.exactDropsPerMinute)) < 0.001;

    let nextRate: number;
    if (isAlreadyInteger) {
      nextRate = existing.exactDropsPerMinute + step;
    } else if (step > 0) {
      nextRate = Math.floor(existing.exactDropsPerMinute) + step;
    } else {
      nextRate = Math.ceil(existing.exactDropsPerMinute) + step;
    }

    const clamped = Math.min(
      MAX_DROPS_PER_MINUTE,
      Math.max(MIN_DROPS_PER_MINUTE, Number(nextRate.toFixed(1)))
    );
    const nextMlPerHour = (clamped / existing.dripFactor) * 60;

    const updated: PatientInfusionRecord = {
      ...existing,
      exactDropsPerMinute: clamped,
      mlPerHour: nextMlPerHour,
      anchorStartTimeMs: now,
      anchorVolumeMl: currentState.remainingMl,
    };

    this._patients.update((list) => list.map((p) => (p.id === patientId ? updated : p)));
    this._nowMs.set(now);
    void this.persist();

    const nextComputed = computePatientInfusionState(
      updated,
      now,
      this._shift()?.endTimeMs ?? null
    );
    void this.notifications.syncPatientAlarm(nextComputed);
  }

  resetPatientFineTune(patientId: string): void {
    const now = Date.now();
    const existing = this._patients().find((p) => p.id === patientId);
    if (!existing) return;

    const currentState = computePatientInfusionState(
      existing,
      now,
      this._shift()?.endTimeMs ?? null
    );
    const nextMlPerHour = (existing.baselineDropsPerMinute / existing.dripFactor) * 60;

    const updated: PatientInfusionRecord = {
      ...existing,
      exactDropsPerMinute: existing.baselineDropsPerMinute,
      mlPerHour: nextMlPerHour,
      anchorStartTimeMs: now,
      anchorVolumeMl: currentState.remainingMl,
    };

    this._patients.update((list) => list.map((p) => (p.id === patientId ? updated : p)));
    this._nowMs.set(now);
    void this.persist();

    const nextComputed = computePatientInfusionState(
      updated,
      now,
      this._shift()?.endTimeMs ?? null
    );
    void this.notifications.syncPatientAlarm(nextComputed);
  }

  /**
   * Renueva/cambia el frasco de suero del paciente conservando sus datos y velocidad actual.
   */
  renewPatientBag(patientId: string, newBagVolumeMl?: number): void {
    const now = Date.now();
    const existing = this._patients().find((p) => p.id === patientId);
    if (!existing) return;

    const nextVol = newBagVolumeMl && newBagVolumeMl > 0 ? newBagVolumeMl : existing.bagTotalVolumeMl;

    const updated: PatientInfusionRecord = {
      ...existing,
      origin: 'new',
      bagTotalVolumeMl: nextVol,
      receivedVolumeMl: nextVol,
      anchorStartTimeMs: now,
      anchorVolumeMl: nextVol,
    };

    this._patients.update((list) => list.map((p) => (p.id === patientId ? updated : p)));
    this._nowMs.set(now);
    void this.persist();

    const nextComputed = computePatientInfusionState(
      updated,
      now,
      this._shift()?.endTimeMs ?? null
    );
    void this.notifications.syncPatientAlarm(nextComputed);
  }

  togglePatientAlarm(patientId: string): void {
    const now = Date.now();
    const existing = this._patients().find((p) => p.id === patientId);
    if (!existing) return;

    const updated: PatientInfusionRecord = {
      ...existing,
      alarmEnabled: !existing.alarmEnabled,
    };

    this._patients.update((list) => list.map((p) => (p.id === patientId ? updated : p)));
    void this.persist();

    const nextComputed = computePatientInfusionState(
      updated,
      now,
      this._shift()?.endTimeMs ?? null
    );
    void this.notifications.syncPatientAlarm(nextComputed);
  }

  removePatient(patientId: string): void {
    const existing = this._patients().find((p) => p.id === patientId);
    if (!existing) return;

    this._patients.update((list) => list.filter((p) => p.id !== patientId));
    void this.persist();
    void this.notifications.cancelPatientAlarm(existing.id, existing.notificationId);
  }

  /**
   * ÚNICA forma permitida de finalizar y borrar los datos del turno actual.
   * Debe invocarse únicamente tras confirmación en el modal de advertencia estricta.
   */
  async finishAndClearShift(): Promise<void> {
    const currentPatients = this._patients();
    await this.notifications.cancelAllForPatients(currentPatients);
    this._shift.set(null);
    this._patients.set([]);
    this.nextNotificationId = 20_001;
    await this.storage.clearAll();
  }

  /**
   * Genera el reporte estructurado en texto limpio para copiar y pegar en
   * grupos de enfermería o notas de entrega de turno.
   */
  buildHandoverTextReport(): string {
    const shift = this._shift();
    const patients = [...this.computedPatients()].sort(
      (a, b) =>
        a.record.ward.localeCompare(b.record.ward, 'es') ||
        a.record.bed.localeCompare(b.record.bed, 'es', { numeric: true })
    );

    const lines: string[] = [];
    lines.push('📋 RESUMEN DE ENTREGA DE TURNO — VENOCLISIS');
    if (shift) {
      lines.push(
        `Turno: ${shift.label} (${this.formatClock(shift.startTimeMs)} → ${this.formatClock(shift.endTimeMs)})`
      );
    }
    lines.push(`Fecha: ${new Date(this._nowMs()).toLocaleDateString('es')}`);
    lines.push(`Pacientes activos: ${patients.length}`);
    lines.push('----------------------------------------');

    if (patients.length === 0) {
      lines.push('Sin pacientes con soluciones activas registradas.');
      return lines.join('\n');
    }

    for (const p of patients) {
      const originLabel =
        p.record.origin === 'inherited'
          ? `Heredado con ${Math.round(p.record.receivedVolumeMl)} ml`
          : `Iniciado en turno (${Math.round(p.record.receivedVolumeMl)} ml)`;

      const additivesLabel =
        p.record.additives.length > 0
          ? p.record.additives.map((a) => `${a.name} (${a.dose})`).join(', ')
          : 'Sin agregados';

      const projectionLabel = p.willFinishBeforeShiftEnd
        ? `Termina a las ${this.formatClock(p.estimatedEndTimeMs)} (antes de entrega → 0 ml, requiere recambio)`
        : `Quedará con ${Math.round(p.projectedRemainingAtShiftEndMl)} ml al finalizar el turno`;

      lines.push(`• [${p.record.ward} · Cama ${p.record.bed}] ${p.record.patientName}`);
      lines.push(`  Solución: ${p.solutionDisplayName} | Agregados: ${additivesLabel}`);
      lines.push(
        `  Goteo: ${p.roundedDropsPerMinute} gotas/min (${p.record.mlPerHour.toFixed(1)} ml/h · FG ${p.record.dripFactor})`
      );
      lines.push(`  Recepción: ${originLabel}`);
      lines.push(
        `  Estado actual: ${Math.round(p.remainingMl)} ml restantes (fin est. ${this.formatClock(p.estimatedEndTimeMs)})`
      );
      lines.push(`  Proyección entrega: ${projectionLabel}`);
      lines.push('');
    }

    return lines.join('\n').trim();
  }

  private async hydrateFromNativeStorage(): Promise<void> {
    const nativeState = await this.storage.loadNativeBackup();
    if (!nativeState) return;

    const currentLocal = this.storage.loadSync();
    if (!currentLocal || nativeState.updatedAtMs > currentLocal.updatedAtMs) {
      this.applyPersistedState(nativeState);
    }

    // Re-sincronizar alertas web / nativas al abrir la app
    for (const p of this.computedPatients()) {
      void this.notifications.syncPatientAlarm(p);
    }
  }

  private applyPersistedState(state: PersistedShiftState): void {
    this._shift.set(state.shift);
    this._patients.set(state.patients);
    this.nextNotificationId = state.nextNotificationId;
    this._nowMs.set(Date.now());
  }

  private async persist(): Promise<void> {
    const payload: PersistedShiftState = {
      version: 1,
      shift: this._shift(),
      patients: this._patients(),
      nextNotificationId: this.nextNotificationId,
      updatedAtMs: Date.now(),
    };
    await this.storage.save(payload);
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  private formatClock(ms: number): string {
    return new Date(ms).toLocaleTimeString('es', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }
}
