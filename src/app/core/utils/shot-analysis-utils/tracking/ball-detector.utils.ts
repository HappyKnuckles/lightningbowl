/** Ball detection by background subtraction (descendant of the BallTracker's `detector.py`). */
import { LaneCalibration, Point } from '../geometry/lane.utils';
import { applyHomography, invert3, Mat3, mul3 } from '../geometry/math.utils';
import { Cv, release } from '../video/opencv.utils';
import { Detection } from './ball-tracker.utils';

/**
 * Within a band the ball is drawn at most this big (px). Near the camera it is several times that at full
 * resolution; it is detected on downscaled pixels there, which costs a fraction and loses nothing.
 */
const MAX_BALL_PX = 64;
/** A band covers distances over which the ball's size changes by at most this factor. */
const BAND_SIZE_RATIO = 2;
/** The last band takes the rest when the ball changes by no more than this over it. */
const LAST_BAND_RATIO = 2.6;
/** Lane margin (inches) a band reaches past the distances it reports, nearer the foul line. */
const BAND_OVERLAP_IN = 6;
/**
 * Foreground fragments this close (share of the ball's size) are one object, as long as together they are
 * no bigger than a ball (and its reflection): a dark ball is rarely found whole.
 */
const GROUP_GAP = 0.25;
const GROUP_MAX_WIDTH = 1.3;
const GROUP_MAX_HEIGHT = 2.2;
/** A ball's disc has to be covered this much by its foreground. */
const MIN_DISC_FILL = 0.3;

interface Band {
  bg: Cv;
  centroids: Cv;
  fg: Cv;
  fromBand: Mat3;
  /** Ball contact points from here up to `toIn` (lane inches) are reported by this band. */
  fromIn: number;
  image: Cv;
  labels: Cv;
  lane: LaneCalibration;
  mask: Cv;
  size: Cv;
  stats: Cv;
  /** Lane-crop pixels to band pixels. */
  toBand: Mat3;
  toIn: number;
}

/**
 * Ball candidates: round-ish foreground blobs on the lane whose size fits the ball at their distance.
 * Background subtraction (MOG2) per band of distances, each band at the resolution that draws the ball at
 * most {@link MAX_BALL_PX}. The ball's position is the disc of its known size that its foreground covers
 * best: a dark ball over the dark pin deck is often found in fragments, and the fragments' bounding box
 * moved the ball by boards from frame to frame.
 *
 * Detections are in the pixels of the lane crop `lane` is calibrated for.
 */
export class BallDetector {
  private readonly bands: Band[] = [];
  private readonly kernel: Cv;

