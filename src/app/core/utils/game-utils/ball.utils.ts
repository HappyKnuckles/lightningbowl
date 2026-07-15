import { Ball } from 'src/app/core/models/ball.model';
import { Frame, Game, ThrowBall } from 'src/app/core/models/game.model';
import { createThrow } from './frame.utils';

// Keys & formatting

/**
 * Get a compact key string for a ThrowBall used for comparison/deduplication.
 * Format: "BallName{weight}" e.g. "Storm IQ Tour15"
 */
export function getThrowBallKey(ball: ThrowBall): string {
  return ball.weight ? `${ball.name}${ball.weight}` : ball.name;
}

/**
 * Format a ThrowBall for human-readable display.
 * Format: "BallName Weightlbs" e.g. "Storm IQ Tour 15lbs"
 */
export function formatThrowBall(ball: ThrowBall | undefined): string {
  if (!ball?.name) return '';
  return ball.weight ? `${ball.name} ${ball.weight}lbs` : ball.name;
}

/**
 * Find the arsenal entry a ThrowBall refers to, tolerating the different name formats
 * a stored ball can have: plain name, "Name{weight}" key, or "Name {weight}lbs" display string.
 */
export function findBallInArsenal<T extends Pick<Ball, 'ball_name' | 'core_weight'>>(ball: ThrowBall | undefined, arsenal: T[]): T | undefined {
  if (!ball?.name) return undefined;

  const normalize = (value: string) =>
    value
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/lbs?|#/g, '');

  const name = normalize(ball.name);
  const key = normalize(getThrowBallKey(ball));

  return arsenal.find((b) => {
    const byName = normalize(b.ball_name);
    const byKey = normalize(b.ball_name + b.core_weight);
    return byKey === key || byName === key || byKey === name || byName === name;
  });
}

// Game-level accessors

/**
 * Get all unique ball keys used in a game (from throw-level data, falling back to game.balls)
 */
export function getGameBalls(game: Game): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const frame of game.frames) {
    for (const t of frame.throws) {
      if (t.ball?.name) {
        const key = getThrowBallKey(t.ball);
        if (!seen.has(key)) {
          seen.add(key);
          keys.push(key);
        }
      }
    }
  }
  if (keys.length > 0) {
    return keys;
  }
  return game.balls || [];
}

/**
 * Get unique ball names used in a game for display purposes (weight is intentionally omitted).
 * Uses per-throw ball data when available, falling back to game.balls.
 * If an arsenal is provided, legacy game.balls entries (stored as "name+weight" keys) are resolved back to ball names.
 */
export function getGameBallNames(game: Game, arsenal?: Pick<Ball, 'ball_name' | 'core_weight'>[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const frame of game.frames) {
    for (const t of frame.throws) {
      if (t.ball?.name) {
        const key = getThrowBallKey(t.ball);
        if (!seen.has(key)) {
          seen.add(key);
          names.push(t.ball.name);
        }
      }
    }
  }
  if (names.length > 0) {
    return names;
  }

  const balls = game.balls || [];
  if (balls.length === 0 || !arsenal) {
    return balls;
  }

  return balls.map((key) => {
    const match = arsenal.find((b) => getThrowBallKey({ name: b.ball_name, weight: b.core_weight }) === key);
    return match ? match.ball_name : key;
  });
}

// Carry-over logic

/**
 * Ball carried over from earlier throws, strictly by throw index: the last ball used
 * on a first throw defaults the next first throw, the last ball used on a second/third
 * throw defaults the next second/third throw. Falls back to the last ball used at all
 * when that throw index never had a ball yet.
 * Only throws before the given position (in play order) are considered.
 */
export function getCarryOverThrowBall(frames: Frame[], frameIndex: number, throwIndex: number): ThrowBall | undefined {
  const wantFirstThrow = throwIndex === 0;
  let sameKindBall: ThrowBall | undefined;
  let latestBall: ThrowBall | undefined;

  for (let f = 0; f <= Math.min(frameIndex, frames.length - 1); f++) {
    const throws = frames[f]?.throws ?? [];
    for (let t = 0; t < throws.length; t++) {
      if (f === frameIndex && t >= throwIndex) break;
      const ball = throws[t]?.ball;
      if (!ball?.name) continue;
      latestBall = ball;
      if ((t === 0) === wantFirstThrow) {
        sameKindBall = ball;
      }
    }
  }

  return sameKindBall ?? latestBall;
}

// Mutators

/** Assign a ball to a throw within a frames array, creating placeholder throws if needed (mutates). */
export function setThrowBall(frames: Frame[], frameIndex: number, throwIndex: number, ball: ThrowBall | undefined): void {
  const frame = frames[frameIndex];
  if (!frame) return;

  while (frame.throws.length <= throwIndex) {
    frame.throws.push(createThrow(0, frame.throws.length + 1));
  }
  frame.throws[throwIndex] = { ...frame.throws[throwIndex], throwIndex: throwIndex + 1, ball };
}
