import { computed, Injectable, Signal } from '@angular/core';
import { Game, isAllFramesComplete, toCompletedFramesGame } from 'src/app/core/models/game.model';
import { BestBallStats, BestPatternStats, LeaveStats, LiveSeriesStats, PrevStats, SeriesStats, Stats } from 'src/app/core/models/stats.model';

import { GameFilterService } from '../game-filter/game-filter.service';
import { GamesStore } from 'src/app/core/stores/games.store';

import { StatsPersistenceService } from './stats-persistance.service';
import { OverallStatsCalculatorService } from './game-stats-calculator/overall-stats-calculator.service';
import { BallStatsCalculatorService } from './game-stats-calculator/ball-stats-calculator.service';
import { PatternStatsCalculatorService } from './game-stats-calculator/pattern-stats-calculator.service';
import { SeriesStatsCalculatorService } from './game-stats-calculator/series-stats-calculator.service';
import { PinStatsCalculatorService } from './game-stats-calculator/pin-stats-calculator.service';

@Injectable({
  providedIn: 'root',
})
export class GameStatsService {
  constructor(
    private gameFilterService: GameFilterService,
    private gamesStore: GamesStore,
    private overallStatsCalculatorService: OverallStatsCalculatorService,
    private seriesStatsCalculatorService: SeriesStatsCalculatorService,
    private ballStatsCalculatorService: BallStatsCalculatorService,
    private patternStatsCalculatorService: PatternStatsCalculatorService,
    private pinStatsCalculatorService: PinStatsCalculatorService,
    private statsPersistenceService: StatsPersistenceService,
  ) {}

  get prevStats(): Signal<PrevStats> {
    return this.statsPersistenceService.prevStats;
  }

