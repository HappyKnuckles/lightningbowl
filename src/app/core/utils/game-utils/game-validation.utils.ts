import { Frame, Game, Throw } from 'src/app/core/models/game.model';

import { getThrowValue } from './frame.utils';

export function canRecordStrike(frameIndex: number, throwIndex: number, frames: Frame[]): boolean {
  if (frameIndex < 9) {
    return throwIndex === 0;
  }

  const frame = frames[9];
  const firstThrow = getThrowValue(frame, 0);
  const secondThrow = getThrowValue(frame, 1);

  if (throwIndex === 0) return true;
  if (throwIndex === 1) return firstThrow === 10;
  if (throwIndex === 2) {
    if (firstThrow === 10 && secondThrow === 10) return true;
    if (firstThrow !== undefined && secondThrow !== undefined && firstThrow !== 10 && firstThrow + secondThrow === 10) {
      return true;
    }
    return false;
  }
  return false;
}

export function canRecordSpare(frameIndex: number, throwIndex: number, frames: Frame[]): boolean {
  if (throwIndex === 0) return false;

  if (frameIndex < 9) {
    const firstThrow = getThrowValue(frames[frameIndex], 0);
    return firstThrow !== undefined && firstThrow !== 10;
  }

  const firstThrow = getThrowValue(frames[9], 0);
  const secondThrow = getThrowValue(frames[9], 1);

  if (throwIndex === 1) {
    return firstThrow !== undefined && firstThrow !== 10;
  }
  if (throwIndex === 2) {
    return firstThrow === 10 && secondThrow !== undefined && secondThrow !== 10;
  }
  return false;
}

export function canUndoLastThrow(frames: Frame[], frameIndex: number, throwIndex: number): boolean {
  if (!frames || frameIndex < 0 || throwIndex < 0) return false;

  const currentFrame = frames[frameIndex];
  const currentValue = currentFrame?.throws?.[throwIndex]?.value;
  if (currentValue !== undefined) return true;

  if (throwIndex > 0) {
    return currentFrame?.throws?.[throwIndex - 1]?.value !== undefined;
  }

  if (frameIndex > 0) {
    const prevFrame = frames[frameIndex - 1];
    if (prevFrame?.throws?.length) {
      return prevFrame.throws[prevFrame.throws.length - 1].value !== undefined;
    }
  }

  return false;
}

export function isValidFrameScore(inputValue: number, frameIndex: number, inputIndex: number, frames: Frame[]): boolean {
  const frame = frames[frameIndex];

  if (inputIndex === 1 && getThrowValue(frame, 0) === undefined) {
    return false;
  }

  if (frameIndex < 9) {
    const firstThrow = getThrowValue(frame, 0) ?? 0;
    const secondThrow = inputIndex === 1 ? inputValue : (getThrowValue(frame, 1) ?? 0);
    if (inputIndex === 0 && getThrowValue(frame, 1) !== undefined) {
      return inputValue + (getThrowValue(frame, 1) ?? 0) <= 10;
    }
    return firstThrow + secondThrow <= 10;
  }

  const firstThrow = getThrowValue(frame, 0) ?? 0;
  const secondThrow = getThrowValue(frame, 1) ?? 0;
  switch (inputIndex) {
    case 0:
      return inputValue <= 10;
    case 1:
      return firstThrow === 10 ? inputValue <= 10 : firstThrow + inputValue <= 10;
    case 2:
      if (firstThrow === 10) {
        return secondThrow === 10 ? inputValue <= 10 : inputValue <= 10 - secondThrow;
      }
      if (firstThrow + secondThrow === 10) {
        return inputValue <= 10;
      }
      return false;
    default:
      return false;
  }
}

export function isGameValid(game?: Game): boolean {
  if (!game || !game.frames) return false;
  return isGameValidFromFrames(game.frames);
}

function isGameValidFromFrames(frames: Frame[]): boolean {
  if (!frames || frames.length < 10) return false;

  for (let index = 0; index < 10; index++) {
    const frame = frames[index];
    if (!frame || !frame.throws) return false;

    const throws = frame.throws.map((t: Throw) => (typeof t.value === 'string' ? parseInt(t.value as string, 10) : t.value));

    if (index < 9) {
      const first = throws[0];
      const second = throws[1];

      if (first === undefined || isNaN(first)) return false;

      const frameValid =
        (first === 10 && (second === undefined || isNaN(second))) ||
        (first !== 10 && throws.length >= 2 && !isNaN(second) && first + second <= 10 && throws.slice(0, 2).every((v) => v >= 0 && v <= 10));

      if (!frameValid) return false;
    } else {
      const first = throws[0];
      const second = throws[1];

      if (first === undefined || isNaN(first) || second === undefined || isNaN(second)) return false;

      const frameValid =
        (first === 10 && throws.length === 3 && throws.every((v) => !isNaN(v) && v >= 0 && v <= 10)) ||
        (throws.length === 2 && first + second < 10 && throws.every((v) => !isNaN(v) && v >= 0 && v <= 10)) ||
        (throws.length === 3 && first + second >= 10 && throws.every((v) => !isNaN(v) && v >= 0 && v <= 10));

      if (!frameValid) return false;
    }
  }

  return true;
}
