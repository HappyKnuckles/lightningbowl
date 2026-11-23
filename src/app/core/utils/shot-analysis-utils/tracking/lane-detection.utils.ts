/**
 * Finds the bowler's lane on the frame the corners are marked on, so the four corners can be placed for
 * the bowler to correct rather than tap.
 *
 * 1. Edges: all lane and gutter edges run parallel down the alley, so in the picture they meet in one
 *    vanishing point. That point is found from the frame's straight lines (RANSAC over pairs of them); the
 *    segments running towards it are grouped into edges, and each edge is fitted to its own segments (near
 *    the pins a few pixels off the vanishing point would move an edge by boards).
 * 2. The lane: a left and a right edge with the bright lane wood between them and darker gutters outside.
 *    Near the pins all edges converge, so lanes are told apart by how many rows they are seen over: the
 *    nearest lanes the most, the capping between two gutters only a few. Of those, the one in the middle
 *    of the frame is the bowler's (the video is filmed from behind them).
 * 3. The pins: the head pin's base is where the white pins meet their reflection on the oily lane, the
 *    axis the pins are mirrored about. That is 60 ft.
 * 4. The foul line: walking down the lane from the pins, where the gutters beside it end.
 */
import { NormalizedPoint } from 'src/app/core/models/shot-analysis.model';

import { LANE_WIDTH_IN, LaneCalibration, Point } from '../geometry/lane.utils';
import { seededRandom } from '../geometry/math.utils';
import { Cv, loadOpenCv, release } from '../video/opencv.utils';

export type LaneSide = 'left' | 'right';

type Line = [number, number, number];

/** A frame's edges that run down the alley, in the pixels of `gray`. */
export interface LaneLines {
  /** The edges as lines `a·x + b·y + c = 0`, left to right. */
  edges: Line[];
  /** The frame in grey, for telling lane from gutter. */
  gray: Uint8Array;
  height: number;
  /** Where the edges meet. */
  vanishing: Point;
  width: number;
}

/** Frames are analysed at most this large (the longer side); a 4K frame is no more precise for this. */
export const LANE_DETECTION_MAX_PX = 1920;

const MIN_SEGMENT_SHARE = 0.04;
const RANSAC_ROUNDS = 1500;
/** How close (px) a segment's line has to pass by the vanishing point to count for it. */
const VANISHING_TOLERANCE_PX = 6;
/** How close (px) a segment's line has to pass by the vanishing point to run towards it. */
const EDGE_TOLERANCE_PX = 15;
/** Segments whose directions from the vanishing point differ by less than this (radians) are one edge. */
const SAME_EDGE_RAD = (0.2 * Math.PI) / 180;
/** How much brighter the lane has to be than what's beside it to count as a lane edge. */
const MIN_LANE_CONTRAST = 15;
/** How much brighter the lane's middle has to be than just outside its edges. */
const MIN_LANE_LIGHTER = 10;
/** Rows checked for lanes, this far apart (px). */
const LANE_ROW_STEP = 6;
/** A lane is at least this share as wide as the widest lane found. */
const MIN_WIDTH_SHARE = 0.6;
/** A lane has to be seen over at least half as many rows as the lane seen over the most. */
const MIN_ROW_SHARE = 0.5;
/** Pins: white is barely coloured (HSV saturation, 0–255) and clearly brighter than the lane's wood. */
const PIN_MAX_SATURATION = 60;
const PIN_MIN_BRIGHTER = 40;
/** The pins are searched in the top part of the lane, this share of the way from the vanishing point to the frame's bottom. */
const PIN_SEARCH_SHARE = 0.3;
const PIN_MIRROR_MAX_ROWS = 40;
/** Pins and reflection have to mirror each other at least this well (correlation) to be taken as such. */
const MIN_MIRROR_CORRELATION = 0.6;
/** The pins' reflection is at least this much dimmer (grey levels) than the pins. */
const MIN_REFLECTION_DIMMER = 2;
/** Rows with at least this share of white across the lane are pins (without a reflection to go by). */
const MIN_PIN_SHARE = 0.15;
/** The pins' lowest row has at least this share of the white of their whitest row. */
const PIN_BASE_SHARE = 0.25;
/** A gutter is darker than the lane by at least this much. */
const MIN_GUTTER_DARKNESS = 25;
/** The gutters have ended once this many rows in a row aren't dark. */
const GUTTER_END_ROWS = 8;
/** A gutter's middle, as a share of the lane's width out from its edge (9.25" gutters, 41.5" lane). */
const GUTTER_MIDDLE_SHARE = 0.11;

/** A found lane shorter than this (px from pins to foul line) isn't trusted. */
const MIN_LANE_HEIGHT_PX = 20;