  #bestBallStats: Signal<BestBallStats> = computed(() => {
    return this.calculateBestBallStats(this.gameFilterService.filteredGames());
  });
  get bestBallStats(): Signal<BestBallStats> {
    return this.#bestBallStats;
  }

  #mostPlayedBallStats: Signal<BestBallStats> = computed(() => {
    return this.calculateMostPlayedBallStats(this.gameFilterService.filteredGames());
  });
  get mostPlayedBallStats(): Signal<BestBallStats> {
    return this.#mostPlayedBallStats;
  }

  #allBallStats: Signal<BestBallStats[]> = computed(() => {
    return this.ballStatsCalculatorService.calculateAllBallStats(this.gameFilterService.filteredGames());
  });
  get allBallStats(): Signal<BestBallStats[]> {
    return this.#allBallStats;
  }

  #allPatternStats: Signal<BestPatternStats[]> = computed(() => {
    return this.patternStatsCalculatorService.calculateAllPatternStats(this.gameFilterService.filteredGames());
  });
  get allPatternStats(): Signal<BestPatternStats[]> {
    return this.#allPatternStats;
  }

  #bestPatternStats: Signal<BestPatternStats> = computed(() => {
    return this.patternStatsCalculatorService.calculateBestPatternStats(this.gameFilterService.filteredGames());
  });
  get bestPatternStats(): Signal<BestPatternStats> {
    return this.#bestPatternStats;
  }

  #mostPlayedPatternStats: Signal<BestPatternStats> = computed(() => {
    return this.patternStatsCalculatorService.calculateMostPlayedPattern(this.gameFilterService.filteredGames());
  });
  get mostPlayedPatternStats(): Signal<BestPatternStats> {
    return this.#mostPlayedPatternStats;
  }

  #allLeaves: Signal<LeaveStats[]> = computed(() => {
    return this.calculateAllLeaves(this.gameFilterService.filteredGames());
  });

  get allLeaves(): Signal<LeaveStats[]> {
    return this.#allLeaves;
  }

  #commonLeaves = computed(() => {
    return this.calculateMostCommonLeaves(this.#allLeaves());
  });
  get commonLeaves(): Signal<LeaveStats[]> {
    return this.#commonLeaves;
  }

  #bestLeaves = computed(() => {
    return this.calculateBestSpares(this.#allLeaves());
  });
  get bestLeaves(): Signal<LeaveStats[]> {
    return this.#bestLeaves;
  }

  #worstLeaves = computed(() => {
    return this.calculateWorstSpares(this.#allLeaves());
  });
  get worstLeaves(): Signal<LeaveStats[]> {
    return this.#worstLeaves;
  }

  #currentStats: Signal<Stats> = computed(() => {
    const games = this.gameFilterService.filteredGames();
    return this.calculateBowlingStats(games) as Stats;
  });
  get currentStats(): Signal<Stats> {
    return this.#currentStats;
  }

  #overallStats: Signal<Stats> = computed(() => {
    const games = this.gamesStore.games();
    return this.calculateBowlingStats(games) as Stats;
  });
  get overallStats(): Signal<Stats> {
    return this.#overallStats;
  }

  get seriesStats(): SeriesStats {
    this.seriesStatsCalculatorService.calculateSeriesStats(this.gamesStore.games());
    return this.seriesStatsCalculatorService.seriesStats;
  }

  calculateBowlingStats(gameHistory: Game[]): Stats {
    const seriesStats = this.seriesStatsCalculatorService.calculateSeriesStats(gameHistory);
    return this.overallStatsCalculatorService.calculateBowlingStats(gameHistory, seriesStats);
  }

  calculateLeaveAnalytics(gameHistory: Game[]): {
    common: LeaveStats[];
    best: LeaveStats[];
    worst: LeaveStats[];
  } {
    return this.pinStatsCalculatorService.getLeaveAnalytics(gameHistory);
  }

  calculateAllLeaves(gameHistory: Game[]): LeaveStats[] {
    return this.pinStatsCalculatorService.calculateAllLeaves(gameHistory);
  }

  calculateWorstSpares(allLeaves: LeaveStats[]): LeaveStats[] {
    return this.pinStatsCalculatorService.getWorstSpares(allLeaves);
  }

  calculateBestSpares(allLeaves: LeaveStats[]): LeaveStats[] {
    return this.pinStatsCalculatorService.getBestSpares(allLeaves);
  }

  calculateMostCommonLeaves(allLeaves: LeaveStats[]): LeaveStats[] {
    return this.pinStatsCalculatorService.getMostCommonLeaves(allLeaves);
  }

  calculateSeriesStats(gameHistory: Game[]): SeriesStats {
    return this.seriesStatsCalculatorService.calculateSeriesStats(gameHistory);
  }

  calculateLiveSeriesStats(games: Game[]): LiveSeriesStats | null {
    const completeGames = games.filter(isAllFramesComplete);
    const frameGames = games.map(toCompletedFramesGame).filter((g) => g.frames.length > 0);
    const context = { complete: completeGames.length, total: games.length };

    if (frameGames.length === 0) {
      return null;
    }

    const pinModeGames = frameGames.map((g) => ({ ...g, isPinMode: true }));
    const gameStats = completeGames.length ? this.calculateBowlingStats(completeGames) : {};

    return {
      stats: this.seriesStatsCalculatorService.mergeSeriesLiveStats(this.calculateBowlingStats(frameGames), gameStats, completeGames.length),
      leaves: this.calculateLeaveAnalytics(pinModeGames),
      allLeaves: this.calculateAllLeaves(pinModeGames),
      context,
    };
  }

  calculateMostPlayedBallStats(gameHistory: Game[]): BestBallStats {
    return this.ballStatsCalculatorService.calculateMostPlayedBall(gameHistory);
  }

  calculateBestBallStats(gameHistory: Game[]): BestBallStats {
    return this.ballStatsCalculatorService.calculateBestBallStats(gameHistory);
  }

  calculateMostPlayedBall(gameHistory: Game[]): BestBallStats {
    return this.ballStatsCalculatorService.calculateMostPlayedBall(gameHistory);
  }

  calculateAllBallStats(gameHistory: Game[]): BestBallStats[] {
    return this.ballStatsCalculatorService.calculateAllBallStats(gameHistory);
  }

  calculateBestPatternStats(gameHistory: Game[]): BestPatternStats {
    return this.patternStatsCalculatorService.calculateBestPatternStats(gameHistory);
  }

  calculateMostPlayedPatternStats(gameHistory: Game[]): BestPatternStats {
    return this.patternStatsCalculatorService.calculateMostPlayedPattern(gameHistory);
  }

  calculateAllPatternStats(gameHistory: Game[]): BestPatternStats[] {
    return this.patternStatsCalculatorService.calculateAllPatternStats(gameHistory);
  }

  calculateGamesForTargetAverage(targetAvg: number, steps = 15): { score: number; gamesNeeded: number }[] {
    return this.overallStatsCalculatorService.calculateGamesForTargetAverage(targetAvg, this.overallStats(), steps);
  }
}
