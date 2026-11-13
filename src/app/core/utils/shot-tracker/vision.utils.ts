/**
 * The image side of the tracker: ball detection by background subtraction and frame stabilization (ports of
 * the BallTracker's `detector.py` and `stabilizer.py`).
 */
import { LaneCalibration } from './lane.utils';
import { IDENTITY, Mat3, mul3 } from './math.utils';
import { Cv, release } from './opencv.utils';
import { Detection } from './tracker.utils';

const toMat3 = (cv: Cv, m: Cv): Mat3 => Array.from(m.data64F as Float64Array) as Mat3;

/** Ball candidates: round-ish foreground blobs on the lane whose width fits the ball at their distance. */
export class BallDetector {
  private readonly mask: Cv;
  private readonly bg: Cv;
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
    this.mask = cv.Mat.zeros(height, width, cv.CV_8UC1);
    const poly = lane.lanePolygon(startIn, endIn);
    const points = cv.matFromArray(4, 1, cv.CV_32SC2, poly.flat());
    cv.fillConvexPoly(this.mask, points, new cv.Scalar(255));
    points.delete();
    this.bg = new cv.BackgroundSubtractorMOG2(150, 28, true);
    this.kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));
  }

  detect(frameRgb: Cv, frame: number, t: number): Detection[] {
    const cv = this.cv;
    const fg = new cv.Mat();
    const labels = new cv.Mat();
    const stats = new cv.Mat();
    const centroids = new cv.Mat();
    try {
      this.bg.apply(frameRgb, fg, -1);
      // MOG2 marks shadows 127, real foreground 255
      cv.threshold(fg, fg, 200, 255, cv.THRESH_BINARY);
      cv.bitwise_and(fg, this.mask, fg);
      cv.morphologyEx(fg, fg, cv.MORPH_OPEN, this.kernel);
      cv.morphologyEx(fg, fg, cv.MORPH_CLOSE, this.kernel, new cv.Point(-1, -1), 2);
      const n = cv.connectedComponentsWithStats(fg, labels, stats, centroids, 8, cv.CV_32S);
      const s = stats.data32S as Int32Array;
      const detections: Detection[] = [];
      for (let i = 1; i < n; i++) {
        const [x, y, w, h, area] = [s[5 * i], s[5 * i + 1], s[5 * i + 2], s[5 * i + 3], s[5 * i + 4]];
        if (area < 6) continue;
        const ballH = Math.min(h, w); // a reflection hanging below the ball doesn't count
        const contact: [number, number] = [x + w / 2, y + ballH - 0.5];
        const [lx, ly] = this.lane.toLane(contact);
        if (!(this.startIn <= ly && ly <= this.endIn) || !(-4 <= lx && lx <= 45.5)) continue;
        const expected = this.lane.ballSizePx(ly);
        if (expected <= 0) continue;
        const ratio = w / expected;
        if (ratio < this.minRatio || ratio > this.maxRatio) continue;
        if (h < 0.6 * w) continue; // never much wider than tall: filters lane-wide flicker
        if (area / (w * h) < 0.3) continue;
        const below = this.lane.toLane([contact[0], contact[1] - 1]);
        detections.push({ frame, t, xIn: lx, yIn: ly, sizeRatio: ratio, px: contact, sigmaYIn: Math.max(0.5, Math.abs(below[1] - ly)) });
      }
      return detections;
    } finally {
      release(fg, labels, stats, centroids);
    }
  }

  dispose(): void {
    release(this.mask, this.bg, this.kernel);
  }
}

const MIN_MATCHES = 12;
const MAX_CORNERS = 400;
const MIN_TRACKED = 40;

/**
 * Aligns handheld frames to the reference frame: feature matching on an anchor frame every `anchorEvery`
 * frames, optical flow on corners in between, each frame fitted to the corners' positions in the anchor
 * frame. Works on downscaled grey frames; homographies are in those pixels.
 *
 * The server matches anchors with SIFT, which OpenCV's WebAssembly build doesn't include; this uses ORB.
 */
export class FrameStabilizer {
  private readonly orb: Cv;
  private readonly matcher: Cv;
  private readonly refKp: Cv;
  private readonly refDes: Cv;
  private readonly none: Cv;
  private prev: Cv = null;
  private pts: Float32Array | null = null;
  private anchorPts: Float32Array | null = null;
  private anchorH: Mat3 | null = null;
  private sinceAnchor = 0;

  constructor(
    private readonly cv: Cv,
    referenceGray: Cv,
    private readonly anchorEvery = 15,
  ) {
    this.orb = new cv.ORB(3000);
    this.matcher = new cv.BFMatcher(cv.NORM_HAMMING);
    this.refKp = new cv.KeyPointVector();
    this.refDes = new cv.Mat();
    this.none = new cv.Mat();
    this.orb.detectAndCompute(referenceGray, this.none, this.refKp, this.refDes);
  }

