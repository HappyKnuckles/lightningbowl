import { PINS } from 'src/app/core/constants/app.constants';
import { Frame, Throw } from 'src/app/core/models/game.model';
import {
  applyPinModeUndo,
  calculateNextPosition,
  calculateSplit,
  getAvailablePins,
  isCellAccessible,
  isCornerPinLeave,
  isFlatCornerLeave,
  isHighLeave,
  isLightLeave,
  isMakeableSplit,
  isPocketHit,
  isSolidLeave,
  isSplit,
  isWashout,
  processPinThrow,
} from './pin.utils';

/** Ten empty frames, the shape pin mode starts from. */
function emptyFrames(): Frame[] {
  return Array.from({ length: 10 }, (_, i) => ({ frameIndex: i + 1, throws: [] }));
}

function pinThrow(value: number, throwIndex: number, pins: Partial<Throw> = {}): Throw {
  return { value, throwIndex, ...pins };
}

/** Frames with `throws` placed in `frameIndex`. */
function framesWith(frameIndex: number, throws: Throw[]): Frame[] {
  const frames = emptyFrames();
  frames[frameIndex].throws = throws;
  return frames;
}

describe('pin.utils', () => {
  describe('isCellAccessible', () => {
    it('always allows the first throw of a frame', () => {
      expect(isCellAccessible(emptyFrames(), 4, 0)).toBe(true);
    });

    it('blocks the second throw until the first is thrown', () => {
      expect(isCellAccessible(emptyFrames(), 0, 1)).toBe(false);
      expect(isCellAccessible(framesWith(0, [pinThrow(4, 1)]), 0, 1)).toBe(true);
    });

    it('blocks the second throw of frames 1-9 after a strike', () => {
      expect(isCellAccessible(framesWith(0, [pinThrow(10, 1)]), 0, 1)).toBe(false);
    });

    it('allows the second throw of the 10th after a strike', () => {
      expect(isCellAccessible(framesWith(9, [pinThrow(10, 1)]), 9, 1)).toBe(true);
    });

    it('unlocks the bonus throw only after a strike or spare in the 10th', () => {
      expect(isCellAccessible(framesWith(9, [pinThrow(10, 1), pinThrow(3, 2)]), 9, 2)).toBe(true);
      expect(isCellAccessible(framesWith(9, [pinThrow(7, 1), pinThrow(3, 2)]), 9, 2)).toBe(true);
      expect(isCellAccessible(framesWith(9, [pinThrow(7, 1), pinThrow(2, 2)]), 9, 2)).toBe(false);
      expect(isCellAccessible(framesWith(9, [pinThrow(7, 1)]), 9, 2)).toBe(false);
    });

    it('has no fourth throw', () => {
      expect(isCellAccessible(framesWith(9, [pinThrow(10, 1), pinThrow(10, 2), pinThrow(10, 3)]), 9, 3)).toBe(false);
    });
  });

  describe('calculateNextPosition', () => {
    it('skips to the next frame after a strike in frames 1-9', () => {
      expect(calculateNextPosition(emptyFrames(), 2, 0, 10)).toEqual({ nextFrameIndex: 3, nextThrowIndex: 0 });
    });

    it('moves to the second throw after an open first throw', () => {
      expect(calculateNextPosition(emptyFrames(), 2, 0, 4)).toEqual({ nextFrameIndex: 2, nextThrowIndex: 1 });
    });

    it('moves to the next frame after the second throw', () => {
      expect(calculateNextPosition(emptyFrames(), 2, 1, 3)).toEqual({ nextFrameIndex: 3, nextThrowIndex: 0 });
    });

    it('always advances to the second throw of the 10th', () => {
      expect(calculateNextPosition(emptyFrames(), 9, 0, 10)).toEqual({ nextFrameIndex: 9, nextThrowIndex: 1 });
    });

    it('unlocks the bonus throw when the 10th earns one', () => {
      const frames = framesWith(9, [pinThrow(10, 1)]);

      expect(calculateNextPosition(frames, 9, 1, 3)).toEqual({ nextFrameIndex: 9, nextThrowIndex: 2 });
    });

    it('stays on the second throw of an open 10th', () => {
      const frames = framesWith(9, [pinThrow(7, 1)]);

      expect(calculateNextPosition(frames, 9, 1, 2)).toEqual({ nextFrameIndex: 9, nextThrowIndex: 1 });
    });

    it('stays put after the bonus throw', () => {
      expect(calculateNextPosition(emptyFrames(), 9, 2, 10)).toEqual({ nextFrameIndex: 9, nextThrowIndex: 2 });
    });

    it('reads the pin count from an array input', () => {
      expect(calculateNextPosition(emptyFrames(), 0, 0, PINS)).toEqual({ nextFrameIndex: 1, nextThrowIndex: 0 });
    });

    it('falls back to the stored throw value when no input is given', () => {
      const frames = framesWith(0, [pinThrow(10, 1)]);

      expect(calculateNextPosition(frames, 0, 0)).toEqual({ nextFrameIndex: 1, nextThrowIndex: 0 });
    });
  });

  describe('getAvailablePins', () => {
    it('offers all pins on the first throw', () => {
      expect(getAvailablePins(3, 0, [])).toEqual(PINS);
    });

    it('offers the pins left standing by the previous throw', () => {
      const throws = [pinThrow(6, 1, { pinsLeftStanding: [4, 6, 7, 10] })];

      expect(getAvailablePins(3, 1, throws)).toEqual([4, 6, 7, 10]);
    });

    it('derives standing pins from the knocked-down ones when needed', () => {
      const throws = [pinThrow(8, 1, { pinsKnockedDown: [1, 2, 3, 4, 5, 6, 8, 9] })];

      expect(getAvailablePins(3, 1, throws)).toEqual([7, 10]);
    });

    it('offers nothing after a strike in frames 1-9', () => {
      expect(getAvailablePins(3, 1, [pinThrow(10, 1)])).toEqual([]);
    });

    it('resets the deck after a strike in the 10th', () => {
      expect(getAvailablePins(9, 1, [pinThrow(10, 1)])).toEqual(PINS);
    });

    it('resets the deck for the bonus throw after a spare or a second strike', () => {
      expect(getAvailablePins(9, 2, [pinThrow(7, 1), pinThrow(3, 2)])).toEqual(PINS);
      expect(getAvailablePins(9, 2, [pinThrow(10, 1), pinThrow(10, 2)])).toEqual(PINS);
    });

    it('keeps the standing pins for a bonus throw after a strike and an open second throw', () => {
      const throws = [pinThrow(10, 1), pinThrow(4, 2, { pinsLeftStanding: [7, 10] })];

      expect(getAvailablePins(9, 2, throws)).toEqual([7, 10]);
    });
  });

  describe('isSplit', () => {
    it('detects a gap between occupied columns', () => {
      expect(isSplit([7, 10])).toBe(true);
      expect(isSplit([4, 6])).toBe(true);
      expect(isSplit([3, 10])).toBe(true);
    });

    it('is never a split while the headpin stands', () => {
      expect(isSplit([1, 7, 10])).toBe(false);
    });

    it('needs at least two pins', () => {
      expect(isSplit([7])).toBe(false);
      expect(isSplit([])).toBe(false);
    });

    it('is false for pins sharing a column', () => {
      expect(isSplit([2, 8])).toBe(false);
      expect(isSplit([3, 9])).toBe(false);
    });

    // The back row sits on columns 1/3/5/7, so neighbouring back-row pins read as a split here.
    it('treats neighbouring back-row pins as a split', () => {
      expect(isSplit([9, 10])).toBe(true);
    });
  });

  describe('isMakeableSplit', () => {
    it('rejects the known unmakeable splits', () => {
      expect(isMakeableSplit([7, 10])).toBe(false);
      expect(isMakeableSplit([4, 6, 7, 10])).toBe(false);
    });

    it('ignores pin order when matching', () => {
      expect(isMakeableSplit([10, 7])).toBe(false);
    });

    it('accepts a split that can be converted', () => {
      expect(isMakeableSplit([3, 10])).toBe(true);
    });

    it('is false when the leave is not a split at all', () => {
      expect(isMakeableSplit([2, 8])).toBe(false);
    });
  });

  describe('calculateSplit', () => {
    it('only counts splits on the first throw in frames 1-9', () => {
      expect(calculateSplit(3, 0, [7, 10], [])).toBe(true);
      expect(calculateSplit(3, 1, [7, 10], [])).toBe(false);
    });

    it('counts a split on a fresh deck after a strike in the 10th', () => {
      const throwsData = [[], [], [], [], [], [], [], [], [], [pinThrow(10, 1)]];

      expect(calculateSplit(9, 1, [7, 10], throwsData)).toBe(true);
    });

    it('ignores the second throw of an open 10th', () => {
      const throwsData = [[], [], [], [], [], [], [], [], [], [pinThrow(7, 1)]];

      expect(calculateSplit(9, 1, [7, 10], throwsData)).toBe(false);
    });

    it('counts a split on the bonus throw after a double strike or a spare', () => {
      const doubleStrike = [[], [], [], [], [], [], [], [], [], [pinThrow(10, 1), pinThrow(10, 2)]];
      const spare = [[], [], [], [], [], [], [], [], [], [pinThrow(7, 1), pinThrow(3, 2)]];

      expect(calculateSplit(9, 2, [7, 10], doubleStrike)).toBe(true);
      expect(calculateSplit(9, 2, [7, 10], spare)).toBe(true);
    });

    it('ignores the bonus throw when the deck was not reset', () => {
      const throwsData = [[], [], [], [], [], [], [], [], [], [pinThrow(10, 1), pinThrow(4, 2)]];

      expect(calculateSplit(9, 2, [7, 10], throwsData)).toBe(false);
    });
  });

  describe('processPinThrow', () => {
    it('records value, standing pins and knocked pins without mutating the input', () => {
      const frames = emptyFrames();

      const result = processPinThrow(frames, 0, 0, [1, 2, 3, 5, 8, 9]);

      expect(result.updatedFrames[0].throws[0]).toEqual({
        value: 6,
        throwIndex: 1,
        pinsLeftStanding: [4, 6, 7, 10],
        pinsKnockedDown: [1, 2, 3, 5, 8, 9],
        isSplit: true,
      });
      expect(frames[0].throws).toEqual([]);
    });

    it('applies a pendingBall to the newly recorded throw and clears it off the frame', () => {
      const frames = emptyFrames();
      frames[0].pendingBall = { name: 'Storm IQ Tour', weight: '15' };

      const result = processPinThrow(frames, 0, 0, [1, 2, 3, 5, 8, 9]);

      expect(result.updatedFrames[0].throws[0].ball).toEqual({ name: 'Storm IQ Tour', weight: '15' });
      expect(result.updatedFrames[0].pendingBall).toBeUndefined();
    });

    it('advances the cursor past the frame on a strike', () => {
      const result = processPinThrow(emptyFrames(), 0, 0, PINS);

      expect(result.updatedFrames[0].throws[0].value).toBe(10);
      expect(result.nextFrameIndex).toBe(1);
      expect(result.nextThrowIndex).toBe(0);
    });

    it('ignores pins that were already down', () => {
      const first = processPinThrow(emptyFrames(), 0, 0, [1, 2, 3, 5, 8, 9]);

      const second = processPinThrow(first.updatedFrames, 0, 1, [4, 6, 1]);

      expect(second.updatedFrames[0].throws[1]).toMatchObject({
        value: 2,
        pinsKnockedDown: [4, 6],
        pinsLeftStanding: [7, 10],
      });
    });

    it('drops a stale second throw when the first becomes a strike', () => {
      const open = processPinThrow(emptyFrames(), 0, 0, [1, 2, 3, 5, 8, 9]);
      const withSecond = processPinThrow(open.updatedFrames, 0, 1, [4, 6]);

      const corrected = processPinThrow(withSecond.updatedFrames, 0, 0, PINS);

      expect(corrected.updatedFrames[0].throws).toHaveLength(1);
    });

    it('drops a later throw that hit a pin the corrected throw already knocked down', () => {
      const open = processPinThrow(emptyFrames(), 0, 0, [1, 2, 3, 5, 8, 9]);
      const withSecond = processPinThrow(open.updatedFrames, 0, 1, [4, 6]);

      const corrected = processPinThrow(withSecond.updatedFrames, 0, 0, [1, 2, 3, 4, 5, 8, 9]);

      expect(corrected.updatedFrames[0].throws).toHaveLength(1);
    });

    it('keeps the second throw of the 10th when the first becomes a strike', () => {
      const open = processPinThrow(emptyFrames(), 9, 0, [1, 2, 3, 5, 8, 9]);
      const withSecond = processPinThrow(open.updatedFrames, 9, 1, [4, 6]);

      const corrected = processPinThrow(withSecond.updatedFrames, 9, 0, PINS);

      expect(corrected.updatedFrames[9].throws).toHaveLength(2);
      expect(corrected.updatedFrames[9].throws[1].pinsLeftStanding).toEqual([1, 2, 3, 5, 7, 8, 9, 10]);
    });

    it('drops the bonus throw when the corrected second throw takes the spare away', () => {
      const first = processPinThrow(emptyFrames(), 9, 0, [1, 2, 3, 5, 8, 9]);
      const spare = processPinThrow(first.updatedFrames, 9, 1, [4, 6, 7, 10]);
      const bonus = processPinThrow(spare.updatedFrames, 9, 2, [1, 2, 3, 5]);

      const corrected = processPinThrow(bonus.updatedFrames, 9, 1, [4, 6]);

      expect(corrected.updatedFrames[9].throws).toHaveLength(2);
    });

    it('keeps a later throw that is still valid and refreshes its standing pins', () => {
      const open = processPinThrow(emptyFrames(), 0, 0, [1, 2, 3, 5, 8, 9]);
      const withSecond = processPinThrow(open.updatedFrames, 0, 1, [4]);

      const corrected = processPinThrow(withSecond.updatedFrames, 0, 0, [1, 2, 3, 5, 8]);

      expect(corrected.updatedFrames[0].throws).toHaveLength(2);
      expect(corrected.updatedFrames[0].throws[1].pinsLeftStanding).toEqual([6, 7, 9, 10]);
    });

    it('fills in missing frames and throws before writing', () => {
      const result = processPinThrow([], 9, 2, [7]);

      expect(result.updatedFrames).toHaveLength(10);
      expect(result.updatedFrames[9].throws).toHaveLength(3);
      expect(result.updatedFrames[9].throws[2].value).toBe(1);
    });
  });

  describe('applyPinModeUndo', () => {
    it('clears the throw under the cursor', () => {
      const frames = framesWith(0, [pinThrow(6, 1), pinThrow(2, 2)]);

      const result = applyPinModeUndo(frames, 0, 1);

      expect(result!.updatedFrames[0].throws).toHaveLength(1);
      expect(result!.nextFrameIndex).toBe(0);
      expect(result!.nextThrowIndex).toBe(1);
    });

    it('steps back within the frame when the cursor is empty', () => {
      const frames = framesWith(0, [pinThrow(6, 1)]);

      const result = applyPinModeUndo(frames, 0, 1);

      expect(result!.updatedFrames[0].throws).toHaveLength(0);
      expect(result!.nextThrowIndex).toBe(0);
    });

    it('steps back into the previous frame from an empty first throw', () => {
      const frames = framesWith(0, [pinThrow(6, 1), pinThrow(2, 2)]);

      const result = applyPinModeUndo(frames, 1, 0);

      expect(result!.updatedFrames[0].throws).toHaveLength(1);
      expect(result!.nextFrameIndex).toBe(0);
      expect(result!.nextThrowIndex).toBe(1);
    });

    it('returns null at the very start of the game', () => {
      expect(applyPinModeUndo(emptyFrames(), 0, 0)).toBeNull();
    });

    it('returns null when the frame does not exist', () => {
      expect(applyPinModeUndo(emptyFrames(), 42, 0)).toBeNull();
    });

    it('does not mutate the input frames', () => {
      const frames = framesWith(0, [pinThrow(6, 1)]);

      applyPinModeUndo(frames, 0, 0);

      expect(frames[0].throws).toHaveLength(1);
    });
  });
});

