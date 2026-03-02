import { Component, computed, input } from '@angular/core';
import { BestPatternStats } from 'src/app/core/models/stats.model';
import { ItemStatsComponent } from '../item-stats/item-stats.component';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-pattern-stats',
  standalone: true,
  imports: [ItemStatsComponent],
  templateUrl: './pattern-stats.component.html',
})
export class PatternStatsComponent {
  bestPattern = input.required<BestPatternStats>();
  title = input.required<string>();
  totalGames = input.required<number>();

  imagesUrl = environment.imagesUrl;

  asGeneric = computed(() => {
    const p = this.bestPattern();
    return {
      name: p.patternName,
      image: p.patternImage,
      avg: p.patternAvg,
      highestGame: p.patternHighestGame,
      lowestGame: p.patternLowestGame,
      gameCount: p.gameCount,
    };
  });
}
