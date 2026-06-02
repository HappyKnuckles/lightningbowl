import { Injectable, inject } from '@angular/core';
import { Game } from 'src/app/core/models/game.model';
import { BestBallStats } from 'src/app/core/models/stats.model';
import { BallsStore } from 'src/app/core/stores/balls.store';

@Injectable({
  providedIn: 'root',
})
export class BallStatsCalculatorService {
  private ballsStore = inject(BallsStore);

  calculateAllBallStats(gameHistory: Game[]): BestBallStats[] {
    return Object.values(this._calculateAllBallStats(gameHistory));
  }

  calculateBestBallStats(gameHistory: Game[]): BestBallStats {
    const allBallStats = this._calculateAllBallStats(gameHistory);
    const ballNames = Object.keys(allBallStats);
    const defaultBall: BestBallStats = {
      ballName: '',
      ballImage: '',
      ballAvg: 0,
      ballHighestGame: 0,
      ballLowestGame: 0,
      gameCount: 0,
      cleanGameCount: 0,
      strikeRate: 0,
    };

    if (ballNames.length === 0) {
      return defaultBall;
    }

    return ballNames.reduce((best, currentBallName) => {
      return allBallStats[currentBallName].ballAvg > best.ballAvg ? allBallStats[currentBallName] : best;
    }, defaultBall);
  }

  calculateMostPlayedBall(gameHistory: Game[]): BestBallStats {
    const allBallStats = this._calculateAllBallStats(gameHistory);
    const ballNames = Object.keys(allBallStats);
    const defaultBall: BestBallStats = {
      ballName: '',
      ballImage: '',
      ballAvg: 0,
      ballHighestGame: 0,
      ballLowestGame: 0,
      gameCount: 0,
      cleanGameCount: 0,
      strikeRate: 0,
    };

    if (ballNames.length === 0) {
      return defaultBall;
    }

    return ballNames.reduce((mostPlayed, currentBallName) => {
      return allBallStats[currentBallName].gameCount > mostPlayed.gameCount ? allBallStats[currentBallName] : mostPlayed;
    }, defaultBall);
  }

  private _calculateAllBallStats(gameHistory: Game[]): Record<string, BestBallStats> {
    const gamesWithBalls = gameHistory.filter((game) => game.balls && game.balls.length > 0);
    const tempStats: Record<
      string,
      { totalScore: number; gameCount: number; highestGame: number; lowestGame: number; cleanGames: number; totalStrikes: number }
    > = {};

    gamesWithBalls.forEach((game) => {
      const uniqueBallsInGame = new Set(game.balls);

      let totalStrikesInGame = 0;
      game.frames.forEach((frame: { throws: any[] }, index: number) => {
        if (index < 9) {
          if (frame.throws[0]?.value === 10) {
            totalStrikesInGame++;
          }
        } else if (index === 9) {
          frame.throws.forEach((throwData: { value: number }) => {
            if (throwData.value === 10) {
              totalStrikesInGame++;
            }
          });
        }
      });

      uniqueBallsInGame.forEach((ballName) => {
        if (!tempStats[ballName]) {
          tempStats[ballName] = { totalScore: 0, gameCount: 0, highestGame: 0, lowestGame: 301, cleanGames: 0, totalStrikes: 0 };
        }
        const stats = tempStats[ballName];
        stats.totalScore += game.totalScore;
        stats.gameCount++;
        stats.totalStrikes += totalStrikesInGame;
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

    const finalStats: Record<string, BestBallStats> = {};
    for (const ballName in tempStats) {
      const stats = tempStats[ballName];
      const ballImage = this.ballsStore.allBalls().find((b) => b.ball_name === ballName)?.ball_image || '';
      const totalPossibleStrikes = stats.gameCount * 12;
      const strikeRate = totalPossibleStrikes > 0 ? Math.round((stats.totalStrikes / totalPossibleStrikes) * 100) : 0;

      finalStats[ballName] = {
        ballName: ballName,
        ballImage: ballImage,
        ballAvg: stats.gameCount > 0 ? Math.round(stats.totalScore / stats.gameCount) : 0,
        ballHighestGame: stats.highestGame,
        ballLowestGame: stats.lowestGame === 301 ? 0 : stats.lowestGame,
        gameCount: stats.gameCount,
        cleanGameCount: stats.cleanGames,
        strikeRate: strikeRate,
      };
    }
    return finalStats;
  }
}
