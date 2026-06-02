import { Injectable, signal, inject } from '@angular/core';
import { fromEvent, merge } from 'rxjs';
import { map, pairwise, startWith } from 'rxjs/operators';
import { ToastService } from '../toast/toast.service';

@Injectable({
  providedIn: 'root',
})
export class NetworkService {
  private toastService = inject(ToastService);

  private _isOnline = signal<boolean>(navigator.onLine);

  get isOnline() {
    return this._isOnline();
  }

  get isOffline() {
    return !this._isOnline();
  }

  constructor() {
    // Listen for online/offline events
    merge(fromEvent(window, 'online').pipe(map(() => true)), fromEvent(window, 'offline').pipe(map(() => false)))
      .pipe(startWith(navigator.onLine), pairwise())
      .subscribe(([previous, current]) => {
        this._isOnline.set(current);
        if (current && !previous) {
          this.toastService.showToast('You are back online!', 'information-circle-outline');
        } else {
          this.toastService.showToast('You are offline. Some features may not be available.', 'information-circle-outline');
        }
      });
  }
}
