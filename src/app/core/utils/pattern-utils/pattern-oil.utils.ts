import { ForwardsData, Pattern, ReverseData } from '../../models/pattern.model';

/** Boards across the lane. */
export const BOARDS = 39;
/** Five-board blocks for the ratios, from the left: 3-7, 8-12, 13-17, the centre 18-22, and back out. */
export const RATIO_BLOCKS: readonly [number, number][] = [
  [3, 7],
  [8, 12],
  [13, 17],
  [18, 22],
  [23, 27],
  [28, 32],
  [33, 37],
];
const CENTER_BLOCK = 3;

type OilRow = ForwardsData | ReverseData;

/** Oil of one direction and the other, per bar. */
export interface OilBar {
  forward: number;
  reverse: number;
}

export interface BlockRatio {
  from: number;
  /** "3.03", "1:1" for the centre, or "–" when the block has no oil. */
  label: string;
  to: number;
}

const num = (value: string | undefined) => parseFloat(value ?? '') || 0;

/** Board numbers from the left (1-39) a row oils: "2L" is board 2, "2R" board 38. */
export function rowBoards(row: Pick<OilRow, 'start' | 'stop'>): [number, number] {
  const board = (value: string) => {
    const text = String(value).trim().toUpperCase();
    const n = parseInt(text.replace(/\D/g, ''), 10) || 0;
    return text.endsWith('R') ? BOARDS + 1 - n : n;
  };
  const a = board(row.start);
  const b = board(row.stop);
  return [Math.max(1, Math.min(a, b)), Math.min(BOARDS, Math.max(a, b))];
}

/**
 * Microlitres a row puts on each board it covers: loads × mics. Taken from these rather than
 * `total_oil`, which is scraped as "720" instead of "0.720" for some patterns.
 */
export function rowOilPerBoard(row: OilRow): number {
  return num(row.load) * num(row.mics);
}

function addRows(rows: OilRow[], each: (row: OilRow, perBoard: number) => void) {
  for (const row of rows ?? []) {
    const perBoard = rowOilPerBoard(row);
    if (perBoard > 0) {
      each(row, perBoard);
    }
  }
}

/** Oil per board, left to right, in µL. */
export function oilByBoard(pattern: Pattern): OilBar[] {
  const bars: OilBar[] = Array.from({ length: BOARDS }, () => ({ forward: 0, reverse: 0 }));
  const add = (key: keyof OilBar) => (row: OilRow, perBoard: number) => {
    const [from, to] = rowBoards(row);
    for (let b = from; b <= to; b++) {
      bars[b - 1][key] += perBoard;
    }
  };
  addRows(pattern.forwards_data, add('forward'));
  addRows(pattern.reverse_data, add('reverse'));
  return bars;
}

/** Oil per foot from the foul line, in µL: each row's oil spread evenly over the distance it covers. */
export function oilByFoot(pattern: Pattern, lengthFt: number): OilBar[] {
  const bars: OilBar[] = Array.from({ length: Math.max(1, Math.ceil(lengthFt)) }, () => ({ forward: 0, reverse: 0 }));
  const add = (key: keyof OilBar) => (row: OilRow, perBoard: number) => {
    const [from, to] = rowBoards(row);
    const start = Math.min(num(row.distance_start), num(row.distance_end));
    const end = Math.max(num(row.distance_start), num(row.distance_end));
    if (end <= start) {
      return;
    }
    const perFoot = (perBoard * (to - from + 1)) / (end - start);
    for (let ft = Math.floor(start); ft < Math.min(bars.length, Math.ceil(end)); ft++) {
      const overlap = Math.min(end, ft + 1) - Math.max(start, ft);
      if (overlap > 0) {
        bars[ft][key] += perFoot * overlap;
      }
    }
  };
  addRows(pattern.forwards_data, add('forward'));
  addRows(pattern.reverse_data, add('reverse'));
  return bars;
}

/** Oil in the centre block (boards 18-22) to oil in each five-board block, like the pattern sheets. */
export function blockRatios(byBoard: OilBar[]): BlockRatio[] {
  const total = (from: number, to: number) => {
    let sum = 0;
    for (let b = from; b <= to; b++) {
      sum += byBoard[b - 1].forward + byBoard[b - 1].reverse;
    }
    return sum;
  };
  const [cFrom, cTo] = RATIO_BLOCKS[CENTER_BLOCK];
  const center = total(cFrom, cTo);
  return RATIO_BLOCKS.map(([from, to], i) => {
    if (i === CENTER_BLOCK) {
      return { from, to, label: '1:1' };
    }
    const oil = total(from, to);
    return { from, to, label: oil > 0 ? (center / oil).toFixed(2).replace(/\.?0+$/, '') : '–' };
  });
}

