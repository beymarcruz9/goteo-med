import { Injectable, effect, signal } from '@angular/core';
import { ThemeMode } from '../models/infusion.model';

const THEME_STORAGE_KEY = 'goteomed_theme';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly mediaQuery =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;

  readonly mode = signal<ThemeMode>(this.loadInitialMode());
  readonly isDark = signal<boolean>(false);

  constructor() {
    this.syncDocumentTheme(this.mode());

    effect(() => {
      const currentMode = this.mode();
      this.syncDocumentTheme(currentMode);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, currentMode);
      } catch {
        // Sin acción
      }
    });

    if (this.mediaQuery) {
      const listener = () => {
        if (this.mode() === 'auto') {
          this.syncDocumentTheme('auto');
        }
      };
      this.mediaQuery.addEventListener('change', listener);
    }
  }

  cycleMode(): void {
    const order: ThemeMode[] = ['auto', 'light', 'dark'];
    const currentIdx = order.indexOf(this.mode());
    const next = order[(currentIdx + 1) % order.length];
    this.mode.set(next);
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
  }

  private loadInitialMode(): ThemeMode {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'light' || saved === 'dark' || saved === 'auto') {
        return saved;
      }
    } catch {
      // Sin acción
    }
    return 'auto';
  }

  private syncDocumentTheme(mode: ThemeMode): void {
    const systemDark = this.mediaQuery ? this.mediaQuery.matches : false;
    const dark = mode === 'dark' || (mode === 'auto' && systemDark);
    this.isDark.set(dark);

    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', dark);
    }
  }
}
