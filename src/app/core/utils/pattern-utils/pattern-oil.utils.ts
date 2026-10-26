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

/** A run of bars, first and last index included. */
export interface BarRange {
  from: number;
  to: number;
}

/** The bars from `range.from` to `range.to` added up. */
export function sumBars(bars: OilBar[], range: BarRange): OilBar {
  const sum = { forward: 0, reverse: 0 };
  for (let i = Math.max(0, range.from); i <= Math.min(bars.length - 1, range.to); i++) {
    sum.forward += bars[i].forward;
    sum.reverse += bars[i].reverse;
  }
  return sum;
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

/** Colour of the oil by the pattern's ratio, the same as on the pattern charts: red under 4:1, orange up to 8:1, green above, blue without one. */
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
