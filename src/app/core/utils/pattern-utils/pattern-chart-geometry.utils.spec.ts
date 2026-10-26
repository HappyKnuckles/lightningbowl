import { boardName, boardStripe, CHART_H, CHART_W, chartPointToLane, footBand } from './pattern-chart-geometry.utils';

describe('pattern chart geometry', () => {
  it('names boards like the pattern sheets', () => {
    expect(boardName(1)).toBe('1L');
    expect(boardName(19)).toBe('19L');
    expect(boardName(20)).toBe('20');
    expect(boardName(21)).toBe('19R');
    expect(boardName(39)).toBe('1R');
  });

  it('turns a point on the chart into a board and a foot', () => {
    // the lane runs from x 30 to 186; board 12 from the left spans 11/39 to 12/39 of it
    const x = 30 + (11.5 / 39) * 156;
    const stripe = boardStripe(12, 12, 60);
    const footY = footBand(20, 20).y + footBand(20, 20).height / 2;

    expect(chartPointToLane(x, footY)).toEqual({ board: 12, foot: 20 });
    expect(stripe.x).toBeLessThan(x);
    expect(stripe.x + stripe.width).toBeGreaterThan(x);
  });

  it('finds no board in the gutters and no foot on the pin deck', () => {
    expect(chartPointToLane(10, CHART_H / 2).board).toBeNull();
    expect(chartPointToLane(CHART_W - 10, CHART_H / 2).board).toBeNull();
    expect(chartPointToLane(CHART_W / 2, 20).foot).toBeNull();
  });

  it('draws boards from the foul line to the given distance, and feet across the lane', () => {
    const toEnd = boardStripe(5, 5, 37);
    const toPins = boardStripe(5, 5, 60);
    expect(toEnd.y + toEnd.height).toBeCloseTo(toPins.y + toPins.height, 5); // both start at the foul line
    expect(toEnd.height).toBeLessThan(toPins.height);

    expect(footBand(0, 0)).toMatchObject({ x: 30, width: 156 });
    expect(footBand(0, 0).y + footBand(0, 0).height).toBeCloseTo(toPins.y + toPins.height, 5);

    // a run spans its first to its last board / foot
    expect(boardStripe(8, 12, 60).width).toBeCloseTo(5 * boardStripe(8, 8, 60).width, 5);
    expect(footBand(10, 14).height).toBeCloseTo(5 * footBand(10, 10).height, 5);
  });
});
