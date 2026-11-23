/**
 * Video -> ball path on the device (port of the BallTracker's `pipeline.py`). The frames are decoded by the
 * browser (hardware on phones) and only the lane's region of each frame is read: straight from the
 * decoder's YUV when it allows, else from a canvas the frame is drawn on. The work per frame is in
 * `ShotFrameTracker`.
 */
import type { VideoSample } from 'mediabunny';

import { Handedness, ShotAnalysisResult, ShotCalibration } from 'src/app/core/models/shot-analysis.model';

import {
  CropRect,
  frameSimilarity,
  matThumbnail,
  planesPixels,
  readStoredPlanes,
  readStoredRegion,
  Rotation,
  shownGrays,
} from '../video/frame.utils';
import { loadOpenCv, release } from '../video/opencv.utils';
import { FramePixels, matPixels, referenceToMarked, ShotFrameTracker, TrackingError } from './frame-tracker.utils';

export { TrackingError };

export interface OnDeviceOptions {
  endFt?: number;
  handedness: Handedness;
  maxSeconds?: number;
  maxWidth?: number;
  measureRevs?: boolean;
  /** Called after every frame with the share of the video done (0–1). */
  onProgress?: (done: number) => void;
  /** Stops the analysis (it rejects with the signal's reason). */
  signal?: AbortSignal;
  stabilize?: boolean;
  startFt?: number;
  /** Part of the video to track, in seconds from its start (the whole video, up to `maxSeconds`, by default). */
  window?: { endS: number; startS: number };
}

export interface OnDeviceTimings {
  /** Aligning frames to the reference. */
  alignS: number;
  /** Converting the lane's pixels to RGB. */
  convertS: number;
  /** Decoding and reading the pixels out of the decoder. */
  decodeS: number;
  /** Finding and following the ball. */
  detectS: number;
  totalS: number;
}

const DEFAULT_FPS = 30;
/** How close the decoded reference frame must be to what the browser shows for the orientation to count. */
const MIN_ORIENTATION_MATCH = 0.7;
/** The frames are processed on the main thread: it is handed back this often so the page stays responsive. */
const YIELD_EVERY_MS = 50;

/**
 * How to draw a decoded frame upright, whole, at `width` x `height`. Mediabunny turns frames by the file's
 * rotation; Safari's decoder has been seen to hand them over already turned, and they'd be turned twice.
 * Which one shows the frame the way the browser does is checked once, on the reference frame.
 *
 * Frames are only ever drawn whole and parts read from that canvas: drawing just a part of a decoded
 * frame (a source rectangle) gave Safari frames that didn't match what it shows. The lane region is
 * read from the decoder's pixels when possible (see `readStoredPlanes`).
 */
type Painter = (sample: VideoSample, ctx: OffscreenCanvasRenderingContext2D, width: number, height: number) => void;

const turnedByMediabunny: Painter = (sample, ctx, w, h) => sample.draw(ctx, 0, 0, w, h);
const asDecoded: Painter = (sample, ctx, w, h) => ctx.drawImage(sample.toCanvasImageSource(), 0, 0, w, h);

/** A 32 x 32 grey thumbnail as a PNG data URL (4x), for the console. */
async function thumbnailUrl(grey: Float32Array): Promise<string> {
  const small = new OffscreenCanvas(32, 32);
  const pixels = new ImageData(32, 32);
  grey.forEach((v, i) => pixels.data.set([v, v, v, 255], 4 * i));
  small.getContext('2d')!.putImageData(pixels, 0, 0);
  const big = new OffscreenCanvas(128, 128);
  const ctx = big.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(small, 0, 0, 128, 128);
  const blob = await big.convertToBlob({ type: 'image/png' });
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => resolve('');
    reader.readAsDataURL(blob);
  });
}

/**
 * Tracks the ball in `video` on this device and returns the same result the BallTracker service does.
 * `calibration` is in the video's display frame (as the user saw it), normalized.
 */
