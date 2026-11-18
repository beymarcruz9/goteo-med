export type ShiftDurationPreset = '6h' | '12h' | 'custom';

export interface ShiftSession {
  id: string;
  label: string;
  durationPreset: ShiftDurationPreset;
  durationHours: number;
  startTimeMs: number;
  endTimeMs: number;
}

export type SolutionType =
  | 'Solución Fisiológica 0.9%'
  | 'Ringer Lactato'
  | 'Dextrosa 5%'
  | 'Dextrosa 10%'
  | 'Mixto'
  | 'Otro';

export const SOLUTION_TYPES: readonly {
  value: SolutionType;
  shortLabel: string;
}[] = [
  { value: 'Solución Fisiológica 0.9%', shortLabel: 'SSF 0.9%' },
  { value: 'Ringer Lactato', shortLabel: 'Ringer Lactato' },
  { value: 'Dextrosa 5%', shortLabel: 'Dextrosa 5%' },
  { value: 'Dextrosa 10%', shortLabel: 'Dextrosa 10%' },
  { value: 'Mixto', shortLabel: 'Mixto' },
  { value: 'Otro', shortLabel: 'Otro' },
] as const;

export interface AdditiveMedication {
  id: string;
  name: string;
  dose: string;
}

export const COMMON_ADDITIVES: readonly { name: string; dose: string }[] = [
  { name: 'Complejo B', dose: '1 amp' },
  { name: 'KCl', dose: '10 ml' },
  { name: 'Metamizol', dose: '1 gr' },
  { name: 'Vitamina C', dose: '1 amp' },
  { name: 'Sulfato de Mg', dose: '1 amp' },
  { name: 'Tramadol', dose: '100 mg' },
] as const;

export type InfusionOrigin = 'new' | 'inherited';
export type UrgencyLevel = 'critical' | 'warning' | 'stable';
export type MainAppTab = 'dashboard' | 'handover' | 'calculator';

export interface PatientInfusionRecord {
  id: string;
  notificationId: number;
  ward: string;
  bed: string;
  patientName: string;
  solutionType: SolutionType;
  customSolutionName?: string;
  additives: AdditiveMedication[];
  origin: InfusionOrigin;
  /** Capacidad nominal de la bolsa/frasco en ml (ej. 1000 ml o 500 ml). */
  bagTotalVolumeMl: number;
  /** Volumen exacto con el que se recibió o inició en este turno (ej. 450 ml heredado o 1000 ml nuevo). */
  receivedVolumeMl: number;
  /** Factor de goteo del equipo (10, 15, 20, 60 o custom). */
  dripFactor: number;
  /** Velocidad actual en gotas/min exactas (se actualiza con ajuste fino). */
  exactDropsPerMinute: number;
  /** Velocidad original prescrita en gotas/min. */
  baselineDropsPerMinute: number;
  /** Velocidad de infusión actual en ml/h = (exactDropsPerMinute / dripFactor) * 60. */
  mlPerHour: number;
  /** Marca de tiempo exacta (Date.now()) desde la cual corre la velocidad actual. */
  anchorStartTimeMs: number;
  /** Volumen restante en ml en el instante exacto anchorStartTimeMs. */
  anchorVolumeMl: number;
  /** Marca de tiempo de registro inicial en este turno. */
  createdAtMs: number;
  /** Si la alerta local a -15 min está activada para este paciente. */
  alarmEnabled: boolean;
}

export interface PatientFormPayload {
  ward: string;
  bed: string;
  patientName: string;
  solutionType: SolutionType;
  customSolutionName?: string;
  additives: AdditiveMedication[];
  origin: InfusionOrigin;
  bagTotalVolumeMl: number;
  receivedVolumeMl: number;
  dripFactor: number;
  exactDropsPerMinute: number;
  alarmEnabled: boolean;
}

export interface ComputedPatientState {
  record: PatientInfusionRecord;
  solutionDisplayName: string;
  remainingMl: number;
  infusedThisShiftMl: number;
  remainingMinutes: number;
  estimatedEndTimeMs: number;
  isCompleted: boolean;
  /** Porcentaje consumido respecto a la bolsa nominal (0 a 100). */
  progressPercent: number;
  /** Porcentaje restante respecto a la bolsa nominal (0 a 100). */
  remainingPercent: number;
  urgency: UrgencyLevel;
  secondsPerDrop: number;
  intervalMs: number;
  mlPerMinute: number;
  roundedDropsPerMinute: number;
  isFineTuned: boolean;
  fineTuneDelta: number;
  /** Proyección de ml restantes al llegar exactamente a la hora de fin de turno. */
  projectedRemainingAtShiftEndMl: number;
  /** Proyección de ml que se habrán infundido en este turno al finalizar el turno. */
  projectedInfusedByShiftEndMl: number;
  /** Indica si la bolsa actual se acabará antes de terminar el turno. */
  willFinishBeforeShiftEnd: boolean;
}

export interface PersistedShiftState {
  version: 1;
  shift: ShiftSession | null;
  patients: PatientInfusionRecord[];
  nextNotificationId: number;
  updatedAtMs: number;
}
