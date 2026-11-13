/**
 * The numerics the ball tracker takes from NumPy and SciPy: polynomial fits, interpolation, 3x3
 * homographies and a cubic smoothing spline.
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

// ------------------------------------------------------------------ smoothing spline

export interface Spline {
  at(x: number): number;
  slope(x: number): number;
}

/**
 * Cubic smoothing spline through increasing `x`: the smoothest curve (least ∫f''²) whose squared residuals
 * add up to `s`, the criterion of SciPy's `UnivariateSpline(..., s=s)`. Natural ends: straight beyond the data.
 * Reinsch's algorithm: the penalty weight is searched until the residuals match `s`. When a cubic polynomial
 * already stays within `s`, that cubic is the answer, as with FITPACK.
 */
export function smoothingSpline(x: readonly number[], y: readonly number[], s: number): Spline {
  const n = x.length;
  const line = (): Spline => {
    const [slope, intercept] = n >= 2 ? polyfit(x, y, 1) : [0, y[0] ?? 0];
    return { at: (v) => slope * v + intercept, slope: () => slope };
  };
  if (n < 4) {
    return line();
  }
  const h = new Array<number>(n - 1);
  for (let i = 0; i < n - 1; i++) h[i] = x[i + 1] - x[i];
  const m = n - 2;

  // Qᵀy, and the bands of R (tridiagonal) and QᵀQ (pentadiagonal)
  const qty = new Array<number>(m);
  for (let j = 0; j < m; j++) qty[j] = (y[j + 2] - y[j + 1]) / h[j + 1] - (y[j + 1] - y[j]) / h[j];
  const q0 = (j: number) => 1 / h[j]; // Q[j][j]
  const q1 = (j: number) => -1 / h[j] - 1 / h[j + 1]; // Q[j+1][j]
  const q2 = (j: number) => 1 / h[j + 1]; // Q[j+2][j]
  const qtq0 = (j: number) => q0(j) ** 2 + q1(j) ** 2 + q2(j) ** 2;
  const qtq1 = (j: number) => q1(j) * q0(j + 1) + q2(j) * q1(j + 1);
  const qtq2 = (j: number) => q2(j) * q0(j + 2);

  const fit = (lambda: number) => {
    // (R + λ QᵀQ) γ = Qᵀy, a symmetric positive definite band of width 2: band Cholesky
    const d = new Float64Array(m);
    const e1 = new Float64Array(m);
    const e2 = new Float64Array(m);
    for (let j = 0; j < m; j++) {
      d[j] = (h[j] + h[j + 1]) / 3 + lambda * qtq0(j);
      if (j + 1 < m) e1[j] = h[j + 1] / 6 + lambda * qtq1(j);
      if (j + 2 < m) e2[j] = lambda * qtq2(j);
    }
    // L with diagonal l0, sub-diagonals l1, l2
    const l0 = new Float64Array(m);
    const l1 = new Float64Array(m);
    const l2 = new Float64Array(m);
    for (let j = 0; j < m; j++) {
      const a2 = j >= 2 ? e2[j - 2] / l0[j - 2] : 0;
      const a1 = j >= 1 ? (e1[j - 1] - (j >= 2 ? a2 * l1[j - 1] : 0)) / l0[j - 1] : 0;
      l2[j] = a2;
      l1[j] = a1;
      l0[j] = Math.sqrt(Math.max(1e-300, d[j] - a1 * a1 - a2 * a2));
    }
    // forward, then backward substitution
    const z = new Float64Array(m);
    for (let j = 0; j < m; j++) z[j] = (qty[j] - (j >= 1 ? l1[j] * z[j - 1] : 0) - (j >= 2 ? l2[j] * z[j - 2] : 0)) / l0[j];
    const gamma = new Float64Array(m);
    for (let j = m - 1; j >= 0; j--)
      gamma[j] = (z[j] - (j + 1 < m ? l1[j + 1] * gamma[j + 1] : 0) - (j + 2 < m ? l2[j + 2] * gamma[j + 2] : 0)) / l0[j];
    // g = y − λ Q γ
    const g = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let qg = 0;
      if (i < m) qg += q0(i) * gamma[i];
      if (i - 1 >= 0 && i - 1 < m) qg += q1(i - 1) * gamma[i - 1];
      if (i - 2 >= 0 && i - 2 < m) qg += q2(i - 2) * gamma[i - 2];
      g[i] = y[i] - lambda * qg;
    }
    let rss = 0;
    for (let i = 0; i < n; i++) rss += (y[i] - g[i]) ** 2;
    return { g, gamma, rss };
  };

  // like FITPACK: when a cubic polynomial already stays within `s`, the answer is that cubic
  const cubic = polyfit(x, y, 3);
  let cubicRss = 0;
  for (let i = 0; i < n; i++) cubicRss += (y[i] - polyval(cubic, x[i])) ** 2;
  if (s >= cubicRss) {
    const d = polyder(cubic);
    return { at: (v) => polyval(cubic, v), slope: (v) => polyval(d, v) };
  }

  // the residuals grow with the penalty: bisect its logarithm
  const span = x[n - 1] - x[0];
  let lo = -40;
  let hi = 40;
  let best = fit(0);
  if (best.rss < s) {
    for (let k = 0; k < 80; k++) {
      const mid = (lo + hi) / 2;
      const trial = fit(Math.exp(mid) * span ** 3);
      if (trial.rss > s) {
        hi = mid;
      } else {
        lo = mid;
        best = trial;
      }
    }
  }
  const { g, gamma } = best;
  // second derivatives at all knots, natural ends
  const c = new Float64Array(n);
  for (let j = 0; j < m; j++) c[j + 1] = gamma[j];

  const segment = (v: number) => {
    let lo2 = 0;
    let hi2 = n - 1;
    while (hi2 - lo2 > 1) {
      const mid = (lo2 + hi2) >> 1;
      if (x[mid] <= v) lo2 = mid;
      else hi2 = mid;
    }
    return lo2;
  };
  const slopeAtKnot = (i: number, end: 'left' | 'right') => {
    const k = end === 'left' ? i : i - 1;
    const hk = h[k];
    const dy = (g[k + 1] - g[k]) / hk;
    return end === 'left' ? dy - (hk * (2 * c[k] + c[k + 1])) / 6 : dy + (hk * (c[k] + 2 * c[k + 1])) / 6;
  };
  const at = (v: number) => {
    if (v <= x[0]) return g[0] + slopeAtKnot(0, 'left') * (v - x[0]);
    if (v >= x[n - 1]) return g[n - 1] + slopeAtKnot(n - 1, 'right') * (v - x[n - 1]);
    const i = segment(v);
    const hk = h[i];
    const a = (x[i + 1] - v) / hk;
    const b = (v - x[i]) / hk;
    return a * g[i] + b * g[i + 1] + (((a ** 3 - a) * c[i] + (b ** 3 - b) * c[i + 1]) * hk * hk) / 6;
  };
  const slopeAt = (v: number) => {
    if (v <= x[0]) return slopeAtKnot(0, 'left');
    if (v >= x[n - 1]) return slopeAtKnot(n - 1, 'right');
    const i = segment(v);
    const hk = h[i];
    const a = (x[i + 1] - v) / hk;
    const b = (v - x[i]) / hk;
    return (g[i + 1] - g[i]) / hk + ((-(3 * a * a - 1) * c[i] + (3 * b * b - 1) * c[i + 1]) * hk) / 6;
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
