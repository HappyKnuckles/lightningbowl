import { Component, computed, input } from '@angular/core';
import { ItemSortMode, sortGenericItems } from 'src/app/core/utils/sort-utils/sort.utils';
import { StatHighlightItemComponent } from '../stat-highlight-item/stat-highlight-item.component';
import { HighlightItemStats } from 'src/app/core/models/stats.model';

@Component({
  selector: 'app-stat-ball',
  standalone: true,
  imports: [StatHighlightItemComponent],
  templateUrl: './stat-ball.component.html',
})
export class StatBallComponent {
  bestBall = input.required<HighlightItemStats>();
  title = input.required<string>();
  totalGames = input.required<number>();
  imageUrlBase = input<string>();
  emptyMessage = input<string>('No Games with balls saved.');
  allBalls = input<HighlightItemStats[]>();
  sortMode = input<ItemSortMode>('gameCount');

  allBallsSorted = computed(() => {
    const items = this.allBalls();
    return items && sortGenericItems(items, this.sortMode());
  });
}
