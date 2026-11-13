/**
 * Rev rate from how often the ball's appearance repeats (port of the BallTracker's `revs.py`, which explains
 * the method): crops of the ball disc, normalized; what every crop shares is removed; the similarity of
 * crops k frames apart peaks at multiples of the revolution period.
 */
import { interp } from './math.utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cv = any;

const CROP_PX = 40;
const MIN_RPM = 150;
const MAX_RPM = 750;
const MAX_HARMONIC = 6;
const MIN_SCORE = 0.12;
const FULL_CONFIDENCE_SCORE = 0.3;
const MIN_HALF_TURN_EVIDENCE = 0.02;
const HALF_TURN_ODD_RATIO = 0.25;
const MAX_RIVAL_RATIO = 0.8;

export interface RevEstimate {
  confidence: number;
  rpm: number;
}

/** One frame's ball disc: brightness and saturation of the pixels inside the disc, standardized. */
export interface BallCrop {
  gray: Float32Array;
  sat: Float32Array;
}

const DISC: number[] = (() => {
  const c = (CROP_PX - 1) / 2;
  const inside: number[] = [];
  for (let yy = 0; yy < CROP_PX; yy++)
    for (let xx = 0; xx < CROP_PX; xx++) if ((xx - c) ** 2 + (yy - c) ** 2 <= (0.42 * CROP_PX) ** 2) inside.push(yy * CROP_PX + xx);
  return inside;
})();

function standardize(values: Float32Array): Float32Array | null {
  let mean = 0;
  for (const v of values) mean += v;
  mean /= values.length;
  let variance = 0;
  for (const v of values) variance += (v - mean) ** 2;
  const std = Math.sqrt(variance / values.length);
  if (std <= 1e-3) return null;
  return values.map((v) => (v - mean) / std);
}

/** The ball disc at a fixed size from an RGB crop; each channel zero mean and unit variance inside the disc. */
export function normalizeCrop(cv: Cv, clahe: Cv, cropRgb: Cv): BallCrop | null {
  if (cropRgb.rows < 8 || cropRgb.cols < 8) return null;
  const img = new cv.Mat();
  const gray = new cv.Mat();
  const hsv = new cv.Mat();
  try {
    cv.resize(cropRgb, img, new cv.Size(CROP_PX, CROP_PX), 0, 0, cv.INTER_AREA);
    cv.cvtColor(img, gray, cv.COLOR_RGB2GRAY);
    clahe.apply(gray, gray);
    cv.cvtColor(img, hsv, cv.COLOR_RGB2HSV);
    const g = new Float32Array(DISC.length);
    const s = new Float32Array(DISC.length);
    DISC.forEach((pixel, i) => {
      g[i] = gray.data[pixel];
      s[i] = hsv.data[3 * pixel + 1];
    });
    const gs = standardize(g);
    if (!gs) return null;
    return { gray: gs, sat: standardize(s) ?? new Float32Array(gs.length) };
  } finally {
    img.delete();
    gray.delete();
    hsv.delete();
  }
}

function rotatingParts(vectors: (Float32Array | null)[]): (Float32Array | null)[] {
  const valid = vectors.filter((v): v is Float32Array => v !== null);
  const length = valid[0].length;
  const stat = new Float32Array(length);
  for (const v of valid) for (let i = 0; i < length; i++) stat[i] += v[i] / valid.length;
  return vectors.map((v) => (v ? standardize(v.map((x, i) => x - stat[i])) : null));
}

/** sim[k] = mean correlation of crops k frames apart (NaN where too few pairs; index 0 unused). */
function similarityByLag(vectors: (Float32Array | null)[], maxLag: number): number[] {
  const sim = new Array<number>(maxLag + 1).fill(NaN);
  const n = vectors.length;
  for (let lag = 1; lag <= maxLag; lag++) {
    let sum = 0;
    let count = 0;
    for (let i = 0; i + lag < n; i++) {
      const a = vectors[i];
      const b = vectors[i + lag];
      if (!a || !b) continue;
      let dot = 0;
      for (let k = 0; k < a.length; k++) dot += a[k] * b[k];
      sum += dot / a.length;
      count++;
    }
    if (count >= 3) sim[lag] = sum / count;
  }
  return sim;
}

