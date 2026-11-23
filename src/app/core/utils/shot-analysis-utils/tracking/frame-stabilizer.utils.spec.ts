import { texture } from 'src/testing/texture';

import { applyHomography } from '../geometry/math.utils';
import { loadOpenCv } from '../video/opencv.utils';
import { FrameStabilizer } from './frame-stabilizer.utils';

describe('FrameStabilizer', () => {
  it('aligns a turned and shifted frame to the reference to a fraction of a pixel', async () => {
    const cv = await loadOpenCv();
    const reference = texture(cv, 320, 240);
    // the frame: the reference turned by 1° about its centre and shifted (5, -3)
    const angle = (1 * Math.PI) / 180;
    const [c, s] = [Math.cos(angle), Math.sin(angle)];
    const [cx, cy] = [160, 120];
    const m = cv.matFromArray(2, 3, cv.CV_64F, [c, -s, cx - c * cx + s * cy + 5, s, c, cy - s * cx - c * cy - 3]);
    const frame = new cv.Mat();
    cv.warpAffine(reference, frame, m, new cv.Size(320, 240), cv.INTER_LINEAR, cv.BORDER_REPLICATE);
    const stabilizer = new FrameStabilizer(cv, reference);

    const h = stabilizer.track(frame)!;

    // frame pixels back onto the reference: undo the turn and the shift
    for (const [x, y] of [
      [80, 60],
      [240, 60],
      [160, 180],
    ]) {
      const [u, v] = [c * x - s * y + cx - c * cx + s * cy + 5, s * x + c * y + cy - s * cx - c * cy - 3];
      const [bx, by] = applyHomography(h, u, v);
      expect(Math.hypot(bx - x, by - y)).toBeLessThan(0.2);
    }
    stabilizer.dispose();
    [reference, frame, m].forEach((mat) => mat.delete());
  });
});
