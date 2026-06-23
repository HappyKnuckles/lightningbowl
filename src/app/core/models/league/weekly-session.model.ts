/**
 * How the bowler participated in a given league night.
 */
export type AttendanceStatus = 'present' | 'absent' | 'preBowled' | 'postBowled' | 'substitute' | 'vacancy';

/**
 * A single league night within a season.
 */
export interface WeeklySession {
  id: string;
  /** 1-based week number within the season. */
  weekNumber: number;
  /** Epoch ms of the night (normalized to start of day for grouping). */
  date: number;
  oilPattern?: string;
  gamesScheduled: number;
  gamesBowled: number;
  /** Blind/absentee score used when the bowler missed. */
  blindScore?: number;
  attendance: AttendanceStatus;
  /** Number of make-up games bowled outside the regular night. */
  makeUpGames?: number;
  /** Ids of the games (from GamesStore) bowled this session. */
  gameIds: string[];
  notes?: string;
}

export const ATTENDANCE_PRESENT_STATUSES: AttendanceStatus[] = ['present', 'preBowled', 'postBowled', 'substitute'];
