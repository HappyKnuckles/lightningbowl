import { Component, input } from '@angular/core';
import { IonItem, IonLabel, IonList, IonListHeader } from '@ionic/angular/standalone';
import { PinDeckComponent } from '../pin-deck/pin-deck.component';
import { LeaveStats } from 'src/app/core/models/stats.model';

@Component({
  selector: 'app-pin-leave-stats',
  imports: [IonList, IonListHeader, IonItem, IonLabel, PinDeckComponent],
  templateUrl: './pin-leave-stats.component.html',
  styleUrl: './pin-leave-stats.component.scss',
})
export class PinLeaveStatsComponent {
  leaveStats = input.required<LeaveStats[]>();
  title = input<string>('Pin Leaves');

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
