import { Injectable, signal, inject } from '@angular/core';
import { Pattern } from 'src/app/core/models/pattern.model';
import { CacheService } from 'src/app/core/services/cache/cache.service';
import { NetworkService } from 'src/app/core/services/network/network.service';
import { PatternService } from 'src/app/core/services/pattern/pattern.service';

@Injectable({ providedIn: 'root' })
export class PatternsStore {
  private patternService = inject(PatternService);
  private cacheService = inject(CacheService);
  private networkService = inject(NetworkService);

  #allPatterns = signal<Partial<Pattern>[]>([]);
  #patternImageMap = signal<Record<string, string>>({});
  #isUsingCache = signal<boolean>(false);

  get allPatterns() {
    return this.#allPatterns;
  }

  get isUsingCache() {
    return this.#isUsingCache;
  }

  get patternImageMap() {
    return this.#patternImageMap;
  }

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

  async loadPatternImageMap(forceRefresh = false): Promise<void> {
    const cacheKey = 'pattern_image_map';

    try {
      if (!forceRefresh) {
        const cached = await this.cacheService.get<Record<string, string>>(cacheKey);
        const isCacheValid = await this.cacheService.isValid(cacheKey);

        if (cached && (isCacheValid || this.networkService.isOffline)) {
          this.#patternImageMap.set(cached);
          if (this.networkService.isOnline && (await this.cacheService.isStale(cacheKey))) {
            this.refreshPatternImageMapInBackground(cacheKey);
          }
          return;
        }
      }

      if (this.networkService.isOffline) {
        return;
      }

      const response = await this.patternService.getAllPatternCharts();
      const patterns = response.patterns;
      const imageMap: Record<string, string> = {};
      for (const pattern of patterns) {
        if (pattern.title && pattern.chart_horizontal) {
          imageMap[pattern.title] = pattern.chart_horizontal;
        }
      }
      this.#patternImageMap.set(imageMap);
      await this.cacheService.set(cacheKey, imageMap);
    } catch (error) {
      console.error('Error loading pattern image map:', error);
      const cached = await this.cacheService.get<Record<string, string>>(cacheKey);
      if (cached) {
        this.#patternImageMap.set(cached);
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

  private async refreshPatternImageMapInBackground(cacheKey: string): Promise<void> {
    try {
      const response = await this.patternService.getAllPatternCharts();
      const patterns = response.patterns;

      const imageMap: Record<string, string> = {};
      for (const pattern of patterns) {
        if (pattern.title && pattern.chart_horizontal) {
          imageMap[pattern.title] = pattern.chart_horizontal;
        }
      }
      this.#patternImageMap.set(imageMap);
      await this.cacheService.set(cacheKey, imageMap);
    } catch (error) {
      console.error('Background refresh failed for pattern image map:', error);
    }
  }
}
