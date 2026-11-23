/**
 * The tracker's work per frame, whatever the frames are read from: aligning the frame to the reference,
 * finding ball candidates on the lane, following them, and the ball's pixels for the rev rate.
 */
import { Handedness, ShotAnalysisResult, ShotCalibration } from 'src/app/core/models/shot-analysis.model';

import { LANE_LENGTH_IN, LANE_WIDTH_IN, LaneCalibration, Point } from '../geometry/lane.utils';
import { applyHomography, IDENTITY, interp, invert3, Mat3, mul3 } from '../geometry/math.utils';
import { CropRect, laneCropRect } from '../video/frame.utils';
import { Cv, release } from '../video/opencv.utils';
import { BallDetector } from './ball-detector.utils';
import { BallTracker, Detection } from './ball-tracker.utils';
import { FrameStabilizer } from './frame-stabilizer.utils';
import { PathAnalysis } from './path-analysis.utils';
import { BallCrop, estimateRevRate, normalizeCrop } from './rev-rate.utils';

export class TrackingError extends Error {}

/**
 * One frame's pixels, as the tracker needs them. `gray` (the lane region in grey, in any orientation and
 * scale, the same way for every frame) is for the alignment; `rgb` reads the part of the frame the lane
 * needs in colour, in whatever orientation the pixels are stored.
 */
export interface FramePixels {
  dispose(): void;
  gray: Cv;
  /** Maps `gray` pixels to frame pixels (the frame as shown). */
  grayToFrame: Mat3;
  /** RGB pixels covering `area` (frame pixels) and their mapping to the frame; the caller deletes the Mat. */
  rgb(area: CropRect): { mat: Cv; toFrame: Mat3 } | null;
}

export interface FrameTrackerOptions {
  endFt?: number;
  maxWidth?: number;
  measureRevs?: boolean;
  stabilize?: boolean;
  startFt?: number;
}

const WARMUP_FRAMES = 5;
/**
 * The grey frames for the alignment are halved until their longer side is at most this: the flow is
 * sub-pixel, so a quarter of a 4K frame's lane region still aligns its far end to a fraction of a board.
 */
const ALIGN_MAX_PX = 600;
const REV_WINDOW_FT: [number, number] = [3, 25];
const PATCH_RADIUS = 1.5;
/** Once the ball is this close to the pins, this much more video is looked at, then the shot is over. */
const STOP_AFTER_PINS_S = 0.6;
const PINS_IN = LANE_LENGTH_IN - 72;

const translate = (x: number, y: number): Mat3 => [1, 0, x, 0, 1, y, 0, 0, 1];

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

/** How often a region of this size is halved for the alignment. */
export function alignLevels(region: CropRect): number {
  let levels = 0;
  while (Math.max(region.width, region.height) / 2 ** levels > ALIGN_MAX_PX) levels++;
  return levels;
}

/**
 * Follows the ball through a shot's frames. `calibration` is in the video's display frame (as the user
 * saw it), normalized; frame pixels are display pixels of a `frameW` x `frameH` frame.
 */
export class ShotFrameTracker {
  /** The part of the frame whose pixels are read every frame. */
  readonly region: CropRect;
  /** Halvings of `region` for the grey frames the alignment works on. */
  readonly grayLevels: number;
  /** Milliseconds spent per stage. */
  readonly spent = { align: 0, convert: 0, detect: 0 };

  private readonly startIn: number;
  private readonly endIn: number;
  private readonly measureRevs: boolean;
  private readonly stabilize: boolean;
  private readonly toRoi: Mat3;
  private readonly roiW: number;
  private readonly roiH: number;
  private readonly lane: LaneCalibration;
  private readonly detector: BallDetector;
  private readonly tracker = new BallTracker();
  private readonly patches: BallPatches;
  /** Per frame: source pixels -> lane crop pixels (for the rev rate). */
  private readonly sourceToRoi: (Mat3 | null)[] = [];
  private stabilizer: FrameStabilizer | null = null;
  private referenceGrayToFrame: Mat3 = IDENTITY;
  /** Reference frame pixels to pixels of the frame the corners were marked on. */
  private referenceToMarked: Mat3 = IDENTITY;
  /** This frame's pixels to those of the frame the corners were marked on. */
  private lastH: Mat3 = IDENTITY;
  private frameIdx = 0;
  private pinsReachedAt: number | null = null;

