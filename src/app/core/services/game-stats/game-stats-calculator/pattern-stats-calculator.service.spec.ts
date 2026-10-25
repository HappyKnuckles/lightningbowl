import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Frame, Game } from 'src/app/core/models/game.model';
import { PatternsStore } from 'src/app/core/stores/patterns.store';
import { makeGame } from 'src/testing/fixtures';
import { PatternStatsCalculatorService } from './pattern-stats-calculator.service';

/** Nine strike frames plus a 10th built from the given values. */
function framesWithStrikes(strikeCount: number, tenth: number[] = [0, 0]): Frame[] {
  const frames: Frame[] = Array.from({ length: 9 }, (_, i) => ({
    frameIndex: i + 1,
    throws:
      i < strikeCount
        ? [{ value: 10, throwIndex: 1 }]
        : [
            { value: 0, throwIndex: 1 },
            { value: 0, throwIndex: 2 },
          ],
  }));
  frames.push({ frameIndex: 10, throws: tenth.map((value, i) => ({ value, throwIndex: i + 1 })) });
  return frames;
}

describe('PatternStatsCalculatorService', () => {
  let calculator: PatternStatsCalculatorService;
  const patternImageMap = signal<Record<string, string>>({});

  beforeEach(() => {
    patternImageMap.set({});
    TestBed.configureTestingModule({
      providers: [{ provide: PatternsStore, useValue: { patternImageMap } }],
    });
    calculator = TestBed.inject(PatternStatsCalculatorService);
  });

  describe('calculateAllPatternStats', () => {
    it('aggregates count, average and high/low per pattern', () => {
      const games = [
        makeGame({ gameId: 'g1', totalScore: 200, patterns: ['Shark'] }),
        makeGame({ gameId: 'g2', totalScore: 150, patterns: ['Shark', 'Cheetah'] }),
        makeGame({ gameId: 'g3', totalScore: 100, patterns: ['Cheetah'] }),
      ];

      const stats = calculator.calculateAllPatternStats(games);

      expect(stats).toHaveLength(2);
      expect(stats.find((s) => s.name === 'Shark')).toMatchObject({ gameCount: 2, avg: 175, highestGame: 200, lowestGame: 150 });
      expect(stats.find((s) => s.name === 'Cheetah')).toMatchObject({ gameCount: 2, avg: 125, highestGame: 150, lowestGame: 100 });
    });

    it('counts a pattern once per game even when listed twice', () => {
      const games = [makeGame({ totalScore: 200, patterns: ['Shark', 'Shark'] })];

      expect(calculator.calculateAllPatternStats(games)[0].gameCount).toBe(1);
    });

    it('ignores games without patterns', () => {
      expect(calculator.calculateAllPatternStats([makeGame({ totalScore: 200 })])).toEqual([]);
    });

    it('counts clean games per pattern', () => {
      const games = [
        makeGame({ gameId: 'g1', totalScore: 200, isClean: true, patterns: ['Shark'] }),
        makeGame({ gameId: 'g2', totalScore: 150, isClean: false, patterns: ['Shark'] }),
      ];

      expect(calculator.calculateAllPatternStats(games)[0].cleanGameCount).toBe(1);
    });

    it('rates strikes against the twelve possible per game', () => {
      const games = [makeGame({ totalScore: 300, frames: framesWithStrikes(9, [10, 10, 10]), patterns: ['Shark'] })];

      expect(calculator.calculateAllPatternStats(games)[0].strikeRate).toBe(100);
    });

    it('attaches the chart image from the store', () => {
      patternImageMap.set({ Shark: 'shark-chart.png' });

      const stats = calculator.calculateAllPatternStats([makeGame({ totalScore: 200, patterns: ['Shark'] })]);

      expect(stats[0].image).toBe('shark-chart.png');
    });

    it('falls back to an empty image for an unmapped pattern', () => {
      const stats = calculator.calculateAllPatternStats([makeGame({ totalScore: 200, patterns: ['Unmapped'] })]);

      expect(stats[0].image).toBe('');
    });
  });

  describe('best and most played patterns', () => {
    const games: Game[] = [
      makeGame({ gameId: 'g1', totalScore: 220, patterns: ['Shark'] }),
      makeGame({ gameId: 'g2', totalScore: 140, patterns: ['Cheetah'] }),
      makeGame({ gameId: 'g3', totalScore: 140, patterns: ['Cheetah'] }),
    ];

    it('picks the pattern with the highest average', () => {
      expect(calculator.calculateBestPatternStats(games).name).toBe('Shark');
    });

    it('picks the pattern played in the most games', () => {
      expect(calculator.calculateMostPlayedPatternStats(games).name).toBe('Cheetah');
    });

    it('returns empty highlights without games', () => {
      expect(calculator.calculateBestPatternStats([]).name).toBe('');
      expect(calculator.calculateMostPlayedPatternStats([]).name).toBe('');
    });
  });
});
