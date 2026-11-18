import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActiveView } from './core/models/infusion.model';
import {
  MainAppTab,
  PatientFormPayload,
  PatientInfusionRecord,
} from './core/models/shift.model';
import { AudioMetronomeService } from './core/services/audio-metronome.service';
import { InfusionCalculatorService } from './core/services/infusion-calculator.service';
import { MultiPatientNotificationService } from './core/services/multi-patient-notification.service';
import { ShiftManagerService } from './core/services/shift-manager.service';
import { ThemeService } from './core/services/theme.service';
import { ConfigViewComponent } from './features/config-view/config-view.component';
import { ResultsViewComponent } from './features/results-view/results-view.component';
import { PatientDashboardComponent } from './features/shift/patient-dashboard.component';
import { PatientDetailViewComponent } from './features/shift/patient-detail-view.component';
import { PatientFormModalComponent } from './features/shift/patient-form-modal.component';
import { ShiftHandoverComponent } from './features/shift/shift-handover.component';
import { ShiftSetupComponent } from './features/shift/shift-setup.component';
import { HelpModalComponent } from './shared/components/help-modal.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    ShiftSetupComponent,
    PatientDashboardComponent,
    PatientDetailViewComponent,
    PatientFormModalComponent,
    ShiftHandoverComponent,
    ConfigViewComponent,
    ResultsViewComponent,
    HelpModalComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly shiftManager = inject(ShiftManagerService);
  protected readonly multiNotifications = inject(MultiPatientNotificationService);
  protected readonly theme = inject(ThemeService);
  protected readonly calculator = inject(InfusionCalculatorService);
  private readonly audio = inject(AudioMetronomeService);

  protected readonly activeTab = signal<MainAppTab>('dashboard');
  protected readonly selectedPatientId = signal<string | null>(null);
  protected readonly showPatientModal = signal<boolean>(false);
  protected readonly editingPatient = signal<PatientInfusionRecord | null>(null);
  protected readonly showShiftSetupModal = signal<boolean>(false);
  protected readonly showHelp = signal<boolean>(false);
  protected readonly calcActiveView = signal<ActiveView>('config');

  // Formato del tiempo restante de turno en la barra superior fija
  protected readonly formattedShiftRemaining = computed(() => {
    const ms = this.shiftManager.shiftRemainingMs();
    if (ms <= 0) return 'Turno concluido';
    const totalMinutes = Math.floor(ms / 60_000);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    const s = Math.floor((ms % 60_000) / 1000);
    if (h === 0) return `${m}m ${s.toString().padStart(2, '0')}s`;
    return `${h}h ${m.toString().padStart(2, '0')}m`;
  });

  protected readonly formattedShiftEndTime = computed(() => {
    const s = this.shiftManager.activeShift();
    if (!s) return '';
    return new Date(s.endTimeMs).toLocaleTimeString('es', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  });

  protected switchTab(tab: MainAppTab): void {
    this.activeTab.set(tab);
    this.selectedPatientId.set(null);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  protected openAddPatientModal(): void {
    this.audio.unlock();
    this.editingPatient.set(null);
    this.showPatientModal.set(true);
  }

  protected openEditPatientModal(patientId: string): void {
    this.audio.unlock();
    const p = this.shiftManager.patients().find((x) => x.id === patientId) ?? null;
    this.editingPatient.set(p);
    this.showPatientModal.set(true);
  }

  protected onSavePatient(payload: PatientFormPayload): void {
    const existing = this.editingPatient();
    if (existing) {
      this.shiftManager.updatePatient(existing.id, payload);
    } else {
      const created = this.shiftManager.addPatient(payload);
      this.selectedPatientId.set(created.id);
    }
    this.showPatientModal.set(false);
    this.editingPatient.set(null);
  }

  protected onSelectPatient(patientId: string): void {
    this.audio.unlock();
    this.selectedPatientId.set(patientId);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  protected onShiftFinished(): void {
    this.activeTab.set('dashboard');
    this.selectedPatientId.set(null);
    this.showShiftSetupModal.set(false);
  }

  protected openCalcResults(): void {
    this.audio.unlock();
    if (this.calculator.isValid()) {
      this.calcActiveView.set('results');
    }
  }

  protected openCalcConfig(): void {
    this.calcActiveView.set('config');
  }

  protected cycleTheme(): void {
    this.theme.cycleMode();
  }

  protected themeLabel(): string {
    switch (this.theme.mode()) {
      case 'auto':
        return 'Auto';
      case 'dark':
        return 'Oscuro';
      case 'light':
        return 'Claro';
    }
  }
}
