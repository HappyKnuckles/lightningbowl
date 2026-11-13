import { BufferTarget, CanvasSource, Mp4OutputFormat, Output } from 'mediabunny';

import { ShotCalibration } from 'src/app/core/models/shot-analysis.model';

import { benchmarkOnDevice } from './on-device-benchmark.utils';

const FRAMES = 45;

/** A 1.5 s lane-like clip: a textured scene that shakes a little and a ball rolling up it. */
async function makeShot(): Promise<Blob> {
  const canvas = new OffscreenCanvas(320, 240);
  const ctx = canvas.getContext('2d')!;
  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target });
  const source = new CanvasSource(canvas, { codec: 'vp9', bitrate: 1_000_000 });
  output.addVideoTrack(source);
  await output.start();
  for (let i = 0; i < FRAMES; i++) {
    const dx = Math.sin(i) * 2;
    ctx.fillStyle = '#2a2a33';
    ctx.fillRect(0, 0, 320, 240);
    for (let k = 0; k < 40; k++) {
      ctx.fillStyle = k % 2 ? '#c8a26a' : '#8a6a3a';
      ctx.fillRect(((k * 37) % 300) + dx, ((k * 53) % 220) + 4, 12, 8);
    }
    ctx.fillStyle = '#d33';
    ctx.beginPath();
    ctx.arc(160 + dx, 220 - i * 4, 8, 0, 2 * Math.PI);
    ctx.fill();
    await source.add(i / 30, 1 / 30);
  }
  await output.finalize();
  return new Blob([target.buffer!], { type: 'video/mp4' });
}

describe('benchmarkOnDevice', () => {
  it('runs the tracker steps on every frame and times them', async () => {
    const calibration: ShotCalibration = {
      foulLeft: [0.2, 0.95],
      foulRight: [0.8, 0.95],
      farLeft: [0.4, 0.1],
      farRight: [0.6, 0.1],
      farDistanceFt: 60,
      frameTimeS: 0,
    };
    const frames: number[] = [];

    const result = await benchmarkOnDevice(await makeShot(), calibration, (frame) => frames.push(frame));

    expect(result.frames).toBe(FRAMES);
    expect([result.width, result.height]).toEqual([320, 240]);
    expect(frames.at(-1)).toBe(FRAMES);
    expect(result.totalS).toBeGreaterThanOrEqual(result.decodeS);
    for (const step of [result.decodeS, result.stabilizeS, result.detectS]) {
      expect(step).toBeGreaterThanOrEqual(0);
    }
  }, 120_000);
});
