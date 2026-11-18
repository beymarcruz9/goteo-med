import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActiveView } from './core/models/infusion.model';
import { AudioMetronomeService } from './core/services/audio-metronome.service';
import { InfusionCalculatorService } from './core/services/infusion-calculator.service';
import { NotificationService } from './core/services/notification.service';
import { ThemeService } from './core/services/theme.service';
import { ConfigViewComponent } from './features/config-view/config-view.component';
import { ResultsViewComponent } from './features/results-view/results-view.component';
import { HelpModalComponent } from './shared/components/help-modal.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ConfigViewComponent, ResultsViewComponent, HelpModalComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly calculator = inject(InfusionCalculatorService);
  protected readonly theme = inject(ThemeService);
  protected readonly notifications = inject(NotificationService);
  private readonly audio = inject(AudioMetronomeService);

  protected readonly activeView = signal<ActiveView>('config');
  protected readonly showHelp = signal<boolean>(false);

  protected openResults(): void {
    this.audio.unlock();
    if (this.calculator.isValid()) {
      this.activeView.set('results');
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }

  protected openConfig(): void {
    this.activeView.set('config');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
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