export interface PatternFacts {
  difficulty?: string;
  distance?: string;
  forward?: string;
  length?: string;
  ratio?: string;
  reverse?: string;
  volume?: string;
}

/** The headline numbers of a pattern with the category each falls in, for the detail view. */
export function patternFacts(pattern: Pattern): PatternFacts {
  const distance = num(pattern.distance);
  const ratio = num(pattern.ratio?.split(':')[0]);
  const volume = num(pattern.volume);
  const mL = (value: string) => (num(value) > 0 ? `${num(value)} mL` : undefined);
  return {
    distance: distance > 0 ? `${distance} ft` : undefined,
    length: distance > 0 ? (distance <= 35 ? 'Short' : distance < 41 ? 'Medium' : 'Long') : undefined,
    ratio: ratio > 0 ? pattern.ratio : undefined,
    difficulty: ratio > 0 ? (ratio <= 4 ? 'Hard' : ratio <= 8 ? 'Medium' : 'Easy') : undefined,
    volume: volume > 0 ? `${volume} mL` : undefined,
    forward: mL(pattern.forward),
    reverse: mL(pattern.reverse),
  };
}

/**
 * Oil of a pattern drawn the way the pattern charts are (lightningbowl-patterns
 * `scraper/chart_generator.py`), so the shot lane and the charts show the same thing.
 */

/** One rectangle of oil: x in boards from the lane's left edge (0 to 39), y in feet from the foul line. */
export interface OilRect {
  fromFt: number;
  key: string;
  left: number;
  opacity: number;
  right: number;
  toFt: number;
}

interface DrawnRow {
  distance_end: string;
  distance_start: string;
  start: string;
  stop: string;
  total_oil?: string;
}

/** "nL" is n boards from the left edge, "nR" n boards from the right edge. */
export function parseBoardEdge(value: string): number {
  const text = String(value).trim().toUpperCase();
  const n = parseFloat(text.replace(/[^\d.]/g, '')) || 0;
  return text.endsWith('R') ? BOARDS - n : n;
}

/** Colour of the oil by the pattern's ratio, like the charts: red under 4:1, orange up to 8:1, green above, blue without one. */
export function patternRatioColor(ratio: string | undefined): string {
  const value = parseFloat(String(ratio ?? '0:1').split(':')[0]) || 0;
  if (value >= 1 && value < 4) {
    return 'red';
  }
  if (value >= 4 && value < 8) {
    return '#ed8e07';
  }
  return value >= 8 ? 'green' : 'blue';
}

/** Oil length in feet ("37'" → 37), or null when the pattern has none. */
export function patternDistanceFt(pattern: Pattern): number | null {
  const ft = parseFloat(pattern.distance);
  return Number.isFinite(ft) && ft > 0 ? ft : null;
}

const maxDistance = (rows: DrawnRow[]) => Math.max(0, ...rows.map((r) => Math.max(num(r.distance_start), num(r.distance_end))));

function toRect(row: DrawnRow, opacity: number, key: string): OilRect {
  const a = parseBoardEdge(row.start);
  const b = parseBoardEdge(row.stop);
  const d1 = num(row.distance_start);
  const d2 = num(row.distance_end);
  return { key, left: Math.min(a, b), right: Math.max(a, b), fromFt: Math.min(d1, d2), toFt: Math.max(d1, d2), opacity };
}

/**
 * The chart's layers, bottom to top: a light wash over the whole oiled length, the forward passes
 * at 50 % and the reverse passes at 30 %, so boards that get oil more often come out darker.
 */
export function patternOilRects(pattern: Pattern): OilRect[] {
  const forward: DrawnRow[] = pattern.forwards_data ?? [];
  const reverse: DrawnRow[] = pattern.reverse_data ?? [];
  const forwardMax = maxDistance(forward);
  const reverseMax = maxDistance(reverse);
  const wash = { start: '1L', stop: '1R', distance_start: '0' };

  const rects: OilRect[] = [];
  if (reverseMax !== forwardMax) {
    rects.push(toRect({ ...wash, distance_end: `${forwardMax}` }, 0.05, 'wash-forward'));
  }
  rects.push(toRect({ ...wash, distance_end: `${reverseMax}` }, 0.1, 'wash'));
  forward.forEach((row, i) => {
    if (Math.trunc(num(row.total_oil)) !== 0) {
      rects.push(toRect(row, 0.5, `forward-${i}`));
    }
  });
  reverse.forEach((row, i) => {
    if (Math.trunc(num(row.total_oil)) !== 0 || num(row.distance_end) === 0) {
      rects.push(toRect(row, 0.3, `reverse-${i}`));
    }
  });
  return rects.filter((r) => r.right > r.left && r.toFt > r.fromFt);
}
