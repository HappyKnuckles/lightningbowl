/** Raw track points to a smoothed path and bowling metrics (port of the BallTracker's `analysis.py`). */
import { Handedness, ShotCurvePoint, ShotMetrics, ShotTrackPoint } from 'src/app/core/models/shot-analysis.model';

import { ARROWS_FT, BOARD_WIDTH_IN, LANE_LENGTH_FT, LANE_LENGTH_IN, xToBoard } from '../geometry/lane.utils';
import { polyder, polyfit, polyval, pSpline, seededRandom, Spline } from '../geometry/math.utils';
import { Detection, MAX_SPEED_IN_S, MIN_SPEED_IN_S } from './ball-tracker.utils';

const IN_PER_S_TO_MPH = 3600 / 63360;
/** Sideways error of a detection, in pixels of the image it was found in (the fit of the ball's disc). */
const DETECTION_SIGMA_PX = 0.5;
/** Least sideways error of a point, in inches (alignment, the calibration). */
const MIN_SIGMA_IN = 0.15;
/** Sideways error of detections that don't say how big their pixels are, in inches. */
const DEFAULT_SIGMA_IN = 0.4;
const OUTLIER_IN = 3.5;
/**
 * The path line averages over at least this much lane (inches) either side of a point: errors that persist
 * for a few frames (a reflection, a fragment of the ball) would kink it otherwise. A hook takes 10–20 ft.
 * Held-out stretches of real shots were predicted best with about this (and a knot every foot).
 */
const PATH_BANDWIDTH_IN = 36;
const PATH_KNOT_IN = 12;

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
    const all = [...detections].sort((a, b) => a.t - b.t);
    // how precisely each detection places the ball sideways (boards), before the noise level is known
    const shapeOf = (d: Detection) =>
      (d.sigmaXIn !== undefined ? Math.hypot(DETECTION_SIGMA_PX * d.sigmaXIn, MIN_SIGMA_IN) : DEFAULT_SIGMA_IN) / BOARD_WIDTH_IN;
    // A few points on their own between gaps (a pin flying, a hand) that the rest of the path doesn't lead
    // to: out, before they bend the ball's distance over time (near the pins a pixel is half a foot of lane,
    // so that fit has to be lenient).
    const rawBoard = all.map((d) => xToBoard(d.xIn, handedness));
    const rawShape = all.map(shapeOf);
    const rawY = all.map((d) => d.yIn);
    const runsKept = keptRuns(
      all.map((d) => d.t),
      rawY,
      rawBoard,
      rawShape.map((v) => v * noiseScale(rawY, rawBoard, rawShape)),
    );
    const { dets, y: ySmooth } = onTrack(all.filter((_, i) => runsKept[i]));
    let t = dets.map((d) => d.t);
    let y = ySmooth;
    let board = dets.map((d) => xToBoard(d.xIn, handedness));
    const shape = dets.map(shapeOf);
    let keep = t.map(() => true);
    const noise = noiseScale(y, board, shape);
    let sigma = shape.map((v) => v * noise);
    for (let iter = 0; iter < 3; iter++) {
      const spline = fitBoards(
        y.filter((_, i) => keep[i]),
        board.filter((_, i) => keep[i]),
        sigma.filter((_, i) => keep[i]),
      );
      const next = y.map((yi, i) => Math.abs(spline.at(yi) - board[i]) * BOARD_WIDTH_IN <= OUTLIER_IN);
      if (next.filter(Boolean).length < 4 || next.every((v, i) => v === keep[i])) break;
      keep = next;
    }
    t = t.filter((_, i) => keep[i]);
    y = y.filter((_, i) => keep[i]);
    board = board.filter((_, i) => keep[i]);
    sigma = sigma.filter((_, i) => keep[i]);
    this.t = t;
    this.y = y;
    this.board = board;
    this.spline = fitBoards(y, board, sigma);
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

/**
 * Board over distance, smoothed: the residuals as large as the measurement noise (`sigma`, boards, per
 * point), no more. A path skids, hooks and rolls; a stiffer curve (a cubic) rounds that off and misplaces
 * the breakpoint and the entry. The curve may still bend where the tracking ends: a ball hooking into the
 * pins keeps its angle.
 */
