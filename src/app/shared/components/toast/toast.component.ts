import { Component, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { IonToast } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import * as allIcons from 'ionicons/icons';
import { NgStyle } from '@angular/common';

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
  imports: [IonToast, NgStyle],
})
export class ToastComponent implements OnDestroy {
  activeToasts: ToastData[] = [];
  private toastQueue: ToastData[] = [];
  private nextId = 1;
  private toastSubscription: Subscription;
  private readonly MAX_ACTIVE = 5;
  readonly TOAST_DURATION = 3000;

  private readonly GAP = 8;
  private heights = new Map<number, number>();

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

  onToastDidPresent(id: number, ev: Event) {
    const el = ev.target as HTMLElement;
    const wrapper = el.shadowRoot?.querySelector('.toast-wrapper') as HTMLElement | null;
    if (wrapper) {
      this.heights.set(id, wrapper.clientHeight);
    }
  }

  getOffset(index: number): number {
    let offset = 0;
    for (let j = 0; j < index; j++) {
      const t = this.activeToasts[j];
      const h = this.heights.get(t.id) ?? this.estimateHeight(t.message);
      offset += h + this.GAP;
    }
    return offset;
  }

  private estimateHeight(message: string): number {
    return message.length > 60 ? 80 : 60;
  }

  onToastDidDismiss(dismissedId: number) {
    this.activeToasts = this.activeToasts.filter((t) => t.id !== dismissedId);
    this.heights.delete(dismissedId);

    if (this.toastQueue.length > 0) {
      const next = this.toastQueue.shift()!;
      this.activeToasts.push(next);
    }
  }

  ngOnDestroy(): void {
    this.toastSubscription.unsubscribe();
  }
}
