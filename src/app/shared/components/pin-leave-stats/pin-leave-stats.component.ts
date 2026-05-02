import { Component, computed, input, signal } from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonModal,
  IonRippleEffect,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronBack, chevronForwardOutline } from 'ionicons/icons';
import { LeaveStats } from 'src/app/core/models/stats.model';
import { PinDeckComponent } from '../pin-deck/pin-deck.component';

@Component({
  selector: 'app-pin-leave-stats',
  imports: [
    IonList,
    IonListHeader,
    IonItem,
    IonLabel,
    PinDeckComponent,
    IonModal,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent,
    IonRippleEffect,
  ],
  templateUrl: './pin-leave-stats.component.html',
  styleUrl: './pin-leave-stats.component.scss',
})
export class PinLeaveStatsComponent {
  leaveStats = input.required<LeaveStats[]>();
  title = input<string>('Pin Leaves');
  allLeaves = input<LeaveStats[]>();

  isModalOpen = signal(false);

  sortedAllLeaves = computed(() => {
    const leaves = this.allLeaves();
    if (!leaves) return [];
    return [...leaves].sort((a, b) => b.occurrences - a.occurrences);
  });

  constructor() {
    addIcons({ chevronBack, chevronForwardOutline });
  }

  openModal(): void {
    if (this.allLeaves()) {
      this.isModalOpen.set(true);
    }
  }

  closeModal(): void {
    this.isModalOpen.set(false);
  }

  getPickupColor(conversionRate: number): string {
    if (conversionRate > 95) {
      return '#4faeff';
    } else if (conversionRate > 75) {
      return '#008000';
    } else if (conversionRate > 50) {
      return '#809300';
    } else if (conversionRate > 33) {
      return '#FFA500';
    } else {
      return '#FF0000';
    }
  }
}