export async function trackOnDevice(
  video: Blob,
  calibration: ShotCalibration,
  options: OnDeviceOptions,
): Promise<{ result: ShotAnalysisResult; timings: OnDeviceTimings }> {
  const maxSeconds = options.maxSeconds ?? 20;
  const started = performance.now();
  let decodeMs = 0;

  options.signal?.throwIfAborted();
  const [cv, { ALL_FORMATS, BlobSource, Input, VideoSampleSink }] = await Promise.all([loadOpenCv(), import('mediabunny')]);
  const input = new Input({ source: new BlobSource(video), formats: ALL_FORMATS });
  let tracker: ShotFrameTracker | null = null;
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error('no video track');
    const frameW = track.displayWidth;
    const frameH = track.displayHeight;
    const rate = (await track.computePacketStats(120)).averagePacketRate;
    const fps = rate > 1 && rate < 1000 ? rate : DEFAULT_FPS;
    const firstTs = (await track.getFirstTimestamp()) ?? 0;
    const sink = new VideoSampleSink(track);
    tracker = new ShotFrameTracker(cv, calibration, frameW, frameH, fps, options);
    const region = tracker.region;
    const levels = tracker.grayLevels;

    // frames drawn whole at full resolution, when the region can't be read from the decoder's pixels
    let fullCtx: OffscreenCanvasRenderingContext2D | null = null;
    const drawFull = (painter: Painter, sample: VideoSample) => {
      fullCtx ??= new OffscreenCanvas(frameW, frameH).getContext('2d', { willReadFrequently: true })!;
      painter(sample, fullCtx, frameW, frameH);
      return fullCtx;
    };

    // the reference frame (the one the corners were tapped on), and which way up the frames come
    const reference = (await sink.getSample(firstTs + calibration.frameTimeS)) ?? (await sink.getSample(firstTs));
    if (!reference) throw new Error('video has no readable frames');
    let paint: Painter = turnedByMediabunny;
    // the frame as the browser showed it for marking: a thumbnail for its orientation, and at the size the
    // alignment works at, to place the decoded reference frame on it
    const alignSize = { width: Math.max(1, Math.round(region.width / 2 ** levels)), height: Math.max(1, Math.round(region.height / 2 ** levels)) };
    const shownViews = await shownGrays(video, calibration.frameTimeS, region, [{ width: 32, height: 32 }, alignSize]);
    const shown = shownViews?.[0] ?? null;
    if (shown) {
      const thumbOf = (painter: Painter) => thumbnail(drawFull(painter, reference), region);
      const viaMediabunnyThumb = thumbOf(turnedByMediabunny);
      const viaMediabunny = frameSimilarity(shown, viaMediabunnyThumb);
      if (viaMediabunny < MIN_ORIENTATION_MATCH) {
        const decodedThumb = thumbOf(asDecoded);
        const decoded = frameSimilarity(shown, decodedThumb);
        if (decoded > viaMediabunny) paint = asDecoded;
        if (Math.max(viaMediabunny, decoded) < MIN_ORIENTATION_MATCH) {
          // what the decoder hands over, to find out why (open the image URLs to see the three thumbnails)
          const frameInfo = reference.toVideoFrame();
          console.warn(`Decoded frames don't look like the video as shown (match ${viaMediabunny.toFixed(2)} / ${decoded.toFixed(2)}).`, {
            track: { rotation: track.rotation, display: [frameW, frameH], coded: [track.codedWidth, track.codedHeight], fps },
            sample: {
              rotation: reference.rotation,
              display: [reference.displayWidth, reference.displayHeight],
              coded: [reference.codedWidth, reference.codedHeight],
              visibleRect: reference.visibleRect,
              format: reference.format,
              colorSpace: { primaries: reference.colorSpace.primaries, transfer: reference.colorSpace.transfer },
            },
            videoFrame: { display: [frameInfo.displayWidth, frameInfo.displayHeight], coded: [frameInfo.codedWidth, frameInfo.codedHeight] },
            region,
            referenceTimeS: [calibration.frameTimeS, reference.timestamp - firstTs],
            shown: await thumbnailUrl(shown),
            viaMediabunny: await thumbnailUrl(viaMediabunnyThumb),
            asDecoded: await thumbnailUrl(decodedThumb),
          });
          frameInfo.close();
        }
      }
    }
    // the region from the decoder's pixels, if they line up with the frame as drawn (checked once)
    const rotation = (paint === asDecoded ? 0 : reference.rotation) as Rotation;
    let fromDecoder = false;
    try {
      const stored = await readStoredRegion(cv, reference, region, rotation);
      if (stored) {
        const match = frameSimilarity(thumbnail(drawFull(paint, reference), region), matThumbnail(cv, stored));
        stored.delete();
        fromDecoder = match >= MIN_ORIENTATION_MATCH;
        if (!fromDecoder) console.warn(`Decoder pixels don't line up with the frame (match ${match.toFixed(2)}), reading frames from the canvas.`);
      }
    } catch (error) {
      console.warn('Could not read the decoder pixels, reading frames from the canvas:', error);
    }
    const pixelsOf = async (sample: VideoSample): Promise<FramePixels> => {
      const planes = fromDecoder ? await readStoredPlanes(sample, region, rotation) : null;
      if (planes) return planesPixels(cv, planes, levels);
      const ctx = drawFull(paint, sample);
      const rgba = cv.matFromImageData(ctx.getImageData(region.left, region.top, region.width, region.height));
      const pixels = matPixels(cv, rgba, [region.left, region.top], levels);
      return { ...pixels, dispose: () => (pixels.dispose(), release(rgba)) };
    };
    const referencePixels = await pixelsOf(reference);
    reference.close();
    const toMarked = shownViews ? referenceToMarked(cv, referencePixels, region, shownViews[1], alignSize.width, alignSize.height) : null;
    tracker.setReference(referencePixels, toMarked ?? undefined);
    referencePixels.dispose();

    const maxFrames = Math.floor(maxSeconds * fps);
    const fromS = options.window?.startS ?? 0;
    const toS = options.window?.endS ?? (await track.computeDuration()) - firstTs;
    const expectedFrames = Math.min(maxFrames, Math.max(1, Math.round((toS - fromS) * fps)));
    let yielded = performance.now();
    let t0 = performance.now();
    // times in the result count from the window's start, like those of a cut video sent to the server
    for await (const sample of sink.samples(firstTs + fromS, firstTs + toS)) {
      if (tracker.framesProcessed >= maxFrames) {
        sample.close();
        break;
      }
      let pixels: FramePixels;
      try {
        pixels = await pixelsOf(sample);
      } finally {
        sample.close();
      }
      decodeMs += performance.now() - t0;
      let more: boolean;
      try {
        more = tracker.process(pixels);
      } finally {
        pixels.dispose();
      }
      options.onProgress?.(Math.min(1, tracker.framesProcessed / expectedFrames));
      if (performance.now() - yielded > YIELD_EVERY_MS) {
        // a macrotask, so the progress is painted and taps (cancel) are handled
        await new Promise((resolve) => setTimeout(resolve));
        yielded = performance.now();
      }
      options.signal?.throwIfAborted();
      // the ball has reached the pins: the rest of the video isn't needed
      if (!more) break;
      t0 = performance.now();
    }

    const result = tracker.result(options.handedness);
    options.onProgress?.(1);
    const s = (ms: number) => Math.round(ms / 100) / 10;
    return {
      result,
      timings: {
        decodeS: s(decodeMs),
        alignS: s(tracker.spent.align),
        convertS: s(tracker.spent.convert),
        detectS: s(tracker.spent.detect),
        totalS: s(performance.now() - started),
      },
    };
  } finally {
    tracker?.dispose();
    input.dispose();
  }
}

/** `area` of a canvas as 32 x 32 grey values, the same thumbnails `shownFrame` makes. */
function thumbnail(ctx: OffscreenCanvasRenderingContext2D, area: CropRect): Float32Array {
  const small = new OffscreenCanvas(32, 32).getContext('2d', { willReadFrequently: true })!;
  small.drawImage(ctx.canvas, area.left, area.top, area.width, area.height, 0, 0, 32, 32);
  const { data } = small.getImageData(0, 0, 32, 32);
  const grey = new Float32Array(32 * 32);
  for (let i = 0; i < grey.length; i++) grey[i] = 0.299 * data[4 * i] + 0.587 * data[4 * i + 1] + 0.114 * data[4 * i + 2];
  return grey;
}
