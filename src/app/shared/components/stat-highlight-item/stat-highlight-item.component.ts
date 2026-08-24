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
import { HighlightItemStats } from 'src/app/core/models/stats.model';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { ItemSortMode, sortGenericItems } from 'src/app/core/utils/sort-utils/sort.utils';

@Component({
  selector: 'app-stat-highlight-item',
  standalone: true,
  imports: [IonList, IonImg, IonRippleEffect, IonIcon, IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent],
  templateUrl: './stat-highlight-item.component.html',
  styleUrl: './stat-highlight-item.component.scss',
})
export class StatHighlightItemComponent {
  item = input.required<HighlightItemStats>();
  title = input.required<string>();
  totalGames = input.required<number>();
  imageUrlBase = input<string>();
  emptyMessage = input<string>('No data saved.');
  roundImage = input<boolean>(true);
  allItems = input<HighlightItemStats[]>();
  sortMode = input<ItemSortMode>('gameCount');
  allItemsSorted = computed(() => {
    const items = this.allItems();
    return items && sortGenericItems(items, this.sortMode());
  });
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
