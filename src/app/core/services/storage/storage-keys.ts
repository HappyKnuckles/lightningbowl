export const STORAGE_PREFIX = {
  game: 'game',
  league: 'league',
  // Distinct from `league` on purpose: `'lg-entity_x'.startsWith('league')` is false, so
  // legacy `loadByPrefix('league')` scans never pick up rich League aggregates.
  leagueEntity: 'lg-entity',
  arsenal: 'arsenal',
} as const;

/** Persisted meta keys (migrations, etc.). */
export const META_KEYS = {
  leagueMigrationVersion: 'meta_league-migration-version',
} as const;

export const StorageKeys = {
  game: (gameId: string): string => `${STORAGE_PREFIX.game}${gameId}`,
  league: (leagueName: string): string => `${STORAGE_PREFIX.league}_${leagueName}`,
  leagueEntity: (leagueId: string): string => `${STORAGE_PREFIX.leagueEntity}_${leagueId}`,
  arsenal: (ballId: string | number, coreWeight: string | number): string => `${STORAGE_PREFIX.arsenal}_${ballId}_${coreWeight}`,
} as const;
