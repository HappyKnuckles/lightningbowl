import { ALL_FORMATS, BlobSource, BufferTarget, CanvasSource, EncodedPacketSink, Input, Mp4OutputFormat, Output } from 'mediabunny';

import { clampTrimWindow, defaultTrimWindow, isTrimmed, MAX_SHOT_WINDOW_S, trimVideo } from './video-trim.utils';

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
    ctx.fillStyle = `rgb(${(i * 7) % 255}, 80, 120)`;
    ctx.fillRect(0, 0, 64, 48);
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
  const info = { rotation: track.rotation, timestamps, firstIsKey: first?.type === 'key' };
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
      const previous = { startS: 10, endS: 30 };
      expect(clampTrimWindow({ startS: 5, endS: 30 }, previous, 60)).toEqual({ startS: 5, endS: 25 });
      expect(clampTrimWindow({ startS: 10, endS: 40 }, previous, 60)).toEqual({ startS: 20, endS: 40 });
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
});
