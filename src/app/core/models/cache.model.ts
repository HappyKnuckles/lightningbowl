export interface CacheMetadata {
  lastUpdated: number;
  version: string;
  expires: number;
}

export interface CacheEntry<T> {
  data: T;
  metadata: CacheMetadata;
}

export interface CacheConfig {
  /** Hard expiry. Past this, `CacheService.get` drops the entry and callers refetch. */
  defaultTTL: number;
  /**
   * Staleness window for background revalidation. Must stay **below** `defaultTTL`:
   * an entry older than `defaultTTL` is already gone by the time `isStale` is asked,
   * so a `maxAge` at or above it makes the stale-while-revalidate path unreachable.
   */
  maxAge: number;
}

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  defaultTTL: 24 * 60 * 60 * 1000,
  maxAge: 12 * 60 * 60 * 1000,
};
