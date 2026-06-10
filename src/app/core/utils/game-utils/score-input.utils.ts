import { Frame } from 'src/app/core/models/game.model';
import { getThrowValue } from './frame.utils';

/** Parse a single typed throw input (X, /, number) against a Frame[]. */
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