/** A marked lane edge is searched for this far (inches across the lane) to either side, about 4 boards. */
export const EDGE_SEARCH_IN = 4;
/** Points the edge is measured at, evenly along it; fewer on a short edge (one per 2 px). */
const EDGE_SAMPLES = 300;
/** The part of the lane the edges are measured along (ft): not beside the approach, not beside the pins. */
const EDGE_FROM_FT = 2;
const EDGE_TO_FT_BEFORE_FAR = 2;
/** An edge point is on the fitted line within this much of a board's width (at least half a pixel). */
const EDGE_INLIER_IN = 0.25;
/** The brightness step at an edge point is at least this many grey levels over a pixel. */
const MIN_EDGE_STEP = 4;
/**
 * An edge is only moved when its step is found on the fitted line in this share of the cuts across it, in
 * the near and the middle third of it and in the far third (where reflections of the back wall run along
 * the lane like edges do).
 */
const MIN_EDGE_SUPPORT = 0.6;
const MIN_FAR_EDGE_SUPPORT = 0.4;

/** The lane's corners in the order they are marked (foul left, foul right, far left, far right), as shares of the frame. */
export type LaneCorners = [NormalizedPoint, NormalizedPoint, NormalizedPoint, NormalizedPoint];

/**
 * The edges running down the alley on a grey frame, or null when too few straight lines meet in one point
 * (e.g. the lane isn't in view).
 */
export function detectLaneLines(cv: Cv, gray: Cv): LaneLines | null {
  const blurred = new cv.Mat();
  const canny = new cv.Mat();
  const found = new cv.Mat();
  try {
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
    // sensitive settings: an edge that is missed can't be found again, extra lines cost little
    cv.Canny(blurred, canny, 30, 90);
    cv.HoughLinesP(canny, found, 1, Math.PI / 360, 40, gray.rows * MIN_SEGMENT_SHARE, 16);
    const segments = segmentsRunningAway(found.data32S as Int32Array, gray.rows);
    const vanishing = vanishingPoint(segments, gray.cols, gray.rows);
    if (!vanishing) return null;
    const pixels = Uint8Array.from(gray.data as Uint8Array);
    const edges = fitEdges(segments, vanishing);
    if (edges.length < 2) return null;
    return { vanishing, edges, gray: pixels, width: gray.cols, height: gray.rows };
  } finally {
    release(blurred, canny, found);
  }
}

/**
 * The bowler's lane on an RGBA frame: its four corners, the far ones at the head pin (60 ft). Null when
 * no lane with its pins and foul line is found.
 */
export function findLaneCorners(cv: Cv, rgba: Cv): LaneCorners | null {
  const gray = new cv.Mat();
  try {
    cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);
    const lines = detectLaneLines(cv, gray);
    if (!lines) return null;
    const lane = bowlersLane(lines);
    if (!lane) return null;
    const [left, right] = lane;
    const farY = headPinY(lines, whiteMask(rgba.data as Uint8Array, laneWood(lines, left, right) + PIN_MIN_BRIGHTER), left, right);
    if (farY === null) return null;
    const foulY = foulLineY(lines, left, right, farY);
    const at = (line: Line, y: number): NormalizedPoint => [xAt(line, y) / lines.width, y / lines.height];
    const corners: LaneCorners = [at(left, foulY), at(right, foulY), at(left, farY), at(right, farY)];
    // corners that can't be a lane (outside the frame, the far end wider than the near one) mean
    // something else was taken for it: better to have the bowler mark it
    const inFrame = corners.every(([x, y]) => x >= 0 && x <= 1 && y >= 0 && y <= 1);
    const narrowing = corners[3][0] - corners[2][0] < corners[1][0] - corners[0][0];
    return inFrame && narrowing && foulY - farY >= MIN_LANE_HEIGHT_PX ? corners : null;
  } finally {
    release(gray);
  }
}

/**
 * The lane corners on the frame a `<video>` shows right now (loads OpenCV on first use). Null when no
 * lane is found or the frame can't be read.
 */
export async function findLaneCornersInVideo(video: HTMLVideoElement): Promise<LaneCorners | null> {
  if (!video.videoWidth || !video.videoHeight) return null;
  const cv = await loadOpenCv();
  const scale = Math.min(1, LANE_DETECTION_MAX_PX / Math.max(video.videoWidth, video.videoHeight));
  const width = Math.round(video.videoWidth * scale);
  const height = Math.round(video.videoHeight * scale);
  const ctx = new OffscreenCanvas(width, height).getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, width, height);
  const rgba = cv.matFromImageData(ctx.getImageData(0, 0, width, height));
  try {
    return findLaneCorners(cv, rgba);
  } finally {
    release(rgba);
  }
}

