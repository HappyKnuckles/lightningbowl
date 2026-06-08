import { Component, computed, input } from '@angular/core';
import { GenericItemStats, HighlightPatternStats } from 'src/app/core/models/stats.model';
import { environment } from 'src/environments/environment';
import { StatHighlightItemComponent } from '../stat-highlight-item/stat-highlight-item.component';

@Component({
  selector: 'app-stat-pattern',
  standalone: true,
  imports: [StatHighlightItemComponent],
  templateUrl: './stat-pattern.component.html',
})
export class StatPatternComponent {
  bestPattern = input.required<HighlightPatternStats>();
  title = input.required<string>();
  totalGames = input.required<number>();
  allPatterns = input<HighlightPatternStats[]>();
  imagesUrl = environment.imagesUrl;
  toGeneric = (pattern: HighlightPatternStats): GenericItemStats => ({
    name: pattern.patternName,
    image: pattern.patternImage,
    avg: pattern.patternAvg,
    highestGame: pattern.patternHighestGame,
    lowestGame: pattern.patternLowestGame,
    gameCount: pattern.gameCount,
  });

  asGeneric = computed(() => this.toGeneric(this.bestPattern()));
  allPatternsGeneric = computed(() =>
    this.allPatterns()
      ?.map(this.toGeneric)
      .sort((a, b) => b.gameCount - a.gameCount),
  );
}
