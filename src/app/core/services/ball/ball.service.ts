import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { firstValueFrom, retry } from 'rxjs';
import { Ball, Brand, Core, Coverstock } from 'src/app/core/models/ball.model';
import { environment } from 'src/environments/environment';
import { CacheService } from '../cache/cache.service';
import { NetworkService } from '../network/network.service';
import { BALL_CACHE_TTL, BALL_METADATA_CACHE_TTL } from '../../models/cache.model';

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
      if (cachedBalls) {
        return cachedBalls;
      }

      if (this.networkService.isOffline) {
        const staleBalls = await this.cacheService.getStale<Ball[]>(cacheKey);
        return staleBalls ?? [];
      }

      const response = await firstValueFrom(
        this.http.get<Ball[]>(`${environment.bowwwlEndpoint}balls-pages`, {
          params: {
            page: page.toString(),
          },
        }),
      );

      if (response.length !== 0) {
        await this.cacheService.set(cacheKey, response, BALL_CACHE_TTL);
      }

      return response;
    } catch (error) {
      console.error(`Error loading balls for page ${page}:`, error);

      // Try to use cached data as fallback
      const staleBalls = await this.cacheService.getStale<Ball[]>(cacheKey);
      if (staleBalls) {
        return staleBalls;
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
    const cacheKey = 'brands';

    try {
      const cachedBrands = await this.cacheService.get<Brand[]>(cacheKey);
      if (cachedBrands) {
        this.brands.set(cachedBrands);
        return cachedBrands;
      }

      if (this.networkService.isOffline) {
        const staleBrands = await this.cacheService.getStale<Brand[]>(cacheKey);
        if (staleBrands) {
          this.brands.set(staleBrands);
          return staleBrands;
        }
        console.warn('Cannot load brands: offline and no cached data available');
        return [];
      }

      const response = await firstValueFrom(this.http.get<Brand[]>(`${environment.bowwwlEndpoint}brands`));
      this.brands.set(response);

      if (response.length !== 0) {
        await this.cacheService.set(cacheKey, response, BALL_METADATA_CACHE_TTL);
      }

      return response;
    } catch (error) {
      console.error('Error loading brands:', error);

      // Try to use cached data as fallback
      const staleBrands = await this.cacheService.getStale<Brand[]>(cacheKey);
      if (staleBrands) {
        this.brands.set(staleBrands);
        return staleBrands;
      }

      throw error;
    }
  }

  async getCores(): Promise<Core[]> {
    const cacheKey = 'cores';

    try {
      const cachedCores = await this.cacheService.get<Core[]>(cacheKey);
      if (cachedCores) {
        cachedCores.sort((a, b) => a.brand.localeCompare(b.brand));
        this.cores.set(cachedCores);
        return cachedCores;
      }

      if (this.networkService.isOffline) {
        const staleCores = await this.cacheService.getStale<Core[]>(cacheKey);
        if (staleCores) {
          staleCores.sort((a, b) => a.brand.localeCompare(b.brand));
          this.cores.set(staleCores);
          return staleCores;
        }
        console.warn('Cannot load cores: offline and no cached data available');
        return [];
      }

      const response = await firstValueFrom(this.http.get<Core[]>(`${environment.bowwwlEndpoint}cores`));
      response.sort((a, b) => a.brand.localeCompare(b.brand));
      this.cores.set(response);

      if (response.length !== 0) {
        await this.cacheService.set(cacheKey, response, BALL_METADATA_CACHE_TTL);
      }

      return response;
    } catch (error) {
      console.error('Error loading cores:', error);

      // Try to use cached data as fallback
      const staleCores = await this.cacheService.getStale<Core[]>(cacheKey);
      if (staleCores) {
        staleCores.sort((a, b) => a.brand.localeCompare(b.brand));
        this.cores.set(staleCores);
        return staleCores;
      }

      throw error;
    }
  }

  async getCoverstocks(): Promise<Coverstock[]> {
    const cacheKey = 'coverstocks';

    try {
      const cachedCoverstocks = await this.cacheService.get<Coverstock[]>(cacheKey);
      if (cachedCoverstocks) {
        cachedCoverstocks.sort((a, b) => a.brand.localeCompare(b.brand));
        this.coverstocks.set(cachedCoverstocks);
        return cachedCoverstocks;
      }

      if (this.networkService.isOffline) {
        const staleCoverstocks = await this.cacheService.getStale<Coverstock[]>(cacheKey);
        if (staleCoverstocks) {
          staleCoverstocks.sort((a, b) => a.brand.localeCompare(b.brand));
          this.coverstocks.set(staleCoverstocks);
          return staleCoverstocks;
        }
        console.warn('Cannot load coverstocks: offline and no cached data available');
        return [];
      }

      const response = await firstValueFrom(this.http.get<Coverstock[]>(`${environment.bowwwlEndpoint}coverstocks`));
      response.sort((a, b) => a.brand.localeCompare(b.brand));
      this.coverstocks.set(response);

      if (response.length !== 0) {
        await this.cacheService.set(cacheKey, response, BALL_METADATA_CACHE_TTL);
      }

      return response;
    } catch (error) {
      console.error('Error loading coverstocks:', error);

      // Try to use cached data as fallback
      const staleCoverstocks = await this.cacheService.getStale<Coverstock[]>(cacheKey);
      if (staleCoverstocks) {
        staleCoverstocks.sort((a, b) => a.brand.localeCompare(b.brand));
        this.coverstocks.set(staleCoverstocks);
        return staleCoverstocks;
      }

      throw error;
    }
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
}
