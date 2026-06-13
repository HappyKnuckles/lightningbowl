import { Component, computed, input, signal } from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonImg,
  IonList,
  IonModal,
  IonRippleEffect,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronBack, chevronForwardOutline } from 'ionicons/icons';
import { GenericItemStats } from 'src/app/core/models/stats.model';
import { BallsStore } from 'src/app/core/stores/balls.store';

@Component({
  selector: 'app-stat-highlight-item',
  standalone: true,
  imports: [IonList, IonImg, IonRippleEffect, IonIcon, IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent],
  templateUrl: './stat-highlight-item.component.html',
  styleUrl: './stat-highlight-item.component.scss',
})
export class StatHighlightItemComponent {
  item = input.required<GenericItemStats>();
  title = input.required<string>();
  totalGames = input.required<number>();
  imageUrlBase = input<string>();
  emptyMessage = input<string>('No data saved.');
  roundImage = input<boolean>(true);
  allItems = input<GenericItemStats[]>();

  isModalOpen = signal(false);
  sortMode = signal<'score' | 'plays'>('score');
  sortedItems = computed(() => {
    const items = this.allItems() ?? [];

    switch (this.sortMode()) {
      case 'plays':
        return [...items].sort((a, b) => b.gameCount - a.gameCount);

      case 'score':
      default:
        return [...items].sort((a, b) => b.avg - a.avg);
    }
  });
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
