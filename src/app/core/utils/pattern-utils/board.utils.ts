// board.utils.ts
//
// Lane geometry and the board-notation parser.
//
// The lane axis used throughout is a continuous coordinate from 0 (left gutter
// edge) to 39 (right gutter edge), counting boards in from the left. This is
// NOT a 1-based board index — it mirrors parse_x() in the pattern service's
// scraper/chart_generator.py so the AR overlay and the stored 2D charts agree.
// See laneXToBoard() for the human-facing board number.

/** Width of the lane in lane-axis units. Matches LANE_WIDTH in chart_generator.py. */
export const LANE_UNITS = 39;

/** Lane width in metres (41.5 in). */
export const LANE_WIDTH_M = 1.0541;

/** Width of one lane unit in metres. */
export const UNIT_M = LANE_WIDTH_M / LANE_UNITS;

/** Foul line to the centre of the head pin, in feet. */
export const LANE_LENGTH_FT = 60;

export const FT_TO_M = 0.3048;

/**
 * The seven lane arrows, in lane-axis units and feet from the foul line.
 * Boards 5/10/15/20/25/30/35 sit at lane-axis 4/9/14/19/24/29/34.
 * The staggered distances form a shallow chevron — the points are not
 * collinear, which is what makes them a usable calibration target.
 */
export const LANE_ARROWS: readonly { x: number; distanceFt: number }[] = [
  { x: 4, distanceFt: 12.5 },
  { x: 9, distanceFt: 13.5 },
  { x: 14, distanceFt: 14.5 },
  { x: 19, distanceFt: 15.5 },
  { x: 24, distanceFt: 14.5 },
  { x: 29, distanceFt: 13.5 },
  { x: 34, distanceFt: 12.5 },
];

/**
 * Parses a board token into a lane-axis coordinate.
 *
 * '10L' -> 10, '10R' -> 29, '20' -> 20.
 *
 * Note that 'nR' maps to LANE_UNITS - n, not LANE_UNITS + 1 - n. That is what
 * chart_generator.py does, and the two renderers have to agree or the app
 * contradicts itself on screen. Do not change this without changing the Python
 * in lockstep.
 *
 * Returns null for anything unparseable. The Python falls back to 0 instead,
 * which silently turns a bad row into a full-width load at the left gutter;
 * callers here skip the load and report it instead. That is the one deliberate
 * divergence, and it only applies to input the Python would have drawn wrong.
 */
export function parseLaneX(token: string | undefined | null): number | null {
  const match = /^\s*(\d{1,2}(?:\.\d+)?)\s*([LR])?\s*$/i.exec(token ?? '');
  if (!match) {
    return null;
  }

  const value = Number(match[1]);
  if (!Number.isFinite(value) || value < 0 || value > LANE_UNITS) {
    return null;
  }

  return match[2]?.toUpperCase() === 'R' ? LANE_UNITS - value : value;
}

/** Parses a numeric field from the scraper. Returns null rather than NaN. */
export function parseNumeric(value: string | undefined | null): number | null {
  if (value === undefined || value === null || String(value).trim() === '') {
    return null;
  }

  const parsed = Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : null;
}

/** Lane-axis coordinate to metres from the lane centreline. Axis centre is 19.5. */
export function laneXToMetres(x: number): number {
  return (x - LANE_UNITS / 2) * UNIT_M;
}

/** Feet downlane from the foul line to metres. */
export function feetToMetres(feet: number): number {
  return feet * FT_TO_M;
}

/**
 * Human-facing board number for a lane-axis coordinate.
 * Arrows at lane-axis 4, 9, 14 report as boards 5, 10, 15.
 */
export function laneXToBoard(x: number): number {
  return Math.floor(x) + 1;
}
