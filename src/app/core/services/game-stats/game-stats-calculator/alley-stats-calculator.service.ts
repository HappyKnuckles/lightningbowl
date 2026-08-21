import { Injectable } from '@angular/core';
import { Game } from 'src/app/core/models/game.model';
import { HighlightItemStats } from 'src/app/core/models/stats.model';
import { byAvg, byGameCount } from 'src/app/core/utils/sort-utils/sort.utils';
import { accumulateItemStats, pickTop } from 'src/app/core/utils/stat-utils/stat.utils';

@Injectable({
  providedIn: 'root',
})
export class AlleyStatsCalculatorService {
  calculateAllAlleyStats(gameHistory: Game[]): HighlightItemStats[] {
    return Object.values(this._calculateAllAlleyStats(gameHistory));
  }

  calculateBestAlleyStats(gameHistory: Game[]): HighlightItemStats {
    return pickTop(this._calculateAllAlleyStats(gameHistory), byAvg);
  }

  calculateMostPlayedAlleyStats(gameHistory: Game[]): HighlightItemStats {
    return pickTop(this._calculateAllAlleyStats(gameHistory), byGameCount);
  }

  /**
   * Score stats per alley, plus the three things a venue has that a ball doesn't:
   * how it compares to the player's overall average, how many separate visits it
   * took, and when they last played there. A game names at most one alley, and
   * alleys carry no image.
   */
  private _calculateAllAlleyStats(gameHistory: Game[]): Record<string, HighlightItemStats> {
    const stats = accumulateItemStats(gameHistory, (game) => (game.alley ? [game.alley] : []));
    const overallAvg = this.averageScore(gameHistory);
    const visitDays = new Map<string, Set<number>>();
    const lastPlayed = new Map<string, number>();

    for (const game of gameHistory) {
      if (!game.alley) {
        continue;
      }
      const days = visitDays.get(game.alley) ?? new Set<number>();
      days.add(this.startOfDay(game.date));
      visitDays.set(game.alley, days);
      lastPlayed.set(game.alley, Math.max(lastPlayed.get(game.alley) ?? 0, game.date));
    }

    for (const name of Object.keys(stats)) {
      stats[name].differential = overallAvg > 0 ? stats[name].avg - overallAvg : 0;
      stats[name].visitCount = visitDays.get(name)?.size ?? 0;
      stats[name].lastPlayed = lastPlayed.get(name);
    }
    return stats;
  }

  /** The player's baseline: every game in the set, alley or not. */
  private averageScore(games: Game[]): number {
    if (games.length === 0) {
      return 0;
    }
    return Math.round(games.reduce((total, game) => total + game.totalScore, 0) / games.length);
  }

  /** Games on the same calendar day are one visit, matching how sessions work elsewhere. */
  private startOfDay(timestamp: number): number {
    const date = new Date(timestamp);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  }
}
