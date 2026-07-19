export const STORAGE_PREFIX = {
  game: 'game',
  league: 'league',
  arsenal: 'arsenal',
  searchHistory: 'search_history',
  bowler: 'bowler',
} as const;

export const StorageKeys = {
  game: (gameId: string): string => `${STORAGE_PREFIX.game}${gameId}`,
  league: (leagueName: string): string => `${STORAGE_PREFIX.league}_${leagueName}`,
  arsenal: (ballId: string | number, coreWeight: string | number): string => `${STORAGE_PREFIX.arsenal}_${ballId}_${coreWeight}`,
  searchHistory: (context: string): string => `${STORAGE_PREFIX.searchHistory}_${context}`,
  bowler: (bowlerId: string): string => `${STORAGE_PREFIX.bowler}_${bowlerId}`,
} as const;

// Single-record keys for the bowler migration; games without a bowlerId belong to the default bowler.
export const BOWLER_KEYS = {
  defaultBowler: 'default_bowler_id',
  migrationV1: 'migration_bowlers_v1',
} as const;
