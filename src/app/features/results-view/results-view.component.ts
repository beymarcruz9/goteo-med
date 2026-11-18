import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { AudioMetronomeService } from '../../core/services/audio-metronome.service';
import { HapticsService } from '../../core/services/haptics.service';
import { InfusionCalculatorService } from '../../core/services/infusion-calculator.service';
import { NotificationService } from '../../core/services/notification.service';
import { DripCanvasComponent } from '../drip-canvas/drip-canvas.component';

@Component({
  selector: 'app-results-view',
  standalone: true,
  imports: [DripCanvasComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (result(); as res) {
      <div class="space-y-3">
        <!-- Toast de confirmación de alarma -->
        @if (alarmToast()) {
          <div
            class="flex items-center justify-between gap-2 rounded-2xl border px-3.5 py-2.5 text-xs font-semibold shadow-sm"
            [class]="
              alarmToast()!.ok
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/60 dark:text-emerald-200'
                : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/60 dark:text-amber-200'
            "
          >
            <span>{{ alarmToast()!.message }}</span>
            <button
              type="button"
              (click)="alarmToast.set(null)"
              class="shrink-0 opacity-70 hover:opacity-100"
              aria-label="Cerrar mensaje"
            >
              ✕
            </button>
          </div>
        }

        <!-- TARJETA 1: GOTAS POR MINUTO + AJUSTE FINO (LLAVE REGULADORA) -->
        <section
          class="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <div
                class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-400"
              >
                <svg class="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
                </svg>
              </div>
              <div>
                <p class="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Ajusta a
                  <span class="font-extrabold text-emerald-600 dark:text-emerald-400">
                    {{ res.roundedDropsPerMinute }} gotas
                  </span>
                  por minuto
                </p>
                <div class="flex items-baseline gap-1.5">
                  <span class="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                    {{ res.exactDropsPerMinute.toFixed(2) }}
                  </span>
                  <span class="text-xs font-bold text-slate-500 dark:text-slate-400">
                    gotas/min exactas
                  </span>
                </div>
              </div>
            </div>

            <!-- Control de Ajuste Fino (- / +) simulando llave reguladora de suero -->
            <div class="flex flex-col items-end gap-1">
              <div
                class="flex items-center gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800"
                role="group"
                aria-label="Ajuste fino de llave reguladora"
              >
                <button
                  type="button"
                  (click)="adjustDrops(-1)"
                  [disabled]="res.exactDropsPerMinute <= 1"
                  title="Disminuir 1 gota/min"
                  class="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-lg font-black text-slate-700 shadow-xs transition hover:bg-sky-50 hover:text-sky-700 active:scale-92 disabled:opacity-40 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600"
                >
                  −
                </button>
                <button
                  type="button"
                  (click)="adjustDrops(1)"
                  title="Aumentar 1 gota/min"
                  class="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-lg font-black text-white shadow-xs transition hover:bg-sky-500 active:scale-92"
                >
                  +
                </button>
              </div>
              <span class="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                Llave reguladora
              </span>
            </div>
          </div>

          @if (res.isFineTuned) {
            <div
              class="mt-3 flex items-center justify-between rounded-xl bg-sky-50 px-3 py-2 text-xs dark:bg-sky-950/50"
            >
              <span class="font-medium text-sky-800 dark:text-sky-200">
                Ajuste fino activo ({{ res.fineTuneDelta >= 0 ? '+' : '' }}{{ res.fineTuneDelta.toFixed(2) }} gtt/min · nuevo tiempo:
                <strong>{{ formattedRemainingDuration() }}</strong>)
              </span>
              <button
                type="button"
                (click)="resetFineTune()"
                class="ml-2 shrink-0 rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-sky-700 shadow-xs hover:bg-sky-100 dark:bg-slate-800 dark:text-sky-300"
              >
                Restablecer
              </button>
            </div>
          }
        </section>

        <!-- TARJETA 2: HORA EXACTA DE FINALIZACIÓN + BOTÓN DE ALARMA (-15 MIN) -->
        <section
          class="flex items-center justify-between gap-3 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900"
        >
          <div class="flex items-center gap-3">
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400"
            >
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="9" />
                <polyline points="12 7 12 12 15.5 14" />
              </svg>
            </div>
            <div class="text-sm leading-snug text-slate-700 dark:text-slate-200">
              <span>Tu solución de </span>
              <strong class="font-extrabold text-slate-900 dark:text-white">
                {{ formattedVolumeMl() }}
              </strong>
              <span> terminará a las </span>
              <strong class="font-extrabold text-sky-700 dark:text-sky-400">
                {{ formattedEndTime() }}
              </strong>
              <span class="ml-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                ({{ endDayLabel() }} · {{ formattedRemainingDuration() }})
              </span>
            </div>
          </div>

          @if (notifications.activeAlarm(); as alarm) {
            <button
              type="button"
              (click)="cancelAlarm()"
              title="Cancelar alarma programada"
              class="flex shrink-0 flex-col items-center rounded-2xl border-2 border-emerald-500 bg-emerald-50 px-3 py-1.5 text-emerald-700 transition hover:bg-emerald-100 active:scale-95 dark:border-emerald-500/70 dark:bg-emerald-950/60 dark:text-emerald-300"
            >
              <span class="flex items-center gap-1 text-xs font-extrabold">
                <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                Activa
              </span>
              <span class="text-[10px] font-bold">
                {{ formatClockTime(alarm.triggerAt) }}
              </span>
            </button>
          } @else {
            <button
              type="button"
              (click)="scheduleAlarm()"
              title="Programar notificación local 15 minutos antes de finalizar"
              class="flex shrink-0 items-center gap-1.5 rounded-full border-2 border-sky-500 bg-sky-50/70 px-3.5 py-2 text-xs font-extrabold text-sky-700 transition hover:bg-sky-100 active:scale-95 dark:border-sky-500/70 dark:bg-sky-950/50 dark:text-sky-300 dark:hover:bg-sky-900/60"
            >
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="13" r="8" />
                <path d="M12 9v4l2 2" />
                <path d="M5 3L2 6" />
                <path d="M22 6l-3-3" />
              </svg>
              Alarma
            </button>
          }
        </section>

        <!-- TARJETAS 3 Y 4: VELOCIDAD DE INFUSIÓN Y SEGUNDOS ENTRE CADA GOTA -->
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <!-- Velocidad de infusión -->
          <section
            class="flex items-center gap-3 rounded-3xl border border-slate-200/80 bg-white px-4 py-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900"
          >
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950/80 dark:text-indigo-400"
            >
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 14l4-4" />
                <path d="M3.34 19a10 10 0 1 1 17.32 0" />
              </svg>
            </div>
            <div>
              <div class="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Velocidad de infusión
              </div>
              <div class="text-sm font-extrabold text-slate-900 dark:text-white">
                {{ res.mlPerHour.toFixed(2) }} ml/h
                <span class="font-medium text-slate-400">·</span>
                {{ res.mlPerMinute.toFixed(2) }} ml/min
              </div>
            </div>
          </section>

          <!-- Segundos entre cada gota -->
          <section
            class="flex items-center gap-3 rounded-3xl border border-slate-200/80 bg-white px-4 py-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900"
          >
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-950/80 dark:text-amber-400"
            >
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="10" y1="2" x2="14" y2="2" />
                <line x1="12" y1="14" x2="15" y2="11" />
                <circle cx="12" cy="14" r="8" />
              </svg>
            </div>
            <div>
              <div class="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Intervalo entre gotas
              </div>
              <div class="text-sm font-extrabold text-slate-900 dark:text-white">
                {{ res.secondsPerDrop.toFixed(2) }} segundos
                <span class="text-xs font-medium text-slate-500 dark:text-slate-400">
                  ({{ Math.round(res.intervalMs) }} ms)
                </span>
              </div>
            </div>
          </section>
        </div>

        <!-- CÁMARA DE GOTEO EN TIEMPO REAL (HTML5 CANVAS + requestAnimationFrame) -->
        <app-drip-canvas [result]="res" />

        <!-- Acción inferior para editar parámetros -->
        <button
          type="button"
          (click)="editConfig.emit()"
          class="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50 active:scale-[0.99] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Modificar parámetros de infusión
        </button>
      </div>
    } @else {
      <div
        class="rounded-3xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900"
      >
        <p class="text-sm font-semibold text-slate-600 dark:text-slate-300">
          Completa los parámetros de la solución para iniciar la monitorización.
        </p>
        <button
          type="button"
          (click)="editConfig.emit()"
          class="mt-4 rounded-2xl bg-sky-600 px-5 py-2.5 text-sm font-bold text-white"
        >
          Ir a Configuración
        </button>
      </div>
    }
  `,
})
export class ResultsViewComponent {
  readonly editConfig = output<void>();

  protected readonly Math = Math;
  protected readonly calculator = inject(InfusionCalculatorService);
  protected readonly notifications = inject(NotificationService);
  private readonly audio = inject(AudioMetronomeService);
  private readonly haptics = inject(HapticsService);

  protected readonly result = this.calculator.result;
  protected readonly alarmToast = signal<{ ok: boolean; message: string } | null>(null);

  protected readonly formattedVolumeMl = computed(() => {
    const res = this.result();
    if (!res) return '';
    return `${Math.round(res.volumeMl)} mililitros`;
  });

  protected readonly formattedEndTime = computed(() => {
    const res = this.result();
    if (!res) return '';
    return this.formatClockTime(res.estimatedEndTime);
  });

  protected readonly endDayLabel = computed(() => {
    const res = this.result();
    if (!res) return '';
    const start = res.calculatedAt;
    const end = res.estimatedEndTime;
    const sameDay =
      start.getFullYear() === end.getFullYear() &&
      start.getMonth() === end.getMonth() &&
      start.getDate() === end.getDate();

    if (sameDay) return 'hoy';

    const tomorrow = new Date(start);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow =
      tomorrow.getFullYear() === end.getFullYear() &&
      tomorrow.getMonth() === end.getMonth() &&
      tomorrow.getDate() === end.getDate();

    if (isTomorrow) return 'mañana';

    return end.toLocaleDateString('es', { day: '2-digit', month: 'short' });
  });

  protected readonly formattedRemainingDuration = computed(() => {
    const res = this.result();
    if (!res) return '';
    const totalMinutes = Math.round(res.effectiveDurationMinutes);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h} h`;
    return `${h} h ${m} min`;
  });

  protected adjustDrops(step: number): void {
    this.audio.unlock();
    void this.haptics.triggerControlTap();
    this.calculator.adjustDropsPerMinute(step);
  }

  protected resetFineTune(): void {
    void this.haptics.triggerControlTap();
    this.calculator.resetFineTune();
  }

  protected async scheduleAlarm(): Promise<void> {
    const res = this.result();
    if (!res) return;
    this.audio.unlock();
    void this.haptics.triggerControlTap();
    const outcome = await this.notifications.schedulePreCompletionAlarm(res, 15);
    this.alarmToast.set({ ok: outcome.ok, message: outcome.message });
  }

  protected async cancelAlarm(): Promise<void> {
    void this.haptics.triggerControlTap();
    await this.notifications.cancelAlarm();
    this.alarmToast.set({ ok: true, message: 'Alarma cancelada correctamente.' });
  }

  protected formatClockTime(date: Date): string {
    return date.toLocaleTimeString('es', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }
}
