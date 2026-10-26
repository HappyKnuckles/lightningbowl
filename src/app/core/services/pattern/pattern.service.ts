import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, Observable, retry } from 'rxjs';

import { CategoriesApi, PatternsApi, SearchApi, StatisticsApi } from '../../api/pattern-api';
import {
  Pattern,
  PatternCalculation,
  PatternChartList,
  PatternInput,
  PatternPage,
  PatternSearchResult,
  PatternSummary,
} from '../../models/pattern.model';
import { PatternSortField } from '../../models/sort.model';
import { CacheService } from '../cache/cache.service';
import { NetworkService } from '../network/network.service';

type SortField = Parameters<PatternsApi['getPatterns']>[2];
type SortDirection = Parameters<PatternsApi['getPatterns']>[3];

const SORT_FIELDS = new Set<string>(Object.values(PatternSortField));
const toSortField = (field: string): SortField => (SORT_FIELDS.has(field) ? (field as SortField) : undefined);
const toSortDirection = (direction: string): SortDirection => (direction === 'desc' ? 'desc' : 'asc');

/** Retries for requests that load the library in the background. */
const withRetry = <T>(request: Observable<T>) => request.pipe(retry({ count: 5, delay: 2000 }));

/**
 * The pattern library: the generated pattern API client (`src/app/core/api/pattern-api`) with
 * caching for offline use. Failures resolve to empty results, except for adding a pattern, where
 * the user needs to know.
 */
@Injectable({
  providedIn: 'root',
})
export class PatternService {
  readonly #patternsApi = inject(PatternsApi);
  readonly #searchApi = inject(SearchApi);
  readonly #categoriesApi = inject(CategoriesApi);
  readonly #statisticsApi = inject(StatisticsApi);
  readonly #cacheService = inject(CacheService);
  readonly #networkService = inject(NetworkService);

  async getAllPatternCharts(): Promise<PatternChartList> {
    try {
      return await firstValueFrom(withRetry(this.#patternsApi.getPatternCharts()));
    } catch (error) {
      console.error('Error fetching pattern charts:', error);
      return { count: 0, patterns: [] };
    }
  }

  async getPatterns(page: number, forceRefresh = false, sortField = 'title', sortDirection = 'asc'): Promise<Pick<PatternPage, 'patterns' | 'total'>> {
    const cacheKey = `patterns_page_${page}_${sortField}_${sortDirection}`;

    try {
      if (!forceRefresh) {
        const cachedPatterns = await this.#cacheService.get<PatternPage>(cacheKey);
        const isCacheValid = await this.#cacheService.isValid(cacheKey);

        if (cachedPatterns && (isCacheValid || this.#networkService.isOffline)) {
          return cachedPatterns;
        }
      }

      if (this.#networkService.isOffline) {
        return { total: 0, patterns: [] };
      }

      const response = await firstValueFrom(
        withRetry(this.#patternsApi.getPatterns(page, undefined, toSortField(sortField), toSortDirection(sortDirection))),
      );

      if (response.total !== 0) {
        await this.#cacheService.set(cacheKey, response, 24 * 60 * 60 * 1000);
      }

      return response;
    } catch (error) {
      console.error('Error fetching patterns:', error);

      const cachedPatterns = await this.#cacheService.get<PatternPage>(cacheKey);
      if (cachedPatterns) {
        return cachedPatterns;
      }

      return { total: 0, patterns: [] };
    }
  }

  async getAllPatternsStripped(): Promise<PatternSummary[]> {
    try {
      const response = await firstValueFrom(withRetry(this.#patternsApi.getAllPatternsStripped()));
      return response.patterns;
    } catch (error) {
      console.error('Error fetching stripped patterns:', error);
      return [];
    }
  }

  async getAllPatterns(): Promise<Pattern[]> {
    try {
      const response = await firstValueFrom(withRetry(this.#patternsApi.getAllPatterns()));
      return response.patterns;
    } catch (error) {
      console.error('Error fetching all patterns:', error);
      return [];
    }
  }

  async getPatternCategories(): Promise<string[]> {
    try {
      return await firstValueFrom(this.#categoriesApi.getCategories());
    } catch (error) {
      console.error('Error fetching pattern categories:', error);
      return [];
    }
  }

  async getPatternData(url: string): Promise<Pattern> {
    try {
      return await firstValueFrom(this.#patternsApi.getPatternByUrl(url));
    } catch (error) {
      console.error('Error fetching pattern data:', error);
      return {} as Pattern;
    }
  }

  async getPatternStats() {
    try {
      return await firstValueFrom(this.#statisticsApi.getPatternStats());
    } catch (error) {
      console.error('Error fetching pattern stats:', error);
      return {};
    }
  }

  async searchPattern(searchTerm: string, include_metadata = false, sortField = 'title', sortDirection = 'asc'): Promise<PatternSearchResult> {
    // with and without the oil rows are different results
    const cacheKey = `pattern_search_${encodeURIComponent(searchTerm)}_${sortField}_${sortDirection}${include_metadata ? '_full' : ''}`;

    try {
      const cachedResult = await this.#cacheService.get<PatternSearchResult>(cacheKey);
      const isCacheValid = await this.#cacheService.isValid(cacheKey);

      if (cachedResult && (isCacheValid || this.#networkService.isOffline)) {
        return cachedResult;
      }

      if (this.#networkService.isOffline) {
        console.warn('Cannot search patterns: offline and no cached data available');
        return { patterns: [], count: 0, query: searchTerm };
      }

      const response = await firstValueFrom(
        this.#searchApi.searchPatterns(searchTerm, undefined, include_metadata, toSortField(sortField), toSortDirection(sortDirection)),
      );

      await this.#cacheService.set(cacheKey, response, 2 * 60 * 60 * 1000);

      return response;
    } catch (error) {
      console.error('Error searching patterns:', error);

      const cachedResult = await this.#cacheService.get<PatternSearchResult>(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      return { patterns: [], count: 0, query: '' };
    }
  }

  /**
   * The pattern that follows from the machine settings entered so far: rows with their oil and
   * distances, totals, ratio and a chart preview. Rejects with the API's message on bad input.
   */
  async calculatePattern(input: PatternInput): Promise<PatternCalculation> {
    try {
      return await firstValueFrom(this.#patternsApi.calculatePattern(input));
    } catch (error) {
      throw new Error(apiErrorMessage(error, 'Could not calculate the pattern.'));
    }
  }

  /** Saves a custom pattern and returns its url. Rejects with the API's message, e.g. on bad input. */
  async addPattern(input: PatternInput): Promise<string> {
    try {
      const response = await firstValueFrom(this.#patternsApi.addPattern(input));
      if (!response.success || !response.pattern_id) {
        throw new Error('The pattern was not saved.');
      }
      return response.pattern_id;
    } catch (error) {
      throw new Error(apiErrorMessage(error, 'Error saving pattern.'));
    }
  }
}

/** The `error` the pattern API sends for bad input, or `fallback` for anything else (offline, server errors). */
function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse && error.status === 400 && typeof error.error?.error === 'string') {
    return error.error.error;
  }
  return error instanceof Error && !(error instanceof HttpErrorResponse) ? error.message : fallback;
}
