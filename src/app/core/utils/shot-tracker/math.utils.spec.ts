import { applyHomography, homographyFrom4, interp, invert3, mul3, polyder, polyfit, polyval, seededRandom, smoothingSpline } from './math.utils';

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

describe('smoothingSpline', () => {
  it('stays within the noise it is allowed and follows the trend', () => {
    const random = seededRandom(3);
    const x = Array.from({ length: 60 }, (_, i) => i);
    const truth = x.map((v) => 20 - 0.01 * (v - 30) ** 2);
    const y = truth.map((v) => v + (random() - 0.5));
    const spline = smoothingSpline(x, y, x.length * (1 / 12));
    const rss = x.reduce((sum, v, i) => sum + (spline.at(v) - y[i]) ** 2, 0);
    expect(rss).toBeLessThanOrEqual(x.length / 12 + 1e-6);
    expect(Math.abs(spline.at(30) - 20)).toBeLessThan(0.5);
    expect(spline.slope(10)).toBeGreaterThan(0);
    expect(spline.slope(50)).toBeLessThan(0);
  });
});

describe('seededRandom', () => {
  it('repeats for the same seed', () => {
    const a = seededRandom(7);
    const b = seededRandom(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});
