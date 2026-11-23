/**
 * The numerics the ball tracker takes from NumPy and SciPy: polynomial fits, interpolation, 3x3
 * homographies (robustly fitted) and a penalized smoothing spline.
 */

export type Mat3 = [number, number, number, number, number, number, number, number, number];

/**
 * Least-squares polynomial of `degree` through (x, y), highest power first like `numpy.polyfit`.
 * `w` weighs the residuals themselves (numpy's convention: minimizes Σ (w·(y − p(x)))²).
 */
export function polyfit(x: ArrayLike<number>, y: ArrayLike<number>, degree: number, w?: ArrayLike<number>): number[] {
  const n = x.length;
  const m = degree + 1;
  // centre and scale x for conditioning, then expand the polynomial back
  let mean = 0;
  for (let i = 0; i < n; i++) mean += x[i];
  mean /= n;
  let scale = 0;
  for (let i = 0; i < n; i++) scale = Math.max(scale, Math.abs(x[i] - mean));
  scale = scale || 1;
  const ata = Array.from({ length: m }, () => new Array<number>(m).fill(0));
  const aty = new Array<number>(m).fill(0);
  for (let i = 0; i < n; i++) {
    const weight = w ? w[i] * w[i] : 1;
    const u = (x[i] - mean) / scale;
    const powers = new Array<number>(m);
    powers[m - 1] = 1;
    for (let k = m - 2; k >= 0; k--) powers[k] = powers[k + 1] * u;
    for (let r = 0; r < m; r++) {
      aty[r] += weight * powers[r] * y[i];
      for (let c = 0; c < m; c++) ata[r][c] += weight * powers[r] * powers[c];
    }
  }
  const scaled = solve(ata, aty);
  // p(u) with u = (x − mean) / scale  →  coefficients in x
  let result = [0];
  for (const coeff of scaled) {
    // result = result * (x − mean) / scale + coeff
    const next = new Array<number>(result.length + 1).fill(0);
    for (let k = 0; k < result.length; k++) {
      next[k] += result[k] / scale;
      next[k + 1] -= (result[k] * mean) / scale;
    }
    next[next.length - 1] += coeff;
    result = next;
  }
  return result.slice(result.length - m);
}

export function polyval(coeffs: readonly number[], x: number): number {
  let value = 0;
  for (const c of coeffs) value = value * x + c;
  return value;
}

export function polyder(coeffs: readonly number[]): number[] {
  const degree = coeffs.length - 1;
  return coeffs.slice(0, -1).map((c, i) => c * (degree - i));
}

/** Gaussian elimination with partial pivoting; `a` and `b` are left untouched. */
export function solve(a: number[][], b: number[]): number[] {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    [m[col], m[pivot]] = [m[pivot], m[col]];
    const p = m[col][col] || 1e-300;
    for (let r = col + 1; r < n; r++) {
      const f = m[r][col] / p;
      if (f !== 0) for (let c = col; c <= n; c++) m[r][c] -= f * m[col][c];
    }
  }
  const out = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let sum = m[r][n];
    for (let c = r + 1; c < n; c++) sum -= m[r][c] * out[c];
    out[r] = sum / (m[r][r] || 1e-300);
  }
  return out;
}

/** `numpy.interp`: linear interpolation in increasing `xp`, clamped to the end values. */
export function interp(x: number, xp: ArrayLike<number>, fp: ArrayLike<number>): number {
  const n = xp.length;
  if (x <= xp[0]) return fp[0];
  if (x >= xp[n - 1]) return fp[n - 1];
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xp[mid] <= x) lo = mid;
    else hi = mid;
  }
  const span = xp[hi] - xp[lo];
  return span > 0 ? fp[lo] + ((fp[hi] - fp[lo]) * (x - xp[lo])) / span : fp[lo];
}

// ------------------------------------------------------------------ 3x3 homographies

export function mul3(a: Mat3, b: Mat3): Mat3 {
  const out = new Array<number>(9) as Mat3;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) out[3 * r + c] = a[3 * r] * b[c] + a[3 * r + 1] * b[3 + c] + a[3 * r + 2] * b[6 + c];
  return out;
}

