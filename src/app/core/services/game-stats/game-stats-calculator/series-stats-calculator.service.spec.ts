import { TestBed } from '@angular/core/testing';
import { Frame, Game } from 'src/app/core/models/game.model';
import { Stats } from 'src/app/core/models/stats.model';
import { makeGame } from 'src/testing/fixtures';
import { SeriesStatsCalculatorService } from './series-stats-calculator.service';

/** Frames built from raw throw values, 1-based frameIndex like the rest of the app. */
function framesFrom(throwsPerFrame: number[][]): Frame[] {
  return throwsPerFrame.map((values, frameIndex) => ({
    frameIndex: frameIndex + 1,
    throws: values.map((value, i) => ({ value, throwIndex: i + 1 })),
  }));
}

/** Eight open frames, a spare in the 9th and a strike-led 10th: 1 strike, 1 spare, 8 opens. */
function mixedGame(seriesId: string | undefined, totalScore: number, gameId: string): Game {
  const throwsPerFrame = [...Array.from({ length: 8 }, () => [4, 3]), [7, 3], [10, 10, 10]];
  return makeGame({ gameId, totalScore, seriesId, isSeries: seriesId !== undefined, frames: framesFrom(throwsPerFrame) });
}

/** `count` games sharing a series id, each scoring `score`. */
function series(seriesId: string, count: number, score = 100): Game[] {
  return Array.from({ length: count }, (_, i) => mixedGame(seriesId, score, `${seriesId}-${i}`));
}

describe('SeriesStatsCalculatorService', () => {
  let calculator: SeriesStatsCalculatorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    calculator = TestBed.inject(SeriesStatsCalculatorService);
  });

  describe('calculateSeriesStats', () => {
    it('returns the average and high score per series length', () => {
      const games = [...series('s3', 3, 100), ...series('s4', 4, 150), ...series('s5', 5, 120), ...series('s6', 6, 110)];

      const stats = calculator.calculateSeriesStats(games);

      expect(stats.average3SeriesScore).toBe(300);
      expect(stats.high3Series).toBe(300);
      expect(stats.average4SeriesScore).toBe(600);
      expect(stats.high4Series).toBe(600);
      expect(stats.average5SeriesScore).toBe(600);
      expect(stats.high5Series).toBe(600);
      expect(stats.average6SeriesScore).toBe(660);
      expect(stats.high6Series).toBe(660);
    });

    it('averages several series of the same length', () => {
      const games = [...series('a', 3, 100), ...series('b', 3, 200)];

      const stats = calculator.calculateSeriesStats(games);

      expect(stats.average3SeriesScore).toBe(450);
      expect(stats.high3Series).toBe(600);
    });

    it('ignores single games that belong to no series', () => {
      const games = [...series('s3', 3, 100), mixedGame(undefined, 250, 'single')];

      calculator.calculateSeriesStats(games);

      expect(calculator.seriesStats['totalSeries']).toBe(1);
      expect(calculator.seriesStats['totalPins']).toBe(300);
    });

    it('populates the detailed series stats on the service', () => {
      calculator.calculateSeriesStats(series('s3', 3, 100));

      expect(calculator.seriesStats).toMatchObject({
        totalSeries: 1,
        totalPins: 300,
        totalStrikes: 3,
        totalSpares: 3,
        averageSeriesScore: 300,
        highSeries: 300,
        averageStrikesPerSeries: 3,
        averageSparesPerSeries: 3,
        averageOpensPerSeries: 24,
        seriesScores: [300],
      });
    });

    // The 10th-frame rules are gated on `frameIndex === 9`, but frames are 1-based,
    // so they key off the 9th frame and the real 10th frame falls through them.
    it('counts a strike followed by a spare in the 9th frame, where the 10th-frame rule fires', () => {
      const throwsPerFrame = [...Array.from({ length: 8 }, () => [10]), [10, 4, 6], [10, 10, 10]];
      const games = [makeGame({ gameId: 'g1', seriesId: 's', totalScore: 250, frames: framesFrom(throwsPerFrame) })];

      calculator.calculateSeriesStats(games);

      expect(calculator.seriesStats['totalSpares']).toBe(1);
      expect(calculator.seriesStats['totalStrikes']).toBe(10);
    });

    it('misses a strike followed by a spare in the actual 10th frame', () => {
      const throwsPerFrame = [...Array.from({ length: 9 }, () => [10]), [10, 4, 6]];
      const games = [makeGame({ gameId: 'g1', seriesId: 's', totalScore: 250, frames: framesFrom(throwsPerFrame) })];

      calculator.calculateSeriesStats(games);

      expect(calculator.seriesStats['totalSpares']).toBe(0);
    });

    it('misses an open 10th frame, which matches neither open-frame rule', () => {
      const throwsPerFrame = [...Array.from({ length: 9 }, () => [10]), [7, 2]];
      const games = [makeGame({ gameId: 'g1', seriesId: 's', totalScore: 250, frames: framesFrom(throwsPerFrame) })];

      calculator.calculateSeriesStats(games);

      expect(calculator.seriesStats['averageOpensPerSeries']).toBe(0);
    });

    it('counts only the first throw of the 10th as a strike, so a perfect game reports ten', () => {
      const throwsPerFrame = [...Array.from({ length: 9 }, () => [10]), [10, 10, 10]];
      const games = [makeGame({ gameId: 'g1', seriesId: 's', totalScore: 300, frames: framesFrom(throwsPerFrame) })];

      calculator.calculateSeriesStats(games);

      expect(calculator.seriesStats['totalStrikes']).toBe(10);
    });

    it('reports zeroes for a history without series', () => {
      const stats = calculator.calculateSeriesStats([mixedGame(undefined, 200, 'single')]);

      expect(stats.average3SeriesScore).toBe(0);
      expect(stats.high3Series).toBe(0);
      expect(calculator.seriesStats['totalSeries']).toBe(0);
      expect(calculator.seriesStats['averageSeriesScore']).toBe(0);
    });

    it('leaves game-level fields on the returned stats zeroed', () => {
      const stats = calculator.calculateSeriesStats(series('s3', 3, 100));

      expect(stats.totalGames).toBe(0);
      expect(stats.totalPins).toBe(0);
      expect(stats.averageScore).toBe(0);
    });
  });

  describe('mergeSeriesLiveStats', () => {
    const frameStats = { totalStrikes: 12, totalSpares: 4, totalGames: 0 } as Stats;

    it('overlays the game-level aggregates onto the frame stats', () => {
      const merged = calculator.mergeSeriesLiveStats(frameStats, { averageScore: 180, highGame: 220, lowGame: 140 }, 3);

      expect(merged).toMatchObject({ totalStrikes: 12, totalSpares: 4, totalGames: 3, averageScore: 180, highGame: 220, lowGame: 140 });
    });

    it('defaults missing game aggregates to zero', () => {
      const merged = calculator.mergeSeriesLiveStats(frameStats, {}, 2);

      expect(merged).toMatchObject({ totalGames: 2, averageScore: 0, highGame: 0, lowGame: 0, cleanGameCount: 0, perfectGameCount: 0 });
    });

    it('does not mutate the frame stats it merges into', () => {
      calculator.mergeSeriesLiveStats(frameStats, { averageScore: 180 }, 3);

      expect(frameStats.totalGames).toBe(0);
    });
  });
});
