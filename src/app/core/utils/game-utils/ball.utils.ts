import { Ball } from 'src/app/core/models/ball.model';
import { BallTracking, Frame, Game, ThrowBall } from 'src/app/core/models/game.model';
import { isFirstBallThrow } from './frame.utils';

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
 * Comparable form of a stored ball string. `Game.balls` has held plain names, "Name{weight}"
 * keys and "Name {weight}lbs" display strings at different points, so every comparison between
 * two stored balls goes through this rather than `===`.
 */
export function normalizeBallKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/lbs?|#/g, '');
}

/**
 * Whether a stored ball string refers to this ball, in any of the formats it may have been
 * written in: the plain name, the "Name{weight}" key, or the "Name {weight}lbs" display string.
 * A plain name matches every weight of that ball — the weight simply was never recorded.
 */
export function ballValueMatches(value: string, ball: Pick<Ball, 'ball_name' | 'core_weight'>): boolean {
  const stored = normalizeBallKey(value);
  return stored === normalizeBallKey(ball.ball_name + ball.core_weight) || stored === normalizeBallKey(ball.ball_name);
}

/**
 * Find the arsenal entry a ThrowBall refers to, tolerating the different name formats
 * a stored ball can have: plain name, "Name{weight}" key, or "Name {weight}lbs" display string.
 */
export function findBallInArsenal<T extends Pick<Ball, 'ball_name' | 'core_weight'>>(ball: ThrowBall | undefined, arsenal: T[]): T | undefined {
  if (!ball?.name) return undefined;

  const name = normalizeBallKey(ball.name);
  const key = normalizeBallKey(getThrowBallKey(ball));

  return arsenal.find((b) => {
    const byName = normalizeBallKey(b.ball_name);
    const byKey = normalizeBallKey(b.ball_name + b.core_weight);
    return byKey === key || byName === key || byKey === name || byName === name;
  });
}

/**
 * The canonical key for a stored ball string, resolved through the arsenal so the formats
 * `Game.balls` has used over time all reduce to one value. Falls back to the normalized string
 * for a ball that is not in the arsenal, which still compares equal to itself.
 */
export function canonicalBallKey(value: string, arsenal: Pick<Ball, 'ball_name' | 'core_weight'>[]): string {
  const match = findBallInArsenal({ name: value }, arsenal);
  return match ? normalizeBallKey(match.ball_name + match.core_weight) : normalizeBallKey(value);
}

// Game-level accessors

/**
 * How a game records its balls. Games saved before per-throw tracking carry no flag,
 * so fall back to whether any throw actually has a ball on it.
 */
export function getBallTracking(game: Pick<Game, 'ballTracking' | 'frames'>): BallTracking {
  if (game.ballTracking) return game.ballTracking;
  return hasThrowLevelBalls(game.frames ?? []) ? 'throw' : 'game';
}

/** Whether any throw carries a ball, i.e. whether per-throw data exists at all. */
export function hasThrowLevelBalls(frames: Frame[]): boolean {
  return frames.some((frame) => (frame.throws ?? []).some((t) => t.ball?.name));
}

/** Unique ball keys taken strictly from the throws, in first-use order. */
export function getThrowBallKeys(frames: Frame[]): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const frame of frames) {
    for (const t of frame.throws ?? []) {
      if (!t.ball?.name) continue;
      const key = getThrowBallKey(t.ball);
      if (!seen.has(key)) {
        seen.add(key);
        keys.push(key);
      }
    }
  }
  return keys;
}

/**
 * Get all unique ball keys used in a game (from throw-level data, falling back to game.balls)
 */
