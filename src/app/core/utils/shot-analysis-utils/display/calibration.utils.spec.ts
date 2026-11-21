import { NormalizedPoint } from 'src/app/core/models/shot-analysis.model';

import { buildCalibration, normalizePoint, validateCalibration } from './calibration.utils';

// a lane filmed from behind the approach: wide at the foul line (bottom), narrow at the pins (top)
const GOOD: NormalizedPoint[] = [
  [0.43, 0.54],
  [0.69, 0.54],
  [0.64, 0.46],
  [0.7, 0.46],
];

describe('calibration utils', () => {
  describe('normalizePoint', () => {
    it('returns the point as fractions of the frame', () => {
      expect(normalizePoint(540, 960, 2160, 3840)).toEqual([0.25, 0.25]);
    });

    it('rejects points outside the frame (the letterbox around the video)', () => {
      expect(normalizePoint(-1, 10, 100, 100)).toBeNull();
      expect(normalizePoint(10, 101, 100, 100)).toBeNull();
      expect(normalizePoint(10, 10, 0, 100)).toBeNull();
    });
  });

  describe('buildCalibration', () => {
    it('maps the four taps in order to the lane corners at the head pin', () => {
      expect(buildCalibration(GOOD, 1.25)).toEqual({
        foulLeft: GOOD[0],
        foulRight: GOOD[1],
        farLeft: GOOD[2],
        farRight: GOOD[3],
        farDistanceFt: 60,
        frameTimeS: 1.25,
      });
    });

    it('needs all four corners', () => {
      expect(buildCalibration(GOOD.slice(0, 3), 0)).toBeNull();
    });
  });

  describe('validateCalibration', () => {
    it('accepts a lane filmed from behind', () => {
      expect(validateCalibration(GOOD)).toBeNull();
    });

    it('catches swapped left and right', () => {
      expect(validateCalibration([GOOD[1], GOOD[0], GOOD[2], GOOD[3]])).toContain('swapped');
    });

    it('catches the pin corners tapped below the foul line', () => {
      expect(validateCalibration([GOOD[2], GOOD[3], GOOD[0], GOOD[1]])).toContain('above the foul line');
    });

    it('catches a lane that widens towards the pins', () => {
      expect(
        validateCalibration([
          [0.6, 0.54],
          [0.7, 0.54],
          [0.4, 0.46],
          [0.9, 0.46],
        ]),
      ).toContain('narrower');
    });
  });
});
