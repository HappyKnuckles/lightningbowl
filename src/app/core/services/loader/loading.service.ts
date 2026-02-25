import { Injectable, NgZone, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class LoadingService {
  private readonly LOADING_TIMEOUT_MS = 10000;
  private loadingTimeoutRef?: ReturnType<typeof setTimeout>;

  #isLoading = signal<boolean>(false);
  get isLoading() {
    return this.#isLoading;
  }

  constructor(private ngZone: NgZone) {}

  setLoading(isLoading: boolean): void {
    if (this.loadingTimeoutRef) {
      clearTimeout(this.loadingTimeoutRef);
      this.loadingTimeoutRef = undefined;
    }
    if (isLoading) {
      // Safety timeout: auto-clear loading state to prevent permanent stuck overlays
      this.loadingTimeoutRef = setTimeout(() => {
        this.ngZone.run(() => this.#isLoading.set(false));
      }, this.LOADING_TIMEOUT_MS);
    }
    this.#isLoading.set(isLoading);
  }
}