  constructor(
    private readonly cv: Cv,
    calibration: ShotCalibration,
    private readonly frameW: number,
    private readonly frameH: number,
    readonly fps: number,
    options: FrameTrackerOptions = {},
  ) {
    this.startIn = (options.startFt ?? 2) * 12;
    this.endIn = (options.endFt ?? 60) * 12;
    this.measureRevs = options.measureRevs ?? true;
    this.stabilize = options.stabilize ?? true;
    const maxWidth = options.maxWidth ?? 2560;

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
    this.roiW = Math.max(1, Math.round((x1 - x0) * scale));
    this.roiH = Math.max(1, Math.round((y1 - y0) * scale));
    this.toRoi = [scale, 0, -x0 * scale, 0, scale, -y0 * scale, 0, 0, 1];
    this.lane = fullLane.through(this.toRoi);
    this.region = laneCropRect(calibration, { width: frameW, height: frameH }) ?? { left: 0, top: 0, width: frameW, height: frameH };
    this.grayLevels = alignLevels(this.region);
    this.detector = new BallDetector(cv, this.lane, this.roiW, this.roiH, this.startIn, this.endIn);
    this.patches = new BallPatches(cv, this.lane);
  }

  get framesProcessed(): number {
    return this.frameIdx;
  }

  /**
   * The frame the corners were marked on; every frame is aligned to it. `toMarked` maps its pixels to those
   * of the frame as it was shown for marking, when the two differ (see {@link referenceToMarked}).
   */
  setReference(pixels: FramePixels, toMarked: Mat3 = IDENTITY): void {
    this.referenceGrayToFrame = pixels.grayToFrame;
    this.referenceToMarked = toMarked;
    this.lastH = toMarked;
    if (this.stabilize) {
      this.stabilizer?.dispose();
      this.stabilizer = new FrameStabilizer(this.cv, pixels.gray);
    }
  }

  /** The next frame. False once the shot is over (the ball reached the pins a moment ago): later frames aren't needed. */
  process(pixels: FramePixels): boolean {
    const t = this.frameIdx / this.fps;
    let t0 = performance.now();
    if (this.stabilizer) {
      const h = this.stabilizer.track(pixels.gray);
      // a frame that can't be aligned keeps the previous alignment
      if (h) this.lastH = mul3(this.referenceToMarked, mul3(mul3(this.referenceGrayToFrame, h), invert3(pixels.grayToFrame)));
    }
    this.spent.align += performance.now() - t0;

    // the part of this frame the lane crop needs
    t0 = performance.now();
    const toRoiNow = mul3(this.toRoi, this.lastH);
    const back = invert3(toRoiNow);
    const corners = [
      [0, 0],
      [this.roiW, 0],
      [this.roiW, this.roiH],
      [0, this.roiH],
    ].map(([x, y]) => applyHomography(back, x, y));
    const left = Math.max(0, Math.floor(Math.min(...corners.map((p) => p[0]))) - 2);
    const top = Math.max(0, Math.floor(Math.min(...corners.map((p) => p[1]))) - 2);
    const right = Math.min(this.frameW, Math.ceil(Math.max(...corners.map((p) => p[0]))) + 2);
    const bottom = Math.min(this.frameH, Math.ceil(Math.max(...corners.map((p) => p[1]))) + 2);
    const source = right > left && bottom > top ? pixels.rgb({ left, top, width: right - left, height: bottom - top }) : null;
    this.spent.convert += performance.now() - t0;

    t0 = performance.now();
    let detections: Detection[] = [];
    if (source) {
      const sourceToRoi = mul3(toRoiNow, source.toFrame);
      detections = this.detector.detect(source.mat, sourceToRoi, this.frameIdx, t);
      if (this.measureRevs) this.patches.keep(this.frameIdx, source.mat, sourceToRoi, detections);
      this.sourceToRoi.push(sourceToRoi);
      release(source.mat);
    } else {
      this.sourceToRoi.push(null);
    }
    if (this.frameIdx >= WARMUP_FRAMES) this.tracker.update(t, detections);
    this.spent.detect += performance.now() - t0;
    this.frameIdx++;

    if (this.pinsReachedAt === null) {
      const atPins = this.tracker.active.some(
        (track) => track.last.t === t && track.last.yIn >= PINS_IN && track.progressIn >= 120 && track.isPlausible(6),
      );
      if (atPins) this.pinsReachedAt = t;
    }
    return this.pinsReachedAt === null || t - this.pinsReachedAt < STOP_AFTER_PINS_S;
  }

