import { Injectable, inject } from '@angular/core';
import { Ball } from 'src/app/core/models/ball.model';
import { Game } from 'src/app/core/models/game.model';
import { BallDetailStats, BallStats, HighlightItemStats } from 'src/app/core/models/stats.model';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { formatThrowBall, getBallTracking, getGameBalls, getThrowBallKey } from 'src/app/core/utils/game-utils/ball.utils';
import { isFirstBallThrow } from 'src/app/core/utils/game-utils/frame.utils';
import { byAvg, byGameCount } from 'src/app/core/utils/sort-utils/sort.utils';
import { pickTop } from 'src/app/core/utils/stat-utils/stat.utils';
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
    const byDisplayName = this._calculateAllBallStats(gameHistory);
    const detailByKey = this.#detailCalculator.calculate(gameHistory);

    // Stored ball keys and arsenal display names spell the same ball differently
    // ("Hammer15" vs "Hammer 15lbs"), so every lookup goes through the normalized form.
    const detailedGameCounts = new Map<string, number>();
    const lastUsed = new Map<string, number>();
    for (const game of gameHistory) {
      const isDetailed = getBallTracking(game) === 'throw';
      for (const key of new Set(getGameBalls(game))) {
        const normalized = this.normalizeBallKey(key);
        if (isDetailed) detailedGameCounts.set(normalized, (detailedGameCounts.get(normalized) ?? 0) + 1);
        lastUsed.set(normalized, Math.max(lastUsed.get(normalized) ?? 0, game.date));
      }
    }

    return Object.values(byDisplayName).map((item) => {
      const resolved = this.resolveBallReference(item.name);
      const key = resolved ? getThrowBallKey({ name: resolved.ball_name, weight: resolved.core_weight }) : item.name;
      const normalized = this.normalizeBallKey(key);
      const detail = detailByKey.get(key) ?? this.findDetailByName(detailByKey, item.name);

      return {
        key,
        name: resolved?.ball_name ?? item.name,
        displayName: item.name,
        weight: resolved?.core_weight,
        image: item.image,
        tier: detail ? ('detailed' as const) : ('basic' as const),
        gameCount: item.gameCount,
        detailedGameCount: detailedGameCounts.get(normalized) ?? 0,
        avg: item.avg,
        highestGame: item.highestGame,
        lowestGame: item.lowestGame,
        cleanGameCount: item.cleanGameCount ?? 0,
        lastUsed: lastUsed.get(normalized) ?? 0,
        detail,
      } satisfies BallStats;
    });
  }

  /** Falls back to fuzzy name matching when a stored ball never resolved to an arsenal entry. */
  private findDetailByName(detailByKey: Map<string, BallDetailStats>, displayName: string): BallDetailStats | undefined {
    const wanted = this.normalizeBallKey(displayName);
    for (const [key, detail] of detailByKey) {
      if (this.normalizeBallKey(key) === wanted) return detail;
    }
    return undefined;
  }

  calculateAllBallStats(gameHistory: Game[]): HighlightItemStats[] {
    return Object.values(this._calculateAllBallStats(gameHistory));
  }

  calculateBestBallStats(gameHistory: Game[]): HighlightItemStats {
    return pickTop(this._calculateAllBallStats(gameHistory), byAvg);
  }

  calculateMostPlayedBallStats(gameHistory: Game[]): HighlightItemStats {
    return pickTop(this._calculateAllBallStats(gameHistory), byGameCount);
  }

  private getBallCandidates(): Ball[] {
    const all = this.ballsStore.allBalls();
    const arsenal = this.ballsStore.arsenal();
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
    return String(numeric);
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
      const byKey = this.normalizeBallKey(`${ball.ball_name}${ball.core_weight}`);
      return normalizedRaw === byName || normalizedRaw === byKey;
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

  private _calculateAllBallStats(gameHistory: Game[]): Record<string, HighlightItemStats> {
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
      const throwBallCounts = new Map<string, number>(); // ballName -> first-ball count in this game
      let hasThrowLevelBalls = false;

      game.frames.forEach((frame, frameIndex) => {
        frame.throws.forEach((throwData, throwIndex) => {
          if (!throwData.ball) return;
          hasThrowLevelBalls = true;
          const ball = this.formatBallDisplayName(formatThrowBall(throwData.ball));
          if (!ball) return;

          // Strike rate is a first-ball stat: only a first ball on a full rack can strike.
          // A 10 thrown at a leave is a spare, and counting it inflates the rate.
          if (!isFirstBallThrow(frame, frameIndex, throwIndex)) return;

          throwBallCounts.set(ball, (throwBallCounts.get(ball) || 0) + 1);
          if (throwData.value === 10) {
            throwBallStrikes.set(ball, (throwBallStrikes.get(ball) || 0) + 1);
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

    const finalStats: Record<string, HighlightItemStats> = {};
    for (const ballName in tempStats) {
      const stats = tempStats[ballName];
      const resolvedBall = this.resolveBallReference(ballName);
      const ballImage = resolvedBall?.ball_image || resolvedBall?.thumbnail_image || '';
      const strikeRate = stats.totalThrows > 0 ? Math.round((stats.totalStrikes / stats.totalThrows) * 100) : 0;

      finalStats[ballName] = {
        name: ballName,
        image: ballImage,
        avg: stats.gameCount > 0 ? Math.round(stats.totalScore / stats.gameCount) : 0,
        highestGame: stats.highestGame,
        lowestGame: stats.lowestGame === 301 ? 0 : stats.lowestGame,
        gameCount: stats.gameCount,
        cleanGameCount: stats.cleanGames,
        strikeRate: strikeRate,
      };
    }
    return finalStats;
  }
}
