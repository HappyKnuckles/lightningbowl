// src/app/core/services/series-stats/series-stats.service.ts

import { Injectable } from '@angular/core';

import { Frame, Game, Throw } from 'src/app/core/models/game.model';

import { SeriesStats, Stats } from '../../../models/stats.model';

@Injectable({
  providedIn: 'root',
})
export class SeriesStatsCalculatorService {
  seriesStats: SeriesStats = {
    seriesTotal: 0,
    seriesDate: '',
    totalGames: 0,
    totalPins: 0,
    perfectGameCount: 0,
    cleanGameCount: 0,
    cleanGamePercentage: 0,
    totalStrikes: 0,
    totalSpares: 0,
    totalSparesMissed: 0,
    totalSparesConverted: 0,
    pinCounts: [],
    missedCounts: [],
    averageStrikesPerGame: 0,
    averageSparesPerGame: 0,
    averageOpensPerGame: 0,
    markPercentage: 0,
    strikePercentage: 0,
    sparePercentage: 0,
    openPercentage: 0,
    averageFirstCount: 0,
    averageScore: 0,
    highGame: 0,
    lowGame: 0,
    spareRates: [],
    overallSpareRate: 0,
    overallMissedRate: 0,
  };

  // bisschen dumm YAGNI und so, ist vorbereitet, falls man tiefere Series stats haben will
  calculateSeriesStats(gameHistory: Game[]): SeriesStats {
    const seriesScores: number[] = [];
    const series3Scores: number[] = [];
    const series4Scores: number[] = [];
    const series5Scores: number[] = [];
    const series6Scores: number[] = [];
    let totalPins = 0;
    let totalStrikes = 0;
    let totalSpares = 0;
    let totalOpens = 0;
    const seriesSpecificStats: {
      averageOpens: number;
      averageSpares: number;
      averageStrikes: number;
      seriesId: string;
      seriesScore: number;
      totalOpens: number;
      totalSpares: number;
      totalStrikes: number;
    }[] = [];

    // Group games by series ID
    const seriesMap = new Map<string, Game[]>();

    gameHistory.forEach((game) => {
      if (game.seriesId) {
        if (!seriesMap.has(game.seriesId)) {
          seriesMap.set(game.seriesId, []);
        }
        seriesMap.get(game.seriesId)!.push(game);
      }
    });

    // Calculate stats for each series
    seriesMap.forEach((seriesGames, seriesId) => {
      const seriesScore = seriesGames.reduce((sum, game) => sum + game.totalScore, 0);
      seriesScores.push(seriesScore);
      totalPins += seriesScore;

      let seriesStrikes = 0;
      let seriesSpares = 0;
      let seriesOpens = 0;

      seriesGames.forEach((game) => {
        game.frames.forEach((frame: Frame) => {
          const throws = frame.throws;

          // Count strikes
          if (throws[0].value === 10) {
            seriesStrikes++;
          }

          // Count spares
          // Assuming frame.throws includes all throws including fill balls in the 10th
          const frameThrows = frame.throws.map((t: Throw) => t.value);
          const isStrike = frameThrows[0] === 10;
          let isSpare = false;

          if (!isStrike && frameThrows.length >= 2 && frameThrows[0] + frameThrows[1] === 10) {
            isSpare = true;
          }
          // 10th frame spare (X 7 /)
          if (
            frame.frameIndex === 10 &&
            frameThrows.length === 3 &&
            frameThrows[0] === 10 &&
            frameThrows[1] < 10 &&
            frameThrows[1] + frameThrows[2] === 10
          ) {
            isSpare = true; // This spare needs to be counted too
          }

          if (isSpare) {
            seriesSpares++;
          } else if (!isStrike) {
            // Open frame (not strike, not spare)
            const is10thFrameOpen = frame.frameIndex === 10 && frameThrows.length < 3 && frameThrows[0] + frameThrows[1] < 10;
            const isRegularOpen = frame.frameIndex < 10 && frameThrows.length === 2 && frameThrows[0] + frameThrows[1] < 10;
            if (isRegularOpen || is10thFrameOpen) {
              seriesOpens++;
            }
          }
        });
      });

      totalStrikes += seriesStrikes;
      totalSpares += seriesSpares;
      totalOpens += seriesOpens;

      const seriesSpecificStat = {
        seriesId,
        seriesScore,
        totalStrikes: seriesStrikes,
        totalSpares: seriesSpares,
        totalOpens: seriesOpens,
        averageStrikes: seriesStrikes / seriesGames.length || 0,
        averageSpares: seriesSpares / seriesGames.length || 0,
        averageOpens: seriesOpens / seriesGames.length || 0,
      };

      seriesSpecificStats.push(seriesSpecificStat);

      // Add to specific series length arrays
      if (seriesGames.length === 3) {
        series3Scores.push(seriesScore);
      } else if (seriesGames.length === 4) {
        series4Scores.push(seriesScore);
      } else if (seriesGames.length === 5) {
        series5Scores.push(seriesScore);
      } else if (seriesGames.length === 6) {
        series6Scores.push(seriesScore);
      }
    });

    const totalSeries = seriesScores.length;
    const averageSeriesScore = totalPins / totalSeries || 0;

    const highSeries = totalSeries > 0 ? Math.max(...seriesScores) : 0;
    const lowSeries = totalSeries > 0 ? Math.min(...seriesScores) : 0;

    const averageStrikesPerSeries = totalStrikes / totalSeries || 0;
    const averageSparesPerSeries = totalSpares / totalSeries || 0;
    const averageOpensPerSeries = totalOpens / totalSeries || 0;

    const average3SeriesScore = series3Scores.reduce((sum, score) => sum + score, 0) / series3Scores.length || 0;
    const high3Series = series3Scores.length > 0 ? Math.max(...series3Scores) : 0;
    const average4SeriesScore = series4Scores.reduce((sum, score) => sum + score, 0) / series4Scores.length || 0;
    const high4Series = series4Scores.length > 0 ? Math.max(...series4Scores) : 0;
    const average5SeriesScore = series5Scores.reduce((sum, score) => sum + score, 0) / series5Scores.length || 0;
    const high5Series = series5Scores.length > 0 ? Math.max(...series5Scores) : 0;
    const average6SeriesScore = series6Scores.reduce((sum, score) => sum + score, 0) / series6Scores.length || 0;
    const high6Series = series6Scores.length > 0 ? Math.max(...series6Scores) : 0;

    // Populate the internal detailed seriesStats object
    this.seriesStats = {
      totalSeries,
      totalPins,
      totalStrikes,
      totalSpares,
      averageSeriesScore,
      highSeries,
      lowSeries,
      averageStrikesPerSeries,
      averageSparesPerSeries,
      averageOpensPerSeries,
      seriesScores,
      seriesTotal: 0,
      seriesDate: '',
      totalGames: 0,
      perfectGameCount: 0,
      cleanGameCount: 0,
      cleanGamePercentage: 0,
      totalSparesMissed: 0,
      totalSparesConverted: 0,
      pinCounts: [],
      missedCounts: [],
      averageStrikesPerGame: 0,
      averageSparesPerGame: 0,
      averageOpensPerGame: 0,
      markPercentage: 0,
      strikePercentage: 0,
      sparePercentage: 0,
      openPercentage: 0,
      averageFirstCount: 0,
      averageScore: 0,
      highGame: 0,
      lowGame: 0,
      spareRates: [],
      overallSpareRate: 0,
      overallMissedRate: 0,
    };

    return {
      average3SeriesScore,
      high3Series,
      average4SeriesScore,
      high4Series,
      average5SeriesScore,
      high5Series,
      average6SeriesScore,
      high6Series,
      seriesTotal: 0,
      seriesDate: '',
      totalGames: 0,
      totalPins: 0,
      perfectGameCount: 0,
      cleanGameCount: 0,
      cleanGamePercentage: 0,
      totalStrikes: 0,
      totalSpares: 0,
      totalSparesMissed: 0,
      totalSparesConverted: 0,
      pinCounts: [],
      missedCounts: [],
      averageStrikesPerGame: 0,
      averageSparesPerGame: 0,
      averageOpensPerGame: 0,
      markPercentage: 0,
      strikePercentage: 0,
      sparePercentage: 0,
      openPercentage: 0,
      averageFirstCount: 0,
      averageScore: 0,
      highGame: 0,
      lowGame: 0,
      spareRates: [],
      overallSpareRate: 0,
      overallMissedRate: 0,
    };
  }

  mergeSeriesLiveStats(frameStats: Stats, gameStats: Partial<Stats>, totalGames: number): Stats {
    const { averageScore = 0, highGame = 0, lowGame = 0, cleanGameCount = 0, cleanGamePercentage = 0, perfectGameCount = 0 } = gameStats;
    return {
      ...frameStats,
      totalGames,
      averageScore,
      highGame,
      lowGame,
      cleanGameCount,
      cleanGamePercentage,
      perfectGameCount,
    };
  }
}
