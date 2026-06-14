import { Component, computed, input } from '@angular/core';
import { HighlightItemStats } from 'src/app/core/models/stats.model';
import { ItemSortMode, sortGenericItems } from 'src/app/core/utils/sort-utils/sort.utils';
import { environment } from 'src/environments/environment';
import { StatHighlightItemComponent } from '../stat-highlight-item/stat-highlight-item.component';

@Component({
  selector: 'app-stat-pattern',
  standalone: true,
  imports: [StatHighlightItemComponent],
  templateUrl: './stat-pattern.component.html',
})
export class StatPatternComponent {
  bestPattern = input.required<HighlightItemStats>();
  title = input.required<string>();
  totalGames = input.required<number>();
  allPatterns = input<HighlightItemStats[]>();
  sortMode = input<ItemSortMode>('gameCount');
  imagesUrl = environment.imagesUrl;
  allPatternsSorted = computed(() => {
    const items = this.allPatterns();
    return items && sortGenericItems(items, this.sortMode());
  });
}
