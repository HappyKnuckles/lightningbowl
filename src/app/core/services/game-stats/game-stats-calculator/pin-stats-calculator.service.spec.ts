import { TestBed } from '@angular/core/testing';
import { Frame, Game, Throw } from 'src/app/core/models/game.model';
import { LeaveStats } from 'src/app/core/models/stats.model';
import { makeGame } from 'src/testing/fixtures';

import { PinStatsCalculatorService } from './pin-stats-calculator.service';

/** One recorded throw with the pin data pin mode writes. */
function pinThrow(value: number, throwIndex: number, pinsLeftStanding?: number[]): Throw {
  return { value, throwIndex, ...(pinsLeftStanding ? { pinsLeftStanding } : {}) };
}

/** Pin-mode game whose frames are built from the given throw lists, padded to ten frames. */
function pinGame(throwsPerFrame: Throw[][], overrides: Partial<Game> = {}): Game {
  const frames: Frame[] = Array.from({ length: 10 }, (_, i) => ({ frameIndex: i + 1, throws: throwsPerFrame[i] ?? [] }));
  return makeGame({ isPinMode: true, frames, ...overrides });
}

/** A frame leaving `pins` standing, converted or not depending on `pickedUp`. */
function leaveFrame(pins: number[], pickedUp: boolean): Throw[] {
  const first = pinThrow(10 - pins.length, 1, pins);
  return [first, pinThrow(pickedUp ? pins.length : 0, 2)];
}

function leave(overrides: Partial<LeaveStats> = {}): LeaveStats {
  return { pins: [10], occurrences: 2, pickups: 1, pickupPercentage: 50, ...overrides };
}

/** `calculateAllLeaves` also returns the miss rate, which `LeaveStats` does not declare. */
type LeaveResult = LeaveStats & { missPercentage: number };

