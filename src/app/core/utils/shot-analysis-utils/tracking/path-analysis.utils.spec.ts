import { BOARD_WIDTH_IN } from '../geometry/lane.utils';
import { seededRandom } from '../geometry/math.utils';
import { Detection } from './ball-tracker.utils';
import { PathAnalysis } from './path-analysis.utils';

const FPS = 30;
const SPEED_IN_S = 300;

/** A right-hander's hook: straight out to board 9.5 at 35 ft, then back in to board 20.75 at the pins. */
const boardAt = (ft: number) => 20 - 0.3 * ft + (ft > 35 ? 0.03 * (ft - 35) ** 2 : 0);

/** Detections of the ball along `boardAt` from 3 ft to the pins, sideways off by up to `noiseIn` inches. */
function detections(noiseIn: number): Detection[] {
  const random = seededRandom(4);
  const out: Detection[] = [];
  for (let frame = 0; ; frame++) {
    const t = frame / FPS;
    const yIn = 36 + SPEED_IN_S * t;
    if (yIn > 59 * 12) break;
    const xIn = (boardAt(yIn / 12) - 0.5) * BOARD_WIDTH_IN + noiseIn * (2 * random() - 1);
    out.push({ frame, t, xIn, yIn, sizeRatio: 1, px: [0, 0], sigmaYIn: 1 + yIn / 120, sigmaXIn: 0.1 + yIn / 2400 });
  }
  return out;
}

describe('PathAnalysis', () => {
  it('follows a hook without rounding it off', () => {
    const analysis = new PathAnalysis(detections(0.4), 'right');

    // within a few tenths of a board (the points are off by up to 0.4 in), also where the hook starts
    // abruptly at 35 ft and at the end, where the ball is still hooking
    for (const { distanceFt, board } of analysis.curve()) {
      expect(Math.abs(board - boardAt(distanceFt))).toBeLessThan(0.45);
    }
    const metrics = analysis.metrics();
    expect(metrics.breakpoint!.distanceFt).toBeCloseTo(40, -1);
    expect(Math.abs(metrics.breakpoint!.board - boardAt(40))).toBeLessThan(0.45);
    const truthEntry = (Math.atan(((0.06 * (analysis.toFt - 35) - 0.3) / 12) * BOARD_WIDTH_IN) * 180) / Math.PI;
    expect(Math.abs(metrics.entryAngleDeg! - truthEntry)).toBeLessThan(0.5);
    expect(metrics.speedMph).toBeCloseTo((SPEED_IN_S * 3600) / 63360, 1);
  });

  it('leaves out a few points after a gap that the path does not lead to (a pin flying)', () => {
    const ball = detections(0.2);
    const last = ball[ball.length - 1];
    // after a 0.2 s gap, something ten boards to the side
    const stray = [1, 2].map((k) => ({
      ...last,
      frame: last.frame + 6 + k,
      t: last.t + (6 + k) / FPS,
      yIn: last.yIn + 4 * k,
      xIn: last.xIn - 10 * BOARD_WIDTH_IN,
    }));
    const clean = new PathAnalysis(ball, 'right');
    const withStray = new PathAnalysis([...ball, ...stray], 'right');

    expect(withStray.t.length).toBe(clean.t.length);
    expect(withStray.metrics().entryAngleDeg).toBeCloseTo(clean.metrics().entryAngleDeg!, 1);
  });
});
