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
  defaultTTL: number;
  maxAge: number;
}

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  defaultTTL: 24 * 60 * 60 * 1000,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

/** Patterns rarely change – cache for 7 days and use stale-while-revalidate */
export const PATTERN_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

/** Background-refresh patterns after 1 day (while still within 7-day TTL) */
export const PATTERN_STALE_AGE = 1 * 24 * 60 * 60 * 1000;

/** Ball pages change irregularly – cache for 24 hours */
export const BALL_CACHE_TTL = 24 * 60 * 60 * 1000;

/** Background-refresh ball pages after 12 hours (while still within 24-hour TTL) */
export const BALL_STALE_AGE = 12 * 60 * 60 * 1000;

/** Ball metadata (brands, cores, coverstocks) changes infrequently – cache for 7 days */
export const BALL_METADATA_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
