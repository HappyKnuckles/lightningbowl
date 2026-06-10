import { Frame } from '../../models/game.model';
import { getThrowValue } from './game-utils.service';

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

  // --- 10th frame ---
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

/** Legacy formatter operating on a Frame[] by index. */
export function formatThrowValue(frameIndex: number, throwIndex: number, frames: Frame[]): string {
  const frame = frames[frameIndex];
  if (!frame || frame.throws[throwIndex] === undefined || frame.throws[throwIndex] === null) {
    return '';
  }

  const val = frame.throws[throwIndex].value;
  const firstBall = frame.throws[0].value;
  const isTenth = frameIndex === 9;

  if (val === 0) return '–';

  if (throwIndex === 0) {
    return val === 10 ? 'X' : val.toString();
  }

  if (!isTenth) {
    if (firstBall !== undefined && firstBall !== 10 && firstBall + val === 10) return '/';
    return val.toString();
  }

  const secondBall = frame.throws[1].value;

  if (throwIndex === 1) {
    if (val === 10) return 'X';
    if (firstBall !== undefined && firstBall !== 10 && firstBall + val === 10) return '/';
    return val.toString();
  }

  if (throwIndex === 2) {
    if (val === 10) return 'X';
    if (firstBall === 10 && secondBall !== undefined && secondBall !== 10 && secondBall + val === 10) return '/';
    return val.toString();
  }

  return val.toString();
}

/** Parses user input (X, /, numbers) into numeric values, operating on number[][]. */
export function parseInputValueOld(inputValue: string, frameIndex: number, throwIndex: number, frames: number[][]): number {
  if (frameIndex < 9) {
    if (inputValue === 'X' || inputValue === 'x') return 10;
    if (inputValue === '/') {
      const firstThrow = frames[frameIndex][0] || 0;
      return 10 - firstThrow;
    }
  } else {
    const firstThrow = frames[frameIndex][0] || 0;
    const secondThrow = frames[frameIndex][1] || 0;

    switch (throwIndex) {
      case 0:
        if (inputValue === 'X' || inputValue === 'x') return 10;
        break;
      case 1:
        if (firstThrow === 10) {
          if (inputValue === 'X' || inputValue === 'x') return 10;
        } else if (inputValue === '/') {
          return 10 - firstThrow;
        }
        break;
      case 2:
        if (firstThrow === 10) {
          if (secondThrow === 10 && (inputValue === 'X' || inputValue === 'x')) return 10;
          if (secondThrow !== 10 && inputValue === '/') return 10 - secondThrow;
        } else if (firstThrow + secondThrow === 10) {
          if (inputValue === 'X' || inputValue === 'x') return 10;
        }
        break;
    }
  }
  return parseInt(inputValue, 10);
}

export function parseInputValue(input: string, frameIndex: number, throwIndex: number, frames: Frame[]): number {
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
