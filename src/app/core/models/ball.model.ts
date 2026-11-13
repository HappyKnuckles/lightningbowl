import type { components, operations } from './generated/ball-api';

// Ball API types are generated from its OpenAPI spec (`npm run generate:ball-api`).
type ApiSchemas = components['schemas'];

/** A ball (in one weight) exactly as the ball API returns it. */
export type ApiBall = ApiSchemas['Ball'];

/**
 * A ball (in one weight) as the ball API returns it, plus the arsenal's own
 * order (`position`) and drilling. Balls saved before the ball API go through
 * `toStoredBall` when loaded; they have no `first_seen_at` until they're
 * refreshed from the API.
 */
export interface Ball extends ApiBall {
  position?: number;
  drilling?: BallDrilling;
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

/** One page of balls from the ball API. */
export type BallPage = ApiSchemas['BallPage'];

/** Query parameters of `GET balls`; arrays become repeated parameters. */
export type BallQueryParams = NonNullable<operations['searchBalls']['parameters']['query']>;

/** Query parameters of `GET balls/{id}/similar`. */
export type SimilarBallsQueryParams = NonNullable<operations['getSimilarBalls']['parameters']['query']>;