export function getGameBalls(game: Game): string[] {
  const keys = getThrowBallKeys(game.frames ?? []);
  return keys.length > 0 ? keys : (game.balls ?? []);
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
 * Ball carried over from earlier throws, matched by what the throw is for: the last ball
 * used on a first ball at a full rack defaults the next first ball, and the last ball used
 * on a spare shot defaults the next spare shot. Falls back to the last ball used at all
 * when that kind of throw has not happened yet.
 *
 * The tenth frame racks again after a strike or a spare, so its second and third throws can
 * be first balls too: a 10/10/10 tenth carries the first ball throughout, while a 9/-/X
 * tenth carries first ball, spare ball, first ball.
 *
 * Only throws before the given position, in play order, are considered.
 */
export function getCarryOverThrowBall(frames: Frame[], frameIndex: number, throwIndex: number): ThrowBall | undefined {
  const targetFrame = frames[frameIndex];
  const wantFirstBall = targetFrame ? isFirstBallThrow(targetFrame, frameIndex, throwIndex) : throwIndex === 0;

  let sameKindBall: ThrowBall | undefined;
  let latestBall: ThrowBall | undefined;

  for (let f = 0; f <= Math.min(frameIndex, frames.length - 1); f++) {
    const frame = frames[f];
    const throws = frame?.throws ?? [];
    for (let t = 0; t < throws.length; t++) {
      if (f === frameIndex && t >= throwIndex) break;
      const ball = throws[t]?.ball;
      if (!ball?.name) continue;
      latestBall = ball;
      if (isFirstBallThrow(frame, f, t) === wantFirstBall) {
        sameKindBall = ball;
      }
    }
  }

  return sameKindBall ?? latestBall;
}

// Mutators

/**
 * Assign a ball to a throw within a frames array (mutates).
 * If that throw hasn't been recorded yet, the ball is stashed on the frame as `pendingBall`
 * instead of fabricating a placeholder throw. It is applied once the throw is actually recorded.
 * Picking "no ball" for an unrecorded throw stores `null`, not `undefined`, so the carry-over
 * default in `processPinThrow` knows this was a deliberate clear rather than an untouched pick.
 */
export function setThrowBall(frames: Frame[], frameIndex: number, throwIndex: number, ball: ThrowBall | undefined): void {
  const frame = frames[frameIndex];
  if (!frame) return;

  if (throwIndex < frame.throws.length) {
    frame.throws[throwIndex] = { ...frame.throws[throwIndex], throwIndex: throwIndex + 1, ball };
    return;
  }

  frame.pendingBall = ball ?? null;
  frame.pendingBallThrowIndex = throwIndex;
}

/**
 * The pending pick belonging to one throw: the ball, `null` for a deliberate clear, or
 * `undefined` when nothing was picked for it — including when the frame's single pick was
 * made for a different throw.
 */
export function getPendingBall(frame: Frame | undefined, throwIndex: number): ThrowBall | null | undefined {
  if (!frame || frame.pendingBall === undefined) return undefined;
  if (frame.pendingBallThrowIndex !== undefined && frame.pendingBallThrowIndex !== throwIndex) return undefined;
  return frame.pendingBall;
}

/** Drop a frame's pending pick once the throw it was made for has been recorded. */
export function clearPendingBall(frame: Frame, throwIndex: number): void {
  if (frame.pendingBallThrowIndex !== undefined && frame.pendingBallThrowIndex !== throwIndex) return;
  frame.pendingBall = undefined;
  frame.pendingBallThrowIndex = undefined;
}

/**
 * Ball to show for a throw: what it was recorded with, else the pick waiting for it, else the
 * ball carried over from earlier throws. A recorded throw answers for itself, absence included —
 * carrying a ball onto it would undo the user clearing the pick.
 */
export function getThrowBallForPosition(frames: Frame[], frameIndex: number, throwIndex: number): ThrowBall | undefined {
  const frame = frames[frameIndex];
  const recordedThrow = frame?.throws?.[throwIndex];
  if (recordedThrow) return recordedThrow.ball;

  const pending = getPendingBall(frame, throwIndex);
  if (pending !== undefined) return pending ?? undefined;

  return getCarryOverThrowBall(frames, frameIndex, throwIndex);
}
