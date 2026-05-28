export const STORAGE_PREFIX = {
  game: 'game',
  league: 'league',
  arsenal: 'arsenal',
} as const;

export const StorageKeys = {
  game: (gameId: string): string => `${STORAGE_PREFIX.game}${gameId}`,
  league: (leagueName: string): string => `${STORAGE_PREFIX.league}_${leagueName}`,
  arsenal: (ballId: string | number, coreWeight: string | number): string => `${STORAGE_PREFIX.arsenal}_${ballId}_${coreWeight}`,
} as const;
