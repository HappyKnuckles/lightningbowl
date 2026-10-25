import { Component, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { IonToast } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  add,
  alertCircle,
  alertCircleOutline,
  bug,
  bugOutline,
  checkmark,
  checkmarkCircle,
  checkmarkOutline,
  clipboardOutline,
  cloudOfflineOutline,
  eyeOutline,
  heart,
  heartOutline,
  informationCircleOutline,
  locateOutline,
  refreshOutline,
  reloadOutline,
  removeOutline,
  searchOutline,
  shareSocialOutline,
  warning,
} from 'ionicons/icons';
import { NgStyle } from '@angular/common';

const TOAST_ICONS = {
  add,
  alertCircle,
  alertCircleOutline,
  bug,
  bugOutline,
  checkmark,
  checkmarkCircle,
  checkmarkOutline,
  clipboardOutline,
  cloudOfflineOutline,
  eyeOutline,
  heart,
  heartOutline,
  informationCircleOutline,
  locateOutline,
  refreshOutline,
  reloadOutline,
  removeOutline,
  searchOutline,
  shareSocialOutline,
  warning,
};

const toKebabCase = (name: string): string => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

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

  private readonly registeredIcons = new Set(Object.keys(TOAST_ICONS).map(toKebabCase));

  constructor(private toastService: ToastService) {
    addIcons(TOAST_ICONS);

    this.toastSubscription = this.toastService.toastState$.subscribe((raw) => {
      void this.ensureIconRegistered(raw.icon).then(() => {
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
    });
  }

  ngOnDestroy(): void {
    this.toastSubscription.unsubscribe();
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

  onToastDidDismiss(dismissedId: number) {
    this.activeToasts = this.activeToasts.filter((t) => t.id !== dismissedId);
    this.heights.delete(dismissedId);

    if (this.toastQueue.length > 0) {
      const next = this.toastQueue.shift()!;
      this.activeToasts.push(next);
    }
  }

  private async ensureIconRegistered(icon: string): Promise<void> {
    if (!icon || this.registeredIcons.has(icon)) {
      return;
    }

    try {
      const allIcons = (await import('ionicons/icons')) as unknown as Record<string, string>;
      const match = Object.keys(allIcons).find((key) => toKebabCase(key) === icon);
      if (match) {
        addIcons({ [match]: allIcons[match] });
      }
    } catch (error) {
      console.error('Failed to load toast icon:', icon, error);
    } finally {
      this.registeredIcons.add(icon);
    }
  }

  private estimateHeight(message: string): number {
    return message.length > 60 ? 80 : 60;
  }
}
