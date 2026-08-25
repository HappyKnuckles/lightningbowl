import { Game } from 'src/app/core/models/game.model';
import { SeriesStats } from 'src/app/core/models/stats.model';
import { createEmptyGame } from 'src/app/core/utils/game-utils/frame.utils';

import { OverallStatsCalculatorService } from './overall-stats-calculator.service';

/**
 * The overall calculator is a pure function (Game[] → Stats) with no Angular
 * dependencies, so we exercise it directly. These cover the score-derived
 * aggregates that the Stats page surfaces (games, average, high/low, clean %).
 */
describe('OverallStatsCalculatorService.calculateBowlingStats', () => {
  let calculator: OverallStatsCalculatorService;
  let nextId = 0;

  // Series fields are injected separately and are not exercised here.
  const noSeries = {} as SeriesStats;

  const makeGame = (overrides: Partial<Game> = {}): Game => ({
    ...createEmptyGame(),
    gameId: `g${++nextId}`,
    date: Date.UTC(2025, 0, 15),
    ...overrides,
  });

  beforeEach(() => {
    calculator = new OverallStatsCalculatorService();
    nextId = 0;
  });

  it('aggregates total games, average, high and low scores', () => {
    const games = [makeGame({ totalScore: 120 }), makeGame({ totalScore: 140 }), makeGame({ totalScore: 160 }), makeGame({ totalScore: 180 })];

    const stats = calculator.calculateBowlingStats(games, noSeries);

    expect(stats.totalGames).toBe(4);
    expect(stats.totalPins).toBe(600);
    expect(stats.averageScore).toBe(150);
    expect(stats.highGame).toBe(180);
    expect(stats.lowGame).toBe(120);
  });

  it('computes the clean-game count and percentage', () => {
    const games = [
      makeGame({ totalScore: 150, isClean: true }),
      makeGame({ totalScore: 150, isClean: true }),
      makeGame({ totalScore: 150, isClean: false }),
      makeGame({ totalScore: 150, isClean: false }),
    ];

    const stats = calculator.calculateBowlingStats(games, noSeries);

    expect(stats.cleanGameCount).toBe(2);
    expect(stats.cleanGamePercentage).toBe(50);
  });

  it('counts perfect games', () => {
    const games = [makeGame({ totalScore: 300, isPerfect: true, isClean: true }), makeGame({ totalScore: 220, isPerfect: false })];

    const stats = calculator.calculateBowlingStats(games, noSeries);

    expect(stats.perfectGameCount).toBe(1);
  });

  it('returns zeroed aggregates for an empty history', () => {
    const stats = calculator.calculateBowlingStats([], noSeries);

    expect(stats.totalGames).toBe(0);
    expect(stats.totalPins).toBe(0);
    expect(stats.averageScore).toBe(0);
    expect(stats.cleanGamePercentage).toBe(0);
  });
});
