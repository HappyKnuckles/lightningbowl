/**
 * Standalone ten-pin scoring + game builders used to author deterministic
 * fixtures. Mirrors the shape produced by the app's own GameScoreCalculator so
 * seeded games look and total exactly like real ones, without importing any
 * Angular code.
 */
import type { Frame, Game, Throw } from '../../../src/app/core/models/game.model';

const ALL_PINS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Cumulative frame scores + grand total for a standard 10-frame game. */
export function scoreFrames(frames: number[][]): { frameScores: number[]; total: number } {
  const rolls: number[] = [];
  const starts: number[] = [];
  for (const f of frames) {
    starts.push(rolls.length);
    for (const v of f) rolls.push(v);
  }

  const frameScores: number[] = [];
  let total = 0;
  for (let i = 0; i < 10; i++) {
    const s = starts[i];
    if (i < 9) {
      if (rolls[s] === 10) {
        total += 10 + (rolls[s + 1] ?? 0) + (rolls[s + 2] ?? 0);
      } else if ((rolls[s] ?? 0) + (rolls[s + 1] ?? 0) === 10) {
        total += 10 + (rolls[s + 2] ?? 0);
      } else {
        total += (rolls[s] ?? 0) + (rolls[s + 1] ?? 0);
      }
    } else {
      total += frames[9].reduce((a, b) => a + b, 0);
    }
    frameScores.push(total);
  }
  return { frameScores, total };
}

function isFrameMark(frame: number[], isTenth: boolean): boolean {
  if (isTenth) {
    return frame[0] === 10 || (frame[0] ?? 0) + (frame[1] ?? 0) === 10;
  }
  return frame[0] === 10 || (frame[0] ?? 0) + (frame[1] ?? 0) === 10;
}

function toThrows(values: number[], pinData?: { left?: number[]; knocked?: number[] }[]): Throw[] {
  return values.map((value, throwIndex) => {
    const t: Throw = { value, throwIndex };
    const pd = pinData?.[throwIndex];
    if (pd?.left) t.pinsLeftStanding = pd.left;
    if (pd?.knocked) t.pinsKnockedDown = pd.knocked;
    return t;
  });
}

export interface GameMeta {
  gameId: string;
  date: number;
  league?: string;
  patterns?: string[];
  balls?: string[];
  note?: string;
  isPractice?: boolean;
  isSeries?: boolean;
  seriesId?: string;
}

function assemble(frameValues: number[][], throwsList: Throw[][], meta: GameMeta, isPinMode: boolean): Game {
  const { frameScores, total } = scoreFrames(frameValues);
  const isClean = frameValues.every((f, i) => isFrameMark(f, i === 9));
  const frames: Frame[] = throwsList.map((throws, frameIndex) => ({ frameIndex, throws }));
  return {
    gameId: meta.gameId,
    date: meta.date,
    frames,
    totalScore: total,
    frameScores,
    isClean,
    isPerfect: total === 300,
    isPractice: meta.isPractice ?? false,
    isPinMode,
    isSeries: meta.isSeries,
    seriesId: meta.seriesId,
    note: meta.note,
    league: meta.league,
    patterns: meta.patterns ?? [],
    balls: meta.balls,
  };
}

/**
 * Build a game from raw per-frame throw values (no pin-deck data). Use this for
 * the bulk of seeded games that drive averages, charts and distributions.
 *
 * Example frames: [[10],[7,3],[9,0], … ,[10,10,10]]
 */
export function buildGame(frameValues: number[][], meta: GameMeta): Game {
  const throwsList = frameValues.map((vals) => toThrows(vals));
  return assemble(frameValues, throwsList, meta, false);
}

/**
 * A frame authored as the pins KNOCKED DOWN on each throw (pin numbers 1-10).
 * Fully determines values + pinsLeftStanding/pinsKnockedDown, which the pin /
 * spare / split / pocket stat calculators read. Use for the handful of games
 * that should populate those sections and the pin-leave diagrams.
 */
export type PinFrame = number[][];

/**
 * Build a pin-mode game from explicit knocked-pin arrays. Standing pins reset
 * to a full rack after a strike/spare in the 10th frame so fill balls work.
 */
export function buildPinGame(pinFrames: PinFrame[], meta: GameMeta): Game {
  const frameValues: number[][] = [];
  const throwsList: Throw[][] = [];

  pinFrames.forEach((frame, frameIndex) => {
    let standing = [...ALL_PINS];
    const values: number[] = [];
    const pinData: { left?: number[]; knocked?: number[] }[] = [];

    frame.forEach((knocked) => {
      // 10th frame: a cleared rack means fill balls start fresh.
      if (frameIndex === 9 && standing.length === 0) standing = [...ALL_PINS];
      const knockedSet = new Set(knocked);
      const left = standing.filter((p) => !knockedSet.has(p));
      values.push(knocked.length);
      pinData.push({ knocked: [...knocked].sort((a, b) => a - b), left: [...left].sort((a, b) => a - b) });
      standing = left;
    });

    frameValues.push(values);
    throwsList.push(toThrows(values, pinData));
  });

  return assemble(frameValues, throwsList, meta, true);
}

// ---- Authoring helpers for pin-mode frames -------------------------------

const not = (leave: number[]): number[] => ALL_PINS.filter((p) => !leave.includes(p));

/** Strike: knock the full rack. */
export const X = (): PinFrame => [ALL_PINS.slice()];

/** Spare: leave `leave` standing on the first ball, then clear it. */
export const sp = (leave: number[]): PinFrame => [not(leave), leave.slice()];

/** Open: leave `leave` standing, then knock `convert` of them (default none). */
export const op = (leave: number[], convert: number[] = []): PinFrame => [not(leave), convert.slice()];

/** A lone first ball that leaves `leave` standing — an in-progress frame (one throw). */
export const firstBall = (leave: number[]): PinFrame => [not(leave)];

/** 10th frame: strike then two fill balls described as knocked-pin arrays. */
export const tenth = (throws: number[][]): PinFrame => throws;
