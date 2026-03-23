import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SettingsStore {
  #pinInputMode = signal<boolean>(true);

  get pinInputMode() {
    return this.#pinInputMode;
  }

  loadPinInputMode(): void {
    const mode = localStorage.getItem('pin-input-mode');
    const pinInputMode = mode === null ? true : mode === 'hit';
    this.#pinInputMode.set(pinInputMode);
  }

  savePinInputMode(pinMode: string): void {
    this.#pinInputMode.set(pinMode === 'hit');
    const mode = pinMode === 'hit' ? 'hit' : 'missing';
    localStorage.setItem('pin-input-mode', mode);
  }
}
