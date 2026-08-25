import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { AnalyticsService } from 'src/app/core/services/analytics/analytics.service';
import { createSpyObj, SpyObj } from 'src/testing/spy-obj';
import { vi } from 'vitest';

import { PwaInstallService } from './pwa-install.service';

/** The install event Chromium fires, with the two members the service uses. */
function beforeInstallPromptEvent(outcome: 'accepted' | 'dismissed' = 'accepted', prompt = vi.fn()): Event {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome }) });
  return event;
}

describe('PwaInstallService', () => {
  let service: PwaInstallService;
  let analyticsService: SpyObj<AnalyticsService>;

  /** Three interactions unlock the prompt before the 10s timer would. */
  function interactThreeTimes(): void {
    for (let i = 0; i < 3; i++) {
      document.dispatchEvent(new Event('click'));
    }
  }

  function createService(): PwaInstallService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: AnalyticsService, useValue: analyticsService }],
    });
    return TestBed.inject(PwaInstallService);
  }

  beforeEach(() => {
    sessionStorage.removeItem('pwa-install-dismissed');
    analyticsService = createSpyObj<AnalyticsService>(['trackAppInstalled']);
    analyticsService.trackAppInstalled.mockResolvedValue(undefined);
    service = createService();
  });

  afterEach(() => {
    sessionStorage.removeItem('pwa-install-dismissed');
  });

  describe('canShowInstallPrompt', () => {
    it('starts hidden', async () => {
      await expect(firstValueFrom(service.canShowInstallPrompt())).resolves.toBe(false);
    });

    it('shows the prompt once the browser offers it and the user has settled in', async () => {
      interactThreeTimes();

      window.dispatchEvent(beforeInstallPromptEvent());

      await expect(firstValueFrom(service.canShowInstallPrompt())).resolves.toBe(true);
    });

    it('waits for the user to settle in before showing an early offer', async () => {
      window.dispatchEvent(beforeInstallPromptEvent());

      expect(await firstValueFrom(service.canShowInstallPrompt())).toBe(false);

      interactThreeTimes();

      await expect(firstValueFrom(service.canShowInstallPrompt())).resolves.toBe(true);
    });

    it('stays hidden when the prompt was dismissed this session', async () => {
      sessionStorage.setItem('pwa-install-dismissed', 'true');
      service = createService();
      interactThreeTimes();

      window.dispatchEvent(beforeInstallPromptEvent());

      await expect(firstValueFrom(service.canShowInstallPrompt())).resolves.toBe(false);
    });
  });

  describe('isInstallable', () => {
    it('is false before the browser offers an install', () => {
      expect(service.isInstallable()).toBe(false);
    });

    it('is true once the browser has offered one', () => {
      window.dispatchEvent(beforeInstallPromptEvent());

      expect(service.isInstallable()).toBe(true);
    });
  });

  describe('triggerInstall', () => {
    it('does nothing without a stored install offer', async () => {
      await expect(service.triggerInstall()).resolves.toBe(false);
    });

    it('prompts and reports an accepted install', async () => {
      const prompt = vi.fn();
      window.dispatchEvent(beforeInstallPromptEvent('accepted', prompt));

      await expect(service.triggerInstall()).resolves.toBe(true);
      expect(prompt).toHaveBeenCalled();
      await expect(firstValueFrom(service.canShowInstallPrompt())).resolves.toBe(false);
    });

    it('reports a declined install', async () => {
      window.dispatchEvent(beforeInstallPromptEvent('dismissed'));

      await expect(service.triggerInstall()).resolves.toBe(false);
    });

    it('consumes the offer, so a second call does nothing', async () => {
      window.dispatchEvent(beforeInstallPromptEvent());
      await service.triggerInstall();

      await expect(service.triggerInstall()).resolves.toBe(false);
    });

    it('survives a browser that throws while prompting', async () => {
      const prompt = vi.fn(() => {
        throw new Error('prompt unavailable');
      });
      window.dispatchEvent(beforeInstallPromptEvent('accepted', prompt));

      await expect(service.triggerInstall()).resolves.toBe(false);
    });
  });

  describe('dismissInstallPrompt', () => {
    it('hides the prompt and remembers the dismissal for the session', async () => {
      interactThreeTimes();
      window.dispatchEvent(beforeInstallPromptEvent());

      service.dismissInstallPrompt();

      expect(sessionStorage.getItem('pwa-install-dismissed')).toBe('true');
      await expect(firstValueFrom(service.canShowInstallPrompt())).resolves.toBe(false);
    });
  });

  describe('appinstalled', () => {
    it('hides the prompt, clears the dismissal and tracks the install', async () => {
      interactThreeTimes();
      window.dispatchEvent(beforeInstallPromptEvent());

      window.dispatchEvent(new Event('appinstalled'));

      await expect(firstValueFrom(service.canShowInstallPrompt())).resolves.toBe(false);
      expect(sessionStorage.getItem('pwa-install-dismissed')).toBeNull();
      expect(analyticsService.trackAppInstalled).toHaveBeenCalled();
      expect(service.isInstallable()).toBe(false);
    });
  });
});