  constructor(
    private readonly cv: Cv,
    private readonly lane: LaneCalibration,
    width: number,
    height: number,
    private readonly startIn: number,
    private readonly endIn: number,
    private readonly minRatio = 0.45,
    private readonly maxRatio = 1.9,
  ) {
    this.kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));
    for (const { fromIn, toIn, scale } of detectionBands(lane, startIn, endIn)) {
      const poly = lane.lanePolygon(Math.max(0, fromIn - BAND_OVERLAP_IN), toIn);
      const xs = poly.map(([x]) => x);
      const ys = poly.map(([, y]) => y);
      const x0 = Math.max(0, Math.floor(Math.min(...xs)) - 4);
      const y0 = Math.max(0, Math.floor(Math.min(...ys)) - 4);
      const x1 = Math.min(width, Math.ceil(Math.max(...xs)) + 4);
      const y1 = Math.min(height, Math.ceil(Math.max(...ys)) + 4);
      if (x1 <= x0 || y1 <= y0) continue;
      const toBand: Mat3 = [scale, 0, -x0 * scale, 0, scale, -y0 * scale, 0, 0, 1];
      const bandW = Math.max(1, Math.round((x1 - x0) * scale));
      const bandH = Math.max(1, Math.round((y1 - y0) * scale));
      const bandLane = lane.through(toBand);
      const mask = cv.Mat.zeros(bandH, bandW, cv.CV_8UC1);
      const bandPoly = bandLane.lanePolygon(Math.max(0, fromIn - BAND_OVERLAP_IN), toIn);
      const points = cv.matFromArray(4, 1, cv.CV_32SC2, bandPoly.flat());
      cv.fillConvexPoly(mask, points, new cv.Scalar(255));
      points.delete();
      this.bands.push({
        fromIn,
        toIn,
        toBand,
        fromBand: invert3(toBand),
        size: new cv.Size(bandW, bandH),
        lane: bandLane,
        mask,
        bg: new cv.BackgroundSubtractorMOG2(150, 28, true),
        image: new cv.Mat(),
        fg: new cv.Mat(),
        labels: new cv.Mat(),
        stats: new cv.Mat(),
        centroids: new cv.Mat(),
      });
    }
  }

  /** Candidates in `source`, an RGB image whose pixels `sourceToLane` maps into the lane crop. */
  detect(source: Cv, sourceToLane: Mat3, frame: number, t: number): Detection[] {
    const cv = this.cv;
    const detections: Detection[] = [];
    for (const band of this.bands) {
      const m = cv.matFromArray(3, 3, cv.CV_64F, mul3(band.toBand, sourceToLane));
      cv.warpPerspective(source, band.image, m, band.size, cv.INTER_LINEAR, cv.BORDER_REPLICATE);
      m.delete();
      band.bg.apply(band.image, band.fg, -1);
      // MOG2 marks shadows 127, real foreground 255
      cv.threshold(band.fg, band.fg, 200, 255, cv.THRESH_BINARY);
      cv.bitwise_and(band.fg, band.mask, band.fg);
      cv.morphologyEx(band.fg, band.fg, cv.MORPH_OPEN, this.kernel);
      cv.morphologyEx(band.fg, band.fg, cv.MORPH_CLOSE, this.kernel);
      const n = cv.connectedComponentsWithStats(band.fg, band.labels, band.stats, band.centroids, 8, cv.CV_32S);
      if (n > 1) detections.push(...this.ballsIn(band, n, frame, t));
    }
    return detections;
  }

  dispose(): void {
    for (const b of this.bands) release(b.mask, b.bg, b.image, b.fg, b.labels, b.stats, b.centroids);
    this.bands.length = 0;
    release(this.kernel);
  }

  private ballsIn(band: Band, n: number, frame: number, t: number): Detection[] {
    const s = band.stats.data32S as Int32Array;
    const width = band.size.width;
    const height = band.size.height;
    const labels = band.labels.data32S as Int32Array;
    // fragments, with the ball size expected where they touch the lane
    const parts: { area: number; d: number; x0: number; x1: number; y0: number; y1: number }[] = [];
    const partOf = new Int32Array(n).fill(-1);
    for (let i = 1; i < n; i++) {
      const [x, y, w, h, area] = [s[5 * i], s[5 * i + 1], s[5 * i + 2], s[5 * i + 3], s[5 * i + 4]];
      if (area < 3) continue;
      const [, ly] = band.lane.toLane([x + w / 2, y + h]);
      const d = band.lane.ballSizePx(Math.min(Math.max(ly, this.startIn), this.endIn));
      if (!(d > 0)) continue;
      partOf[i] = parts.length;
      parts.push({ x0: x, y0: y, x1: x + w, y1: y + h, area, d });
    }
    if (parts.length === 0) return [];
    // fragments close to each other are one object while together they still fit a ball, nearest pairs first
    const parent = parts.map((_, i) => i);
    const root = (i: number): number => (parent[i] === i ? i : (parent[i] = root(parent[i])));
    const boxes = parts.map((p) => ({ ...p }));
    if (parts.length <= 200) {
      const pairs: [number, number, number][] = [];
      for (let i = 0; i < parts.length; i++) {
        for (let j = i + 1; j < parts.length; j++) {
          const a = parts[i];
          const b = parts[j];
          const dx = Math.max(0, b.x0 - a.x1, a.x0 - b.x1);
          const dy = Math.max(0, b.y0 - a.y1, a.y0 - b.y1);
          const gap = Math.max(dx, dy);
          if (gap <= GROUP_GAP * Math.max(a.d, b.d)) pairs.push([gap, i, j]);
        }
      }
      pairs.sort((p, q) => p[0] - q[0]);
      for (const [, i, j] of pairs) {
        const ri = root(i);
        const rj = root(j);
        if (ri === rj) continue;
        const a = boxes[ri];
        const b = boxes[rj];
        const merged = {
          x0: Math.min(a.x0, b.x0),
          y0: Math.min(a.y0, b.y0),
          x1: Math.max(a.x1, b.x1),
          y1: Math.max(a.y1, b.y1),
          area: a.area + b.area,
          d: Math.max(a.d, b.d),
        };
        if (merged.x1 - merged.x0 > GROUP_MAX_WIDTH * merged.d || merged.y1 - merged.y0 > GROUP_MAX_HEIGHT * merged.d) continue;
        parent[ri] = rj;
        boxes[rj] = merged;
      }
    }
    const groups = new Map<number, { area: number; d: number; x0: number; x1: number; y0: number; y1: number }>();
    parts.forEach((_, i) => groups.set(root(i), boxes[root(i)]));
    const groupOfLabel = new Int32Array(n).fill(-1);
    for (let i = 1; i < n; i++) if (partOf[i] >= 0) groupOfLabel[i] = root(partOf[i]);

    const detections: Detection[] = [];
    const clamp = (yIn: number) => Math.min(Math.max(yIn, this.startIn), this.endIn);
    for (const [id, g] of groups) {
      const w = g.x1 - g.x0;
      const h = g.y1 - g.y0;
      // never much wider than tall: lane-wide flicker
      if (h < 0.6 * w || g.area < 6) continue;
      // The object's top is the ball's top (a reflection or shadow hangs below the ball, nothing sits on it),
      // and the ball touches the lane a ball's height lower, where the ball has that size. Its size is solved
      // for from the top: from the object's bottom a reflection would make it too big and put the ball too
      // low, and near the pins a pixel is several inches of lane.
      const middle = (g.x0 + g.x1) / 2;
      let d = g.d;
      for (let k = 0; k < 4; k++) {
        const next = band.lane.ballSizePx(clamp(band.lane.toLane([middle, g.y0 - 0.5 + d])[1]));
        if (!(next > 0)) break;
        const settled = Math.abs(next - d) < 0.25;
        d = next;
        if (settled) break;
      }
      const ratio = w / d;
      if (ratio < this.minRatio || ratio > this.maxRatio) continue;
      // sideways, the ball is where a disc of its size covers the most of the object
      const top = g.y0 - 0.5;
      const disc = fitDiscX(labels, groupOfLabel, id, width, height, g, top + d / 2, d);
      if (!disc || disc.fill < MIN_DISC_FILL) continue;
      const contactBand: Point = [disc.cx, top + d];
      const contact = applyHomography(band.fromBand, contactBand[0], contactBand[1]);
      const [lx, ly] = this.lane.toLane(contact);
      if (!(band.fromIn <= ly && (ly < band.toIn || (band.toIn >= this.endIn && ly <= this.endIn)))) continue;
      if (!(-4 <= lx && lx <= 45.5)) continue;
      const below = band.lane.toLane([contactBand[0], contactBand[1] - 1]);
      const aside = band.lane.toLane([contactBand[0] + 1, contactBand[1]]);
      detections.push({
        frame,
        t,
        xIn: lx,
        yIn: ly,
        sizeRatio: ratio,
        px: contact,
        sigmaYIn: Math.max(0.5, Math.abs(below[1] - ly)),
        sigmaXIn: Math.abs(aside[0] - lx),
      });
    }
    return detections;
  }
}

