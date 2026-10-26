import { BOARDS } from './pattern-oil.utils';

/**
 * Geometry of the pattern chart SVG (`chart_standard`), copied from lightningbowl-patterns
 * `scraper/chart_generator.py`. Used to place highlights over the chart image and to turn a tap on
 * it into a board and a distance. Keep in sync with the generator: if its layout changes, the
 * highlights drift until these numbers are updated.
 */
export const CHART_W = 216;
export const CHART_H = 832;
const LANE_W = 156;
const PAD_X = 30;
const PAD_TOP = 8;
const LANE_H = 800;
const PIN_SPACING = LANE_W / 4.2;
const PIN_RADIUS = PIN_SPACING * 0.3;
const PIN_ROW = PIN_SPACING * 0.8;
const HEAD_PIN_GAP = 8;
const DECK_H = HEAD_PIN_GAP + 2 * PIN_RADIUS + 3 * PIN_ROW + 6;
const LANE_FT = 60;

export interface ChartRect {
  height: number;
  width: number;
  x: number;
  y: number;
}

/** x of a position in boards from the left edge (0 to 39). */
const xOf = (boardsFromLeft: number) => PAD_X + (boardsFromLeft / BOARDS) * LANE_W;
/** y of a distance from the foul line in feet (0 at the foul line, 60 below the pin deck). */
const yOf = (ft: number) => PAD_TOP + DECK_H + (1 - ft / LANE_FT) * (LANE_H - DECK_H);

/** Board (1-39 from the left) and foot (0-59) at a point of the chart, or null where there is none (gutters, pin deck). */
export function chartPointToLane(x: number, y: number): { board: number | null; foot: number | null } {
  const boards = ((x - PAD_X) / LANE_W) * BOARDS;
  const ft = (1 - (y - PAD_TOP - DECK_H) / (LANE_H - DECK_H)) * LANE_FT;
  return {
    board: boards >= 0 && boards <= BOARDS ? Math.min(BOARDS, Math.floor(boards) + 1) : null,
    foot: ft >= 0 && ft <= LANE_FT ? Math.min(LANE_FT - 1, Math.floor(ft)) : null,
  };
}

/** Boards `from` to `to` (1-39 from the left, both included) on the chart, from the foul line to `toFt`. */
export function boardStripe(from: number, to: number, toFt: number): ChartRect {
  const top = yOf(Math.min(LANE_FT, Math.max(1, toFt)));
  return { x: xOf(from - 1), width: xOf(to) - xOf(from - 1), y: top, height: yOf(0) - top };
}

/** Feet `from` to `to` (0-based, both included) as a band across the lane on the chart. */
export function footBand(from: number, to: number): ChartRect {
  const top = yOf(to + 1);
  return { x: xOf(0), width: LANE_W, y: top, height: yOf(from) - top };
}

/** A board as the pattern sheets write it: 1L-19L from the left, 20 in the middle, 19R-1R from the right. */
export function boardName(board: number): string {
  if (board === 20) {
    return '20';
  }
  return board < 20 ? `${board}L` : `${BOARDS + 1 - board}R`;
}