/** A grey image as plain pixels, row by row. */
export interface GrayImage {
  data: Uint8Array;
  height: number;
  width: number;
}

/** A marked lane with its long edges moved onto those in the picture. */
export interface RefinedLane {
  /** The lane with its edges where they were found; the foul line and the far end stay as marked. */
  lane: LaneCalibration;
  /** How far the corners moved (px): foul right, foul left, far left, far right. */
  movedPx: [number, number, number, number];
}

/**
 * The marked lane with its two long edges moved onto the lane's edges in `gray`, to a fraction of a pixel.
 * All along each edge, the step in brightness between lane and gutter is found within about 4 boards of
 * where the edge was marked, and a line is fitted through those points: near the pins a pixel is about
 * a board, more than corners can be placed to by hand, while the line through hundreds of points is off
 * by a fraction of one. The foul line and the far end stay as marked (the corners slide along them). An
 * edge that can't be followed most of the way and up to near the pins is kept as marked.
 */
export function refineLaneEdges(gray: GrayImage, lane: LaneCalibration): RefinedLane {
  const farIn = lane.farDistanceIn;
  // foul right, foul left, far left, far right (lane x runs from the right edge to the left one)
  const marked: Point[] = [lane.toImage([0, 0]), lane.toImage([LANE_WIDTH_IN, 0]), lane.toImage([LANE_WIDTH_IN, farIn]), lane.toImage([0, farIn])];
  const corners = marked.map((p) => [...p] as Point);
  const foulLine = lineThrough(marked[0], marked[1]);
  const farLine = lineThrough(marked[3], marked[2]);
  for (const [xIn, near, far] of [
    [0, 0, 3],
    [LANE_WIDTH_IN, 1, 2],
  ] as const) {
    const edge = laneEdge(gray, lane, xIn);
    const foulPoint = edge && intersection(edge.line, foulLine);
    const farPoint = edge && intersection(edge.line, farLine);
    // the line can't leave the band it was searched in, except by running past the ends of it
    if (!edge || !foulPoint || !farPoint) continue;
    if (distance(foulPoint, marked[near]) > 1.5 * edge.reachPx[0] || distance(farPoint, marked[far]) > 1.5 * edge.reachPx[1]) continue;
    corners[near] = foulPoint;
    corners[far] = farPoint;
  }
  return {
    lane: LaneCalibration.fromPoints(corners[0], corners[1], corners[3], corners[2], farIn / 12),
    movedPx: marked.map((p, i) => distance(p, corners[i])) as RefinedLane['movedPx'],
  };
}

/** A cut across a lane edge: brightness slopes every half pixel along `across`, from -`reach` to `reach` px. */
interface EdgeCut {
  across: Point;
  at: Point;
  /** Share of the way along the edge, 0 at its near end. */
  f: number;
  reach: number;
  /** Brightness change going into the lane (grey levels per pixel); the middle one is at `at`. */
  slopes: Float64Array;
  /** How far (px) a point may be off the edge's line, here. */
  tolerance: number;
}

const CUT_STEP = 0.5;

/**
 * The lane edge at lane x `xIn` (0: the right one), as a line fitted to the brightness steps across it;
 * null when too few of them line up. `reachPx` is how far it was searched at its near and far end.
 *
 * Of all straight lines through the band searched, the one along which the steps add up most is taken (a
 * matched filter: an edge followed all the way outweighs reflections, a ball or a leg crossing it in a few
 * places, and of two parallel edges, a groove and the lane's own, the one seen more clearly all along).
 * Then a line is fitted to where each cut's step is steepest near it, to a fraction of a pixel.
 */