/** Distance bands for detection, from the pins down, each with the scale that keeps the ball at most {@link MAX_BALL_PX}. */
export function detectionBands(lane: LaneCalibration, startIn: number, endIn: number): { fromIn: number; scale: number; toIn: number }[] {
  const size = (yIn: number) => lane.ballSizePx(yIn);
  const scaleFor = (biggest: number) => Math.min(1, MAX_BALL_PX / Math.max(1e-6, biggest));
  const bands: { fromIn: number; scale: number; toIn: number }[] = [];
  let far = endIn;
  while (far > startIn + 1e-6) {
    const limit = BAND_SIZE_RATIO * size(far);
    let near = startIn;
    if (size(startIn) > LAST_BAND_RATIO * size(far)) {
      // the ball grows towards the foul line: the distance where it is BAND_SIZE_RATIO times as big
      let lo = startIn;
      let hi = far;
      for (let k = 0; k < 40; k++) {
        const mid = (lo + hi) / 2;
        if (size(mid) > limit) lo = mid;
        else hi = mid;
      }
      near = hi;
    }
    const scale = scaleFor(size(near));
    const previous = bands[bands.length - 1];
    // bands at the same scale (full resolution) are one band
    if (previous && Math.abs(previous.scale - scale) < 1e-9) previous.fromIn = near;
    else bands.push({ fromIn: near, toIn: far, scale });
    far = near;
  }
  return bands;
}

