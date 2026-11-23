import { BufferTarget, CanvasSource, Mp4OutputFormat, Output } from 'mediabunny';

import { ShotCalibration } from 'src/app/core/models/shot-analysis.model';

import { LaneCalibration, xToBoard } from '../geometry/lane.utils';
import { seededRandom } from '../geometry/math.utils';
import { trackOnDevice } from './pipeline.utils';

const W = 360;
const H = 640;
const FPS = 30;
const STILL = 8;
const SPEED_IN_S = 300;
const BALL_X_IN = 12;
const CORNERS = { foulRight: [250, 600], foulLeft: [110, 600], farRight: [195, 150], farLeft: [165, 150] } as const;

/**
 * A handheld-looking clip of a ball rolling straight down a lane: a textured scene that shakes a little,
 * `still` frames before the ball is rolled.
 */
async function makeShot(still = STILL): Promise<Blob> {
  const lane = LaneCalibration.fromPoints([...CORNERS.foulRight], [...CORNERS.foulLeft], [...CORNERS.farRight], [...CORNERS.farLeft], 60);
  const random = seededRandom(1);
  const blocks = Array.from({ length: 160 }, () => [random() * W, random() * H, 6 + random() * 18, 4 + random() * 14, random()]);
  const canvas = new OffscreenCanvas(W, H);
  const ctx = canvas.getContext('2d')!;
  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target });
  const source = new CanvasSource(canvas, { codec: 'vp9', bitrate: 2_000_000 });
  output.addVideoTrack(source);
  await output.start();
  const rollFrames = Math.ceil(((60 * 12) / SPEED_IN_S) * FPS);
  const frames = still + rollFrames + 4;
  for (let i = 0; i < frames; i++) {
    const [dx, dy] = [Math.sin(i * 0.7) * 2, Math.cos(i * 0.5) * 1.5];
    ctx.setTransform(1, 0, 0, 1, dx, dy);
    ctx.fillStyle = '#23232b';
    ctx.fillRect(-10, -10, W + 20, H + 20);
    for (const [x, y, w, h, shade] of blocks) {
      ctx.fillStyle = `hsl(${Math.round(shade * 360)}, 45%, ${30 + Math.round(shade * 40)}%)`;
      ctx.fillRect(x, y, w, h);
    }
    ctx.fillStyle = '#c9a46e';
    ctx.beginPath();
    for (const [x, y] of [CORNERS.foulRight, CORNERS.foulLeft, CORNERS.farLeft, CORNERS.farRight]) ctx.lineTo(x, y);
    ctx.fill();
    const yIn = (i - still) * (SPEED_IN_S / FPS);
    if (i >= still && yIn <= 60 * 12) {
      const [x, y] = lane.toImage([BALL_X_IN, yIn]);
      const d = lane.ballSizePx(yIn);
      ctx.fillStyle = '#1b3fd0';
      ctx.beginPath();
      ctx.arc(x, y - d / 2, d / 2, 0, 2 * Math.PI);
      ctx.fill();
    }
    await source.add(i / FPS, 1 / FPS);
  }
  await output.finalize();
  return new Blob([target.buffer!], { type: 'video/mp4' });
}

describe('trackOnDevice', () => {
  const norm = ([x, y]: readonly [number, number]): [number, number] => [x / W, y / H];
  const calibration: ShotCalibration = {
    foulRight: norm(CORNERS.foulRight),
    foulLeft: norm(CORNERS.foulLeft),
    farRight: norm(CORNERS.farRight),
    farLeft: norm(CORNERS.farLeft),
    farDistanceFt: 60,
    frameTimeS: 0,
  };

  it('follows the ball down the lane and measures the shot', async () => {
    const progress: number[] = [];

    const { result, timings } = await trackOnDevice(await makeShot(), calibration, {
      handedness: 'right',
      measureRevs: false,
      onProgress: (done) => progress.push(done),
    });

    expect(result.fps).toBeCloseTo(FPS, 0);
    expect(result.trackedFromFt).toBeLessThan(10);
    expect(result.trackedToFt).toBeGreaterThan(50);
    expect(result.metrics.speedMph).toBeCloseTo((SPEED_IN_S * 3600) / 63360, 0);
    expect(Math.abs(result.metrics.arrowsBoard! - xToBoard(BALL_X_IN, 'right'))).toBeLessThan(1);
    expect(progress.at(-1)).toBe(1);
    expect(timings.totalS).toBeGreaterThan(0);
  }, 120_000);

  it('skims through the run-up and looks at every frame from just before the release', async () => {
    const runUp = 3 * FPS;
    const progress: number[] = [];

    const { result } = await trackOnDevice(await makeShot(runUp), calibration, {
      handedness: 'right',
      measureRevs: false,
      onProgress: (done) => progress.push(done),
    });

    // a third of the run-up, then every frame from 0.8 s before the ball was seen rolling
    expect(result.framesProcessed).toBeLessThan(runUp / 3 + 0.8 * FPS + 80);
    expect(result.trackedFromFt).toBeLessThan(10);
    expect(result.trackedToFt).toBeGreaterThan(50);
    expect(Math.abs(result.metrics.arrowsBoard! - xToBoard(BALL_X_IN, 'right'))).toBeLessThan(1);
    expect(result.metrics.speedMph).toBeCloseTo((SPEED_IN_S * 3600) / 63360, 0);
    expect(progress.every((done, i) => i === 0 || done >= progress[i - 1])).toBe(true);
  }, 120_000);
});