function laneEdge(gray: GrayImage, lane: LaneCalibration, xIn: number): { line: Line; reachPx: [number, number] } | null {
  const inward = xIn === 0 ? 1 : -1;
  const start = lane.toImage([xIn, EDGE_FROM_FT * 12]);
  const end = lane.toImage([xIn, lane.farDistanceIn - EDGE_TO_FT_BEFORE_FAR * 12]);
  const length = distance(start, end);
  const count = Math.min(EDGE_SAMPLES, Math.floor(length / 2));
  if (count < 20) return null;
  const along: Point = [(end[0] - start[0]) / length, (end[1] - start[1]) / length];

  const cuts: EdgeCut[] = [];
  for (let i = 0; i < count; i++) {
    const f = (i + 0.5) / count;
    const at: Point = [start[0] + f * (end[0] - start[0]), start[1] + f * (end[1] - start[1])];
    const inside = lane.toImage([xIn + inward, lane.toLane(at)[1]]);
    const pxPerIn = distance(at, inside);
    const across: Point = [(inside[0] - at[0]) / pxPerIn, (inside[1] - at[1]) / pxPerIn];
    const reach = Math.max(3, EDGE_SEARCH_IN * pxPerIn);
    const slopes = brightnessSlopes(gray, at, across, along, reach);
    if (slopes) cuts.push({ at, across, f, reach, slopes, tolerance: Math.max(0.5, EDGE_INLIER_IN * pxPerIn) });
  }
  if (cuts.length < count / 2) return null;
  const near = cuts[0].reach;
  const far = cuts[cuts.length - 1].reach;

  // the line (offsets at both ends, px) along which the steps add up most, each cut counting at most 1
  // (its steepest step); lanes are mostly lighter than their gutters but not always, so both ways
  // (on every other cut in steps of 2 px and 1 px first, then on all of them close to the best line found)
  let best = { score: 0, sign: 1, from: 0, to: 0 };
  for (const sign of [1, -1]) {
    const scaled = cuts.map(({ slopes }) => {
      const top = Math.max(MIN_EDGE_STEP, ...slopes.map(Math.abs));
      return slopes.map((v) => Math.max(0, (sign * v) / top));
    });
    const scoreOf = (from: number, to: number, every: number) => {
      let score = 0;
      for (let i = 0; i < cuts.length; i += every) score += valueAt(scaled[i], cuts[i], from + cuts[i].f * (to - from));
      return score * every;
    };
    let coarse = { score: 0, from: 0, to: 0 };
    for (let from = -near; from <= near; from += 2) {
      for (let to = -far; to <= far; to += 1) {
        const score = scoreOf(from, to, 2);
        if (score > coarse.score) coarse = { score, from, to };
      }
    }
    for (let from = coarse.from - 2; from <= coarse.from + 2; from += 0.5) {
      for (let to = coarse.to - 1; to <= coarse.to + 1; to += 0.25) {
        if (Math.abs(from) > near || Math.abs(to) > far) continue;
        const score = scoreOf(from, to, 1);
        if (score > best.score) best = { score, sign, from, to };
      }
    }
  }

  // a line at the end of the band searched may only be the closest it got to something outside it
  if (best.score === 0 || Math.abs(best.from) > near - 1 || Math.abs(best.to) > far - 0.5) return null;

  // where each cut's step is steepest within its tolerance of that line, to a fraction of a step; a line
  // through those, and again through those near it
  let line: Line = lineThrough(
    [start[0] + best.from * cuts[0].across[0], start[1] + best.from * cuts[0].across[1]],
    [end[0] + best.to * cuts[cuts.length - 1].across[0], end[1] + best.to * cuts[cuts.length - 1].across[1]],
  );
  let points: { f: number; p: Point }[] = [];
  for (let round = 0; round < 3; round++) {
    points = [];
    for (const cut of cuts) {
      // the offset along the cut where it crosses the line
      const [a, b, c] = line;
      const crossing = -(a * cut.at[0] + b * cut.at[1] + c) / (a * cut.across[0] + b * cut.across[1]);
      const offset = steepestNear(cut, best.sign, crossing);
      if (offset !== null) points.push({ p: [cut.at[0] + offset * cut.across[0], cut.at[1] + offset * cut.across[1]], f: cut.f });
    }
    if (points.length < 2) return null;
    line = lineThroughPoints(points.map(({ p }) => p));
  }
  const support = [0, 1, 2].map((third) => points.filter(({ f }) => Math.min(2, Math.floor(3 * f)) === third).length / (count / 3));
  if (support[0] < MIN_EDGE_SUPPORT || support[1] < MIN_EDGE_SUPPORT || support[2] < MIN_FAR_EDGE_SUPPORT) return null;
  return { line, reachPx: [near, far] };
}

/** A cut's (scaled) slope at an offset (px) along it, 0 outside it. */
function valueAt(values: Float64Array, cut: EdgeCut, offset: number): number {
  const k = offset / CUT_STEP + (values.length - 1) / 2;
  const k0 = Math.floor(k);
  if (k0 < 0 || k0 + 1 >= values.length) return 0;
  return values[k0] + (k - k0) * (values[k0 + 1] - values[k0]);
}

/**
 * The offset (px) along a cut of its steepest step (rising for `sign` 1) within its tolerance of
 * `offset`; null when there is no clear step there.
 */
