/** Raw track points to a smoothed path and bowling metrics (port of the BallTracker's `analysis.py`). */
import { ShotCurvePoint, ShotMetrics, ShotTrackPoint } from 'src/app/core/models/shot-analysis.model';

import { ARROWS_FT, BOARD_WIDTH_IN, Handedness, LANE_LENGTH_FT, LANE_LENGTH_IN, xToBoard } from './lane.utils';
import { polyder, polyfit, polyval, seededRandom, smoothingSpline, Spline } from './math.utils';
import { Detection, MAX_SPEED_IN_S, MIN_SPEED_IN_S } from './tracker.utils';

const IN_PER_S_TO_MPH = 3600 / 63360;
const MEASUREMENT_SIGMA_IN = 1.2;
const OUTLIER_IN = 3.5;

const round = (value: number, digits: number) => Math.round(value * 10 ** digits) / 10 ** digits;

export class PathAnalysis {
  readonly t: number[];
  readonly y: number[];
  readonly board: number[];
  readonly spline: Spline;

  constructor(
    detections: Detection[],
    readonly handedness: Handedness,
  ) {
    const dets = [...detections].sort((a, b) => a.t - b.t);
    const t0 = dets.map((d) => d.t);
    const { y: ySmooth, onPath } = smoothDistance(
      t0,
      dets.map((d) => d.yIn),
      dets.map((d) => d.sigmaYIn),
    );
    const board0 = dets.map((d) => xToBoard(d.xIn, handedness));
    // off the ball's distance-over-time (a foot at release) or past the pin deck: out
    const kept = dets.map((_, i) => onPath[i] && ySmooth[i] <= LANE_LENGTH_IN + 12);
    let t = t0.filter((_, i) => kept[i]);
    let y = ySmooth.filter((_, i) => kept[i]);
    let board = board0.filter((_, i) => kept[i]);

    let keep = t.map(() => true);
    for (let iter = 0; iter < 3; iter++) {
      const spline = fitBoards(
        y.filter((_, i) => keep[i]),
        board.filter((_, i) => keep[i]),
      );
      const next = y.map((yi, i) => Math.abs(spline.at(yi) - board[i]) * BOARD_WIDTH_IN <= OUTLIER_IN);
      if (next.filter(Boolean).length < 4 || next.every((v, i) => v === keep[i])) break;
      keep = next;
    }
    t = t.filter((_, i) => keep[i]);
    y = y.filter((_, i) => keep[i]);
    board = board.filter((_, i) => keep[i]);
    this.t = t;
    this.y = y;
    this.board = board;
    this.spline = fitBoards(y, board);
  }

  get fromFt(): number {
    return Math.min(...this.y) / 12;
  }

  get toFt(): number {
    return Math.max(...this.y) / 12;
  }

  boardAtFt(ft: number): number {
    return this.spline.at(ft * 12);
  }

  /** Boards per inch travelled down the lane. */
  slopeAtFt(ft: number): number {
    return this.spline.slope(ft * 12);
  }

  points(): ShotTrackPoint[] {
    return this.t.map((t, i) => ({ t: round(t, 4), distanceFt: round(this.y[i] / 12, 2), board: round(this.board[i], 2) }));
  }

  curve(): ShotCurvePoint[] {
    const start = Math.ceil(this.fromFt);
    const end = Math.floor(this.toFt);
    let feet: number[] = [];
    for (let ft = start; ft <= end; ft++) feet.push(ft);
    if (feet.length === 0 || feet[0] > this.fromFt) feet = [this.fromFt, ...feet];
    if (feet[feet.length - 1] < this.toFt) feet.push(this.toFt);
    return feet.map((ft) => ({ distanceFt: round(ft, 2), board: round(this.boardAtFt(ft), 2) }));
  }

