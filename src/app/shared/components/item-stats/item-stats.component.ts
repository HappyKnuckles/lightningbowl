import { Component, input, signal } from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonImg,
  IonList,
  IonListHeader,
  IonModal,
  IonRippleEffect,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronBack, chevronForwardOutline } from 'ionicons/icons';
import { NgIf } from '@angular/common';
import { GenericItemStats } from 'src/app/core/models/stats.model';
import { BallsStore } from 'src/app/core/stores/balls.store';

@Component({
  selector: 'app-item-stats',
  standalone: true,
  imports: [
    IonList,
    IonListHeader,
    IonImg,
    IonRippleEffect,
    IonIcon,
    IonModal,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    NgIf,
  ],
  templateUrl: './item-stats.component.html',
  styleUrl: './item-stats.component.scss',
})
export class ItemStatsComponent {
  item = input.required<GenericItemStats>();
  title = input.required<string>();
  totalGames = input.required<number>();
  imageUrlBase = input<string>();
  emptyMessage = input<string>('No data saved.');
  roundImage = input<boolean>(true);
  allItems = input<GenericItemStats[]>();

  isModalOpen = signal(false);

  constructor(public ballsStore: BallsStore) {
    addIcons({ chevronForwardOutline, chevronBack });
  }

  openModal(): void {
    if (this.allItems()?.length) {
      this.isModalOpen.set(true);
    }
  }

  closeModal(): void {
    this.isModalOpen.set(false);
  }
}
