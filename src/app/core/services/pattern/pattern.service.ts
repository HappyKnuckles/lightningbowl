import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Pattern } from '../../models/pattern.model';
import { Observable, catchError, defer, firstValueFrom, map, of, retry } from 'rxjs';
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

  getAllPatternCharts(): Observable<PatternChartsResult> {
    return this.http.get<PatternChartsResult>(`${environment.patternEndpoint}patterns/charts`).pipe(
      retry({ count: 5, delay: 2000 }),
      catchError((error) => {
        console.error('Error fetching pattern charts:', error);
        return of({ count: 0, patterns: [] });
      }),
    );
  }

  getPatterns(page: number, forceRefresh = false): Observable<AllPatternsResult> {
    const cacheKey = `patterns_page_${page}`;
    return defer(async () => {
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

        const response = await firstValueFrom(
          this.http.get<AllPatternsResult>(`${environment.patternEndpoint}patterns?page=${page}`).pipe(retry({ count: 5, delay: 2000 })),
        );

        if (response.total !== 0) {
          await this.cacheService.set(cacheKey, response, 24 * 60 * 60 * 1000); // 24 hours
        }

        return response;
      } catch (error) {
        console.error('Error fetching patterns:', error);

        // Try to use cached data as fallback
        const cachedPatterns = await this.cacheService.get<AllPatternsResult>(cacheKey);
        if (cachedPatterns) {
          return cachedPatterns;
        }

        return { total: 0, patterns: [] };
      }
    });
  }

  getAllPatternsStripped(): Observable<Partial<Pattern>[]> {
    return this.http.get<{ count: number; patterns: Partial<Pattern>[] }>(`${environment.patternEndpoint}patterns/all-stripped`).pipe(
      retry({ count: 5, delay: 2000 }),
      map((response) => response.patterns),
      catchError((error) => {
        console.error('Error fetching stripped patterns:', error);
        return of([]);
      }),
    );
  }

  getAllPatterns(): Observable<Pattern[]> {
    return this.http.get<{ count: number; patterns: Pattern[] }>(`${environment.patternEndpoint}patterns/all`).pipe(
      retry({ count: 5, delay: 2000 }),
      map((response) => response.patterns),
      catchError((error) => {
        console.error('Error fetching all patterns:', error);
        return of([]);
      }),
    );
  }

  getPatternCategories(): Observable<string[]> {
    return this.http.get<string[]>(`${environment.patternEndpoint}categories`).pipe(
      catchError((error) => {
        console.error('Error fetching pattern categories:', error);
        return of([]);
      }),
    );
  }

  getPatternData(url: string): Observable<Pattern> {
    return this.http.get<Pattern>(`${environment.patternEndpoint}patterns/${url}`).pipe(
      catchError((error) => {
        console.error('Error fetching pattern data:', error);
        return of({} as Pattern);
      }),
    );
  }

  getPatternStats(): Observable<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(`${environment.patternEndpoint}stats`).pipe(
      catchError((error) => {
        console.error('Error fetching pattern stats:', error);
        return of({});
      }),
    );
  }

  searchPattern(searchTerm: string, include_metadata = false): Observable<SearchResult> {
    const cacheKey = `pattern_search_${encodeURIComponent(searchTerm)}`;
    return defer(async () => {
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
          this.http.get<SearchResult>(`${environment.patternEndpoint}search?q=${searchTerm}&include_metadata=${include_metadata}`),
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
    });
  }

  addPattern(pattern: Partial<Pattern>): Observable<void> {
    return this.http.post<Partial<Pattern>>(`${environment.patternEndpoint}add-pattern`, pattern).pipe(
      map(() => void 0),
      catchError((error) => {
        console.error('Error adding pattern:', error);
        return of(void 0);
      }),
    );
  }
}