  /** Homography from this frame to the reference (downscaled pixels), or null if it couldn't be aligned. */
  track(gray: Cv): Mat3 | null {
    let h = this.pts && this.sinceAnchor < this.anchorEvery ? this.flow(gray) : null;
    if (h) {
      this.sinceAnchor++;
    } else {
      h = this.anchor(gray);
    }
    release(this.prev);
    this.prev = gray.clone();
    return h;
  }

  dispose(): void {
    release(this.orb, this.matcher, this.refKp, this.refDes, this.none, this.prev);
  }

  private fit(src: number[] | Float32Array, dst: number[] | Float32Array, minInliers: number): { h: Mat3; inliers: Uint8Array } | null {
    const cv = this.cv;
    const a = cv.matFromArray(src.length / 2, 1, cv.CV_32FC2, Array.from(src));
    const b = cv.matFromArray(dst.length / 2, 1, cv.CV_32FC2, Array.from(dst));
    const mask = new cv.Mat();
    const h = cv.findHomography(a, b, cv.RANSAC, 2.0, mask);
    try {
      if (h.empty() || mask.empty()) return null;
      const inliers = Uint8Array.from(mask.data as Uint8Array);
      if (inliers.reduce((sum, v) => sum + (v ? 1 : 0), 0) < minInliers) return null;
      return { h: toMat3(cv, h), inliers };
    } finally {
      release(a, b, mask, h);
    }
  }

  private matchReference(gray: Cv): Mat3 | null {
    const cv = this.cv;
    if (this.refDes.rows < MIN_MATCHES) return null;
    const kp = new cv.KeyPointVector();
    const des = new cv.Mat();
    const pairs = new cv.DMatchVectorVector();
    try {
      this.orb.detectAndCompute(gray, this.none, kp, des);
      if (des.rows < MIN_MATCHES) return null;
      this.matcher.knnMatch(des, this.refDes, pairs, 2);
      const src: number[] = [];
      const dst: number[] = [];
      for (let i = 0; i < pairs.size(); i++) {
        const pair = pairs.get(i);
        if (pair.size() === 2 && pair.get(0).distance < 0.75 * pair.get(1).distance) {
          const m = pair.get(0);
          const p = kp.get(m.queryIdx).pt;
          const q = this.refKp.get(m.trainIdx).pt;
          src.push(p.x, p.y);
          dst.push(q.x, q.y);
        }
      }
      if (src.length / 2 < MIN_MATCHES) return null;
      return this.fit(src, dst, MIN_MATCHES)?.h ?? null;
    } finally {
      release(kp, des, pairs);
    }
  }

  private anchor(gray: Cv): Mat3 | null {
    const cv = this.cv;
    const h = this.matchReference(gray);
    this.pts = null;
    if (!h) return null;
    const corners = new cv.Mat();
    cv.goodFeaturesToTrack(gray, corners, MAX_CORNERS, 0.01, 8);
    if (corners.rows >= MIN_TRACKED) {
      this.pts = Float32Array.from(corners.data32F as Float32Array);
      this.anchorPts = Float32Array.from(this.pts);
      this.anchorH = h;
      this.sinceAnchor = 0;
    }
    corners.delete();
    return h;
  }

  private flow(gray: Cv): Mat3 | null {
    const cv = this.cv;
    const from = cv.matFromArray(this.pts!.length / 2, 1, cv.CV_32FC2, Array.from(this.pts!));
    const to = new cv.Mat();
    const status = new cv.Mat();
    const err = new cv.Mat();
    try {
      cv.calcOpticalFlowPyrLK(this.prev, gray, from, to, status, err, new cv.Size(21, 21), 3);
      const cur: number[] = [];
      const anchored: number[] = [];
      for (let i = 0; i < status.rows; i++) {
        if (status.data[i] === 1) {
          cur.push(to.data32F[2 * i], to.data32F[2 * i + 1]);
          anchored.push(this.anchorPts![2 * i], this.anchorPts![2 * i + 1]);
        }
      }
      if (cur.length / 2 < MIN_TRACKED) return null;
      const fitted = this.fit(cur, anchored, MIN_TRACKED);
      if (!fitted) return null;
      // corners off the static scene (bowler, ball) are RANSAC outliers: stop following them
      const keptCur: number[] = [];
      const keptAnchor: number[] = [];
      fitted.inliers.forEach((ok, i) => {
        if (ok) {
          keptCur.push(cur[2 * i], cur[2 * i + 1]);
          keptAnchor.push(anchored[2 * i], anchored[2 * i + 1]);
        }
      });
      this.pts = Float32Array.from(keptCur);
      this.anchorPts = Float32Array.from(keptAnchor);
      return mul3(this.anchorH ?? IDENTITY, fitted.h);
    } finally {
      release(from, to, status, err);
    }
  }
}
