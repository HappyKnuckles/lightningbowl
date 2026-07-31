import { LANE_ARROWS, LANE_UNITS, laneXToBoard, laneXToMetres, parseLaneX, parseNumeric, UNIT_M } from './board.utils';

describe('board utils', () => {
  describe('parseLaneX', () => {
    it('maps L tokens to their own value', () => {
      expect(parseLaneX('1L')).toBe(1);
      expect(parseLaneX('10L')).toBe(10);
      expect(parseLaneX('20L')).toBe(20);
    });

    it('maps R tokens to LANE_UNITS - n, matching chart_generator.py', () => {
      // The Python does `LANE_WIDTH - num`, not `LANE_WIDTH + 1 - num`.
      expect(parseLaneX('1R')).toBe(38);
      expect(parseLaneX('10R')).toBe(29);
      expect(parseLaneX('20R')).toBe(19);
    });

    it('accepts a bare number as a lane-axis coordinate', () => {
      expect(parseLaneX('20')).toBe(20);
      expect(parseLaneX('0')).toBe(0);
    });

    it('is case and whitespace insensitive', () => {
      expect(parseLaneX(' 10r ')).toBe(29);
      expect(parseLaneX('10l')).toBe(10);
    });

    it('accepts fractional coordinates', () => {
      expect(parseLaneX('10.5L')).toBe(10.5);
      expect(parseLaneX('10.5R')).toBe(28.5);
    });

    it('returns null rather than falling back to zero', () => {
      expect(parseLaneX('')).toBeNull();
      expect(parseLaneX(undefined)).toBeNull();
      expect(parseLaneX(null)).toBeNull();
      expect(parseLaneX('abc')).toBeNull();
      expect(parseLaneX('10X')).toBeNull();
      expect(parseLaneX('40L')).toBeNull();
    });
  });

  describe('parseNumeric', () => {
    it('parses numbers and rejects everything else', () => {
      expect(parseNumeric('25.5')).toBe(25.5);
      expect(parseNumeric(' 0 ')).toBe(0);
      expect(parseNumeric('')).toBeNull();
      expect(parseNumeric(undefined)).toBeNull();
      expect(parseNumeric('abc')).toBeNull();
    });
  });

  describe('lane geometry', () => {
    it('puts the axis centre on the lane centreline', () => {
      expect(laneXToMetres(LANE_UNITS / 2)).toBeCloseTo(0, 10);
    });

    it('spans the full lane width between the gutter edges', () => {
      expect(laneXToMetres(LANE_UNITS) - laneXToMetres(0)).toBeCloseTo(1.0541, 6);
    });

    it('sizes one unit at roughly 27 mm', () => {
      expect(UNIT_M).toBeCloseTo(0.027028, 6);
    });

    it('is symmetric about the centreline', () => {
      expect(laneXToMetres(10)).toBeCloseTo(-laneXToMetres(29), 10);
    });
  });

  describe('laneXToBoard', () => {
    it('reports the arrows as boards 5, 10, 15, 20, 25, 30, 35', () => {
      expect(LANE_ARROWS.map((arrow) => laneXToBoard(arrow.x))).toEqual([5, 10, 15, 20, 25, 30, 35]);
    });
  });

  describe('LANE_ARROWS', () => {
    it('is a chevron, not a straight row', () => {
      const distances = LANE_ARROWS.map((arrow) => arrow.distanceFt);
      expect(new Set(distances).size).toBeGreaterThan(1);
    });

    it('is symmetric about the centre arrow', () => {
      const distances = LANE_ARROWS.map((arrow) => arrow.distanceFt);
      expect(distances).toEqual([...distances].reverse());
    });

    it('keeps three non-collinear points for the manual calibration tap', () => {
      const [left, , , centre, , , right] = LANE_ARROWS;
      const area = Math.abs(
        left.x * (centre.distanceFt - right.distanceFt) +
          centre.x * (right.distanceFt - left.distanceFt) +
          right.x * (left.distanceFt - centre.distanceFt),
      );
      expect(area).toBeGreaterThan(0);
    });
  });
});
