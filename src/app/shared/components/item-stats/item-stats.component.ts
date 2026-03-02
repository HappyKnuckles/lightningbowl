import { Component, input } from '@angular/core';
import { GenericItemStats } from 'src/app/core/models/stats.model';
import { IonImg, IonListHeader, IonList } from '@ionic/angular/standalone';
import { StorageService } from 'src/app/core/services/storage/storage.service';

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

  constructor(public storageService: StorageService) { }
}