export function invert3(m: Mat3): Mat3 {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (!det) throw new Error('singular matrix');
  return [
    A / det,
    -(b * i - c * h) / det,
    (b * f - c * e) / det,
    B / det,
    (a * i - c * g) / det,
    -(a * f - c * d) / det,
    C / det,
    -(a * h - b * g) / det,
    (a * e - b * d) / det,
  ];
}

export function applyHomography(h: Mat3, x: number, y: number): [number, number] {
  const w = h[6] * x + h[7] * y + h[8];
  return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w];
}

export const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

/** The homography taking four points onto four others (exact, like `cv2.findHomography` on four pairs). */
export function homographyFrom4(src: [number, number][], dst: [number, number][]): Mat3 {
  const a: number[][] = [];
  const b: number[] = [];
  for (let k = 0; k < 4; k++) {
    const [x, y] = src[k];
    const [u, v] = dst[k];
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  const h = solve(a, b);
  const out = [...h, 1] as Mat3;
  if (!out.every(Number.isFinite)) throw new Error('calibration points are degenerate');
  return out;
}

/** Similarity moving points (flat x, y pairs) to their centroid, at a mean distance of √2 from it (Hartley). */
function normalizing(points: ArrayLike<number>, idx: ArrayLike<number>, count: number): Mat3 {
  let mx = 0;
  let my = 0;
  for (let k = 0; k < count; k++) {
    mx += points[2 * idx[k]];
    my += points[2 * idx[k] + 1];
  }
  mx /= count;
  my /= count;
  let dist = 0;
  for (let k = 0; k < count; k++) dist += Math.hypot(points[2 * idx[k]] - mx, points[2 * idx[k] + 1] - my);
  const s = dist > 0 ? (Math.SQRT2 * count) / dist : 1;
  return [s, 0, -s * mx, 0, s, -s * my, 0, 0, 1];
}

/** Least-squares homography (h33 = 1, normalized DLT) taking the `idx` points of `src` onto those of `dst`. */
function homographyLeastSquares(src: ArrayLike<number>, dst: ArrayLike<number>, idx: ArrayLike<number>, count: number): Mat3 | null {
  const ts = normalizing(src, idx, count);
  const td = normalizing(dst, idx, count);
  const ata = Array.from({ length: 8 }, () => new Array<number>(8).fill(0));
  const atb = new Array<number>(8).fill(0);
  const row = new Array<number>(8);
  const add = (target: number) => {
    for (let r = 0; r < 8; r++) {
      if (row[r] === 0) continue;
      atb[r] += row[r] * target;
      for (let c = 0; c < 8; c++) ata[r][c] += row[r] * row[c];
    }
  };
  for (let k = 0; k < count; k++) {
    const i = idx[k];
    const x = ts[0] * src[2 * i] + ts[2];
    const y = ts[4] * src[2 * i + 1] + ts[5];
    const u = td[0] * dst[2 * i] + td[2];
    const v = td[4] * dst[2 * i + 1] + td[5];
    row.splice(0, 8, x, y, 1, 0, 0, 0, -u * x, -u * y);
    add(u);
    row.splice(0, 8, 0, 0, 0, x, y, 1, -v * x, -v * y);
    add(v);
  }
  const h = solve(ata, atb);
  const hn = [...h, 1] as Mat3;
  if (!hn.every(Number.isFinite)) return null;
  const out = mul3(mul3(invert3(td), hn), ts);
  return out.every(Number.isFinite) && out[8] !== 0 ? (out.map((v) => v / out[8]) as Mat3) : null;
}

/**
 * The homography taking `src` points onto `dst` points (flat x, y pairs), robust to outliers: RANSAC over
 * four-point fits, then least squares over the points it maps within `tolerance` (px), twice. Null when
 * fewer than `minInliers` points agree. Deterministic for a given `random`.
 */
export function fitHomography(
  src: ArrayLike<number>,
  dst: ArrayLike<number>,
  tolerance: number,
  minInliers: number,
  random: () => number = seededRandom(0),
): { h: Mat3; inliers: number } | null {
  const n = Math.min(src.length, dst.length) / 2;
  if (n < Math.max(4, minInliers)) return null;
  const tol2 = tolerance * tolerance;
  const isInlier = (h: Mat3, i: number) => {
    const x = src[2 * i];
    const y = src[2 * i + 1];
    const w = h[6] * x + h[7] * y + h[8];
    if (!(Math.abs(w) > 1e-12)) return false;
    const du = (h[0] * x + h[1] * y + h[2]) / w - dst[2 * i];
    const dv = (h[3] * x + h[4] * y + h[5]) / w - dst[2 * i + 1];
    return du * du + dv * dv <= tol2;
  };
  const inliersOf = (h: Mat3, into: Int32Array) => {
    let count = 0;
    for (let i = 0; i < n; i++) if (isInlier(h, i)) into[count++] = i;
    return count;
  };
  let best: Mat3 | null = null;
  let bestCount = 0;
  const scratch = new Int32Array(n);
  let needed = 500;
  for (let iter = 0; iter < needed; iter++) {
    const pick = new Set<number>();
    while (pick.size < 4) pick.add(Math.floor(random() * n));
    const [a, b, c, d] = [...pick];
    let h: Mat3;
    try {
      h = homographyFrom4(
        [a, b, c, d].map((i) => [src[2 * i], src[2 * i + 1]] as [number, number]),
        [a, b, c, d].map((i) => [dst[2 * i], dst[2 * i + 1]] as [number, number]),
      );
    } catch {
      continue;
    }
    const count = inliersOf(h, scratch);
    if (count > bestCount) {
      best = h;
      bestCount = count;
      // enough rounds to have drawn four inliers at least once, 99.5 % of the time
      const share = count / n;
      needed = Math.min(500, Math.max(30, Math.ceil(Math.log(0.005) / Math.log(Math.max(1e-9, 1 - share ** 4)))));
    }
  }
  if (!best || bestCount < Math.max(4, minInliers)) return null;
  let h = best;
  const idx = new Int32Array(n);
  let count = inliersOf(h, idx);
  for (let round = 0; round < 2; round++) {
    const refined = homographyLeastSquares(src, dst, idx, count);
    if (!refined) break;
    const next = inliersOf(refined, scratch);
    if (next < count) break;
    h = refined;
    count = next;
    idx.set(scratch.subarray(0, next));
  }
  return count >= minInliers ? { h, inliers: count } : null;
}

// ------------------------------------------------------------------ smoothing

export interface Spline {
  at(x: number): number;
  slope(x: number): number;
}

/** Uniform cubic B-spline weights of the four coefficients around a point `u` (0–1) into its segment, and their slopes. */
function bsplineWeights(u: number): { slope: [number, number, number, number]; value: [number, number, number, number] } {
  const v = 1 - u;
  return {
    value: [(v * v * v) / 6, (3 * u * u * u - 6 * u * u + 4) / 6, (-3 * u * u * u + 3 * u * u + 3 * u + 1) / 6, (u * u * u) / 6],
    slope: [(-v * v) / 2, (3 * u * u - 4 * u) / 2, (-3 * u * u + 2 * u + 1) / 2, (u * u) / 2],
  };
}

/**
 * A penalized B-spline (P-spline, Eilers & Marx) through increasing `x`: cubic B-splines on knots `spacing`
 * apart whose coefficients' third differences are penalized. Heavily smoothed it tends to a parabola, not a
 * line, so a curve still bending where the data ends is followed rather than straightened (a natural
 * smoothing spline has no curvature at its ends).
 *
 * The smoothing is the larger of: what lets the residuals, in units of `sigma`, add up to their count; and
 * `bandwidth` (in x units), the least the curve averages over either side. Straight beyond the data.
 */
export function pSpline(x: readonly number[], y: readonly number[], sigma: readonly number[], spacing: number, bandwidth: number): Spline {
  const n = x.length;
  const x0 = x[0];
  const span = Math.max(x[n - 1] - x0, 1e-9);
  const segments = Math.max(1, Math.ceil(span / spacing));
  const step = span / segments;
  const m = segments + 3;
  const locate = (v: number) => {
    const s = Math.min(segments - 1, Math.max(0, Math.floor((v - x0) / step)));
    return { s, u: (v - x0) / step - s };
  };
  // normal equations: Bᵀ W B and Bᵀ W y (W the weights), and the penalty D₃ᵀ D₃
  const btb = Array.from({ length: m }, () => new Float64Array(m));
  const bty = new Float64Array(m);
  let totalWeight = 0;
  for (let i = 0; i < n; i++) {
    const w = 1 / Math.max(1e-12, sigma[i] ** 2);
    totalWeight += w;
    const { s, u } = locate(x[i]);
    const { value } = bsplineWeights(u);
    for (let a = 0; a < 4; a++) {
      bty[s + a] += w * value[a] * y[i];
      for (let b = 0; b < 4; b++) btb[s + a][s + b] += w * value[a] * value[b];
    }
  }
  const diff = [-1, 3, -3, 1];
  const penalty = Array.from({ length: m }, () => new Float64Array(m));
  for (let k = 0; k + 3 < m; k++) {
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) penalty[k + a][k + b] += diff[a] * diff[b];
  }
  const solveFor = (lambda: number) => {
    const a = Array.from({ length: m }, (_, r) => Array.from({ length: m }, (__, c) => btb[r][c] + lambda * penalty[r][c]));
    return solve(a, Array.from(bty));
  };
  const valueAt = (coeffs: number[], v: number) => {
    const { s, u } = locate(v);
    const { value } = bsplineWeights(u);
    return value[0] * coeffs[s] + value[1] * coeffs[s + 1] + value[2] * coeffs[s + 2] + value[3] * coeffs[s + 3];
  };
  const chi2 = (coeffs: number[]) => {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += ((y[i] - valueAt(coeffs, x[i])) / sigma[i]) ** 2;
    return sum;
  };
  // the bandwidth's smoothing: a third-difference filter of knots `step` apart, cut off about `bandwidth` out
  const least = (totalWeight / m) * (bandwidth / step) ** 6;
  // the residuals grow with the penalty: bisect its logarithm for Σ(r/σ)² = n, then no less than `least`
  let coeffs = solveFor(least);
  if (chi2(coeffs) < n) {
    // up to where the curve is a parabola for any data (stiffer only loses precision in the solve)
    let lo = Math.log(Math.max(least, 1e-12));
    let hi = Math.log(Math.max(least, totalWeight / m) * 1e8);
    if (chi2(solveFor(Math.exp(hi))) < n) {
      coeffs = solveFor(Math.exp(hi));
    } else {
      for (let k = 0; k < 40; k++) {
        const mid = (lo + hi) / 2;
        const trial = solveFor(Math.exp(mid));
        if (chi2(trial) > n) hi = mid;
        else {
          lo = mid;
          coeffs = trial;
        }
      }
    }
  }
  const slopeAt = (v: number) => {
    const c = Math.min(Math.max(v, x0), x[n - 1]);
    const { s, u } = locate(c);
    const { slope } = bsplineWeights(u);
    return (slope[0] * coeffs[s] + slope[1] * coeffs[s + 1] + slope[2] * coeffs[s + 2] + slope[3] * coeffs[s + 3]) / step;
  };
  const at = (v: number) => {
    if (v < x0) return valueAt(coeffs, x0) + slopeAt(x0) * (v - x0);
    if (v > x[n - 1]) return valueAt(coeffs, x[n - 1]) + slopeAt(x[n - 1]) * (v - x[n - 1]);
    return valueAt(coeffs, v);
  };
  return { at, slope: slopeAt };
}

/** Deterministic random numbers (mulberry32), so a RANSAC fit gives the same answer every run. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
