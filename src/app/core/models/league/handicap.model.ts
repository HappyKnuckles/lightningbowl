/**
 * The handicap system used by a league/season.
 * - `scratch`     : no handicap (handicap is always 0).
 * - `percentOfBase`: handicap = round(percentage% * (baseScore - average)), floored at 0.
 *                    e.g. 90% of 220.
 * - `custom`       : reserved for user-defined formulas (described in `customFormula`).
 */
export type HandicapSystemType = 'scratch' | 'percentOfBase' | 'custom';

export interface HandicapConfig {
  system: HandicapSystemType;
  /** e.g. 90 for "90% of base". Ignored for scratch. */
  percentage: number;
  /** e.g. 220 for "90% of 220". Ignored for scratch. */
  baseScore: number;
  /** Free-text description of a custom system (no auto-calc applied). */
  customFormula?: string;
}

/** A point in the handicap history (recalculated as the average changes). */
export interface HandicapEntry {
  date: number;
  average: number;
  handicap: number;
}

export function createDefaultHandicapConfig(): HandicapConfig {
  return { system: 'scratch', percentage: 90, baseScore: 220 };
}
