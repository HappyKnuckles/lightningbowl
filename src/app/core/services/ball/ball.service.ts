import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { firstValueFrom, retry } from 'rxjs';
import { Ball, Brand, Core, Coverstock } from 'src/app/core/models/ball.model';
import { environment } from 'src/environments/environment';
import { CacheService } from '../cache/cache.service';
import { NetworkService } from '../network/network.service';

@Injectable({
  providedIn: 'root',
})
export class BallService {
  #brands = signal<Brand[]>([]);
  #cores = signal<Core[]>([]);
  #coverstocks = signal<Coverstock[]>([]);

  get brands() {
    return this.#brands;
  }
  get cores() {
    return this.#cores;
  }
  get coverstocks() {
    return this.#coverstocks;
  }

  constructor(
    private http: HttpClient,
    private cacheService: CacheService,
    private networkService: NetworkService,
  ) {}

  async loadBalls(page: number): Promise<Ball[]> {
    const cacheKey = `balls_page_${page}`;

    try {
      // Check cache first
      const cachedBalls = await this.cacheService.get<Ball[]>(cacheKey);
      const isCacheValid = await this.cacheService.isValid(cacheKey);

      if (cachedBalls && (isCacheValid || this.networkService.isOffline)) {
        return cachedBalls;
      }

      if (this.networkService.isOffline) {
        return [];
      }

      const response = await firstValueFrom(
        this.http.get<Ball[]>(`${environment.bowwwlEndpoint}balls-pages`, {
          params: {
            page: page.toString(),
          },
        }),
      );

      if (response.length !== 0) {
        await this.cacheService.set(cacheKey, response, 24 * 60 * 60 * 1000); // 6 hours
      }

      return response;
    } catch (error) {
      console.error(`Error loading balls for page ${page}:`, error);

      // Try to use cached data as fallback
      const cachedBalls = await this.cacheService.get<Ball[]>(cacheKey);
      if (cachedBalls) {
        return cachedBalls;
      }

      throw error;
    }
  }

  async loadAllBalls(updated?: string, weight?: number): Promise<Ball[]> {
    try {
      let params = new HttpParams();
      if (updated) {
        params = params.set('updated', updated);
      }
      if (weight !== undefined) {
        params = params.set('weight', weight.toString());
      }
      const response = await firstValueFrom(
        this.http.get<Ball[]>(`${environment.bowwwlEndpoint}all-balls`, { params }).pipe(retry({ count: 5, delay: 2000 })),
      );
      return response;
    } catch (error) {
      console.error('Error loading all balls:', error);
      throw error;
    }
  }

  async getBallsByWeight(weight: number): Promise<Ball[]> {
    return this.fetchWithCache(`balls_weight_${weight}`, () => this.loadAllBalls(undefined, weight), 24 * 60 * 60 * 1000);
  }

  async getBallsByCore(ball: Ball): Promise<Ball[]> {
    try {
      const response = await firstValueFrom(
        this.http.get<Ball[]>(`${environment.bowwwlEndpoint}core-balls`, {
          params: {
            core: ball.core_name,
            ballId: ball.ball_id.toString(),
          },
        }),
      );
      return response;
    } catch (error) {
      console.error(`Error loading balls by core for ball ID ${ball.ball_id}:`, error);
      throw error;
    }
  }

  async getBallsByCoverstock(ball: Ball): Promise<Ball[]> {
    try {
      const response = await firstValueFrom(
        this.http.get<Ball[]>(`${environment.bowwwlEndpoint}coverstock-balls`, {
          params: {
            coverstock: ball.coverstock_name,
            ballId: ball.ball_id.toString(),
          },
        }),
      );
      return response;
    } catch (error) {
      console.error(`Error loading balls by coverstock for ball ID ${ball.ball_id}:`, error);
      throw error;
    }
  }

  async getBallByBrand(brand: string): Promise<Ball[]> {
    try {
      const response = await firstValueFrom(
        this.http.get<Ball[]>(`${environment.bowwwlEndpoint}brand`, {
          params: { brand },
        }),
      );
      return response;
    } catch (error) {
      console.error(`Error loading balls by brand "${brand}":`, error);
      throw error;
    }
  }

