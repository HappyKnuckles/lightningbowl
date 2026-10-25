export interface Ball {
  availability: string;
  ball_id: string;
  ball_image: string;
  ball_name: string;
  brand_id: string;
  brand_name: string;
  core_diff: string;
  core_id: string;
  core_image: string;
  core_int_diff: string;
  core_name: string;
  core_rg: string;
  core_type: string;
  core_weight: string;
  coverstock_id: string;
  coverstock_name: string;
  coverstock_type: string;
  factory_finish: string;
  last_update: string;
  release_date: string;
  thumbnail_image: string;
  us_int: string;
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

export interface Core {
  core_name: string;
  brand: string;
  id: string;
  api_filter_url: string;
}

export interface Coverstock {
  coverstock_name: string;
  brand: string;
  id: string;
  api_filter_url: string;
}

export interface Brand {
  brand_name: string;
  id: string;
  logo: string;
}

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
