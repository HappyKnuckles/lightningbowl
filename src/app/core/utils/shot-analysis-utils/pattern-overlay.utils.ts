import { Pattern } from '../../models/pattern.model';
import { Handedness, ShotAnalysisResult, ShotCurvePoint } from '../../models/shot-analysis.model';
import { LANE_BOARDS, ShotMetricRow } from './shot-analysis.utils';

/** Where the arrows are, in feet from the foul line. */
const ARROWS_FT = 15;

/**
 * Oil of a pattern drawn the way the pattern charts are (lightningbowl-patterns
 * `scraper/chart_generator.py`), so the shot lane and the charts show the same thing.
 */

/** One rectangle of oil: x in boards from the lane's left edge (0 to 39), y in feet from the foul line. */
export interface OilRect {
  fromFt: number;
  key: string;
  left: number;
  opacity: number;
  right: number;
  toFt: number;
}

interface OilRow {
  distance_end: string;
  distance_start: string;
  start: string;
  stop: string;
  total_oil?: string;
}

const num = (value: string | undefined) => parseFloat(value ?? '') || 0;

/** "nL" is n boards from the left edge, "nR" n boards from the right edge. */
export function parseBoardEdge(value: string): number {
  const text = String(value).trim().toUpperCase();
  const n = parseFloat(text.replace(/[^\d.]/g, '')) || 0;
  return text.endsWith('R') ? LANE_BOARDS - n : n;
}

/** Colour of the oil by the pattern's ratio, like the charts: red under 4:1, orange up to 8:1, green above, blue without one. */
export function patternRatioColor(ratio: string | undefined): string {
  const value = parseFloat(String(ratio ?? '0:1').split(':')[0]) || 0;
  if (value >= 1 && value < 4) {
    return 'red';
  }
  if (value >= 4 && value < 8) {
    return '#ed8e07';
  }
  return value >= 8 ? 'green' : 'blue';
}

/** Oil length in feet ("37'" → 37), or null when the pattern has none. */
export function patternDistanceFt(pattern: Pattern): number | null {
  const ft = parseFloat(pattern.distance);
  return Number.isFinite(ft) && ft > 0 ? ft : null;
}

const maxDistance = (rows: OilRow[]) => Math.max(0, ...rows.map((r) => Math.max(num(r.distance_start), num(r.distance_end))));

function toRect(row: OilRow, opacity: number, key: string): OilRect {
  const a = parseBoardEdge(row.start);
  const b = parseBoardEdge(row.stop);
  const d1 = num(row.distance_start);
  const d2 = num(row.distance_end);
  return { key, left: Math.min(a, b), right: Math.max(a, b), fromFt: Math.min(d1, d2), toFt: Math.max(d1, d2), opacity };
}

/**
 * The chart's layers, bottom to top: a light wash over the whole oiled length, the forward passes
 * at 50 % and the reverse passes at 30 %, so boards that get oil more often come out darker.
 */
export function patternOilRects(pattern: Pattern): OilRect[] {
  const forward: OilRow[] = pattern.forwards_data ?? [];
  const reverse: OilRow[] = pattern.reverse_data ?? [];
  const forwardMax = maxDistance(forward);
  const reverseMax = maxDistance(reverse);
  const wash = { start: '1L', stop: '1R', distance_start: '0' };

  const rects: OilRect[] = [];
  if (reverseMax !== forwardMax) {
    rects.push(toRect({ ...wash, distance_end: `${forwardMax}` }, 0.05, 'wash-forward'));
  }
  rects.push(toRect({ ...wash, distance_end: `${reverseMax}` }, 0.1, 'wash'));
  forward.forEach((row, i) => {
    if (Math.trunc(num(row.total_oil)) !== 0) {
      rects.push(toRect(row, 0.5, `forward-${i}`));
    }
  });
  reverse.forEach((row, i) => {
    if (Math.trunc(num(row.total_oil)) !== 0 || num(row.distance_end) === 0) {
      rects.push(toRect(row, 0.3, `reverse-${i}`));
    }
  });
  return rects.filter((r) => r.right > r.left && r.toFt > r.fromFt);
}

/** A shot board (counted from the bowler's gutter) as boards from the lane's left edge, at the board's centre. */
export function boardFromLeft(board: number, handedness: Handedness): number {
  const fromGutter = board - 0.5;
  return handedness === 'right' ? LANE_BOARDS - fromGutter : fromGutter;
}

/** Whether a pass of the pattern (wash left out) puts oil on this spot. */
export function isInOil(pattern: Pattern, fromLeft: number, distanceFt: number): boolean {
  return patternOilRects(pattern).some(
    (r) => !r.key.startsWith('wash') && fromLeft >= r.left && fromLeft <= r.right && distanceFt >= r.fromFt && distanceFt <= r.toFt,
  );
}

/** Board of the ball's path at a distance, interpolated between tracked points; null outside the tracked part. */
export function boardAtDistance(curve: ShotCurvePoint[], distanceFt: number): number | null {
  for (let i = 1; i < curve.length; i++) {
    const a = curve[i - 1];
    const b = curve[i];
    const lo = Math.min(a.distanceFt, b.distanceFt);
    const hi = Math.max(a.distanceFt, b.distanceFt);
    if (distanceFt >= lo && distanceFt <= hi) {
      const t = hi === lo ? 0 : (distanceFt - a.distanceFt) / (b.distanceFt - a.distanceFt);
      return a.board + t * (b.board - a.board);
    }
  }
  return null;
}

const ft = (value: number) => Number(value.toFixed(1));

/**
 * Adds what the pattern means for the shot to the metric rows: where the breakpoint is relative to
 * the end of the oil, whether the ball crossed the arrows in the oil, and the board it left the oil on.
 */
export function withPatternRows(rows: ShotMetricRow[], result: ShotAnalysisResult, pattern: Pattern): ShotMetricRow[] {
  const end = patternDistanceFt(pattern);
  const { metrics, handedness, curve } = result;
  const out: ShotMetricRow[] = [];
  for (const row of rows) {
    if (row.label === 'Breakpoint' && metrics.breakpoint && end !== null) {
      const diff = ft(metrics.breakpoint.distanceFt - end);
      const where = diff === 0 ? 'at the end of the pattern' : `${Math.abs(diff)} ft ${diff > 0 ? 'past' : 'before'} the pattern`;
      out.push({ ...row, detail: `${row.detail} · ${where}`, highlight: true });
      continue;
    }
    if (row.label === 'Arrows' && metrics.arrowsBoard !== undefined) {
      const oiled = isInOil(pattern, boardFromLeft(metrics.arrowsBoard, handedness), ARROWS_FT);
      out.push({ ...row, detail: `${row.detail} · ${oiled ? 'in the oil' : 'outside the oil'}` });
      const exit = end !== null ? boardAtDistance(curve, end) : null;
      if (exit !== null) {
        out.push({ label: 'Exit from Oil', value: `Board ${ft(exit)}`, detail: `at ${end} ft, end of the pattern` });
      }
      continue;
    }
    out.push(row);
  }
  return out;
}
