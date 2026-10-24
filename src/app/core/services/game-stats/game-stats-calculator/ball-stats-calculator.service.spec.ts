import { BALL_PLACEHOLDER_IMAGE } from 'src/app/core/utils/ball-utils/ball-image.utils';
import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Ball } from 'src/app/core/models/ball.model';
import { Frame, Game } from 'src/app/core/models/game.model';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { makeBall, makeFrame, makeFrames, makeGame, makeThrow } from 'src/testing/fixtures';
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
  const arsenal = signal<Ball[]>([]);

  beforeEach(() => {
    allBalls.set([]);
    arsenal.set([]);
    TestBed.configureTestingModule({
      // the calculator resolves stored ball names against the store's known balls
      providers: [{ provide: BallsStore, useValue: { knownBalls: computed(() => [...allBalls(), ...arsenal()]), url: '' } }],
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

    it('credits a game-tracked game to its selection, not to balls left on its throws', () => {
      const frames = framesWithStrikes(9, [10, 10, 10]).map((frame) => ({
        ...frame,
        throws: frame.throws.map((t) => ({ ...t, ball: { name: 'Phaze II' } })),
      }));
      const games = [makeGame({ totalScore: 300, frames, balls: ['Hammer'], ballTracking: 'game' })];

      const stats = calculator.calculateAllBallStats(games);

      expect(stats.map((s) => s.name)).toEqual(['Hammer']);
      expect(stats[0].strikeRate).toBe(100);
    });

    it('attaches the ball image from the store as an absolute URL', () => {
      allBalls.set([makeBall({ ball_name: 'Hammer', ball_image: '/hammer.png' })]);

      const stats = calculator.calculateAllBallStats([makeGame({ totalScore: 200, balls: ['Hammer'] })]);

      expect(stats[0].image).toBe('https://bowwwl.com/hammer.png');
    });

    it('shows balls stored with their weight as "Name 15lbs", with the image of the ball', () => {
      allBalls.set([makeBall({ ball_name: 'Phaze II', ball_image: '/phaze.png' })]);

      const stats = calculator.calculateAllBallStats([
        makeGame({ totalScore: 200, balls: ['Phaze II15'] }),
        makeGame({ totalScore: 220, balls: ['Phaze II 15lbs'] }),
      ]);

      expect(stats).toHaveLength(1);
      expect(stats[0].name).toBe('Phaze II 15lbs');
      expect(stats[0].gameCount).toBe(2);
      expect(stats[0].image).toBe('https://bowwwl.com/phaze.png');
    });

    it('falls back to the placeholder image for an unknown ball', () => {
      const stats = calculator.calculateAllBallStats([makeGame({ totalScore: 200, balls: ['Unknown'] })]);

      expect(stats[0].image).toBe(BALL_PLACEHOLDER_IMAGE);
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

  describe('calculateBallStats', () => {
    /** A per-throw tracked game with the given first balls, one per frame. */
    function throwTrackedGame(firstBalls: { ball: string; pinsLeft: number[] }[], overrides: Partial<Game> = {}): Game {
      const frames = makeFrames();
      firstBalls.forEach((entry, index) => {
        frames[index] = makeFrame(index, [makeThrow(0, entry.pinsLeft, { ball: { name: entry.ball, weight: '15' } })]);
      });
      return makeGame({ frames, isPinMode: true, ballTracking: 'throw', ...overrides });
    }

    it('marks a game-tracked ball as basic and leaves it without detail', () => {
      const stats = calculator.calculateBallStats([makeGame({ totalScore: 200, balls: ['Hammer'], ballTracking: 'game' })]);

      expect(stats).toHaveLength(1);
      expect(stats[0].tier).toBe('basic');
      expect(stats[0].detail).toBeUndefined();
      expect(stats[0].detailedGameCount).toBe(0);
    });

    it('marks a throw-tracked ball as detailed and attaches its per-throw stats', () => {
      const game = throwTrackedGame(
        [
          { ball: 'Hammer', pinsLeft: [] },
          { ball: 'Hammer', pinsLeft: [10] },
        ],
        { totalScore: 180 },
      );

      const stats = calculator.calculateBallStats([game]);

      expect(stats[0].tier).toBe('detailed');
      expect(stats[0].detailedGameCount).toBe(1);
      expect(stats[0].detail?.firstBalls).toBe(2);
      expect(stats[0].detail?.strikePercentage).toBe(50);
    });

    it('keeps the game-level average alongside the per-throw projection', () => {
      const game = throwTrackedGame([{ ball: 'Hammer', pinsLeft: [] }], {
        totalScore: 200,
        frameScores: [30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
      });

      const stats = calculator.calculateBallStats([game]);

      // The game average still describes the games the ball appeared in; the projection
      // describes the frames it actually threw.
      expect(stats[0].avg).toBe(200);
      expect(stats[0].detail?.projectedAverage).toBe(300);
    });

    it('records when each ball was last used', () => {
      const games = [
        makeGame({ gameId: 'g1', date: 100, totalScore: 150, balls: ['Hammer'] }),
        makeGame({ gameId: 'g2', date: 500, totalScore: 150, balls: ['Hammer'] }),
      ];

      expect(calculator.calculateBallStats(games)[0].lastUsed).toBe(500);
    });
  });
});
