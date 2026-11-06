/** A league runs over seasons; a tournament is a one-off event. */
export type LeagueType = 'league' | 'tournament';

/**
 * A season of a league. It runs from its start until the next season starts, and the first season
 * also takes every game played before it, so each game of a league with seasons is in exactly one.
 * Games aren't linked to a season: it follows from their date.
 */
export interface Season {
  id: string;
  name: string;
  /** Start of the day the season starts (ms). */
  start: number;
}

/**
 * A league or tournament. Games refer to it by name (`Game.league`), as they always have.
 * Leagues saved before this model existed were plain names and load as leagues without seasons.
 */
export interface League {
  name: string;
  type: LeagueType;
  /** Sorted by start. Empty when seasons aren't tracked for this league. */
  seasons: Season[];
  createdAt: number;
  /** Over: listed after the running events and not offered when adding games. */
  finished?: boolean;
  /** Sanctioned by a bowling association (USBC, DBU, …). */
  sanctioned?: boolean;
  note?: string;
  /** How handicap is given; absent for scratch events. */
  handicap?: HandicapRule;
  /**
   * Carried over from before leagues had a type, seasons and handicap, so it may not match how the
   * event is played. The user is asked to set it up; saving it in the league form clears this.
   */
  needsReview?: boolean;
}

/**
 * Handicap from the average: (basis − average) × percentage, rounded down, never below 0 and at
 * most `max`. The average is the bowler's average in the event before the day of the game (that
 * season's, when the league has seasons), or `startingAverage` until there is one.
 */
export interface HandicapRule {
  basis: number;
  /** 0–100. */
  percentage: number;
  max?: number;
  startingAverage?: number;
}

/** A season with the date range it covers. */
export interface SeasonRange {
  season: Season;
  /** Undefined for the first season, which takes everything before the second one. */
  from?: number;
  /** Exclusive end: the next season's start. Undefined for the current (last) season. */
  to?: number;
}
