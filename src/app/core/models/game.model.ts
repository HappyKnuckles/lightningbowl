/**
 * Represents a single throw/ball in a bowling frame
 */
export interface Throw {
  value: number;
  throwIndex: number;
  isSplit?: boolean;
  pinsLeftStanding?: number[];
  pinsKnockedDown?: number[];
  ball?: string;
}

/**
 * Represents a single frame in a bowling game
 */
export interface Frame {
  frameIndex: number;
  throws: Throw[];
  isInvalid?: boolean;
}

/**
 * Represents a complete bowling game
 */
export interface Game {
  gameId: string;
  date: number;
  frames: Frame[];
  totalScore: number;
  frameScores: number[];
  isClean: boolean;
  isPerfect: boolean;
  isPractice: boolean;
  isPinMode: boolean;
  isSeries?: boolean;
  seriesId?: string;
  note?: string;
  league?: string;
  patterns: string[];
  balls?: string[];
}

/**
 * Helper function to create a Throw object
 */
export function createThrow(value: number, throwIndex: number): Throw {
  return {
    value,
    throwIndex,
  };
}

/**
 * Helper function to create an empty frame
 */
export function createEmptyFrame(frameIndex: number): Frame {
  return {
    frameIndex,
    throws: [],
  };
}

/**
 * Helper function to create 10 empty frames
 */
export function createEmptyFrames(): Frame[] {
  return Array.from({ length: 10 }, (_, i) => createEmptyFrame(i + 1));
}

/**
 * Helper function to create an empty game
 */
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

/**
 * Get throw value from a frame at a specific index
 * Returns undefined if throw doesn't exist
 */
export function getThrowValue(frame: Frame | undefined, throwIndex: number): number | undefined {
  if (!frame || !frame.throws || throwIndex < 0 || throwIndex >= frame.throws.length) {
    return undefined;
  }
  return frame.throws[throwIndex]?.value;
}

/**
 * Get all throw values from a frame as an array of numbers
 */
export function getThrowValues(frame: Frame | undefined): number[] {
  if (!frame || !frame.throws) {
    return [];
  }
  return frame.throws.map((t) => t.value);
}

/**
 * Check if a frame is a strike (first throw = 10)
 */
export function isStrike(frame: Frame | undefined): boolean {
  return getThrowValue(frame, 0) === 10;
}

/**
 * Check if a frame is a spare (first two throws sum to 10, but not a strike)
 */
export function isSpare(frame: Frame | undefined): boolean {
  const first = getThrowValue(frame, 0);
  const second = getThrowValue(frame, 1);
  if (first === undefined || second === undefined) return false;
  return first !== 10 && first + second === 10;
}

/**
 * Check if a frame is complete (has all required throws)
 */
export function isFrameComplete(frame: Frame | undefined, frameIndex: number): boolean {
  if (!frame || !frame.throws) return false;

  // For frames 1-9 (0-8 in 0-indexed)
  if (frameIndex < 9) {
    // Strike = complete with 1 throw
    if (isStrike(frame)) return true;
    // Otherwise need 2 throws
    return frame.throws.length >= 2;
  }

  // For the 10th frame (index 9)
  const first = getThrowValue(frame, 0);
  const second = getThrowValue(frame, 1);

  if (first === undefined) return false;
  if (second === undefined) return false;

  // If strike or spare, need 3 throws
  if (first === 10 || first + second === 10) {
    return frame.throws.length >= 3;
  }

  // Otherwise 2 throws is complete
  return true;
}

/**
 * Set a throw value in a frame (mutates the frame)
 * Automatically handles throwIndex assignment
 */
export function setThrowInFrame(frame: Frame, throwIndex: number, value: number): void {
  // Ensure throws array exists
  if (!frame.throws) {
    frame.throws = [];
  }

  // If throwIndex is beyond current length, extend the array
  while (frame.throws.length <= throwIndex) {
    frame.throws.push(createThrow(0, frame.throws.length + 1));
  }

  // Set or update the throw
  frame.throws[throwIndex] = createThrow(value, throwIndex + 1);
}

/**
 * Remove a throw from a frame at a specific index (mutates the frame)
 */
export function removeThrowFromFrame(frame: Frame, throwIndex: number): void {
  if (frame.throws && throwIndex >= 0 && throwIndex < frame.throws.length) {
    frame.throws.splice(throwIndex, 1);
    // Re-index remaining throws
    frame.throws.forEach((t, idx) => {
      t.throwIndex = idx + 1;
    });
  }
}

/**
 * Deep clone a Frame array
 */
export function cloneFrames(frames: Frame[]): Frame[] {
  return frames.map((frame) => ({
    ...frame,
    throws: frame.throws.map((t) => ({ ...t })),
  }));
}

/**
 * Get all unique ball names used in a game (from throw-level data, falling back to game.balls)
 */
export function getGameBalls(game: Game): string[] {
  const throwBalls = game.frames.flatMap((f) => f.throws.map((t) => t.ball).filter((b): b is string => !!b));
  const uniqueThrowBalls = [...new Set(throwBalls)];
  if (uniqueThrowBalls.length > 0) {
    return uniqueThrowBalls;
  }
  return game.balls || [];
}

/**
 * Deep clone a Game
 */
export function cloneGame(game: Game): Game {
  return {
    ...game,
    frames: cloneFrames(game.frames),
    frameScores: [...game.frameScores],
    patterns: [...game.patterns],
    balls: game.balls ? [...game.balls] : undefined,
  };
}

/**
 * Convert number[][] format to Frame[] format
 * Used for legacy data migration and OCR parsing results
 */
export function numberArraysToFrames(numberArrays: number[][]): Frame[] {
  return numberArrays.map((frameArray, frameIndex) => ({
    frameIndex: frameIndex + 1,
    throws: frameArray.map((value, throwIndex) => createThrow(value, throwIndex + 1)),
  }));
}
