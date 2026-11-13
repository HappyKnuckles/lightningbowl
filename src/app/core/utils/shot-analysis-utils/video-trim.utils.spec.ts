import { BufferTarget, CanvasSource, Mp4OutputFormat, Output } from 'mediabunny';

import { ShotCalibration } from 'src/app/core/models/shot-analysis.model';

import { clampTrimWindow, defaultTrimWindow, frameSimilarity, laneCropRect, MAX_SHOT_WINDOW_S, shownFrame } from './video-trim.utils';

const FPS = 30;

/** A 4 s, 30 fps VP9 MP4 with a key frame every second, the way phones space them. */
async function makeVideo(): Promise<Blob> {
  const canvas = new OffscreenCanvas(64, 48);
  const ctx = canvas.getContext('2d')!;
  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target });
  const source = new CanvasSource(canvas, { codec: 'vp9', bitrate: 200_000, keyFrameInterval: 1 });
  output.addVideoTrack(source, { rotation: 90 });
  await output.start();
  for (let i = 0; i < 4 * FPS; i++) {
    // a picture that looks different turned or flipped: a gradient, a bright block in one corner, a moving bar
    const gradient = ctx.createLinearGradient(0, 0, 64, 0);
    gradient.addColorStop(0, '#102030');
    gradient.addColorStop(1, '#a0b0c0');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 48);
    ctx.fillStyle = '#fff';
    ctx.fillRect(4, 4, 18, 12);
    ctx.fillStyle = `rgb(${(i * 7) % 255}, 80, 120)`;
    ctx.fillRect(40, 30 - (i % 20), 6, 10);
    await source.add(i / FPS, 1 / FPS);
  }
  await output.finalize();
  return new Blob([target.buffer!], { type: 'video/mp4' });
}

describe('video-trim.utils', () => {
  describe('trim window', () => {
    it('defaults to the start of the video, capped at the tracker limit', () => {
      expect(defaultTrimWindow(8)).toEqual({ startS: 0, endS: 8 });
      expect(defaultTrimWindow(45)).toEqual({ startS: 0, endS: MAX_SHOT_WINDOW_S });
    });

    it('drags the other knob along when the window would get too long', () => {
      const previous = { startS: 10, endS: 28 };
      expect(clampTrimWindow({ startS: 5, endS: 28 }, previous, 60)).toEqual({ startS: 5, endS: 23 });
      expect(clampTrimWindow({ startS: 10, endS: 40 }, previous, 60)).toEqual({ startS: 22, endS: 40 });
    });

    it('keeps the window inside the video', () => {
      expect(clampTrimWindow({ startS: -1, endS: 12 }, { startS: 0, endS: 5 }, 10)).toEqual({ startS: 0, endS: 10 });
    });
  });

  describe('lane crop', () => {
    // a real handheld 4K clip (portrait, 2160 x 3840): the lane is a small part of the frame
    const frame = { width: 2160, height: 3840 };
    const px = (x: number, y: number): [number, number] => [x / frame.width, y / frame.height];
    const calibration: ShotCalibration = {
      foulLeft: px(937, 2090),
      foulRight: px(1485, 2092),
      farLeft: px(1378, 1762),
      farRight: px(1518, 1762),
      farDistanceFt: 60,
      frameTimeS: 0.2,
    };

    it('keeps the lane and half its size around it, with even sizes', () => {
      expect(laneCropRect(calibration, frame)).toEqual({ left: 646, top: 1470, width: 1162, height: 912 });
    });

    it('does not crop when the lane fills most of the frame', () => {
      const wide = { ...calibration, foulLeft: px(100, 3500), foulRight: px(2000, 3500), farLeft: px(900, 600), farRight: px(1200, 600) };
      expect(laneCropRect(wide, frame)).toBeNull();
    });
  });

  describe('shownFrame', () => {
    let video: Blob;

    beforeAll(async () => {
      video = await makeVideo();
    });

    it('shows the frame the way the browser does, as a small grey thumbnail', async () => {
      // the test video is stored 64 x 48 and rotated 90°, so it shows 48 x 64
      const crop = { left: 8, top: 10, width: 32, height: 40 };
      const frame = await shownFrame(video, 1.5, crop);
      const again = await shownFrame(video, 1.5, crop);
      const elsewhere = await shownFrame(video, 1.5, { left: 0, top: 24, width: 48, height: 40 });

      expect(frame?.length).toBe(32 * 32);
      expect(frameSimilarity(frame!, again!)).toBeCloseTo(1, 3);
      expect(frameSimilarity(frame!, elsewhere!)).toBeLessThan(0.7);
    });

    it('returns null for something that is not a video', async () => {
      expect(await shownFrame(new Blob(['not a video']), 0)).toBeNull();
    });
  });
});
