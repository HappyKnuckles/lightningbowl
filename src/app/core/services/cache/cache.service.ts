import { Injectable, inject } from '@angular/core';
import { Storage } from '@ionic/storage-angular';
import { CacheEntry, CacheMetadata, DEFAULT_CACHE_CONFIG } from '../../models/cache.model';

@Injectable({
  providedIn: 'root',
})
export class CacheService {
  private storage = inject(Storage);

  /**
   * Store data in cache with metadata
   */
  async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    if (Array.isArray(data) && data.length === 0) {
      return;
    }
    const now = Date.now();
    const cacheEntry: CacheEntry<T> = {
      data,
      metadata: {
        lastUpdated: now,
        version: '1.0',
        expires: now + (ttl || DEFAULT_CACHE_CONFIG.defaultTTL),
      },
    };

    await this.storage.set(`cache_${key}`, cacheEntry);
  }

  /**
   * Get data from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cacheEntry: CacheEntry<T> = await this.storage.get(`cache_${key}`);
      if (!cacheEntry) {
        return null;
      }

      if (Date.now() > cacheEntry.metadata.expires) {
        await this.delete(key);
        return null;
      }

      return cacheEntry.data;
    } catch (error) {
      console.error(`Error retrieving cache for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Get cache metadata
   */
  async getMetadata(key: string): Promise<CacheMetadata | null> {
    try {
      const cacheEntry: CacheEntry<unknown> = await this.storage.get(`cache_${key}`);
      return cacheEntry?.metadata || null;
    } catch (error) {
      console.error(`Error retrieving cache metadata for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Check if cache entry exists and is valid
   */
  async isValid(key: string): Promise<boolean> {
    const metadata = await this.getMetadata(key);
    if (!metadata) {
      return false;
    }
    return Date.now() <= metadata.expires;
  }

  /**
   * Check if cache entry is stale but not expired
   */
  async isStale(key: string, maxAge?: number): Promise<boolean> {
    const metadata = await this.getMetadata(key);
    if (!metadata) {
      return true;
    }

    const age = Date.now() - metadata.lastUpdated;
    const maxAgeLimit = maxAge || DEFAULT_CACHE_CONFIG.maxAge;

    return age > maxAgeLimit;
  }

  /**
   * Delete cache entry
   */
  async delete(key: string): Promise<void> {
    await this.storage.remove(`cache_${key}`);
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    const keys = await this.storage.keys();
    const cacheKeys = keys.filter((key) => key.startsWith('cache_'));
    await Promise.all(cacheKeys.map((key) => this.storage.remove(key)));
  }

  /**
   * Get cache size information
   */
  async getCacheInfo(): Promise<{ count: number; keys: string[] }> {
    const keys = await this.storage.keys();
    const cacheKeys = keys.filter((key) => key.startsWith('cache_'));
    return {
      count: cacheKeys.length,
      keys: cacheKeys.map((key) => key.replace('cache_', '')),
    };
  }
}
