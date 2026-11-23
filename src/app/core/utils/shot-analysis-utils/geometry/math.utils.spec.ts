import {
  applyHomography,
  fitHomography,
  homographyFrom4,
  interp,
  invert3,
  Mat3,
  mul3,
  polyder,
  polyfit,
  polyval,
  pSpline,
  seededRandom,
} from './math.utils';

describe('polyfit', () => {
  it('recovers an exact polynomial, highest power first like numpy', () => {
    const x = [0, 1, 2, 3, 4];
    const y = x.map((v) => 2 * v * v - 3 * v + 1);
    const coeffs = polyfit(x, y, 2);
    [2, -3, 1].forEach((c, i) => expect(coeffs[i]).toBeCloseTo(c, 9));
  });

  it('weights points like numpy (weights multiply the residuals)', () => {
    // numpy.polyfit([0, 1, 2, 3], [0, 1, 2, 10], 1, w=[1, 1, 1, 0.1])
    const coeffs = polyfit([0, 1, 2, 3], [0, 1, 2, 10], 1, [1, 1, 1, 0.1]);
    expect(coeffs[0]).toBeCloseTo(1.068404, 5);
    expect(coeffs[1]).toBeCloseTo(-0.045603, 5);
  });
});

describe('polynomials', () => {
  it('evaluates and differentiates', () => {
    expect(polyval([1, 2, 3], 2)).toBe(11);
    expect(polyder([1, 2, 3])).toEqual([2, 2]);
  });

  it('interpolates linearly and clamps at the ends', () => {
    expect(interp(1.5, [1, 2], [10, 20])).toBe(15);
    expect(interp(0, [1, 2], [10, 20])).toBe(10);
    expect(interp(3, [1, 2], [10, 20])).toBe(20);
  });
});

describe('homographies', () => {
  it('maps the four points and inverts', () => {
    const src: [number, number][] = [
      [10, 10],
      [100, 12],
      [90, 80],
      [5, 70],
    ];
    const dst: [number, number][] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    const h = homographyFrom4(src, dst);
    src.forEach(([x, y], i) => {
      const [u, v] = applyHomography(h, x, y);
      expect(u).toBeCloseTo(dst[i][0], 9);
      expect(v).toBeCloseTo(dst[i][1], 9);
    });
    const round = mul3(h, invert3(h)).map((v) => v / mul3(h, invert3(h))[8]);
    [1, 0, 0, 0, 1, 0, 0, 0, 1].forEach((v, i) => expect(round[i]).toBeCloseTo(v, 9));
  });
});

describe('fitHomography', () => {
  const truth: Mat3 = [1.02, 0.01, 5, -0.02, 0.99, -3, 1e-5, -2e-5, 1];

  /** Points mapped by `truth` with a little noise; every fourth one is moved far off (a bowler, the ball). */
  function pairs(n: number): { dst: number[]; src: number[] } {
    const random = seededRandom(5);
    const src: number[] = [];
    const dst: number[] = [];
    for (let i = 0; i < n; i++) {
      const [x, y] = [random() * 400, random() * 300];
      const [u, v] = applyHomography(truth, x, y);
      const off = i % 4 === 0 ? 15 + 20 * random() : 0;
      src.push(x, y);
      dst.push(u + off + 0.1 * (random() - 0.5), v - off + 0.1 * (random() - 0.5));
    }
    return { src, dst };
  }

  it('fits the points that agree and ignores the rest', () => {
    const { src, dst } = pairs(120);
    const fit = fitHomography(src, dst, 1, 24)!;
    expect(fit.inliers).toBe(90);
    for (const [x, y] of [
      [0, 0],
      [400, 300],
      [200, 150],
    ]) {
      const [a, b] = [applyHomography(fit.h, x, y), applyHomography(truth, x, y)];
      expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeLessThan(0.1);
    }
  });

  it('gives up when too few points agree', () => {
    const random = seededRandom(9);
    const src = Array.from({ length: 80 }, () => random() * 300);
    const dst = Array.from({ length: 80 }, () => random() * 300);
    expect(fitHomography(src, dst, 1, 24)).toBeNull();
  });
});

describe('pSpline', () => {
  const x = Array.from({ length: 61 }, (_, i) => i);

  it('stays within the noise and follows the trend', () => {
    const random = seededRandom(3);
    const truth = x.map((v) => 20 - 0.01 * (v - 30) ** 2);
    const y = truth.map((v) => v + (random() - 0.5));
    const spline = pSpline(
      x,
      y,
      x.map(() => 0.3),
      2,
      4,
    );
    expect(Math.max(...x.map((v, i) => Math.abs(spline.at(v) - truth[i])))).toBeLessThan(0.35);
    expect(spline.slope(10)).toBeCloseTo(0.4, 1);
    expect(spline.slope(50)).toBeCloseTo(-0.4, 1);
  });

  it('keeps bending to the end of the data, like a ball still hooking at the pins', () => {
    // a parabola: heavily smoothed, the fit stays one (a natural spline would straighten its ends)
    const y = x.map((v) => 0.004 * v * v);
    const spline = pSpline(
      x,
      y,
      x.map(() => 0.05),
      2,
      30,
    );
    expect(spline.slope(60)).toBeCloseTo(0.48, 2);
    expect(spline.at(60)).toBeCloseTo(14.4, 1);
  });

  it('follows precise points more closely than rough ones', () => {
    // a step: the left half says 0, the right half 1, the line has to compromise near the middle
    const y = x.map((v) => (v < 30 ? 0 : 1));
    const preciseLeft = pSpline(
      x,
      y,
      x.map((v) => (v < 30 ? 0.05 : 0.5)),
      2,
      2,
    );
    const preciseRight = pSpline(
      x,
      y,
      x.map((v) => (v < 30 ? 0.5 : 0.05)),
      2,
      2,
    );
    expect(Math.abs(preciseLeft.at(26))).toBeLessThan(Math.abs(preciseRight.at(26)));
    expect(Math.abs(1 - preciseRight.at(34))).toBeLessThan(Math.abs(1 - preciseLeft.at(34)));
  });

  it('averages over at least the bandwidth, however small the residuals could get', () => {
    // a wiggle two samples long on a straight line, with errors that claim to be tiny
    const y = x.map((v) => 0.5 * v + (v % 2 ? 0.3 : -0.3));
    const sigma = x.map(() => 0.01);
    const tight = pSpline(x, y, sigma, 1, 0);
    const smooth = pSpline(x, y, sigma, 1, 4);
    const wiggle = (s: { at: (v: number) => number }) => Math.max(...x.slice(5, 55).map((v) => Math.abs(s.at(v) - 0.5 * v)));
    expect(wiggle(tight)).toBeGreaterThan(0.1);
    expect(wiggle(smooth)).toBeLessThan(0.05);
  });
});

describe('seededRandom', () => {
  it('repeats for the same seed', () => {
    const a = seededRandom(7);
    const b = seededRandom(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});
