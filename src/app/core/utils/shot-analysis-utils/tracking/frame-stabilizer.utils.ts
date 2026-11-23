/** Frame alignment for handheld videos (descendant of the BallTracker's `stabilizer.py`). */
import { applyHomography, fitHomography, IDENTITY, invert3, Mat3, seededRandom } from '../geometry/math.utils';
import { Cv, release } from '../video/opencv.utils';

/** Corners of the reference frame that are followed into every frame. */
const FLOW_CORNERS = 200;
const FLOW_WINDOW = 15;
const FLOW_LEVELS = 2;
/** RANSAC tolerance (px of the grey frames): the flow is sub-pixel, a tight tolerance keeps only the static scene. */
const FLOW_TOLERANCE_PX = 1;
const MIN_INLIERS = 24;
const ORB_FEATURES = 3000;
const MIN_MATCHES = 12;

/**
 * Aligns handheld frames to the reference frame (the one the lane was marked on). The reference frame's
 * corners are followed into every frame with pyramidal optical flow, starting from where the previous
 * frame's alignment puts them, and the frame is fitted to them. Every frame is measured against the
 * reference itself, with sub-pixel corners, so the alignment neither drifts nor jumps (re-anchoring on
 * matched features every few frames moved the far end of the lane by a board at a time). Feature matching
 * (ORB) only finds the frame again when the flow loses it, e.g. after a fast swing of the phone.
 *
 * Works on grey frames of any scale; homographies are in their pixels.
 */
export class FrameStabilizer {
  private readonly reference: Cv;
  private readonly corners: Float32Array;
  private readonly criteria: Cv;
  private last: Mat3 = IDENTITY;
  private orb: { descriptors: Cv; detector: Cv; keypoints: Cv; matcher: Cv; none: Cv } | null = null;
  private fits = 0;

  constructor(
    private readonly cv: Cv,
    referenceGray: Cv,
  ) {
    this.reference = referenceGray.clone();
    const corners = new cv.Mat();
    cv.goodFeaturesToTrack(referenceGray, corners, FLOW_CORNERS, 0.01, 6);
    this.corners = Float32Array.from(corners.data32F as Float32Array);
    corners.delete();
    this.criteria = new cv.TermCriteria(cv.TermCriteria_COUNT + cv.TermCriteria_EPS, 20, 0.03);
  }

  /** Homography from this frame to the reference (grey frame pixels), or null if it couldn't be aligned. */
  track(gray: Cv): Mat3 | null {
    const h = this.followCorners(gray) ?? this.matchReference(gray);
    if (h) this.last = h;
    return h;
  }

  dispose(): void {
    release(this.reference);
    if (this.orb) release(this.orb.detector, this.orb.matcher, this.orb.keypoints, this.orb.descriptors, this.orb.none);
    this.orb = null;
  }

  private followCorners(gray: Cv): Mat3 | null {
    const cv = this.cv;
    const n = this.corners.length / 2;
    if (n < MIN_INLIERS) return null;
    const toFrame = invert3(this.last);
    const guess = new Float32Array(2 * n);
    for (let i = 0; i < n; i++) {
      const [x, y] = applyHomography(toFrame, this.corners[2 * i], this.corners[2 * i + 1]);
      guess[2 * i] = x;
      guess[2 * i + 1] = y;
    }
    const from = cv.matFromArray(n, 1, cv.CV_32FC2, this.corners);
    const to = cv.matFromArray(n, 1, cv.CV_32FC2, guess);
    const status = new cv.Mat();
    const err = new cv.Mat();
    try {
      const win = new cv.Size(FLOW_WINDOW, FLOW_WINDOW);
      cv.calcOpticalFlowPyrLK(this.reference, gray, from, to, status, err, win, FLOW_LEVELS, this.criteria, cv.OPTFLOW_USE_INITIAL_FLOW);
      const found = to.data32F as Float32Array;
      const ok = status.data as Uint8Array;
      const src: number[] = [];
      const dst: number[] = [];
      for (let i = 0; i < n; i++) {
        if (ok[i] !== 1) continue;
        src.push(found[2 * i], found[2 * i + 1]);
        dst.push(this.corners[2 * i], this.corners[2 * i + 1]);
      }
      return src.length / 2 >= MIN_INLIERS ? this.fit(src, dst, FLOW_TOLERANCE_PX, MIN_INLIERS) : null;
    } finally {
      release(from, to, status, err);
    }
  }

  /** The frame found again by matching ORB features against the reference (set up on first use). */
  private matchReference(gray: Cv): Mat3 | null {
    const cv = this.cv;
    if (!this.orb) {
      const detector = new cv.ORB(ORB_FEATURES);
      const keypoints = new cv.KeyPointVector();
      const descriptors = new cv.Mat();
      const none = new cv.Mat();
      detector.detectAndCompute(this.reference, none, keypoints, descriptors);
      this.orb = { detector, keypoints, descriptors, none, matcher: new cv.BFMatcher(cv.NORM_HAMMING) };
    }
    const { detector, keypoints: refKp, descriptors: refDes, none, matcher } = this.orb;
    if (refDes.rows < MIN_MATCHES) return null;
    const kp = new cv.KeyPointVector();
    const des = new cv.Mat();
    const pairs = new cv.DMatchVectorVector();
    try {
      detector.detectAndCompute(gray, none, kp, des);
      if (des.rows < MIN_MATCHES) return null;
      matcher.knnMatch(des, refDes, pairs, 2);
      const src: number[] = [];
      const dst: number[] = [];
      for (let i = 0; i < pairs.size(); i++) {
        const pair = pairs.get(i);
        if (pair.size() === 2 && pair.get(0).distance < 0.75 * pair.get(1).distance) {
          const m = pair.get(0);
          const p = kp.get(m.queryIdx).pt;
          const q = refKp.get(m.trainIdx).pt;
          src.push(p.x, p.y);
          dst.push(q.x, q.y);
        }
      }
      // ORB keypoints aren't sub-pixel: a looser tolerance
      return src.length / 2 >= MIN_MATCHES ? this.fit(src, dst, 2, MIN_MATCHES) : null;
    } finally {
      release(kp, des, pairs);
    }
  }

  private fit(src: number[], dst: number[], tolerance: number, minInliers: number): Mat3 | null {
    return fitHomography(src, dst, tolerance, minInliers, seededRandom(this.fits++))?.h ?? null;
  }
}
