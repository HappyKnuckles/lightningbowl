import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Ball } from 'src/app/core/models/ball.model';
import { Frame, Game } from 'src/app/core/models/game.model';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { makeBall, makeGame } from 'src/testing/fixtures';
import { BallStatsCalculatorService } from './ball-stats-calculator.service';

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

describe('BallStatsCalculatorService', () => {
  let calculator: BallStatsCalculatorService;
  const allBalls = signal<Ball[]>([]);

  beforeEach(() => {
    allBalls.set([]);
    TestBed.configureTestingModule({
      providers: [{ provide: BallsStore, useValue: { allBalls } }],
    });
    calculator = TestBed.inject(BallStatsCalculatorService);
  });

  describe('calculateAllBallStats', () => {
    it('aggregates count, average and high/low per ball', () => {
      const games = [
        makeGame({ gameId: 'g1', totalScore: 200, balls: ['Hammer'] }),
        makeGame({ gameId: 'g2', totalScore: 150, balls: ['Hammer', 'Spare'] }),
        makeGame({ gameId: 'g3', totalScore: 100, balls: ['Spare'] }),
      ];

      const stats = calculator.calculateAllBallStats(games);

      expect(stats).toHaveLength(2);
      expect(stats.find((s) => s.name === 'Hammer')).toMatchObject({ gameCount: 2, avg: 175, highestGame: 200, lowestGame: 150 });
      expect(stats.find((s) => s.name === 'Spare')).toMatchObject({ gameCount: 2, avg: 125, highestGame: 150, lowestGame: 100 });
    });

    it('counts a ball once per game even when listed twice', () => {
      const games = [makeGame({ totalScore: 200, balls: ['Hammer', 'Hammer'] })];

      expect(calculator.calculateAllBallStats(games)[0].gameCount).toBe(1);
    });

    it('ignores games without balls', () => {
      const games = [makeGame({ gameId: 'g1', totalScore: 200 }), makeGame({ gameId: 'g2', totalScore: 200, balls: [] })];

      expect(calculator.calculateAllBallStats(games)).toEqual([]);
    });

    it('counts clean games per ball', () => {
      const games = [
        makeGame({ gameId: 'g1', totalScore: 200, isClean: true, balls: ['Hammer'] }),
        makeGame({ gameId: 'g2', totalScore: 150, isClean: false, balls: ['Hammer'] }),
      ];

      expect(calculator.calculateAllBallStats(games)[0].cleanGameCount).toBe(1);
    });

    it('rates strikes against the twelve possible per game', () => {
      const games = [makeGame({ totalScore: 300, frames: framesWithStrikes(9, [10, 10, 10]), balls: ['Hammer'] })];

      expect(calculator.calculateAllBallStats(games)[0].strikeRate).toBe(100);
    });

    it('counts each strike in the 10th separately', () => {
      const games = [makeGame({ totalScore: 200, frames: framesWithStrikes(0, [10, 10, 4]), balls: ['Hammer'] })];

      expect(calculator.calculateAllBallStats(games)[0].strikeRate).toBe(17);
    });

    it('attaches the ball image from the store', () => {
      allBalls.set([makeBall({ ball_name: 'Hammer', ball_image: 'hammer.png' })]);

      const stats = calculator.calculateAllBallStats([makeGame({ totalScore: 200, balls: ['Hammer'] })]);

      expect(stats[0].image).toBe('hammer.png');
    });

    it('falls back to an empty image for an unknown ball', () => {
      const stats = calculator.calculateAllBallStats([makeGame({ totalScore: 200, balls: ['Unknown'] })]);

      expect(stats[0].image).toBe('');
    });
  });

  describe('calculateBestBallStats', () => {
    const games: Game[] = [
      makeGame({ gameId: 'g1', totalScore: 220, balls: ['Hammer'] }),
      makeGame({ gameId: 'g2', totalScore: 140, balls: ['Spare'] }),
      makeGame({ gameId: 'g3', totalScore: 140, balls: ['Spare'] }),
    ];

    it('picks the ball with the highest average', () => {
      expect(calculator.calculateBestBallStats(games).name).toBe('Hammer');
    });

    it('returns an empty highlight without games', () => {
      expect(calculator.calculateBestBallStats([]).name).toBe('');
    });
  });

  describe('calculateMostPlayedBallStats', () => {
    const games: Game[] = [
      makeGame({ gameId: 'g1', totalScore: 220, balls: ['Hammer'] }),
      makeGame({ gameId: 'g2', totalScore: 140, balls: ['Spare'] }),
      makeGame({ gameId: 'g3', totalScore: 140, balls: ['Spare'] }),
    ];

    it('picks the ball thrown in the most games', () => {
      expect(calculator.calculateMostPlayedBallStats(games).name).toBe('Spare');
    });

    it('returns an empty highlight without games', () => {
      expect(calculator.calculateMostPlayedBallStats([]).name).toBe('');
    });
  });
});
