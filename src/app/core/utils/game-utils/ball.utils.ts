import { Ball } from 'src/app/core/models/ball.model';
import { BallTracking, Frame, Game, ThrowBall } from 'src/app/core/models/game.model';
import { parseStoredBall } from 'src/app/core/utils/ball-utils/stored-ball.utils';
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

/**
 * Ball mode of a game being entered. A game keeps its own mode once it carries ball data;
 * one without any follows `fallback` (the user's default), even if it was flagged before:
 * closing the game's ball picker with nothing picked flags it 'game' without adding data,
 * and that must not stop a later switch of the default from applying to it.
 */
export function resolveBallTracking(game: Pick<Game, 'ballTracking' | 'balls' | 'frames'>, fallback: BallTracking): BallTracking {
  const throwBalls = hasThrowLevelBalls(game.frames ?? []);
  const gameBalls = (game.balls ?? []).length > 0;
  if (game.ballTracking && (throwBalls || gameBalls)) return game.ballTracking;
  if (throwBalls) return 'throw';
  if (gameBalls) return 'game';
  return fallback;
}

/** Whether any throw carries a ball, i.e. whether per-throw data exists at all. */
export function hasThrowLevelBalls(frames: Frame[]): boolean {
  return frames.some((frame) => (frame.throws ?? []).some((t) => t.ball?.name));
}

/** Unique balls taken strictly from the throws, in first-use order. */
export function getThrowBalls(frames: Frame[]): ThrowBall[] {
  const seen = new Set<string>();
  const balls: ThrowBall[] = [];
  for (const frame of frames) {
    for (const t of frame.throws ?? []) {
      if (!t.ball?.name) continue;
      const key = getThrowBallKey(t.ball);
      if (!seen.has(key)) {
        seen.add(key);
        balls.push({ name: t.ball.name, weight: t.ball.weight });
      }
    }
  }
  return balls;
}

/** Unique ball keys taken strictly from the throws, in first-use order. */
export function getThrowBallKeys(frames: Frame[]): string[] {
  return getThrowBalls(frames).map(getThrowBallKey);
}

/**
 * Number of recorded throws that carry a ball. A pending pick for an unbowled throw is not
 * counted: nothing has been recorded with it yet.
 */
export function countThrowBalls(frames: Frame[]): number {
  return frames.reduce((count, frame) => count + (frame.throws ?? []).filter((t) => t.ball?.name).length, 0);
}

/**
 * All unique ball keys of a game, read from wherever its tracking mode keeps them: the throws in
 * `throw` tracking, `game.balls` in `game` tracking. Throws can still carry balls on a game that
 * switched to `game` tracking without clearing them, and those must not outvote the selection.
 */
export function getGameBalls(game: Game): string[] {
  return getBallTracking(game) === 'throw' ? getThrowBallKeys(game.frames ?? []) : (game.balls ?? []).map(getThrowBallKey);
}

/** Every ball of a game, from the same source as `getGameBalls`. */
function gameBallList(game: Game): ThrowBall[] {
  const balls =
    getBallTracking(game) === 'throw' ? (game.frames ?? []).flatMap((frame) => (frame.throws ?? []).map((t) => t.ball)) : (game.balls ?? []);
  return balls.filter((ball): ball is ThrowBall => !!ball?.name);
}

/** Unique values of `format` over a game's balls, in first-use order. */
function uniqueGameBalls(game: Game, format: (ball: ThrowBall) => string): string[] {
  return [...new Set(gameBallList(game).map(format))];
}

/**
 * Unique ball names of a game without their weights (one "Phaze" for Phaze 14 and Phaze 15), for
 * looking the balls up by name.
 */
export function getGameBallNames(game: Game): string[] {
  return uniqueGameBalls(game, (ball) => ball.name);
}

