import { BallTracker, Detection } from './ball-tracker.utils';

const FPS = 30;

/** The ball rolling at 300 in/s and drifting 6 in/s sideways, seen in `frames`, plus whatever `extra` adds. */
function run(frames: number[], extra: (frame: number) => Detection[] = () => []): BallTracker {
  const tracker = new BallTracker();
  for (let frame = 0; frame <= 80; frame++) {
    const t = frame / FPS;
    const ball: Detection = { frame, t, xIn: 30 - 6 * t, yIn: 60 + 300 * t, sizeRatio: 1, px: [0, 0], sigmaYIn: 1 };
    tracker.update(t, [...(frames.includes(frame) ? [ball] : []), ...extra(frame)]);
  }
  return tracker;
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

describe('BallTracker', () => {
  it('bridges the ball vanishing behind the bowler for a moment', () => {
    const best = run([...range(0, 20), ...range(30, 60)]).bestTrack()!;

    expect(best.points.length).toBe(52);
    expect(best.points[0].frame).toBe(0);
    expect(best.last.frame).toBe(60);
  });

  it("doesn't chain on something off the ball's heading after a gap (a pin flying)", () => {
    // the ball until frame 60, then after a 0.2 s gap something 15 inches beside where it was heading
    const best = run(range(0, 60), (frame) =>
      frame >= 66 && frame <= 70
        ? [{ frame, t: frame / FPS, xIn: 30 - 6 * (frame / FPS) - 15, yIn: 60 + 300 * (frame / FPS), sizeRatio: 1, px: [0, 0], sigmaYIn: 1 }]
        : [],
    ).bestTrack()!;

    expect(best.last.frame).toBe(60);
  });
});
