import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Injectable({
  providedIn: 'root',
})
export class LanguageService {
  readonly supportedLanguages = ['en', 'de', 'es', 'zh'];
  readonly defaultLanguage = 'en';

  constructor(private translate: TranslateService) {}

  initialize(): void {
    const saved = localStorage.getItem('language');
    if (saved && this.supportedLanguages.includes(saved)) {
      this.setLanguage(saved);
      return;
    }
    const deviceLang = navigator.language?.split('-')[0];
    const lang = this.supportedLanguages.includes(deviceLang) ? deviceLang : this.defaultLanguage;
    this.setLanguage(lang);
  }

  setLanguage(lang: string): void {
    if (this.supportedLanguages.includes(lang)) {
      this.translate.use(lang);
      localStorage.setItem('language', lang);
    }
  }

  getCurrentLanguage(): string {
    return this.translate.currentLang || this.defaultLanguage;
  }
}
