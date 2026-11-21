import { NormalizedPoint, ShotCalibration } from 'src/app/core/models/shot-analysis.model';

import { LANE_LENGTH_FT } from '../geometry/lane.utils';

export type CalibrationKey = 'foulLeft' | 'foulRight' | 'farLeft' | 'farRight';

/** The order the user taps the lane corners in. Left/right as seen from the approach. */
export const CALIBRATION_STEPS: readonly { key: CalibrationKey; label: string; short: string }[] = [
  { key: 'foulLeft', label: 'Tap the left corner of the foul line', short: 'Foul left' },
  { key: 'foulRight', label: 'Tap the right corner of the foul line', short: 'Foul right' },
  { key: 'farLeft', label: 'Tap the left lane edge at the head pin', short: 'Pins left' },
  { key: 'farRight', label: 'Tap the right lane edge at the head pin', short: 'Pins right' },
];

/** A point in video pixels as fractions of the frame, or null when it lies outside the frame. */
export function normalizePoint(x: number, y: number, frameWidth: number, frameHeight: number): NormalizedPoint | null {
  if (frameWidth <= 0 || frameHeight <= 0 || x < 0 || y < 0 || x > frameWidth || y > frameHeight) {
    return null;
  }
  return [x / frameWidth, y / frameHeight];
}

/** The calibration once all four corners are set, in tap order (see CALIBRATION_STEPS). */
export function buildCalibration(points: readonly NormalizedPoint[], frameTimeS: number): ShotCalibration | null {
  if (points.length !== CALIBRATION_STEPS.length) {
    return null;
  }
  const [foulLeft, foulRight, farLeft, farRight] = points;
  return { foulLeft, foulRight, farLeft, farRight, farDistanceFt: LANE_LENGTH_FT, frameTimeS: Math.max(0, frameTimeS) };
}

/**
 * Catches corners tapped in the wrong order or place. Filmed from behind the approach, the pins are
 * above the foul line and the lane narrows towards them. Returns a message, or null when it looks right.
 */
export function validateCalibration(points: readonly NormalizedPoint[]): string | null {
  if (points.length !== CALIBRATION_STEPS.length) {
    return null;
  }
  const [foulLeft, foulRight, farLeft, farRight] = points;
  if (foulLeft[0] >= foulRight[0] || farLeft[0] >= farRight[0]) {
    return 'Left and right look swapped. Tap the left corners first, as seen from the approach.';
  }
  if (Math.max(farLeft[1], farRight[1]) >= Math.min(foulLeft[1], foulRight[1])) {
    return 'The pin corners must be above the foul line in the picture.';
  }
  if (farRight[0] - farLeft[0] >= foulRight[0] - foulLeft[0]) {
    return 'The lane should be narrower at the pins than at the foul line.';
  }
  return null;
}
