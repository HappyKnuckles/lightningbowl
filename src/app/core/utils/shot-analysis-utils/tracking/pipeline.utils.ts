/**
 * Video -> ball path on the device (port of the BallTracker's `pipeline.py`). The frames are decoded by the
 * browser (hardware on phones) and only the lane's region of each frame is read: straight from the
 * decoder (its YUV, or RGB the browser converts 10-bit HDR and GPU frames to) when it allows, else from a
 * canvas the whole frame is drawn on, which is many times slower. The work per frame is in `ShotFrameTracker`.
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
  StoredPlanes,
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
  /** Waiting for the decoder. */
  decodeS: number;
  /** Finding and following the ball. */
  detectS: number;
  /** Reading the lane's region out of the decoded frames. */
  readS: number;
  totalS: number;
}

const DEFAULT_FPS = 30;
/** How close the decoded reference frame must be to what the browser shows for the orientation to count. */
const MIN_ORIENTATION_MATCH = 0.7;
/** The frames are processed on the main thread: it is handed back this often so the page stays responsive. */
const YIELD_EVERY_MS = 50;
/**
 * Most of a video is the bowler walking up. Until the ball is seen rolling down the lane, about this many
 * frames a second are looked at (enough to keep the background model and the alignment going); then the
 * video is gone back this far (s), to before the release, and every frame is looked at from there.
 */
const SCAN_FPS = 10;
const REWIND_S = 0.8;
/** An analysis that takes longer than this (s) says in the console where the time went. */
const SLOW_ANALYSIS_S = 8;

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
  let readMs = 0;

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
    const frameFormat = reference.format;
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
      } else {
        console.warn(`The browser can't copy out decoded frames (format ${reference.format}), reading them from the canvas: several times slower.`);
      }
    } catch (error) {
      console.warn('Could not read the decoder pixels, reading frames from the canvas:', error);
    }
    // frames the decoder keeps on the GPU are read back through WebGL or copied out by the browser,
    // whichever is faster on this device (each timed twice on the reference frame: the first read sets up)
    let gpuVia: StoredPlanes['via'] = 'webgl';
    const gpuReadMs: Partial<Record<StoredPlanes['via'], number>> = {};
    if (fromDecoder && frameFormat === null) {
      for (const via of ['webgl', 'copy'] as const) {
        for (let k = 0; k < 2; k++) {
          const t = performance.now();
          const planes = await readStoredPlanes(reference, region, rotation, via);
          gpuReadMs[via] = planes?.via === via ? performance.now() - t : Infinity;
        }
      }
      gpuVia = (gpuReadMs.webgl ?? Infinity) <= (gpuReadMs.copy ?? Infinity) ? 'webgl' : 'copy';
    }
    let readVia = 'canvas';
    const pixelsOf = async (sample: VideoSample): Promise<FramePixels> => {
      const planes = fromDecoder ? await readStoredPlanes(sample, region, rotation, gpuVia) : null;
      readVia = planes ? `${planes.via} (${planes.format})` : 'canvas';
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

    const fromS = options.window?.startS ?? 0;
    const toS = Math.min(options.window?.endS ?? (await track.computeDuration()) - firstTs, fromS + maxSeconds);
    const start = firstTs + fromS;
    const end = firstTs + toS;
    // frames are numbered (and times in the result count) from the window's start, like those of a cut video
    // sent to the server
    const frameOf = (sample: VideoSample) => Math.round((sample.timestamp - start) * fps);
    const frames = tracker;
    let done = 0;
    let yielded = performance.now();
    let t0 = performance.now();
    /** Reads and analyses one frame; false once the shot is over. */
    const analyse = async (sample: VideoSample, frame: number): Promise<boolean> => {
      decodeMs += performance.now() - t0;
      const r0 = performance.now();
      let pixels: FramePixels;
      try {
        pixels = await pixelsOf(sample);
      } finally {
        sample.close();
      }
      readMs += performance.now() - r0;
      let more: boolean;
      try {
        more = frames.process(pixels, frame);
      } finally {
        pixels.dispose();
      }
      done = Math.max(done, (frame + 1) / Math.max(1, (toS - fromS) * fps));
      options.onProgress?.(Math.min(1, done));
      if (performance.now() - yielded > YIELD_EVERY_MS) {
        // a macrotask, so the progress is painted and taps (cancel) are handled
        await new Promise((resolve) => setTimeout(resolve));
        yielded = performance.now();
      }
      options.signal?.throwIfAborted();
      t0 = performance.now();
      return more;
    };

    // through the run-up a few frames a second, until the ball rolls down the lane (see SCAN_FPS)
    const step = Math.max(1, Math.round(fps / SCAN_FPS));
    let from = 0;
    if (step > 1) {
      for await (const sample of sink.samples(start, end)) {
        const frame = frameOf(sample);
        if (frame % step !== 0) {
          sample.close();
          continue;
        }
        const more = await analyse(sample, frame);
        if (frames.ballSeenAt !== null || !more) break;
      }
      // not seen: every frame from the start after all
      const seen = frames.ballSeenAt;
      from = seen === null ? 0 : Math.max(0, seen - Math.round(REWIND_S * fps));
      frames.restart(from);
    }
    // every frame from just before the release, until the ball has reached the pins
    let last = from - 1;
    for await (const sample of sink.samples(start + from / fps, end)) {
      const frame = Math.max(frameOf(sample), last + 1);
      last = frame;
      if (!(await analyse(sample, frame))) break;
    }

    const result = tracker.result(options.handedness);
    options.onProgress?.(1);
    const s = (ms: number) => Math.round(ms / 100) / 10;
    const timings: OnDeviceTimings = {
      decodeS: s(decodeMs),
      readS: s(readMs),
      alignS: s(tracker.spent.align),
      convertS: s(tracker.spent.convert),
      detectS: s(tracker.spent.detect),
      totalS: s(performance.now() - started),
    };
    if (timings.totalS > SLOW_ANALYSIS_S) {
      const pixels = fromDecoder ? `from the decoder: ${readVia}` : 'from a canvas';
      console.warn(`The shot analysis took ${timings.totalS} s.`, {
        timings,
        gpuFrameReadMs: gpuReadMs,
        video: { codec: await track.getCodecParameterString(), size: [frameW, frameH], fps, frameFormat },
        framesAnalysed: result.framesProcessed,
        pixels,
      });
    }
    return { result, timings };
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
