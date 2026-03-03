import { Injectable, signal } from '@angular/core';
import { fromEvent, merge } from 'rxjs';
import { map, pairwise, startWith } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
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

  constructor(
    private toastService: ToastService,
    private translate: TranslateService,
  ) {
    // Listen for online/offline events
    merge(fromEvent(window, 'online').pipe(map(() => true)), fromEvent(window, 'offline').pipe(map(() => false)))
      .pipe(startWith(navigator.onLine), pairwise())
      .subscribe(([previous, current]) => {
        this._isOnline.set(current);
        if (current && !previous) {
          this.toastService.showToast(this.translate.instant('TOAST.BACK_ONLINE'), 'information-circle-outline');
        } else {
          this.toastService.showToast(this.translate.instant('TOAST.OFFLINE'), 'information-circle-outline');
        }
      });
  }
}
