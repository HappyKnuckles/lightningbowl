import { Component, computed, input, signal } from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonModal,
  IonRippleEffect,
  IonTitle,
  IonToolbar,
  IonText,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronBack, chevronForwardOutline } from 'ionicons/icons';
import { LeaveStats } from 'src/app/core/models/stats.model';
import { getRateColor } from 'src/app/core/utils/stat-utils/stat.utils';

import { PinDeckComponent } from '../pin-deck/pin-deck.component';

/** A leave card, with its numbers already formatted and coloured. */
interface LeaveRowVm extends LeaveStats {
  pickupColor: string;
  pickupText: string;
}

@Component({
  selector: 'app-stat-pin-leave',
  imports: [IonText, PinDeckComponent, IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonContent, IonRippleEffect],
  templateUrl: './stat-pin-leave.component.html',
  styleUrl: './stat-pin-leave.component.scss',
})
export class StatPinLeaveComponent {
  leaveStats = input.required<LeaveStats[]>();
  title = input<string>('Pin Leaves');
  allLeaves = input<LeaveStats[]>();

  readonly leaveRows = computed<LeaveRowVm[]>(() => this.leaveStats().map(toRowVm));

  readonly sortedAllLeaves = computed<LeaveRowVm[]>(() => {
    const leaves = this.allLeaves();
    if (!leaves) return [];
    return [...leaves].sort((a, b) => b.occurrences - a.occurrences).map(toRowVm);
  });

  isModalOpen = signal(false);

  constructor() {
    addIcons({ chevronBack, chevronForwardOutline });
  }

  openModal(): void {
    if (this.allLeaves()?.length) {
      this.isModalOpen.set(true);
    }
  }

  closeModal(): void {
    this.isModalOpen.set(false);
  }
}

function toRowVm(leave: LeaveStats): LeaveRowVm {
  return { ...leave, pickupText: leave.pickupPercentage.toFixed(0), pickupColor: getRateColor(leave.pickupPercentage) };
}
