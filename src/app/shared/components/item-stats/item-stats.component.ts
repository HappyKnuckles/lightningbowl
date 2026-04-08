import { Component, input } from '@angular/core';
import { IonImg, IonList, IonListHeader } from '@ionic/angular/standalone';
import { GenericItemStats } from 'src/app/core/models/stats.model';
import { BallsStore } from 'src/app/core/stores/balls.store';

@Component({
  selector: 'app-item-stats',
  standalone: true,
  imports: [IonList, IonListHeader, IonImg],
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

  constructor(public ballsStore: BallsStore) {}
}
