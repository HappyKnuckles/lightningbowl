import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  private toastSubject = new Subject<{
    error?: boolean;
    icon: string;
    message: string;
  }>();
  toastState$ = this.toastSubject.asObservable();

  showToast(message: string, icon: string, error?: boolean): void {
    this.toastSubject.next({ message, icon, error });
  }
}
