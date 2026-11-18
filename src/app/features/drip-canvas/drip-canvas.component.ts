import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { InfusionResult } from '../../core/models/infusion.model';
import { AudioMetronomeService } from '../../core/services/audio-metronome.service';
import { HapticsService } from '../../core/services/haptics.service';
import { ThemeService } from '../../core/services/theme.service';

interface ImpactRipple {
  startMs: number;
  durationMs: number;
}

@Component({
  selector: 'app-drip-canvas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      [class]="
        isFullscreen()
          ? 'fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/95 p-4 backdrop-blur-md'
          : 'relative overflow-hidden rounded-3xl border border-sky-100 bg-gradient-to-b from-sky-50/90 via-white to-sky-100/70 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950'
      "
    >
      <!-- Contenedor principal del Canvas -->
      <div
        class="relative w-full"
        [class.h-[350px]]="!isFullscreen()"
        [class.sm:h-[380px]]="!isFullscreen()"
        [class.h-full]="isFullscreen()"
        [class.max-w-md]="isFullscreen()"
        [class.max-h-[82vh]]="isFullscreen()"
      >
        <canvas
          #dripCanvas
          class="block h-full w-full touch-none"
          aria-label="Simulación en tiempo real de la cámara de goteo de suero"
        ></canvas>

        <!-- Controles flotantes izquierda: Audio, Vibración y Resumen -->
        <div class="pointer-events-auto absolute top-3 left-3 flex flex-col gap-2">
          <!-- Toggle Audio Tick (Web Audio API) -->
          <button
            type="button"
            (click)="toggleAudio()"
            [attr.aria-pressed]="audio.enabled()"
            [title]="audio.enabled() ? 'Desactivar sonido Tick' : 'Activar sonido Tick'"
            class="flex h-11 w-11 items-center justify-center rounded-2xl shadow-md transition-all active:scale-95"
            [class]="
              audio.enabled()
                ? 'bg-emerald-500 text-white shadow-emerald-500/25 hover:bg-emerald-600'
                : 'bg-slate-200/90 text-slate-600 hover:bg-slate-300/90 dark:bg-slate-800/90 dark:text-slate-300 dark:hover:bg-slate-700'
            "
          >
            @if (audio.enabled()) {
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" fill-opacity="0.2" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
            } @else {
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="22" y1="9" x2="16" y2="15" />
                <line x1="16" y1="9" x2="22" y2="15" />
              </svg>
            }
          </button>

          <!-- Toggle Vibración Háptica -->
          <button
            type="button"
            (click)="toggleHaptics()"
            [attr.aria-pressed]="haptics.enabled()"
            [title]="haptics.enabled() ? 'Desactivar vibración háptica' : 'Activar vibración háptica'"
            class="flex h-11 w-11 items-center justify-center rounded-2xl shadow-md transition-all active:scale-95"
            [class]="
              haptics.enabled()
                ? 'bg-sky-600 text-white shadow-sky-600/25 hover:bg-sky-700'
                : 'bg-slate-200/90 text-slate-600 hover:bg-slate-300/90 dark:bg-slate-800/90 dark:text-slate-300 dark:hover:bg-slate-700'
            "
          >
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="7" y="4" width="10" height="16" rx="2" />
              <path d="M3 8v8" />
              <path d="M21 8v8" />
              <line x1="12" y1="17" x2="12.01" y2="17" stroke-width="2.5" />
            </svg>
          </button>

          <!-- Resumen de volumen y duración -->
          <div
            class="mt-1 rounded-2xl bg-sky-600 px-3 py-2 text-center text-xs font-bold leading-tight text-white shadow-md shadow-sky-600/20 dark:bg-sky-700"
          >
            <div>{{ formattedVolume() }}</div>
            <div class="mt-0.5 text-[11px] font-medium text-sky-100">{{ formattedDuration() }}</div>
          </div>
        </div>

        <!-- Badge superior derecho: Gotas/min en vivo + contador -->
        <div class="pointer-events-none absolute top-3 right-3 flex flex-col items-end gap-1.5">
          <div
            class="flex items-center gap-2 rounded-full bg-slate-800/85 px-3.5 py-1.5 text-xs font-bold text-white shadow-md backdrop-blur-sm dark:bg-slate-800/95"
          >
            <span
              class="h-2.5 w-2.5 rounded-full transition-transform duration-100"
              [class]="
                impactFlashActive()
                  ? 'scale-125 bg-cyan-300 shadow-[0_0_10px_#67e8f9]'
                  : 'scale-100 bg-sky-400/70'
              "
            ></span>
            <span>{{ result().exactDropsPerMinute.toFixed(1) }} gotas/min</span>
          </div>

          <div
            class="rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-xs backdrop-blur-xs dark:bg-slate-800/80 dark:text-slate-300"
          >
            {{ result().secondsPerDrop.toFixed(2) }} s/gota · #{{ dropCount() }}
          </div>
        </div>

        <!-- Badge inferior izquierdo: Factor de Goteo -->
        <div class="pointer-events-none absolute bottom-3 left-3 flex flex-col gap-1.5">
          <span
            class="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 dark:bg-emerald-700"
          >
            FG: {{ result().dripFactor }} gtt/ml
          </span>
          @if (isPaused()) {
            <span
              class="inline-flex items-center rounded-lg bg-amber-500/90 px-2.5 py-0.5 text-[11px] font-bold text-white"
            >
              Pausado
            </span>
          }
        </div>

        <!-- Controles inferior derecho: Pausar / Pantalla completa -->
        <div class="pointer-events-auto absolute right-3 bottom-3 flex items-center gap-2">
          <button
            type="button"
            (click)="togglePause()"
            [title]="isPaused() ? 'Reanudar simulación' : 'Pausar simulación'"
            class="flex h-10 w-10 items-center justify-center rounded-xl bg-white/90 text-slate-700 shadow-md transition hover:bg-white active:scale-95 dark:bg-slate-800/90 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            @if (isPaused()) {
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="7 5 19 12 7 19 7 5" />
              </svg>
            } @else {
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            }
          </button>

          <button
            type="button"
            (click)="toggleFullscreen()"
            [title]="isFullscreen() ? 'Salir de pantalla completa' : 'Modo enfoque pantalla completa'"
            class="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-white shadow-md shadow-sky-600/25 transition hover:bg-sky-700 active:scale-95"
          >
            @if (isFullscreen()) {
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="4 14 10 14 10 20" />
                <polyline points="20 10 14 10 14 4" />
                <line x1="14" y1="10" x2="21" y2="3" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            } @else {
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            }
          </button>
        </div>
      </div>

      @if (isFullscreen()) {
        <div class="mt-4 flex items-center gap-3 text-xs text-slate-300">
          <span>Alinea tu cámara de goteo real con el pulso visual y sonoro</span>
          <button
            type="button"
            (click)="toggleFullscreen()"
            class="rounded-full bg-white/15 px-4 py-1.5 font-semibold text-white transition hover:bg-white/25"
          >
            Cerrar
          </button>
        </div>
      }
    </div>
  `,
})
export class DripCanvasComponent implements AfterViewInit, OnDestroy {
  readonly result = input.required<InfusionResult>();

  protected readonly audio = inject(AudioMetronomeService);
  protected readonly haptics = inject(HapticsService);
  private readonly theme = inject(ThemeService);
  private readonly ngZone = inject(NgZone);

  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('dripCanvas');

  protected readonly isPaused = signal(false);
  protected readonly isFullscreen = signal(false);
  protected readonly dropCount = signal(0);
  protected readonly impactFlashActive = signal(false);

  protected readonly formattedVolume = computed(() => {
    const ml = this.result().volumeMl;
    return ml >= 1000 && ml % 100 === 0 ? `${ml / 1000} L` : `${Math.round(ml)} ml`;
  });

  protected readonly formattedDuration = computed(() => {
    const totalMin = Math.round(this.result().effectiveDurationMinutes);
    const hours = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    if (hours === 0) return `${mins} min`;
    if (mins === 0) return `${hours} h`;
    return `${hours}h ${mins}m`;
  });

  // Estado del motor de precisión en milisegundos (sin CSS animations)
  private rafId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private flashTimeout: ReturnType<typeof setTimeout> | null = null;

  private intervalMs = 2880;
  private cycleStartMs = 0;
  private pausedPhase = 0;
  private impacts: ImpactRipple[] = [];
  private lastImpactMs = -10_000;

  private width = 320;
  private height = 360;
  private dpr = 1;

  constructor() {
    effect(() => {
      const nextInterval = Math.max(80, this.result().intervalMs);
      const now = performance.now();

      if (this.cycleStartMs > 0 && this.intervalMs > 0) {
        // Conserva la fase actual al cambiar velocidad (ajuste fino + / -) sin saltos bruscos
        const currentPhase = this.isPaused()
          ? this.pausedPhase
          : Math.min(0.98, Math.max(0, (now - this.cycleStartMs) / this.intervalMs));
        this.intervalMs = nextInterval;
        this.cycleStartMs = now - currentPhase * this.intervalMs;
      } else {
        this.intervalMs = nextInterval;
        this.cycleStartMs = now;
      }
    });
  }

  ngAfterViewInit(): void {
    const canvas = this.canvasRef().nativeElement;
    this.updateCanvasDimensions(canvas);

    this.resizeObserver = new ResizeObserver(() => {
      this.updateCanvasDimensions(canvas);
    });
    if (canvas.parentElement) {
      this.resizeObserver.observe(canvas.parentElement);
    }

    this.cycleStartMs = performance.now();

    // Ejecutar el loop requestAnimationFrame fuera de NgZone para 60-120fps sin sobrecarga
    this.ngZone.runOutsideAngular(() => {
      const loop = (now: number) => {
        this.tick(now);
        this.render(canvas, now);
        this.rafId = requestAnimationFrame(loop);
      };
      this.rafId = requestAnimationFrame(loop);
    });
  }

  ngOnDestroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.flashTimeout !== null) {
      clearTimeout(this.flashTimeout);
      this.flashTimeout = null;
    }
  }

  protected toggleAudio(): void {
    this.audio.toggle();
  }

  protected toggleHaptics(): void {
    this.haptics.toggle();
  }

  protected togglePause(): void {
    const now = performance.now();
    if (!this.isPaused()) {
      this.pausedPhase = Math.min(0.99, Math.max(0, (now - this.cycleStartMs) / this.intervalMs));
      this.isPaused.set(true);
    } else {
      this.cycleStartMs = now - this.pausedPhase * this.intervalMs;
      this.isPaused.set(false);
      this.audio.unlock();
    }
  }

  protected toggleFullscreen(): void {
    this.isFullscreen.update((v) => !v);
    // Recalcular tamaño del canvas en el siguiente frame
    requestAnimationFrame(() => {
      const canvas = this.canvasRef().nativeElement;
      this.updateCanvasDimensions(canvas);
    });
  }

  private updateCanvasDimensions(canvas: HTMLCanvasElement): void {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.width = rect.width;
    this.height = rect.height;

    canvas.width = Math.round(rect.width * this.dpr);
    canvas.height = Math.round(rect.height * this.dpr);
  }

  private tick(now: number): void {
    if (this.isPaused()) return;

    const elapsed = now - this.cycleStartMs;
    if (elapsed >= this.intervalMs) {
      // Reloj libre de deriva: si el tab estuvo oculto (>2 ciclos), resincroniza limpiamente
      if (elapsed > this.intervalMs * 2) {
        this.cycleStartMs = now;
      } else {
        this.cycleStartMs += this.intervalMs;
      }

      this.onDropImpact(now);
    }

    // Limpiar ondas expiradas
    if (this.impacts.length > 0) {
      this.impacts = this.impacts.filter((imp) => now - imp.startMs < imp.durationMs);
    }
  }

  private onDropImpact(now: number): void {
    this.lastImpactMs = now;
    const rippleDuration = Math.min(680, Math.max(240, this.intervalMs * 0.6));
    this.impacts.push({ startMs: now, durationMs: rippleDuration });

    // 1. Audio Web Audio API sincronizado al impacto
    this.audio.playDropTick();

    // 2. Vibración háptica sincronizada al impacto
    void this.haptics.triggerDropPulse();

    // 3. Actualizar contador y pulso visual en Angular
    this.ngZone.run(() => {
      this.dropCount.update((c) => c + 1);
      this.impactFlashActive.set(true);
      if (this.flashTimeout !== null) {
        clearTimeout(this.flashTimeout);
      }
      this.flashTimeout = setTimeout(() => {
        this.impactFlashActive.set(false);
      }, 130);
    });
  }

  private render(canvas: HTMLCanvasElement, now: number): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);

    const isDark = this.theme.isDark() || this.isFullscreen();
    const cx = this.width / 2;

    // Geometría escalable de la cámara de goteo
    const chamberW = Math.min(96, this.width * 0.28);
    const chamberH = Math.min(206, this.height * 0.57);
    const chamberTop = Math.max(46, this.height * 0.14);
    const chamberBottom = chamberTop + chamberH;
    const chamberLeft = cx - chamberW / 2;
    const chamberRight = cx + chamberW / 2;

    const liquidLevelRatio = 0.42;
    const liquidTopY = chamberBottom - chamberH * liquidLevelRatio;
    const nozzleBottomY = chamberTop + 13;

    // Progreso exacto del ciclo [0, 1)
    const phase = this.isPaused()
      ? this.pausedPhase
      : Math.min(0.9999, Math.max(0, (now - this.cycleStartMs) / this.intervalMs));

    // Intensidad del destello en la base tras cada impacto (decaimiento suave en 320ms)
    const msSinceImpact = now - this.lastImpactMs;
    const impactGlow =
      msSinceImpact >= 0 && msSinceImpact < 360 ? 1 - msSinceImpact / 360 : 0;

    // 1. Halo ambiental suave detrás de la cámara (pulsa levemente con cada gota)
    const haloRadius = chamberH * 0.68;
    const haloGrad = ctx.createRadialGradient(
      cx,
      liquidTopY,
      10,
      cx,
      liquidTopY,
      haloRadius
    );
    if (isDark) {
      haloGrad.addColorStop(0, `rgba(56, 189, 248, ${0.14 + impactGlow * 0.22})`);
      haloGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
    } else {
      haloGrad.addColorStop(0, `rgba(14, 165, 233, ${0.12 + impactGlow * 0.2})`);
      haloGrad.addColorStop(1, 'rgba(224, 242, 254, 0)');
    }
    ctx.fillStyle = haloGrad;
    ctx.fillRect(0, 0, this.width, this.height);

    // 2. Tubo inferior flexible de venoclisis (sale de la base)
    this.drawLowerTubing(ctx, cx, chamberBottom, isDark, impactGlow);

    // 3. Cuerpo de vidrio de la cámara (fondo interior)
    ctx.save();
    this.roundedRectPath(ctx, chamberLeft, chamberTop, chamberW, chamberH, 12);
    const glassGrad = ctx.createLinearGradient(chamberLeft, 0, chamberRight, 0);
    if (isDark) {
      glassGrad.addColorStop(0, 'rgba(30, 41, 59, 0.85)');
      glassGrad.addColorStop(0.45, 'rgba(51, 65, 85, 0.45)');
      glassGrad.addColorStop(1, 'rgba(15, 23, 42, 0.88)');
    } else {
      glassGrad.addColorStop(0, 'rgba(226, 232, 240, 0.72)');
      glassGrad.addColorStop(0.4, 'rgba(255, 255, 255, 0.92)');
      glassGrad.addColorStop(1, 'rgba(203, 213, 225, 0.75)');
    }
    ctx.fillStyle = glassGrad;
    ctx.fill();
    ctx.clip();

    // 4. Líquido salino en la base + oscilación de superficie por impacto
    const waveAmp = impactGlow * 4.2;
    const waveFreq = (msSinceImpact / 360) * Math.PI * 3;
    const liquidGrad = ctx.createLinearGradient(0, liquidTopY, 0, chamberBottom);
    if (isDark) {
      liquidGrad.addColorStop(0, 'rgba(56, 189, 248, 0.72)');
      liquidGrad.addColorStop(1, 'rgba(2, 132, 199, 0.9)');
    } else {
      liquidGrad.addColorStop(0, 'rgba(103, 232, 249, 0.78)');
      liquidGrad.addColorStop(1, 'rgba(14, 165, 233, 0.85)');
    }

    ctx.beginPath();
    ctx.moveTo(chamberLeft, chamberBottom);
    ctx.lineTo(chamberLeft, liquidTopY);
    const segments = 24;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = chamberLeft + t * chamberW;
      // Menisco cóncavo natural + onda radial desde el centro
      const distFromCenter = Math.abs(t - 0.5) * 2;
      const meniscus = -Math.pow(distFromCenter, 2) * 3.2;
      const rippleWave =
        Math.cos(distFromCenter * Math.PI * 2 - waveFreq) *
        waveAmp *
        (1 - distFromCenter * 0.45);
      ctx.lineTo(x, liquidTopY + meniscus + rippleWave);
    }
    ctx.lineTo(chamberRight, chamberBottom);
    ctx.closePath();
    ctx.fillStyle = liquidGrad;
    ctx.fill();

    // Brillo en el menisco superior del líquido
    ctx.beginPath();
    ctx.ellipse(cx, liquidTopY + 1, chamberW * 0.46, 3.8, 0, 0, Math.PI * 2);
    ctx.fillStyle = isDark ? 'rgba(186, 230, 253, 0.35)' : 'rgba(255, 255, 255, 0.55)';
    ctx.fill();

    // Destello/parpadeo en la base de la cámara sincronizado con la caída
    if (impactGlow > 0.01) {
      const baseFlashGrad = ctx.createRadialGradient(
        cx,
        chamberBottom - 6,
        2,
        cx,
        chamberBottom - 6,
        chamberW * 0.85
      );
      baseFlashGrad.addColorStop(0, `rgba(186, 230, 253, ${impactGlow * 0.75})`);
      baseFlashGrad.addColorStop(0.55, `rgba(56, 189, 248, ${impactGlow * 0.35})`);
      baseFlashGrad.addColorStop(1, 'rgba(14, 165, 233, 0)');
      ctx.fillStyle = baseFlashGrad;
      ctx.fillRect(chamberLeft, liquidTopY - 8, chamberW, chamberBottom - liquidTopY + 10);
    }

    // 5. Ondas expansivas en la superficie del líquido al impactar cada gota
    for (const imp of this.impacts) {
      const p = (now - imp.startMs) / imp.durationMs;
      if (p < 0 || p > 1) continue;
      const eased = 1 - Math.pow(1 - p, 2);
      const rx = 5 + eased * (chamberW * 0.44);
      const ry = 2 + eased * 7.5;
      const alpha = (1 - p) * 0.9;

      ctx.beginPath();
      ctx.ellipse(cx, liquidTopY, rx, ry, 0, 0, Math.PI * 2);
      ctx.strokeStyle = isDark
        ? `rgba(125, 211, 252, ${alpha})`
        : `rgba(255, 255, 255, ${alpha})`;
      ctx.lineWidth = 2.4 * (1 - p * 0.5);
      ctx.stroke();

      // Segundo anillo exterior celeste
      ctx.beginPath();
      ctx.ellipse(cx, liquidTopY, rx * 0.65, ry * 0.65, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(14, 165, 233, ${alpha * 0.75})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // 6. Gota en formación y caída gravitacional matemáticamente exacta
    this.drawDroplet(ctx, cx, nozzleBottomY, liquidTopY, phase, isDark);

    // 7. Reflejo de vidrio vertical + marcas de nivel
    const highlightGrad = ctx.createLinearGradient(
      chamberLeft + 8,
      0,
      chamberLeft + 22,
      0
    );
    highlightGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
    highlightGrad.addColorStop(0.5, isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.65)');
    highlightGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = highlightGrad;
    ctx.fillRect(chamberLeft + 8, chamberTop + 14, 14, chamberH - 28);

    // Marcas de calibración discretas
    ctx.strokeStyle = isDark ? 'rgba(148, 163, 184, 0.32)' : 'rgba(100, 116, 139, 0.25)';
    ctx.lineWidth = 1.2;
    for (let i = 1; i <= 5; i++) {
      const y = chamberTop + (chamberH / 6) * i;
      const tickLen = i === 3 ? 12 : 7;
      ctx.beginPath();
      ctx.moveTo(chamberRight - tickLen - 3, y);
      ctx.lineTo(chamberRight - 3, y);
      ctx.stroke();
    }

    ctx.restore(); // Fin del clip del cuerpo de la cámara

    // 8. Contorno del cilindro de vidrio
    this.roundedRectPath(ctx, chamberLeft, chamberTop, chamberW, chamberH, 12);
    ctx.strokeStyle = isDark ? '#64748b' : '#334155';
    ctx.lineWidth = 2.6;
    ctx.stroke();

    // Pestaña lateral derecha (agarre de la cámara, referencia clínica)
    ctx.fillStyle = isDark ? '#475569' : '#334155';
    this.roundedRectPath(ctx, chamberRight + 1, liquidTopY - 12, 6, 48, 3);
    ctx.fill();

    // 9. Cabezal superior + boquilla cuentagotas
    this.drawUpperCapAndNozzle(ctx, cx, chamberTop, chamberW, isDark);

    // 10. Base / collarín inferior con anillo luminoso de impacto
    this.drawLowerCollar(ctx, cx, chamberBottom, chamberW, isDark, impactGlow);

    ctx.restore();
  }

  private drawDroplet(
    ctx: CanvasRenderingContext2D,
    cx: number,
    nozzleTipY: number,
    liquidSurfaceY: number,
    phase: number,
    isDark: boolean
  ): void {
    // Duración física realista de la caída libre dentro de la cámara
    const fallDurationMs = Math.min(this.intervalMs * 0.52, 260);
    const fallStartPhase = 1 - fallDurationMs / this.intervalMs;

    const baseRadius = 8.4;

    if (phase < fallStartPhase) {
      // Fase 1: Crecimiento de la gota colgando de la boquilla
      const growT = phase / Math.max(0.001, fallStartPhase);
      const easedGrow = 1 - Math.pow(1 - growT, 2.2);
      const scale = 0.22 + 0.78 * easedGrow;
      const stretch = 1 + Math.max(0, growT - 0.75) * 0.9;

      const r = baseRadius * scale;
      const dropCenterY = nozzleTipY + r * 1.15 * stretch;

      this.paintTeardropShape(ctx, cx, dropCenterY, r, r * 1.38 * stretch, isDark);
    } else {
      // Fase 2: Caída gravitacional acelerada (y = y0 + d * t^2) hasta impactar exactamente en phase=1
      const fallT = (phase - fallStartPhase) / Math.max(0.001, 1 - fallStartPhase);
      const startY = nozzleTipY + baseRadius * 1.25;
      const endY = liquidSurfaceY - baseRadius * 0.4;
      const dropY = startY + (endY - startY) * (fallT * fallT);

      const rx = baseRadius * (1 - 0.14 * fallT);
      const ry = baseRadius * (1.38 + 0.25 * fallT);

      this.paintTeardropShape(ctx, cx, dropY, rx, ry, isDark);
    }
  }

  private paintTeardropShape(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    isDark: boolean
  ): void {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy - ry);
    ctx.bezierCurveTo(
      cx + rx * 0.95,
      cy - ry * 0.15,
      cx + rx,
      cy + ry * 0.45,
      cx,
      cy + ry * 0.72
    );
    ctx.bezierCurveTo(
      cx - rx,
      cy + ry * 0.45,
      cx - rx * 0.95,
      cy - ry * 0.15,
      cx,
      cy - ry
    );
    ctx.closePath();

    const grad = ctx.createRadialGradient(
      cx - rx * 0.25,
      cy - ry * 0.1,
      rx * 0.1,
      cx,
      cy,
      ry * 1.1
    );
    grad.addColorStop(0, '#e0f2fe');
    grad.addColorStop(0.42, '#38bdf8');
    grad.addColorStop(1, '#0284c7');

    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = isDark ? '#7dd3fc' : '#0369a1';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Reflejo especular dentro de la gota
    ctx.beginPath();
    ctx.ellipse(cx - rx * 0.28, cy + ry * 0.08, rx * 0.2, ry * 0.24, -0.25, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
    ctx.fill();
    ctx.restore();
  }

  private drawUpperCapAndNozzle(
    ctx: CanvasRenderingContext2D,
    cx: number,
    chamberTop: number,
    chamberW: number,
    isDark: boolean
  ): void {
    const capW = chamberW + 14;
    const capH = 24;
    const capX = cx - capW / 2;
    const capY = chamberTop - capH + 2;

    // Collar metálico/gris superior
    const capGrad = ctx.createLinearGradient(capX, 0, capX + capW, 0);
    if (isDark) {
      capGrad.addColorStop(0, '#334155');
      capGrad.addColorStop(0.35, '#94a3b8');
      capGrad.addColorStop(0.7, '#475569');
      capGrad.addColorStop(1, '#1e293b');
    } else {
      capGrad.addColorStop(0, '#94a3b8');
      capGrad.addColorStop(0.35, '#f1f5f9');
      capGrad.addColorStop(0.75, '#cbd5e1');
      capGrad.addColorStop(1, '#64748b');
    }

    this.roundedRectPath(ctx, capX, capY, capW, capH, 6);
    ctx.fillStyle = capGrad;
    ctx.fill();
    ctx.strokeStyle = isDark ? '#64748b' : '#334155';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Reborde superior oscuro (tapa de perforación)
    const rimW = capW + 22;
    this.roundedRectPath(ctx, cx - rimW / 2, capY - 7, rimW, 9, 4.5);
    ctx.fillStyle = isDark ? '#1e293b' : '#334155';
    ctx.fill();
    ctx.strokeStyle = isDark ? '#64748b' : '#1e293b';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Conector celeste superior
    this.roundedRectPath(ctx, cx - 18, capY - 11, 36, 5, 2.5);
    ctx.fillStyle = '#38bdf8';
    ctx.fill();

    // Boquilla cuentagotas interna
    this.roundedRectPath(ctx, cx - 11, chamberTop + 1, 22, 11, 4);
    ctx.fillStyle = isDark ? '#64748b' : '#94a3b8';
    ctx.fill();
    ctx.strokeStyle = isDark ? '#94a3b8' : '#334155';
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }

  private drawLowerCollar(
    ctx: CanvasRenderingContext2D,
    cx: number,
    chamberBottom: number,
    chamberW: number,
    isDark: boolean,
    impactGlow: number
  ): void {
    const collarW = chamberW + 4;
    const collarH = 14;
    const collarX = cx - collarW / 2;
    const collarY = chamberBottom - 2;

    // Indicador luminoso expansivo debajo de la base al caer cada gota
    if (impactGlow > 0.01) {
      const expand = (1 - impactGlow) * 18;
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(
        cx,
        collarY + collarH / 2,
        collarW * 0.55 + expand,
        10 + expand * 0.45,
        0,
        0,
        Math.PI * 2
      );
      ctx.strokeStyle = `rgba(14, 165, 233, ${impactGlow * 0.85})`;
      ctx.lineWidth = 2.5 * impactGlow;
      ctx.stroke();
      ctx.restore();
    }

    this.roundedRectPath(ctx, collarX, collarY, collarW, collarH, 5);
    ctx.fillStyle =
      impactGlow > 0.15
        ? isDark
          ? '#0284c7'
          : '#7dd3fc'
        : isDark
          ? '#1e3a5f'
          : '#bae6fd';
    ctx.fill();
    ctx.strokeStyle = isDark ? '#64748b' : '#334155';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Boquilla de salida inferior
    this.roundedRectPath(ctx, cx - 12, collarY + collarH - 1, 24, 10, 3);
    ctx.fillStyle = isDark ? '#475569' : '#cbd5e1';
    ctx.fill();
    ctx.strokeStyle = isDark ? '#64748b' : '#334155';
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }

  private drawLowerTubing(
    ctx: CanvasRenderingContext2D,
    cx: number,
    chamberBottom: number,
    isDark: boolean,
    impactGlow: number
  ): void {
    const startY = chamberBottom + 18;
    const endY = Math.min(this.height - 10, startY + 56);
    const curveShift = 30;

    ctx.save();
    ctx.lineCap = 'round';

    // Borde exterior del tubo
    ctx.beginPath();
    ctx.moveTo(cx, startY);
    ctx.quadraticCurveTo(cx, startY + (endY - startY) * 0.65, cx + curveShift, endY);
    ctx.strokeStyle = isDark ? '#64748b' : '#334155';
    ctx.lineWidth = 15;
    ctx.stroke();

    // Interior translúcido del tubo lleno de suero
    ctx.beginPath();
    ctx.moveTo(cx, startY);
    ctx.quadraticCurveTo(cx, startY + (endY - startY) * 0.65, cx + curveShift, endY);
    ctx.strokeStyle = isDark ? '#0c4a6e' : '#bae6fd';
    ctx.lineWidth = 10.5;
    ctx.stroke();

    // Brillo sutil del flujo al caer gota
    ctx.beginPath();
    ctx.moveTo(cx - 1.5, startY);
    ctx.quadraticCurveTo(
      cx - 1.5,
      startY + (endY - startY) * 0.65,
      cx + curveShift - 1.5,
      endY
    );
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.42 + impactGlow * 0.35})`;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }

  private roundedRectPath(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }
}
