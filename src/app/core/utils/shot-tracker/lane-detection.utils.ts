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

import { Point } from './lane.utils';
import { seededRandom } from './math.utils';
import { Cv, loadOpenCv, release } from './opencv.utils';

export type LaneSide = 'left' | 'right';

type Line = [number, number, number];

/** A frame's edges that run down the alley, in the pixels of `gray`. */
export interface LaneLines {
  /** Where the edges meet. */
  vanishing: Point;
  /** The edges as lines `a·x + b·y + c = 0`, left to right. */
  edges: Line[];
  /** The frame in grey, for telling lane from gutter. */
  gray: Uint8Array;
  width: number;
  height: number;
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