/** How far the similarity at each multiple of `period` rises above the points halfway to its neighbours. */
function harmonicTerms(sim: number[], period: number): Map<number, number> {
  const lags: number[] = [];
  const values: number[] = [];
  sim.forEach((v, lag) => {
    if (!Number.isNaN(v)) {
      lags.push(lag);
      values.push(v);
    }
  });
  const at = (x: number) => (x < 1 || x > lags[lags.length - 1] ? NaN : interp(x, lags, values));
  const terms = new Map<number, number>();
  for (let k = 1; k <= MAX_HARMONIC; k++) {
    const before = at((k - 0.5) * period);
    const peak = at(k * period);
    const after = at((k + 0.5) * period);
    if (!Number.isNaN(before + peak + after)) terms.set(k, peak - (before + after) / 2);
  }
  return terms;
}

const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;

function bestPeriod(sim: number[], fps: number): [number, number] | null {
  let best: [number, number] | null = null;
  const lo = Math.max(2, (fps * 60) / MAX_RPM);
  const hi = (fps * 60) / MIN_RPM + 0.05;
  // numpy.arange(lo, hi, 0.1): lo + 0.1·k while below hi
  for (let k = 0; lo + 0.1 * k < hi; k++) {
    const period = lo + 0.1 * k;
    const terms = harmonicTerms(sim, period);
    if (terms.size >= 2) {
      const score = mean([...terms.values()]);
      if (!best || score > best[1]) best = [period, score];
    }
  }
  return best;
}

function isHalfTurn(sims: number[][], period: number): boolean {
  for (const sim of sims) {
    const terms = harmonicTerms(sim, period);
    const even = [...terms].filter(([k]) => k % 2 === 0).map(([, v]) => v);
    const odd = [...terms].filter(([k]) => k % 2 === 1).map(([, v]) => v);
    if (even.length && odd.length && mean(even) > MIN_HALF_TURN_EVIDENCE && mean(odd) <= HALF_TURN_ODD_RATIO * mean(even)) return true;
  }
  return false;
}

/** `crops` are consecutive frames at `fps` (null where the ball couldn't be cropped). */
export function estimateRevRate(crops: (BallCrop | null)[], fps: number): RevEstimate | null {
  if (fps <= 0 || crops.filter(Boolean).length < 8) return null;
  const maxLag = Math.floor(crops.length * 0.75);
  if (maxLag < ((fps * 60) / MAX_RPM) * 2) return null;

  const sims = (['gray', 'sat'] as const).map((channel) => similarityByLag(rotatingParts(crops.map((c) => (c ? c[channel] : null))), maxLag));
  const periods = sims.map((sim) => bestPeriod(sim, fps));
  const found = periods.filter((p): p is [number, number] => p !== null);
  if (found.length === 0) return null;
  let bestIndex = 0;
  found.forEach((p, i) => {
    if (p[1] > found[bestIndex][1]) bestIndex = i;
  });
  let [period, score] = found[bestIndex];
  if (score < MIN_SCORE) return null;
  const halfTurn = period * 2 <= (fps * 60) / MIN_RPM && isHalfTurn(sims, period);

  // a weak signal can fit related periods almost as well; such a reading isn't reported
  const sim = sims[periods.findIndex((p) => p === found[bestIndex])];
  const ratios = halfTurn ? [1 / 3, 2 / 3, 1.5, 3] : [1 / 3, 0.5, 2 / 3, 1.5, 2, 3];
  let rival = 0;
  for (const ratio of ratios) {
    const terms = harmonicTerms(sim, period * ratio);
    const rpm = (60 * fps) / (period * ratio);
    if (terms.size >= 2 && rpm >= MIN_RPM && rpm <= MAX_RPM) rival = Math.max(rival, mean([...terms.values()]));
  }
  if (rival >= MAX_RIVAL_RATIO * score) return null;
  if (halfTurn) period *= 2;
  const rpm = (60 * fps) / period;
  if (rpm < MIN_RPM || rpm > MAX_RPM) return null;
  score = Math.min(1, score / FULL_CONFIDENCE_SCORE);
  return { rpm: Math.round(rpm), confidence: Math.round(score * 100) / 100 };
}
