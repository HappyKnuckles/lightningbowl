import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BALL_API, BALL_LOOKUP_CHUNK } from 'src/app/core/constants/ball-api.constants';
import { Ball, BallPage, BallQueryParams, Brand, Core, Coverstock } from 'src/app/core/models/ball.model';
import { environment } from 'src/environments/environment';
import { CacheService } from '../cache/cache.service';
import { NetworkService } from '../network/network.service';

@Injectable({
  providedIn: 'root',
})
export class BallService {
  readonly brands = signal<Brand[]>([]);
  readonly cores = signal<Core[]>([]);
  readonly coverstocks = signal<Coverstock[]>([]);
  private readonly pending = new Map<string, Promise<unknown>>();

  constructor(
    private http: HttpClient,
    private cacheService: CacheService,
    private networkService: NetworkService,
  ) {}

  /** Server-side search, filter, sort and paging (see `buildBallQueryParams`). */
  async searchBalls(params: BallQueryParams): Promise<BallPage> {
    return firstValueFrom(this.http.get<BallPage>(this.url(BALL_API.balls), { params }));
  }

  /** Text search for pickers: the best matches for `term`. */
  async findBallsByText(term: string, weight?: string, size = 50): Promise<Ball[]> {
    const page = await this.searchBalls({ search: term, size: String(size), ...(weight ? { weight } : {}) });
    return page.content;
  }

  /** One page for pickers: newest balls first when browsing, best matches when `term` is set. */
  async findBallsPage(term: string, page: number, weight?: string, size = 50): Promise<{ items: Ball[]; hasMore: boolean }> {
    const params: BallQueryParams = { page: String(page), size: String(size), ...(weight ? { weight } : {}) };
    if (term) {
      params['search'] = term;
    } else {
      params['sort'] = 'release_date,desc';
    }
    const response = await this.searchBalls(params);
    return { items: response.content, hasMore: response.page.number + 1 < response.page.totalPages };
  }

  /** All weight variants of the given ball ids. */
  async getBallsByIds(ballIds: string[]): Promise<Ball[]> {
    return this.lookup('id', ballIds);
  }

  /** All weight variants of balls with exactly these names (case-insensitive). */
  async getBallsByNames(names: string[]): Promise<Ball[]> {
    return this.lookup('name', names);
  }

  /** One ball at a given weight, or undefined if it doesn't exist in that weight. */
  async getBallVariant(ballId: string, weight: number | string): Promise<Ball | undefined> {
    const { path, params } = BALL_API.ball(ballId);
    try {
      const variants = await firstValueFrom(this.http.get<Ball[]>(this.url(path), { params: { ...params, weight: String(weight) } }));
      return variants.find((b) => Number(b.core_weight) === Number(weight));
    } catch (error) {
      if ((error as { status?: number }).status === 404) return undefined;
      throw error;
    }
  }

  async getBallsByCore(ball: Ball): Promise<Ball[]> {
    if (!ball.core_name) return [];
    try {
      return await this.findRelatedBalls({ core: ball.core_name, excludeId: ball.ball_id.toString(), weight: ball.core_weight });
    } catch (error) {
      console.error(`Error loading balls by core for ball ID ${ball.ball_id}:`, error);
      throw error;
    }
  }

  async getBallsByCoverstock(ball: Ball): Promise<Ball[]> {
    if (!ball.coverstock_name) return [];
    try {
      return await this.findRelatedBalls({ coverstock: ball.coverstock_name, excludeId: ball.ball_id.toString(), weight: ball.core_weight });
    } catch (error) {
      console.error(`Error loading balls by coverstock for ball ID ${ball.ball_id}:`, error);
      throw error;
    }
  }

  async getBallByBrand(brand: string): Promise<Ball[]> {
    try {
      return await this.findRelatedBalls({ brand });
    } catch (error) {
      console.error(`Error loading balls by brand "${brand}":`, error);
      throw error;
    }
  }

