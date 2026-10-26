import { PatternCalculation, PatternInput, PatternInputRow, PatternRow } from '../../models/pattern.model';

/** A row of the custom pattern form as typed, before it is sent to the pattern API. */
export interface PatternRowDraft {
  buf: string;
  /** Feet where a row without loads (buffing) ends. */
  distanceEnd: string;
  /** Stable id for tracking the row in the list. */
  key: number;
  load: string;
  mics: string;
  speed: string;
  start: string;
  stop: string;
  tank: string;
}

export interface PatternDraft {
  forward: PatternRowDraft[];
  pump: string;
  reverse: PatternRowDraft[];
  /** Feet where the reverse pass starts; empty for "where the forward pass ended". */
  reverseStart: string;
  tanks: string;
  title: string;
}

export type PatternRowField = Exclude<keyof PatternRowDraft, 'key'>;

let nextKey = 1;

/** "1,5" and "1.5" both read as 1.5; empty or not a number is undefined. */
export function parseDecimal(value: string): number | undefined {
  const text = value.trim().replace(',', '.');
  if (text === '') return undefined;
  const number = Number(text);
  return Number.isFinite(number) ? number : undefined;
}

/** Whether a row lays no oil, so it needs to be told where it ends. */
export function isBuffingRow(row: PatternRowDraft): boolean {
  return parseDecimal(row.load) === 0;
}

/**
 * A new row. The first row of a pattern gets typical sheet values (2L-2R, 2 loads at 14 in/s,
 * buffer 3, mics = pump size); any later row continues from the one before it, since rows mostly
 * differ in a value or two.
 */
export function newPatternRow(previous: PatternRowDraft | undefined, pump: string): PatternRowDraft {
  if (previous) {
    return { ...previous, key: nextKey++, distanceEnd: '' };
  }
  const mics = parseDecimal(pump) !== undefined ? String(parseDecimal(pump)) : '';
  return { key: nextKey++, start: '2L', stop: '2R', load: '2', mics, speed: '14', buf: '3', tank: '', distanceEnd: '' };
}

function toInputRow(row: PatternRowDraft): PatternInputRow {
  // board positions keep what was typed (2l, 2R, 5); the API reads and normalizes them
  const input: PatternInputRow = {
    start: row.start.trim().toUpperCase(),
    stop: row.stop.trim().toUpperCase(),
    load: parseDecimal(row.load) as number,
    mics: parseDecimal(row.mics) as number,
    speed: parseDecimal(row.speed) as number,
  };
  const buf = parseDecimal(row.buf);
  if (buf !== undefined) input.buf = buf;
  if (row.tank.trim()) input.tank = row.tank.trim();
  const end = parseDecimal(row.distanceEnd);
  if (isBuffingRow(row) && end !== undefined) input.distance_end = end;
  return input;
}

/**
 * The draft as the pattern API takes it. Missing numbers are left out so the API can say which
 * row and value is missing; everything but the machine settings is calculated there.
 */
export function toPatternInput(draft: PatternDraft): PatternInput {
  const input: PatternInput = {
    forwards_data: draft.forward.map(toInputRow),
    reverse_data: draft.reverse.map(toInputRow),
  };
  if (draft.title.trim()) input.title = draft.title.trim();
  if (draft.pump.trim()) input.pump = draft.pump.trim();
  if (draft.tanks.trim()) input.tanks = draft.tanks.trim();
  const reverseStart = parseDecimal(draft.reverseStart);
  if (reverseStart !== undefined) input.reverse_start = reverseStart;
  return input;
}

/** What a calculated row covers, e.g. "0.00 → 1.96 ft · 3.330 mL". */
export function describeCalculatedRow(row: PatternRow | undefined): string {
  return row ? `${row.distance_start} → ${row.distance_end} ft · ${row.total_oil} mL` : '';
}

/** Headline numbers of a calculation, for the preview. */
export function calculationFacts(calculation: PatternCalculation): { label: string; value: string; detail?: string }[] {
  return [
    { label: 'Distance', value: calculation.distance.replace("'", ' ft') },
    { label: 'Ratio', value: calculation.ratio ?? '–' },
    { label: 'Volume', value: `${calculation.volume} mL`, detail: `↑ ${calculation.forward} · ↓ ${calculation.reverse}` },
  ];
}