/** Unique balls of a game as shown to the user, with their weight: "Phaze 15lbs". */
export function getGameBallLabels(game: Game): string[] {
  return uniqueGameBalls(game, formatThrowBall);
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
 *
 * `previousGames` (oldest first) carries the selection across games: a game's first frames
 * default to the first ball and spare ball the earlier games ended on. A ball of the right
 * kind from an earlier game beats a ball of the other kind from this game, so the first spare
 * shot of game two takes the spare ball, not the strike ball just thrown.
 */
export function getCarryOverThrowBall(frames: Frame[], frameIndex: number, throwIndex: number, previousGames: Frame[][] = []): ThrowBall | undefined {
  const targetFrame = frames[frameIndex];
  const wantFirstBall = targetFrame ? isFirstBallThrow(targetFrame, frameIndex, throwIndex) : throwIndex === 0;

  let previous: CarriedBalls = {};
  for (const gameFrames of previousGames) {
    const carried = collectCarriedBalls(gameFrames, wantFirstBall, gameFrames.length, 0);
    previous = { sameKind: carried.sameKind ?? previous.sameKind, latest: carried.latest ?? previous.latest };
  }
  const current = collectCarriedBalls(frames, wantFirstBall, frameIndex, throwIndex);

  return current.sameKind ?? previous.sameKind ?? current.latest ?? previous.latest;
}

interface CarriedBalls {
  sameKind?: ThrowBall;
  latest?: ThrowBall;
}

/** Last ball of the wanted kind and last ball at all, among throws before (`frameIndex`, `throwIndex`). */
function collectCarriedBalls(frames: Frame[], wantFirstBall: boolean, frameIndex: number, throwIndex: number): CarriedBalls {
  const carried: CarriedBalls = {};
  for (let f = 0; f <= Math.min(frameIndex, frames.length - 1); f++) {
    const frame = frames[f];
    const throws = frame?.throws ?? [];
    for (let t = 0; t < throws.length; t++) {
      if (f === frameIndex && t >= throwIndex) break;
      const ball = throws[t]?.ball;
      if (!ball?.name) continue;
      carried.latest = ball;
      if (isFirstBallThrow(frame, f, t) === wantFirstBall) {
        carried.sameKind = ball;
      }
    }
  }
  return carried;
}

/**
 * Frames whose throw balls are limited to the arsenal (copies; the input is left alone), so a
 * ball carried over from an older game is never one the user has since removed.
 */
export function keepArsenalThrowBalls(frames: Frame[], arsenal: Pick<Ball, 'ball_name' | 'core_weight'>[]): Frame[] {
  return frames.map((frame) => ({
    ...frame,
    throws: (frame.throws ?? []).map((t) => (t.ball && !findBallInArsenal(t.ball, arsenal) ? { ...t, ball: undefined } : t)),
  }));
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
 * Remove every per-throw ball and pending pick (mutates). Used when a game switches to one
 * selection for the whole game, so the throws no longer hold balls that selection replaced.
 */
export function clearThrowBalls(frames: Frame[]): void {
  for (const frame of frames) {
    for (const t of frame.throws ?? []) {
      delete t.ball;
    }
    delete frame.pendingBall;
    delete frame.pendingBallThrowIndex;
  }
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
 * ball carried over from earlier throws (and earlier games, see `getCarryOverThrowBall`). A recorded throw answers for itself, absence included —
 * carrying a ball onto it would undo the user clearing the pick.
 */
export function getThrowBallForPosition(
  frames: Frame[],
  frameIndex: number,
  throwIndex: number,
  previousGames: Frame[][] = [],
): ThrowBall | undefined {
  const frame = frames[frameIndex];
  const recordedThrow = frame?.throws?.[throwIndex];
  if (recordedThrow) return recordedThrow.ball;

  const pending = getPendingBall(frame, throwIndex);
  if (pending !== undefined) return pending ?? undefined;

  return getCarryOverThrowBall(frames, frameIndex, throwIndex, previousGames);
}

// Weights

/** Weight of a ball stored without one that the arsenal doesn't have either. */
export const DEFAULT_BALL_WEIGHT = '15';

/**
 * The weight a ball stored without one gets: the arsenal's weight for that name (the heaviest
 * when it holds several), else `DEFAULT_BALL_WEIGHT`.
 */
export function weightFromArsenal(name: string, arsenal: Pick<Ball, 'ball_name' | 'core_weight'>[]): string {
  const wanted = normalizeBallKey(name);
  const weights = arsenal
    .filter((ball) => normalizeBallKey(ball.ball_name) === wanted)
    .map((ball) => Number(ball.core_weight))
    .filter((weight) => Number.isFinite(weight));
  return weights.length > 0 ? String(Math.max(...weights)) : DEFAULT_BALL_WEIGHT;
}

/**
 * A ball as games store it, `{ name, weight }`, from any format it was written in: a plain name
 * ("Phaze"), the "Name{weight}" key ("Phaze15"), the display string ("Phaze 15lbs") or a ball
 * object that may lack its weight. A missing weight comes from `weightFromArsenal`.
 */
export function toGameBall(value: string | ThrowBall, arsenal: Pick<Ball, 'ball_name' | 'core_weight'>[]): ThrowBall {
  const raw = typeof value === 'string' ? { name: value.trim() } : { name: value.name.trim(), weight: value.weight };
  if (raw.weight) return { name: raw.name, weight: String(raw.weight) };
  // a name the arsenal knows as it is ("Black Widow 3.0") isn't split into name and weight
  const parsed = arsenal.some((ball) => normalizeBallKey(ball.ball_name) === normalizeBallKey(raw.name)) ? raw : parseStoredBall(raw.name);
  return { name: parsed.name, weight: parsed.weight ?? weightFromArsenal(parsed.name, arsenal) };
}

/** Whether a ball still needs `toGameBall`: a string, or an object without a weight. */
function needsMigration(value: unknown): boolean {
  return typeof value === 'string' || (typeof value === 'object' && value !== null && !(value as ThrowBall).weight);
}

/**
 * Brings a game's balls to `{ name, weight }` (see `toGameBall`), dropping the duplicates that
 * leaves ("Phaze 15lbs" and "Phaze" both become Phaze 15). Throw balls without a weight get one
 * the same way. Returns the game itself when nothing changed.
 */
export function migrateGameBalls<T extends Pick<Game, 'balls' | 'frames'>>(game: T, arsenal: Pick<Ball, 'ball_name' | 'core_weight'>[]): T {
  const stored = (game.balls ?? []) as unknown[];
  const ballsChanged = stored.some(needsMigration);
  const framesChanged = (game.frames ?? []).some((frame) => frame.throws?.some((t) => t.ball && needsMigration(t.ball)));
  if (!ballsChanged && !framesChanged) return game;

  const migrated = { ...game };
  if (ballsChanged) {
    const unique = new Map<string, ThrowBall>();
    for (const value of stored as (string | ThrowBall)[]) {
      if (!value || (typeof value === 'string' ? !value.trim() : !value.name?.trim())) continue;
      const ball = toGameBall(value, arsenal);
      unique.set(normalizeBallKey(getThrowBallKey(ball)), ball);
    }
    migrated.balls = [...unique.values()];
  }
  if (framesChanged) {
    migrated.frames = game.frames.map((frame) => ({
      ...frame,
      throws: (frame.throws ?? []).map((t) => (t.ball && needsMigration(t.ball) ? { ...t, ball: toGameBall(t.ball, arsenal) } : t)),
    }));
  }
  return migrated;
}

/** A game's balls in a stable order (by "Name{weight}" key), as games are saved. */
export function sortGameBalls(balls: ThrowBall[]): ThrowBall[] {
  return [...balls].sort((a, b) => getThrowBallKey(a).localeCompare(getThrowBallKey(b)));
}

/** Whether two stored balls are the same ball in the same weight, however they were spelled. */
export function sameGameBall(a: ThrowBall, b: ThrowBall): boolean {
  return normalizeBallKey(getThrowBallKey(a)) === normalizeBallKey(getThrowBallKey(b));
}