describe('PinStatsCalculatorService', () => {
  let calculator: PinStatsCalculatorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    calculator = TestBed.inject(PinStatsCalculatorService);
  });

  describe('calculateAllLeaves', () => {
    it('counts occurrences and pickups per leave', () => {
      const game = pinGame([leaveFrame([10], true), leaveFrame([10], false), leaveFrame([7], true)]);

      const leaves = calculator.calculateAllLeaves([game]) as LeaveResult[];

      expect(leaves).toHaveLength(2);
      expect(leaves.find((l) => l.pins.join() === '10')).toMatchObject({ occurrences: 2, pickups: 1, pickupPercentage: 50, missPercentage: 50 });
      expect(leaves.find((l) => l.pins.join() === '7')).toMatchObject({ occurrences: 1, pickups: 1, pickupPercentage: 100, missPercentage: 0 });
    });

    it('treats the same pins in any order as one leave', () => {
      const game = pinGame([
        [pinThrow(8, 1, [7, 10]), pinThrow(0, 2)],
        [pinThrow(8, 1, [10, 7]), pinThrow(0, 2)],
      ]);

      const leaves = calculator.calculateAllLeaves([game]);

      expect(leaves).toHaveLength(1);
      expect(leaves[0]).toMatchObject({ pins: [7, 10], occurrences: 2 });
    });

    it('ignores games that were not scored in pin mode', () => {
      const game = pinGame([leaveFrame([10], true)], { isPinMode: false });

      expect(calculator.calculateAllLeaves([game])).toEqual([]);
    });

    it('ignores strikes and throws without pin data', () => {
      const game = pinGame([[pinThrow(10, 1, [])], [pinThrow(6, 1), pinThrow(4, 2)]]);

      expect(calculator.calculateAllLeaves([game])).toEqual([]);
    });

    it('counts an unfinished frame as a missed leave', () => {
      const game = pinGame([[pinThrow(9, 1, [10])]]);

      expect(calculator.calculateAllLeaves([game])[0]).toMatchObject({ occurrences: 1, pickups: 0 });
    });

    it('records the leave after a strike in the 10th', () => {
      const tenth = [pinThrow(10, 1, []), pinThrow(9, 2, [10]), pinThrow(1, 3)];
      const game = pinGame([[], [], [], [], [], [], [], [], [], tenth]);

      const leaves = calculator.calculateAllLeaves([game]);

      expect(leaves).toHaveLength(1);
      expect(leaves[0]).toMatchObject({ pins: [10], occurrences: 1, pickups: 1 });
    });

    it('aggregates the same leave across games', () => {
      const games = [pinGame([leaveFrame([10], true)], { gameId: 'g1' }), pinGame([leaveFrame([10], false)], { gameId: 'g2' })];

      expect(calculator.calculateAllLeaves(games)[0]).toMatchObject({ occurrences: 2, pickups: 1 });
    });
  });

  describe('getMostCommonLeaves', () => {
    it('sorts by occurrences and caps the list at ten', () => {
      const leaves = Array.from({ length: 12 }, (_, i) => leave({ pins: [i + 1], occurrences: i + 1 }));

      const common = calculator.getMostCommonLeaves(leaves);

      expect(common).toHaveLength(10);
      expect(common[0].occurrences).toBe(12);
      expect(common.at(-1)!.occurrences).toBe(3);
    });

    it('does not mutate the input list', () => {
      const leaves = [leave({ pins: [7], occurrences: 1 }), leave({ pins: [10], occurrences: 5 })];

      calculator.getMostCommonLeaves(leaves);

      expect(leaves[0].pins).toEqual([7]);
    });
  });

  describe('getBestSpares', () => {
    it('returns the best single-pin and the best multi-pin leave', () => {
      const leaves = [
        leave({ pins: [10], occurrences: 10, pickups: 9, pickupPercentage: 90 }),
        leave({ pins: [7], occurrences: 10, pickups: 3, pickupPercentage: 30 }),
        leave({ pins: [3, 10], occurrences: 10, pickups: 6, pickupPercentage: 60 }),
        leave({ pins: [4, 6], occurrences: 10, pickups: 1, pickupPercentage: 10 }),
      ];

      const best = calculator.getBestSpares(leaves);

      expect(best.map((l) => l.pins)).toEqual([[10], [3, 10]]);
    });

    it('skips leaves that are too rare or never converted', () => {
      const leaves = [leave({ pins: [10], occurrences: 1, pickups: 1 }), leave({ pins: [4, 6], occurrences: 10, pickups: 0 })];

      expect(calculator.getBestSpares(leaves)).toEqual([]);
    });

    it('prefers the better rate over the raw percentage on thin samples', () => {
      const leaves = [
        leave({ pins: [10], occurrences: 2, pickups: 2, pickupPercentage: 100 }),
        leave({ pins: [7], occurrences: 20, pickups: 18, pickupPercentage: 90 }),
      ];

      expect(calculator.getBestSpares(leaves)[0].pins).toEqual([7]);
    });
  });

  describe('getWorstSpares', () => {
    it('returns the worst single-pin and the worst multi-pin leave', () => {
      const leaves = [
        leave({ pins: [10], occurrences: 10, pickups: 9 }),
        leave({ pins: [7], occurrences: 10, pickups: 1 }),
        leave({ pins: [3, 10], occurrences: 10, pickups: 6 }),
        leave({ pins: [4, 6], occurrences: 10, pickups: 1 }),
      ];

      const worst = calculator.getWorstSpares(leaves);

      expect(worst.map((l) => l.pins)).toEqual([[7], [4, 6]]);
    });

    it('skips leaves that are too rare or always converted', () => {
      const leaves = [leave({ pins: [10], occurrences: 1, pickups: 0 }), leave({ pins: [4, 6], occurrences: 10, pickups: 10 })];

      expect(calculator.getWorstSpares(leaves)).toEqual([]);
    });
  });

  describe('getLeaveAnalytics', () => {
    it('bundles common, best and worst leaves from the game history', () => {
      const games = [
        pinGame([leaveFrame([10], true), leaveFrame([10], true), leaveFrame([4, 6], false), leaveFrame([4, 6], false)], { gameId: 'g1' }),
      ];

      const analytics = calculator.getLeaveAnalytics(games);

      expect(analytics.common.map((l) => l.pins)).toEqual([[10], [4, 6]]);
      expect(analytics.best.map((l) => l.pins)).toEqual([[10]]);
      expect(analytics.worst.map((l) => l.pins)).toEqual([[4, 6]]);
    });

    it('returns empty buckets without pin-mode games', () => {
      expect(calculator.getLeaveAnalytics([])).toEqual({ common: [], best: [], worst: [] });
    });
  });
});
