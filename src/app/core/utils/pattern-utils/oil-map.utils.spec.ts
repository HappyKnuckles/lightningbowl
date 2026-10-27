import { ForwardsData, ReverseData } from 'src/app/core/models/pattern.model';
import { buildOilField, patternToOilField, sampleOilField, toBaseBands, toLoadRects } from './oil-map.utils';

function row(overrides: Partial<ForwardsData> = {}): ForwardsData & ReverseData {
  return {
    number: '1',
    start: '10L',
    stop: '10R',
    load: '2',
    mics: '40',
    speed: '18',
    buf: '0',
    tank: '1',
    total_oil: '25',
    distance_start: '0',
    distance_end: '35',
    ...overrides,
  };
}

describe('oil-map utils', () => {
  describe('toLoadRects', () => {
    it('matches chart_generator.py board math on its own sample pattern', () => {
      // The sample in the `__main__` block of scraper/chart_generator.py.
      const { rects } = toLoadRects({
        forwards_data: [row({ start: '10L', stop: '10R', distance_start: '0', distance_end: '35', total_oil: '25' })],
        reverse_data: [row({ start: '10L', stop: '10R', distance_start: '35', distance_end: '45', total_oil: '10' })],
      });

      expect(rects.length).toBe(2);
      // parse_x('10L') -> 10, parse_x('10R') -> 39 - 10 -> 29
      expect(rects[0]).toEqual(jasmine.objectContaining({ x0: 10, x1: 29, y0: 0, y1: 35, pass: 'forward' }));
      expect(rects[1]).toEqual(jasmine.objectContaining({ x0: 10, x1: 29, y1: 45, pass: 'reverse' }));
    });

    it('starts every reverse load at the foul line, whatever distance_start says', () => {
      // The reverse pass runs back toward the foul line, so it always reaches it.
      const { rects } = toLoadRects({
        forwards_data: [],
        reverse_data: [
          row({ distance_start: '35', distance_end: '45' }),
          row({ distance_start: '12', distance_end: '28' }),
          row({ distance_start: '45', distance_end: '35' }),
        ],
      });

      expect(rects.length).toBe(3);
      expect(rects.map((rect) => rect.y0)).toEqual([0, 0, 0]);
      expect(rects.map((rect) => rect.y1)).toEqual([45, 28, 45]);
    });

    it('leaves forward loads starting where the data says', () => {
      const { rects } = toLoadRects({
        forwards_data: [row({ distance_start: '10', distance_end: '35' })],
        reverse_data: [],
      });

      expect(rects[0].y0).toBe(10);
    });

    it('normalises reversed board and distance ranges', () => {
      const { rects } = toLoadRects({
        forwards_data: [row({ start: '10R', stop: '10L', distance_start: '35', distance_end: '10' })],
        reverse_data: [],
      });

      expect(rects[0]).toEqual(jasmine.objectContaining({ x0: 10, x1: 29, y0: 10, y1: 35 }));
    });

    it('truncates total_oil before the non-zero test, as the Python does', () => {
      // int(float('0.5')) === 0, so this load is dropped.
      const { rects } = toLoadRects({
        forwards_data: [row({ total_oil: '0.5' })],
        reverse_data: [],
      });

      expect(rects.length).toBe(0);
    });

    it('keeps reverse rows with zero oil when distance_end is 0', () => {
      const { rects } = toLoadRects({
        forwards_data: [],
        reverse_data: [row({ total_oil: '0', distance_start: '0', distance_end: '0' })],
      });

      expect(rects.length).toBe(1);
    });

    it('drops reverse rows with zero oil that do end downlane', () => {
      const { rects } = toLoadRects({
        forwards_data: [],
        reverse_data: [row({ total_oil: '0', distance_start: '0', distance_end: '20' })],
      });

      expect(rects.length).toBe(0);
    });

    it('reports max distances across all rows, including dropped ones', () => {
      const result = toLoadRects({
        forwards_data: [row({ distance_end: '35' }), row({ distance_end: '42', total_oil: '0' })],
        reverse_data: [row({ distance_end: '18' })],
      });

      expect(result.forwardsMaxDistance).toBe(42);
      expect(result.reverseMaxDistance).toBe(18);
    });

    it('skips unparseable rows instead of drawing them at board zero', () => {
      const result = toLoadRects({
        forwards_data: [row({ start: 'bogus' }), row()],
        reverse_data: [],
      });

      expect(result.rects.length).toBe(1);
      expect(result.skipped.length).toBe(1);
      expect(result.skipped[0]).toEqual(jasmine.objectContaining({ pass: 'forward', index: 0 }));
    });

    it('tolerates missing load arrays', () => {
      const result = toLoadRects({ forwards_data: [], reverse_data: [] });

      expect(result.rects).toEqual([]);
      expect(result.skipped).toEqual([]);
    });
  });

  describe('toBaseBands', () => {
    it('runs the reverse band from the foul line to the reverse max distance', () => {
      const bands = toBaseBands({ forwardsMaxDistance: 40, reverseMaxDistance: 25 });
      const reverse = bands.find((band) => band.pass === 'reverse');

      expect(reverse).toEqual(jasmine.objectContaining({ y0: 0, y1: 25, kind: 'base' }));
    });

    it('insets the bands one unit from each gutter, as x_scale(1)..x_scale(38) does', () => {
      const [band] = toBaseBands({ forwardsMaxDistance: 40, reverseMaxDistance: 25 });

      expect(band.x0).toBe(1);
      expect(band.x1).toBe(38);
    });

    it('omits the forwards band when both maxima agree', () => {
      const bands = toBaseBands({ forwardsMaxDistance: 40, reverseMaxDistance: 40 });

      expect(bands.length).toBe(1);
      expect(bands[0].pass).toBe('reverse');
    });

    it('emits both bands when the maxima differ', () => {
      const bands = toBaseBands({ forwardsMaxDistance: 40, reverseMaxDistance: 25 });

      expect(bands.map((band) => band.pass)).toEqual(['forward', 'reverse']);
    });

    it('emits nothing for a pattern with no distances', () => {
      expect(toBaseBands({ forwardsMaxDistance: 0, reverseMaxDistance: 0 })).toEqual([]);
    });
  });

  describe('buildOilField', () => {
    it('carries oil all the way to the foul line even when no load starts there', () => {
      // Every load starts at 10 ft, but the lane is oiled from the foul line out.
      const field = patternToOilField({
        forwards_data: [row({ distance_start: '10', distance_end: '35' })],
        reverse_data: [row({ distance_start: '10', distance_end: '25' })],
      });

      expect(sampleOilField(field, 20, 0)).toBeGreaterThan(0);
      expect(sampleOilField(field, 20, 5 * field.slicesPerFoot)).toBeGreaterThan(0);
    });

    it('keeps the base band below the loads sitting on top of it', () => {
      const field = patternToOilField({
        forwards_data: [row({ distance_start: '10', distance_end: '35' })],
        reverse_data: [],
      });

      const atFoulLine = sampleOilField(field, 20, 0);
      const underLoad = sampleOilField(field, 20, 20 * field.slicesPerFoot);

      expect(atFoulLine).toBeGreaterThan(0);
      expect(underLoad).toBeGreaterThan(atFoulLine);
    });

    it('still leaves the lane dry beyond the furthest pass', () => {
      const field = patternToOilField({
        forwards_data: [row({ distance_start: '0', distance_end: '35' })],
        reverse_data: [],
      });

      expect(sampleOilField(field, 20, 40 * field.slicesPerFoot)).toBe(0);
    });

    it('accumulates overlapping passes additively', () => {
      const { rects } = toLoadRects({
        forwards_data: [
          row({ start: '10L', stop: '10R', distance_start: '0', distance_end: '20' }),
          row({ start: '15L', stop: '15R', distance_start: '0', distance_end: '20' }),
        ],
        reverse_data: [],
      });
      const field = buildOilField(rects, { model: 'coverage' });

      // Lane-axis 20 is inside both loads (10..29 and 15..24); 12 only the first.
      const both = sampleOilField(field, 20, 50);
      const one = sampleOilField(field, 12, 50);

      expect(both).toBeGreaterThan(one);
      expect(field.max).toBe(2);
    });

    it('weights a reverse pass below a forward pass in coverage mode', () => {
      const forwardOnly = patternToOilField({ forwards_data: [row({ distance_end: '20' })], reverse_data: [] });
      const reverseOnly = patternToOilField({ forwards_data: [], reverse_data: [row({ distance_end: '20' })] });

      expect(forwardOnly.max).toBeGreaterThan(reverseOnly.max);
    });

    it('leaves the lane dry beyond the pattern distance', () => {
      const field = patternToOilField({
        forwards_data: [row({ distance_start: '0', distance_end: '35' })],
        reverse_data: [],
      });

      expect(sampleOilField(field, 20, 30 * field.slicesPerFoot)).toBeGreaterThan(0);
      expect(sampleOilField(field, 20, 40 * field.slicesPerFoot)).toBe(0);
    });

    it('gives the outside boards base coverage only, well under the load', () => {
      const field = patternToOilField({
        forwards_data: [row({ start: '10L', stop: '10R', distance_end: '35' })],
        reverse_data: [],
      });

      const outside = sampleOilField(field, 2, 100);
      const inside = sampleOilField(field, 20, 100);

      expect(outside).toBeGreaterThan(0);
      expect(outside).toBeLessThan(inside);
    });

    it('leaves the gutter-edge units dry, as the inset bands do', () => {
      const field = patternToOilField({
        forwards_data: [row({ start: '10L', stop: '10R', distance_end: '35' })],
        reverse_data: [],
      });

      expect(sampleOilField(field, 0, 100)).toBe(0);
      expect(sampleOilField(field, 38, 100)).toBe(0);
    });

    it('uses mics in thickness mode where the field is present', () => {
      const thin = patternToOilField({ forwards_data: [row({ mics: '20' })], reverse_data: [] }, { model: 'thickness' });
      const thick = patternToOilField({ forwards_data: [row({ mics: '80' })], reverse_data: [] }, { model: 'thickness' });

      expect(thick.max).toBeGreaterThan(thin.max);
    });

    it('falls back to spreading total_oil when mics is absent', () => {
      const field = patternToOilField({ forwards_data: [row({ mics: '' })], reverse_data: [] }, { model: 'thickness' });

      expect(field.max).toBeGreaterThan(0);
    });

    it('normalises samples into 0..1', () => {
      const field = patternToOilField({ forwards_data: [row()], reverse_data: [] });

      expect(sampleOilField(field, 20, 100)).toBe(1);
      expect(sampleOilField(field, -1, 100)).toBe(0);
      expect(sampleOilField(field, 20, 99999)).toBe(0);
    });

    it('returns an empty field for a pattern with no usable loads', () => {
      const field = patternToOilField({ forwards_data: [], reverse_data: [] });

      expect(field.max).toBe(0);
      expect(sampleOilField(field, 20, 100)).toBe(0);
    });
  });
});