describe('leave classification', () => {
  describe('isCornerPinLeave', () => {
    it('recognises a lone corner pin per hand', () => {
      expect(isCornerPinLeave([10])).toBe(true);
      expect(isCornerPinLeave([7])).toBe(false);
      expect(isCornerPinLeave([7], true)).toBe(true);
      expect(isCornerPinLeave([10], true)).toBe(false);
    });

    it('is not a corner pin leave once another pin stands', () => {
      expect(isCornerPinLeave([6, 10])).toBe(false);
    });
  });

  describe('isFlatCornerLeave', () => {
    it('recognises the corner pin with its neighbour still up', () => {
      expect(isFlatCornerLeave([6, 10])).toBe(true);
      expect(isFlatCornerLeave([4, 7], true)).toBe(true);
      expect(isFlatCornerLeave([6, 10], true)).toBe(false);
    });
  });

  describe('isSolidLeave', () => {
    it('recognises a connected cluster after a pocket hit', () => {
      expect(isSolidLeave([2, 4, 5])).toBe(true);
      expect(isSolidLeave([3, 6, 9])).toBe(true);
    });

    it('excludes the head pin, splits and the flat corner', () => {
      expect(isSolidLeave([1, 2, 4])).toBe(false);
      expect(isSolidLeave([7, 10])).toBe(false);
      expect(isSolidLeave([6, 10])).toBe(false);
    });
  });

  describe('isWashout', () => {
    it('needs the head pin standing next to a corner pin', () => {
      expect(isWashout([1, 2, 10])).toBe(true);
      expect(isWashout([1, 3, 7])).toBe(true);
      expect(isWashout([1, 2, 4])).toBe(false);
      expect(isWashout([2, 4, 10])).toBe(false);
    });
  });

  describe('isLightLeave / isHighLeave', () => {
    it('reads a leave on the bowler’s side as light and the far side as high', () => {
      expect(isLightLeave([2, 4, 5, 8])).toBe(true);
      expect(isHighLeave([2, 4, 5, 8])).toBe(false);
      expect(isHighLeave([3, 6, 9, 10])).toBe(true);
      expect(isLightLeave([3, 6, 9, 10])).toBe(false);
    });

    it('mirrors for a left-handed bowler', () => {
      expect(isLightLeave([3, 6, 9, 10], true)).toBe(true);
      expect(isHighLeave([2, 4, 5, 8], true)).toBe(true);
    });

    it('is neither when pins stand on both sides or the head pin is up', () => {
      expect(isLightLeave([2, 3])).toBe(false);
      expect(isHighLeave([2, 3])).toBe(false);
      expect(isLightLeave([1, 2, 4])).toBe(false);
    });
  });

  describe('isPocketHit', () => {
    it('needs the head pin down plus a 2 or 3', () => {
      expect(isPocketHit([])).toBe(true);
      expect(isPocketHit([10])).toBe(true);
      expect(isPocketHit([2, 4, 5])).toBe(true);
      expect(isPocketHit([1, 2, 4])).toBe(false);
      expect(isPocketHit([2, 3, 4])).toBe(false);
    });
  });
});
