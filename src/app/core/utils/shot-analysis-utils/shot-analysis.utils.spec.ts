import { NormalizedPoint, ShotAnalysisResult, ShotMetrics } from '../../models/shot-analysis.model';
import {
  boardToX,
  buildCalibration,
  distanceToY,
  loupeSourceRect,
  normalizePoint,
  REV_RATE_MISSING_HINT,
  shotMetricRows,
  validateCalibration,
} from './shot-analysis.utils';

// a lane filmed from behind the approach: wide at the foul line (bottom), narrow at the pins (top)
const GOOD: NormalizedPoint[] = [
  [0.43, 0.54],
  [0.69, 0.54],
  [0.64, 0.46],
  [0.7, 0.46],
];

function result(metrics: Partial<ShotMetrics>): ShotAnalysisResult {
  return {
    handedness: 'right',
    fps: 60,
    framesProcessed: 300,
    trackedFromFt: 2,
    trackedToFt: 60,
    points: [],
    curve: [],
    metrics: { entryBoardExtrapolated: false, ...metrics },
  };
}

describe('shot analysis utils', () => {
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

  describe('lane geometry', () => {
    it('puts board 1 on the right gutter for right-handers and on the left for left-handers', () => {
      expect(boardToX(1, 'right', 390)).toBeCloseTo(385);
      expect(boardToX(1, 'left', 390)).toBeCloseTo(5);
      expect(boardToX(20, 'right', 390)).toBeCloseTo(195);
    });

    it('draws the foul line at the bottom and the head pin near the top', () => {
      expect(distanceToY(0, 640, 64)).toBe(640);
      expect(distanceToY(60, 640, 64)).toBe(40);
    });
  });

  describe('loupeSourceRect', () => {
    it('centres on the point and stays inside the frame', () => {
      expect(loupeSourceRect(500, 500, 2160, 3840, 200)).toEqual({ x: 400, y: 400, size: 200 });
      expect(loupeSourceRect(10, 3830, 2160, 3840, 200)).toEqual({ x: 0, y: 3640, size: 200 });
    });
  });

  describe('shotMetricRows', () => {
    it('lists the metrics LaneTrax-style with units', () => {
      const rows = shotMetricRows(
        result({
          speedMph: 16.66,
          releaseSpeedMph: 17.84,
          impactSpeedMph: 15.21,
          revRateRpm: 333,
          revRateConfidence: 0.9,
          launchAngleDeg: 1.42,
          entryAngleDeg: 3.19,
          arrowsBoard: 15.84,
          breakpoint: { distanceFt: 38.04, board: 11.33 },
          entryBoard: 17.5,
        }),
      );

      expect(rows.map((r) => [r.label, r.value])).toEqual([
        ['Release Speed', '17.8 mph'],
        ['Average Speed', '16.7 mph'],
        ['Rev Rate', '333 rpm'],
        ['Launch Angle', '1.4°'],
        ['Entry Angle', '3.2°'],
        ['Arrows', 'Board 15.8'],
        ['Breakpoint', 'Board 11.3'],
        ['Entry', 'Board 17.5'],
      ]);
      expect(rows[0].detail).toBe('28.7 km/h');
      expect(rows[1].detail).toBe('like lane monitors · 15.2 mph at the pins');
      expect(rows[6].detail).toBe('at 38 ft');
    });

    it('says when the speeds could not be checked against the pin impact', () => {
      const rows = shotMetricRows({ ...result({ releaseSpeedMph: 17, speedMph: 15 }), calibrationCorrected: false });

      expect(rows[0].detail).toBe('27.4 km/h · pins not visible, less precise');
    });

    it('leaves out what the service could not measure, except the rev rate', () => {
      expect(shotMetricRows(result({ speedMph: 15 })).map((r) => r.label)).toEqual(['Average Speed', 'Rev Rate']);
    });

    it('says the rev rate could not be measured instead of leaving it out', () => {
      const rows = shotMetricRows(result({ speedMph: 17 }));

      expect(rows.find((r) => r.label === 'Rev Rate')).toEqual({ label: 'Rev Rate', value: 'Not measurable', detail: REV_RATE_MISSING_HINT });
    });

    it('flags a projected entry board and an unsure rev rate', () => {
      const rows = shotMetricRows(result({ entryBoard: 9, entryBoardExtrapolated: true, revRateRpm: 300, revRateConfidence: 0.3 }));
      expect(rows.find((r) => r.label === 'Entry')?.detail).toBe('at 60 ft, projected');
      expect(rows.find((r) => r.label === 'Rev Rate')?.detail).toBe('low confidence');
    });
  });
});
