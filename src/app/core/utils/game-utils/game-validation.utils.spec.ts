import { Frame } from 'src/app/core/models/game.model';
import { makeGame } from 'src/testing/fixtures';

import { canRecordSpare, canRecordStrike, canUndoLastThrow, isGameValid, isValidFrameScore } from './game-validation.utils';

/** Frame built from raw throw values, throwIndex assigned 1-based like the app does. */
function frame(values: number[], frameIndex = 1): Frame {
  return { frameIndex, throws: values.map((value, i) => ({ value, throwIndex: i + 1 })) };
}

/** Ten frames with `values` placed in `frameIndex`. */
function framesWith(frameIndex: number, values: number[]): Frame[] {
  const frames: Frame[] = Array.from({ length: 10 }, (_, i) => ({ frameIndex: i + 1, throws: [] }));
  frames[frameIndex] = frame(values, frameIndex + 1);
  return frames;
}

/** Nine open frames plus the given 10th, i.e. a structurally valid game. */
function fullGameFrames(tenth: number[] = [7, 2]): Frame[] {
  const frames = Array.from({ length: 9 }, (_, i) => frame([4, 3], i + 1));
  frames.push(frame(tenth, 10));
  return frames;
}

describe('game-validation.utils', () => {
  describe('canRecordStrike', () => {
    it('only allows a strike on the first throw of frames 1-9', () => {
      expect(canRecordStrike(3, 0, framesWith(3, []))).toBe(true);
      expect(canRecordStrike(3, 1, framesWith(3, [4]))).toBe(false);
    });

    it('always allows a strike on the first throw of the 10th', () => {
      expect(canRecordStrike(9, 0, framesWith(9, []))).toBe(true);
    });

    it('allows a second strike in the 10th only after the first', () => {
      expect(canRecordStrike(9, 1, framesWith(9, [10]))).toBe(true);
      expect(canRecordStrike(9, 1, framesWith(9, [7]))).toBe(false);
    });

    it('allows the bonus strike after a double strike or a spare', () => {
      expect(canRecordStrike(9, 2, framesWith(9, [10, 10]))).toBe(true);
      expect(canRecordStrike(9, 2, framesWith(9, [7, 3]))).toBe(true);
      expect(canRecordStrike(9, 2, framesWith(9, [10, 4]))).toBe(false);
      expect(canRecordStrike(9, 2, framesWith(9, [7, 2]))).toBe(false);
    });

    it('has no fourth throw', () => {
      expect(canRecordStrike(9, 3, framesWith(9, [10, 10, 10]))).toBe(false);
    });
  });

  describe('canRecordSpare', () => {
    it('never allows a spare on the first throw', () => {
      expect(canRecordSpare(3, 0, framesWith(3, []))).toBe(false);
    });

    it('allows a spare in frames 1-9 after an open first throw', () => {
      expect(canRecordSpare(3, 1, framesWith(3, [4]))).toBe(true);
      expect(canRecordSpare(3, 1, framesWith(3, [10]))).toBe(false);
      expect(canRecordSpare(3, 1, framesWith(3, []))).toBe(false);
    });

    it('allows a spare on the second throw of the 10th after an open first throw', () => {
      expect(canRecordSpare(9, 1, framesWith(9, [4]))).toBe(true);
      expect(canRecordSpare(9, 1, framesWith(9, [10]))).toBe(false);
    });

    it('allows a bonus spare only after a strike and an open second throw', () => {
      expect(canRecordSpare(9, 2, framesWith(9, [10, 4]))).toBe(true);
      expect(canRecordSpare(9, 2, framesWith(9, [10, 10]))).toBe(false);
      expect(canRecordSpare(9, 2, framesWith(9, [7, 3]))).toBe(false);
    });

    it('has no fourth throw', () => {
      expect(canRecordSpare(9, 3, framesWith(9, [10, 10, 10]))).toBe(false);
    });
  });

  describe('canUndoLastThrow', () => {
    it('undoes the throw under the cursor', () => {
      expect(canUndoLastThrow(framesWith(2, [4]), 2, 0)).toBe(true);
    });

    it('undoes the previous throw of the same frame', () => {
      expect(canUndoLastThrow(framesWith(2, [4]), 2, 1)).toBe(true);
    });

    it('undoes the last throw of the previous frame', () => {
      expect(canUndoLastThrow(framesWith(1, [4, 3]), 2, 0)).toBe(true);
    });

    it('is false at the very start of the game', () => {
      expect(canUndoLastThrow(framesWith(0, []), 0, 0)).toBe(false);
    });

    it('is false when the previous frame is empty too', () => {
      expect(canUndoLastThrow(framesWith(0, []), 1, 0)).toBe(false);
    });

    it('is false for negative indices or missing frames', () => {
      expect(canUndoLastThrow(framesWith(0, [4]), -1, 0)).toBe(false);
      expect(canUndoLastThrow(framesWith(0, [4]), 0, -1)).toBe(false);
      expect(canUndoLastThrow(undefined as unknown as Frame[], 0, 0)).toBe(false);
    });
  });

  describe('isValidFrameScore', () => {
    it('rejects a second throw before the first exists', () => {
      expect(isValidFrameScore(4, 3, 1, framesWith(3, []))).toBe(false);
    });

    it('caps frames 1-9 at ten pins', () => {
      expect(isValidFrameScore(6, 3, 1, framesWith(3, [4]))).toBe(true);
      expect(isValidFrameScore(7, 3, 1, framesWith(3, [4]))).toBe(false);
    });

    it('re-checks the existing second throw when the first is edited', () => {
      expect(isValidFrameScore(6, 3, 0, framesWith(3, [4, 4]))).toBe(true);
      expect(isValidFrameScore(7, 3, 0, framesWith(3, [4, 4]))).toBe(false);
    });

    it('caps the first throw of the 10th at ten', () => {
      expect(isValidFrameScore(10, 9, 0, framesWith(9, []))).toBe(true);
      expect(isValidFrameScore(11, 9, 0, framesWith(9, []))).toBe(false);
    });

    it('resets the deck for the second throw of the 10th after a strike', () => {
      expect(isValidFrameScore(10, 9, 1, framesWith(9, [10]))).toBe(true);
      expect(isValidFrameScore(7, 9, 1, framesWith(9, [4]))).toBe(false);
    });

    it('limits the bonus throw to the pins still standing after a strike', () => {
      expect(isValidFrameScore(6, 9, 2, framesWith(9, [10, 4]))).toBe(true);
      expect(isValidFrameScore(7, 9, 2, framesWith(9, [10, 4]))).toBe(false);
      expect(isValidFrameScore(10, 9, 2, framesWith(9, [10, 10]))).toBe(true);
    });

    it('allows a full rack on the bonus throw after a spare', () => {
      expect(isValidFrameScore(10, 9, 2, framesWith(9, [7, 3]))).toBe(true);
    });

    it('rejects a bonus throw in an open 10th', () => {
      expect(isValidFrameScore(1, 9, 2, framesWith(9, [7, 2]))).toBe(false);
    });

    it('rejects a fourth throw', () => {
      expect(isValidFrameScore(1, 9, 3, framesWith(9, [10, 10, 10]))).toBe(false);
    });
  });

  describe('isGameValid', () => {
    it('accepts a complete game with an open 10th', () => {
      expect(isGameValid(makeGame({ frames: fullGameFrames([7, 2]) }))).toBe(true);
    });

    it('accepts a 10th frame with a bonus throw', () => {
      expect(isGameValid(makeGame({ frames: fullGameFrames([10, 10, 10]) }))).toBe(true);
      expect(isGameValid(makeGame({ frames: fullGameFrames([7, 3, 5]) }))).toBe(true);
    });

    it('rejects a 10th that earned a bonus throw but has none', () => {
      expect(isGameValid(makeGame({ frames: fullGameFrames([10, 10]) }))).toBe(false);
      expect(isGameValid(makeGame({ frames: fullGameFrames([7, 3]) }))).toBe(false);
    });

    it('rejects an unfinished 10th', () => {
      expect(isGameValid(makeGame({ frames: fullGameFrames([7]) }))).toBe(false);
    });

    it('rejects a frame whose throws exceed ten pins', () => {
      const frames = fullGameFrames();
      frames[2] = frame([7, 5], 3);

      expect(isGameValid(makeGame({ frames }))).toBe(false);
    });

    it('rejects a strike frame that carries a second throw', () => {
      const frames = fullGameFrames();
      frames[2] = frame([10, 0], 3);

      expect(isGameValid(makeGame({ frames }))).toBe(false);
    });

    it('rejects an unfinished frame', () => {
      const frames = fullGameFrames();
      frames[2] = frame([4], 3);

      expect(isGameValid(makeGame({ frames }))).toBe(false);
    });

    it('rejects fewer than ten frames', () => {
      expect(isGameValid(makeGame({ frames: [frame([10])] }))).toBe(false);
    });

    it('rejects a missing game or missing frames', () => {
      expect(isGameValid(undefined)).toBe(false);
      expect(isGameValid({ frames: undefined } as never)).toBe(false);
    });

    it('parses legacy string throw values', () => {
      const frames = fullGameFrames();
      frames[2] = {
        frameIndex: 3,
        throws: [
          { value: '4' as unknown as number, throwIndex: 1 },
          { value: '3' as unknown as number, throwIndex: 2 },
        ],
      };

      expect(isGameValid(makeGame({ frames }))).toBe(true);
    });
  });
});
