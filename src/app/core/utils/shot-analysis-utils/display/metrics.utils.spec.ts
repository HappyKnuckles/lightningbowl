import { ShotAnalysisResult, ShotMetrics } from 'src/app/core/models/shot-analysis.model';

import { REV_RATE_MISSING_HINT, shotMetricRows } from './metrics.utils';

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

describe('metrics utils', () => {
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
      expect(rows[0].detail).toBeUndefined();
      expect(rows[1].detail).toBe('like lane monitors · 15.2 mph at the pins');
      expect(rows[6].detail).toBe('at 38 ft');
    });

    it('says when the speeds could not be checked against the pin impact', () => {
      const rows = shotMetricRows({ ...result({ releaseSpeedMph: 17, speedMph: 15 }), calibrationCorrected: false });

      expect(rows[0].detail).toBe('pins not visible, less precise');
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
