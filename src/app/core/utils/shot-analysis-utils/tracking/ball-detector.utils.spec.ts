import { LaneCalibration } from '../geometry/lane.utils';
import { detectionBands } from './ball-detector.utils';

describe('detectionBands', () => {
  // a 4K portrait lane: the ball about 123 px wide at the foul line and 31 px at the pins
  const lane = LaneCalibration.fromPoints([1300, 2200], [700, 2200], [1250, 1700], [1100, 1700], 60);

  it('covers the lane from the pins to the foul line, the ball at most 64 px in every band', () => {
    const bands = detectionBands(lane, 24, 720);

    expect(bands[0].toIn).toBe(720);
    expect(bands.at(-1)!.fromIn).toBe(24);
    bands.slice(1).forEach((band, i) => expect(band.toIn).toBe(bands[i].fromIn));
    for (const band of bands) expect(lane.ballSizePx(band.fromIn) * band.scale).toBeLessThanOrEqual(64 + 1e-9);
    // full resolution where the ball is small, a fraction of it near the camera
    expect(bands[0].scale).toBe(1);
    expect(bands.at(-1)!.scale).toBeLessThan(0.6);
  });

  it('is one full-resolution band when the ball is small everywhere (a 1080p video)', () => {
    const small = LaneCalibration.fromPoints([650, 1100], [350, 1100], [625, 850], [550, 850], 60);
    expect(detectionBands(small, 24, 720)).toEqual([{ fromIn: 24, toIn: 720, scale: 1 }]);
  });
});
