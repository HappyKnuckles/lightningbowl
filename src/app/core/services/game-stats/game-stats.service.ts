import { computed, Injectable, Signal } from '@angular/core';

import { HighlightItemStats, LeaveStats, LiveSeriesStats, PrevStats, SeriesStats, Stats } from 'src/app/core/models/stats.model';
import { GamesStore } from 'src/app/core/stores/games.store';

import { Game } from '../../models/game.model';
import { isAllFramesComplete, toCompletedFramesGame } from '../../utils/game-utils/frame.utils';
import { byAvg, byGameCount } from '../../utils/sort-utils/sort.utils';
import { pickTopFromList } from '../../utils/stat-utils/stat.utils';
import { GameFilterService } from '../game-filter/game-filter.service';
import { BallStatsCalculatorService } from './game-stats-calculator/ball-stats-calculator.service';
import { OverallStatsCalculatorService } from './game-stats-calculator/overall-stats-calculator.service';
import { PatternStatsCalculatorService } from './game-stats-calculator/pattern-stats-calculator.service';
import { PinStatsCalculatorService } from './game-stats-calculator/pin-stats-calculator.service';
import { SeriesStatsCalculatorService } from './game-stats-calculator/series-stats-calculator.service';
import { StatsPersistenceService } from './stats-persistance.service';

@Injectable({
  providedIn: 'root',
})
export class GameStatsService {
  public readonly allBallStats: Signal<HighlightItemStats[]> = computed(() => {
    return this.ballStatsCalculatorService.calculateAllBallStats(this.gameFilterService.filteredGames());
  });

  public readonly bestBallStats: Signal<HighlightItemStats> = computed(() => {
    return pickTopFromList(this.allBallStats(), byAvg);
  });

  public readonly mostPlayedBallStats: Signal<HighlightItemStats> = computed(() => {
    return pickTopFromList(this.allBallStats(), byGameCount);
  });

  public readonly allPatternStats: Signal<HighlightItemStats[]> = computed(() => {
    return this.patternStatsCalculatorService.calculateAllPatternStats(this.gameFilterService.filteredGames());
  });

  public readonly bestPatternStats: Signal<HighlightItemStats> = computed(() => {
    return pickTopFromList(this.allPatternStats(), byAvg);
  });

  public readonly mostPlayedPatternStats: Signal<HighlightItemStats> = computed(() => {
    return pickTopFromList(this.allPatternStats(), byGameCount);
  });

  public readonly allLeaves: Signal<LeaveStats[]> = computed(() => {
    return this.calculateAllLeaves(this.gameFilterService.filteredGames());
  });

  public readonly commonLeaves: Signal<LeaveStats[]> = computed(() => {
    return this.calculateMostCommonLeaves(this.allLeaves());
  });

  public readonly bestLeaves: Signal<LeaveStats[]> = computed(() => {
    return this.calculateBestSpares(this.allLeaves());
  });

  public readonly worstLeaves: Signal<LeaveStats[]> = computed(() => {
    return this.calculateWorstSpares(this.allLeaves());
  });

  public readonly currentStats: Signal<Stats> = computed(() => {
    const games = this.gameFilterService.filteredGames();
    return this.calculateBowlingStats(games) as Stats;
  });

  public readonly seriesStats: Signal<SeriesStats> = computed(() => {
    const games = this.gamesStore.games();
    return this.seriesStatsCalculatorService.calculateSeriesStats(games);
  });

  public readonly overallStats: Signal<Stats> = computed(() => {
    const games = this.gamesStore.games();
    return this.overallStatsCalculatorService.calculateBowlingStats(games, this.seriesStats()) as Stats;
  });

  public readonly prevStats: Signal<PrevStats> = this.statsPersistenceService.prevStats;

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

  calculateBowlingStats(gameHistory: Game[]): Stats {
    const seriesStats = this.seriesStatsCalculatorService.calculateSeriesStats(gameHistory);
    return this.overallStatsCalculatorService.calculateBowlingStats(gameHistory, seriesStats);
  }

  calculateLeaveAnalytics(gameHistory: Game[]): {
    best: LeaveStats[];
    common: LeaveStats[];
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

  calculateMostPlayedBallStats(gameHistory: Game[]): HighlightItemStats {
    return this.ballStatsCalculatorService.calculateMostPlayedBallStats(gameHistory);
  }

  calculateBestBallStats(gameHistory: Game[]): HighlightItemStats {
    return this.ballStatsCalculatorService.calculateBestBallStats(gameHistory);
  }

  calculateAllBallStats(gameHistory: Game[]): HighlightItemStats[] {
    return this.ballStatsCalculatorService.calculateAllBallStats(gameHistory);
  }

  calculateBestPatternStats(gameHistory: Game[]): HighlightItemStats {
    return this.patternStatsCalculatorService.calculateBestPatternStats(gameHistory);
  }

  calculateMostPlayedPatternStats(gameHistory: Game[]): HighlightItemStats {
    return this.patternStatsCalculatorService.calculateMostPlayedPatternStats(gameHistory);
  }

  calculateAllPatternStats(gameHistory: Game[]): HighlightItemStats[] {
    return this.patternStatsCalculatorService.calculateAllPatternStats(gameHistory);
  }

  calculateGamesForTargetAverage(targetAvg: number, steps = 15): { gamesNeeded: number; score: number }[] {
    return this.overallStatsCalculatorService.calculateGamesForTargetAverage(targetAvg, this.overallStats(), steps);
  }
}
