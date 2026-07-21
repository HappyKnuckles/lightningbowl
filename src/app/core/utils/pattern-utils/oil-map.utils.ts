// oil-map.utils.ts
//
// Turns a pattern's forward/reverse load rows into lane geometry, and from
// there into a scalar oil field the renderer can colour.
//
// The rect stage is a direct port of compute_rect() and the two draw loops in
// the pattern service's scraper/chart_generator.py, including its inclusion
// rules. Rect output is the parity gate against the stored SVG charts; the
// field stage on top of it is ours.

import { ForwardsData, Pattern, ReverseData } from 'src/app/core/models/pattern.model';
import { LANE_LENGTH_FT, LANE_UNITS, parseLaneX, parseNumeric } from './board.utils';

export type OilPass = 'forward' | 'reverse';

/** How a load's contribution to the field is weighted. */
export type OilModel = 'coverage' | 'thickness';

export interface LoadRect {
  /** Lane-axis coordinates, always x0 <= x1. */
  x0: number;
  x1: number;
  /** Feet from the foul line, always y0 <= y1. */
  y0: number;
  y1: number;
  totalOil: number;
  /** Microns, when the scraper supplied it. Unverified — see thickness model. */
  mics: number | null;
  pass: OilPass;
  /**
   * Base coverage bands run the width of the lane from the foul line out to the
   * pattern distance. Individual load rows sit on top of them, so a load
   * starting at 10 ft does not imply the first 10 ft are dry.
   */
  kind: 'load' | 'base';
}

export interface LoadRectsResult {
  rects: LoadRect[];
  forwardsMaxDistance: number;
  reverseMaxDistance: number;
  /** Rows that could not be parsed, for surfacing rather than silently dropping. */
  skipped: { pass: OilPass; index: number; reason: string }[];
}

export interface OilField {
  /** Columns across the lane, one per lane-axis unit. */
  units: number;
  /** Rows down the lane. */
  slices: number;
  slicesPerFoot: number;
  /** Row-major, units * slices. */
  data: Float32Array;
  max: number;
  model: OilModel;
}

export interface OilFieldOptions {
  model?: OilModel;
  slicesPerFoot?: number;
  /** Relative weight of a reverse pass in coverage mode. Mirrors the 0.5/0.3 fill opacities. */
  reverseWeight?: number;
}

const DEFAULT_SLICES_PER_FOOT = 10;
const DEFAULT_REVERSE_WEIGHT = 0.6;

/**
 * Base band weights, mirroring the 0.05 and 0.1 fill opacities the Python uses
 * against a 0.5 forward load — so a band reads as a fraction of one pass.
 */
const FORWARD_BAND_WEIGHT = 0.1;
const REVERSE_BAND_WEIGHT = 0.2;

/** The bands stop one unit short of each gutter, as x_scale(1)..x_scale(38) does. */
const BAND_INSET = 1;

/**
 * The fill opacities chart_generator.py draws each rect at. Coverage mode
 * composites with these directly rather than normalising, so the result layers
 * the same way the stored charts do — the base band reaches the foul line at a
 * visible 0.1 instead of being scaled away against the brightest load.
 */
const REFERENCE_OPACITY = {
  baseForward: 0.05,
  baseReverse: 0.1,
  loadForward: 0.5,
  loadReverse: 0.3,
} as const;

/** Fill opacity for a rect, matching the reference renderer. */
export function referenceOpacity(rect: LoadRect): number {
  if (rect.kind === 'base') {
    return rect.pass === 'forward' ? REFERENCE_OPACITY.baseForward : REFERENCE_OPACITY.baseReverse;
  }

  return rect.pass === 'forward' ? REFERENCE_OPACITY.loadForward : REFERENCE_OPACITY.loadReverse;
}

/** Every rect for a pattern, base bands first so loads composite on top. */
export function toDrawableRects(pattern: Pick<Pattern, 'forwards_data' | 'reverse_data'>): LoadRect[] {
  const result = toLoadRects(pattern);
  return [...toBaseBands(result), ...result.rects];
}

function toRect(row: ForwardsData | ReverseData, pass: OilPass): LoadRect | string {
  const xStart = parseLaneX(row.start);
  const xStop = parseLaneX(row.stop);
  if (xStart === null || xStop === null) {
    return `unparseable board range "${row.start}"-"${row.stop}"`;
  }

  const distanceStart = parseNumeric(row.distance_start);
  const distanceEnd = parseNumeric(row.distance_end);
  if (distanceStart === null || distanceEnd === null) {
    return `unparseable distance "${row.distance_start}"-"${row.distance_end}"`;
  }

  const totalOil = parseNumeric(row.total_oil);
  if (totalOil === null) {
    return `unparseable total_oil "${row.total_oil}"`;
  }

  return {
    x0: Math.min(xStart, xStop),
    x1: Math.max(xStart, xStop),
    // The reverse pass runs back down the lane toward the foul line, so reverse
    // oil always reaches it however far out the row says it starts. This is a
    // deliberate divergence from chart_generator.py, which plots the row's
    // distance_start literally and leaves the first feet of lane bare.
    y0: pass === 'reverse' ? 0 : Math.min(distanceStart, distanceEnd),
    y1: Math.max(distanceStart, distanceEnd),
    totalOil,
    mics: parseNumeric(row.mics),
    pass,
    kind: 'load',
  };
}

/**
 * The full-width base coverage bands, running from the foul line out to each
 * pass's maximum distance.
 *
 * Mirrors the two background rects in chart_generator.py, including the rule
 * that the forwards band is only drawn when the two maxima differ. Without
 * these the render shows bare lane between the foul line and the first load,
 * which is wrong — the machine lays oil from the foul line outward.
 */