function steepestNear(cut: EdgeCut, sign: number, offset: number): number | null {
  const { slopes, tolerance } = cut;
  const middle = (slopes.length - 1) / 2;
  const centre = offset / CUT_STEP + middle;
  let bestK = -1;
  for (let k = Math.max(1, Math.ceil(centre - tolerance / CUT_STEP)); k <= Math.min(slopes.length - 2, centre + tolerance / CUT_STEP); k++) {
    if (bestK < 0 || sign * slopes[k] > sign * slopes[bestK]) bestK = k;
  }
  if (bestK < 0) return null;
  const [l, m, r] = [sign * slopes[bestK - 1], sign * slopes[bestK], sign * slopes[bestK + 1]];
  // a step's peak, not the edge of the window running up towards one outside it
  if (m < MIN_EDGE_STEP || l > m || r > m) return null;
  const curvature = l - 2 * m + r;
  const shift = curvature < 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (l - r)) / curvature)) : 0;
  return (bestK + shift - middle) * CUT_STEP;
}

/**
 * Along a cut across an edge (`across`, from `at`, ±`reach` px; averaged over 3 px `along` it), how fast the
 * brightness changes (grey levels per pixel, over a pixel and a half), every half pixel. Null when the cut
 * leaves the image.
 */
function brightnessSlopes(gray: GrayImage, at: Point, across: Point, along: Point, reach: number): Float64Array | null {
  const half = Math.ceil(reach / CUT_STEP);
  const values: number[] = [];
  for (let k = -half - 2; k <= half + 2; k++) {
    let sum = 0;
    for (const t of [-1, 0, 1]) {
      const v = bilinear(gray, at[0] + k * CUT_STEP * across[0] + t * along[0], at[1] + k * CUT_STEP * across[1] + t * along[1]);
      if (v === null) return null;
      sum += v;
    }
    values.push(sum / 3);
  }
  // slopes[k] is at offset (k - half) * CUT_STEP, values[k + 2] there
  const slopes = new Float64Array(2 * half + 1);
  for (let k = 0; k < slopes.length; k++) slopes[k] = (values[k + 3] + values[k + 4] - values[k + 1] - values[k]) / 3;
  return slopes;
}

/** Grey value at a point between pixel centres, null outside the image. */
function bilinear({ data, width, height }: GrayImage, x: number, y: number): number | null {
  if (x < 0 || y < 0 || x > width - 1 || y > height - 1) return null;
  const x0 = Math.min(width - 2, Math.floor(x));
  const y0 = Math.min(height - 2, Math.floor(y));
  const fx = x - x0;
  const fy = y - y0;
  const i = y0 * width + x0;
  const top = data[i] + fx * (data[i + 1] - data[i]);
  const bottom = data[i + width] + fx * (data[i + width + 1] - data[i + width]);
  return top + fy * (bottom - top);
}

const distance = (p: Point, q: Point) => Math.hypot(p[0] - q[0], p[1] - q[1]);

/** The line through two points, `a·x + b·y + c = 0` with `a² + b² = 1`. */
function lineThrough(p: Point, q: Point): Line {
  const length = distance(p, q) || 1;
  const a = (q[1] - p[1]) / length;
  const b = -(q[0] - p[0]) / length;
  return [a, b, -(a * p[0] + b * p[1])];
}

/** The line closest to points (total least squares), `a² + b² = 1`. */
function lineThroughPoints(points: Point[]): Line {
  const mx = mean(points.map(([x]) => x));
  const my = mean(points.map(([, y]) => y));
  let xx = 0;
  let xy = 0;
  let yy = 0;
  for (const [x, y] of points) {
    xx += (x - mx) ** 2;
    xy += (x - mx) * (y - my);
    yy += (y - my) ** 2;
  }
  const theta = 0.5 * Math.atan2(2 * xy, xx - yy);
  const a = -Math.sin(theta);
  const b = Math.cos(theta);
  return [a, b, -(a * mx + b * my)];
}

/** Where two lines cross; null when they (nearly) don't. */
function intersection([a1, b1, c1]: Line, [a2, b2, c2]: Line): Point | null {
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1e-9) return null;
  return [(b1 * c2 - b2 * c1) / det, (a2 * c1 - a1 * c2) / det];
}

/** Where a line (not horizontal) is at height `y`. */
const xAt = ([a, b, c]: Line, y: number) => -(b * y + c) / a;

/**
 * The bowler's lane as its left and right edge: of the lanes seen over the most rows, the one whose
 * middle is closest to the frame's middle where it is lowest.
 */
