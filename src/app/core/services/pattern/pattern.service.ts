import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Pattern } from '../../models/pattern.model';
import { firstValueFrom, retry } from 'rxjs';
import { environment } from 'src/environments/environment';
import { CacheService } from '../cache/cache.service';
import { NetworkService } from '../network/network.service';
import { PATTERN_CACHE_TTL } from '../../models/cache.model';

interface SearchResult {
  patterns: Pattern[];
  count: number;
  query: string;
  numeric_query: boolean;
  threshold: number;
}

interface AllPatternsResult {
  total: number;
  patterns: Pattern[];
  page?: number;
  per_page?: number;
}

interface PatternChartsResult {
  count: number;
  patterns: {
    url: string;
    title: string;
    chart_standard: string;
    chart_horizontal: string;
  }[];
}

@Injectable({
  providedIn: 'root',
})
export class PatternService {
  constructor(
    private http: HttpClient,
    private cacheService: CacheService,
    private networkService: NetworkService,
  ) {}

  async getAllPatternCharts(): Promise<PatternChartsResult> {
    const cacheKey = 'pattern_charts';

    try {
      const cachedCharts = await this.cacheService.get<PatternChartsResult>(cacheKey);
      if (cachedCharts) {
        return cachedCharts;
      }

      if (this.networkService.isOffline) {
        const staleCharts = await this.cacheService.getStale<PatternChartsResult>(cacheKey);
        if (staleCharts) {
          return staleCharts;
        }
        return { count: 0, patterns: [] };
      }

      const response = await firstValueFrom(
        this.http.get<PatternChartsResult>(`${environment.patternEndpoint}patterns/charts`).pipe(retry({ count: 5, delay: 2000 })),
      );

      if (response.count !== 0) {
        await this.cacheService.set(cacheKey, response, PATTERN_CACHE_TTL);
      }

      return response;
    } catch (error) {
      console.error('Error fetching pattern charts:', error);
      const staleCharts = await this.cacheService.getStale<PatternChartsResult>(cacheKey);
      return staleCharts ?? { count: 0, patterns: [] };
    }
  }

  async getPatterns(page: number, forceRefresh = false): Promise<AllPatternsResult> {
    const cacheKey = `patterns_page_${page}`;

    try {
      if (!forceRefresh) {
        const cachedPatterns = await this.cacheService.get<AllPatternsResult>(cacheKey);
        if (cachedPatterns) {
          return cachedPatterns;
        }
      }

      if (this.networkService.isOffline) {
        const stalePatterns = await this.cacheService.getStale<AllPatternsResult>(cacheKey);
        return stalePatterns ?? { total: 0, patterns: [] };
      }

      const response = await firstValueFrom(
        this.http.get<AllPatternsResult>(`${environment.patternEndpoint}patterns?page=${page}`).pipe(retry({ count: 5, delay: 2000 })),
      );

      if (response.total !== 0) {
        await this.cacheService.set(cacheKey, response, PATTERN_CACHE_TTL);
      }

      return response;
    } catch (error) {
      console.error('Error fetching patterns:', error);

      const stalePatterns = await this.cacheService.getStale<AllPatternsResult>(cacheKey);
      return stalePatterns ?? { total: 0, patterns: [] };
    }
  }

  async getAllPatternsStripped(): Promise<Partial<Pattern>[]> {
    const cacheKey = 'all_patterns_stripped';

    try {
      const cached = await this.cacheService.get<Partial<Pattern>[]>(cacheKey);
      if (cached) {
        return cached;
      }

      if (this.networkService.isOffline) {
        const stale = await this.cacheService.getStale<Partial<Pattern>[]>(cacheKey);
        return stale ?? [];
      }

      const response = await firstValueFrom(
        this.http
          .get<{ count: number; patterns: Partial<Pattern>[] }>(`${environment.patternEndpoint}patterns/all-stripped`)
          .pipe(retry({ count: 5, delay: 2000 })),
      );

      if (response.patterns.length !== 0) {
        await this.cacheService.set(cacheKey, response.patterns, PATTERN_CACHE_TTL);
      }

      return response.patterns;
    } catch (error) {
      console.error('Error fetching stripped patterns:', error);
      const stale = await this.cacheService.getStale<Partial<Pattern>[]>(cacheKey);
      return stale ?? [];
    }
  }

