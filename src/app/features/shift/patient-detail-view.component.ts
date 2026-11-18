import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { InfusionResult } from '../../core/models/infusion.model';
import { ComputedPatientState } from '../../core/models/shift.model';
import { AudioMetronomeService } from '../../core/services/audio-metronome.service';
import { HapticsService } from '../../core/services/haptics.service';
import { ShiftManagerService } from '../../core/services/shift-manager.service';
import { DripCanvasComponent } from '../drip-canvas/drip-canvas.component';

@Component({
  selector: 'app-patient-detail-view',
  standalone: true,
  imports: [DripCanvasComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (computedPatient(); as p) {
      <div class="space-y-3">
        <!-- Barra superior de regreso + acciones -->
        <div class="flex items-center justify-between">
          <button
            type="button"
            (click)="back.emit()"
            class="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 active:scale-95 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Volver al Panel
          </button>

          <div class="flex items-center gap-1.5">
            <button
              type="button"
              (click)="editClicked.emit(p.record.id)"
              class="flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
            >
              <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              Editar
            </button>

            <button
              type="button"
              (click)="showRenewConfirm.set(true)"
              class="flex items-center gap-1 rounded-xl bg-sky-100 px-3 py-2 text-xs font-bold text-sky-700 hover:bg-sky-200 dark:bg-sky-950 dark:text-sky-300"
            >
              <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              Nueva Bolsa
            </button>
          </div>
        </div>

        <!-- TARJETA CABECERA DEL PACIENTE -->
        <section
          class="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900"
        >
          <div class="flex items-start justify-between gap-2">
            <div>
              <span
                class="inline-block rounded-xl px-2.5 py-1 text-xs font-black tracking-wide"
                [class]="locationBadgeClass(p.urgency)"
              >
                {{ p.record.ward }} · Cama {{ p.record.bed }}
              </span>
              <h2 class="mt-1.5 text-lg font-black text-slate-900 dark:text-white">
                {{ p.record.patientName }}
              </h2>
              <div class="mt-0.5 text-xs font-bold text-sky-700 dark:text-sky-400">
                {{ p.solutionDisplayName }}
              </div>
            </div>

            <!-- Botón toggle de alarma -->
            <button
              type="button"
              (click)="toggleAlarm(p.record.id)"
              class="flex flex-col items-center rounded-2xl border px-3 py-1.5 transition active:scale-95"
              [class]="
                p.record.alarmEnabled
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-800'
              "
            >
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
              </svg>
              <span class="mt-0.5 text-[10px] font-extrabold">
                {{ p.record.alarmEnabled ? 'Alerta ON' : 'Alerta OFF' }}
              </span>
            </button>
          </div>

          @if (p.record.additives.length > 0) {
            <div class="mt-2.5 flex flex-wrap gap-1 border-t border-slate-100 pt-2 dark:border-slate-800">
              <span class="text-[11px] font-bold text-slate-400">Agregados:</span>
              @for (item of p.record.additives; track item.id) {
                <span
                  class="rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300"
                >
                  {{ item.name }} ({{ item.dose }})
                </span>
              }
            </div>
          }
        </section>

        <!-- TARJETA DE CONTROL: GOTAS/MIN + AJUSTE FINO (LLAVE REGULADORA) -->
        <section
          class="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900"
        >
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Goteo regulado a
              </p>
              <div class="flex items-baseline gap-1.5">
                <span class="text-3xl font-black text-slate-900 dark:text-white">
                  {{ p.record.exactDropsPerMinute.toFixed(1) }}
                </span>
                <span class="text-xs font-bold text-slate-500 dark:text-slate-400">
                  gotas/min ({{ p.roundedDropsPerMinute }} gtt)
                </span>
              </div>
              <div class="mt-0.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                {{ p.record.mlPerHour.toFixed(1) }} ml/h · FG: {{ p.record.dripFactor }} gtt/ml
              </div>
            </div>

            <!-- Botones + / - llave reguladora -->
            <div class="flex flex-col items-end gap-1">
              <div
                class="flex items-center gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800"
                role="group"
                aria-label="Ajuste fino de llave reguladora"
              >
                <button
                  type="button"
                  (click)="adjustDrops(p.record.id, -1)"
                  [disabled]="p.record.exactDropsPerMinute <= 1"
                  class="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-xl font-black text-slate-700 shadow-xs transition hover:bg-sky-50 hover:text-sky-700 active:scale-92 disabled:opacity-40 dark:bg-slate-700 dark:text-white"
                >
                  −
                </button>
                <button
                  type="button"
                  (click)="adjustDrops(p.record.id, 1)"
                  class="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-600 text-xl font-black text-white shadow-xs transition hover:bg-sky-500 active:scale-92"
                >
                  +
                </button>
              </div>
              <span class="text-[10px] font-bold text-slate-400">Llave de suero</span>
            </div>
          </div>

          @if (p.isFineTuned) {
            <div
              class="mt-3 flex items-center justify-between rounded-xl bg-sky-50 px-3 py-2 text-xs dark:bg-sky-950/50"
            >
              <span class="font-medium text-sky-800 dark:text-sky-200">
                Ajuste fino: {{ p.fineTuneDelta >= 0 ? '+' : '' }}{{ p.fineTuneDelta.toFixed(1) }} gtt/min
                (base: {{ p.record.baselineDropsPerMinute.toFixed(1) }})
              </span>
              <button
                type="button"
                (click)="resetFineTune(p.record.id)"
                class="rounded-lg bg-white px-2 py-0.5 text-[11px] font-bold text-sky-700 shadow-xs hover:bg-sky-100 dark:bg-slate-800 dark:text-sky-300"
              >
                Restablecer
              </button>
            </div>
          }
        </section>

        <!-- TARJETA DE ESTADO DE VOLUMEN Y HORA DE TÉRMINO -->
        <section
          class="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900"
        >
          <div class="grid grid-cols-2 gap-3 text-center">
            <div class="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
              <div class="text-[10px] font-bold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                Volumen restante
              </div>
              <div class="mt-1 text-2xl font-black text-sky-700 dark:text-sky-400">
                {{ Math.round(p.remainingMl) }} ml
              </div>
              <div class="text-[11px] font-semibold text-slate-400">
                Infundido en turno: {{ Math.round(p.infusedThisShiftMl) }} ml
              </div>
            </div>

            <div class="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
              <div class="text-[10px] font-bold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                Hora de finalización
              </div>
              <div class="mt-1 text-2xl font-black text-slate-900 dark:text-white">
                {{ formatTime(p.estimatedEndTimeMs) }}
              </div>
              <div class="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                {{ formatRemainingDuration(p.remainingMinutes) }} restante
              </div>
            </div>
          </div>
        </section>

        <!-- CÁMARA DE GOTEO CANVAS EN TIEMPO REAL -->
        @if (asInfusionResult(); as canvasResult) {
          <app-drip-canvas [result]="canvasResult" />
        }

        <!-- Botón de eliminar paciente -->
        <div class="pt-2">
          <button
            type="button"
            (click)="showDeleteConfirm.set(true)"
            class="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 py-3 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-400 dark:hover:bg-rose-950/40"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            Retirar este paciente del turno
          </button>
        </div>
      </div>

      <!-- MODAL DE CONFIRMACIÓN DE NUEVA BOLSA -->
      @if (showRenewConfirm()) {
        <div
          class="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/65 p-4 backdrop-blur-xs sm:items-center"
          (click)="showRenewConfirm.set(false)"
        >
          <div
            class="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            (click)="$event.stopPropagation()"
          >
            <h3 class="text-base font-extrabold text-slate-900 dark:text-white">
              ¿Colocar nueva bolsa de suero?
            </h3>
            <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Se restablecerá el volumen a la capacidad de la bolsa manteniendo la misma
              velocidad prescrita.
            </p>
            <div class="mt-4 flex gap-2">
              <button
                type="button"
                (click)="showRenewConfirm.set(false)"
                class="flex-1 rounded-2xl border border-slate-200 py-2.5 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                (click)="renewBag(p.record.id)"
                class="flex-1 rounded-2xl bg-sky-600 py-2.5 text-xs font-extrabold text-white hover:bg-sky-700"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      }

      <!-- MODAL DE CONFIRMACIÓN DE ELIMINAR PACIENTE -->
      @if (showDeleteConfirm()) {
        <div
          class="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/65 p-4 backdrop-blur-xs sm:items-center"
          (click)="showDeleteConfirm.set(false)"
        >
          <div
            class="w-full max-w-sm rounded-3xl border border-rose-200 bg-white p-5 shadow-2xl dark:border-rose-900 dark:bg-slate-900"
            (click)="$event.stopPropagation()"
          >
            <h3 class="text-base font-extrabold text-rose-600 dark:text-rose-400">
              Retirar paciente del turno
            </h3>
            <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">
              ¿Confirmas retirar a <strong>{{ p.record.patientName }}</strong> de este turno? Se
              cancelarán sus alertas locales.
            </p>
            <div class="mt-4 flex gap-2">
              <button
                type="button"
                (click)="showDeleteConfirm.set(false)"
                class="flex-1 rounded-2xl border border-slate-200 py-2.5 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                (click)="deletePatient(p.record.id)"
                class="flex-1 rounded-2xl bg-rose-600 py-2.5 text-xs font-extrabold text-white hover:bg-rose-700"
              >
                Sí, retirar
              </button>
            </div>
          </div>
        </div>
      }
    }
  `,
})
export class PatientDetailViewComponent {
  readonly patientId = input.required<string>();
  readonly back = output<void>();
  readonly editClicked = output<string>();

  protected readonly Math = Math;
  private readonly shiftManager = inject(ShiftManagerService);
  private readonly audio = inject(AudioMetronomeService);
  private readonly haptics = inject(HapticsService);

  protected readonly showRenewConfirm = signal<boolean>(false);
  protected readonly showDeleteConfirm = signal<boolean>(false);

  protected readonly computedPatient = computed<ComputedPatientState | null>(() => {
    return this.shiftManager.getComputedPatientById(this.patientId());
  });

  protected readonly asInfusionResult = computed<InfusionResult | null>(() => {
    const p = this.computedPatient();
    if (!p) return null;

    return {
      volumeMl: p.remainingMl,
      originalDurationMinutes: (p.record.bagTotalVolumeMl / p.record.mlPerHour) * 60,
      effectiveDurationMinutes: p.remainingMinutes,
      dripFactor: p.record.dripFactor,
      baselineDropsPerMinute: p.record.baselineDropsPerMinute,
      exactDropsPerMinute: p.record.exactDropsPerMinute,
      roundedDropsPerMinute: p.roundedDropsPerMinute,
      mlPerHour: p.record.mlPerHour,
      mlPerMinute: p.mlPerMinute,
      secondsPerDrop: p.secondsPerDrop,
      intervalMs: p.intervalMs,
      calculatedAt: new Date(this.shiftManager.nowMs()),
      estimatedEndTime: new Date(p.estimatedEndTimeMs),
      isFineTuned: p.isFineTuned,
      fineTuneDelta: p.fineTuneDelta,
    };
  });

  protected adjustDrops(patientId: string, step: number): void {
    this.audio.unlock();
    void this.haptics.triggerControlTap();
    this.shiftManager.adjustPatientDrops(patientId, step);
  }

  protected resetFineTune(patientId: string): void {
    void this.haptics.triggerControlTap();
    this.shiftManager.resetPatientFineTune(patientId);
  }

  protected renewBag(patientId: string): void {
    void this.haptics.triggerControlTap();
    this.shiftManager.renewPatientBag(patientId);
    this.showRenewConfirm.set(false);
  }

  protected toggleAlarm(patientId: string): void {
    void this.haptics.triggerControlTap();
    this.shiftManager.togglePatientAlarm(patientId);
  }

  protected deletePatient(patientId: string): void {
    void this.haptics.triggerControlTap();
    this.shiftManager.removePatient(patientId);
    this.showDeleteConfirm.set(false);
    this.back.emit();
  }

  protected locationBadgeClass(urgency: string): string {
    switch (urgency) {
      case 'critical':
        return 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200';
      case 'warning':
        return 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200';
    }
  }

  protected formatTime(ms: number): string {
    return new Date(ms).toLocaleTimeString('es', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  protected formatRemainingDuration(minutes: number): string {
    if (minutes <= 0.2) return '0 min';
    const total = Math.round(minutes);
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h} h`;
    return `${h}h ${m}m`;
  }
}
