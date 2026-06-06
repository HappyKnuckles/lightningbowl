// src/app/core/services/stats-persistence/stats-persistence.service.ts

import { computed, Injectable, Signal } from '@angular/core';
import { PrevStats, Stats } from 'src/app/core/models/stats.model';
import { GamesStore } from 'src/app/core/stores/games.store';
import { UtilsService } from '../utils/utils.service';
import { OverallStatsCalculatorService } from './game-stats-calculator/overall-stats-calculator.service';
import { SeriesStatsCalculatorService } from './game-stats-calculator/series-stats-calculator.service';

@Injectable({
  providedIn: 'root',
})
export class StatsPersistenceService {
  constructor(
    private gamesStore: GamesStore,
    private utilsService: UtilsService,
    private overallStatsCalculatorService: OverallStatsCalculatorService,
    private seriesStatsCalculatorService: SeriesStatsCalculatorService,
  ) {}

  private mapStatsToPrevStats(stats: Stats): PrevStats {
    return {
      markPercentage: stats.markPercentage,
      strikePercentage: stats.strikePercentage,
      sparePercentage: stats.sparePercentage,
      openPercentage: stats.openPercentage,
      cleanGamePercentage: stats.cleanGamePercentage,
      averageStrikesPerGame: stats.averageStrikesPerGame,
      averageSparesPerGame: stats.averageSparesPerGame,
      averageOpensPerGame: stats.averageOpensPerGame,
      averageFirstCount: stats.averageFirstCount,
      cleanGameCount: stats.cleanGameCount,
      perfectGameCount: stats.perfectGameCount,
      averageScore: stats.averageScore,
      strikeToStrikePercentage: stats.strikeToStrikePercentage,
      overallSpareRate: stats.overallSpareRate,
      spareRates: stats.spareRates,
      overallMissedRate: stats.overallMissedRate,
      pocketHitPercentage: stats.pocketHitPercentage,
      singlePinSparePercentage: stats.singlePinSparePercentage,
      multiPinSparePercentage: stats.multiPinSparePercentage,
      nonSplitSparePercentage: stats.nonSplitSparePercentage,
      splitConversionPercentage: stats.splitConversionPercentage,
      makeableSplitPercentage: stats.makeableSplitPercentage,
      average3SeriesScore: stats.average3SeriesScore!,
      average4SeriesScore: stats.average4SeriesScore!,
      average5SeriesScore: stats.average5SeriesScore!,
      high3Series: stats.high3Series!,
      high4Series: stats.high4Series!,
      high5Series: stats.high5Series!,
    };
  }

  private getDefaultPrevStats(): PrevStats {
    return {
      markPercentage: 0,
      strikePercentage: 0,
      sparePercentage: 0,
      openPercentage: 0,
      cleanGamePercentage: 0,
      averageStrikesPerGame: 0,
      averageSparesPerGame: 0,
      averageOpensPerGame: 0,
      averageFirstCount: 0,
      cleanGameCount: 0,
      perfectGameCount: 0,
      averageScore: 0,
      strikeToStrikePercentage: 0,
      overallSpareRate: 0,
      overallMissedRate: 0,
      pocketHitPercentage: 0,
      singlePinSparePercentage: 0,
      multiPinSparePercentage: 0,
      nonSplitSparePercentage: 0,
      splitConversionPercentage: 0,
      makeableSplitPercentage: 0,
      average3SeriesScore: 0,
      average4SeriesScore: 0,
      average5SeriesScore: 0,
      high3Series: 0,
      high4Series: 0,
      high5Series: 0,
      spareRates: Array(11).fill(0),
    };
  }

  public prevStats: Signal<PrevStats> = computed(() => {
    const gameHistory = this.gamesStore.games();
    const lastComparisonDate = parseInt(localStorage.getItem('lastComparisonDate') ?? '0');
    const today = Date.now();

    if (gameHistory.length === 0) {
      return JSON.parse(localStorage.getItem('prevStats')!) ?? this.getDefaultPrevStats();
    }

    const lastGameDate = gameHistory[0].date;

    if (lastComparisonDate !== 0 && this.utilsService.isSameDay(lastComparisonDate, lastGameDate)) {
      return JSON.parse(localStorage.getItem('prevStats')!) ?? this.getDefaultPrevStats();
    }

    const filteredGameHistory = gameHistory.filter((game) => !this.utilsService.isSameDay(game.date, today));

    const seriesStats = this.seriesStatsCalculatorService.calculateSeriesStats(filteredGameHistory);
    const stats: Stats = this.overallStatsCalculatorService.calculateBowlingStats(filteredGameHistory, seriesStats) as Stats;

    let prevStats: PrevStats = this.getDefaultPrevStats();

    if (lastComparisonDate !== 0) {
      if (!this.utilsService.isSameDay(lastComparisonDate, today) && this.utilsService.isDayBefore(lastComparisonDate, lastGameDate)) {
        prevStats = this.mapStatsToPrevStats(stats);

        localStorage.setItem('prevStats', JSON.stringify(prevStats));
        localStorage.setItem('lastComparisonDate', today.toString());
        return prevStats;
      }
    }

    if (lastComparisonDate === 0) {
      if (stats.totalGames > 0) {
        prevStats = this.mapStatsToPrevStats(stats);
      }

      localStorage.setItem('prevStats', JSON.stringify(prevStats));
      localStorage.setItem('lastComparisonDate', lastGameDate.toString());
      return prevStats;
    }

    return JSON.parse(localStorage.getItem('prevStats')!) ?? prevStats;
  });
}
