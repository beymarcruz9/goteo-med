import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { HapticsService } from '../../core/services/haptics.service';
import { ShiftManagerService } from '../../core/services/shift-manager.service';

@Component({
  selector: 'app-shift-handover',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4">
      <!-- Encabezado de la entrega -->
      <section
        class="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900"
      >
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-base font-black text-slate-900 dark:text-white">
              Resumen para Entrega de Turno
            </h2>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              Balance hídrico del turno y proyección exacta para el colega entrante.
            </p>
          </div>
          <span class="rounded-xl bg-sky-100 px-3 py-1 text-xs font-black text-sky-800 dark:bg-sky-950 dark:text-sky-300">
            {{ patients().length }} pacientes
          </span>
        </div>

        @if (shift(); as s) {
          <div class="mt-3 rounded-2xl bg-slate-50 p-3 text-xs dark:bg-slate-800/70">
            <div class="flex justify-between font-bold text-slate-700 dark:text-slate-200">
              <span>{{ s.label }}</span>
              <span>{{ s.durationHours }} horas</span>
            </div>
            <div class="mt-1 flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>Inicio: {{ formatTime(s.startTimeMs) }}</span>
              <span>Fin de turno: {{ formatTime(s.endTimeMs) }}</span>
            </div>
          </div>
        }

        <!-- Botón para copiar reporte en texto limpio -->
        <div class="mt-3 flex gap-2">
          <button
            type="button"
            (click)="copyReportToClipboard()"
            class="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-sky-600 px-4 py-3 text-xs font-extrabold text-white shadow-md shadow-sky-600/25 transition hover:bg-sky-700 active:scale-95"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            {{ copied() ? '¡Copiado al Portapapeles!' : 'Copiar Resumen para WhatsApp / Notas' }}
          </button>
        </div>
      </section>

      <!-- TARJETAS DE BALANCE POR PACIENTE -->
      <div class="space-y-2.5">
        @for (p of patients(); track p.record.id) {
          <div
            class="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900"
          >
            <!-- Título y Sala -->
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span
                  class="rounded-xl bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                >
                  {{ p.record.ward }} · Cama {{ p.record.bed }}
                </span>
                <span class="text-sm font-black text-slate-900 dark:text-white">
                  {{ p.record.patientName }}
                </span>
              </div>
              <span class="text-xs font-bold text-sky-700 dark:text-sky-400">
                {{ p.roundedDropsPerMinute }} gtt/min
              </span>
            </div>

            <!-- Solución y agregados -->
            <div class="mt-1.5 text-xs text-slate-600 dark:text-slate-300">
              <strong>Solución:</strong> {{ p.solutionDisplayName }}
              @if (p.record.additives.length > 0) {
                <span class="ml-1 text-indigo-700 dark:text-indigo-300">
                  ({{ p.record.additives.map(formatAdditive).join(', ') }})
                </span>
              }
            </div>

            <!-- Métricas de Balance: Recibido vs Infundido vs Proyección -->
            <div
              class="mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-2.5 text-center dark:bg-slate-800/60"
            >
              <div>
                <div class="text-[10px] font-bold text-slate-400">Recepción</div>
                <div class="mt-0.5 text-xs font-black text-slate-800 dark:text-slate-200">
                  {{ Math.round(p.record.receivedVolumeMl) }} ml
                </div>
                <div class="text-[9px] text-slate-500">
                  {{ p.record.origin === 'new' ? 'Nueva' : 'Heredada' }}
                </div>
              </div>

              <div>
                <div class="text-[10px] font-bold text-slate-400">Infundido en turno</div>
                <div class="mt-0.5 text-xs font-black text-indigo-600 dark:text-indigo-400">
                  {{ Math.round(p.infusedThisShiftMl) }} ml
                </div>
                <div class="text-[9px] text-slate-500">
                  {{ p.record.mlPerHour.toFixed(0) }} ml/h
                </div>
              </div>

              <div>
                <div class="text-[10px] font-bold text-slate-400">Quedará al fin</div>
                <div
                  class="mt-0.5 text-xs font-black"
                  [class]="
                    p.willFinishBeforeShiftEnd
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  "
                >
                  {{ Math.round(p.projectedRemainingAtShiftEndMl) }} ml
                </div>
                <div class="text-[9px] font-bold">
                  {{ p.willFinishBeforeShiftEnd ? 'Recambiar' : 'Restante' }}
                </div>
              </div>
            </div>

            @if (p.willFinishBeforeShiftEnd) {
              <div
                class="mt-2 rounded-xl bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-800 dark:bg-rose-950/50 dark:text-rose-300"
              >
                ⚠️ Terminará a las {{ formatTime(p.estimatedEndTimeMs) }} (antes de finalizar el
                turno).
              </div>
            }
          </div>
        }
      </div>

      <!-- BOTÓN ROJO ESTRICTO: FINALIZAR TURNO Y LIMPIAR DATOS -->
      <section
        class="rounded-3xl border border-rose-200 bg-rose-50/70 p-4 dark:border-rose-900/60 dark:bg-rose-950/30"
      >
        <div class="flex items-start gap-3">
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-md shadow-rose-600/25"
          >
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div class="flex-1">
            <h3 class="text-sm font-black text-rose-900 dark:text-rose-200">
              Finalizar Turno Actual
            </h3>
            <p class="text-xs text-rose-700/90 dark:text-rose-300/90">
              Copia el resumen antes de proceder. Una vez finalizado el turno, se cancelarán las
              alarmas y se reiniciará la lista de pacientes para el siguiente turno.
            </p>
          </div>
        </div>

        <button
          type="button"
          (click)="showStrictModal.set(true)"
          class="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-600 py-3.5 text-xs font-extrabold text-white shadow-md shadow-rose-600/25 transition hover:bg-rose-700 active:scale-[0.98]"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
          Finalizar Turno y Limpiar Datos
        </button>
      </section>
    </div>

    <!-- MODAL DE ADVERTENCIA ESTRICTA -->
    @if (showStrictModal()) {
      <div
        class="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/75 p-4 backdrop-blur-xs sm:items-center"
        (click)="showStrictModal.set(false)"
      >
        <div
          class="w-full max-w-md rounded-3xl border-2 border-rose-500 bg-white p-5 shadow-2xl dark:border-rose-600 dark:bg-slate-900"
          (click)="$event.stopPropagation()"
        >
          <div class="mb-3 flex items-center gap-3">
            <div
              class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400"
            >
              <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div>
              <h3 class="text-base font-black text-slate-900 dark:text-white">
                ¿Estás seguro de finalizar el turno?
              </h3>
              <p class="text-xs text-rose-600 font-bold dark:text-rose-400">
                Esta acción es irreversible
              </p>
            </div>
          </div>

          <div
            class="rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs leading-relaxed font-semibold text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-200"
          >
            ¿Estás seguro? Si confirmas, se borrarán permanentemente todos los datos de los
            pacientes y sueros registrados en este turno.
          </div>

          <div class="mt-4 flex gap-2">
            <button
              type="button"
              (click)="showStrictModal.set(false)"
              class="flex-1 rounded-2xl border border-slate-200 py-3 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300"
            >
              Cancelar y Seguir en Turno
            </button>
            <button
              type="button"
              (click)="confirmFinishShift()"
              class="flex-[1.2] rounded-2xl bg-rose-600 py-3 text-xs font-black text-white shadow-md shadow-rose-600/30 hover:bg-rose-700"
            >
              Sí, Finalizar y Borrar
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ShiftHandoverComponent {
  readonly shiftFinished = output<void>();

  protected readonly Math = Math;
  private readonly shiftManager = inject(ShiftManagerService);
  private readonly haptics = inject(HapticsService);

  protected readonly shift = this.shiftManager.activeShift;
  protected readonly patients = this.shiftManager.computedPatients;
  protected readonly copied = signal<boolean>(false);
  protected readonly showStrictModal = signal<boolean>(false);

  private copyTimer: ReturnType<typeof setTimeout> | null = null;

  protected async copyReportToClipboard(): Promise<void> {
    void this.haptics.triggerControlTap();
    const text = this.shiftManager.buildHandoverTextReport();

    let success = false;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        success = true;
      }
    } catch {
      success = false;
    }

    if (!success && typeof document !== 'undefined') {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        success = true;
      } catch {
        success = false;
      }
    }

    if (success) {
      this.copied.set(true);
      if (this.copyTimer !== null) clearTimeout(this.copyTimer);
      this.copyTimer = setTimeout(() => this.copied.set(false), 3000);
    }
  }

  protected async confirmFinishShift(): Promise<void> {
    void this.haptics.triggerControlTap();
    this.showStrictModal.set(false);
    await this.shiftManager.finishAndClearShift();
    this.shiftFinished.emit();
  }

  protected formatAdditive(a: { name: string; dose: string }): string {
    return `${a.name} ${a.dose}`;
  }

  protected formatTime(ms: number): string {
    return new Date(ms).toLocaleTimeString('es', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }
}
