import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ComputedPatientState, UrgencyLevel } from '../../core/models/shift.model';
import { HapticsService } from '../../core/services/haptics.service';
import { ShiftManagerService } from '../../core/services/shift-manager.service';

@Component({
  selector: 'app-patient-dashboard',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-3">
      <!-- Barra de herramientas: Buscador + Filtros por Sala y Semáforo -->
      <section
        class="rounded-3xl border border-slate-200/80 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900"
      >
        <!-- Buscador -->
        <div class="relative mb-2.5">
          <span
            class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            type="text"
            [ngModel]="searchQuery()"
            (ngModelChange)="searchQuery.set($event)"
            placeholder="Buscar por paciente, sala, cama o solución..."
            class="w-full rounded-2xl border border-slate-200 bg-slate-50/70 py-2.5 pr-8 pl-9 text-xs font-semibold text-slate-900 outline-none focus:border-sky-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800/70 dark:text-white"
          />
          @if (searchQuery().trim()) {
            <button
              type="button"
              (click)="searchQuery.set('')"
              class="absolute inset-y-0 right-2 flex items-center pr-1 text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          }
        </div>

        <!-- Filtros rápidos de Semáforo de Urgencia -->
        <div class="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            type="button"
            (click)="setUrgencyFilter('all')"
            class="flex shrink-0 items-center gap-1 rounded-xl px-2.5 py-1.5 font-extrabold transition active:scale-95"
            [class]="
              urgencyFilter() === 'all'
                ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            "
          >
            <span>Todos</span>
            <span class="rounded-full bg-black/15 px-1.5 py-0.2 text-[10px]">
              {{ counts().total }}
            </span>
          </button>

          <button
            type="button"
            (click)="setUrgencyFilter('critical')"
            class="flex shrink-0 items-center gap-1 rounded-xl px-2.5 py-1.5 font-extrabold transition active:scale-95"
            [class]="
              urgencyFilter() === 'critical'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
            "
          >
            <span class="h-2 w-2 rounded-full bg-rose-500 animate-pulse"></span>
            <span>Rojo (&lt;15m)</span>
            <span class="rounded-full bg-black/15 px-1.5 py-0.2 text-[10px]">
              {{ counts().critical }}
            </span>
          </button>

          <button
            type="button"
            (click)="setUrgencyFilter('warning')"
            class="flex shrink-0 items-center gap-1 rounded-xl px-2.5 py-1.5 font-extrabold transition active:scale-95"
            [class]="
              urgencyFilter() === 'warning'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
            "
          >
            <span class="h-2 w-2 rounded-full bg-amber-500"></span>
            <span>Amarillo (15-45m)</span>
            <span class="rounded-full bg-black/15 px-1.5 py-0.2 text-[10px]">
              {{ counts().warning }}
            </span>
          </button>

          <button
            type="button"
            (click)="setUrgencyFilter('stable')"
            class="flex shrink-0 items-center gap-1 rounded-xl px-2.5 py-1.5 font-extrabold transition active:scale-95"
            [class]="
              urgencyFilter() === 'stable'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
            "
          >
            <span class="h-2 w-2 rounded-full bg-emerald-500"></span>
            <span>Verde (&gt;45m)</span>
            <span class="rounded-full bg-black/15 px-1.5 py-0.2 text-[10px]">
              {{ counts().stable }}
            </span>
          </button>
        </div>

        <!-- Filtro por Sala / Servicio -->
        @if (availableWards().length > 1) {
          <div class="mt-2 flex items-center gap-1 overflow-x-auto pt-1 text-[11px]">
            <span class="shrink-0 font-bold text-slate-400">Salas:</span>
            <button
              type="button"
              (click)="selectedWard.set('all')"
              class="shrink-0 rounded-lg px-2 py-0.5 font-bold"
              [class]="
                selectedWard() === 'all'
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              "
            >
              Todas
            </button>
            @for (w of availableWards(); track w) {
              <button
                type="button"
                (click)="selectedWard.set(w)"
                class="shrink-0 rounded-lg px-2 py-0.5 font-bold"
                [class]="
                  selectedWard() === w
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                "
              >
                {{ w }}
              </button>
            }
          </div>
        }
      </section>

      <!-- Botón flotante/destacado de Agregar Paciente -->
      <button
        type="button"
        (click)="addPatientClicked.emit()"
        class="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-600 to-blue-600 px-4 py-3 text-sm font-extrabold text-white shadow-md shadow-sky-600/25 transition hover:from-sky-500 hover:to-blue-500 active:scale-[0.98]"
      >
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Registrar Nuevo Paciente al Turno
      </button>

      <!-- LISTA DE TARJETAS DE PACIENTES (OPTIMIZADA PARA 10 A 30 ACTIVOS) -->
      @if (filteredPatients().length > 0) {
        <div class="space-y-2.5">
          @for (p of filteredPatients(); track p.record.id) {
            <article
              (click)="selectPatient(p.record.id)"
              class="group relative cursor-pointer overflow-hidden rounded-3xl border bg-white p-3.5 shadow-xs transition-all hover:shadow-md active:scale-[0.99] dark:bg-slate-900"
              [class]="cardBorderClass(p.urgency)"
            >
              <!-- Banda vertical de color de urgencia a la izquierda -->
              <div
                class="absolute top-0 bottom-0 left-0 w-1.5"
                [class]="stripClass(p.urgency)"
              ></div>

              <!-- Fila 1: Sala / Cama + Badge Semáforo + Hora de fin -->
              <div class="flex items-center justify-between gap-2 pl-1">
                <div class="flex items-center gap-1.5">
                  <span
                    class="rounded-xl px-2.5 py-1 text-xs font-black tracking-wide"
                    [class]="locationBadgeClass(p.urgency)"
                  >
                    {{ p.record.ward }} · Cama {{ p.record.bed }}
                  </span>
                  @if (p.record.origin === 'inherited') {
                    <span
                      class="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                    >
                      Heredado
                    </span>
                  }
                </div>

                <!-- Hora estimada de fin + badge de alerta -->
                <div class="flex items-center gap-1.5 text-right">
                  <span
                    class="rounded-full px-2 py-0.5 text-[11px] font-extrabold"
                    [class]="urgencyBadgeClass(p.urgency)"
                  >
                    @if (p.isCompleted) {
                      TERMINADO
                    } @else if (p.remainingMinutes < 60) {
                      {{ Math.round(p.remainingMinutes) }} min rest.
                    } @else {
                      {{ (p.remainingMinutes / 60).toFixed(1) }} h rest.
                    }
                  </span>

                  @if (p.record.alarmEnabled) {
                    <span
                      title="Alarma local activada a -15 min"
                      class="text-emerald-600 dark:text-emerald-400"
                    >
                      <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
                      </svg>
                    </span>
                  }
                </div>
              </div>

              <!-- Fila 2: Nombre del paciente -->
              <div class="mt-2 pl-1">
                <h3 class="text-sm font-black text-slate-900 group-hover:text-sky-600 dark:text-white dark:group-hover:text-sky-400">
                  {{ p.record.patientName }}
                </h3>
              </div>

              <!-- Fila 3: Solución + Agregados -->
              <div class="mt-1 flex flex-wrap items-center gap-1.5 pl-1 text-xs text-slate-600 dark:text-slate-300">
                <span class="font-bold text-sky-700 dark:text-sky-400">
                  {{ p.solutionDisplayName }}
                </span>
                @if (p.record.additives.length > 0) {
                  <span class="text-slate-400">•</span>
                  @for (med of p.record.additives; track med.id) {
                    <span
                      class="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300"
                    >
                      + {{ med.name }} {{ med.dose }}
                    </span>
                  }
                }
              </div>

              <!-- Fila 4: Barra de progreso de infusión en tiempo real -->
              <div class="mt-2.5 pl-1">
                <div class="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    class="h-full rounded-full transition-all duration-500"
                    [class]="progressBarColor(p.urgency)"
                    [style.width.%]="p.progressPercent"
                  ></div>
                </div>
              </div>

              <!-- Fila 5: Resumen numérico en tiempo real -->
              <div class="mt-2 flex items-center justify-between pl-1 text-xs font-semibold">
                <div class="flex items-center gap-2">
                  <span class="text-slate-900 dark:text-white">
                    <strong class="font-black text-sky-700 dark:text-sky-400">
                      {{ Math.round(p.remainingMl) }} ml
                    </strong>
                    <span class="text-[11px] text-slate-400">
                      / {{ Math.round(p.record.bagTotalVolumeMl) }} ml
                    </span>
                  </span>
                  <span class="text-slate-400">·</span>
                  <span class="text-slate-600 dark:text-slate-300">
                    {{ p.roundedDropsPerMinute }} gtt/min ({{ p.record.mlPerHour.toFixed(0) }} ml/h)
                  </span>
                </div>

                <div class="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  Fin: {{ formatTime(p.estimatedEndTimeMs) }}
                </div>
              </div>
            </article>
          }
        </div>
      } @else {
        <div
          class="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900"
        >
          <div
            class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400"
          >
            <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
          </div>
          <h3 class="text-sm font-extrabold text-slate-800 dark:text-slate-200">
            {{
              searchQuery().trim() || urgencyFilter() !== 'all' || selectedWard() !== 'all'
                ? 'No hay pacientes con los filtros seleccionados'
                : 'Sin pacientes registrados en este turno'
            }}
          </h3>
          <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Toca el botón superior para ingresar tu primer paciente con venoclisis.
          </p>
        </div>
      }
    </div>
  `,
})
export class PatientDashboardComponent {
  readonly addPatientClicked = output<void>();
  readonly patientSelected = output<string>();

  protected readonly Math = Math;
  private readonly shiftManager = inject(ShiftManagerService);
  private readonly haptics = inject(HapticsService);

  protected readonly counts = this.shiftManager.urgencyCounts;
  protected readonly availableWards = this.shiftManager.availableWards;

  protected readonly searchQuery = signal<string>('');
  protected readonly urgencyFilter = signal<'all' | UrgencyLevel>('all');
  protected readonly selectedWard = signal<string>('all');

  protected readonly filteredPatients = computed<ComputedPatientState[]>(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const urg = this.urgencyFilter();
    const ward = this.selectedWard();
    const list = this.shiftManager.computedPatients();

    return list.filter((p) => {
      if (urg !== 'all' && p.urgency !== urg) return false;
      if (ward !== 'all' && p.record.ward !== ward) return false;

      if (!query) return true;
      const matchName = p.record.patientName.toLowerCase().includes(query);
      const matchWard = p.record.ward.toLowerCase().includes(query);
      const matchBed = p.record.bed.toLowerCase().includes(query);
      const matchSol = p.solutionDisplayName.toLowerCase().includes(query);
      const matchAdd = p.record.additives.some((a) =>
        a.name.toLowerCase().includes(query)
      );
      return matchName || matchWard || matchBed || matchSol || matchAdd;
    });
  });

  protected setUrgencyFilter(filter: 'all' | UrgencyLevel): void {
    void this.haptics.triggerControlTap();
    this.urgencyFilter.set(filter);
  }

  protected selectPatient(patientId: string): void {
    void this.haptics.triggerControlTap();
    this.patientSelected.emit(patientId);
  }

  protected cardBorderClass(urgency: UrgencyLevel): string {
    switch (urgency) {
      case 'critical':
        return 'border-rose-300 dark:border-rose-800/80 bg-rose-50/20';
      case 'warning':
        return 'border-amber-300 dark:border-amber-800/80 bg-amber-50/20';
      case 'stable':
        return 'border-slate-200/90 dark:border-slate-800';
    }
  }

  protected stripClass(urgency: UrgencyLevel): string {
    switch (urgency) {
      case 'critical':
        return 'bg-rose-500';
      case 'warning':
        return 'bg-amber-500';
      case 'stable':
        return 'bg-emerald-500';
    }
  }

  protected locationBadgeClass(urgency: UrgencyLevel): string {
    switch (urgency) {
      case 'critical':
        return 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200';
      case 'warning':
        return 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200';
      case 'stable':
        return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200';
    }
  }

  protected urgencyBadgeClass(urgency: UrgencyLevel): string {
    switch (urgency) {
      case 'critical':
        return 'bg-rose-600 text-white animate-pulse';
      case 'warning':
        return 'bg-amber-500 text-white';
      case 'stable':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300';
    }
  }

  protected progressBarColor(urgency: UrgencyLevel): string {
    switch (urgency) {
      case 'critical':
        return 'bg-rose-500';
      case 'warning':
        return 'bg-amber-500';
      case 'stable':
        return 'bg-emerald-500';
    }
  }

  protected formatTime(ms: number): string {
    return new Date(ms).toLocaleTimeString('es', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }
}
