import { computed, Injectable, Signal } from '@angular/core';
import { Game } from 'src/app/core/models/game.model';
import { BestBallStats, BestPatternStats, LeaveStats, PrevStats, SeriesStats, Stats } from 'src/app/core/models/stats.model';

import { GameFilterService } from '../game-filter/game-filter.service';
import { StorageService } from '../storage/storage.service';

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
    private storageService: StorageService,
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
    const games = this.storageService.games();
    return this.calculateBowlingStats(games) as Stats;
  });
  get overallStats(): Signal<Stats> {
    return this.#overallStats;
  }

  get seriesStats(): SeriesStats {
    this.seriesStatsCalculatorService.calculateSeriesStats(this.storageService.games());
    return this.seriesStatsCalculatorService.seriesStats;
  }

  calculateBowlingStats(gameHistory: Game[]): Stats {
    const seriesStats = this.seriesStatsCalculatorService.calculateSeriesStats(gameHistory);
    return this.overallStatsCalculatorService.calculateBowlingStats(gameHistory, seriesStats) as Stats;
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

  calculateMostPlayedBallStats(gameHistory: Game[]): BestBallStats {
    return this.ballStatsCalculatorService.calculateMostPlayedBall(gameHistory);
  }

  calculateBestBallStats(gameHistory: Game[]): BestBallStats {
    return this.ballStatsCalculatorService.calculateBestBallStats(gameHistory);
  }

  calculateMostPlayedBall(gameHistory: Game[]): BestBallStats {
    return this.ballStatsCalculatorService.calculateMostPlayedBall(gameHistory);
  }

  calculateGamesForTargetAverage(targetAvg: number, steps = 15): { score: number; gamesNeeded: number }[] {
    return this.overallStatsCalculatorService.calculateGamesForTargetAverage(targetAvg, this.overallStats(), steps);
  }
}
