/** Ball detection by background subtraction (port of the BallTracker's `detector.py`). */
import { LaneCalibration } from '../geometry/lane.utils';
import { Cv, release } from '../video/opencv.utils';
import { Detection } from './ball-tracker.utils';

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
