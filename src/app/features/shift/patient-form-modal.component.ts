import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DRIP_FACTOR_PRESETS, DripFactorMode, TimeUnit } from '../../core/models/infusion.model';
import {
  AdditiveMedication,
  COMMON_ADDITIVES,
  InfusionOrigin,
  PatientFormPayload,
  PatientInfusionRecord,
  SOLUTION_TYPES,
  SolutionType,
} from '../../core/models/shift.model';
import { HapticsService } from '../../core/services/haptics.service';
import { ShiftManagerService } from '../../core/services/shift-manager.service';

@Component({
  selector: 'app-patient-form-modal',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/65 backdrop-blur-xs sm:items-center sm:p-4"
      (click)="cancelled.emit()"
    >
      <div
        class="flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:rounded-3xl dark:border-slate-800 dark:bg-slate-900"
        (click)="$event.stopPropagation()"
      >
        <!-- Encabezado fijo -->
        <div
          class="flex items-center justify-between border-b border-slate-200/80 px-5 py-3.5 dark:border-slate-800"
        >
          <div>
            <h3 class="text-base font-black text-slate-900 dark:text-white">
              {{ existingPatient() ? 'Editar Paciente y Suero' : 'Registrar Paciente' }}
            </h3>
            <p class="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Cálculo automático en tiempo real basado en marca de tiempo
            </p>
          </div>
          <button
            type="button"
            (click)="cancelled.emit()"
            class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            aria-label="Cerrar formulario"
          >
            ✕
          </button>
        </div>

        <!-- Cuerpo desplazable -->
        <div class="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <!-- 1. UBICACIÓN Y PACIENTE -->
          <div class="space-y-2.5">
            <div class="text-[11px] font-extrabold tracking-wider text-sky-700 uppercase dark:text-sky-400">
              1. Ubicación y Datos del Paciente
            </div>

            <div class="grid grid-cols-3 gap-2">
              <div class="col-span-2">
                <label class="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  Sala / Servicio *
                </label>
                <input
                  type="text"
                  [ngModel]="ward()"
                  (ngModelChange)="ward.set($event)"
                  placeholder="Ej. Sala 2, UCI, Med."
                  class="w-full rounded-xl border border-slate-300 bg-slate-50/70 px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-sky-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label class="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  Cama *
                </label>
                <input
                  type="text"
                  [ngModel]="bed()"
                  (ngModelChange)="bed.set($event)"
                  placeholder="Ej. 14"
                  class="w-full rounded-xl border border-slate-300 bg-slate-50/70 px-3 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-sky-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>

            @if (availableWards().length > 0) {
              <div class="flex flex-wrap gap-1">
                @for (w of availableWards(); track w) {
                  <button
                    type="button"
                    (click)="ward.set(w)"
                    class="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-sky-100 hover:text-sky-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    {{ w }}
                  </button>
                }
              </div>
            }

            <div>
              <label class="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                Nombre completo del paciente *
              </label>
              <input
                type="text"
                [ngModel]="patientName()"
                (ngModelChange)="patientName.set($event)"
                placeholder="Ej. María Elena Mamani"
                class="w-full rounded-xl border border-slate-300 bg-slate-50/70 px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-sky-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <!-- 2. TIPO DE SOLUCIÓN -->
          <div class="space-y-2">
            <div class="text-[11px] font-extrabold tracking-wider text-sky-700 uppercase dark:text-sky-400">
              2. Tipo de Solución
            </div>
            <div class="grid grid-cols-3 gap-1.5">
              @for (sol of solutionTypes; track sol.value) {
                <button
                  type="button"
                  (click)="solutionType.set(sol.value)"
                  class="rounded-xl border px-2 py-2 text-center text-xs font-bold transition active:scale-95"
                  [class]="
                    solutionType() === sol.value
                      ? 'border-sky-600 bg-sky-600 text-white shadow-xs'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  "
                >
                  {{ sol.shortLabel }}
                </button>
              }
            </div>

            @if (solutionType() === 'Otro') {
              <input
                type="text"
                [ngModel]="customSolutionName()"
                (ngModelChange)="customSolutionName.set($event)"
                placeholder="Especifica la solución (ej. Hartmann, Manitol 20%)"
                class="w-full rounded-xl border border-sky-300 bg-sky-50/40 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-sky-500 dark:border-sky-700 dark:bg-slate-800 dark:text-white"
              />
            }
          </div>

          <!-- 3. AGREGADOS / MEDICAMENTOS DILUIDOS -->
          <div class="space-y-2">
            <div class="text-[11px] font-extrabold tracking-wider text-sky-700 uppercase dark:text-sky-400">
              3. Agregados / Medicamentos Diluidos
            </div>

            <!-- Atajos rápidos comunes -->
            <div class="flex flex-wrap gap-1">
              @for (med of commonAdditives; track med.name) {
                <button
                  type="button"
                  (click)="quickAddAdditive(med.name, med.dose)"
                  class="rounded-lg border border-sky-200/80 bg-sky-50/70 px-2 py-1 text-[11px] font-semibold text-sky-800 transition hover:bg-sky-100 active:scale-95 dark:border-sky-900/70 dark:bg-sky-950/50 dark:text-sky-300"
                >
                  + {{ med.name }} ({{ med.dose }})
                </button>
              }
            </div>

            <!-- Ingreso manual de medicamento -->
            <div class="flex gap-1.5">
              <input
                type="text"
                [ngModel]="newMedName()"
                (ngModelChange)="newMedName.set($event)"
                placeholder="Medicamento (ej. KCl)"
                class="flex-[1.4] rounded-xl border border-slate-300 bg-slate-50/70 px-2.5 py-2 text-xs font-semibold text-slate-900 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <input
                type="text"
                [ngModel]="newMedDose()"
                (ngModelChange)="newMedDose.set($event)"
                placeholder="Dosis (10 ml)"
                (keydown.enter)="addCustomAdditive()"
                class="flex-1 rounded-xl border border-slate-300 bg-slate-50/70 px-2.5 py-2 text-xs font-semibold text-slate-900 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <button
                type="button"
                (click)="addCustomAdditive()"
                [disabled]="!newMedName().trim()"
                class="rounded-xl bg-sky-600 px-3 py-2 text-xs font-extrabold text-white transition hover:bg-sky-700 disabled:opacity-40"
              >
                +
              </button>
            </div>

            @if (additives().length > 0) {
              <div class="flex flex-wrap gap-1.5 pt-0.5">
                @for (item of additives(); track item.id) {
                  <span
                    class="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
                  >
                    <span>{{ item.name }}{{ item.dose ? ' · ' + item.dose : '' }}</span>
                    <button
                      type="button"
                      (click)="removeAdditive(item.id)"
                      class="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-200/80 text-[10px] hover:bg-indigo-300 dark:bg-indigo-800"
                      aria-label="Quitar medicamento"
                    >
                      ✕
                    </button>
                  </span>
                }
              </div>
            }
          </div>

          <!-- 4. RECEPCIÓN DE TURNO (VOLUMEN INICIAL) -->
          <div class="space-y-2.5">
            <div class="text-[11px] font-extrabold tracking-wider text-sky-700 uppercase dark:text-sky-400">
              4. Recepción de Turno (Volumen)
            </div>

            <div class="grid grid-cols-2 gap-1.5 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
              <button
                type="button"
                (click)="setOrigin('new')"
                class="rounded-xl py-2 text-xs font-extrabold transition"
                [class]="
                  origin() === 'new'
                    ? 'bg-white text-sky-700 shadow-xs dark:bg-sky-600 dark:text-white'
                    : 'text-slate-500 dark:text-slate-400'
                "
              >
                Suero Nuevo
              </button>
              <button
                type="button"
                (click)="setOrigin('inherited')"
                class="rounded-xl py-2 text-xs font-extrabold transition"
                [class]="
                  origin() === 'inherited'
                    ? 'bg-white text-sky-700 shadow-xs dark:bg-sky-600 dark:text-white'
                    : 'text-slate-500 dark:text-slate-400'
                "
              >
                Heredado (Turno Anterior)
              </button>
            </div>

            <!-- Atajos rápidos de bolsa -->
            <div class="flex items-center justify-between gap-2">
              <span class="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Capacidad de bolsa:
              </span>
              <div class="flex gap-1">
                @for (vol of [100, 250, 500, 1000]; track vol) {
                  <button
                    type="button"
                    (click)="applyBagPreset(vol)"
                    class="rounded-lg px-2 py-1 text-[11px] font-bold transition"
                    [class]="
                      bagTotalVolumeMl() === vol
                        ? 'bg-sky-600 text-white'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                    "
                  >
                    {{ vol }} ml
                  </button>
                }
              </div>
            </div>

            @if (origin() === 'new') {
              <div>
                <label class="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  Volumen total a infundir (ml) *
                </label>
                <input
                  type="number"
                  inputmode="decimal"
                  min="1"
                  [ngModel]="bagTotalVolumeMl()"
                  (ngModelChange)="onNewBagVolumeChange(+$event || 0)"
                  class="w-full rounded-xl border border-slate-300 bg-slate-50/70 px-3 py-2.5 text-base font-extrabold text-slate-900 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            } @else {
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    Bolsa original (ml)
                  </label>
                  <input
                    type="number"
                    inputmode="decimal"
                    min="1"
                    [ngModel]="bagTotalVolumeMl()"
                    (ngModelChange)="bagTotalVolumeMl.set(+$event || 0)"
                    class="w-full rounded-xl border border-slate-300 bg-slate-50/70 px-3 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label class="mb-1 block text-[11px] font-bold text-sky-700 dark:text-sky-400">
                    Recibido con (ml) *
                  </label>
                  <input
                    type="number"
                    inputmode="decimal"
                    min="1"
                    [ngModel]="receivedVolumeMl()"
                    (ngModelChange)="receivedVolumeMl.set(+$event || 0)"
                    placeholder="Ej. 450"
                    class="w-full rounded-xl border-2 border-sky-400 bg-sky-50/60 px-3 py-2 text-base font-black text-sky-900 outline-none focus:border-sky-600 dark:border-sky-600 dark:bg-sky-950/60 dark:text-white"
                  />
                </div>
              </div>
            }
          </div>

          <!-- 5. PARÁMETROS DE GOTEO (CALCULADORA VINCULADA) -->
          <div class="space-y-2.5">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-extrabold tracking-wider text-sky-700 uppercase dark:text-sky-400">
                5. Parámetros de Goteo
              </span>
              <button
                type="button"
                (click)="toggleSpeedInputMode()"
                class="text-[11px] font-bold text-sky-600 underline-offset-2 hover:underline dark:text-sky-400"
              >
                {{
                  speedInputMode() === 'time'
                    ? 'Ingresar gotas/min directo'
                    : 'Calcular por tiempo'
                }}
              </button>
            </div>

            <!-- Factor de goteo -->
            <div class="grid grid-cols-5 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              @for (p of dripPresets; track p.mode) {
                <button
                  type="button"
                  (click)="selectDripPreset(p.mode, p.value)"
                  class="rounded-lg py-1.5 text-center transition"
                  [class]="
                    dripMode() === p.mode
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300'
                  "
                >
                  <div class="text-xs font-extrabold leading-none">{{ p.value }}</div>
                  <div class="mt-0.5 text-[9px] opacity-80">{{ p.shortLabel }}</div>
                </button>
              }
              <button
                type="button"
                (click)="dripMode.set('custom')"
                class="rounded-lg py-1.5 text-center transition"
                [class]="
                  dripMode() === 'custom'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300'
                "
              >
                <div class="text-xs font-extrabold leading-none">✎</div>
                <div class="mt-0.5 text-[9px] opacity-80">Custom</div>
              </button>
            </div>

            @if (dripMode() === 'custom') {
              <input
                type="number"
                inputmode="numeric"
                min="1"
                [ngModel]="dripFactor()"
                (ngModelChange)="dripFactor.set(+$event || 0)"
                placeholder="Factor personalizado (gotas/ml)"
                class="w-full rounded-xl border border-sky-300 bg-sky-50/40 px-3 py-2 text-sm font-bold text-slate-900 outline-none dark:border-sky-700 dark:bg-slate-800 dark:text-white"
              />
            }

            @if (speedInputMode() === 'time') {
              <div class="flex items-center gap-2">
                <div class="flex-1">
                  <label class="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    Tiempo para pasar {{ effectiveReceivedMl() }} ml
                  </label>
                  <input
                    type="number"
                    inputmode="decimal"
                    min="0.1"
                    step="any"
                    [ngModel]="durationValue()"
                    (ngModelChange)="durationValue.set(+$event || 0)"
                    class="w-full rounded-xl border border-slate-300 bg-slate-50/70 px-3 py-2 text-base font-extrabold text-slate-900 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div class="mt-4 flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                  <button
                    type="button"
                    (click)="timeUnit.set('h')"
                    class="rounded-lg px-3 py-1.5 text-xs font-extrabold"
                    [class]="
                      timeUnit() === 'h'
                        ? 'bg-white text-sky-700 shadow-xs dark:bg-sky-600 dark:text-white'
                        : 'text-slate-500 dark:text-slate-400'
                    "
                  >
                    h
                  </button>
                  <button
                    type="button"
                    (click)="timeUnit.set('min')"
                    class="rounded-lg px-3 py-1.5 text-xs font-extrabold"
                    [class]="
                      timeUnit() === 'min'
                        ? 'bg-white text-sky-700 shadow-xs dark:bg-sky-600 dark:text-white'
                        : 'text-slate-500 dark:text-slate-400'
                    "
                  >
                    min
                  </button>
                </div>
              </div>
            } @else {
              <div>
                <label class="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  Goteo actual indicado (gotas/min)
                </label>
                <input
                  type="number"
                  inputmode="decimal"
                  min="1"
                  step="any"
                  [ngModel]="directDropsPerMin()"
                  (ngModelChange)="directDropsPerMin.set(+$event || 0)"
                  class="w-full rounded-xl border border-slate-300 bg-slate-50/70 px-3 py-2 text-base font-extrabold text-slate-900 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            }

            <!-- Vista previa del cálculo -->
            @if (preview(); as calc) {
              <div
                class="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50/80 px-3.5 py-2.5 text-xs dark:border-emerald-900/60 dark:bg-emerald-950/40"
              >
                <div>
                  <div class="font-black text-emerald-800 dark:text-emerald-300">
                    {{ calc.roundedDrops }} gotas/min ({{ calc.exactDrops.toFixed(1) }})
                  </div>
                  <div class="text-[11px] text-emerald-700/90 dark:text-emerald-400">
                    {{ calc.mlPerHour.toFixed(1) }} ml/h · Fin est. {{ calc.endClock }}
                  </div>
                </div>
                <span class="rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-extrabold text-white">
                  {{ calc.durationLabel }}
                </span>
              </div>
            }

            <!-- Toggle alarma -15 min -->
            <label
              class="flex cursor-pointer items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-800/60"
            >
              <div>
                <div class="text-xs font-bold text-slate-800 dark:text-slate-100">
                  Alerta automática 15 min antes
                </div>
                <div class="text-[11px] text-slate-500 dark:text-slate-400">
                  Suena incluso con la app cerrada
                </div>
              </div>
              <input
                type="checkbox"
                [ngModel]="alarmEnabled()"
                (ngModelChange)="alarmEnabled.set(!!$event)"
                class="h-5 w-5 accent-sky-600"
              />
            </label>
          </div>
        </div>

        <!-- Pie fijo con botones de guardar -->
        <div
          class="flex gap-2 border-t border-slate-200/80 bg-white px-5 py-3.5 dark:border-slate-800 dark:bg-slate-900"
        >
          <button
            type="button"
            (click)="cancelled.emit()"
            class="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            [disabled]="!canSubmit()"
            (click)="submit()"
            class="flex-[2] rounded-2xl bg-gradient-to-r from-sky-600 to-blue-600 px-4 py-3 text-sm font-extrabold text-white shadow-md shadow-sky-600/25 transition hover:from-sky-500 hover:to-blue-500 active:scale-[0.98] disabled:opacity-40"
          >
            {{ existingPatient() ? 'Guardar Cambios' : 'Agregar al Turno' }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class PatientFormModalComponent implements OnInit {
  readonly existingPatient = input<PatientInfusionRecord | null>(null);
  readonly saved = output<PatientFormPayload>();
  readonly cancelled = output<void>();

  private readonly shiftManager = inject(ShiftManagerService);
  private readonly haptics = inject(HapticsService);

  protected readonly availableWards = this.shiftManager.availableWards;
  protected readonly solutionTypes = SOLUTION_TYPES;
  protected readonly commonAdditives = COMMON_ADDITIVES;
  protected readonly dripPresets = DRIP_FACTOR_PRESETS;

  protected readonly ward = signal<string>('');
  protected readonly bed = signal<string>('');
  protected readonly patientName = signal<string>('');
  protected readonly solutionType = signal<SolutionType>('Solución Fisiológica 0.9%');
  protected readonly customSolutionName = signal<string>('');
  protected readonly additives = signal<AdditiveMedication[]>([]);
  protected readonly newMedName = signal<string>('');
  protected readonly newMedDose = signal<string>('');

  protected readonly origin = signal<InfusionOrigin>('new');
  protected readonly bagTotalVolumeMl = signal<number>(1000);
  protected readonly receivedVolumeMl = signal<number>(1000);

  protected readonly dripMode = signal<DripFactorMode>('normo20');
  protected readonly dripFactor = signal<number>(20);
  protected readonly speedInputMode = signal<'time' | 'drops'>('time');
  protected readonly durationValue = signal<number>(8);
  protected readonly timeUnit = signal<TimeUnit>('h');
  protected readonly directDropsPerMin = signal<number>(28);
  protected readonly alarmEnabled = signal<boolean>(true);

  protected readonly effectiveReceivedMl = computed(() =>
    this.origin() === 'new' ? this.bagTotalVolumeMl() : this.receivedVolumeMl()
  );

  protected readonly preview = computed(() => {
    const vol = this.effectiveReceivedMl();
    const fg = this.dripFactor();
    if (!vol || vol <= 0 || !fg || fg <= 0) return null;

    let exactDrops: number;
    let totalMinutes: number;

    if (this.speedInputMode() === 'time') {
      const dur = this.durationValue();
      if (!dur || dur <= 0) return null;
      totalMinutes = this.timeUnit() === 'h' ? dur * 60 : dur;
      exactDrops = (vol * fg) / totalMinutes;
    } else {
      const gtt = this.directDropsPerMin();
      if (!gtt || gtt <= 0) return null;
      exactDrops = gtt;
      totalMinutes = (vol * fg) / exactDrops;
    }

    const mlPerHour = (exactDrops / fg) * 60;
    const endDate = new Date(Date.now() + totalMinutes * 60_000);
    const h = Math.floor(Math.round(totalMinutes) / 60);
    const m = Math.round(totalMinutes) % 60;
    const durationLabel = h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h}h ${m}m`;

    return {
      exactDrops,
      roundedDrops: Math.max(1, Math.round(exactDrops)),
      mlPerHour,
      durationLabel,
      endClock: endDate.toLocaleTimeString('es', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }),
    };
  });

  protected readonly canSubmit = computed(() => {
    const hasIdentity =
      this.ward().trim().length > 0 &&
      this.bed().trim().length > 0 &&
      this.patientName().trim().length > 0;
    const hasCustomSolution =
      this.solutionType() !== 'Otro' || this.customSolutionName().trim().length > 0;
    return hasIdentity && hasCustomSolution && this.preview() !== null;
  });

  ngOnInit(): void {
    const existing = this.existingPatient();
    if (!existing) return;

    this.ward.set(existing.ward);
    this.bed.set(existing.bed);
    this.patientName.set(existing.patientName);
    this.solutionType.set(existing.solutionType);
    this.customSolutionName.set(existing.customSolutionName ?? '');
    this.additives.set([...existing.additives]);
    this.origin.set(existing.origin);
    this.bagTotalVolumeMl.set(existing.bagTotalVolumeMl);
    this.receivedVolumeMl.set(existing.receivedVolumeMl);
    this.dripFactor.set(existing.dripFactor);
    this.alarmEnabled.set(existing.alarmEnabled);

    const matchedPreset = DRIP_FACTOR_PRESETS.find((p) => p.value === existing.dripFactor);
    this.dripMode.set(matchedPreset ? matchedPreset.mode : 'custom');

    // Al editar, mostramos la tasa exacta en gotas/min o su tiempo equivalente
    this.speedInputMode.set('drops');
    this.directDropsPerMin.set(Number(existing.exactDropsPerMinute.toFixed(1)));
    const remainingHours = existing.receivedVolumeMl / Math.max(0.01, existing.mlPerHour);
    this.durationValue.set(Number(remainingHours.toFixed(2)));
    this.timeUnit.set('h');
  }

  protected setOrigin(next: InfusionOrigin): void {
    this.origin.set(next);
    if (next === 'new') {
      this.receivedVolumeMl.set(this.bagTotalVolumeMl());
    } else if (this.receivedVolumeMl() >= this.bagTotalVolumeMl()) {
      this.receivedVolumeMl.set(Math.round(this.bagTotalVolumeMl() * 0.5));
    }
    void this.haptics.triggerControlTap();
  }

  protected applyBagPreset(ml: number): void {
    this.bagTotalVolumeMl.set(ml);
    if (this.origin() === 'new') {
      this.receivedVolumeMl.set(ml);
    }
    void this.haptics.triggerControlTap();
  }

  protected onNewBagVolumeChange(ml: number): void {
    this.bagTotalVolumeMl.set(ml);
    this.receivedVolumeMl.set(ml);
  }

  protected selectDripPreset(mode: DripFactorMode, value: number): void {
    this.dripMode.set(mode);
    this.dripFactor.set(value);
    void this.haptics.triggerControlTap();
  }

  protected toggleSpeedInputMode(): void {
    const calc = this.preview();
    if (this.speedInputMode() === 'time') {
      if (calc) {
        this.directDropsPerMin.set(Number(calc.exactDrops.toFixed(1)));
      }
      this.speedInputMode.set('drops');
    } else {
      if (calc) {
        const hours = this.effectiveReceivedMl() / Math.max(0.01, calc.mlPerHour);
        this.timeUnit.set('h');
        this.durationValue.set(Number(hours.toFixed(2)));
      }
      this.speedInputMode.set('time');
    }
  }

  protected quickAddAdditive(name: string, dose: string): void {
    void this.haptics.triggerControlTap();
    this.additives.update((list) => [
      ...list,
      {
        id: `med_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        name,
        dose,
      },
    ]);
  }

  protected addCustomAdditive(): void {
    const name = this.newMedName().trim();
    if (!name) return;
    this.additives.update((list) => [
      ...list,
      {
        id: `med_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        name,
        dose: this.newMedDose().trim() || '1 dosis',
      },
    ]);
    this.newMedName.set('');
    this.newMedDose.set('');
  }

  protected removeAdditive(id: string): void {
    this.additives.update((list) => list.filter((a) => a.id !== id));
  }

  protected submit(): void {
    const calc = this.preview();
    if (!this.canSubmit() || !calc) return;

    void this.haptics.triggerControlTap();
    this.saved.emit({
      ward: this.ward().trim(),
      bed: this.bed().trim(),
      patientName: this.patientName().trim(),
      solutionType: this.solutionType(),
      customSolutionName:
        this.solutionType() === 'Otro' ? this.customSolutionName().trim() : undefined,
      additives: this.additives(),
      origin: this.origin(),
      bagTotalVolumeMl: Math.max(this.bagTotalVolumeMl(), this.effectiveReceivedMl()),
      receivedVolumeMl: this.effectiveReceivedMl(),
      dripFactor: this.dripFactor(),
      exactDropsPerMinute: calc.exactDrops,
      alarmEnabled: this.alarmEnabled(),
    });
  }
}