  async getAllPatterns(): Promise<Pattern[]> {
    const cacheKey = 'all_patterns_full';

    try {
      const cached = await this.cacheService.get<Pattern[]>(cacheKey);
      if (cached) {
        return cached;
      }

      if (this.networkService.isOffline) {
        const stale = await this.cacheService.getStale<Pattern[]>(cacheKey);
        return stale ?? [];
      }

      const response = await firstValueFrom(
        this.http.get<{ count: number; patterns: Pattern[] }>(`${environment.patternEndpoint}patterns/all`).pipe(retry({ count: 5, delay: 2000 })),
      );

      if (response.patterns.length !== 0) {
        await this.cacheService.set(cacheKey, response.patterns, PATTERN_CACHE_TTL);
      }

      return response.patterns;
    } catch (error) {
      console.error('Error fetching all patterns:', error);
      const stale = await this.cacheService.getStale<Pattern[]>(cacheKey);
      return stale ?? [];
    }
  }

  async getPatternCategories(): Promise<string[]> {
    const cacheKey = 'pattern_categories';

    try {
      const cached = await this.cacheService.get<string[]>(cacheKey);
      if (cached) {
        return cached;
      }

      if (this.networkService.isOffline) {
        const stale = await this.cacheService.getStale<string[]>(cacheKey);
        return stale ?? [];
      }

      const response = await firstValueFrom(this.http.get<string[]>(`${environment.patternEndpoint}categories`));

      if (response.length !== 0) {
        await this.cacheService.set(cacheKey, response, PATTERN_CACHE_TTL);
      }

      return response;
    } catch (error) {
      console.error('Error fetching pattern categories:', error);
      const stale = await this.cacheService.getStale<string[]>(cacheKey);
      return stale ?? [];
    }
  }

  async getPatternData(url: string): Promise<Pattern> {
    const cacheKey = `pattern_data_${encodeURIComponent(url)}`;

    try {
      const cached = await this.cacheService.get<Pattern>(cacheKey);
      if (cached) {
        return cached;
      }

      if (this.networkService.isOffline) {
        const stale = await this.cacheService.getStale<Pattern>(cacheKey);
        return stale ?? ({} as Pattern);
      }

      const response = await firstValueFrom(this.http.get<Pattern>(`${environment.patternEndpoint}patterns/${url}`));
      await this.cacheService.set(cacheKey, response, PATTERN_CACHE_TTL);
      return response;
    } catch (error) {
      console.error('Error fetching pattern data:', error);
      const stale = await this.cacheService.getStale<Pattern>(cacheKey);
      return stale ?? ({} as Pattern);
    }
  }

  async getPatternStats() {
    const cacheKey = 'pattern_stats';

    try {
      const cached = await this.cacheService.get<unknown>(cacheKey);
      if (cached) {
        return cached;
      }

      if (this.networkService.isOffline) {
        const stale = await this.cacheService.getStale<unknown>(cacheKey);
        return stale ?? {};
      }

      const response = await firstValueFrom(this.http.get(`${environment.patternEndpoint}stats`));
      await this.cacheService.set(cacheKey, response, PATTERN_CACHE_TTL);
      return response;
    } catch (error) {
      console.error('Error fetching pattern stats:', error);
      const stale = await this.cacheService.getStale<unknown>(cacheKey);
      return stale ?? {};
    }
  }

  async searchPattern(searchTerm: string, include_metadata = false): Promise<SearchResult> {
    const cacheKey = `pattern_search_${encodeURIComponent(searchTerm)}`;

    try {
      const cachedResult = await this.cacheService.get<SearchResult>(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      if (this.networkService.isOffline) {
        const staleResult = await this.cacheService.getStale<SearchResult>(cacheKey);
        if (staleResult) {
          return staleResult;
        }
        console.warn('Cannot search patterns: offline and no cached data available');
        return { patterns: [], count: 0, query: searchTerm, numeric_query: false, threshold: 0 };
      }

      const response = await firstValueFrom(
        this.http.get<SearchResult>(`${environment.patternEndpoint}search?q=${searchTerm}&include_metadata=${include_metadata}`),
      );

      await this.cacheService.set(cacheKey, response, PATTERN_CACHE_TTL);

      return response;
    } catch (error) {
      console.error('Error searching patterns:', error);

      const staleResult = await this.cacheService.getStale<SearchResult>(cacheKey);
      if (staleResult) {
        return staleResult;
      }

      return { patterns: [], count: 0, query: '', numeric_query: false, threshold: 0 };
    }
  }

  async addPattern(pattern: Partial<Pattern>): Promise<void> {
    try {
      await firstValueFrom(this.http.post<Partial<Pattern>>(`${environment.patternEndpoint}add-pattern`, pattern));
    } catch (error) {
      console.error('Error adding pattern:', error);
    }
  }
}
