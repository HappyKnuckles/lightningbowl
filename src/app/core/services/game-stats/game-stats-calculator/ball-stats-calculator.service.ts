import { Injectable, inject } from '@angular/core';
import { ballImageUrl } from 'src/app/core/utils/ball-utils/ball-image.utils';
import { Game, ThrowBall } from 'src/app/core/models/game.model';
import { BallStats, HighlightItemStats } from 'src/app/core/models/stats.model';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { findBall, formatThrowBall, getBallTracking, getThrowBallKey, getUniqueGameBalls } from 'src/app/core/utils/game-utils/game-ball.utils';
import { isFirstBallThrow } from 'src/app/core/utils/game-utils/frame.utils';
import { byAvg, byGameCount } from 'src/app/core/utils/sort-utils/sort.utils';
import { pickTopFromList } from 'src/app/core/utils/stat-utils/stat.utils';
import { BallDetailStatsCalculatorService } from './ball-detail-stats-calculator.service';

@Injectable({
  providedIn: 'root',
})
export class BallStatsCalculatorService {
  #detailCalculator = inject(BallDetailStatsCalculatorService);

  constructor(private ballsStore: BallsStore) {}

  /**
   * Full per-ball stats: the game-level numbers every game can provide, plus a `detail`
   * block for balls that were tracked per throw. The two tiers are kept separate on
   * purpose: a game-tracked game credits its whole score to every ball it used, which
   * is fine as a game-level statement but is not a claim about the ball's own throws.
   */
  calculateBallStats(gameHistory: Game[]): BallStats[] {
    const byKey = this._calculateAllBallStats(gameHistory);
    const detailByKey = this.#detailCalculator.calculate(gameHistory);

    const detailedGameCounts = new Map<string, number>();
    const lastUsed = new Map<string, number>();
    for (const game of gameHistory) {
      const isDetailed = getBallTracking(game) === 'throw';
      for (const ball of getUniqueGameBalls(game)) {
        const key = getThrowBallKey(ball);
        if (isDetailed) detailedGameCounts.set(key, (detailedGameCounts.get(key) ?? 0) + 1);
        lastUsed.set(key, Math.max(lastUsed.get(key) ?? 0, game.date));
      }
    }

    return [...byKey].map(([key, { ball, stats }]) => {
      const detail = detailByKey.get(key);
      return {
        key,
        name: ball.name,
        displayName: stats.name,
        weight: ball.weight,
        image: stats.image,
        tier: detail ? ('detailed' as const) : ('basic' as const),
        gameCount: stats.gameCount,
        detailedGameCount: detailedGameCounts.get(key) ?? 0,
        avg: stats.avg,
        highestGame: stats.highestGame,
        lowestGame: stats.lowestGame,
        cleanGameCount: stats.cleanGameCount ?? 0,
        lastUsed: lastUsed.get(key) ?? 0,
        detail,
      } satisfies BallStats;
    });
  }

  calculateAllBallStats(gameHistory: Game[]): HighlightItemStats[] {
    return [...this._calculateAllBallStats(gameHistory).values()].map(({ stats }) => stats);
  }

  calculateBestBallStats(gameHistory: Game[]): HighlightItemStats {
    return pickTopFromList(this.calculateAllBallStats(gameHistory), byAvg);
  }

  calculateMostPlayedBallStats(gameHistory: Game[]): HighlightItemStats {
    return pickTopFromList(this.calculateAllBallStats(gameHistory), byGameCount);
  }

  /** The ball's image: the known ball in that weight, else any weight of it. */
  private ballImage(ball: ThrowBall): string {
    const known = this.ballsStore.knownBalls();
    return ballImageUrl(findBall(ball, known) ?? known.find((b) => b.ball_name === ball.name), 'ball');
  }

