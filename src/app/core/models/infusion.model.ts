export type VolumeUnit = 'ml' | 'L';
export type TimeUnit = 'h' | 'min';
export type DripFactorMode = 'macro10' | 'macro15' | 'normo20' | 'micro60' | 'custom';
export type ActiveView = 'config' | 'results';
export type ThemeMode = 'auto' | 'light' | 'dark';

export interface DripFactorPreset {
  mode: Exclude<DripFactorMode, 'custom'>;
  value: number;
  shortLabel: string;
  label: string;
  description: string;
}

export const DRIP_FACTOR_PRESETS: readonly DripFactorPreset[] = [
  {
    mode: 'macro10',
    value: 10,
    shortLabel: 'Macro',
    label: 'Macrogotero 10',
    description: '10 gotas/ml',
  },
  {
    mode: 'macro15',
    value: 15,
    shortLabel: 'Macro',
    label: 'Macrogotero 15',
    description: '15 gotas/ml',
  },
  {
    mode: 'normo20',
    value: 20,
    shortLabel: 'Normo',
    label: 'Normogotero',
    description: '20 gotas/ml',
  },
  {
    mode: 'micro60',
    value: 60,
    shortLabel: 'Micro',
    label: 'Microgotero',
    description: '60 microgotas/ml',
  },
] as const;

export interface InfusionConfig {
  volume: number;
  volumeUnit: VolumeUnit;
  time: number;
  timeUnit: TimeUnit;
  dripFactorMode: DripFactorMode;
  dripFactor: number;
}

export const DEFAULT_INFUSION_CONFIG: InfusionConfig = {
  volume: 500,
  volumeUnit: 'ml',
  time: 8,
  timeUnit: 'h',
  dripFactorMode: 'normo20',
  dripFactor: 20,
};

export interface InfusionResult {
  volumeMl: number;
  originalDurationMinutes: number;
  effectiveDurationMinutes: number;
  dripFactor: number;
  baselineDropsPerMinute: number;
  exactDropsPerMinute: number;
  roundedDropsPerMinute: number;
  mlPerHour: number;
  mlPerMinute: number;
  secondsPerDrop: number;
  intervalMs: number;
  calculatedAt: Date;
  estimatedEndTime: Date;
  isFineTuned: boolean;
  fineTuneDelta: number;
}

export interface ScheduledAlarm {
  id: number;
  triggerAt: Date;
  endTime: Date;
  leadMinutes: number;
  volumeMl: number;
  dropsPerMinute: number;
  platform: 'capacitor' | 'web';
}
