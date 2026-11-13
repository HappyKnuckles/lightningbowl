/**
 * Video -> ball path on the device (port of the BallTracker's `pipeline.py`). The frames are decoded by the
 * browser (hardware on phones), drawn to canvases and read into OpenCV's WebAssembly build.
 *
 * Per frame only two images are read back: the whole frame at about 960 px for stabilization, and the
 * lane's region at full resolution for detection and the rev rate (a 4K frame read back whole costs more
 * than everything else together).
 */
import type { VideoSample } from 'mediabunny';

import { ShotAnalysisResult, ShotCalibration } from 'src/app/core/models/shot-analysis.model';

import { CropRect, frameSimilarity, laneCropRect, shownFrame } from '../shot-analysis-utils/video-trim.utils';
import { PathAnalysis } from './analysis.utils';
import { Handedness, LANE_LENGTH_IN, LANE_WIDTH_IN, LaneCalibration, Point } from './lane.utils';
import { applyHomography, IDENTITY, invert3, Mat3, mul3 } from './math.utils';
import { Cv, loadOpenCv, release } from './opencv.utils';
import { BallCrop, estimateRevRate, normalizeCrop } from './revs.utils';
import { BallTracker, Detection } from './tracker.utils';
import { BallDetector, FrameStabilizer } from './vision.utils';

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
  decodeS: number;
  detectS: number;
  stabilizeS: number;
  totalS: number;
}

export class TrackingError extends Error {}

const DEFAULT_FPS = 30;
const WARMUP_FRAMES = 5;
const FEATURE_PX = 960;
const REV_WINDOW_FT: [number, number] = [3, 25];
const PATCH_RADIUS = 1.5;
/** How close the decoded reference frame must be to what the browser shows for the orientation to count. */
const MIN_ORIENTATION_MATCH = 0.7;
/** The frames are processed on the main thread: it is handed back this often so the page stays responsive. */
const YIELD_EVERY_MS = 50;

const translate = (x: number, y: number): Mat3 => [1, 0, x, 0, 1, y, 0, 0, 1];
const scaleBy = (s: number): Mat3 => [s, 0, 0, 0, s, 0, 0, 0, 1];

/** Bounding box of the lane, with headroom above the far end for the ball's body and some margin. */
function laneRoi(points: Point[], frameW: number, frameH: number, ballPxFar: number): [number, number, number, number] {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const ptpX = Math.max(...xs) - Math.min(...xs);
  const ptpY = Math.max(...ys) - Math.min(...ys);
  const x0 = Math.floor(Math.min(...xs) - 0.05 * ptpX - 8);
  const x1 = Math.ceil(Math.max(...xs) + 0.05 * ptpX + 8);
  const y0 = Math.floor(Math.min(...ys) - 2.5 * ballPxFar - 8);
  const y1 = Math.ceil(Math.max(...ys) + 0.03 * ptpY + 8);
  return [Math.max(0, x0), Math.max(0, y0), Math.min(frameW, x1), Math.min(frameH, y1)];
}

/**
 * How to draw a decoded frame upright, whole, at `width` x `height`. Mediabunny turns frames by the file's
 * rotation; Safari's decoder has been seen to hand them over already turned, and they'd be turned twice.
 * Which one shows the frame the way the browser does is checked once, on the reference frame.
 *
 * Frames are only ever drawn whole and parts read from that canvas: drawing just a part of a decoded
 * frame (a source rectangle) gave Safari frames that didn't match what it shows.
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

/** Keeps the source pixels around ball candidates in the rev window, so the rev rate needs no second decode. */
class BallPatches {
  readonly patches = new Map<number, { mat: Cv; x: number; y: number }[]>();

  constructor(
    private readonly cv: Cv,
    private readonly lane: LaneCalibration,
  ) {}

