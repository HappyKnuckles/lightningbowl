import { Injectable, signal } from '@angular/core';
import { Pattern } from 'src/app/core/models/pattern.model';
import { PatternService } from 'src/app/core/services/pattern/pattern.service';
import { CacheService } from 'src/app/core/services/cache/cache.service';
import { NetworkService } from 'src/app/core/services/network/network.service';

@Injectable({ providedIn: 'root' })
export class PatternsStore {
  #allPatterns = signal<Partial<Pattern>[]>([]);
  #isUsingCache = signal<boolean>(false);

  get allPatterns() {
    return this.#allPatterns;
  }

  get isUsingCache() {
    return this.#isUsingCache;
  }

  constructor(
    private patternService: PatternService,
    private cacheService: CacheService,
    private networkService: NetworkService,
  ) {}

  async loadAllPatterns(forceRefresh = false): Promise<void> {
    const cacheKey = 'all_patterns';

    try {
      if (!forceRefresh) {
        const cachedPatterns = await this.cacheService.get<Pattern[]>(cacheKey);
        const isCacheValid = await this.cacheService.isValid(cacheKey);

        if (cachedPatterns && (isCacheValid || this.networkService.isOffline)) {
          this.#allPatterns.set(cachedPatterns);
          this.#isUsingCache.set(true);
          if (this.networkService.isOnline && (await this.cacheService.isStale(cacheKey))) {
            this.refreshPatternsInBackground(cacheKey);
          }
          return;
        }
      }

      if (this.networkService.isOffline) {
        console.warn('Cannot fetch patterns: offline and no valid cache available');
        return;
      }

      const response = await this.patternService.getAllPatternsStripped();
      this.#allPatterns.set(response);
      this.#isUsingCache.set(false);
      await this.cacheService.set(cacheKey, response);
    } catch (error) {
      console.error('Error fetching patterns:', error);

      const cachedPatterns = await this.cacheService.get<Pattern[]>(cacheKey);
      if (cachedPatterns) {
        this.#allPatterns.set(cachedPatterns);
        this.#isUsingCache.set(true);
      }
    }
  }

  private async refreshPatternsInBackground(cacheKey?: string): Promise<void> {
    try {
      const response = await this.patternService.getAllPatternsStripped();
      this.#allPatterns.set(response);
      this.#isUsingCache.set(false);
      if (cacheKey) {
        await this.cacheService.set(cacheKey, response);
      }
    } catch (error) {
      console.error('Background refresh failed for patterns:', error);
    }
  }
}