  async getBrands(): Promise<Brand[]> {
    return this.fetchWithCache(
      'brands',
      () => firstValueFrom(this.http.get<Brand[]>(this.url(BALL_API.brands))),
      7 * 24 * 60 * 60 * 1000,
      (data) => this.brands.set(data),
    );
  }

  async getCores(): Promise<Core[]> {
    return this.fetchWithCache(
      'cores',
      () => firstValueFrom(this.http.get<Core[]>(this.url(BALL_API.cores))),
      7 * 24 * 60 * 60 * 1000,
      // The API returns them sorted by brand, then name.
      (data) => this.cores.set(data),
    );
  }

  async getCoverstocks(): Promise<Coverstock[]> {
    return this.fetchWithCache(
      'coverstocks',
      () => firstValueFrom(this.http.get<Coverstock[]>(this.url(BALL_API.coverstocks))),
      7 * 24 * 60 * 60 * 1000,
      (data) => this.coverstocks.set(data),
    );
  }

  /**
   * Balls with a similar expected reaction (same weight, core and coverstock
   * type, close RG/differential), newest first. The matching runs on the API.
   */
  async getBallsByMovementPattern(ball: Ball): Promise<Ball[]> {
    try {
      const { path, params } = BALL_API.similar(ball.ball_id.toString());
      const similar = await firstValueFrom(this.http.get<Ball[]>(this.url(path), { params: { ...params, weight: ball.core_weight, limit: '10' } }));
      // add original ball back it to have a title for the modal at index 0 (workaround)
      return similar.length > 0 ? [ball, ...similar] : [];
    } catch (error) {
      console.error(`Error finding balls with similar movement pattern for ball ID ${ball.ball_id}:`, error);
      throw error;
    }
  }

  /** Resolves values of a list filter in chunks, following every page. */
  private async lookup(filter: 'id' | 'name', values: string[]): Promise<Ball[]> {
    const unique = [...new Set(values.filter(Boolean))];
    const chunks: string[][] = [];
    for (let i = 0; i < unique.length; i += BALL_LOOKUP_CHUNK) chunks.push(unique.slice(i, i + BALL_LOOKUP_CHUNK));

    const results = await Promise.all(
      chunks.map(async (chunk) => {
        const balls: Ball[] = [];
        for (let page = 0; page < 20; page++) {
          const response = await this.searchBalls({ [filter]: chunk, page: String(page), size: '100', sort: 'ball_name' });
          balls.push(...response.content);
          if (response.page.number + 1 >= response.page.totalPages) break;
        }
        return balls;
      }),
    );
    return results.flat();
  }

  private url(path: string): string {
    return `${environment.ballApiEndpoint}${path}`;
  }

  /** First 100 matches of a list query, newest first. */
  private async findRelatedBalls(filters: BallQueryParams): Promise<Ball[]> {
    const page = await this.searchBalls({ ...filters, size: '100', sort: 'release_date,desc' });
    return page.content;
  }

  private async fetchWithCache<T>(cacheKey: string, fetcher: () => Promise<T[]>, ttl: number, onData?: (data: T[]) => void): Promise<T[]> {
    const cached = await this.cacheService.get<T[]>(cacheKey);
    const isCacheValid = await this.cacheService.isValid(cacheKey);

    if (cached && (isCacheValid || this.networkService.isOffline)) {
      onData?.(cached);
      return cached;
    }

    if (this.networkService.isOffline) return [];

    if (this.pending.has(cacheKey)) {
      try {
        const data = await (this.pending.get(cacheKey) as Promise<T[]>);
        onData?.(data);
        return data;
      } catch (error) {
        if (cached) {
          onData?.(cached);
          return cached;
        }
        throw error;
      }
    }

    const request = (async () => {
      try {
        const data = await fetcher();
        onData?.(data);
        if (data.length > 0) await this.cacheService.set(cacheKey, data, ttl);
        return data;
      } catch (error) {
        if (cached) {
          onData?.(cached);
          return cached;
        }
        throw error;
      } finally {
        this.pending.delete(cacheKey);
      }
    })();

    this.pending.set(cacheKey, request);
    return request;
  }
}