  async getBrands(): Promise<Brand[]> {
    return this.fetchWithCache(
      'brands',
      () => firstValueFrom(this.http.get<Brand[]>(`${environment.bowwwlEndpoint}brands`)),
      7 * 24 * 60 * 60 * 1000,
      (data) => this.#brands.set(data),
    );
  }

  async getCores(): Promise<Core[]> {
    return this.fetchWithCache(
      'cores',
      () => firstValueFrom(this.http.get<Core[]>(`${environment.bowwwlEndpoint}cores`)),
      7 * 24 * 60 * 60 * 1000,
      (data) => {
        data.sort((a, b) => a.brand.localeCompare(b.brand));
        this.#cores.set(data);
      },
    );
  }

  async getCoverstocks(): Promise<Coverstock[]> {
    return this.fetchWithCache(
      'coverstocks',
      () => firstValueFrom(this.http.get<Coverstock[]>(`${environment.bowwwlEndpoint}coverstocks`)),
      7 * 24 * 60 * 60 * 1000,
      (data) => {
        data.sort((a, b) => a.brand.localeCompare(b.brand));
        this.#coverstocks.set(data);
      },
    );
  }

  async getBallsByMovementPattern(ball: Ball, allBalls: Ball[]): Promise<Ball[]> {
    try {
      const ballRg = parseFloat(ball.core_rg);
      const ballDiff = parseFloat(ball.core_diff);
      const ballIntDiff = parseFloat(ball.core_int_diff);

      if (isNaN(ballRg) || isNaN(ballDiff)) {
        return [];
      }

      const rgTolerance = 0.03;
      const diffTolerance = 0.008;
      const intDiffTolerance = 0.005;

      const similarBalls = allBalls.filter((otherBall) => {
        if (otherBall.ball_id === ball.ball_id && otherBall.core_weight === ball.core_weight) {
          return false;
        }

        if (ball.core_type !== otherBall.core_type) {
          return false;
        }

        const otherRg = parseFloat(otherBall.core_rg);
        const otherDiff = parseFloat(otherBall.core_diff);

        if (isNaN(otherRg) || isNaN(otherDiff)) {
          return false;
        }

        const rgSimilar = Math.abs(ballRg - otherRg) <= rgTolerance;
        const diffSimilar = Math.abs(ballDiff - otherDiff) <= diffTolerance;

        const coverstockSimilar = ball.coverstock_type === otherBall.coverstock_type;

        let intDiffSimilar = true;
        if (ball.core_type === 'Asymmetric') {
          const otherIntDiff = parseFloat(otherBall.core_int_diff);
          if (isNaN(ballIntDiff) || isNaN(otherIntDiff)) {
            intDiffSimilar = false;
          } else {
            intDiffSimilar = Math.abs(ballIntDiff - otherIntDiff) <= intDiffTolerance;
          }
        }

        return rgSimilar && diffSimilar && coverstockSimilar && intDiffSimilar;
      });

      similarBalls.sort((a, b) => {
        const dateA = new Date(a.release_date);
        const dateB = new Date(b.release_date);
        return dateB.getTime() - dateA.getTime();
      });
      // add original ball back it to have a title for the modal at index 0 (workaround)
      return [ball, ...similarBalls.slice(0, 10)];
    } catch (error) {
      console.error(`Error finding balls with similar movement pattern for ball ID ${ball.ball_id}:`, error);
      throw error;
    }
  }

  private async fetchWithCache<T>(cacheKey: string, fetcher: () => Promise<T[]>, ttl: number, onData?: (data: T[]) => void): Promise<T[]> {
    const cached = await this.cacheService.get<T[]>(cacheKey);
    const isCacheValid = await this.cacheService.isValid(cacheKey);

    if (cached && (isCacheValid || this.networkService.isOffline)) {
      onData?.(cached);
      return cached;
    }

    if (this.networkService.isOffline) return [];

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
    }
  }
}