export function toBaseBands(result: Pick<LoadRectsResult, 'forwardsMaxDistance' | 'reverseMaxDistance'>): LoadRect[] {
  const { forwardsMaxDistance, reverseMaxDistance } = result;
  const bands: LoadRect[] = [];

  const band = (maxDistance: number, pass: OilPass): LoadRect => ({
    x0: BAND_INSET,
    x1: LANE_UNITS - BAND_INSET,
    y0: 0,
    y1: maxDistance,
    totalOil: 0,
    mics: null,
    pass,
    kind: 'base',
  });

  if (reverseMaxDistance !== forwardsMaxDistance && forwardsMaxDistance > 0) {
    bands.push(band(forwardsMaxDistance, 'forward'));
  }

  if (reverseMaxDistance > 0) {
    bands.push(band(reverseMaxDistance, 'reverse'));
  }

  return bands;
}

/**
 * Builds the drawable load rectangles for a pattern.
 *
 * The inclusion rules are the Python's, quirks included: total_oil is truncated
 * toward zero before the non-zero test, so a load of "0.5" is dropped. Reverse
 * rows additionally survive when distance_end is 0.
 */
export function toLoadRects(pattern: Pick<Pattern, 'forwards_data' | 'reverse_data'>): LoadRectsResult {
  const rects: LoadRect[] = [];
  const skipped: LoadRectsResult['skipped'] = [];
  let forwardsMaxDistance = 0;
  let reverseMaxDistance = 0;

  (pattern.forwards_data ?? []).forEach((row, index) => {
    const rect = toRect(row, 'forward');
    if (typeof rect === 'string') {
      skipped.push({ pass: 'forward', index, reason: rect });
      return;
    }

    forwardsMaxDistance = Math.max(forwardsMaxDistance, rect.y0, rect.y1);
    if (Math.trunc(rect.totalOil) !== 0) {
      rects.push(rect);
    }
  });

  (pattern.reverse_data ?? []).forEach((row, index) => {
    const rect = toRect(row, 'reverse');
    if (typeof rect === 'string') {
      skipped.push({ pass: 'reverse', index, reason: rect });
      return;
    }

    reverseMaxDistance = Math.max(reverseMaxDistance, rect.y0, rect.y1);
    if (Math.trunc(rect.totalOil) !== 0 || rect.y1 === 0) {
      rects.push(rect);
    }
  });

  return { rects, forwardsMaxDistance, reverseMaxDistance, skipped };
}

/**
 * Per-cell weight a load contributes.
 *
 * Coverage counts passes, which is what the existing charts show through
 * overlapping translucent fills. Thickness uses mics where the scraper supplied
 * it and falls back to spreading total_oil over the load's area — it is only
 * meaningful once the mics field has been verified to be per-pass microns.
 */
function weightFor(rect: LoadRect, model: OilModel, reverseWeight: number): number {
  if (rect.kind === 'base') {
    return rect.pass === 'forward' ? FORWARD_BAND_WEIGHT : REVERSE_BAND_WEIGHT;
  }

  const passWeight = rect.pass === 'forward' ? 1 : reverseWeight;

  if (model === 'coverage') {
    return passWeight;
  }

  if (rect.mics !== null && rect.mics > 0) {
    return rect.mics;
  }

  const area = (rect.x1 - rect.x0) * (rect.y1 - rect.y0);
  return area > 0 ? rect.totalOil / area : 0;
}

/** Accumulates load rectangles into a scalar field over the lane. */
export function buildOilField(rects: LoadRect[], options: OilFieldOptions = {}): OilField {
  const model = options.model ?? 'coverage';
  const slicesPerFoot = options.slicesPerFoot ?? DEFAULT_SLICES_PER_FOOT;
  const reverseWeight = options.reverseWeight ?? DEFAULT_REVERSE_WEIGHT;

  const units = LANE_UNITS;
  const slices = Math.round(LANE_LENGTH_FT * slicesPerFoot);
  const data = new Float32Array(units * slices);

  for (const rect of rects) {
    const weight = weightFor(rect, model, reverseWeight);
    if (weight <= 0) {
      continue;
    }

    const xFrom = Math.max(0, Math.floor(rect.x0));
    const xTo = Math.min(units, Math.ceil(rect.x1));
    const yFrom = Math.max(0, Math.floor(rect.y0 * slicesPerFoot));
    const yTo = Math.min(slices, Math.ceil(rect.y1 * slicesPerFoot));

    for (let y = yFrom; y < yTo; y++) {
      const rowOffset = y * units;
      for (let x = xFrom; x < xTo; x++) {
        data[rowOffset + x] += weight;
      }
    }
  }

  let max = 0;

  for (const entry of data) {
    if (entry > max) {
      max = entry;
    }
  }
  return { units, slices, slicesPerFoot, data, max, model };
}

/** Convenience: pattern straight through to a field, base bands included. */
export function patternToOilField(pattern: Pick<Pattern, 'forwards_data' | 'reverse_data'>, options: OilFieldOptions = {}): OilField {
  return buildOilField(toDrawableRects(pattern), options);
}

/** Normalised value in [0, 1] at a lane-axis unit and slice. */
export function sampleOilField(field: OilField, x: number, slice: number): number {
  if (field.max <= 0 || x < 0 || x >= field.units || slice < 0 || slice >= field.slices) {
    return 0;
  }

  return field.data[slice * field.units + x] / field.max;
}