function bowlersLane(lines: LaneLines): [Line, Line] | null {
  const lanes: { left: Line; right: Line; rows: number[] }[] = [];
  const rows: number[] = [];
  for (let y = lines.vanishing[1] + 10; y < lines.height - 5; y += LANE_ROW_STEP) rows.push(y);
  lines.edges.forEach((left, i) => {
    for (const right of lines.edges.slice(i + 1)) {
      const seen = rows.filter((y) => isLane(lines, left, right, y));
      if (seen.length >= 4 && !hasLaneEdgeInside(lines, left, right, seen[Math.floor(seen.length / 2)])) {
        lanes.push({ left, right, rows: seen });
      }
    }
  });
  if (lanes.length === 0) return null;
  // lanes are all equally wide; the capping between two gutters is much narrower. Width grows with the
  // distance from the vanishing point, so it's compared per pixel of that distance
  const spread = ({ left, right, rows: seen }: (typeof lanes)[number]) => {
    const y = seen[seen.length - 1];
    return (xAt(right, y) - xAt(left, y)) / (y - lines.vanishing[1]);
  };
  const widest = Math.max(...lanes.map(spread));
  const wide = lanes.filter((lane) => spread(lane) >= MIN_WIDTH_SHARE * widest);
  const most = Math.max(...wide.map((lane) => lane.rows.length));
  const offMiddle = ({ left, right, rows: seen }: (typeof lanes)[number]) => {
    const y = seen[seen.length - 1];
    return Math.abs((xAt(left, y) + xAt(right, y)) / 2 - lines.width / 2);
  };
  const nearest = wide.filter((lane) => lane.rows.length >= MIN_ROW_SHARE * most).sort((p, q) => offMiddle(p) - offMiddle(q))[0];
  return [nearest.left, nearest.right];
}

/** Whether the strip between two edges looks like a lane at height `y`: lane edges with brighter wood between them. */
function isLane(lines: LaneLines, left: Line, right: Line, y: number): boolean {
  const xl = xAt(left, y);
  const xr = xAt(right, y);
  if (xr - xl < 6 || xl < 0 || xr >= lines.width) return false;
  if (laneContrast(lines, left, y, 'left') < MIN_LANE_CONTRAST || laneContrast(lines, right, y, 'right') < MIN_LANE_CONTRAST) return false;
  const middle = [0.25, 0.5, 0.75].reduce((sum, f) => sum + brightness(lines, xl + f * (xr - xl), y), 0) / 3;
  return middle > brightness(lines, xl - 6, y) + MIN_LANE_LIGHTER && middle > brightness(lines, xr + 6, y) + MIN_LANE_LIGHTER;
}

/** Whether another lane edge runs between two edges: then they are two lanes and what's between them, not one. */
function hasLaneEdgeInside(lines: LaneLines, left: Line, right: Line, y: number): boolean {
  const xl = xAt(left, y);
  const xr = xAt(right, y);
  return lines.edges.some((edge) => {
    if (edge === left || edge === right) return false;
    const x = xAt(edge, y);
    return (
      x > xl + 2 &&
      x < xr - 2 &&
      (laneContrast(lines, edge, y, 'left') >= MIN_LANE_CONTRAST || laneContrast(lines, edge, y, 'right') >= MIN_LANE_CONTRAST)
    );
  });
}

/** The lane wood's brightness: the median along the lane's middle, from the pins down. */
function laneWood(lines: LaneLines, left: Line, right: Line): number {
  const values: number[] = [];
  const bottom = lines.vanishing[1] + PIN_SEARCH_SHARE * (lines.height - lines.vanishing[1]);
  for (let y = lines.vanishing[1] + 10; y < bottom; y += 2) values.push(brightness(lines, (xAt(left, y) + xAt(right, y)) / 2, y));
  values.sort((a, b) => a - b);
  return values.length ? values[Math.floor(values.length / 2)] : 128;
}

/** 1 where a pixel is pin white (barely coloured, brighter than `minValue`), else 0. */
function whiteMask(rgba: Uint8Array, minValue: number): Uint8Array {
  const mask = new Uint8Array(rgba.length / 4);
  for (let i = 0; i < mask.length; i++) {
    const r = rgba[4 * i];
    const g = rgba[4 * i + 1];
    const b = rgba[4 * i + 2];
    const max = Math.max(r, g, b);
    const saturation = max ? ((max - Math.min(r, g, b)) / max) * 255 : 0;
    mask[i] = saturation < PIN_MAX_SATURATION && max > minValue ? 1 : 0;
  }
  return mask;
}

/**
 * Height of the head pin's base: the share of white per row inside the lane, near the pins, is mirrored
 * about it (the pins above, their reflection on the oily lane below). On a lane without a reflection it is
 * the lowest row the pins reach. Null when no pins are found.
 */
