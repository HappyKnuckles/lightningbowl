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
}

/** A season with the date range it covers. */
export interface SeasonRange {
  season: Season;
  /** Undefined for the first season, which takes everything before the second one. */
  from?: number;
  /** Exclusive end: the next season's start. Undefined for the current (last) season. */
  to?: number;
}
