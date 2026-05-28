import { Injectable } from '@angular/core';
import { createThrow, Frame, getThrowValue, Throw } from '../../models/game.model';

export interface PinThrowResult {
  updatedFrames: Frame[];
  nextFrameIndex: number;
  nextThrowIndex: number;
}

@Injectable({
  providedIn: 'root',
})
export class GameUtilsService {
  private readonly ALL_PINS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  private readonly UNMAKEABLE_SPLITS = [
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

  private readonly PIN_TO_COLUMN: Record<number, number> = {
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

  generateUniqueSeriesId(): string {
    return 'series-' + Math.random().toString(36).substring(2, 15);
  }

  // PIN PROCESSING
  processPinThrow(frames: Frame[], frameIndex: number, throwIndex: number, pinsKnockedDown: number[]): PinThrowResult {
    const updatedFrames: Frame[] = structuredClone(frames);
    this.ensureFrameStructure(updatedFrames, frameIndex, throwIndex);

    const frame = updatedFrames[frameIndex];

    const availablePins = this.getAvailablePins(frameIndex, throwIndex, frame.throws);
    const validPinsHit = this.validatePinsHit(frame, throwIndex, availablePins, pinsKnockedDown);

    const value = validPinsHit.length;
    const pinsStandingAfter = availablePins.filter((p) => !validPinsHit.includes(p));

    const isSplit = this.calculateSplit(
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
      isSplit,
    };

    this.cleanupSubsequentThrows(frame, frameIndex, throwIndex, value, pinsStandingAfter);

    const next = this.calculateNextPosition(updatedFrames, frameIndex, throwIndex, validPinsHit);

    return {
      updatedFrames,
      nextFrameIndex: next.nextFrameIndex,
      nextThrowIndex: next.nextThrowIndex,
    };
  }

  applyPinModeUndo(frames: Frame[], currentFrameIndex: number, currentThrowIndex: number): PinThrowResult | null {
    const updatedFrames = structuredClone(frames);
    const currentFrame = updatedFrames[currentFrameIndex];

    if (!currentFrame?.throws) return null;

    const hasValueAtCursor = currentFrame.throws[currentThrowIndex] !== undefined;
    let targetFrameIdx = currentFrameIndex;
    let targetThrowIdx = currentThrowIndex;

    if (hasValueAtCursor) {
      // Scenario A: Clear current value, stay put
      updatedFrames[targetFrameIdx].throws.splice(targetThrowIdx, 1);
    } else {
      // Scenario B: Move back, clear that value
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

  recordThrow(frames: Frame[], frameIndex: number, throwIndex: number, value: number): void {
    const frame = frames[frameIndex];
    if (!frame) return;
    while (frame.throws.length <= throwIndex) {
      frame.throws.push(createThrow(0, frame.throws.length + 1));
    }
    frame.throws[throwIndex] = createThrow(value, throwIndex + 1);
  }

  removeThrow(frames: Frame[], frameIndex: number, throwIndex: number): void {
    const frame = frames[frameIndex];
    if (!frame?.throws) return;
    if (throwIndex >= 0 && throwIndex < frame.throws.length) {
      frame.throws.splice(throwIndex, 1);
      frame.throws.forEach((t, idx) => {
        t.throwIndex = idx + 1;
      });
    }
  }

  // NAVIGATION & STATE CALCULATION
  isCellAccessible(frames: Frame[], frameIndex: number, throwIndex: number): boolean {
    if (throwIndex === 0) {
      return true;
    }

    const frame = frames[frameIndex];
    if (!frame || !frame.throws) {
      return false;
    }

    const firstThrow = frame.throws[0];
    const firstVal = firstThrow?.value;

    if (throwIndex === 1) {
      if (firstThrow === undefined || firstVal === undefined) {
        return false;
      }

      if (frameIndex < 9 && firstVal === 10) {
        return false;
      }

      return true;
    }

    if (frameIndex === 9 && throwIndex === 2) {
      const secondThrow = frame.throws[1];
      const secondVal = secondThrow?.value;

      if (firstThrow === undefined || firstVal === undefined) {
        return false;
      }
      if (secondThrow === undefined || secondVal === undefined) {
        return false;
      }

      const isStrike = firstVal === 10;
      const isSpare = !isStrike && firstVal + secondVal === 10;

      if (isStrike || isSpare) {
        return true;
      }

      return false;
    }

    return false;
  }

  calculateNextPosition(
    frames: Frame[],
    frameIndex: number,
    throwIndex: number,
    currentInput?: number[] | number,
  ): { nextFrameIndex: number; nextThrowIndex: number } {
    const val = this.resolveInputValue(frames, frameIndex, throwIndex, currentInput);

    if (frameIndex < 9) {
      if (throwIndex === 0) {
        return val === 10
          ? { nextFrameIndex: frameIndex + 1, nextThrowIndex: 0 } // Strike
          : { nextFrameIndex: frameIndex, nextThrowIndex: 1 }; // Open
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

  getAvailablePins(frameIndex: number, throwIndex: number, frameThrows: Throw[]): number[] {
    if (throwIndex === 0) return this.ALL_PINS;

    const prevThrow = frameThrows[throwIndex - 1];
    if (!prevThrow) return this.ALL_PINS;

    // 10th Frame Special Logic
    if (frameIndex === 9) {
      if (throwIndex === 1 && prevThrow.value === 10) return this.ALL_PINS; // Strike resets

      if (throwIndex === 2) {
        const firstVal = frameThrows[0]?.value ?? 0;
        const secondVal = prevThrow.value ?? 0;

        // X X _ -> Reset
        if (secondVal === 10) return this.ALL_PINS;
        // X 5 / -> Reset (Spare)
        if (firstVal !== 10 && firstVal + secondVal === 10) return this.ALL_PINS;
        // 5 / X -> Reset (Spare - captured)
      }
    }

    if (prevThrow.pinsLeftStanding?.length) return prevThrow.pinsLeftStanding;
    if (prevThrow.pinsKnockedDown?.length) return this.ALL_PINS.filter((p) => !prevThrow.pinsKnockedDown!.includes(p));

    if (prevThrow.value === 10) return [];

    return this.ALL_PINS;
  }

  // SPLIT & PATTERN LOGIC
  calculateSplit(frameIndex: number, throwIndex: number, pinsLeftStanding: number[], throwsData: Throw[][]): boolean {
    const isFirstThrow = throwIndex === 0;
    const isTenthFrame = frameIndex === 9;

    if (!isTenthFrame) return isFirstThrow ? this.isSplit(pinsLeftStanding) : false;

    if (isFirstThrow) return this.isSplit(pinsLeftStanding);

    const firstThrow = throwsData[9]?.[0];
    const secondThrow = throwsData[9]?.[1];

    if (throwIndex === 1 && firstThrow?.value === 10) return this.isSplit(pinsLeftStanding);

    if (throwIndex === 2) {
      const doubleStrike = firstThrow?.value === 10 && secondThrow?.value === 10;
      const spare = firstThrow && secondThrow && firstThrow.value !== 10 && firstThrow.value + secondThrow.value === 10;

      if (doubleStrike || spare) return this.isSplit(pinsLeftStanding);
    }

    return false;
  }

  isSplit(pinsLeftStanding: number[]): boolean {
    const numPins = pinsLeftStanding?.length ?? 0;
    if (numPins < 2 || pinsLeftStanding.includes(1)) return false;

    const occupiedColumns = new Set<number>();
    for (const pin of pinsLeftStanding) {
      const col = this.PIN_TO_COLUMN[pin];
      if (col) occupiedColumns.add(col);
    }

    const sortedCols = Array.from(occupiedColumns).sort((a, b) => a - b);
    for (let i = 0; i < sortedCols.length - 1; i++) {
      if (sortedCols[i + 1] - sortedCols[i] > 1) return true;
    }

    return false;
  }

  isMakeableSplit(pinsLeftStanding: number[]): boolean {
    if (!this.isSplit(pinsLeftStanding)) return false;

    const sortedPins = [...pinsLeftStanding].sort((a, b) => a - b);

    for (const unmakeable of this.UNMAKEABLE_SPLITS) {
      const sortedUnmakeable = [...unmakeable].sort((a, b) => a - b);
      if (this.areArraysEqual(sortedPins, sortedUnmakeable)) return false;
    }
    return true;
  }

  // INPUT PARSING
  calculateIsClean(frames: Frame[]): boolean {
    for (let i = 0; i < Math.min(frames.length, 10); i++) {
      const frame = frames[i];
      if (!frame || !frame.throws || frame.throws.length === 0) {
        continue; // Skip empty frames
      }

      const first = getThrowValue(frame, 0);
      const second = getThrowValue(frame, 1);

      if (first === undefined) {
        continue; // Skip incomplete frames
      }

      if (i < 9) {
        // Frames 1-9: must be strike or spare
        if (first !== 10 && (second === undefined || first + second < 10)) {
          return false; // Open frame
        }
      } else {
        // 10th frame: first two balls must add up to at least 10
        if (second === undefined) {
          continue; // Incomplete
        }
        if (first !== 10 && first + second < 10) {
          return false; // Open frame
        }
      }
    }
    return true;
  }
  parseInputValue(input: string, frameIndex: number, throwIndex: number, frames: Frame[]): number {
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

  parseBowlingScores(input: string, username: string): { frames: number[][]; frameScores: number[]; totalScore: number } {
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

  // PRIVATE HELPERS
  private ensureFrameStructure(frames: Frame[], frameIndex: number, throwIndex: number): void {
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

  private validatePinsHit(frame: Frame, throwIndex: number, availablePins: number[], inputPins: number[]): number[] {
    const isDataTrap = availablePins.length === 0 && throwIndex > 0 && frame.throws[throwIndex - 1].value !== 10;

    if (isDataTrap) return inputPins;
    return inputPins.filter((p) => availablePins.includes(p));
  }

  private resolveInputValue(frames: Frame[], frameIndex: number, throwIndex: number, currentInput?: number[] | number): number {
    if (Array.isArray(currentInput)) return currentInput.length;
    if (typeof currentInput === 'number') return currentInput;
    return frames[frameIndex]?.throws?.[throwIndex]?.value ?? 0;
  }

  private areArraysEqual(arr1: number[], arr2: number[]): boolean {
    if (arr1.length !== arr2.length) return false;
    return arr1.every((val, idx) => val === arr2[idx]);
  }

  private cleanupSubsequentThrows(frame: Frame, frameIndex: number, throwIndex: number, value: number, pinsStandingAfter: number[]): void {
    // Only need to cleanup if we modify the first throw (or 2nd in 10th frame)
    // and subsequent throws exist.
    if (frame.throws.length <= throwIndex + 1) return;

    const isTenthFrame = frameIndex === 9;
    const nextThrow = frame.throws[throwIndex + 1];

    if (!isTenthFrame) {
      if (value === 10) {
        frame.throws.splice(1);
      } else {
        this.validateOrClearThrow(nextThrow, pinsStandingAfter, frame, throwIndex + 1);
      }
      return;
    }

    // 10th Frame Logic
    if (throwIndex === 0) {
      const availableForSecond = value === 10 ? this.ALL_PINS : pinsStandingAfter;
      this.validateOrClearThrow(nextThrow, availableForSecond, frame, 1);
    } else if (throwIndex === 1) {
      if (frame.throws.length > 2) {
        const firstVal = frame.throws[0].value;
        const availableForThird = (firstVal === 10 && value === 10) || firstVal + value === 10 ? this.ALL_PINS : pinsStandingAfter;

        this.validateOrClearThrow(frame.throws[2], availableForThird, frame, 2);
      }
    }
  }

  private validateOrClearThrow(targetThrow: Throw, availablePins: number[], frame: Frame, targetIndex: number): void {
    const invalidPins = (targetThrow.pinsKnockedDown || []).filter((p) => !availablePins.includes(p));

    if (invalidPins.length > 0) {
      frame.throws.splice(targetIndex);
    } else {
      targetThrow.pinsLeftStanding = availablePins.filter((p) => !targetThrow.pinsKnockedDown!.includes(p));
    }
  }
}
