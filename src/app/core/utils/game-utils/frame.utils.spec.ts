import { Frame, Game } from 'src/app/core/models/game.model';
import { makeGame } from 'src/testing/fixtures';

import {
  calculateIsClean,
  cloneFrames,
  cloneGame,
  createEmptyFrame,
  createEmptyFrames,
  createEmptyGame,
  createThrow,
  getThrowValue,
  getThrowValues,
  isAllFramesComplete,
  isFrameComplete,
  isSpare,
  isStrike,
  numberArraysToFrames,
  recordThrow,
  removeThrow,
  removeThrowFromFrame,
  setThrowInFrame,
  toCompletedFramesGame,
} from './frame.utils';

/** Frame built from raw throw values, throwIndex assigned 1-based like the app does. */
function frame(frameIndex: number, values: number[]): Frame {
  return { frameIndex, throws: values.map((value, i) => createThrow(value, i + 1)) };
}

describe('frame.utils', () => {
  describe('createThrow', () => {
    it('keeps value and throwIndex as passed', () => {
      expect(createThrow(7, 2)).toEqual({ value: 7, throwIndex: 2 });
    });
  });

  describe('createEmptyFrame / createEmptyFrames', () => {
    it('creates a frame with no throws', () => {
      expect(createEmptyFrame(3)).toEqual({ frameIndex: 3, throws: [] });
    });

    it('creates ten 1-based frames', () => {
      const frames = createEmptyFrames();

      expect(frames).toHaveLength(10);
      expect(frames.map((f) => f.frameIndex)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      expect(frames.every((f) => f.throws.length === 0)).toBe(true);
    });
  });

  describe('createEmptyGame', () => {
    it('starts as an empty practice game with ten frames', () => {
      const game = createEmptyGame();

      expect(game.frames).toHaveLength(10);
      expect(game.totalScore).toBe(0);
      expect(game.isPractice).toBe(true);
      expect(game.isClean).toBe(false);
      expect(game.isPerfect).toBe(false);
      expect(game.patterns).toEqual([]);
      expect(game.balls).toEqual([]);
    });
  });

  describe('getThrowValue', () => {
    it('returns the value at the index', () => {
      expect(getThrowValue(frame(1, [7, 2]), 1)).toBe(2);
    });

    it('returns undefined for a missing frame', () => {
      expect(getThrowValue(undefined, 0)).toBeUndefined();
    });

    it('returns undefined for an out-of-range index', () => {
      expect(getThrowValue(frame(1, [7]), 1)).toBeUndefined();
      expect(getThrowValue(frame(1, [7]), -1)).toBeUndefined();
    });
  });

  describe('getThrowValues', () => {
    it('maps the frame to its raw values', () => {
      expect(getThrowValues(frame(10, [10, 10, 7]))).toEqual([10, 10, 7]);
    });

    it('returns an empty array for a missing frame', () => {
      expect(getThrowValues(undefined)).toEqual([]);
    });
  });

  describe('isStrike', () => {
    it('is true when the first throw knocks all ten', () => {
      expect(isStrike(frame(1, [10]))).toBe(true);
    });

    it('is false for anything else', () => {
      expect(isStrike(frame(1, [9, 1]))).toBe(false);
      expect(isStrike(frame(1, []))).toBe(false);
      expect(isStrike(undefined)).toBe(false);
    });
  });

  describe('isSpare', () => {
    it('is true when two throws sum to ten', () => {
      expect(isSpare(frame(1, [7, 3]))).toBe(true);
      expect(isSpare(frame(1, [0, 10]))).toBe(true);
    });

    it('is false for a strike', () => {
      expect(isSpare(frame(10, [10, 0]))).toBe(false);
    });

    it('is false when the frame is unfinished', () => {
      expect(isSpare(frame(1, [7]))).toBe(false);
    });
  });

  describe('isFrameComplete', () => {
    it('completes frames 1-9 on a strike', () => {
      expect(isFrameComplete(frame(1, [10]), 0)).toBe(true);
    });

    it('completes frames 1-9 after two throws', () => {
      expect(isFrameComplete(frame(1, [4, 3]), 0)).toBe(true);
      expect(isFrameComplete(frame(1, [4]), 0)).toBe(false);
    });

    it('needs a third throw in the 10th after a strike or spare', () => {
      expect(isFrameComplete(frame(10, [10, 10]), 9)).toBe(false);
      expect(isFrameComplete(frame(10, [10, 10, 10]), 9)).toBe(true);
      expect(isFrameComplete(frame(10, [7, 3]), 9)).toBe(false);
      expect(isFrameComplete(frame(10, [7, 3, 5]), 9)).toBe(true);
    });

    it('completes an open 10th after two throws', () => {
      expect(isFrameComplete(frame(10, [7, 2]), 9)).toBe(true);
    });

    it('is false without a frame', () => {
      expect(isFrameComplete(undefined, 0)).toBe(false);
    });
  });

  describe('isAllFramesComplete', () => {
    it('is driven by the 10th frame', () => {
      const frames = createEmptyFrames();
      frames[9] = frame(10, [10, 10, 10]);

      expect(isAllFramesComplete(makeGame({ frames }))).toBe(true);
    });

    it('is false when fewer than ten frames exist', () => {
      expect(isAllFramesComplete(makeGame({ frames: [frame(1, [10])] }))).toBe(false);
    });
  });

  describe('calculateIsClean', () => {
    it('is true for a game of strikes and spares', () => {
      const frames = Array.from({ length: 9 }, (_, i) => frame(i + 1, [10]));
      frames.push(frame(10, [7, 3, 10]));

      expect(calculateIsClean(frames)).toBe(true);
    });

    it('is false when an open frame exists', () => {
      const frames = Array.from({ length: 9 }, (_, i) => frame(i + 1, [10]));
      frames[4] = frame(5, [7, 2]);
      frames.push(frame(10, [10, 10, 10]));

      expect(calculateIsClean(frames)).toBe(false);
    });

    it('ignores frames that have not been thrown yet', () => {
      const frames = [frame(1, [10]), createEmptyFrame(2)];

      expect(calculateIsClean(frames)).toBe(true);
    });

    it('is false for an open 10th frame', () => {
      const frames = Array.from({ length: 9 }, (_, i) => frame(i + 1, [10]));
      frames.push(frame(10, [7, 2]));

      expect(calculateIsClean(frames)).toBe(false);
    });
  });

  describe('setThrowInFrame', () => {
    it('sets the value and 1-based throwIndex', () => {
      const target = frame(1, [4]);

      setThrowInFrame(target, 1, 6);

      expect(target.throws[1]).toEqual({ value: 6, throwIndex: 2 });
    });

    it('pads with zero throws when writing past the end', () => {
      const target = createEmptyFrame(10);

      setThrowInFrame(target, 2, 9);

      expect(target.throws.map((t) => t.value)).toEqual([0, 0, 9]);
    });
  });

  describe('removeThrowFromFrame', () => {
    it('removes the throw and renumbers the rest', () => {
      const target = frame(10, [10, 7, 3]);

      removeThrowFromFrame(target, 0);

      expect(target.throws.map((t) => t.value)).toEqual([7, 3]);
      expect(target.throws.map((t) => t.throwIndex)).toEqual([1, 2]);
    });

    it('ignores an out-of-range index', () => {
      const target = frame(1, [4, 3]);

      removeThrowFromFrame(target, 5);

      expect(target.throws).toHaveLength(2);
    });
  });

  describe('recordThrow', () => {
    it('writes into the addressed frame', () => {
      const frames = createEmptyFrames();

      recordThrow(frames, 2, 0, 10);

      expect(frames[2].throws).toEqual([{ value: 10, throwIndex: 1 }]);
    });

    it('does nothing for a missing frame', () => {
      const frames = createEmptyFrames();

      expect(() => recordThrow(frames, 42, 0, 10)).not.toThrow();
    });
  });

  describe('removeThrow', () => {
    it('removes and renumbers within the frames array', () => {
      const frames = createEmptyFrames();
      frames[0] = frame(1, [4, 3]);

      removeThrow(frames, 0, 0);

      expect(frames[0].throws).toEqual([{ value: 3, throwIndex: 1 }]);
    });

    it('does nothing for a missing frame', () => {
      expect(() => removeThrow(createEmptyFrames(), 42, 0)).not.toThrow();
    });
  });

  describe('toCompletedFramesGame', () => {
    it('keeps only completed frames and the matching running score', () => {
      const frames = createEmptyFrames();
      frames[0] = frame(1, [10]);
      frames[1] = frame(2, [7, 3]);
      frames[2] = frame(3, [4]);
      const game = makeGame({ frames, frameScores: [20, 34, 0, 0, 0, 0, 0, 0, 0, 0], totalScore: 34 });

      const result = toCompletedFramesGame(game);

      expect(result.frames).toHaveLength(2);
      expect(result.totalScore).toBe(34);
    });

    it('scores zero when nothing is complete', () => {
      const result = toCompletedFramesGame(makeGame({ frames: createEmptyFrames() }));

      expect(result.frames).toHaveLength(0);
      expect(result.totalScore).toBe(0);
    });
  });

  describe('cloneFrames', () => {
    it('deep-copies frames and their throws', () => {
      const frames = [frame(1, [4, 3])];

      const copy = cloneFrames(frames);
      copy[0].throws[0].value = 9;

      expect(frames[0].throws[0].value).toBe(4);
    });
  });

  describe('cloneGame', () => {
    const game: Game = makeGame({ frames: [frame(1, [4, 3])], patterns: ['Shark'], balls: ['Hammer'] });

    it('deep-copies frames, scores, patterns and balls', () => {
      const copy = cloneGame(game);

      copy.frames[0].throws[0].value = 9;
      copy.frameScores[0] = 99;
      copy.patterns.push('Cheetah');
      copy.balls!.push('Spare');

      expect(game.frames[0].throws[0].value).toBe(4);
      expect(game.frameScores[0]).toBe(0);
      expect(game.patterns).toEqual(['Shark']);
      expect(game.balls).toEqual(['Hammer']);
    });

    it('keeps balls undefined when the game has none', () => {
      expect(cloneGame(makeGame({ balls: undefined })).balls).toBeUndefined();
    });
  });

  describe('numberArraysToFrames', () => {
    it('converts legacy number arrays into 1-based frames and throws', () => {
      const frames = numberArraysToFrames([[10], [7, 3]]);

      expect(frames).toEqual([
        { frameIndex: 1, throws: [{ value: 10, throwIndex: 1 }] },
        {
          frameIndex: 2,
          throws: [
            { value: 7, throwIndex: 1 },
            { value: 3, throwIndex: 2 },
          ],
        },
      ]);
    });
  });
});
