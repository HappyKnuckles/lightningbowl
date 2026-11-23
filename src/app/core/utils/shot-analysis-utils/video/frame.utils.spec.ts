import { ALL_FORMATS, BlobSource, BufferTarget, CanvasSource, Input, Mp4OutputFormat, Output, VideoSampleSink } from 'mediabunny';

import { ShotCalibration } from 'src/app/core/models/shot-analysis.model';

import { mul3 } from '../geometry/math.utils';
import {
  frameSimilarity,
  laneCropRect,
  matThumbnail,
  planesPixels,
  readStoredPlanes,
  readStoredRegion,
  Rotation,
  shownFrame,
  storedRect,
} from './frame.utils';
import { loadOpenCv } from './opencv.utils';

const FPS = 30;

/** A 4 s, 30 fps VP9 MP4 with a key frame every second, the way phones space them. */
async function makeClip(): Promise<Blob> {
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

/** One frame, stored 96 x 64 and shown turned by `rotation`, with a picture that looks different turned. */
async function makeVideo(rotation: Rotation): Promise<Blob> {
  const canvas = new OffscreenCanvas(96, 64);
  const ctx = canvas.getContext('2d')!;
  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target });
  const source = new CanvasSource(canvas, { codec: 'vp9', bitrate: 2_000_000 });
  output.addVideoTrack(source, { rotation });
  await output.start();
  const gradient = ctx.createLinearGradient(0, 0, 96, 0);
  gradient.addColorStop(0, '#102030');
  gradient.addColorStop(1, '#c0d0e0');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 96, 64);
  ctx.fillStyle = '#fff';
  ctx.fillRect(6, 6, 28, 16);
  ctx.fillStyle = '#d33';
  ctx.fillRect(60, 36, 20, 22);
  await source.add(0, 1 / 30);
  await output.finalize();
  return new Blob([target.buffer!], { type: 'video/mp4' });
}

describe('frame utils', () => {
  it('maps a part of the shown frame to the stored frame for every rotation', () => {
    const area = { left: 10, top: 20, width: 30, height: 40 };
    expect(storedRect(area, 0, 96, 64)).toEqual({ x: 10, y: 20, width: 30, height: 40 });
    // turned 90° clockwise, the stored 96 x 64 frame shows 64 x 96
    expect(storedRect(area, 90, 96, 64)).toEqual({ x: 20, y: 24, width: 40, height: 30 });
    expect(storedRect(area, 180, 96, 64)).toEqual({ x: 56, y: 4, width: 30, height: 40 });
    expect(storedRect(area, 270, 96, 64)).toEqual({ x: 36, y: 10, width: 40, height: 30 });
  });

  for (const rotation of [0, 90, 180, 270] as Rotation[]) {
    it(`reads the same part of the frame as drawing it does (rotation ${rotation})`, async () => {
      const cv = await loadOpenCv();
      const input = new Input({ source: new BlobSource(await makeVideo(rotation)), formats: ALL_FORMATS });
      const sample = (await new VideoSampleSink((await input.getPrimaryVideoTrack())!).getSample(0))!;
      const [w, h] = [sample.displayWidth, sample.displayHeight];
      const area = { left: 8, top: 10, width: w - 20, height: h - 18 };

      const canvas = new OffscreenCanvas(w, h).getContext('2d', { willReadFrequently: true })!;
      sample.draw(canvas, 0, 0, w, h);
      const drawn = cv.matFromImageData(canvas.getImageData(area.left, area.top, area.width, area.height));
      const drawnRgb = new cv.Mat();
      cv.cvtColor(drawn, drawnRgb, cv.COLOR_RGBA2RGB);
      const stored = await readStoredRegion(cv, sample, area, rotation);

      expect(stored).not.toBeNull();
      expect([stored.cols, stored.rows]).toEqual([area.width, area.height]);
      expect(frameSimilarity(matThumbnail(cv, drawnRgb), matThumbnail(cv, stored))).toBeGreaterThan(0.95);

      stored.delete();
      drawn.delete();
      drawnRgb.delete();
      sample.close();
      input.dispose();
    }, 60_000);

    it(`maps the decoder's pixels, as stored, onto the frame as drawn (rotation ${rotation})`, async () => {
      const cv = await loadOpenCv();
      const input = new Input({ source: new BlobSource(await makeVideo(rotation)), formats: ALL_FORMATS });
      const sample = (await new VideoSampleSink((await input.getPrimaryVideoTrack())!).getSample(0))!;
      const [w, h] = [sample.displayWidth, sample.displayHeight];
      const area = { left: 8, top: 10, width: w - 20, height: h - 18 };
      const canvas = new OffscreenCanvas(w, h).getContext('2d', { willReadFrequently: true })!;
      sample.draw(canvas, 0, 0, w, h);
      const drawn = cv.matFromImageData(canvas.getImageData(area.left, area.top, area.width, area.height));
      const drawnRgb = new cv.Mat();
      cv.cvtColor(drawn, drawnRgb, cv.COLOR_RGBA2RGB);

      const pixels = planesPixels(cv, (await readStoredPlanes(sample, area, rotation))!, 0);
      const { mat, toFrame } = pixels.rgb(area)!;
      // both read upright into the area: the colour part and the grey part
      const toArea = [1, 0, -area.left, 0, 1, -area.top, 0, 0, 1] as const;
      const upright = (source: typeof mat, map: number[]) => {
        const m = cv.matFromArray(3, 3, cv.CV_64F, map);
        const out = new cv.Mat();
        cv.warpPerspective(source, out, m, new cv.Size(area.width, area.height), cv.INTER_NEAREST);
        m.delete();
        return out;
      };
      const rgb = upright(mat, mul3([...toArea], toFrame));
      const gray = upright(pixels.gray, mul3([...toArea], pixels.grayToFrame));
      const grayRgb = new cv.Mat();
      cv.cvtColor(gray, grayRgb, cv.COLOR_GRAY2RGB);

      expect(frameSimilarity(matThumbnail(cv, drawnRgb), matThumbnail(cv, rgb))).toBeGreaterThan(0.95);
      expect(frameSimilarity(matThumbnail(cv, drawnRgb), matThumbnail(cv, grayRgb))).toBeGreaterThan(0.95);

      pixels.dispose();
      [drawn, drawnRgb, mat, rgb, gray, grayRgb].forEach((m) => m.delete());
      sample.close();
      input.dispose();
    }, 60_000);
  }

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
      video = await makeClip();
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