  /** The ball's path and metrics from the frames so far. Throws a {@link TrackingError} when no path was found. */
  result(handedness: Handedness): ShotAnalysisResult {
    if (this.frameIdx === 0) throw new Error('video has no readable frames');
    const best = this.tracker.bestTrack();
    if (!best) throw new TrackingError('no ball path found; check the calibration points and that the whole lane is in view');
    const analysis = new PathAnalysis(best.points, handedness);
    const metrics = analysis.metrics();
    if (this.measureRevs) {
      const revs = measureRevRate(this.cv, this.patches, this.fps, this.sourceToRoi, this.lane, best.points, analysis);
      if (revs) {
        metrics.revRateRpm = revs.rpm;
        metrics.revRateConfidence = revs.confidence;
      }
    }
    const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
    return {
      handedness,
      fps: round(this.fps, 3),
      framesProcessed: this.frameIdx,
      trackedFromFt: round(analysis.fromFt, 2),
      trackedToFt: round(analysis.toFt, 2),
      points: analysis.points(),
      curve: analysis.curve(),
      metrics,
    };
  }

  dispose(): void {
    this.stabilizer?.dispose();
    this.detector.dispose();
    this.patches.dispose();
  }
}

/**
 * How the decoded reference frame lies on the frame the corners were marked on, as the browser showed it
 * (`shown`: the frame's `region` in grey, `width` x `height`). A player that shows the neighbouring frame of
 * a phone panning ten pixels a frame puts the lane boards off at the pins. Maps reference frame pixels to
 * marked frame pixels; null when the two can't be matched (they are then taken as the same).
 */
export function referenceToMarked(cv: Cv, reference: FramePixels, region: CropRect, shown: Float32Array, width: number, height: number): Mat3 | null {
  // scaled the way canvases do: pixel areas, so centres are half a pixel in on both sides
  const sx = width / region.width;
  const sy = height / region.height;
  const frameToShown: Mat3 = [sx, 0, (0.5 - region.left) * sx - 0.5, 0, sy, (0.5 - region.top) * sy - 0.5, 0, 0, 1];
  const m = cv.matFromArray(3, 3, cv.CV_64F, mul3(frameToShown, reference.grayToFrame));
  const decoded = new cv.Mat();
  const marked = cv.matFromArray(height, width, cv.CV_8UC1, Uint8ClampedArray.from(shown));
  let stabilizer: FrameStabilizer | null = null;
  try {
    cv.warpPerspective(reference.gray, decoded, m, new cv.Size(width, height), cv.INTER_LINEAR, cv.BORDER_REPLICATE);
    // the canvas is colour managed, the decoder's grey isn't: compare their ranks of brightness
    cv.equalizeHist(decoded, decoded);
    cv.equalizeHist(marked, marked);
    stabilizer = new FrameStabilizer(cv, decoded);
    const h = stabilizer.track(marked);
    if (!h) return null;
    // a neighbouring frame, not a different view
    const [cx, cy] = applyHomography(h, width / 2, height / 2);
    if (Math.hypot(cx - width / 2, cy - height / 2) > Math.max(width, height) / 8) return null;
    // marked -> reference, in frame pixels; and back
    return invert3(mul3(mul3(invert3(frameToShown), h), frameToShown));
  } finally {
    stabilizer?.dispose();
    release(m, decoded, marked);
  }
}

/**
 * Pixels of an upright frame region in a Mat (RGB or RGBA) whose top-left pixel is `origin` in the frame;
 * the grey frame for the alignment is the region halved `levels` times.
 */
export function matPixels(cv: Cv, mat: Cv, origin: [number, number], levels: number): FramePixels {
  const rgba = mat.channels() === 4;
  const gray = halved(cv, mat, rgba ? cv.COLOR_RGBA2GRAY : cv.COLOR_RGB2GRAY, levels);
  const s = 2 ** levels;
  return {
    gray,
    grayToFrame: [s, 0, origin[0], 0, s, origin[1], 0, 0, 1],
    rgb(area) {
      const x0 = Math.max(0, Math.round(area.left - origin[0]));
      const y0 = Math.max(0, Math.round(area.top - origin[1]));
      const x1 = Math.min(mat.cols, Math.round(area.left + area.width - origin[0]));
      const y1 = Math.min(mat.rows, Math.round(area.top + area.height - origin[1]));
      if (x1 <= x0 || y1 <= y0) return null;
      const part = mat.roi(new cv.Rect(x0, y0, x1 - x0, y1 - y0));
      const out = new cv.Mat();
      if (rgba) cv.cvtColor(part, out, cv.COLOR_RGBA2RGB);
      else part.copyTo(out);
      part.delete();
      return { mat: out, toFrame: translate(origin[0] + x0, origin[1] + y0) };
    },
    dispose: () => release(gray),
  };
}

