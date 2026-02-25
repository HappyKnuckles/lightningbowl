import { Injectable, signal } from '@angular/core';
import { fromEvent, merge } from 'rxjs';
import { map } from 'rxjs/operators';
import { ToastService } from '../toast/toast.service';

@Injectable({
  providedIn: 'root',
})
export class NetworkService {
  private _isOnline = signal<boolean>(navigator.onLine);

  get isOnline() {
    return this._isOnline();
  }

  get isOffline() {
    return !this._isOnline();
  }

  constructor(private toastService: ToastService) {
    // Listen for online/offline events
    merge(fromEvent(window, 'online').pipe(map(() => true)), fromEvent(window, 'offline').pipe(map(() => false))).subscribe((isOnline) => {
      const wasOnline = this._isOnline();
      this._isOnline.set(isOnline);
      if (isOnline && !wasOnline) {
        this.toastService.showToast('You are back online!', 'information-circle-outline');
      } else if (!isOnline && wasOnline) {
        this.toastService.showToast('You are offline. Some features may not be available.', 'information-circle-outline');
      }
    });
  }
}