/**
 * Where along a row of centres (height `cy`) a disc of diameter `d` covers the most of one object's
 * foreground (its labels mapped to `group`), with the share of the disc it covers. Sub-pixel by a parabola
 * through the scores; the middle of a plateau when a fragment narrower than the ball fits anywhere in it.
 */
function fitDiscX(
  labels: Int32Array,
  groupOfLabel: Int32Array,
  group: number,
  width: number,
  height: number,
  box: { x0: number; x1: number },
  cy: number,
  d: number,
): { cx: number; fill: number } | null {
  const r = d / 2;
  const y0 = Math.max(0, Math.ceil(cy - r));
  const y1 = Math.min(height - 1, Math.floor(cy + r));
  const wx0 = Math.max(0, Math.floor(box.x0 - r) - 2);
  const wx1 = Math.min(width, Math.ceil(box.x1 + r) + 2);
  const ww = wx1 - wx0;
  if (y1 < y0 || ww <= 0) return null;
  // prefix sums along each row of the object's pixels
  const stride = ww + 1;
  const pre = new Int32Array((y1 - y0 + 1) * stride);
  const half = new Float64Array(y1 - y0 + 1);
  for (let y = y0; y <= y1; y++) {
    const row = y * width + wx0;
    const at = (y - y0) * stride;
    let sum = 0;
    for (let x = 0; x < ww; x++) {
      const label = labels[row + x];
      if (label > 0 && groupOfLabel[label] === group) sum++;
      pre[at + x + 1] = sum;
    }
    half[y - y0] = Math.sqrt(Math.max(0, r * r - (y - cy) ** 2));
  }
  const score = (cx: number) => {
    let total = 0;
    for (let k = 0; k < half.length; k++) {
      const a = Math.max(0, Math.ceil(cx - half[k]) - wx0);
      const b = Math.min(ww, Math.floor(cx + half[k]) - wx0 + 1);
      if (b > a) total += pre[k * stride + b] - pre[k * stride + a];
    }
    return total;
  };
  const lo = Math.round(box.x0 - d / 4);
  const hi = Math.round(box.x1 + d / 4);
  let best = -1;
  let bx = lo;
  for (let cx = lo; cx <= hi; cx++) {
    const v = score(cx);
    if (v > best) {
      best = v;
      bx = cx;
    }
  }
  if (best <= 0) return null;
  let right = bx;
  while (right + 1 <= hi && score(right + 1) === best) right++;
  const cx = right > bx ? (bx + right) / 2 : bx + peakOffset(score(bx - 1), best, score(bx + 1));
  return { cx, fill: best / (Math.PI * r * r) };
}

/** Offset of a parabola's peak through three equally spaced values (the middle one the largest). */
function peakOffset(before: number, at: number, after: number): number {
  const curvature = before - 2 * at + after;
  return curvature < 0 ? Math.max(-0.5, Math.min(0.5, (before - after) / (2 * curvature))) : 0;
}
