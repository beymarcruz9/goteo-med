import { Injectable, computed, signal } from '@angular/core';
import {
  DEFAULT_INFUSION_CONFIG,
  DripFactorMode,
  InfusionConfig,
  InfusionResult,
  TimeUnit,
  VolumeUnit,
} from '../models/infusion.model';

const STORAGE_KEY_DEFAULTS = 'goteomed_default_config_v1';
const MIN_DROPS_PER_MINUTE = 1;
const MAX_DROPS_PER_MINUTE = 600;

@Injectable({
  providedIn: 'root',
})
export class InfusionCalculatorService {
  private readonly _config = signal<InfusionConfig>(this.loadSavedDefaults());
  private readonly _calculatedAt = signal<Date>(new Date());
  private readonly _adjustedDropsPerMinute = signal<number | null>(null);
  private readonly _hasSavedDefaults = signal<boolean>(this.hasPersistedDefaults());

  readonly config = this._config.asReadonly();
  readonly hasSavedDefaults = this._hasSavedDefaults.asReadonly();
  readonly adjustedDropsPerMinute = this._adjustedDropsPerMinute.asReadonly();

  readonly isValid = computed(() => {
    const c = this._config();
    return (
      Number.isFinite(c.volume) &&
      c.volume > 0 &&
      Number.isFinite(c.time) &&
      c.time > 0 &&
      Number.isFinite(c.dripFactor) &&
      c.dripFactor > 0
    );
  });

  readonly result = computed<InfusionResult | null>(() => {
    const c = this._config();
    if (
      !Number.isFinite(c.volume) ||
      c.volume <= 0 ||
      !Number.isFinite(c.time) ||
      c.time <= 0 ||
      !Number.isFinite(c.dripFactor) ||
      c.dripFactor <= 0
    ) {
      return null;
    }

    const volumeMl = c.volumeUnit === 'L' ? c.volume * 1000 : c.volume;
    const originalDurationMinutes = c.timeUnit === 'h' ? c.time * 60 : c.time;

    // Fórmula clínica: (Volumen en ml * Factor de goteo) / Tiempo en minutos
    const baselineDropsPerMinute = (volumeMl * c.dripFactor) / originalDurationMinutes;

    const adjusted = this._adjustedDropsPerMinute();
    const isFineTuned = adjusted !== null;
    const exactDropsPerMinute = isFineTuned ? adjusted : baselineDropsPerMinute;

    // Si hay ajuste fino, el tiempo restante se recalcula dinámicamente:
    // Tiempo (min) = (Volumen en ml * Factor de goteo) / Gotas por minuto efectivas
    const effectiveDurationMinutes = isFineTuned
      ? (volumeMl * c.dripFactor) / exactDropsPerMinute
      : originalDurationMinutes;

    const mlPerMinute = exactDropsPerMinute / c.dripFactor;
    const mlPerHour = mlPerMinute * 60;
    const secondsPerDrop = 60 / exactDropsPerMinute;
    const intervalMs = secondsPerDrop * 1000;

    const calculatedAt = this._calculatedAt();
    const estimatedEndTime = new Date(
      calculatedAt.getTime() + effectiveDurationMinutes * 60_000
    );

    return {
      volumeMl,
      originalDurationMinutes,
      effectiveDurationMinutes,
      dripFactor: c.dripFactor,
      baselineDropsPerMinute,
      exactDropsPerMinute,
      roundedDropsPerMinute: Math.max(1, Math.round(exactDropsPerMinute)),
      mlPerHour,
      mlPerMinute,
      secondsPerDrop,
      intervalMs,
      calculatedAt,
      estimatedEndTime,
      isFineTuned,
      fineTuneDelta: exactDropsPerMinute - baselineDropsPerMinute,
    };
  });

  updateVolume(volume: number): void {
    this._config.update((prev) => ({ ...prev, volume }));
    this._adjustedDropsPerMinute.set(null);
  }

  setVolumeUnit(volumeUnit: VolumeUnit): void {
    const current = this._config();
    if (current.volumeUnit === volumeUnit) return;

    // Conversión limpia al alternar entre ml y L para evitar errores de dosis
    let nextVolume = current.volume;
    if (Number.isFinite(current.volume) && current.volume > 0) {
      nextVolume =
        volumeUnit === 'L'
          ? Number((current.volume / 1000).toFixed(3))
          : Number((current.volume * 1000).toFixed(0));
    }

    this._config.update((prev) => ({
      ...prev,
      volume: nextVolume,
      volumeUnit,
    }));
    this._adjustedDropsPerMinute.set(null);
  }

  updateTime(time: number): void {
    this._config.update((prev) => ({ ...prev, time }));
    this._adjustedDropsPerMinute.set(null);
  }

  setTimeUnit(timeUnit: TimeUnit): void {
    const current = this._config();
    if (current.timeUnit === timeUnit) return;

    let nextTime = current.time;
    if (Number.isFinite(current.time) && current.time > 0) {
      nextTime =
        timeUnit === 'min'
          ? Number((current.time * 60).toFixed(0))
          : Number((current.time / 60).toFixed(2));
    }

    this._config.update((prev) => ({
      ...prev,
      time: nextTime,
      timeUnit,
    }));
    this._adjustedDropsPerMinute.set(null);
  }

