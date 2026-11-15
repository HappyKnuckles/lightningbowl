import { DIFF_AXIS_LIMITS, getBallDistributionBounds, getBallMarkerSize, RG_AXIS_LIMITS, spreadMarkers } from './ball-distribution.utils';

describe('getBallDistributionBounds', () => {
  it('falls back to the full catalog range without balls', () => {
    expect(getBallDistributionBounds([])).toEqual({ x: DIFF_AXIS_LIMITS, y: RG_AXIS_LIMITS });
  });

  it('pads the spread of the balls and snaps to round steps', () => {
    const bounds = getBallDistributionBounds([
      { x: 0.026, y: 2.482 },
      { x: 0.049, y: 2.497 },
      { x: 0.052, y: 2.461 },
    ]);

    expect(bounds.x).toEqual({ min: 0.02, max: 0.06 });
    expect(bounds.y).toEqual({ min: 2.42, max: 2.53 });
  });

  it('keeps a minimum span around a single ball', () => {
    const { x, y } = getBallDistributionBounds([{ x: 0.045, y: 2.5 }]);

    expect(x.max - x.min).toBeGreaterThanOrEqual(0.03 - 1e-9);
    expect(y.max - y.min).toBeGreaterThanOrEqual(0.1 - 1e-9);
    expect(x.min).toBeLessThan(0.045);
    expect(x.max).toBeGreaterThan(0.045);
  });

  it('shifts the window back inside the catalog range near its edge', () => {
    const { x } = getBallDistributionBounds([{ x: 0.016, y: 2.5 }]);

    expect(x.min).toBe(DIFF_AXIS_LIMITS.min);
    expect(x.max - x.min).toBeGreaterThanOrEqual(0.03 - 1e-9);
  });

  it('never cuts off a ball outside the usual catalog range', () => {
    const { x, y } = getBallDistributionBounds([{ x: 0.08, y: 2.8 }]);

    expect(x.max).toBeGreaterThanOrEqual(0.08);
    expect(y.max).toBeGreaterThanOrEqual(2.8);
  });
});

describe('getBallMarkerSize', () => {
  it('shrinks the balls on narrow phone charts', () => {
    expect(getBallMarkerSize(320)).toBe(32);
  });

  it('caps the size on wide charts', () => {
    expect(getBallMarkerSize(1200)).toBe(70);
  });
});

describe('spreadMarkers', () => {
  const area = { left: 0, right: 300, top: 0, bottom: 600 };
  const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

  it('leaves markers that already have room untouched', () => {
    const points = [
      { x: 50, y: 50 },
      { x: 200, y: 200 },
    ];

    expect(spreadMarkers(points, 40, area)).toEqual(points);
  });

  it('pushes overlapping markers apart', () => {
    const [a, b] = spreadMarkers(
      [
        { x: 100, y: 100 },
        { x: 110, y: 105 },
      ],
      40,
      area,
    );

    expect(distance(a, b)).toBeGreaterThanOrEqual(39.9);
  });

  it('separates balls on the exact same spot the same way every time', () => {
    const points = [
      { x: 150, y: 300 },
      { x: 150, y: 300 },
      { x: 150, y: 300 },
    ];

    const first = spreadMarkers(points, 40, area);
    const second = spreadMarkers(points, 40, area);

    expect(first).toEqual(second);
    expect(distance(first[0], first[1])).toBeGreaterThan(30);
    expect(distance(first[1], first[2])).toBeGreaterThan(30);
  });

  it('keeps every marker inside the area', () => {
    const result = spreadMarkers(
      [
        { x: 0, y: 0 },
        { x: 2, y: 1 },
        { x: 400, y: 700 },
      ],
      40,
      area,
    );

    for (const p of result) {
      expect(p.x).toBeGreaterThanOrEqual(area.left);
      expect(p.x).toBeLessThanOrEqual(area.right);
      expect(p.y).toBeGreaterThanOrEqual(area.top);
      expect(p.y).toBeLessThanOrEqual(area.bottom);
    }
  });
});
