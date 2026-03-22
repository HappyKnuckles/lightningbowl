import { Component, ViewChild } from '@angular/core';
import {
  IonButtons,
  IonButton,
  IonIcon,
  IonToolbar,
  IonModal,
  IonDatetime,
  IonHeader,
  IonTitle,
  IonContent,
  IonRippleEffect,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronBackOutline, chevronForwardOutline } from 'ionicons/icons';
import { GameFilterService } from 'src/app/core/services/game-filter/game-filter.service';

const SWIPE_THRESHOLD_PX = 50;

@Component({
  selector: 'app-calendar-navigator',
  templateUrl: './calendar-navigator.component.html',
  styleUrls: ['./calendar-navigator.component.scss'],
  standalone: true,
  imports: [IonButtons, IonButton, IonIcon, IonToolbar, IonModal, IonDatetime, IonHeader, IonTitle, IonContent, IonRippleEffect],
})
export class CalendarNavigatorComponent {
  @ViewChild('datePickerModal') datePickerModal?: IonModal;

  private touchStartX = 0;

  constructor(public gameFilterService: GameFilterService) {
    addIcons({ chevronBackOutline, chevronForwardOutline });
  }

  prevPeriod(): void {
    this.gameFilterService.prevPeriod();
  }

  nextPeriod(): void {
    this.gameFilterService.nextPeriod();
  }

  openDatePicker(): void {
    if (this.gameFilterService.calendarMode() !== 'overall') {
      this.datePickerModal?.present();
    }
  }

  onDatePickerChange(event: Event): void {
    const value = (event as CustomEvent).detail.value as string;
    if (value) {
      this.gameFilterService.goToPeriodContaining(new Date(value));
      this.datePickerModal?.dismiss();
    }
  }

  get datePickerPresentation(): 'date' | 'month-year' | 'year' {
    switch (this.gameFilterService.calendarMode()) {
      case 'monthly':
        return 'month-year';
      case 'yearly':
        return 'year';
      default:
        return 'date';
    }
  }

  get todayIso(): string {
    return new Date().toISOString();
  }

  get currentPeriodIso(): string {
    return this.gameFilterService.calendarDateRange().start.toISOString();
  }

  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.touches[0].clientX;
  }

  onTouchEnd(event: TouchEvent): void {
    const deltaX = event.changedTouches[0].clientX - this.touchStartX;
    if (Math.abs(deltaX) > SWIPE_THRESHOLD_PX) {
      if (deltaX > 0) {
        this.prevPeriod();
      } else {
        this.nextPeriod();
      }
    }
  }
}