  keep(frame: number, regionRgb: Cv, regionToRoi: Mat3, detections: Detection[]): void {
    const [near, far] = [(REV_WINDOW_FT[0] - 1) * 12, (REV_WINDOW_FT[1] + 1) * 12];
    const toRegion = invert3(regionToRoi);
    for (const d of detections) {
      if (d.yIn < near || d.yIn > far) continue;
      const diameter = this.lane.ballSizePx(d.yIn);
      const [cx, cy, r] = [d.px[0], d.px[1] - diameter / 2, PATCH_RADIUS * diameter];
      const corners = [
        [cx - r, cy - r],
        [cx + r, cy - r],
        [cx + r, cy + r],
        [cx - r, cy + r],
      ].map(([x, y]) => applyHomography(toRegion, x, y));
      const x0 = Math.max(0, Math.floor(Math.min(...corners.map((p) => p[0]))) - 2);
      const y0 = Math.max(0, Math.floor(Math.min(...corners.map((p) => p[1]))) - 2);
      const x1 = Math.min(regionRgb.cols, Math.ceil(Math.max(...corners.map((p) => p[0]))) + 2);
      const y1 = Math.min(regionRgb.rows, Math.ceil(Math.max(...corners.map((p) => p[1]))) + 2);
      if (x1 > x0 && y1 > y0) {
        const patch = regionRgb.roi(new this.cv.Rect(x0, y0, x1 - x0, y1 - y0));
        const list = this.patches.get(frame) ?? [];
        list.push({ x: x0, y: y0, mat: patch.clone() });
        patch.delete();
        this.patches.set(frame, list);
      }
    }
  }

  /** `regionToCrop` maps region pixels into a size x size crop; null when no kept patch covers it. */
  crop(frame: number, regionToCrop: Mat3, size: number): Cv | null {
    const cv = this.cv;
    const back = invert3(regionToCrop);
    const corners = [
      [0, 0],
      [size, 0],
      [size, size],
      [0, size],
    ].map(([x, y]) => applyHomography(back, x, y));
    const x0 = Math.min(...corners.map((p) => p[0])) - 1;
    const y0 = Math.min(...corners.map((p) => p[1])) - 1;
    const x1 = Math.max(...corners.map((p) => p[0])) + 1;
    const y1 = Math.max(...corners.map((p) => p[1])) + 1;
    for (const p of this.patches.get(frame) ?? []) {
      if (p.x <= x0 && p.y <= y0 && x1 <= p.x + p.mat.cols && y1 <= p.y + p.mat.rows) {
        const m = cv.matFromArray(3, 3, cv.CV_64F, mul3(regionToCrop, translate(p.x, p.y)));
        const out = new cv.Mat();
        cv.warpPerspective(p.mat, out, m, new cv.Size(size, size), cv.INTER_AREA);
        m.delete();
        return out;
      }
    }
    return null;
  }

  dispose(): void {
    for (const list of this.patches.values()) for (const p of list) release(p.mat);
    this.patches.clear();
  }
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
  const startFt = options.startFt ?? 2;
  const endFt = options.endFt ?? 60;
  const maxSeconds = options.maxSeconds ?? 20;
  const maxWidth = options.maxWidth ?? 1280;
  const stabilize = options.stabilize ?? true;
  const measureRevs = options.measureRevs ?? true;
  const started = performance.now();
  const spent = { decode: 0, stabilize: 0, detect: 0 };

  options.signal?.throwIfAborted();
  const [cv, { ALL_FORMATS, BlobSource, Input, VideoSampleSink }] = await Promise.all([loadOpenCv(), import('mediabunny')]);
  const input = new Input({ source: new BlobSource(video), formats: ALL_FORMATS });
  const owned: Cv[] = [];
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error('no video track');
    const frameW = track.displayWidth;
    const frameH = track.displayHeight;
    const rate = (await track.computePacketStats(120)).averagePacketRate;
    const fps = rate > 1 && rate < 1000 ? rate : DEFAULT_FPS;
    const firstTs = (await track.getFirstTimestamp()) ?? 0;
    const sink = new VideoSampleSink(track);

    // the lane, its crop for detection, and the region of the frame read back each frame
    const px = (p: [number, number]): Point => [p[0] * frameW, p[1] * frameH];
    const fullLane = LaneCalibration.fromPoints(
      px(calibration.foulRight),
      px(calibration.foulLeft),
      px(calibration.farRight),
      px(calibration.farLeft),
      calibration.farDistanceFt,
    );
    const lanePx: Point[] = [
      [0, 0],
      [LANE_WIDTH_IN, 0],
      [LANE_WIDTH_IN, LANE_LENGTH_IN],
      [0, LANE_LENGTH_IN],
    ].map((p) => fullLane.toImage(p as Point));
    const [x0, y0, x1, y1] = laneRoi(lanePx, frameW, frameH, fullLane.ballSizePx(LANE_LENGTH_IN));
    const scale = Math.min(1, maxWidth / Math.max(1, x1 - x0));
    const roiW = Math.max(1, Math.round((x1 - x0) * scale));
    const roiH = Math.max(1, Math.round((y1 - y0) * scale));
    const toRoi: Mat3 = [scale, 0, -x0 * scale, 0, scale, -y0 * scale, 0, 0, 1];
    const lane = fullLane.through(toRoi);
    const region = laneCropRect(calibration, { width: frameW, height: frameH }) ?? { left: 0, top: 0, width: frameW, height: frameH };
    const regionToFrame = translate(region.left, region.top);