function fitBoards(y: number[], board: number[], sigma: number[]): Spline {
  const order = y.map((_, i) => i).sort((a, b) => y[a] - y[b]);
  const x = order.map((i) => y[i]);
  const b = order.map((i) => board[i]);
  const s = order.map((i) => sigma[i]);
  if (x.length <= 5 || x[x.length - 1] - x[0] < 2 * PATH_KNOT_IN) {
    // too few points to bend: a straight line
    const [slope, intercept] =
      x.length >= 2
        ? polyfit(
            x,
            b,
            1,
            s.map((v) => 1 / v),
          )
        : [0, b[0] ?? 0];
    return { at: (v) => slope * v + intercept, slope: () => slope };
  }
  return pSpline(x, b, s, PATH_KNOT_IN, PATH_BANDWIDTH_IN);
}

/** The detections on the ball's distance over time (not a foot at release) and not past the pin deck, their distances smoothed. */
function onTrack(detections: Detection[]): { dets: Detection[]; y: number[] } {
  const { y, onPath } = smoothDistance(
    detections.map((d) => d.t),
    detections.map((d) => d.yIn),
    detections.map((d) => d.sigmaYIn),
  );
  const kept = detections.map((_, i) => onPath[i] && y[i] <= LANE_LENGTH_IN + 12);
  return { dets: detections.filter((_, i) => kept[i]), y: y.filter((_, i) => kept[i]) };
}

/** A run of at most this many points, set off by gaps of {@link RUN_GAP_S}, has to fit the rest of the path. */
const STRAY_RUN_POINTS = 5;
const RUN_GAP_S = 0.1;

/** Which points to keep: runs of a few points between gaps are dropped when the path through the others misses them. */
function keptRuns(t: number[], y: number[], board: number[], sigma: number[]): boolean[] {
  const keep = t.map(() => true);
  const order = t.map((_, i) => i).sort((a, b) => t[a] - t[b]);
  const runs: number[][] = [];
  for (const i of order) {
    const run = runs[runs.length - 1];
    if (run && t[i] - t[run[run.length - 1]] < RUN_GAP_S) run.push(i);
    else runs.push([i]);
  }
  if (runs.length < 2) return keep;
  for (const run of runs) {
    if (run.length > STRAY_RUN_POINTS || t.length - run.length < 8) continue;
    const others = order.filter((i) => !run.includes(i));
    const spline = fitBoards(
      others.map((i) => y[i]),
      others.map((i) => board[i]),
      others.map((i) => sigma[i]),
    );
    const misses = run.map((i) => Math.abs(spline.at(y[i]) - board[i]) * BOARD_WIDTH_IN).sort((a, b) => a - b);
    if (misses[Math.floor(misses.length / 2)] > OUTLIER_IN) for (const i of run) keep[i] = false;
  }
  return keep;
}

/**
 * How much noisier the boards are than `shape` says (a factor), from how far each point lies off the line
 * through its neighbours (along the lane). The path barely bends from one point to the next, so that is noise.
 */
function noiseScale(y: number[], board: number[], shape: number[]): number {
  const order = y.map((_, i) => i).sort((a, b) => y[a] - y[b]);
  const z: number[] = [];
  for (let k = 1; k + 1 < order.length; k++) {
    const [a, i, c] = [order[k - 1], order[k], order[k + 1]];
    const span = y[c] - y[a];
    if (!(span > 0)) continue;
    const f = (y[i] - y[a]) / span;
    const off = board[i] - (board[a] + f * (board[c] - board[a]));
    const spread = Math.sqrt(shape[i] ** 2 + ((1 - f) * shape[a]) ** 2 + (f * shape[c]) ** 2);
    z.push(Math.abs(off) / spread);
  }
  if (z.length < 6) return 1;
  z.sort((p, q) => p - q);
  return Math.min(6, Math.max(0.5, 1.4826 * z[Math.floor(z.length / 2)]));
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
