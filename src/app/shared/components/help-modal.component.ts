import { ChangeDetectionStrategy, Component, output } from '@angular/core';

@Component({
  selector: 'app-help-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-4 backdrop-blur-xs sm:items-center"
      (click)="closed.emit()"
    >
      <div
        class="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        (click)="$event.stopPropagation()"
      >
        <div class="mb-4 flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <span
              class="flex h-9 w-9 items-center justify-center rounded-2xl bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400"
            >
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </span>
            <h3 class="text-base font-extrabold text-slate-900 dark:text-white">
              Guía clínica rápida
            </h3>
          </div>
          <button
            type="button"
            (click)="closed.emit()"
            class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            aria-label="Cerrar ayuda"
          >
            ✕
          </button>
        </div>

        <div class="space-y-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          <div class="rounded-2xl bg-sky-50 p-3.5 dark:bg-sky-950/50">
            <div class="mb-1 font-extrabold text-sky-800 dark:text-sky-300">
              Fórmula de cálculo de goteo
            </div>
            <div class="font-mono text-[13px] font-bold text-slate-900 dark:text-white">
              Gotas/min = (Volumen ml × Factor de goteo) ÷ Tiempo min
            </div>
            <div class="mt-1 text-[11px] text-sky-700 dark:text-sky-300/90">
              Segundos entre gotas = 60 ÷ Gotas/min
            </div>
          </div>

          <div class="rounded-2xl border border-slate-200 p-3.5 dark:border-slate-800">
            <div class="mb-2 font-extrabold text-slate-800 dark:text-slate-100">
              Equipos de venoclisis estándar
            </div>
            <ul class="space-y-1.5">
              <li class="flex justify-between">
                <span>Macrogotero (sangre / reposición rápida)</span>
                <strong class="text-slate-900 dark:text-white">10 ó 15 gtt/ml</strong>
              </li>
              <li class="flex justify-between">
                <span>Normogotero (adultos estándar)</span>
                <strong class="text-slate-900 dark:text-white">20 gtt/ml</strong>
              </li>
              <li class="flex justify-between">
                <span>Microgotero (pediatría / fármacos)</span>
                <strong class="text-slate-900 dark:text-white">60 gtt/ml</strong>
              </li>
            </ul>
          </div>

          <div
            class="rounded-2xl border border-amber-200 bg-amber-50/70 p-3 text-[11px] text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
          >
            <strong>Uso profesional:</strong> Herramienta de apoyo para enfermería y APH.
            Verifica siempre el factor de goteo impreso en el empaque del equipo de venoclisis
            y la indicación médica antes de administrar soluciones.
          </div>
        </div>

        <button
          type="button"
          (click)="closed.emit()"
          class="mt-4 w-full rounded-2xl bg-sky-600 py-3 text-sm font-bold text-white hover:bg-sky-700"
        >
          Entendido
        </button>
      </div>
    </div>
  `,
})
export class HelpModalComponent {
  readonly closed = output<void>();
}