function headPinY(lines: LaneLines, white: Uint8Array, left: Line, right: Line): number | null {
  const top = Math.max(0, Math.floor(lines.vanishing[1]));
  const bottom = Math.min(lines.height, Math.floor(lines.vanishing[1] + PIN_SEARCH_SHARE * (lines.height - lines.vanishing[1])));
  // per row: the share of white across the lane, and how bright that white is
  const profile: number[] = [];
  const whiteness: number[] = [];
  for (let y = top; y < bottom; y++) {
    const xl = Math.max(0, Math.floor(xAt(left, y)));
    const xr = Math.min(lines.width, Math.floor(xAt(right, y)));
    let count = 0;
    let sum = 0;
    for (let x = xl; x < xr; x++) {
      if (white[y * lines.width + x]) {
        count++;
        sum += lines.gray[y * lines.width + x];
      }
    }
    profile.push(xr > xl + 1 ? count / (xr - xl) : 0);
    whiteness.push(count ? sum / count : 0);
  }
  // a reflection is a little dimmer than the pins; inside a pin both sides are equally white
  const dimmerBelow = (k: number) => mean(whiteness.slice(k - 4, k)) - mean(whiteness.slice(k, k + 4)) >= MIN_REFLECTION_DIMMER;
  let best: number | null = null;
  let bestCorrelation = -1;
  for (let k = 5; k < profile.length - 5; k++) {
    const n = Math.min(k, profile.length - k, PIN_MIRROR_MAX_ROWS);
    if (n < 4) continue;
    const above = profile.slice(k - n, k).reverse();
    const below = profile.slice(k, k + n);
    if (mean(above) < 0.05 || !dimmerBelow(k)) continue;
    const r = correlation(above, below);
    if (r > bestCorrelation) {
      bestCorrelation = r;
      best = top + k;
    }
  }
  if (best !== null && bestCorrelation >= MIN_MIRROR_CORRELATION) return best;
  // no reflection: the lowest row that is still clearly pins
  const peak = Math.max(0, ...profile);
  if (peak < MIN_PIN_SHARE) return null;
  for (let k = profile.length - 1; k >= 0; k--) {
    if (profile[k] >= PIN_BASE_SHARE * peak) return top + k + 1;
  }
  return null;
}

/** Height of the foul line: walking down from the pins, where neither gutter beside the lane is dark any more. */
function foulLineY(lines: LaneLines, left: Line, right: Line, farY: number): number {
  let light = 0;
  for (let y = Math.ceil(farY) + 5; y < lines.height - 3; y++) {
    const xl = xAt(left, y);
    const xr = xAt(right, y);
    const gutter = GUTTER_MIDDLE_SHARE * (xr - xl);
    // either gutter will do: one may be hidden (a towel, the bowler, the ball return)
    const darkest = Math.min(brightness(lines, xl - gutter, y), brightness(lines, xr + gutter, y));
    const wood = (brightness(lines, xl + 0.3 * (xr - xl), y) + brightness(lines, xr - 0.3 * (xr - xl), y)) / 2;
    light = darkest < wood - MIN_GUTTER_DARKNESS ? 0 : light + 1;
    if (light >= GUTTER_END_ROWS) return y - GUTTER_END_ROWS;
  }
  // the gutters run out of the frame: the foul line is below it, the frame's bottom is as near as it gets
  return lines.height - 4;
}

const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;

function correlation(a: number[], b: number[]): number {
  const ma = mean(a);
  const mb = mean(b);
  let ab = 0;
  let aa = 0;
  let bb = 0;
  a.forEach((v, i) => {
    ab += (v - ma) * (b[i] - mb);
    aa += (v - ma) ** 2;
    bb += (b[i] - mb) ** 2;
  });
  return aa > 1e-9 && bb > 1e-9 ? ab / Math.sqrt(aa * bb) : -1;
}

type Segment = [number, number, number, number];

/** Segments steep enough to run down the alley (not the foul line, ceiling or screens), below the top quarter. */
function segmentsRunningAway(data: Int32Array, height: number): Segment[] {
  const segments: Segment[] = [];
  for (let i = 0; i + 3 < data.length; i += 4) {
    const [x1, y1, x2, y2] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    const angle = (Math.abs((Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI) + 180) % 180;
    if (angle > 15 && angle < 165 && (y1 + y2) / 2 > height * 0.25) segments.push([x1, y1, x2, y2]);
  }
  return segments;
}

/** The homogeneous line through a segment, scaled so `a·x + b·y + c` is the distance in px. */
function lineOf([x1, y1, x2, y2]: Segment): Line {
  const a = y1 - y2;
  const b = x2 - x1;
  const norm = Math.hypot(a, b) || 1;
  return [a / norm, b / norm, (x1 * y2 - x2 * y1) / norm];
}

/** The point most segment length runs towards, searched among the crossings of segment pairs. */
function vanishingPoint(segments: Segment[], width: number, height: number): Point | null {
  if (segments.length < 2) return null;
  const lines = segments.map(lineOf);
  const lengths = segments.map(([x1, y1, x2, y2]) => Math.hypot(x2 - x1, y2 - y1));
  const random = seededRandom(0);
  let best: Point | null = null;
  let bestScore = 0;
  for (let round = 0; round < RANSAC_ROUNDS; round++) {
    const i = Math.floor(random() * lines.length);
    const j = Math.floor(random() * lines.length);
    if (i === j) continue;
    const [a1, b1, c1] = lines[i];
    const [a2, b2, c2] = lines[j];
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1e-9) continue;
    const x = (b1 * c2 - b2 * c1) / det;
    const y = (a2 * c1 - a1 * c2) / det;
    // the alley's end: above the near lane, not far outside the frame
    if (x < -width || x > 2 * width || y < height * 0.1 || y > height * 0.9) continue;
    let score = 0;
    lines.forEach(([a, b, c], k) => {
      if (Math.abs(a * x + b * y + c) < VANISHING_TOLERANCE_PX) score += lengths[k];
    });
    if (score > bestScore) {
      bestScore = score;
      best = [x, y];
    }
  }
  return best;
}

