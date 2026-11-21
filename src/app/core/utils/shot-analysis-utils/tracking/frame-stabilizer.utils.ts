/** Frame stabilization for handheld videos (port of the BallTracker's `stabilizer.py`). */
import { IDENTITY, Mat3, mul3 } from '../geometry/math.utils';
import { Cv, release } from '../video/opencv.utils';

const toMat3 = (cv: Cv, m: Cv): Mat3 => Array.from(m.data64F as Float64Array) as Mat3;

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
