import { Frame, Game, Throw } from '../../models/game.model';
import { PINS } from '../../constants/app.constants';

// ============================================================
// Constants
// ============================================================

const PIN_TO_COLUMN: Record<number, number> = {
  7: 1,
  4: 2,
  2: 3,
  8: 3,
  1: 4,
  5: 4,
  3: 5,
  9: 5,
  6: 6,
  10: 7,
};

const UNMAKEABLE_SPLITS: number[][] = [
  [7, 10],
  [4, 6],
  [4, 6, 7],
  [4, 6, 10],
  [4, 7, 10],
  [6, 7, 10],
  [4, 6, 7, 10],
  [4, 6, 7, 9],
  [4, 6, 7, 9, 10],
];

export interface PinThrowResult {
  updatedFrames: Frame[];
  nextFrameIndex: number;
  nextThrowIndex: number;
}

// ============================================================
// Constructors
// ============================================================

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

// ============================================================
// Accessors
// ============================================================

/** Throw value at an index, or undefined if it doesn't exist. */
export function getThrowValue(frame: Frame | undefined, throwIndex: number): number | undefined {
  if (!frame || !frame.throws || throwIndex < 0 || throwIndex >= frame.throws.length) {
    return undefined;
  }
  return frame.throws[throwIndex]?.value;
}

export function getThrowValues(frame: Frame | undefined): number[] {
  if (!frame || !frame.throws) return [];
  return frame.throws.map((t) => t.value);
}

// ============================================================
// Frame predicates
// ============================================================

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

/** Cell at (frameIndex, throwIndex) is reachable given current throws. */
export function isCellAccessible(frames: Frame[], frameIndex: number, throwIndex: number): boolean {
  if (throwIndex === 0) return true;

  const frame = frames[frameIndex];
  if (!frame || !frame.throws) return false;

  const firstThrow = frame.throws[0];
  const firstVal = firstThrow?.value;

  if (throwIndex === 1) {
    if (firstThrow === undefined || firstVal === undefined) return false;
    if (frameIndex < 9 && firstVal === 10) return false;
    return true;
  }

  if (frameIndex === 9 && throwIndex === 2) {
    const secondThrow = frame.throws[1];
    const secondVal = secondThrow?.value;

    if (firstThrow === undefined || firstVal === undefined) return false;
    if (secondThrow === undefined || secondVal === undefined) return false;

    const isStrikeThrow = firstVal === 10;
    const isSpareThrow = !isStrikeThrow && firstVal + secondVal === 10;
    return isStrikeThrow || isSpareThrow;
  }

  return false;
}

// ============================================================
// Mutators (operate on Frame[] / Frame in place)
// ============================================================

