import { TestBed } from '@angular/core/testing';

import { Frame } from '../../models/game.model';
import { numberArraysToFrames } from '../../utils/game-utils/frame.utils';
import { GameScoreCalculatorService } from './game-score-calculator.service';

/** Nine strike frames — the lead-in every strike-heavy scenario shares. */
const nineStrikes = () => Array.from({ length: 9 }, () => [10]);

describe('GameScoreCalculatorService', () => {
  let service: GameScoreCalculatorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GameScoreCalculatorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('calculateScoreFromFrames', () => {
    describe('missing or partial input', () => {
      it('returns a zero score for an empty frame list', () => {
        expect(service.calculateScoreFromFrames([])).toEqual({ totalScore: 0, frameScores: [] });
      });

      it('guards against a null frame list', () => {
        expect(service.calculateScoreFromFrames(null as unknown as Frame[])).toEqual({ totalScore: 0, frameScores: [] });
      });

      it('carries the running total through frames that have not been bowled yet', () => {
        const frames = numberArraysToFrames([
          [3, 4],
          [2, 5],
        ]);

        const { totalScore, frameScores } = service.calculateScoreFromFrames(frames);

        expect(totalScore).toBe(14);
        // Always ten entries — unbowled frames repeat the running total rather than dropping out.
        expect(frameScores).toEqual([7, 14, 14, 14, 14, 14, 14, 14, 14, 14]);
      });

      it('scores a frame that is still mid-throw with only the pins already down', () => {
        const frames = numberArraysToFrames([[10], [5]]);

        const { totalScore, frameScores } = service.calculateScoreFromFrames(frames);

        // Strike bonus has only one throw to draw on (5), and the open frame counts its single 5.
        expect(totalScore).toBe(20);
        expect(frameScores[0]).toBe(15);
      });
    });

    describe('complete games', () => {
      it('scores twelve strikes as a 300', () => {
        const frames = numberArraysToFrames([...nineStrikes(), [10, 10, 10]]);

        const { totalScore, frameScores } = service.calculateScoreFromFrames(frames);

        expect(totalScore).toBe(300);
        expect(frameScores).toEqual([30, 60, 90, 120, 150, 180, 210, 240, 270, 300]);
      });

      it('scores a gutter game as 0', () => {
        const frames = numberArraysToFrames(Array.from({ length: 10 }, () => [0, 0]));

        const { totalScore, frameScores } = service.calculateScoreFromFrames(frames);

        expect(totalScore).toBe(0);
        expect(frameScores).toEqual(Array(10).fill(0));
      });

      it('scores every frame open at nine as a 90', () => {
        const frames = numberArraysToFrames(Array.from({ length: 10 }, () => [9, 0]));

        expect(service.calculateScoreFromFrames(frames).totalScore).toBe(90);
      });

      it('scores nine-spares with a nine on the fill ball as a 190', () => {
        const frames = numberArraysToFrames([...Array.from({ length: 9 }, () => [9, 1]), [9, 1, 9]]);

        const { totalScore, frameScores } = service.calculateScoreFromFrames(frames);

        expect(totalScore).toBe(190);
        expect(frameScores).toEqual([19, 38, 57, 76, 95, 114, 133, 152, 171, 190]);
      });

      it('scores a mixed game of strikes, spares and open frames', () => {
        const frames = numberArraysToFrames([[10], [9, 1], [5, 5], [7, 2], [10], [10], [10], [0, 0], [8, 2], [9, 1, 10]]);

        const { totalScore, frameScores } = service.calculateScoreFromFrames(frames);

        expect(totalScore).toBe(160);
        expect(frameScores).toEqual([20, 35, 52, 61, 91, 111, 121, 121, 140, 160]);
      });
    });

    describe('bonus rules', () => {
      it('adds the next two throws to a strike', () => {
        const frames = numberArraysToFrames([[10], [3, 4]]);

        // 10 + 3 + 4 = 17, then the open frame adds its own 7.
        expect(service.calculateScoreFromFrames(frames).frameScores[0]).toBe(17);
      });

      it('adds only the next throw to a spare', () => {
        const frames = numberArraysToFrames([
          [5, 5],
          [7, 2],
        ]);

        expect(service.calculateScoreFromFrames(frames).frameScores[0]).toBe(17);
      });

      it('carries a strike bonus across two following frames', () => {
        const frames = numberArraysToFrames([[10], [10], [10], [3, 2]]);

        const { totalScore, frameScores } = service.calculateScoreFromFrames(frames);

        // 30 / 23 / 15 / 5 — each strike reaching forward for the next two throws.
        expect(frameScores.slice(0, 4)).toEqual([30, 53, 68, 73]);
        expect(totalScore).toBe(73);
      });

      it('lets a spare draw its bonus from a following strike', () => {
        const frames = numberArraysToFrames([[5, 5], [10], [2, 3]]);

        const { totalScore, frameScores } = service.calculateScoreFromFrames(frames);

        expect(frameScores.slice(0, 3)).toEqual([20, 35, 40]);
        expect(totalScore).toBe(40);
      });

      it('sums the tenth frame without awarding it a further bonus', () => {
        const frames = numberArraysToFrames([...nineStrikes(), [10, 5, 5]]);

        const { totalScore, frameScores } = service.calculateScoreFromFrames(frames);

        // Ninth frame only reaches the first two balls of the tenth (10 + 5).
        expect(frameScores[8]).toBe(265);
        expect(totalScore).toBe(285);
      });

      it('scores a spare in the tenth frame with a strike on the fill ball', () => {
        const frames = numberArraysToFrames([...nineStrikes(), [9, 1, 10]]);

        expect(service.calculateScoreFromFrames(frames).totalScore).toBe(279);
      });
    });
  });

  describe('calculateMaxScoreFromFrames', () => {
    it('stays at 300 before a ball has been thrown', () => {
      expect(service.calculateMaxScoreFromFrames([], 0)).toBe(300);
      expect(service.calculateMaxScoreFromFrames(numberArraysToFrames([[], []]), 0)).toBe(300);
    });

    it('keeps 300 alive while the first frame is a strike', () => {
      expect(service.calculateMaxScoreFromFrames(numberArraysToFrames([[10]]), 10)).toBe(300);
    });

    it('drops to 290 once the first frame is a spare', () => {
      // A spare in frame one caps the game at 290 even if every later ball strikes.
      expect(service.calculateMaxScoreFromFrames(numberArraysToFrames([[5, 5]]), 10)).toBe(290);
    });

    it('drops to 277 once the first frame is left open on seven', () => {
      // 7 pins in frame one, then a strike-out from frame two, tops out at 277.
      expect(service.calculateMaxScoreFromFrames(numberArraysToFrames([[3, 4]]), 7)).toBe(277);
    });

    it('sheds eleven points for each further nine-spare', () => {
      const spare = [9, 1];

      expect(service.calculateMaxScoreFromFrames(numberArraysToFrames([spare]), 0)).toBe(290);
      expect(service.calculateMaxScoreFromFrames(numberArraysToFrames([spare, spare]), 0)).toBe(279);
      expect(service.calculateMaxScoreFromFrames(numberArraysToFrames([spare, spare, spare]), 0)).toBe(268);
    });

    it('reaches 202 after nine nine-spares', () => {
      const frames = numberArraysToFrames(Array.from({ length: 9 }, () => [9, 1]));

      expect(service.calculateMaxScoreFromFrames(frames, 0)).toBe(202);
    });

    it('settles on the actual score once the tenth frame is complete', () => {
      const perfect = numberArraysToFrames([...nineStrikes(), [10, 10, 10]]);
      const spareFinish = numberArraysToFrames([...nineStrikes(), [9, 1, 10]]);

      expect(service.calculateMaxScoreFromFrames(perfect, 300)).toBe(300);
      // Game is over — nothing is still possible, so the max collapses onto the real total.
      expect(service.calculateMaxScoreFromFrames(spareFinish, 279)).toBe(279);
    });
  });
});
