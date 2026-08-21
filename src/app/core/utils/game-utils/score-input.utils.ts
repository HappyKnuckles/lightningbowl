import { Frame } from 'src/app/core/models/game.model';
import { getThrowValue } from './frame.utils';

/** Thrown when a scanned scoresheet holds no score lines for the given player. */
export class ScoreSheetPlayerNotFoundError extends Error {
  constructor(readonly username: string) {
    super(`Insufficient score data for user ${username}`);
    this.name = 'ScoreSheetPlayerNotFoundError';
  }
}

/** Parse a single typed throw input (X, /, number) against a Frame[]. */
export function parseInputValue(input: string, frameIndex: number, throwIndex: number, frames: Frame[]): number {
  const upperInput = input.toUpperCase();
  if (upperInput === 'X') return 10;
  if (upperInput === '-') return 0;

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

/**
 * Display symbol for a single throw: 'X', '/', the miss symbol, a number, or ''.
 * @param missSymbol shown for a knocked - zero throw.Omit to render the number(live grid);
 * pass '–' for the readonly / share grid.
 */
export function formatThrowDisplay(frame: Frame | undefined, throwIndex: number, isTenth: boolean): string {
  const missSymbol = '–';
  const spareSymbol = '/';
  const strikeSymbol = 'X';

  if (!frame) return '';

  const val = getThrowValue(frame, throwIndex);
  if (val === undefined || val === null) return '';

  const v0 = getThrowValue(frame, 0);
  const v1 = getThrowValue(frame, 1);
  const num = (n: number) => (n === 0 && missSymbol !== undefined ? missSymbol : String(n));

  if (throwIndex === 0) {
    return val === 10 ? strikeSymbol : num(val);
  }

  if (!isTenth) {
    if (v0 !== undefined && v0 !== 10 && v0 + val === 10) return spareSymbol;
    return num(val);
  }

  // --- 10th frame ---
  if (throwIndex === 1) {
    if (v0 !== undefined && v0 !== 10 && v0 + val === 10) return spareSymbol;
    return val === 10 ? strikeSymbol : num(val);
  }

  // throwIndex === 2
  if (v0 === 10) {
    if (v1 === 10) return val === 10 ? strikeSymbol : num(val);
    return v1 !== undefined && v1 + val === 10 ? spareSymbol : num(val);
  }
  return val === 10 ? strikeSymbol : num(val);
}

export function parseBowlingScores(input: string, username: string): { frames: number[][]; frameScores: number[]; totalScore: number } {
  const lines = input.split('\n').filter((line) => line.trim() !== '');
  const userIndex = lines.findIndex((line) => line.toLowerCase().includes(username.toLowerCase()));
  const linesAfterUsername = userIndex >= 0 ? lines.slice(userIndex + 1) : [];
  const nextNonXLineIndex = linesAfterUsername.findIndex((line) => /^[a-wyz]/i.test(line));
  const relevantLines = nextNonXLineIndex >= 0 ? linesAfterUsername.slice(0, nextNonXLineIndex) : linesAfterUsername;

  if (relevantLines.length < 2) {
    throw new ScoreSheetPlayerNotFoundError(username);
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
