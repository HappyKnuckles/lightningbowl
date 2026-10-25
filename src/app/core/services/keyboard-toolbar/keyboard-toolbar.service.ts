import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { Keyboard } from '@capacitor/keyboard';
import { Platform } from '@ionic/angular';
import type { PluginListenerHandle } from '@capacitor/core';

@Injectable()
export class KeyboardToolbarService {
  private platform = inject(Platform);

  private keyboardOpen = signal(false);
  private offset = signal(0);
  private landscape = signal(false);
  private focused = signal(false);

  readonly state = computed(() => ({
    show: this.keyboardOpen() && this.focused(),
    offset: this.keyboardOpen() ? this.offset() : 0,
  }));

  private handles: PluginListenerHandle[] = [];
  private accessoryBarHidden = false;

  constructor() {
    void this.init();
    inject(DestroyRef).onDestroy(() => this.teardown());
  }

  setFocused(value: boolean): void {
    this.focused.set(value);
  }

  private async init(): Promise<void> {
    if (this.isNative()) {
      try {
        await Keyboard.setAccessoryBarVisible({ isVisible: false });
        this.accessoryBarHidden = true;
      } catch {
        // Older iOS versions and non-iOS platforms reject this — not fatal.
      }

      this.handles.push(
        await Keyboard.addListener('keyboardWillShow', () => this.keyboardOpen.set(true)),
        await Keyboard.addListener('keyboardWillHide', () => this.keyboardOpen.set(false)),
      );
    } else if ('visualViewport' in window && window.visualViewport) {
      window.visualViewport.addEventListener('resize', this.onViewportResize);
    }

    const sub = this.platform.resize.subscribe(() => this.landscape.set(this.platform.isLandscape()));
    inject(DestroyRef).onDestroy(() => sub.unsubscribe());
  }

  private isNative(): boolean {
    return this.platform.is('mobile') && !this.platform.is('mobileweb');
  }

  private onViewportResize = (): void => {
    if (!window.visualViewport) return;
    const kbHeight = window.innerHeight - window.visualViewport.height;
    if (kbHeight > 100) {
      this.offset.set(Math.max(0, kbHeight - (this.landscape() ? 72 : 85)));
      this.keyboardOpen.set(true);
    } else {
      this.keyboardOpen.set(false);
    }
  };

  private teardown(): void {
    this.handles.forEach((h) => h.remove());
    if (this.accessoryBarHidden) {
      void Keyboard.setAccessoryBarVisible({ isVisible: true }).catch(() => undefined);
    }
    if ('visualViewport' in window && window.visualViewport) {
      window.visualViewport.removeEventListener('resize', this.onViewportResize);
    }
  }
}
