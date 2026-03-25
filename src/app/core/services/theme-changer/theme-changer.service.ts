import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ThemeChangerService {
  private readonly defaultTheme = 'Gray';

  saveColorTheme(theme: string): void {
    const previousTheme = this.getCurrentTheme().toLowerCase();
    localStorage.setItem('theme', theme);
    this.applyTheme(theme, previousTheme);
  }

  applyTheme(newTheme: string, previousTheme?: string): void {
    const currentTheme = newTheme.toLowerCase();

    if (previousTheme) {
      document.documentElement.classList.remove(previousTheme);
    }

    document.documentElement.classList.add(currentTheme);
  }

  getCurrentTheme(): string {
    return localStorage.getItem('theme') || this.defaultTheme;
  }
}