/** `image` in grey (converted with `code`, or as it is when that is null), halved `levels` times. */
export function halved(cv: Cv, image: Cv, code: number | null, levels: number): Cv {
  let gray = new cv.Mat();
  if (code === null) image.copyTo(gray);
  else cv.cvtColor(image, gray, code);
  for (let k = 0; k < levels; k++) {
    const smaller = new cv.Mat();
    cv.pyrDown(gray, smaller);
    gray.delete();
    gray = smaller;
  }
  return gray;
}

/** Keeps the source pixels around ball candidates in the rev window, so the rev rate needs no second decode. */
class BallPatches {
  readonly patches = new Map<number, { mat: Cv; x: number; y: number }[]>();

  constructor(
    private readonly cv: Cv,
    private readonly lane: LaneCalibration,
  ) {}

  keep(frame: number, source: Cv, sourceToRoi: Mat3, detections: Detection[]): void {
    const [near, far] = [(REV_WINDOW_FT[0] - 1) * 12, (REV_WINDOW_FT[1] + 1) * 12];
    const toSource = invert3(sourceToRoi);
    for (const d of detections) {
      if (d.yIn < near || d.yIn > far) continue;
      const diameter = this.lane.ballSizePx(d.yIn);
      const [cx, cy, r] = [d.px[0], d.px[1] - diameter / 2, PATCH_RADIUS * diameter];
      const corners = [
        [cx - r, cy - r],
        [cx + r, cy - r],
        [cx + r, cy + r],
        [cx - r, cy + r],
      ].map(([x, y]) => applyHomography(toSource, x, y));
      const x0 = Math.max(0, Math.floor(Math.min(...corners.map((p) => p[0]))) - 2);
      const y0 = Math.max(0, Math.floor(Math.min(...corners.map((p) => p[1]))) - 2);
      const x1 = Math.min(source.cols, Math.ceil(Math.max(...corners.map((p) => p[0]))) + 2);
      const y1 = Math.min(source.rows, Math.ceil(Math.max(...corners.map((p) => p[1]))) + 2);
      if (x1 > x0 && y1 > y0) {
        const patch = source.roi(new this.cv.Rect(x0, y0, x1 - x0, y1 - y0));
        const list = this.patches.get(frame) ?? [];
        list.push({ x: x0, y: y0, mat: patch.clone() });
        patch.delete();
        this.patches.set(frame, list);
      }
    }
  }

  /** `sourceToCrop` maps source pixels into a size x size crop; null when no kept patch covers it. */
  crop(frame: number, sourceToCrop: Mat3, size: number): Cv | null {
    const cv = this.cv;
    const back = invert3(sourceToCrop);
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
        const m = cv.matFromArray(3, 3, cv.CV_64F, mul3(sourceToCrop, translate(p.x, p.y)));
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

/** Rev rate from the ball crops in the window right after the release (see the BallTracker's `_measure_revs`). */
function measureRevRate(
  cv: Cv,
  patches: BallPatches,
  fps: number,
  sourceToRoi: (Mat3 | null)[],
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
  const first = Math.floor(t0 * fps);
  const last = Math.ceil(t1 * fps);
  const clahe = new cv.CLAHE(2.0, new cv.Size(4, 4));
  const crops: (BallCrop | null)[] = [];
  try {
    for (let idx = first; idx <= Math.min(last, sourceToRoi.length - 1); idx++) {
      const toRoi = sourceToRoi[idx];
      if (!toRoi) {
        crops.push(null);
        continue;
      }
      const t = idx / fps;
      const cx = interp(t, ptT, ptX);
      const contactY = interp(t, ptT, ptY);
      const diameter = lane.ballSizePx(interp(t, sortedT, sortedY));
      const cy = contactY - diameter / 2;
      const half = 0.6 * diameter;
      const box = translate(-(cx - half), -(cy - half));
      const size = Math.max(8, Math.round(2 * half));
      const crop = patches.crop(idx, mul3(box, toRoi), size);
      crops.push(crop ? normalizeCrop(cv, clahe, crop) : null);
      release(crop);
    }
  } finally {
    clahe.delete();
  }
  return estimateRevRate(crops, fps);
}
