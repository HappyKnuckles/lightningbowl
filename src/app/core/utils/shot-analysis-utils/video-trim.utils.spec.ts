import { ALL_FORMATS, BlobSource, BufferTarget, CanvasSource, EncodedPacketSink, Input, Mp4OutputFormat, Output } from 'mediabunny';

import { ShotCalibration } from 'src/app/core/models/shot-analysis.model';

import {
  clampTrimWindow,
  cropCalibration,
  cropVideo,
  defaultTrimWindow,
  isTrimmed,
  laneCropRect,
  MAX_SHOT_WINDOW_S,
  trimVideo,
} from './video-trim.utils';

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

async function inspect(blob: Blob) {
  const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
  const track = (await input.getPrimaryVideoTrack())!;
  const sink = new EncodedPacketSink(track);
  const timestamps: number[] = [];
  for await (const packet of sink.packets()) {
    timestamps.push(packet.timestamp);
  }
  const first = await sink.getFirstPacket();
  const info = {
    rotation: track.rotation,
    size: [track.displayWidth, track.displayHeight],
    timestamps,
    firstIsKey: first?.type === 'key',
  };
  input.dispose();
  return info;
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

    it('only counts a window as trimmed when it leaves part of the video out', () => {
      expect(isTrimmed({ startS: 0, endS: 9.98 }, 10)).toBe(false);
      expect(isTrimmed({ startS: 2, endS: 10 }, 10)).toBe(true);
      expect(isTrimmed({ startS: 0, endS: 6 }, 10)).toBe(true);
    });
  });

  describe('trimVideo', () => {
    let video: Blob;

    beforeAll(async () => {
      video = await makeVideo();
    });

    it('cuts from the key frame before the start to the end of the last group, without re-encoding', async () => {
      const cut = await trimVideo(video, { startS: 1.5, endS: 2.2 });

      expect(cut).not.toBeNull();
      expect(cut!.offsetS).toBeCloseTo(1, 3);
      expect(cut!.blob.size).toBeLessThan(video.size);

      const info = await inspect(cut!.blob);
      expect(info.firstIsKey).toBe(true);
      expect(info.rotation).toBe(90);
      // 1.0 s up to the next key frame at 3.0 s, shifted to start at 0
      expect(info.timestamps.length).toBe(2 * FPS);
      expect(info.timestamps[0]).toBeCloseTo(0, 3);
      expect(Math.max(...info.timestamps)).toBeCloseTo(2 - 1 / FPS, 2);
    });

    it('returns null for something that is not a video', async () => {
      expect(await trimVideo(new Blob(['not a video']), { startS: 0, endS: 1 })).toBeNull();
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

    it('moves the corners into the crop', () => {
      const crop = laneCropRect(calibration, frame)!;
      const moved = cropCalibration(calibration, crop, frame);

      expect(moved.foulLeft[0] * crop.width + crop.left).toBeCloseTo(937, 6);
      expect(moved.farRight[1] * crop.height + crop.top).toBeCloseTo(1762, 6);
      expect(moved.frameTimeS).toBe(0.2);
      expect(moved.farDistanceFt).toBe(60);
    });
  });

  describe('cropVideo', () => {
    let video: Blob;

    beforeAll(async () => {
      video = await makeVideo();
    });

    it('re-encodes the selected part cropped, with the rotation applied, starting exactly at the selection', async () => {
      // the test video is stored 64 x 48 and rotated 90°, so it shows 48 x 64
      const cut = await cropVideo(video, { startS: 1.5, endS: 3 }, { left: 8, top: 10, width: 32, height: 40 });

      expect(cut).not.toBeNull();
      expect(cut!.offsetS).toBe(1.5);

      const info = await inspect(cut!.blob);
      expect(info.size).toEqual([32, 40]);
      expect(info.rotation).toBe(0);
      expect(info.firstIsKey).toBe(true);
      expect(info.timestamps[0]).toBeCloseTo(0, 2);
      expect(info.timestamps.length).toBeGreaterThanOrEqual(1.5 * FPS - 1);
      expect(info.timestamps.length).toBeLessThanOrEqual(1.5 * FPS + 1);
    });

    it('returns null for something that is not a video', async () => {
      expect(await cropVideo(new Blob(['not a video']), { startS: 0, endS: 1 }, { left: 0, top: 0, width: 2, height: 2 })).toBeNull();
    });

    it('gives up on a crop that does not show what the original shows there', async () => {
      // as if the browser had rotated the frames once more on its own
      expect(await cropVideo(video, { startS: 1.5, endS: 3 }, { left: 8, top: 10, width: 32, height: 40 }, [180])).toBeNull();
    });

    it('keeps the first rotation whose crop matches the original', async () => {
      const cut = await cropVideo(video, { startS: 1.5, endS: 3 }, { left: 8, top: 10, width: 32, height: 40 }, [180, 0]);

      expect(cut).not.toBeNull();
      expect((await inspect(cut!.blob)).size).toEqual([32, 40]);
    });
  });
});
