export const STORAGE_PREFIX = {
  game: 'game',
  league: 'league',
  arsenal: 'arsenal',
  searchHistory: 'search_history',
} as const;

export const StorageKeys = {
  game: (gameId: string): string => `${STORAGE_PREFIX.game}${gameId}`,
  league: (leagueName: string): string => `${STORAGE_PREFIX.league}_${leagueName}`,
  /** One arsenal ball, by its `arsenalId`. */
  arsenal: (arsenalId: string): string => `${STORAGE_PREFIX.arsenal}_${arsenalId}`,
  /** Where an arsenal ball was stored before arsenal balls had their own id (one per ball and weight). */
  legacyArsenal: (ballId: string | number, coreWeight: string | number): string => `${STORAGE_PREFIX.arsenal}_${ballId}_${coreWeight}`,
  searchHistory: (context: string): string => `${STORAGE_PREFIX.searchHistory}_${context}`,
  ballCache: 'ball_cache',
} as const;

// Single-record keys.
export const SETTINGS_KEYS = {
  bowlerFit: 'bowler_fit',
  layoutPresets: 'layout_presets',
} as const;
