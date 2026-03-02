import { Component, computed, input } from '@angular/core';
import { BestPatternStats } from 'src/app/core/models/stats.model';
import { BallStatsComponent } from '../ball-stats/ball-stats.component';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-pattern-stats',
  standalone: true,
  imports: [BallStatsComponent],
  templateUrl: './pattern-stats.component.html',
})
export class PatternStatsComponent {
  bestPattern = input.required<BestPatternStats>();
  title = input.required<string>();
  totalGames = input.required<number>();

  imagesUrl = environment.imagesUrl;

  asBallStats = computed(() => {
    const p = this.bestPattern();
    return {
      ballName: p.patternName,
      ballImage: p.patternImage,
      ballAvg: p.patternAvg,
      ballHighestGame: p.patternHighestGame,
      ballLowestGame: p.patternLowestGame,
      gameCount: p.gameCount,
      strikeRate: p.strikeRate,
      cleanGameCount: p.cleanGameCount,
    };
  });
}
