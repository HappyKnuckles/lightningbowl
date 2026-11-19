import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Pattern, PatternSummary } from '../../models/pattern.model';
import { firstValueFrom, retry } from 'rxjs';
import { environment } from 'src/environments/environment';
import { CacheService } from '../cache/cache.service';
import { NetworkService } from '../network/network.service';

interface SearchResult {
  patterns: Pattern[];
  count: number;
  query: string;
  numeric_query: boolean;
  threshold: number;
}

interface AllPatternsResult {
  total: number;
  patterns: PatternSummary[];
  page?: number;
  per_page?: number;
}

/** Patterns per page of the pattern list, browsing or searching. */
export const PATTERN_PAGE_SIZE = 50;

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
    try {
      const response = await firstValueFrom(
        this.http.get<PatternChartsResult>(`${environment.patternEndpoint}patterns/charts`).pipe(retry({ count: 5, delay: 2000 })),
      );
      return response;
    } catch (error) {
      console.error('Error fetching pattern charts:', error);
      return { count: 0, patterns: [] };
    }
  }

  /**
   * One page of the pattern list, without the oil rows (`getPatternData` has them): every pattern,
   * or the matches of `searchTerm`. The API searches, sorts and pages, so a search never loads more
   * than a page.
   */
  async getPatterns(page: number, forceRefresh = false, sortField = 'title', sortDirection = 'asc', searchTerm = ''): Promise<AllPatternsResult> {
    const term = searchTerm.trim();
    const cacheKey = term
      ? `patterns_search_${encodeURIComponent(term.toLowerCase())}_${page}_${sortField}_${sortDirection}`
      : `patterns_page_${page}_${sortField}_${sortDirection}`;

    try {
      if (!forceRefresh) {
        const cachedPatterns = await this.cacheService.get<AllPatternsResult>(cacheKey);
        const isCacheValid = await this.cacheService.isValid(cacheKey);

        if (cachedPatterns && (isCacheValid || this.networkService.isOffline)) {
          return cachedPatterns;
        }
      }

      if (this.networkService.isOffline) {
        return { total: 0, patterns: [] };
      }

      const params: Record<string, string | number> = {
        page,
        per_page: PATTERN_PAGE_SIZE,
        sort_field: sortField,
        sort_direction: sortDirection,
        include_oil: 'false',
      };
      if (term) params['q'] = term;
      const response = await firstValueFrom(
        this.http.get<AllPatternsResult>(`${environment.patternEndpoint}patterns`, { params }).pipe(retry({ count: 3, delay: 2000 })),
      );

      if (response.total !== 0) {
        // a search goes stale sooner than the list it narrows
        await this.cacheService.set(cacheKey, response, (term ? 2 : 24) * 60 * 60 * 1000);
      }

      return response;
    } catch (error) {
      console.error('Error fetching patterns:', error);

      const cachedPatterns = await this.cacheService.get<AllPatternsResult>(cacheKey);
      if (cachedPatterns) {
        return cachedPatterns;
      }

      return { total: 0, patterns: [] };
    }
  }

  async getAllPatternsStripped(): Promise<Partial<Pattern>[]> {
    try {
      const response = await firstValueFrom(
        this.http
          .get<{ count: number; patterns: Partial<Pattern>[] }>(`${environment.patternEndpoint}patterns/all-stripped`)
          .pipe(retry({ count: 5, delay: 2000 })),
      );
      return response.patterns;
    } catch (error) {
      console.error('Error fetching stripped patterns:', error);
      return [];
    }
  }

  async getPatternCategories(): Promise<string[]> {
    try {
      const response = await firstValueFrom(this.http.get<string[]>(`${environment.patternEndpoint}categories`));
      return response;
    } catch (error) {
      console.error('Error fetching pattern categories:', error);
      return [];
    }
  }

  /** A pattern with its oil rows; kept for offline use, since a list only has the summary. */
  async getPatternData(url: string): Promise<Pattern> {
    const cacheKey = `pattern_${encodeURIComponent(url)}`;
    try {
      const cached = await this.cacheService.get<Pattern>(cacheKey);
      if (cached && ((await this.cacheService.isValid(cacheKey)) || this.networkService.isOffline)) {
        return cached;
      }
      const response = await firstValueFrom(this.http.get<Pattern>(`${environment.patternEndpoint}patterns/${url}`));
      if (response?.url) await this.cacheService.set(cacheKey, response);
      return response;
    } catch (error) {
      console.error('Error fetching pattern data:', error);
      return (await this.cacheService.get<Pattern>(cacheKey)) ?? ({} as Pattern);
    }
  }

  async getPatternStats() {
    try {
      const response = await firstValueFrom(this.http.get(`${environment.patternEndpoint}stats`));
      return response;
    } catch (error) {
      console.error('Error fetching pattern stats:', error);
      return {};
    }
  }

  async searchPattern(searchTerm: string, include_metadata = false, sortField = 'title', sortDirection = 'asc'): Promise<SearchResult> {
    const cacheKey = `pattern_search_${encodeURIComponent(searchTerm)}_${sortField}_${sortDirection}`;

    try {
      const cachedResult = await this.cacheService.get<SearchResult>(cacheKey);
      const isCacheValid = await this.cacheService.isValid(cacheKey);

      if (cachedResult && (isCacheValid || this.networkService.isOffline)) {
        return cachedResult;
      }

      if (this.networkService.isOffline) {
        console.warn('Cannot search patterns: offline and no cached data available');
        return { patterns: [], count: 0, query: searchTerm, numeric_query: false, threshold: 0 };
      }

      const response = await firstValueFrom(
        this.http.get<SearchResult>(
          `${environment.patternEndpoint}search?q=${searchTerm}&include_metadata=${include_metadata}&sort_field=${sortField}&sort_direction=${sortDirection}`,
        ),
      );

      await this.cacheService.set(cacheKey, response, 2 * 60 * 60 * 1000); // 2 hours

      return response;
    } catch (error) {
      console.error('Error searching patterns:', error);

      // Try to use cached data as fallback
      const cachedResult = await this.cacheService.get<SearchResult>(cacheKey);
      if (cachedResult) {
        return cachedResult;
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
