import { ShotAnalysisResult } from 'src/app/core/models/shot-analysis.model';

export interface ShotMetricRow {
  detail?: string;
  /** Drawn with an accent border: the row the selected pattern says most about. */
  highlight?: boolean;
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
      detail: unchecked,
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
