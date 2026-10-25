import { Handedness, NormalizedPoint, ShotAnalysisResult, ShotCalibration } from '../../models/shot-analysis.model';

export type CalibrationKey = 'foulLeft' | 'foulRight' | 'farLeft' | 'farRight';

/** The order the user taps the lane corners in. Left/right as seen from the approach. */
export const CALIBRATION_STEPS: readonly { key: CalibrationKey; label: string; short: string }[] = [
  { key: 'foulLeft', label: 'Tap the left corner of the foul line', short: 'Foul left' },
  { key: 'foulRight', label: 'Tap the right corner of the foul line', short: 'Foul right' },
  { key: 'farLeft', label: 'Tap the left lane edge at the head pin', short: 'Pins left' },
  { key: 'farRight', label: 'Tap the right lane edge at the head pin', short: 'Pins right' },
];

export const LANE_BOARDS = 39;
export const LANE_LENGTH_FT = 60;
/** Approximate arrow positions: board and feet from the foul line. */
export const LANE_ARROWS: readonly [number, number][] = [
  [5, 13],
  [10, 14],
  [15, 15],
  [20, 16],
  [25, 15],
  [30, 14],
  [35, 13],
];

const MPH_TO_KMH = 1.609344;

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

/**
 * Horizontal position of a board on a lane drawn `width` wide, as seen from the approach
 * (the right gutter on the right). Board 1 is the bowler's gutter side.
 */
export function boardToX(board: number, handedness: Handedness, width: number): number {
  const fromGutter = (board - 0.5) / LANE_BOARDS;
  const fromLeft = handedness === 'right' ? 1 - fromGutter : fromGutter;
  return fromLeft * width;
}

/** Vertical position of a distance on a lane drawn `height` tall showing `shownFt` feet (foul line at the bottom). */
export function distanceToY(distanceFt: number, height: number, shownFt: number): number {
  return (1 - distanceFt / shownFt) * height;
}

/** Square region of the frame to magnify around a point, kept inside the frame. */
export function loupeSourceRect(x: number, y: number, frameWidth: number, frameHeight: number, size: number): { size: number; x: number; y: number } {
  const side = Math.min(size, frameWidth, frameHeight);
  const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max);
  return { x: clamp(x - side / 2, frameWidth - side), y: clamp(y - side / 2, frameHeight - side), size: side };
}

export interface ShotMetricRow {
  detail?: string;
  label: string;
  value: string;
}

const round = (value: number, digits = 1) => Number(value.toFixed(digits));
const joinDetails = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(' · ') || undefined;

/** Shown when the tracker found no clearly repeating pattern on the ball in the first 25 ft. */
export const REV_RATE_MISSING_HINT = 'Needs 60 fps, good light and a ball with a visible logo or holes in the first 25 ft';

/** The metrics as display rows, LaneTrax-style; metrics the service couldn't measure are left out, except the rev rate. */
export function shotMetricRows(result: ShotAnalysisResult): ShotMetricRow[] {
  const m = result.metrics;
  const rows: ShotMetricRow[] = [];
  // pins hidden or missed: the pin end can't be checked, which mostly affects speeds
  const unchecked = result.calibrationCorrected === false ? 'pins not visible, less precise' : undefined;
  if (m.releaseSpeedMph !== undefined) {
    rows.push({
      label: 'Release Speed',
      value: `${round(m.releaseSpeedMph)} mph`,
      detail: joinDetails(`${round(m.releaseSpeedMph * MPH_TO_KMH)} km/h`, unchecked),
    });
  }
  if (m.speedMph !== undefined) {
    const atPins = m.impactSpeedMph !== undefined ? `${round(m.impactSpeedMph)} mph at the pins` : undefined;
    rows.push({ label: 'Average Speed', value: `${round(m.speedMph)} mph`, detail: joinDetails('like lane monitors', atPins) });
  }
  if (m.revRateRpm !== undefined) {
    const unsure = m.revRateConfidence !== undefined && m.revRateConfidence < 0.5;
    rows.push({ label: 'Rev Rate', value: `${Math.round(m.revRateRpm)} rpm`, detail: unsure ? 'low confidence' : undefined });
  } else {
    // Always shown: a missing rev rate is the one metric users look for, so say why it is missing
    rows.push({ label: 'Rev Rate', value: 'Not measurable', detail: REV_RATE_MISSING_HINT });
  }
  if (m.launchAngleDeg !== undefined) {
    rows.push({ label: 'Launch Angle', value: `${round(m.launchAngleDeg)}°` });
  }
  if (m.entryAngleDeg !== undefined) {
    rows.push({ label: 'Entry Angle', value: `${round(m.entryAngleDeg)}°` });
  }
  if (m.arrowsBoard !== undefined) {
    rows.push({ label: 'Arrows', value: `Board ${round(m.arrowsBoard)}`, detail: 'at 15 ft' });
  }
  if (m.breakpoint) {
    rows.push({ label: 'Breakpoint', value: `Board ${round(m.breakpoint.board)}`, detail: `at ${round(m.breakpoint.distanceFt)} ft` });
  }
  if (m.entryBoard !== undefined) {
    rows.push({
      label: 'Entry',
      value: `Board ${round(m.entryBoard)}`,
      detail: m.entryBoardExtrapolated ? 'at 60 ft, projected' : 'at 60 ft',
    });
  }
  return rows;
}
