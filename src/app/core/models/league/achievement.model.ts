/**
 * Milestones and personal records derived from a bowler's games. Achievements are
 * *computed* from game history (never hand-stored), which keeps them idempotent and
 * always in sync with the underlying data.
 */
export type AchievementType =
  | 'first200'
  | 'first600Series'
  | 'first700Series'
  | 'firstCleanGame'
  | 'perfectGame'
  | 'honorScore'
  | 'highGame'
  | 'highSeries'
  | 'personalBestAverage';

export interface Achievement {
  type: AchievementType;
  /** Human-readable label, e.g. "First 600 Series". */
  label: string;
  /** The score/value associated with the milestone (e.g. 612). */
  value: number;
  /** When it was achieved (epoch ms), if tied to a specific game/series. */
  date?: number;
  /** The game that earned it, when applicable. */
  gameId?: string;
  /** Optional secondary detail, e.g. series id or center. */
  detail?: string;
}
