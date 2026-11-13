import { ALL_FORMATS, BlobSource, BufferTarget, CanvasSource, Input, Mp4OutputFormat, Output, VideoSampleSink } from 'mediabunny';

import { frameSimilarity } from '../shot-analysis-utils/video-trim.utils';
import { loadOpenCv } from './opencv.utils';
import { matThumbnail, readStoredRegion, Rotation, storedRect } from './stored-frame.utils';

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

describe('stored-frame.utils', () => {
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
  }
});
