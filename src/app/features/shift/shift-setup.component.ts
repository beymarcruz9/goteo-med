import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ShiftDurationPreset } from '../../core/models/shift.model';
import { HapticsService } from '../../core/services/haptics.service';
import { ShiftManagerService } from '../../core/services/shift-manager.service';

@Component({
  selector: 'app-shift-setup',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4">
      <section
        class="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900"
      >
        <div class="mb-4 flex items-center gap-3">
          <div
            class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-md shadow-sky-600/25"
          >
            <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="9" />
              <polyline points="12 7 12 12 15.5 14" />
            </svg>
          </div>
          <div>
            <h2 class="text-base font-black text-slate-900 dark:text-white">
              Iniciar Turno de Enfermería
            </h2>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              Control simultáneo multi-paciente con persistencia segura y alertas en segundo plano.
            </p>
          </div>
        </div>

        <!-- Selector de duración estándar clínica -->
        <div class="mb-4">
          <label class="mb-2 block text-xs font-extrabold tracking-wider text-slate-600 uppercase dark:text-slate-300">
            Duración del turno
          </label>
          <div class="grid grid-cols-3 gap-2">
            <button
              type="button"
              (click)="selectPreset('6h')"
              class="flex flex-col items-center rounded-2xl border-2 px-2 py-3 text-center transition-all active:scale-95"
              [class]="
                preset() === '6h'
                  ? 'border-sky-600 bg-sky-50 text-sky-800 shadow-xs dark:border-sky-500 dark:bg-sky-950/60 dark:text-sky-200'
                  : 'border-slate-200 bg-slate-50/70 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300'
              "
            >
              <span class="text-lg font-black">6 h</span>
              <span class="mt-0.5 text-[10px] font-semibold opacity-80">Mañana / Tarde</span>
            </button>

            <button
              type="button"
              (click)="selectPreset('12h')"
              class="flex flex-col items-center rounded-2xl border-2 px-2 py-3 text-center transition-all active:scale-95"
              [class]="
                preset() === '12h'
                  ? 'border-sky-600 bg-sky-50 text-sky-800 shadow-xs dark:border-sky-500 dark:bg-sky-950/60 dark:text-sky-200'
                  : 'border-slate-200 bg-slate-50/70 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300'
              "
            >
              <span class="text-lg font-black">12 h</span>
              <span class="mt-0.5 text-[10px] font-semibold opacity-80">Noche / Guardia</span>
            </button>

            <button
              type="button"
              (click)="selectPreset('custom')"
              class="flex flex-col items-center rounded-2xl border-2 px-2 py-3 text-center transition-all active:scale-95"
              [class]="
                preset() === 'custom'
                  ? 'border-sky-600 bg-sky-50 text-sky-800 shadow-xs dark:border-sky-500 dark:bg-sky-950/60 dark:text-sky-200'
                  : 'border-slate-200 bg-slate-50/70 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300'
              "
            >
              <span class="text-lg font-black">Otro</span>
              <span class="mt-0.5 text-[10px] font-semibold opacity-80">Personalizado</span>
            </button>
          </div>
        </div>

        @if (preset() === 'custom') {
          <div class="mb-4">
            <label
              for="custom-shift-hours"
              class="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300"
            >
              Duración personalizada (horas)
            </label>
            <input
              id="custom-shift-hours"
              type="number"
              inputmode="numeric"
              min="1"
              max="48"
              [ngModel]="customHours()"
              (ngModelChange)="customHours.set(+$event || 1)"
              class="w-full rounded-2xl border-2 border-sky-300 bg-sky-50/40 px-4 py-2.5 text-base font-bold text-slate-900 outline-none focus:border-sky-500 dark:border-sky-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
        }

        <!-- Etiqueta opcional de turno / servicio -->
        <div class="mb-4">
          <label
            for="shift-label-input"
            class="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300"
          >
            Servicio o etiqueta (opcional)
          </label>
          <input
            id="shift-label-input"
            type="text"
            [ngModel]="shiftLabel()"
            (ngModelChange)="shiftLabel.set($event)"
            placeholder="Ej. Turno Mañana · Medicina Interna"
            class="w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-sky-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800/70 dark:text-white"
          />
        </div>

        <!-- Resumen horario calculado -->
        <div
          class="mb-5 grid grid-cols-2 gap-2 rounded-2xl border border-sky-200/80 bg-sky-50/80 p-3 dark:border-sky-900/60 dark:bg-sky-950/40"
        >
          <div>
            <div class="text-[10px] font-bold tracking-wide text-sky-700 uppercase dark:text-sky-300">
              Hora de inicio
            </div>
            <div class="text-base font-black text-slate-900 dark:text-white">
              {{ formattedStartTime() }}
            </div>
            <div class="text-[11px] text-slate-500 dark:text-slate-400">Ahora mismo</div>
          </div>
          <div class="border-l border-sky-200/80 pl-3 dark:border-sky-800/60">
            <div class="text-[10px] font-bold tracking-wide text-sky-700 uppercase dark:text-sky-300">
              Fin exacto del turno
            </div>
            <div class="text-base font-black text-sky-700 dark:text-sky-300">
              {{ formattedEndTime() }}
            </div>
            <div class="text-[11px] text-slate-500 dark:text-slate-400">
              {{ endDayHint() }} ({{ effectiveHours() }} h)
            </div>
          </div>
        </div>

        <button
          type="button"
          (click)="onStartShift()"
          class="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-600 to-blue-600 px-6 py-4 text-sm font-extrabold text-white shadow-lg shadow-sky-600/30 transition hover:from-sky-500 hover:to-blue-500 active:scale-[0.98]"
        >
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          Iniciar Turno Ahora
        </button>
      </section>

      <!-- Garantía de persistencia -->
      <div
        class="flex items-start gap-2.5 rounded-2xl border border-emerald-200/80 bg-emerald-50/70 p-3.5 text-xs text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200"
      >
        <svg class="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <polyline points="9 12 11 14 15 10" />
        </svg>
        <p class="leading-relaxed">
          <strong>Guardado automático en tiempo real:</strong> Si cierras la app o bloqueas el
          teléfono, tus pacientes y sueros siguen corriendo por marca de tiempo exacta y nunca se
          borran hasta que presiones <em>Finalizar Turno</em>.
        </p>
      </div>
    </div>
  `,
})
export class ShiftSetupComponent {
  private readonly shiftManager = inject(ShiftManagerService);
  private readonly haptics = inject(HapticsService);

  protected readonly preset = signal<ShiftDurationPreset>('6h');
  protected readonly customHours = signal<number>(8);
  protected readonly shiftLabel = signal<string>('');

  protected readonly effectiveHours = computed(() => {
    const p = this.preset();
    if (p === '6h') return 6;
    if (p === '12h') return 12;
    return Math.min(48, Math.max(1, this.customHours()));
  });

  protected readonly formattedStartTime = computed(() => {
    return new Date(this.shiftManager.nowMs()).toLocaleTimeString('es', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  });

  protected readonly formattedEndTime = computed(() => {
    const end = new Date(this.shiftManager.nowMs() + this.effectiveHours() * 3_600_000);
    return end.toLocaleTimeString('es', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  });

  protected readonly endDayHint = computed(() => {
    const start = new Date(this.shiftManager.nowMs());
    const end = new Date(this.shiftManager.nowMs() + this.effectiveHours() * 3_600_000);
    return start.getDate() === end.getDate() ? 'hoy' : 'mañana';
  });

  protected selectPreset(value: ShiftDurationPreset): void {
    this.preset.set(value);
    void this.haptics.triggerControlTap();
  }

  protected onStartShift(): void {
    void this.haptics.triggerControlTap();
    this.shiftManager.startShift(this.preset(), this.customHours(), this.shiftLabel());
  }
}
