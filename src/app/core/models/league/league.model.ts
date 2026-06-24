import { generateId } from 'src/app/core/utils/id-utils/id.utils';
import { HandicapConfig, createDefaultHandicapConfig } from './handicap.model';
import { Season } from './season.model';
import { TournamentConfig } from './tournament.model';

/** The current persisted schema version for a League aggregate. Bump on breaking changes. */
export const LEAGUE_SCHEMA_VERSION = 1;

export type LeagueEventType = 'League' | 'Tournament';

export const LEAGUE_EVENT_TYPES: LeagueEventType[] = ['League', 'Tournament'];

export type SanctioningBody = 'USBC' | 'DKB' | 'None';

export const SANCTIONING_BODIES: SanctioningBody[] = ['USBC', 'DKB', 'None'];

export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export const DAYS_OF_WEEK: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * How often a league meets. Not every league is weekly:
 * - `weekly`/`biweekly`/`monthly` derive the next night from `dayOfWeek` (+ `startDate` as
 *   the biweekly/monthly anchor).
 * - `custom` uses an explicit list of dates in `League.customDates`.
 */
export type ScheduleType = 'weekly' | 'biweekly' | 'monthly' | 'custom';

export const SCHEDULE_TYPES: ScheduleType[] = ['weekly', 'biweekly', 'monthly', 'custom'];

/** Format flags describing the league's competitive structure. */
export interface LeagueFormatFlags {
  scratch: boolean;
  team: boolean;
  doubles: boolean;
  singles: boolean;
  mixed: boolean;
}

/**
 * The League aggregate root. A single stored document owns its seasons (each of which
 * owns its weekly sessions, fees, payments, teams and standings), handicap config and
 * derived achievements. Games reference a league by `leagueId` (and, for backward
 * compatibility, still by `name` via `Game.league`).
 */
export interface League {
  id: string;
  name: string;
  eventType: LeagueEventType;
  bowlingCenter?: string;
  description?: string;
  notes?: string;
  active: boolean;
  startDate?: number;
  endDate?: number;
  dayOfWeek?: DayOfWeek;
  /** Start time as "HH:mm". */
  startTime?: string;
  /** Meeting cadence; defaults to weekly. */
  scheduleType?: ScheduleType;
  /** Explicit league-night dates (epoch ms) when `scheduleType` is `custom`. */
  customDates?: number[];
  lanePattern?: string;
  numberOfGamesPerNight: number;
  formatFlags: LeagueFormatFlags;
  sanctioningBody: SanctioningBody;
  website?: string;
  contactInformation?: string;
  logo?: string;
  /** Accent color (hex) used for the league card / charts. */
  color?: string;
  handicap: HandicapConfig;
  seasons: Season[];
  /** Present when eventType === 'Tournament'. */
  tournament?: TournamentConfig;
  createdAt: number;
  updatedAt: number;
  schemaVersion: number;
  /** Original string-league name, kept when this aggregate was auto-migrated. */
  legacyName?: string;
}

export function createDefaultFormatFlags(): LeagueFormatFlags {
  return { scratch: true, team: false, doubles: false, singles: true, mixed: false };
}

/**
 * Factory for a new League aggregate with sensible defaults. Pass overrides via `partial`.
 */
export function createLeague(name: string, partial: Partial<League> = {}): League {
  const now = Date.now();
  return {
    id: partial.id ?? generateId('lg'),
    name,
    eventType: 'League',
    active: true,
    scheduleType: 'weekly',
    numberOfGamesPerNight: 3,
    formatFlags: createDefaultFormatFlags(),
    sanctioningBody: 'None',
    handicap: createDefaultHandicapConfig(),
    seasons: [],
    createdAt: now,
    updatedAt: now,
    schemaVersion: LEAGUE_SCHEMA_VERSION,
    ...partial,
  };
}