  metrics(): ShotMetrics {
    const metrics: ShotMetrics = { entryBoardExtrapolated: false };
    const n = this.t.length;
    if (n >= 3 && this.t[n - 1] > this.t[0]) {
      metrics.speedMph = round(polyfit(this.t, this.y, 1)[0] * IN_PER_S_TO_MPH, 1);
    }
    if (this.fromFt - 0.5 <= ARROWS_FT && ARROWS_FT <= this.toFt + 0.5) {
      metrics.arrowsBoard = round(this.boardAtFt(ARROWS_FT), 1);
    }

    // boards count from the bowler's gutter side, so the furthest-out point is the minimum
    const samples = 200;
    let minI = 0;
    let minBoard = Infinity;
    for (let i = 0; i < samples; i++) {
      const ft = this.fromFt + ((this.toFt - this.fromFt) * i) / (samples - 1);
      const b = this.spline.at(ft * 12);
      if (b < minBoard) {
        minBoard = b;
        minI = i;
      }
    }
    if (0.05 * samples < minI && minI < 0.95 * samples) {
      const ft = this.fromFt + ((this.toFt - this.fromFt) * minI) / (samples - 1);
      metrics.breakpoint = { distanceFt: round(ft, 1), board: round(minBoard, 1) };
    }

    if (this.toFt >= LANE_LENGTH_FT - 3) {
      metrics.entryBoard = round(this.boardAtFt(Math.min(LANE_LENGTH_FT, this.toFt + 1)), 1);
      metrics.entryBoardExtrapolated = this.toFt < LANE_LENGTH_FT;
    } else if (this.toFt >= 40) {
      const slope = this.slopeAtFt(this.toFt);
      metrics.entryBoard = round(this.boardAtFt(this.toFt) + slope * (LANE_LENGTH_FT - this.toFt) * 12, 1);
      metrics.entryBoardExtrapolated = true;
    }

    const angle = (slopeBoardsPerIn: number) => round((Math.atan(slopeBoardsPerIn * BOARD_WIDTH_IN) * 180) / Math.PI, 2);
    const span = this.toFt - this.fromFt;
    if (span >= 6) {
      metrics.launchAngleDeg = -angle(this.slopeAtFt(this.fromFt + Math.min(2, span / 4)));
    }
    if (this.toFt >= 50) {
      metrics.entryAngleDeg = angle(this.slopeAtFt(this.toFt));
    }
    return metrics;
  }
}

/** Board over distance, smoothed: residuals as large as the measurement noise, no more. */
function fitBoards(y: number[], board: number[]): Spline {
  const order = y.map((_, i) => i).sort((a, b) => y[a] - y[b]);
  // the spline needs strictly increasing x
  const x = order.map((i, k) => y[i] + k * 1e-6);
  const b = order.map((i) => board[i]);
  const sigmaBoards = MEASUREMENT_SIGMA_IN / BOARD_WIDTH_IN;
  if (x.length <= 5) {
    // too few points for a cubic: a straight line, as with a degree-1 spline
    const [slope, intercept] = x.length >= 2 ? polyfit(x, b, 1) : [0, b[0] ?? 0];
    return { at: (v) => slope * v + intercept, slope: () => slope };
  }
  return smoothingSpline(x, b, x.length * sigmaBoards ** 2);
}

/**
 * Replaces raw down-lane distances with a quadratic of distance over time, found with RANSAC (a foot or
 * hand chained in at release sits at a near-constant distance and would bend a plain fit). Near the
 * pins one pixel covers several inches, and time is exact, so this is far steadier there.
 */
function smoothDistance(t: number[], y: number[], sigma: number[]): { onPath: boolean[]; y: number[] } {
  const n = t.length;
  if (n < 4) return { y, onPath: t.map(() => true) };
  const tolerance = sigma.map((s) => 10 * s + 6);
  const inliersOf = (coeffs: number[]) => t.map((ti, i) => Math.abs(polyval(coeffs, ti) - y[i]) <= tolerance[i]);
  const plausible = (coeffs: number[]) => {
    const d = polyder(coeffs);
    return [t[0], t[n - 1]].every((ti) => {
      const speed = polyval(d, ti);
      return speed >= MIN_SPEED_IN_S && speed <= MAX_SPEED_IN_S;
    });
  };
  const count = (mask: boolean[]) => mask.filter(Boolean).length;
  const subset = <T>(values: T[], mask: boolean[]) => values.filter((_, i) => mask[i]);

  const random = seededRandom(0);
  let best = t.map(() => true);
  let bestCount = -1;
  for (let iter = 0; iter < 300; iter++) {
    const picks = new Set<number>();
    while (picks.size < 3) picks.add(Math.floor(random() * n));
    const sample = [...picks].sort((a, b) => a - b);
    if (t[sample[2]] - t[sample[0]] <= 0) continue;
    const coeffs = polyfit(
      sample.map((i) => t[i]),
      sample.map((i) => y[i]),
      2,
    );
    if (!plausible(coeffs)) continue;
    const inliers = inliersOf(coeffs);
    if (count(inliers) > bestCount) {
      best = inliers;
      bestCount = count(inliers);
    }
  }
  if (bestCount < 4) best = t.map(() => true);

  const weights = sigma.map((s) => 1 / s);
  let coeffs = polyfit(subset(t, best), subset(y, best), 2, subset(weights, best));
  for (let iter = 0; iter < 3; iter++) {
    const refined = inliersOf(coeffs);
    if (count(refined) < 4 || refined.every((v, i) => v === best[i])) break;
    best = refined;
    coeffs = polyfit(subset(t, best), subset(y, best), 2, subset(weights, best));
  }
  return { y: t.map((ti) => polyval(coeffs, ti)), onPath: best };
}
