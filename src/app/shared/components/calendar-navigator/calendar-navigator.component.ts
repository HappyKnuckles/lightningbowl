import { Component } from '@angular/core';
import { IonSegment, IonSegmentButton, IonLabel, IonButtons, IonButton, IonIcon, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronBackOutline, chevronForwardOutline } from 'ionicons/icons';
import { CalendarMode, GameFilterService } from 'src/app/core/services/game-filter/game-filter.service';

@Component({
  selector: 'app-calendar-navigator',
  templateUrl: './calendar-navigator.component.html',
  styleUrls: ['./calendar-navigator.component.scss'],
  standalone: true,
  imports: [IonSegment, IonSegmentButton, IonLabel, IonButtons, IonButton, IonIcon, IonTitle, IonToolbar],
})
export class CalendarNavigatorComponent {
  constructor(public gameFilterService: GameFilterService) {
    addIcons({ chevronBackOutline, chevronForwardOutline });
  }

  onModeChange(event: Event): void {
    const mode = (event as CustomEvent).detail.value as CalendarMode;
    this.gameFilterService.setCalendarMode(mode);
  }

  prevPeriod(): void {
    this.gameFilterService.prevPeriod();
  }

  nextPeriod(): void {
    this.gameFilterService.nextPeriod();
  }
}