  setDripFactorPreset(mode: DripFactorMode, value?: number): void {
    this._config.update((prev) => ({
      ...prev,
      dripFactorMode: mode,
      dripFactor: value !== undefined ? value : prev.dripFactor,
    }));
    this._adjustedDropsPerMinute.set(null);
  }

  updateCustomDripFactor(dripFactor: number): void {
    this._config.update((prev) => ({
      ...prev,
      dripFactorMode: 'custom',
      dripFactor,
    }));
    this._adjustedDropsPerMinute.set(null);
  }

  /**
   * Inicia un nuevo cálculo fijando la hora actual del sistema como referencia
   * y reiniciando cualquier ajuste fino previo.
   */
  calculateNow(): boolean {
    if (!this.isValid()) return false;
    this._adjustedDropsPerMinute.set(null);
    this._calculatedAt.set(new Date());
    return true;
  }

  /**
   * Simula el giro de una llave reguladora de venoclisis ajustando las gotas/min
   * en pasos discretos y recalculando el tiempo restante en tiempo real.
   */
  adjustDropsPerMinute(step: number): void {
    const currentResult = this.result();
    if (!currentResult || step === 0) return;

    const currentAdjusted = this._adjustedDropsPerMinute();
    let nextRate: number;

    if (currentAdjusted === null) {
      if (step > 0) {
        nextRate = Math.floor(currentResult.exactDropsPerMinute) + step;
      } else {
        nextRate = Math.ceil(currentResult.exactDropsPerMinute) + step;
      }
    } else {
      nextRate = currentAdjusted + step;
    }

    const clamped = Math.min(
      MAX_DROPS_PER_MINUTE,
      Math.max(MIN_DROPS_PER_MINUTE, Number(nextRate.toFixed(1)))
    );

    this._adjustedDropsPerMinute.set(clamped);
    this._calculatedAt.set(new Date());
  }

  /**
   * Aplica una tasa exacta en gotas/min (por ejemplo, desde el modo Sincronizar por toque)
   * y recalcula el tiempo de infusión correspondiente para el volumen actual.
   */
  applySynchronizedDropsPerMinute(dropsPerMinute: number): void {
    if (!Number.isFinite(dropsPerMinute) || dropsPerMinute <= 0) return;
    const clamped = Math.min(
      MAX_DROPS_PER_MINUTE,
      Math.max(MIN_DROPS_PER_MINUTE, Number(dropsPerMinute.toFixed(1)))
    );
    this._adjustedDropsPerMinute.set(clamped);
    this._calculatedAt.set(new Date());
  }

  resetFineTune(): void {
    this._adjustedDropsPerMinute.set(null);
    this._calculatedAt.set(new Date());
  }

  /**
   * Guarda la configuración actual como predeterminada en almacenamiento local.
   */
  saveAsDefaults(): boolean {
    if (!this.isValid()) return false;
    try {
      localStorage.setItem(STORAGE_KEY_DEFAULTS, JSON.stringify(this._config()));
      this._hasSavedDefaults.set(true);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Restaura los valores predeterminados guardados o los valores clínicos base (500 ml, 8 h, 20 gtt/ml).
   */
  restoreDefaults(): void {
    this._config.set(this.loadSavedDefaults());
    this._adjustedDropsPerMinute.set(null);
    this._calculatedAt.set(new Date());
  }

  resetFactoryDefaults(): void {
    try {
      localStorage.removeItem(STORAGE_KEY_DEFAULTS);
    } catch {
      // Ignorar restricciones de almacenamiento
    }
    this._hasSavedDefaults.set(false);
    this._config.set({ ...DEFAULT_INFUSION_CONFIG });
    this._adjustedDropsPerMinute.set(null);
    this._calculatedAt.set(new Date());
  }

  private hasPersistedDefaults(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY_DEFAULTS) !== null;
    } catch {
      return false;
    }
  }

  private loadSavedDefaults(): InfusionConfig {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_DEFAULTS);
      if (!raw) return { ...DEFAULT_INFUSION_CONFIG };
      const parsed = JSON.parse(raw) as Partial<InfusionConfig>;
      if (
        typeof parsed.volume === 'number' &&
        parsed.volume > 0 &&
        typeof parsed.time === 'number' &&
        parsed.time > 0 &&
        typeof parsed.dripFactor === 'number' &&
        parsed.dripFactor > 0
      ) {
        return {
          volume: parsed.volume,
          volumeUnit: parsed.volumeUnit === 'L' ? 'L' : 'ml',
          time: parsed.time,
          timeUnit: parsed.timeUnit === 'min' ? 'min' : 'h',
          dripFactorMode: parsed.dripFactorMode ?? 'normo20',
          dripFactor: parsed.dripFactor,
        };
      }
    } catch {
      // Fallback seguro
    }
    return { ...DEFAULT_INFUSION_CONFIG };
  }
}
