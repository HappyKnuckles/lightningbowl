import { Injectable } from '@angular/core';
import { Ball } from 'src/app/core/models/ball.model';
import { Game, getGameBalls } from 'src/app/core/models/game.model';
import { BestBallStats } from 'src/app/core/models/stats.model';
import { StorageService } from '../../storage/storage.service';

@Injectable({
  providedIn: 'root',
})
export class BallStatsCalculatorService {
  constructor(private storageService: StorageService) {}

  private getBallCandidates(): Ball[] {
    const all = this.storageService.allBalls();
    const arsenal = this.storageService.arsenal();
    const merged = [...all, ...arsenal];
    const seen = new Set<string>();

    return merged.filter((ball) => {
      const key = `${ball.ball_id}-${ball.core_weight}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private normalizeBallName(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '');
  }

  private normalizeBallKey(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '')
      .replace(/lbs?|#/g, '');
  }

  private extractWeightToken(value: string | undefined): string | undefined {
    if (!value) return undefined;
    const match = value.toLowerCase().match(/(1\d(?:\.\d+)?|[6-9](?:\.\d+)?)/);
    if (!match) return undefined;

    const numeric = Number(match[1]);
    if (Number.isNaN(numeric)) return undefined;
    return Number.isInteger(numeric) ? String(numeric) : String(numeric);
  }

  private resolveBallReference(rawBallValue: string | undefined): Ball | undefined {
    const raw = rawBallValue?.trim();
    if (!raw) return undefined;

    const rawWeight = this.extractWeightToken(raw);
    const rawNameOnly = raw.replace(/(1\d(?:\.\d+)?|[6-9](?:\.\d+)?)(?:\s*(?:lbs?|lb|#)?)\s*$/i, '').trim();
    const normalizedRawName = this.normalizeBallName(rawNameOnly || raw);

    const candidates = this.getBallCandidates();

    const byNameAndWeight = candidates.find((ball) => {
      if (this.normalizeBallName(ball.ball_name) !== normalizedRawName) return false;
      if (!rawWeight) return true;
      return this.extractWeightToken(ball.core_weight) === rawWeight;
    });

    if (byNameAndWeight) return byNameAndWeight;

    const normalizedRaw = this.normalizeBallKey(raw);
    return candidates.find((ball) => {
      const byName = this.normalizeBallKey(ball.ball_name);
      const byNameAndWeight = this.normalizeBallKey(`${ball.ball_name}${ball.core_weight}`);
      return normalizedRaw === byName || normalizedRaw === byNameAndWeight;
    });
  }

  private formatBallDisplayName(rawBallValue: string | undefined): string {
    const raw = rawBallValue?.trim();
    if (!raw) return '';

    const resolvedBall = this.resolveBallReference(raw);
    if (!resolvedBall) {
      const weightedMatch = raw.match(/^(.*?)(?:\s*)(1[0-6])(?:\s*(?:lbs?|lb|#)?)$/i);
      const baseName = weightedMatch?.[1]?.trim();
      const weight = weightedMatch?.[2];

      if (baseName && weight) {
        return `${baseName} ${weight}lbs`;
      }

      return raw;
    }

    return `${resolvedBall.ball_name} ${resolvedBall.core_weight}lbs`;
  }

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
            const ball = this.formatBallDisplayName(throwData.ball);
            if (!ball) return;
            throwBallCounts.set(ball, (throwBallCounts.get(ball) || 0) + 1);
            const isStrike = throwData.value === 10 && (frameIndex < 9 || frameIndex === 9);
            if (isStrike) {
              throwBallStrikes.set(ball, (throwBallStrikes.get(ball) || 0) + 1);
            }
          }
        });
      });

      // Determine ball names for this game
      const ballNames = getGameBalls(game)
        .map((ballName) => this.formatBallDisplayName(ballName))
        .filter((ballName) => !!ballName);
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
      const resolvedBall = this.resolveBallReference(ballName);
      const ballImage = resolvedBall?.ball_image || resolvedBall?.thumbnail_image || '';
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
