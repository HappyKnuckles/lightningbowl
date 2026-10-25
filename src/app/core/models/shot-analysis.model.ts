/**
 * Types of the ball tracker service (BallTracker repo, `POST /v1/track`).
 * Boards count 1–39 from the bowler's gutter side; distances are feet from the foul line.
 */

export type Handedness = 'right' | 'left';

/** A point on the video frame as fractions of its width and height (0–1). */
export type NormalizedPoint = [number, number];

/** Lane corners tapped on one video frame. Left/right are from the bowler's view, looking at the pins. */
export interface ShotCalibration {
  /** Distance of the far points from the foul line; 60 = at the head pin. */
  farDistanceFt: number;
  farLeft: NormalizedPoint;
  farRight: NormalizedPoint;
  foulLeft: NormalizedPoint;
  foulRight: NormalizedPoint;
  /** Video time of the frame the points were tapped on; the service aligns every frame to it. */
  frameTimeS: number;
}

export interface ShotAnalysisOptions {
  handedness: Handedness;
}

export interface ShotTrackPoint {
  board: number;
  distanceFt: number;
  t: number;
}

export interface ShotCurvePoint {
  board: number;
  distanceFt: number;
}

/** Metrics the service could not measure are left out of the response. */
export interface ShotMetrics {
  /** Board at 15 ft. */
  arrowsBoard?: number;
  breakpoint?: { board: number; distanceFt: number };
  /** Positive = hooking towards the pocket. */
  entryAngleDeg?: number;
  /** Board at 60 ft. */
  entryBoard?: number;
  entryBoardExtrapolated: boolean;
  /** Speed at the pins. */
  impactSpeedMph?: number;
  /** Positive = heading out towards the gutter. */
  launchAngleDeg?: number;
  /** 0–1, how clearly the ball's rotation repeated. */
  revRateConfidence?: number;
  revRateRpm?: number;
  /** Average from 5 to 22 ft, right after the release. */
  releaseSpeedMph?: number;
  /** Average from the foul line to the pins, like lane monitors show. */
  speedMph?: number;
}

export interface ShotAnalysisResult {
  /**
   * The pin-end calibration was corrected from the moment the pins started flying. False when the
   * impact wasn't visible (pins covered, gutter ball): distances near the pins and speeds are then less precise.
   */
  calibrationCorrected?: boolean;
  /** Smoothed path, one point per foot. */
  curve: ShotCurvePoint[];
  fps: number;
  framesProcessed: number;
  handedness: Handedness;
  metrics: ShotMetrics;
  points: ShotTrackPoint[];
  trackedFromFt: number;
  trackedToFt: number;
}

/** Progress of one analysis request. */
export type ShotAnalysisEvent = { progress: number; type: 'uploading' } | { type: 'processing' } | { result: ShotAnalysisResult; type: 'done' };
