import { Injectable } from '@angular/core';
import { Game } from 'src/app/core/models/game.model';
import { BestPatternStats } from 'src/app/core/models/stats.model';
import { StorageService } from '../../storage/storage.service';

@Injectable({
  providedIn: 'root',
})
export class PatternStatsCalculatorService {
  constructor(private storageService: StorageService) {}

  private _calculateAllPatternStats(gameHistory: Game[]): Record<string, BestPatternStats> {
    const gamesWithPatterns = gameHistory.filter((game) => game.patterns && game.patterns.length > 0);
    const tempStats: Record<
      string,
      { totalScore: number; gameCount: number; highestGame: number; lowestGame: number; cleanGames: number; totalStrikes: number }
    > = {};

    gamesWithPatterns.forEach((game) => {
      const uniquePatternsInGame = new Set(game.patterns);

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

    const finalStats: Record<string, BestPatternStats> = {};
    for (const patternName in tempStats) {
      const stats = tempStats[patternName];
      const patternImage = this.storageService.patternImageMap()[patternName] ?? '';
      const totalPossibleStrikes = stats.gameCount * 12;
      const strikeRate = totalPossibleStrikes > 0 ? Math.round((stats.totalStrikes / totalPossibleStrikes) * 100) : 0;
      finalStats[patternName] = {
        patternName: patternName,
        patternImage: patternImage,
        patternAvg: stats.gameCount > 0 ? Math.round(stats.totalScore / stats.gameCount) : 0,
        patternHighestGame: stats.highestGame,
        patternLowestGame: stats.lowestGame === 301 ? 0 : stats.lowestGame,
        gameCount: stats.gameCount,
        cleanGameCount: stats.cleanGames,
        strikeRate: strikeRate,
      };
    }
    return finalStats;
  }

  calculateBestPatternStats(gameHistory: Game[]): BestPatternStats {
    const allPatternStats = this._calculateAllPatternStats(gameHistory);
    const patternNames = Object.keys(allPatternStats);
    const defaultPattern: BestPatternStats = {
      patternName: '',
      patternImage: '',
      patternAvg: 0,
      patternHighestGame: 0,
      patternLowestGame: 0,
      gameCount: 0,
      cleanGameCount: 0,
      strikeRate: 0,
    };

    if (patternNames.length === 0) {
      return defaultPattern;
    }

    return patternNames.reduce((best, currentPatternName) => {
      return allPatternStats[currentPatternName].patternAvg > best.patternAvg ? allPatternStats[currentPatternName] : best;
    }, defaultPattern);
  }

  calculateMostPlayedPattern(gameHistory: Game[]): BestPatternStats {
    const allPatternStats = this._calculateAllPatternStats(gameHistory);
    const patternNames = Object.keys(allPatternStats);
    const defaultPattern: BestPatternStats = {
      patternName: '',
      patternImage: '',
      patternAvg: 0,
      patternHighestGame: 0,
      patternLowestGame: 0,
      gameCount: 0,
      cleanGameCount: 0,
      strikeRate: 0,
    };

    if (patternNames.length === 0) {
      return defaultPattern;
    }

    return patternNames.reduce((mostPlayed, currentPatternName) => {
      return allPatternStats[currentPatternName].gameCount > mostPlayed.gameCount ? allPatternStats[currentPatternName] : mostPlayed;
    }, defaultPattern);
  }
}
