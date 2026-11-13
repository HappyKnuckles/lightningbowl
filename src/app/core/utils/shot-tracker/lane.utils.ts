/**
 * Lane geometry and image <-> lane mapping (port of the BallTracker's `lane.py`).
 *
 * Lane coordinates, in inches: x from the RIGHT gutter edge (0) to the left edge (LANE_WIDTH_IN), as a
 * bowler on the approach sees it; y from the foul line (0) down to the head pin (60 ft).
 */
import { applyHomography, homographyFrom4, invert3, Mat3, mul3 } from './math.utils';

export const LANE_WIDTH_IN = 41.5;
export const LANE_LENGTH_FT = 60;
export const LANE_LENGTH_IN = LANE_LENGTH_FT * 12;
export const BOARD_COUNT = 39;
export const BOARD_WIDTH_IN = LANE_WIDTH_IN / BOARD_COUNT;
export const BALL_DIAMETER_IN = 8.5;
export const ARROWS_FT = 15;

export type Handedness = 'right' | 'left';
export type Point = [number, number];

/** Fractional board number for a lateral position; board 1 is the bowler's gutter-side board. */
export function xToBoard(xIn: number, handedness: Handedness): number {
  const fromGutter = handedness === 'right' ? xIn : LANE_WIDTH_IN - xIn;
  return fromGutter / BOARD_WIDTH_IN + 0.5;
}

/** Homography between the image and the lane plane, from the four tapped lane edge points. */
export class LaneCalibration {
  constructor(
    readonly imageToLane: Mat3,
    readonly laneToImage: Mat3,
    readonly farDistanceIn: number,
  ) {}

  static fromPoints(foulRight: Point, foulLeft: Point, farRight: Point, farLeft: Point, farDistanceFt: number): LaneCalibration {
    if (farDistanceFt <= 0) throw new Error('farDistanceFt must be positive');
    const farIn = farDistanceFt * 12;
    const h = homographyFrom4(
      [foulRight, foulLeft, farLeft, farRight],
      [
        [0, 0],
        [LANE_WIDTH_IN, 0],
        [LANE_WIDTH_IN, farIn],
        [0, farIn],
      ],
    );
    return new LaneCalibration(h, invert3(h), farIn);
  }

  /** The same lane in an image mapped by `imageToImage` (e.g. into a crop). */
  through(imageToImage: Mat3): LaneCalibration {
    return new LaneCalibration(mul3(this.imageToLane, invert3(imageToImage)), mul3(imageToImage, this.laneToImage), this.farDistanceIn);
  }

  toLane(px: Point): Point {
    return applyHomography(this.imageToLane, px[0], px[1]);
  }

  toImage(lane: Point): Point {
    return applyHomography(this.laneToImage, lane[0], lane[1]);
  }

  /** Apparent ball width in pixels at a lane distance, measured at the lane centre. */
  ballSizePx(yIn: number): number {
    const a = this.toImage([LANE_WIDTH_IN / 2 - BALL_DIAMETER_IN / 2, yIn]);
    const b = this.toImage([LANE_WIDTH_IN / 2 + BALL_DIAMETER_IN / 2, yIn]);
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
  }

  /**
   * Corners of the lane surface between two distances (image space), the far edge lifted by a little more
   * than a ball height: the ball sits on its contact point, so near `yToIn` its body reaches above the lane end.
   */
  lanePolygon(yFromIn: number, yToIn: number, marginIn = 2): Point[] {
    const poly = [
      this.toImage([-marginIn, yFromIn]),
      this.toImage([LANE_WIDTH_IN + marginIn, yFromIn]),
      this.toImage([LANE_WIDTH_IN + marginIn, yToIn]),
      this.toImage([-marginIn, yToIn]),
    ];
    const lift = 1.3 * this.ballSizePx(yToIn);
    poly[2][1] -= lift;
    poly[3][1] -= lift;
    return poly.map(([x, y]) => [Math.round(x), Math.round(y)] as Point);
  }
}
