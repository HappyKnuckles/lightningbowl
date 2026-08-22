import { Injectable } from '@angular/core';
import { Game } from 'src/app/core/models/game.model';
import { HighlightItemStats } from 'src/app/core/models/stats.model';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { byAvg, byGameCount } from 'src/app/core/utils/sort-utils/sort.utils';
import { accumulateItemStats, pickTop } from 'src/app/core/utils/stat-utils/stat.utils';

@Injectable({
  providedIn: 'root',
})
export class BallStatsCalculatorService {
  constructor(private ballsStore: BallsStore) {}

  calculateAllBallStats(gameHistory: Game[]): HighlightItemStats[] {
    return Object.values(this._calculateAllBallStats(gameHistory));
  }

  calculateBestBallStats(gameHistory: Game[]): HighlightItemStats {
    return pickTop(this._calculateAllBallStats(gameHistory), byAvg);
  }

  calculateMostPlayedBallStats(gameHistory: Game[]): HighlightItemStats {
    return pickTop(this._calculateAllBallStats(gameHistory), byGameCount);
  }

  private _calculateAllBallStats(gameHistory: Game[]): Record<string, HighlightItemStats> {
    const ballImages = this.ballsStore.allBalls();
    return accumulateItemStats(
      gameHistory,
      (game) => game.balls ?? [],
      (ballName) => ballImages.find((ball) => ball.ball_name === ballName)?.ball_image || '',
    );
  }
}
