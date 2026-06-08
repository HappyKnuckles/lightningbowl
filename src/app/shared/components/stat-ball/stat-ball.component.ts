import { Component, computed, input } from '@angular/core';
import { GenericItemStats, HighlightBallStats } from 'src/app/core/models/stats.model';
import { StatHighlightItemComponent } from '../stat-highlight-item/stat-highlight-item.component';

@Component({
  selector: 'app-stat-ball',
  standalone: true,
  imports: [StatHighlightItemComponent],
  templateUrl: './stat-ball.component.html',
})
export class StatBallComponent {
  bestBall = input.required<HighlightBallStats>();
  title = input.required<string>();
  totalGames = input.required<number>();
  imageUrlBase = input<string>();
  emptyMessage = input<string>('No Games with balls saved.');
  allBalls = input<HighlightBallStats[]>();
  toGeneric = (ball: HighlightBallStats): GenericItemStats => ({
    name: ball.ballName,
    image: ball.ballImage,
    avg: ball.ballAvg,
    highestGame: ball.ballHighestGame,
    lowestGame: ball.ballLowestGame,
    gameCount: ball.gameCount,
  });

  asGeneric = computed(() => this.toGeneric(this.bestBall()));
  allBallsGeneric = computed(() =>
    this.allBalls()
      ?.map(this.toGeneric)
      .sort((a, b) => b.gameCount - a.gameCount),
  );
}