/**
 * The edges running towards the vanishing point, left to right: their segments grouped by direction from
 * it, each group fitted with one line (through the segments' ends, weighted by length).
 */
function fitEdges(segments: Segment[], [vx, vy]: Point): Line[] {
  const towards = segments
    .filter((segment) => {
      const [a, b, c] = lineOf(segment);
      return Math.abs(a * vx + b * vy + c) < EDGE_TOLERANCE_PX;
    })
    .map((segment) => {
      const [x1, y1, x2, y2] = segment;
      return { segment, angle: Math.atan2((y1 + y2) / 2 - vy, (x1 + x2) / 2 - vx) };
    })
    .filter(({ angle }) => angle > 0 && angle < Math.PI)
    .sort((p, q) => q.angle - p.angle); // left to right: larger angles point further left
  const groups: Segment[][] = [];
  let last = Infinity;
  for (const { segment, angle } of towards) {
    if (last - angle > SAME_EDGE_RAD || groups.length === 0) groups.push([]);
    groups[groups.length - 1].push(segment);
    last = angle;
  }
  return groups.map(fitLine);
}

/** The line through segments' ends, by total least squares weighted by segment length. */
function fitLine(segments: Segment[]): Line {
  let sw = 0;
  let sx = 0;
  let sy = 0;
  for (const [x1, y1, x2, y2] of segments) {
    const w = Math.hypot(x2 - x1, y2 - y1);
    sw += 2 * w;
    sx += w * (x1 + x2);
    sy += w * (y1 + y2);
  }
  const mx = sx / sw;
  const my = sy / sw;
  let xx = 0;
  let xy = 0;
  let yy = 0;
  for (const [x1, y1, x2, y2] of segments) {
    const w = Math.hypot(x2 - x1, y2 - y1);
    for (const [x, y] of [
      [x1, y1],
      [x2, y2],
    ]) {
      xx += w * (x - mx) ** 2;
      xy += w * (x - mx) * (y - my);
      yy += w * (y - my) ** 2;
    }
  }
  // direction: the main axis of the points; the line's normal is perpendicular to it
  const theta = 0.5 * Math.atan2(2 * xy, xx - yy);
  const a = -Math.sin(theta);
  const b = Math.cos(theta);
  return [a, b, -(a * mx + b * my)];
}

/**
 * How much brighter it is on the lane side of an edge than on the other, a little up the lane from `y`
 * (median along the edge): at the foul line itself the approach is beside the edge, not the gutter.
 */
function laneContrast(lines: LaneLines, [a, b, c]: Line, y: number, side: LaneSide): number {
  // the lane lies inwards: to the right of its left edge, to the left of its right edge
  const inward = side === 'left' ? 1 : -1;
  const contrasts: number[] = [];
  for (let up = 4; up <= 28; up += 4) {
    const yy = y - up;
    if (yy <= lines.vanishing[1] + 2) break;
    const x = -(b * yy + c) / a;
    contrasts.push(brightness(lines, x + inward * 4, yy) - brightness(lines, x - inward * 4, yy));
  }
  if (contrasts.length === 0) return 0;
  contrasts.sort((p, q) => p - q);
  return contrasts[Math.floor(contrasts.length / 2)];
}

/** Mean grey of a 5 x 5 patch, 0 outside the frame. */
function brightness(lines: LaneLines, x: number, y: number): number {
  let sum = 0;
  let count = 0;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const px = Math.round(x + dx);
      const py = Math.round(y + dy);
      if (px >= 0 && px < lines.width && py >= 0 && py < lines.height) {
        sum += lines.gray[py * lines.width + px];
        count++;
      }
    }
  }
  return count ? sum / count : 0;
}
