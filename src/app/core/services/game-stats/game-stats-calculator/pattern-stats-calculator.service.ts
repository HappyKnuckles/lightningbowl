import { Injectable } from '@angular/core';
import { Frame, Game } from 'src/app/core/models/game.model';
import { HighlightItemStats } from 'src/app/core/models/stats.model';
import { PatternsStore } from 'src/app/core/stores/patterns.store';
import { byAvg, byGameCount } from 'src/app/core/utils/sort-utils/sort.utils';
import { pickTop } from 'src/app/core/utils/stat-utils/stat.utils';

@Injectable({
  providedIn: 'root',
})
export class PatternStatsCalculatorService {
  constructor(private patternsStore: PatternsStore) {}

  calculateAllPatternStats(gameHistory: Game[]): HighlightItemStats[] {
    return Object.values(this._calculateAllPatternStats(gameHistory));
  }

  calculateBestPatternStats(gameHistory: Game[]): HighlightItemStats {
    return pickTop(this._calculateAllPatternStats(gameHistory), byAvg);
  }

  calculateMostPlayedPatternStats(gameHistory: Game[]): HighlightItemStats {
    return pickTop(this._calculateAllPatternStats(gameHistory), byGameCount);
  }

  private _calculateAllPatternStats(gameHistory: Game[]): Record<string, HighlightItemStats> {
    const gamesWithPatterns = gameHistory.filter((game) => game.patterns && game.patterns.length > 0);
    const tempStats: Record<
      string,
      { totalScore: number; gameCount: number; highestGame: number; lowestGame: number; cleanGames: number; totalStrikes: number }
    > = {};

    gamesWithPatterns.forEach((game) => {
      const uniquePatternsInGame = new Set(game.patterns);

      let totalStrikesInGame = 0;
      game.frames.forEach((frame: Frame, index: number) => {
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

      uniquePatternsInGame.forEach((patternName) => {
        if (!tempStats[patternName]) {
          tempStats[patternName] = { totalScore: 0, gameCount: 0, highestGame: 0, lowestGame: 301, cleanGames: 0, totalStrikes: 0 };
        }
        const stats = tempStats[patternName];
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

    const finalStats: Record<string, HighlightItemStats> = {};
    for (const patternName in tempStats) {
      const stats = tempStats[patternName];
      const patternImage = this.patternsStore.patternImageMap()[patternName] ?? '';
      const totalPossibleStrikes = stats.gameCount * 12;
      const strikeRate = totalPossibleStrikes > 0 ? Math.round((stats.totalStrikes / totalPossibleStrikes) * 100) : 0;
      finalStats[patternName] = {
        name: patternName,
        image: patternImage,
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