/** Set a throw value in a frame (mutates). Handles throwIndex assignment. */
export function setThrowInFrame(frame: Frame, throwIndex: number, value: number): void {
  if (!frame.throws) frame.throws = [];

  while (frame.throws.length <= throwIndex) {
    frame.throws.push(createThrow(0, frame.throws.length + 1));
  }

  frame.throws[throwIndex] = createThrow(value, throwIndex + 1);
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

/** Record a throw within a frames array (mutates). */
export function recordThrow(frames: Frame[], frameIndex: number, throwIndex: number, value: number): void {
  const frame = frames[frameIndex];
  if (!frame) return;
  while (frame.throws.length <= throwIndex) {
    frame.throws.push(createThrow(0, frame.throws.length + 1));
  }
  frame.throws[throwIndex] = createThrow(value, throwIndex + 1);
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

// ============================================================
// Transforms
// ============================================================

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
    throws: frame.throws.map((t) => ({ ...t })),
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

// ============================================================
// Display formatting
// ============================================================

/**
 * Display symbol for a single throw: 'X', '/', the miss symbol, a number, or ''.
 * @param missSymbol shown for a knocked-zero throw. Omit to render the number (live grid);
 *                   pass '–' for the readonly/share grid.
 */
export function formatThrowDisplay(frame: Frame | undefined, throwIndex: number, isTenth: boolean, missSymbol?: string): string {
  if (!frame) return '';

  const val = getThrowValue(frame, throwIndex);
  if (val === undefined || val === null) return '';

  const v0 = getThrowValue(frame, 0);
  const v1 = getThrowValue(frame, 1);
  const num = (n: number) => (n === 0 && missSymbol !== undefined ? missSymbol : String(n));

  if (throwIndex === 0) {
    return val === 10 ? 'X' : num(val);
  }

  if (!isTenth) {
    if (v0 !== undefined && v0 !== 10 && v0 + val === 10) return '/';
    return num(val);
  }

  if (throwIndex === 1) {
    if (v0 !== undefined && v0 !== 10 && v0 + val === 10) return '/';
    return val === 10 ? 'X' : num(val);
  }

  // throwIndex === 2
  if (v0 === 10) {
    if (v1 === 10) return val === 10 ? 'X' : num(val);
    return v1 !== undefined && v1 + val === 10 ? '/' : num(val);
  }
  return val === 10 ? 'X' : num(val);
}

// ============================================================
// Series / misc
// ============================================================

export function generateUniqueSeriesId(): string {
  return 'series-' + Math.random().toString(36).substring(2, 15);
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

// ============================================================
// Input parsing
// ============================================================

/** Parse a single typed throw input (X, /, number) against a Frame[]. */
export function parseThrowInput(input: string, frameIndex: number, throwIndex: number, frames: Frame[]): number {
  const upperInput = input.toUpperCase();
  if (upperInput === 'X') return 10;

  if (upperInput === '/') {
    const firstThrow = getThrowValue(frames[frameIndex], 0);
    if (firstThrow !== undefined && throwIndex > 0) {
      if (frameIndex === 9 && throwIndex === 2) {
        const secondThrow = getThrowValue(frames[frameIndex], 1);
        if (getThrowValue(frames[frameIndex], 0) === 10 && secondThrow !== undefined) {
          return 10 - secondThrow;
        }
      }
      return 10 - firstThrow;
    }
    return 0;
  }

  return parseInt(input, 10) || 0;
}

export function parseBowlingScores(input: string, username: string): { frames: number[][]; frameScores: number[]; totalScore: number } {
  const lines = input.split('\n').filter((line) => line.trim() !== '');
  const userIndex = lines.findIndex((line) => line.toLowerCase().includes(username.toLowerCase()));
  const linesAfterUsername = userIndex >= 0 ? lines.slice(userIndex + 1) : [];
  const nextNonXLineIndex = linesAfterUsername.findIndex((line) => /^[a-wyz]/i.test(line));
  const relevantLines = nextNonXLineIndex >= 0 ? linesAfterUsername.slice(0, nextNonXLineIndex) : linesAfterUsername;

  if (relevantLines.length < 2) {
    throw new Error(`Insufficient score data for user ${username}`);
  }

  let throwValues = relevantLines[0].split('');
  let frameScores;

  if (throwValues.length < 12) {
    throwValues = throwValues.concat(relevantLines[1].split(''));
    frameScores = relevantLines.slice(2).map((line) => line.split(' ').map(Number));
  } else {
    frameScores = relevantLines.slice(1).map((line) => line.split(' ').map(Number));
  }

  frameScores = frameScores.flat().sort((a, b) => a - b);
  if (frameScores.length > 10) {
    frameScores = frameScores.slice(0, 10);
  }

  throwValues = throwValues.filter((value) => value.trim() !== '');
  let prevValue: number | undefined;
  throwValues = throwValues.map((value) => {
    if (value === 'X' || value === '×') {
      prevValue = 10;
      return '10';
    } else if (value === '-') {
      prevValue = 0;
      return '0';
    } else if (value === '/') {
      if (prevValue !== undefined) {
        return (10 - prevValue).toString();
      }
      return '';
    } else {
      prevValue = parseInt(value, 10);
      return value;
    }
  });

  const frames: number[][] = [];
  let currentFrame: number[] = [];

  throwValues.forEach((value) => {
    const intValue = parseInt(value, 10);
    const isTenthFrame = frames.length === 9;
    if (frames.length < 10) {
      currentFrame.push(intValue);
      if ((currentFrame.length === 2 && !isTenthFrame) || (isTenthFrame && currentFrame.length === 3)) {
        frames.push([...currentFrame]);
        currentFrame = [];
      } else if (intValue === 10 && !isTenthFrame) {
        frames.push([...currentFrame]);
        currentFrame = [];
      }
    }
  });

  if (currentFrame.length > 0) {
    frames.push([...currentFrame]);
  }

  const totalScore = frameScores[9];
  return { frames, frameScores, totalScore };
}

// ============================================================
// Navigation & position
// ============================================================

export function calculateNextPosition(
  frames: Frame[],
  frameIndex: number,
  throwIndex: number,
  currentInput?: number[] | number,
): { nextFrameIndex: number; nextThrowIndex: number } {
  const val = resolveInputValue(frames, frameIndex, throwIndex, currentInput);

  if (frameIndex < 9) {
    if (throwIndex === 0) {
      return val === 10 ? { nextFrameIndex: frameIndex + 1, nextThrowIndex: 0 } : { nextFrameIndex: frameIndex, nextThrowIndex: 1 };
    }
    return { nextFrameIndex: frameIndex + 1, nextThrowIndex: 0 };
  }

  if (throwIndex === 0) return { nextFrameIndex: 9, nextThrowIndex: 1 };

  if (throwIndex === 1) {
    const firstThrowVal = frames[9]?.throws?.[0]?.value ?? 0;
    const isBonusEarned = firstThrowVal === 10 || firstThrowVal + val === 10;
    return isBonusEarned ? { nextFrameIndex: 9, nextThrowIndex: 2 } : { nextFrameIndex: 9, nextThrowIndex: 1 };
  }

  return { nextFrameIndex: 9, nextThrowIndex: 2 };
}

export function getAvailablePins(frameIndex: number, throwIndex: number, frameThrows: Throw[]): number[] {
  if (throwIndex === 0) return PINS;

  const prevThrow = frameThrows[throwIndex - 1];
  if (!prevThrow) return PINS;

  if (frameIndex === 9) {
    if (throwIndex === 1 && prevThrow.value === 10) return PINS;

    if (throwIndex === 2) {
      const firstVal = frameThrows[0]?.value ?? 0;
      const secondVal = prevThrow.value ?? 0;

      if (secondVal === 10) return PINS;
      if (firstVal !== 10 && firstVal + secondVal === 10) return PINS;
    }
  }

  if (prevThrow.pinsLeftStanding?.length) return prevThrow.pinsLeftStanding;
  if (prevThrow.pinsKnockedDown?.length) return PINS.filter((p) => !prevThrow.pinsKnockedDown!.includes(p));

  if (prevThrow.value === 10) return [];

  return PINS;
}

// ============================================================
// Split & pattern logic
// ============================================================

export function calculateSplit(frameIndex: number, throwIndex: number, pinsLeftStanding: number[], throwsData: Throw[][]): boolean {
  const isFirstThrow = throwIndex === 0;
  const isTenthFrame = frameIndex === 9;

  if (!isTenthFrame) return isFirstThrow ? isSplit(pinsLeftStanding) : false;

  if (isFirstThrow) return isSplit(pinsLeftStanding);

  const firstThrow = throwsData[9]?.[0];
  const secondThrow = throwsData[9]?.[1];

  if (throwIndex === 1 && firstThrow?.value === 10) return isSplit(pinsLeftStanding);

  if (throwIndex === 2) {
    const doubleStrike = firstThrow?.value === 10 && secondThrow?.value === 10;
    const spare = firstThrow && secondThrow && firstThrow.value !== 10 && firstThrow.value + secondThrow.value === 10;

    if (doubleStrike || spare) return isSplit(pinsLeftStanding);
  }

  return false;
}

export function isSplit(pinsLeftStanding: number[]): boolean {
  const numPins = pinsLeftStanding?.length ?? 0;
  if (numPins < 2 || pinsLeftStanding.includes(1)) return false;

  const occupiedColumns = new Set<number>();
  for (const pin of pinsLeftStanding) {
    const col = PIN_TO_COLUMN[pin];
    if (col) occupiedColumns.add(col);
  }

  const sortedCols = Array.from(occupiedColumns).sort((a, b) => a - b);
  for (let i = 0; i < sortedCols.length - 1; i++) {
    if (sortedCols[i + 1] - sortedCols[i] > 1) return true;
  }
  return false;
}

export function isMakeableSplit(pinsLeftStanding: number[]): boolean {
  if (!isSplit(pinsLeftStanding)) return false;

  const sortedPins = [...pinsLeftStanding].sort((a, b) => a - b);
  for (const unmakeable of UNMAKEABLE_SPLITS) {
    const sortedUnmakeable = [...unmakeable].sort((a, b) => a - b);
    if (arraysEqual(sortedPins, sortedUnmakeable)) return false;
  }
  return true;
}

// ============================================================
// Pin processing
// ============================================================

export function processPinThrow(frames: Frame[], frameIndex: number, throwIndex: number, pinsKnockedDown: number[]): PinThrowResult {
  const updatedFrames: Frame[] = structuredClone(frames);
  ensureFrameStructure(updatedFrames, frameIndex, throwIndex);

  const frame = updatedFrames[frameIndex];

  const availablePins = getAvailablePins(frameIndex, throwIndex, frame.throws);
  const validPinsHit = validatePinsHit(frame, throwIndex, availablePins, pinsKnockedDown);

  const value = validPinsHit.length;
  const pinsStandingAfter = availablePins.filter((p) => !validPinsHit.includes(p));

  const isSplitThrow = calculateSplit(
    frameIndex,
    throwIndex,
    pinsStandingAfter,
    updatedFrames.map((f) => f.throws),
  );

  frame.throws[throwIndex] = {
    value,
    throwIndex: throwIndex + 1,
    pinsLeftStanding: pinsStandingAfter,
    pinsKnockedDown: validPinsHit,
    isSplit: isSplitThrow,
  };

  cleanupSubsequentThrows(frame, frameIndex, throwIndex, value, pinsStandingAfter);

  const next = calculateNextPosition(updatedFrames, frameIndex, throwIndex, validPinsHit);

  return {
    updatedFrames,
    nextFrameIndex: next.nextFrameIndex,
    nextThrowIndex: next.nextThrowIndex,
  };
}

export function applyPinModeUndo(frames: Frame[], currentFrameIndex: number, currentThrowIndex: number): PinThrowResult | null {
  const updatedFrames = structuredClone(frames);
  const currentFrame = updatedFrames[currentFrameIndex];

  if (!currentFrame?.throws) return null;

  const hasValueAtCursor = currentFrame.throws[currentThrowIndex] !== undefined;
  let targetFrameIdx = currentFrameIndex;
  let targetThrowIdx = currentThrowIndex;

  if (hasValueAtCursor) {
    updatedFrames[targetFrameIdx].throws.splice(targetThrowIdx, 1);
  } else {
    targetThrowIdx--;

    if (targetThrowIdx < 0) {
      targetFrameIdx--;
      if (targetFrameIdx < 0) return null;

      const prevFrame = updatedFrames[targetFrameIdx];
      const prevLength = prevFrame?.throws?.length ?? 0;
      targetThrowIdx = Math.max(0, prevLength - 1);
    }

    if (updatedFrames[targetFrameIdx]?.throws?.length > 0) {
      updatedFrames[targetFrameIdx].throws.splice(targetThrowIdx, 1);
    }
  }

  return {
    updatedFrames,
    nextFrameIndex: targetFrameIdx,
    nextThrowIndex: targetThrowIdx,
  };
}

// ============================================================
// Private helpers (module-scoped, not exported)
// ============================================================

function ensureFrameStructure(frames: Frame[], frameIndex: number, throwIndex: number): void {
  while (frames.length < 10) {
    frames.push({ frameIndex: frames.length + 1, throws: [] } as Frame);
  }
  const frame = frames[frameIndex];
  while (frame.throws.length <= throwIndex) {
    frame.throws.push({
      value: 0,
      throwIndex: frame.throws.length + 1,
      pinsLeftStanding: [],
      pinsKnockedDown: [],
    });
  }
}

function validatePinsHit(frame: Frame, throwIndex: number, availablePins: number[], inputPins: number[]): number[] {
  const isDataTrap = availablePins.length === 0 && throwIndex > 0 && frame.throws[throwIndex - 1].value !== 10;

  if (isDataTrap) return inputPins;
  return inputPins.filter((p) => availablePins.includes(p));
}

function resolveInputValue(frames: Frame[], frameIndex: number, throwIndex: number, currentInput?: number[] | number): number {
  if (Array.isArray(currentInput)) return currentInput.length;
  if (typeof currentInput === 'number') return currentInput;
  return frames[frameIndex]?.throws?.[throwIndex]?.value ?? 0;
}

function arraysEqual(arr1: number[], arr2: number[]): boolean {
  if (arr1.length !== arr2.length) return false;
  return arr1.every((val, idx) => val === arr2[idx]);
}

function cleanupSubsequentThrows(frame: Frame, frameIndex: number, throwIndex: number, value: number, pinsStandingAfter: number[]): void {
  if (frame.throws.length <= throwIndex + 1) return;

  const isTenthFrame = frameIndex === 9;
  const nextThrow = frame.throws[throwIndex + 1];

  if (!isTenthFrame) {
    if (value === 10) {
      frame.throws.splice(1);
    } else {
      validateOrClearThrow(nextThrow, pinsStandingAfter, frame, throwIndex + 1);
    }
    return;
  }

  if (throwIndex === 0) {
    const availableForSecond = value === 10 ? PINS : pinsStandingAfter;
    validateOrClearThrow(nextThrow, availableForSecond, frame, 1);
  } else if (throwIndex === 1) {
    if (frame.throws.length > 2) {
      const firstVal = frame.throws[0].value;
      const availableForThird = (firstVal === 10 && value === 10) || firstVal + value === 10 ? PINS : pinsStandingAfter;
      validateOrClearThrow(frame.throws[2], availableForThird, frame, 2);
    }
  }
}

function validateOrClearThrow(targetThrow: Throw, availablePins: number[], frame: Frame, targetIndex: number): void {
  const invalidPins = (targetThrow.pinsKnockedDown || []).filter((p) => !availablePins.includes(p));

  if (invalidPins.length > 0) {
    frame.throws.splice(targetIndex);
  } else {
    targetThrow.pinsLeftStanding = availablePins.filter((p) => !targetThrow.pinsKnockedDown!.includes(p));
  }
}
