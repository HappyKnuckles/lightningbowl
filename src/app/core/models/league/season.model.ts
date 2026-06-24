import { FeeStructure, Payment, Winning, createEmptyFeeStructure } from './finance.model';
import { WeeklySession } from './weekly-session.model';

/**
 * A season is a single competitive run of a league (e.g. "2024/25 Winter").
 * Leagues can hold many seasons; historical seasons are kept for long-term tracking.
 */
export interface Season {
  id: string;
  /** 1-based ordinal within the league. */
  seasonNumber: number;
  /** Display name, e.g. "2024 Summer League". */
  seasonName: string;
  startDate?: number;
  endDate?: number;
  active: boolean;
  completed: boolean;
  weeksScheduled: number;
  weeksCompleted: number;
  playoffWeeks: number;
  positionRoundWeeks: number;
  notes?: string;
  fees: FeeStructure;
  sessions: WeeklySession[];
  payments: Payment[];
  winnings: Winning[];
}

export function createSeason(id: string, seasonNumber: number, seasonName: string, partial: Partial<Season> = {}): Season {
  return {
    id,
    seasonNumber,
    seasonName,
    active: true,
    completed: false,
    weeksScheduled: 0,
    weeksCompleted: 0,
    playoffWeeks: 0,
    positionRoundWeeks: 0,
    fees: createEmptyFeeStructure(),
    sessions: [],
    payments: [],
    winnings: [],
    ...partial,
  };
}
