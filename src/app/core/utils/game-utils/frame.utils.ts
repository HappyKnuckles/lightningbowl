import { Throw, Frame, Game } from 'src/app/core/models/game.model';

// Constructors

export function createThrow(value: number, throwIndex: number): Throw {
  return { value, throwIndex };
}

export function createEmptyFrame(frameIndex: number): Frame {
  return { frameIndex, throws: [] };
}

export function createEmptyFrames(): Frame[] {
  return Array.from({ length: 10 }, (_, i) => createEmptyFrame(i + 1));
}

export function createEmptyGame(): Game {
  return {
    gameId: '',
    date: 0,
    frames: createEmptyFrames(),
    totalScore: 0,
    frameScores: [],
    isClean: false,
    isPerfect: false,
    isPinMode: false,
    isPractice: true,
    note: '',
    league: '',
    patterns: [],
    balls: [],
  };
}

// Accessors

/** Throw value at an index, or undefined if it doesn't exist. */
export function getThrowValue(frame: Frame | undefined, throwIndex: number): number | undefined {
  if (!frame || !frame.throws || throwIndex < 0 || throwIndex >= frame.throws.length) {
    return undefined;
  }
  return frame.throws[throwIndex]?.value;
}

export function getThrowValues(frame: Frame | undefined): number[] {
  if (!frame || !frame.throws) return [];
  return frame.throws.map((t: Throw) => t.value);
}

// Predicates

/** Strike = first throw is 10. */
export function isStrike(frame: Frame | undefined): boolean {
  return getThrowValue(frame, 0) === 10;
}

/** Spare = first two throws sum to 10, but not a strike. */
export function isSpare(frame: Frame | undefined): boolean {
  const first = getThrowValue(frame, 0);
  const second = getThrowValue(frame, 1);
  if (first === undefined || second === undefined) return false;
  return first !== 10 && first + second === 10;
}

/** Whether a frame has all required throws. */
export function isFrameComplete(frame: Frame | undefined, frameIndex: number): boolean {
  if (!frame || !frame.throws) return false;

  if (frameIndex < 9) {
    if (isStrike(frame)) return true;
    return frame.throws.length >= 2;
  }

  const first = getThrowValue(frame, 0);
  const second = getThrowValue(frame, 1);

  if (first === undefined) return false;
  if (second === undefined) return false;

  if (first === 10 || first + second === 10) {
    return frame.throws.length >= 3;
  }

  return true;
}

export function isAllFramesComplete(game: Game): boolean {
  if (!game.frames || game.frames.length < 10) return false;
  return isFrameComplete(game.frames[9], 9);
}

export function calculateIsClean(frames: Frame[]): boolean {
  for (let i = 0; i < Math.min(frames.length, 10); i++) {
    const frame = frames[i];
    if (!frame || !frame.throws || frame.throws.length === 0) continue;

    const first = getThrowValue(frame, 0);
    const second = getThrowValue(frame, 1);

    if (first === undefined) continue;

    if (i < 9) {
      if (first !== 10 && (second === undefined || first + second < 10)) {
        return false;
      }
    } else {
      if (second === undefined) continue;
      if (first !== 10 && first + second < 10) {
        return false;
      }
    }
  }
  return true;
}

// Mutators (operate on Frame[] / Frame in place)

/** Set a throw value in a frame (mutates). Handles throwIndex assignment. Preserves other throw data (e.g. ball). */
export function setThrowInFrame(frame: Frame, throwIndex: number, value: number): void {
  if (!frame.throws) frame.throws = [];

  while (frame.throws.length <= throwIndex) {
    frame.throws.push(createThrow(0, frame.throws.length + 1));
  }

  frame.throws[throwIndex] = {
    ...frame.throws[throwIndex],
    value,
    throwIndex: throwIndex + 1,
  };
}

/** Remove a throw at an index (mutates). */
export function removeThrowFromFrame(frame: Frame, throwIndex: number): void {
  if (frame.throws && throwIndex >= 0 && throwIndex < frame.throws.length) {
    frame.throws.splice(throwIndex, 1);
    frame.throws.forEach((t, idx) => {
      t.throwIndex = idx + 1;
    });
  }
}

/** Record a throw within a frames array (mutates). Preserves other throw data (e.g. ball). */
export function recordThrow(frames: Frame[], frameIndex: number, throwIndex: number, value: number): void {
  const frame = frames[frameIndex];
  if (!frame) return;
  setThrowInFrame(frame, throwIndex, value);
}

/** Remove a throw within a frames array (mutates). */
export function removeThrow(frames: Frame[], frameIndex: number, throwIndex: number): void {
  const frame = frames[frameIndex];
  if (!frame?.throws) return;
  if (throwIndex >= 0 && throwIndex < frame.throws.length) {
    frame.throws.splice(throwIndex, 1);
    frame.throws.forEach((t, idx) => {
      t.throwIndex = idx + 1;
    });
  }
}

// Transforms & cloning

/**
 * Copy of a game containing only completed frames, for partial live-stats.
 * totalScore is set to the last available frameScore so rate denominators stay correct.
 */
export function toCompletedFramesGame(game: Game): Game {
  const completedFrames = game.frames.filter((f, i) => isFrameComplete(f, i));
  const lastScore = completedFrames.length > 0 ? (game.frameScores[completedFrames.length - 1] ?? 0) : 0;
  return { ...game, frames: completedFrames, totalScore: lastScore };
}

export function cloneFrames(frames: Frame[]): Frame[] {
  return frames.map((frame) => ({
    ...frame,
    throws: frame.throws.map((t: Throw) => ({ ...t })),
  }));
}

export function cloneGame(game: Game): Game {
  return {
    ...game,
    frames: cloneFrames(game.frames),
    frameScores: [...game.frameScores],
    patterns: [...game.patterns],
    balls: game.balls ? [...game.balls] : undefined,
  };
}

/** Convert number[][] to Frame[]. Used for legacy migration and OCR results. */
export function numberArraysToFrames(numberArrays: number[][]): Frame[] {
  return numberArrays.map((frameArray, frameIndex) => ({
    frameIndex: frameIndex + 1,
    throws: frameArray.map((value, throwIndex) => createThrow(value, throwIndex + 1)),
  }));
}
