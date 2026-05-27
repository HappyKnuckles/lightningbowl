import { NgFor, NgStyle } from '@angular/common';
import { Component, OnDestroy } from '@angular/core';
import { IonToast } from '@ionic/angular/standalone';
import { ToastService } from '@services/toast/toast.service';
import { addIcons } from 'ionicons';
import * as allIcons from 'ionicons/icons';
import { Subscription } from 'rxjs';

interface ToastData {
  id: number;
  message: string;
  icon: string;
  isError?: boolean;
}

@Component({
  selector: 'app-toast',
  templateUrl: './toast.component.html',
  styleUrls: ['./toast.component.scss'],
  imports: [IonToast, NgFor, NgStyle],
})
export class ToastComponent implements OnDestroy {
  activeToasts: ToastData[] = [];
  private toastQueue: ToastData[] = [];
  private nextId = 1;
  private toastSubscription: Subscription;
  private readonly MAX_ACTIVE = 5;
  readonly TOAST_DURATION = 3000;

  constructor(private toastService: ToastService) {
    this.toastSubscription = this.toastService.toastState$.subscribe((raw) => {
      const newToast: ToastData = {
        id: this.nextId++,
        message: raw.message,
        icon: raw.icon,
        isError: raw.error ?? false,
      };

      if (this.activeToasts.length < this.MAX_ACTIVE) {
        this.activeToasts.push(newToast);
      } else {
        this.toastQueue.push(newToast);
      }
    });

    addIcons(allIcons);
  }

  /**
   * Called whenever an individual IonToast’s (didDismiss) event fires.
   * Remove the toast from activeToasts, then immediately pull one from the queue (if any).
   */
  onToastDidDismiss(dismissedId: number) {
    this.activeToasts = this.activeToasts.filter((t) => t.id !== dismissedId);

    if (this.toastQueue.length > 0) {
      const next = this.toastQueue.shift()!;
      this.activeToasts.push(next);
    }
  }

  getMarginAccordingToTextLength(message: string) {
    return message.length > 60 ? 80 : 60;
  }

  ngOnDestroy(): void {
    this.toastSubscription.unsubscribe();
  }
}