    const featureScale = Math.min(1, FEATURE_PX / Math.max(frameW, frameH));
    const smallW = Math.round(frameW * featureScale);
    const smallH = Math.round(frameH * featureScale);
    const smallCtx = new OffscreenCanvas(smallW, smallH).getContext('2d', { willReadFrequently: true })!;
    // each frame is drawn here whole, at full resolution; the region and the small frame are read from it
    const frameCtx = new OffscreenCanvas(frameW, frameH).getContext('2d', { willReadFrequently: true })!;
    const drawFrame = (painter: Painter, sample: VideoSample, withSmall: boolean) => {
      painter(sample, frameCtx, frameW, frameH);
      if (withSmall) smallCtx.drawImage(frameCtx.canvas, 0, 0, smallW, smallH);
    };
    const readRegion = () => {
      const rgba = cv.matFromImageData(frameCtx.getImageData(region.left, region.top, region.width, region.height));
      const rgb = new cv.Mat();
      cv.cvtColor(rgba, rgb, cv.COLOR_RGBA2RGB);
      rgba.delete();
      return rgb;
    };
    const readGray = () => {
      const rgba = cv.matFromImageData(smallCtx.getImageData(0, 0, smallW, smallH));
      const gray = new cv.Mat();
      cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);
      rgba.delete();
      return gray;
    };

    // the reference frame (the one the corners were tapped on), and which way up the frames come
    const reference = (await sink.getSample(firstTs + calibration.frameTimeS)) ?? (await sink.getSample(firstTs));
    if (!reference) throw new Error('video has no readable frames');
    let paint: Painter = turnedByMediabunny;
    const shown = await shownFrame(video, calibration.frameTimeS, region);
    if (shown) {
      const thumbOf = (painter: Painter) => {
        drawFrame(painter, reference, false);
        return thumbnail(frameCtx, region);
      };
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
    drawFrame(paint, reference, true);
    const referenceGray = readGray();
    owned.push(referenceGray);
    reference.close();

    const stabilizer = stabilize ? new FrameStabilizer(cv, referenceGray) : null;
    const detector = new BallDetector(cv, lane, roiW, roiH, startFt * 12, endFt * 12);
    const tracker = new BallTracker();
    const patches = new BallPatches(cv, lane);
    const regionToRoi: Mat3[] = []; // per frame, for the rev rate
    const maxFrames = Math.floor(maxSeconds * fps);
    const fromS = options.window?.startS ?? 0;
    const toS = options.window?.endS ?? (await track.computeDuration()) - firstTs;
    const expectedFrames = Math.min(maxFrames, Math.max(1, Math.round((toS - fromS) * fps)));
    const roiSize = new cv.Size(roiW, roiH);
    let frameIdx = 0;
    let lastH: Mat3 = IDENTITY;
    let yielded = performance.now();
    try {
      let t0 = performance.now();
      // times in the result count from the window's start, like those of a cut video sent to the server
      for await (const sample of sink.samples(firstTs + fromS, firstTs + toS)) {
        if (frameIdx >= maxFrames) {
          sample.close();
          break;
        }
        drawFrame(paint, sample, stabilizer !== null);
        sample.close();
        const regionRgb = readRegion();
        const gray = stabilizer ? readGray() : null;
        spent.decode += performance.now() - t0;

        t0 = performance.now();
        if (stabilizer && gray) {
          const hSmall = stabilizer.track(gray);
          // a frame that can't be aligned keeps the previous alignment
          if (hSmall) lastH = mul3(mul3(scaleBy(1 / featureScale), hSmall), scaleBy(featureScale));
        }
        release(gray);
        spent.stabilize += performance.now() - t0;

        t0 = performance.now();
        const toRoiNow = mul3(mul3(toRoi, lastH), regionToFrame);
        regionToRoi.push(toRoiNow);
        const m = cv.matFromArray(3, 3, cv.CV_64F, toRoiNow);
        const warped = new cv.Mat();
        cv.warpPerspective(regionRgb, warped, m, roiSize, cv.INTER_LINEAR, cv.BORDER_REPLICATE);
        const t = frameIdx / fps;
        const detections = detector.detect(warped, frameIdx, t);
        if (measureRevs) patches.keep(frameIdx, regionRgb, toRoiNow, detections);
        if (frameIdx >= WARMUP_FRAMES) tracker.update(t, detections);
        release(m, warped, regionRgb);
        spent.detect += performance.now() - t0;

        frameIdx++;
        options.onProgress?.(Math.min(1, frameIdx / expectedFrames));
        if (performance.now() - yielded > YIELD_EVERY_MS) {
          // a macrotask, so the progress is painted and taps (cancel) are handled
          await new Promise((resolve) => setTimeout(resolve));
          yielded = performance.now();
        }
        options.signal?.throwIfAborted();
        t0 = performance.now();
      }

      if (frameIdx === 0) throw new Error('video has no readable frames');
      const best = tracker.bestTrack();
      if (!best) throw new TrackingError('no ball path found; check the calibration points and that the whole lane is in view');

      const analysis = new PathAnalysis(best.points, options.handedness);
      const metrics = analysis.metrics();
      if (measureRevs) {
        const revs = measureRevRate(cv, patches, fps, regionToRoi, lane, best.points, analysis);
        if (revs) {
          metrics.revRateRpm = revs.rpm;
          metrics.revRateConfidence = revs.confidence;
        }
      }
      const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
      const s = (ms: number) => Math.round(ms / 100) / 10;
      return {
        result: {
          handedness: options.handedness,
          fps: round(fps, 3),
          framesProcessed: frameIdx,
          trackedFromFt: round(analysis.fromFt, 2),
          trackedToFt: round(analysis.toFt, 2),
          points: analysis.points(),
          curve: analysis.curve(),
          metrics,
        },
        timings: { decodeS: s(spent.decode), stabilizeS: s(spent.stabilize), detectS: s(spent.detect), totalS: s(performance.now() - started) },
      };
    } finally {
      stabilizer?.dispose();
      detector.dispose();
      patches.dispose();
    }
  } finally {
    release(...owned);
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

/** Rev rate from the ball crops in the window right after the release (see the BallTracker's `_measure_revs`). */
function measureRevRate(
  cv: Cv,
  patches: BallPatches,
  fps: number,
  regionToRoi: Mat3[],
  lane: LaneCalibration,
  track: Detection[],
  analysis: PathAnalysis,
): { confidence: number; rpm: number } | null {
  const inWindow = analysis.y.map((y) => y >= REV_WINDOW_FT[0] * 12 && y <= REV_WINDOW_FT[1] * 12);
  if (inWindow.filter(Boolean).length < 4) return null;
  const windowT = analysis.t.filter((_, i) => inWindow[i]);
  const t0 = Math.min(...windowT);
  const t1 = Math.max(...windowT);
  const pts = track.filter((p) => p.t >= t0 - 0.05 && p.t <= t1 + 0.05).sort((a, b) => a.t - b.t);
  if (pts.length < 4) return null;
  const ptT = pts.map((p) => p.t);
  const ptX = pts.map((p) => p.px[0]);
  const ptY = pts.map((p) => p.px[1]);
  const order = analysis.t.map((_, i) => i).sort((a, b) => analysis.t[a] - analysis.t[b]);
  const sortedT = order.map((i) => analysis.t[i]);
  const sortedY = order.map((i) => analysis.y[i]);
  const interp = (x: number, xp: number[], fp: number[]) => {
    if (x <= xp[0]) return fp[0];
    if (x >= xp[xp.length - 1]) return fp[fp.length - 1];
    let i = 1;
    while (xp[i] < x) i++;
    return fp[i - 1] + ((fp[i] - fp[i - 1]) * (x - xp[i - 1])) / (xp[i] - xp[i - 1] || 1);
  };
  const first = Math.floor(t0 * fps);
  const last = Math.ceil(t1 * fps);
  const clahe = new cv.CLAHE(2.0, new cv.Size(4, 4));
  const crops: (BallCrop | null)[] = [];
  try {
    for (let idx = first; idx <= Math.min(last, regionToRoi.length - 1); idx++) {
      const t = idx / fps;
      const cx = interp(t, ptT, ptX);
      const contactY = interp(t, ptT, ptY);
      const diameter = lane.ballSizePx(interp(t, sortedT, sortedY));
      const cy = contactY - diameter / 2;
      const half = 0.6 * diameter;
      const box = translate(-(cx - half), -(cy - half));
      const size = Math.max(8, Math.round(2 * half));
      const crop = patches.crop(idx, mul3(box, regionToRoi[idx]), size);
      crops.push(crop ? normalizeCrop(cv, clahe, crop) : null);
      release(crop);
    }
  } finally {
    clahe.delete();
  }
  return estimateRevRate(crops, fps);
}
