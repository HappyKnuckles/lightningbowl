import { PINS, PIN_TO_COLUMN, UNMAKEABLE_SPLITS } from 'src/app/core/constants/app.constants';
import { Frame, Throw } from 'src/app/core/models/game.model';
import { getCarryOverThrowBall } from './ball.utils';

export interface PinThrowResult {
  updatedFrames: Frame[];
  nextFrameIndex: number;
  nextThrowIndex: number;
}

// Cell accessibility & navigation

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

// Split logic

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

// Pin processing

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
    ...frame.throws[throwIndex],
    value,
    throwIndex: throwIndex + 1,
    pinsLeftStanding: pinsStandingAfter,
    pinsKnockedDown: validPinsHit,
    isSplit: isSplitThrow,
  };

  // Apply a ball picked before this throw was recorded, if any
  if (frame.pendingBall) {
    frame.throws[throwIndex].ball = frame.pendingBall;
    frame.pendingBall = undefined;
  }

  // Carry the ball over from earlier throws of the same kind when none was explicitly selected
  if (!frame.throws[throwIndex].ball) {
    frame.throws[throwIndex].ball = getCarryOverThrowBall(updatedFrames, frameIndex, throwIndex);
  }

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

// Private helpers

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

// Leave classification
//
// Names a leave the way a bowler would, from the pins left standing after a first ball.
// All of these are about first balls only. A leave after a spare shot says nothing
// about ball reaction. `isLeft` mirrors the deck for a left-handed bowler, so "light"
// and "high" mean the same thing physically for both hands.

/** Corner pins for the bowler's hand: the 10 for a righty, the 7 for a lefty. */
export function getCornerPin(isLeft: boolean): number {
  return isLeft ? 7 : 10;
}

/** The opposite corner: the 7 for a righty, the 10 for a lefty. */
export function getOppositeCornerPin(isLeft: boolean): number {
  return isLeft ? 10 : 7;
}

/**
 * A single corner pin left standing: the "ringing 10" for a righty, the "ringing 7"
 * for a lefty. Everything in front of it fell, so this is a carry problem, not a miss.
 */
export function isCornerPinLeave(pinsLeftStanding: number[], isLeft = false): boolean {
  return pinsLeftStanding.length === 1 && pinsLeftStanding[0] === getCornerPin(isLeft);
}

/**
 * A corner pin left with the 6 (righty) or 4 (lefty) still standing next to it, meaning
 * the ball never got to the corner at all, as opposed to ringing it out.
 */
export function isFlatCornerLeave(pinsLeftStanding: number[], isLeft = false): boolean {
  const corner = getCornerPin(isLeft);
  const neighbour = isLeft ? 4 : 6;
  return pinsLeftStanding.length === 2 && pinsLeftStanding.includes(corner) && pinsLeftStanding.includes(neighbour);
}

/**
 * A solid leave: the pocket was hit but a cluster of two or more connected pins stands.
 * Typically 2-4-5 / 3-6-9 style, where the ball hit light or deflected off the pocket.
 * The flat corner (6-10 / 4-7) is excluded because it is reported on its own.
 */
export function isSolidLeave(pinsLeftStanding: number[], isLeft = false): boolean {
  if (pinsLeftStanding.length < 2 || pinsLeftStanding.includes(1)) return false;
  if (isSplit(pinsLeftStanding)) return false;
  return !isFlatCornerLeave(pinsLeftStanding, isLeft);
}

/** Washout: the head pin still stands with corner pins around it, a badly missed line. */
export function isWashout(pinsLeftStanding: number[]): boolean {
  if (!pinsLeftStanding.includes(1)) return false;
  return pinsLeftStanding.includes(10) || pinsLeftStanding.includes(7);
}

/**
 * Light hit: the ball came in weak on the pocket side and left pins on the bowler's side
 * of the deck (2-4-5-8 for a righty, 3-6-9 for a lefty).
 */
export function isLightLeave(pinsLeftStanding: number[], isLeft = false): boolean {
  if (pinsLeftStanding.length === 0 || pinsLeftStanding.includes(1)) return false;
  const lightPins = isLeft ? [3, 6, 9, 10] : [2, 4, 5, 7, 8];
  const highPins = isLeft ? [2, 4, 5, 7, 8] : [3, 6, 9, 10];
  return pinsLeftStanding.some((p) => lightPins.includes(p)) && !pinsLeftStanding.some((p) => highPins.includes(p));
}

/**
 * High hit: the ball crossed over the head pin's far side and left pins on the other
 * side of the deck (3-6-9-10 for a righty, 2-4-5-7-8 for a lefty).
 */
export function isHighLeave(pinsLeftStanding: number[], isLeft = false): boolean {
  return isLightLeave(pinsLeftStanding, !isLeft);
}

/**
 * Pocket hit: head pin down and at least one of the 2/3 pins down.
 * An empty array (a strike) counts, which is correct.
 */
export function isPocketHit(pinsLeftStanding: number[]): boolean {
  const pin1Down = !pinsLeftStanding.includes(1);
  const pin2Down = !pinsLeftStanding.includes(2);
  const pin3Down = !pinsLeftStanding.includes(3);
  return pin1Down && (pin2Down || pin3Down);
}
