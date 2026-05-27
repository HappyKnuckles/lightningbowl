import { Component, computed, input } from '@angular/core';
import { BestPatternStats } from '@models/stats.model';
import { environment } from 'src/environments/environment';
import { ItemStatsComponent } from '../item-stats/item-stats.component';

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
  allPatterns = input<BestPatternStats[]>();

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

  allPatternsGeneric = computed(() => {
    return this.allPatterns()
      ?.map((p) => ({
        name: p.patternName,
        image: p.patternImage,
        avg: p.patternAvg,
        highestGame: p.patternHighestGame,
        lowestGame: p.patternLowestGame,
        gameCount: p.gameCount,
      }))
      .sort((a, b) => b.gameCount - a.gameCount);
  });
}
