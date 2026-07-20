/**
 * A league as persisted. Legacy records were plain name strings; they are
 * normalized on load and belong to the default bowler until the migration
 * stamps them.
 */
export interface LeagueRecord {
  name: string;
  bowlerIds: string[];
}
