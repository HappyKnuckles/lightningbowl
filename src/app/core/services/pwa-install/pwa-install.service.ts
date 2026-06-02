import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AnalyticsService } from '../analytics/analytics.service';

@Injectable({
  providedIn: 'root',
})
export class PwaInstallService {
  private analyticsService = inject(AnalyticsService);

  private deferredPrompt: any = null;
  private showInstallPromptSubject = new BehaviorSubject<boolean>(false);

  constructor() {
    this.initializeInstallPrompt();
  }

  private initializeInstallPrompt(): void {
    let canShowPrompt = false;
    let shouldShowPrompt = false;
    let interactionCount = 0;
    const requiredInteractions = 3;

    setTimeout(() => {
      canShowPrompt = true;
      if (shouldShowPrompt && !this.isInstallPromptDismissed() && !this.isAppInstalled()) {
        this.showInstallPromptSubject.next(true);
      }
    }, 10000);

    const userInteractionEvents = ['click', 'touch', 'keydown', 'scroll'];
    const onUserInteraction = () => {
      interactionCount++;

      if (interactionCount >= requiredInteractions) {
        canShowPrompt = true;
        if (shouldShowPrompt && !this.isInstallPromptDismissed() && !this.isAppInstalled()) {
          this.showInstallPromptSubject.next(true);
        }
        userInteractionEvents.forEach((event) => {
          document.removeEventListener(event, onUserInteraction);
        });
      }
    };

    userInteractionEvents.forEach((event) => {
      document.addEventListener(event, onUserInteraction);
    });

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();

      this.deferredPrompt = event;

      const isDismissed = this.isInstallPromptDismissed();
      const isInstalled = this.isAppInstalled();

      if (!isDismissed && !isInstalled) {
        if (canShowPrompt) {
          this.showInstallPromptSubject.next(true);
        } else {
          shouldShowPrompt = true;
        }
      }
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.showInstallPromptSubject.next(false);
      sessionStorage.removeItem('pwa-install-dismissed');

      void this.analyticsService.trackAppInstalled();
    });

    if (this.isIOSSafari() && this.isPWAInstallable()) {
      setTimeout(() => {
        const isDismissed = this.isInstallPromptDismissed();
        const isInstalled = this.isAppInstalled();

        if (!isDismissed && !isInstalled) {
          if (canShowPrompt) {
            this.showInstallPromptSubject.next(true);
          } else {
            shouldShowPrompt = true;
          }
        }
      }, 2000);
    }
  }

  canShowInstallPrompt(): Observable<boolean> {
    return this.showInstallPromptSubject.asObservable();
  }

  async triggerInstall(): Promise<boolean> {
    if (!this.deferredPrompt) {
      if (this.isIOSSafari()) {
        this.showInstallPromptSubject.next(false);
        return false;
      }
      return false;
    }

    try {
      this.deferredPrompt.prompt();

      const { outcome } = await this.deferredPrompt.userChoice;

      this.deferredPrompt = null;
      this.showInstallPromptSubject.next(false);

      return outcome === 'accepted';
    } catch (error) {
      console.error('Error during PWA installation:', error);
      return false;
    }
  }

  dismissInstallPrompt(): void {
    sessionStorage.setItem('pwa-install-dismissed', 'true');
    this.showInstallPromptSubject.next(false);
  }

  private isInstallPromptDismissed(): boolean {
    return sessionStorage.getItem('pwa-install-dismissed') === 'true';
  }

  private isAppInstalled(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true; // iOS Safari
  }

  private isIOSSafari(): boolean {
    const userAgent = navigator.userAgent;
    return /iPad|iPhone|iPod/.test(userAgent) && /Safari/.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent); // Exclude Chrome, Firefox, Edge, Opera on iOS
  }

  private isPWAInstallable(): boolean {
    return 'serviceWorker' in navigator && window.location.protocol === 'https:' && document.querySelector('link[rel="manifest"]') !== null;
  }

  isInstallable(): boolean {
    return this.deferredPrompt !== null || this.isIOSSafari();
  }
}
