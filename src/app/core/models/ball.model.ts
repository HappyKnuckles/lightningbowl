import type { components, operations } from './generated/ball-api';

type ApiSchemas = components['schemas'];

export type ApiBall = ApiSchemas['Ball'];
export interface Ball extends ApiBall {
  /**
   * Identity of one physical ball in the arsenal. Two arsenal balls can be the same catalog ball in the
   * same weight (same `key`), e.g. drilled differently; this tells them apart. Catalog balls have none.
   */
  arsenalId?: string;
  position?: number;
  drilling?: BallDrilling;
  /** The bowler's own name for this arsenal ball, e.g. "benchmark". Shown next to the ball's name. */
  nickname?: string;
  /** Free text about this arsenal ball: surface changes, what it's for, how it reacts. */
  note?: string;
  surface?: string;
  /**
   * When the ball was retired (ms since epoch); absent for a ball in use. A retired ball stays in the
   * arsenal with its games and stats, but is no longer offered when picking balls.
   */
  retiredAt?: number;
}

/**
 * Layout systems as written on drill sheets:
 * - Dual Angle: drilling angle (°) × pin to PAP (") × VAL angle (°), e.g. 45° × 4 1/2" × 30°
 * - VLS / 2LS: pin to PAP (") × PSA to PAP (") × pin buffer ("), e.g. 5" × 4" × 2"
 */
export type LayoutSystem = 'dual-angle' | 'vls';

export interface DualAngleLayout {
  system: 'dual-angle';
  drillingAngle?: number;
  pinToPap?: number;
  valAngle?: number;
}

export interface VlsLayout {
  system: 'vls';
  pinToPap?: number;
  psaToPap?: number;
  pinBuffer?: number;
}

export type BallLayout = DualAngleLayout | VlsLayout;

/** How a specific arsenal ball is drilled. All lengths in inches. */
export interface BallDrilling {
  layout?: BallLayout;
  thumbSize?: number;
  middleFingerSize?: number;
  ringFingerSize?: number;
  /** Free text, e.g. "Turbo Thumb Solution 1 1/64" */
  thumbInsert?: string;
  /** Free text, e.g. "Vise Pro #1 Black" */
  fingerInserts?: string;
}

export type Core = ApiSchemas['Core'];

export type Coverstock = ApiSchemas['Coverstock'];

export type Brand = ApiSchemas['Brand'];

export interface BallMetrics {
  hookScore: number;
  lengthScore: number;
  flareScore: number;
  hookLabel: string;
  lengthLabel: string;
  flareLabel: string;
  laneCondition: string;
  laneConditionColor: string;
}

export interface BallTraits {
  isPlastic: boolean;
  isUrethane: boolean;
  isSolid: boolean;
  isHybrid: boolean;
  isPearl: boolean;
  finishGrit: number | null;
  isPolished: boolean;
  rg: number;
  diff: number;
}

export type BallPage = ApiSchemas['BallPage'];
export type BallQueryParams = NonNullable<operations['searchBalls']['parameters']['query']>;
export type SimilarBallsQueryParams = NonNullable<operations['getSimilarBalls']['parameters']['query']>;
