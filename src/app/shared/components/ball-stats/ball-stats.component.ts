import { Component, computed, input } from '@angular/core';
import { BestBallStats } from 'src/app/core/models/stats.model';
import { ItemStatsComponent } from '../item-stats/item-stats.component';

@Component({
  selector: 'app-ball-stats',
  standalone: true,
  imports: [ItemStatsComponent],
  templateUrl: './ball-stats.component.html',
})
export class BallStatsComponent {
  bestBall = input.required<BestBallStats>();
  title = input.required<string>();
  totalGames = input.required<number>();
  imageUrlBase = input<string>();
  emptyMessage = input<string>('No Games with balls saved.');

  asGeneric = computed(() => {
    const b = this.bestBall();
    return {
      name: b.ballName,
      image: b.ballImage,
      avg: b.ballAvg,
      highestGame: b.ballHighestGame,
      lowestGame: b.ballLowestGame,
      gameCount: b.gameCount,
    };
  });
}
