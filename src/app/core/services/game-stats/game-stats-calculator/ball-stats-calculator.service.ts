import { Injectable } from '@angular/core';
import { Game, getGameBalls } from 'src/app/core/models/game.model';
import { BestBallStats } from 'src/app/core/models/stats.model';
import { StorageService } from '../../storage/storage.service';

@Injectable({
  providedIn: 'root',
})
export class BallStatsCalculatorService {
  constructor(private storageService: StorageService) {}

  private _calculateAllBallStats(gameHistory: Game[]): Record<string, BestBallStats> {
    const tempStats: Record<
      string,
      {
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
      const throwBallCounts = new Map<string, number>(); // ballName -> throw count in this game
      let hasThrowLevelBalls = false;

      game.frames.forEach((frame, frameIndex) => {
        frame.throws.forEach((throwData) => {
          if (throwData.ball) {
            hasThrowLevelBalls = true;
            const ball = throwData.ball;
            throwBallCounts.set(ball, (throwBallCounts.get(ball) || 0) + 1);
            const isStrike = throwData.value === 10 && (frameIndex < 9 || frameIndex === 9);
            if (isStrike) {
              throwBallStrikes.set(ball, (throwBallStrikes.get(ball) || 0) + 1);
            }
          }
        });
      });

      // Determine ball names for this game
      const ballNames = getGameBalls(game);
      if (ballNames.length === 0) {
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

      const uniqueBallsInGame = new Set(ballNames);
      uniqueBallsInGame.forEach((ballName) => {
        if (!tempStats[ballName]) {
          tempStats[ballName] = { totalScore: 0, gameCount: 0, highestGame: 0, lowestGame: 301, cleanGames: 0, totalStrikes: 0, totalThrows: 0 };
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

    const finalStats: Record<string, BestBallStats> = {};
    for (const ballName in tempStats) {
      const stats = tempStats[ballName];
      const ballImage = this.storageService.allBalls().find((b) => b.ball_name === ballName)?.ball_image || '';
      const strikeRate = stats.totalThrows > 0 ? Math.round((stats.totalStrikes / stats.totalThrows) * 100) : 0;

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
}
