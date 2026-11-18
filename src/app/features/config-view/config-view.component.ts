import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  DRIP_FACTOR_PRESETS,
  DripFactorMode,
  TimeUnit,
  VolumeUnit,
} from '../../core/models/infusion.model';
import { AudioMetronomeService } from '../../core/services/audio-metronome.service';
import { HapticsService } from '../../core/services/haptics.service';
import { InfusionCalculatorService } from '../../core/services/infusion-calculator.service';

@Component({
  selector: 'app-config-view',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4">
      <!-- TARJETA 1: VOLUMEN -->
      <section
        class="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs transition-colors dark:border-slate-800 dark:bg-slate-900"
      >
        <div class="mb-3 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span
              class="flex h-7 w-7 items-center justify-center rounded-xl bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400"
            >
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 4h14l-1.5 14a2 2 0 0 1-2 1.8H8.5a2 2 0 0 1-2-1.8L5 4Z" />
                <path d="M6.2 11h11.6" />
              </svg>
            </span>
            <h2 class="text-xs font-extrabold tracking-wider text-slate-700 uppercase dark:text-slate-200">
              Volumen
            </h2>
          </div>

          <!-- Atajos clínicos de bolsas frecuentes -->
          <div class="flex gap-1">
            @for (preset of volumeQuickPresets; track preset) {
              <button
                type="button"
                (click)="applyQuickVolume(preset)"
                class="rounded-lg px-2 py-0.5 text-[11px] font-semibold transition active:scale-95"
                [class]="
                  isQuickVolumeActive(preset)
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-sky-50 hover:text-sky-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                "
              >
                {{ preset }}
              </button>
            }
          </div>
        </div>

        <div class="flex items-center gap-3">
          <div class="relative flex-1">
            <label
              for="volume-input"
              class="absolute -top-2 left-3 bg-white px-1 text-[11px] font-medium text-slate-500 dark:bg-slate-900 dark:text-slate-400"
            >
              Volumen de la solución
            </label>
            <input
              id="volume-input"
              type="number"
              inputmode="decimal"
              min="0.01"
              step="any"
              [ngModel]="config().volume"
              (ngModelChange)="onVolumeChange($event)"
              placeholder="500"
              class="w-full rounded-2xl border-2 border-slate-200 bg-slate-50/50 px-4 py-3 text-lg font-bold text-slate-900 transition outline-none focus:border-sky-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800/60 dark:text-white dark:focus:border-sky-400 dark:focus:bg-slate-800"
            />
          </div>

          <!-- Selector Toggle ml / L -->
          <div
            role="group"
            aria-label="Unidad de volumen"
            class="flex shrink-0 rounded-full bg-slate-100 p-1 dark:bg-slate-800"
          >
            <button
              type="button"
              (click)="setVolumeUnit('ml')"
              class="min-w-[46px] rounded-full px-3 py-2 text-sm font-bold transition-all"
              [class]="
                config().volumeUnit === 'ml'
                  ? 'bg-white text-sky-700 shadow-sm dark:bg-sky-600 dark:text-white'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              "
            >
              ml
            </button>
            <button
              type="button"
              (click)="setVolumeUnit('L')"
              class="min-w-[46px] rounded-full px-3 py-2 text-sm font-bold transition-all"
              [class]="
                config().volumeUnit === 'L'
                  ? 'bg-white text-sky-700 shadow-sm dark:bg-sky-600 dark:text-white'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              "
            >
              L
            </button>
          </div>
        </div>
      </section>

      <!-- TARJETA 2: TIEMPO -->
      <section
        class="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs transition-colors dark:border-slate-800 dark:bg-slate-900"
      >
        <div class="mb-3 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span
              class="flex h-7 w-7 items-center justify-center rounded-xl bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400"
            >
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="9" />
                <polyline points="12 7 12 12 15.5 14" />
              </svg>
            </span>
            <h2 class="text-xs font-extrabold tracking-wider text-slate-700 uppercase dark:text-slate-200">
              Tiempo
            </h2>
          </div>

          <div class="flex gap-1">
            @for (hours of timeQuickPresets; track hours) {
              <button
                type="button"
                (click)="applyQuickHours(hours)"
                class="rounded-lg px-2 py-0.5 text-[11px] font-semibold transition active:scale-95"
                [class]="
                  config().timeUnit === 'h' && config().time === hours
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-sky-50 hover:text-sky-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                "
              >
                {{ hours }}h
              </button>
            }
          </div>
        </div>

        <div class="flex items-center gap-3">
          <div class="relative flex-1">
            <label
              for="time-input"
              class="absolute -top-2 left-3 bg-white px-1 text-[11px] font-medium text-slate-500 dark:bg-slate-900 dark:text-slate-400"
            >
              Tiempo de infusión
            </label>
            <input
              id="time-input"
              type="number"
              inputmode="decimal"
              min="0.1"
              step="any"
              [ngModel]="config().time"
              (ngModelChange)="onTimeChange($event)"
              placeholder="8"
              class="w-full rounded-2xl border-2 border-slate-200 bg-slate-50/50 px-4 py-3 text-lg font-bold text-slate-900 transition outline-none focus:border-sky-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800/60 dark:text-white dark:focus:border-sky-400 dark:focus:bg-slate-800"
            />
          </div>

          <!-- Selector Toggle h / min -->
          <div
            role="group"
            aria-label="Unidad de tiempo"
            class="flex shrink-0 rounded-full bg-slate-100 p-1 dark:bg-slate-800"
          >
            <button
              type="button"
              (click)="setTimeUnit('h')"
              class="min-w-[44px] rounded-full px-3 py-2 text-sm font-bold transition-all"
              [class]="
                config().timeUnit === 'h'
                  ? 'bg-white text-sky-700 shadow-sm dark:bg-sky-600 dark:text-white'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              "
            >
              h
            </button>
            <button
              type="button"
              (click)="setTimeUnit('min')"
              class="min-w-[48px] rounded-full px-3 py-2 text-sm font-bold transition-all"
              [class]="
                config().timeUnit === 'min'
                  ? 'bg-white text-sky-700 shadow-sm dark:bg-sky-600 dark:text-white'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              "
            >
              min
            </button>
          </div>
        </div>
      </section>

      <!-- TARJETA 3: FACTOR DE GOTEO -->
      <section
        class="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs transition-colors dark:border-slate-800 dark:bg-slate-900"
      >
        <div class="mb-3 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span
              class="flex h-7 w-7 items-center justify-center rounded-xl bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400"
            >
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
              </svg>
            </span>
            <h2 class="text-xs font-extrabold tracking-wider text-slate-700 uppercase dark:text-slate-200">
              Factor de Goteo
            </h2>
          </div>
          <span class="text-xs font-semibold text-sky-600 dark:text-sky-400">
            {{ config().dripFactor || 0 }} gotas/ml
          </span>
        </div>

        <!-- Selector rápido: Macro 10, Macro 15, Normo 20, Micro 60, Custom -->
        <div class="grid grid-cols-5 gap-1.5 rounded-2xl bg-slate-100 p-1.5 dark:bg-slate-800/90">
          @for (preset of dripPresets; track preset.mode) {
            <button
              type="button"
              (click)="selectDripPreset(preset.mode, preset.value)"
              class="flex flex-col items-center justify-center rounded-xl px-1 py-2.5 text-center transition-all active:scale-95"
              [class]="
                config().dripFactorMode === preset.mode
                  ? 'bg-gradient-to-b from-sky-500 to-sky-600 text-white shadow-md shadow-sky-600/25'
                  : 'text-slate-700 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-slate-700/70'
              "
            >
              <span class="text-sm font-extrabold leading-none">{{ preset.value }}</span>
              <span
                class="mt-1 text-[10px] font-semibold"
                [class]="
                  config().dripFactorMode === preset.mode
                    ? 'text-sky-100'
                    : 'text-slate-500 dark:text-slate-400'
                "
              >
                {{ preset.shortLabel }}
              </span>
            </button>
          }

          <button
            type="button"
            (click)="selectCustomDrip()"
            class="flex flex-col items-center justify-center rounded-xl px-1 py-2.5 text-center transition-all active:scale-95"
            [class]="
              config().dripFactorMode === 'custom'
                ? 'bg-gradient-to-b from-sky-500 to-sky-600 text-white shadow-md shadow-sky-600/25'
                : 'text-slate-700 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-slate-700/70'
            "
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            <span
              class="mt-1 text-[10px] font-semibold"
              [class]="
                config().dripFactorMode === 'custom'
                  ? 'text-sky-100'
                  : 'text-slate-500 dark:text-slate-400'
              "
            >
              Custom
            </span>
          </button>
        </div>

        <!-- Campo manual para Custom -->
        @if (config().dripFactorMode === 'custom') {
          <div class="mt-3">
            <label
              for="custom-drip-input"
              class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300"
            >
              Factor personalizado (gotas/ml)
            </label>
            <input
              id="custom-drip-input"
              type="number"
              inputmode="numeric"
              min="1"
              max="200"
              [ngModel]="config().dripFactor"
              (ngModelChange)="onCustomDripChange($event)"
              placeholder="Ej. 15, 20, 60"
              class="w-full rounded-2xl border-2 border-sky-300 bg-sky-50/40 px-4 py-2.5 text-base font-bold text-slate-900 outline-none focus:border-sky-500 dark:border-sky-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
        }

        <!-- Guardar / Restaurar valores predeterminados -->
        <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            (click)="saveDefaults()"
            [disabled]="!calculator.isValid()"
            class="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50/70 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100 active:scale-95 disabled:opacity-50 dark:border-sky-800/70 dark:bg-sky-950/50 dark:text-sky-300 dark:hover:bg-sky-900/60"
          >
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            Marcar como predeterminado
          </button>

          @if (calculator.hasSavedDefaults()) {
            <button
              type="button"
              (click)="restoreFactory()"
              class="text-xs font-medium text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline dark:hover:text-slate-300"
            >
              Restaurar 500 ml / 8 h
            </button>
          }
        </div>
      </section>

      <!-- Vista previa rápida en vivo antes de calcular -->
      @if (previewDrops(); as preview) {
        <div
          class="flex items-center justify-between rounded-2xl border border-sky-200/70 bg-sky-50/70 px-4 py-2.5 text-xs dark:border-sky-900/60 dark:bg-sky-950/40"
        >
          <span class="font-medium text-sky-800 dark:text-sky-200">
            Cálculo estimado:
          </span>
          <span class="font-extrabold text-sky-700 dark:text-sky-300">
            {{ preview.exactDropsPerMinute.toFixed(1) }} gotas/min · {{ preview.mlPerHour.toFixed(1) }} ml/h
          </span>
        </div>
      } @else {
        <div
          class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-300"
        >
          Ingresa valores mayores a cero para volumen, tiempo y factor de goteo.
        </div>
      }

      <!-- BOTONES DE ACCIÓN PRINCIPALES -->
      <div class="space-y-2.5 pt-1">
        <button
          type="button"
          (click)="onCalculate()"
          [disabled]="!calculator.isValid()"
          class="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-600 to-blue-600 px-6 py-4 text-base font-extrabold text-white shadow-lg shadow-sky-600/30 transition hover:from-sky-500 hover:to-blue-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
          </svg>
          Calcular y Monitorizar
        </button>

        <button
          type="button"
          (click)="openTapSyncModal()"
          class="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-sky-200 bg-white px-6 py-3.5 text-sm font-bold text-sky-700 shadow-xs transition hover:border-sky-300 hover:bg-sky-50 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900 dark:text-sky-300 dark:hover:border-sky-700 dark:hover:bg-slate-800"
        >
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2" />
            <path d="M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2" />
            <path d="M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8" />
            <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
          </svg>
          Sincronizar goteo actual (Tap)
        </button>
      </div>

      <!-- Mensaje feedback (guardar predeterminados) -->
      @if (feedbackMessage()) {
        <div
          class="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-md"
        >
          <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{{ feedbackMessage() }}</span>
        </div>
      }
    </div>

    <!-- MODAL DE SINCRONIZACIÓN POR TOQUE (TAP-TO-SYNC) -->
    @if (showTapSync()) {
      <div
        class="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-4 backdrop-blur-xs sm:items-center"
        (click)="closeTapSyncModal()"
      >
        <div
          class="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
          (click)="$event.stopPropagation()"
        >
          <div class="mb-3 flex items-center justify-between">
            <div>
              <h3 class="text-base font-extrabold text-slate-900 dark:text-white">
                Sincronizar goteo real
              </h3>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                Toca el botón al ritmo de cada gota que observes en la cámara.
              </p>
            </div>
            <button
              type="button"
              (click)="closeTapSyncModal()"
              class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              aria-label="Cerrar sincronización"
            >
              ✕
            </button>
          </div>

          <div class="my-4 flex flex-col items-center">
            <button
              type="button"
              (click)="registerSyncTap()"
              class="flex h-36 w-36 flex-col items-center justify-center rounded-full bg-gradient-to-b from-sky-500 to-blue-600 text-white shadow-xl shadow-sky-600/35 transition active:scale-92"
            >
              <svg class="mb-1 h-9 w-9" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
              </svg>
              <span class="text-sm font-extrabold uppercase tracking-wide">Tocar gota</span>
              <span class="mt-0.5 text-[11px] text-sky-100">
                {{ tapTimestamps().length }} toques
              </span>
            </button>

            <div class="mt-4 text-center">
              @if (measuredGttPerMin(); as measured) {
                <div class="text-2xl font-black text-sky-600 dark:text-sky-400">
                  {{ measured.toFixed(1) }} gotas/min
                </div>
                <p class="text-xs text-slate-500 dark:text-slate-400">
                  Intervalo promedio: {{ (60 / measured).toFixed(2) }} s entre gotas
                </p>
              } @else {
                <p class="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Toca al menos 2 veces seguidas para calcular la velocidad actual.
                </p>
              }
            </div>
          </div>

          <div class="flex gap-2">
            <button
              type="button"
              (click)="resetSyncTaps()"
              class="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Reiniciar
            </button>
            <button
              type="button"
              [disabled]="!measuredGttPerMin()"
              (click)="applyMeasuredSync()"
              class="flex-[2] rounded-2xl bg-sky-600 px-4 py-3 text-xs font-extrabold text-white shadow-md shadow-sky-600/25 hover:bg-sky-700 disabled:opacity-40"
            >
              Aplicar y Monitorizar
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfigViewComponent {
  readonly calculated = output<void>();

  protected readonly calculator = inject(InfusionCalculatorService);
  private readonly audio = inject(AudioMetronomeService);
  private readonly haptics = inject(HapticsService);

  protected readonly config = this.calculator.config;
  protected readonly previewDrops = this.calculator.result;
  protected readonly dripPresets = DRIP_FACTOR_PRESETS;
  protected readonly volumeQuickPresets = [100, 250, 500, 1000] as const;
  protected readonly timeQuickPresets = [1, 4, 8, 12, 24] as const;

  protected readonly feedbackMessage = signal<string | null>(null);
  protected readonly showTapSync = signal<boolean>(false);
  protected readonly tapTimestamps = signal<number[]>([]);

  protected readonly measuredGttPerMin = computed<number | null>(() => {
    const taps = this.tapTimestamps();
    if (taps.length < 2) return null;
    const intervals: number[] = [];
    for (let i = 1; i < taps.length; i++) {
      intervals.push(taps[i] - taps[i - 1]);
    }
    const avgMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    if (avgMs <= 0) return null;
    return 60_000 / avgMs;
  });

  private feedbackTimer: ReturnType<typeof setTimeout> | null = null;

  protected onVolumeChange(value: number | string): void {
    const parsed = Number(value);
    this.calculator.updateVolume(Number.isFinite(parsed) ? parsed : 0);
  }

  protected setVolumeUnit(unit: VolumeUnit): void {
    this.calculator.setVolumeUnit(unit);
    void this.haptics.triggerControlTap();
  }

  protected applyQuickVolume(ml: number): void {
    if (this.config().volumeUnit === 'L') {
      this.calculator.updateVolume(Number((ml / 1000).toFixed(3)));
    } else {
      this.calculator.updateVolume(ml);
    }
    void this.haptics.triggerControlTap();
  }

  protected isQuickVolumeActive(ml: number): boolean {
    const c = this.config();
    const currentMl = c.volumeUnit === 'L' ? c.volume * 1000 : c.volume;
    return Math.abs(currentMl - ml) < 0.01;
  }

  protected onTimeChange(value: number | string): void {
    const parsed = Number(value);
    this.calculator.updateTime(Number.isFinite(parsed) ? parsed : 0);
  }

  protected setTimeUnit(unit: TimeUnit): void {
    this.calculator.setTimeUnit(unit);
    void this.haptics.triggerControlTap();
  }

  protected applyQuickHours(hours: number): void {
    if (this.config().timeUnit !== 'h') {
      this.calculator.setTimeUnit('h');
    }
    this.calculator.updateTime(hours);
    void this.haptics.triggerControlTap();
  }

  protected selectDripPreset(mode: DripFactorMode, value: number): void {
    this.calculator.setDripFactorPreset(mode, value);
    void this.haptics.triggerControlTap();
  }

  protected selectCustomDrip(): void {
    this.calculator.setDripFactorPreset('custom');
    void this.haptics.triggerControlTap();
  }

  protected onCustomDripChange(value: number | string): void {
    const parsed = Number(value);
    this.calculator.updateCustomDripFactor(Number.isFinite(parsed) ? parsed : 0);
  }

  protected saveDefaults(): void {
    if (this.calculator.saveAsDefaults()) {
      void this.haptics.triggerControlTap();
      this.showFeedback('Valores guardados como predeterminados');
    }
  }

  protected restoreFactory(): void {
    this.calculator.resetFactoryDefaults();
    this.showFeedback('Valores base restaurados (500 ml · 8 h · Normo 20)');
  }

  protected onCalculate(): void {
    this.audio.unlock();
    void this.haptics.triggerControlTap();
    if (this.calculator.calculateNow()) {
      this.calculated.emit();
    }
  }

  protected openTapSyncModal(): void {
    this.audio.unlock();
    this.tapTimestamps.set([]);
    this.showTapSync.set(true);
  }

  protected closeTapSyncModal(): void {
    this.showTapSync.set(false);
  }

  protected registerSyncTap(): void {
    const now = performance.now();
    this.audio.playDropTick();
    void this.haptics.triggerControlTap();

    this.tapTimestamps.update((prev) => {
      // Reiniciar automáticamente si pasan más de 10 segundos sin tocar
      if (prev.length > 0 && now - prev[prev.length - 1] > 10_000) {
        return [now];
      }
      // Mantener ventana móvil de los últimos 8 toques para precisión inmediata
      const next = [...prev, now];
      return next.length > 8 ? next.slice(-8) : next;
    });
  }

  protected resetSyncTaps(): void {
    this.tapTimestamps.set([]);
  }

  protected applyMeasuredSync(): void {
    const measured = this.measuredGttPerMin();
    if (!measured) return;
    this.calculator.applySynchronizedDropsPerMinute(measured);
    this.showTapSync.set(false);
    this.calculated.emit();
  }

  private showFeedback(message: string): void {
    this.feedbackMessage.set(message);
    if (this.feedbackTimer !== null) {
      clearTimeout(this.feedbackTimer);
    }
    this.feedbackTimer = setTimeout(() => {
      this.feedbackMessage.set(null);
    }, 2800);
  }
}