  /** Game-level stats per ball, by `getThrowBallKey`. */
  private _calculateAllBallStats(gameHistory: Game[]): Map<string, { ball: ThrowBall; stats: HighlightItemStats }> {
    const tempStats: Record<
      string,
      {
        ball: ThrowBall;
        totalScore: number;
        gameCount: number;
        highestGame: number;
        lowestGame: number;
        cleanGames: number;
        totalStrikes: number;
        totalThrows: number;
      }
    > = {};

    gameHistory.forEach((game) => {
      // Collect per-throw ball data from frames
      const throwBallStrikes = new Map<string, number>(); // ballName -> strike count in this game
      const throwBallCounts = new Map<string, number>(); // ballName -> first-ball count in this game
      let hasThrowLevelBalls = false;
      // Balls left on the throws of a game that switched to game-level tracking were replaced
      // by its selection, so only a throw-tracked game's throws count.
      const isThrowTracked = getBallTracking(game) === 'throw';

      game.frames.forEach((frame, frameIndex) => {
        frame.throws.forEach((throwData, throwIndex) => {
          if (!isThrowTracked || !throwData.ball) return;
          hasThrowLevelBalls = true;
          if (!throwData.ball.name) return;
          const ball = getThrowBallKey(throwData.ball);

          // Strike rate is a first-ball stat: only a first ball on a full rack can strike.
          // A 10 thrown at a leave is a spare, and counting it inflates the rate.
          if (!isFirstBallThrow(frame, frameIndex, throwIndex)) return;

          throwBallCounts.set(ball, (throwBallCounts.get(ball) || 0) + 1);
          if (throwData.value === 10) {
            throwBallStrikes.set(ball, (throwBallStrikes.get(ball) || 0) + 1);
          }
        });
      });

      const gameBalls = getUniqueGameBalls(game);
      if (gameBalls.length === 0) {
        return;
      }

      // For backward-compat games without throw-level data, count strikes the old way
      let legacyTotalStrikes = 0;
      if (!hasThrowLevelBalls) {
        game.frames.forEach((frame, index) => {
          if (index < 9) {
            if (frame.throws[0]?.value === 10) {
              legacyTotalStrikes++;
            }
          } else if (index === 9) {
            frame.throws.forEach((throwData: { value: number }) => {
              if (throwData.value === 10) {
                legacyTotalStrikes++;
              }
            });
          }
        });
      }

      gameBalls.forEach((gameBall) => {
        const ballName = getThrowBallKey(gameBall);
        if (!tempStats[ballName]) {
          tempStats[ballName] = {
            ball: gameBall,
            totalScore: 0,
            gameCount: 0,
            highestGame: 0,
            lowestGame: 301,
            cleanGames: 0,
            totalStrikes: 0,
            totalThrows: 0,
          };
        }
        const stats = tempStats[ballName];
        stats.totalScore += game.totalScore;
        stats.gameCount++;
        if (hasThrowLevelBalls) {
          stats.totalStrikes += throwBallStrikes.get(ballName) || 0;
          stats.totalThrows += throwBallCounts.get(ballName) || 0;
        } else {
          stats.totalStrikes += legacyTotalStrikes;
          stats.totalThrows += 12; // approximation for legacy data
        }
        if (game.totalScore > stats.highestGame) {
          stats.highestGame = game.totalScore;
        }
        if (game.totalScore < stats.lowestGame) {
          stats.lowestGame = game.totalScore;
        }
        if (game.isClean) {
          stats.cleanGames++;
        }
      });
    });

    const finalStats = new Map<string, { ball: ThrowBall; stats: HighlightItemStats }>();
    for (const ballName in tempStats) {
      const stats = tempStats[ballName];
      const strikeRate = stats.totalThrows > 0 ? Math.round((stats.totalStrikes / stats.totalThrows) * 100) : 0;

      finalStats.set(ballName, {
        ball: stats.ball,
        stats: {
          name: formatThrowBall(stats.ball),
          image: this.ballImage(stats.ball),
          avg: stats.gameCount > 0 ? Math.round(stats.totalScore / stats.gameCount) : 0,
          highestGame: stats.highestGame,
          lowestGame: stats.lowestGame === 301 ? 0 : stats.lowestGame,
          gameCount: stats.gameCount,
          cleanGameCount: stats.cleanGames,
          strikeRate: strikeRate,
        },
      });
    }
    return finalStats;
  }
}
