import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Observable, defer, firstValueFrom, of, retry, throwError } from 'rxjs';
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

  loadBalls(page: number): Observable<Ball[]> {
    const cacheKey = `balls_page_${page}`;
    return defer(async () => {
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
    });
  }

  loadAllBalls(updated?: string, weight?: number): Observable<Ball[]> {
    let params = new HttpParams();
    if (updated) {
      params = params.set('updated', updated);
    }
    if (weight !== undefined) {
      params = params.set('weight', weight.toString());
    }
    return this.http.get<Ball[]>(`${environment.bowwwlEndpoint}all-balls`, { params }).pipe(retry({ count: 5, delay: 2000 }));
  }

  getBallsByCore(ball: Ball): Observable<Ball[]> {
    return this.http.get<Ball[]>(`${environment.bowwwlEndpoint}core-balls`, {
      params: {
        core: ball.core_name,
        ballId: ball.ball_id.toString(),
      },
    });
  }

  getBallsByCoverstock(ball: Ball): Observable<Ball[]> {
    return this.http.get<Ball[]>(`${environment.bowwwlEndpoint}coverstock-balls`, {
      params: {
        coverstock: ball.coverstock_name,
        ballId: ball.ball_id.toString(),
      },
    });
  }

  getBallByBrand(brand: string): Observable<Ball[]> {
    return this.http.get<Ball[]>(`${environment.bowwwlEndpoint}brand`, {
      params: { brand },
    });
  }

  getBrands(): Observable<Brand[]> {
    const cacheKey = 'brands';
    return defer(async () => {
      try {
        const cachedBrands = await this.cacheService.get<Brand[]>(cacheKey);
        const isCacheValid = await this.cacheService.isValid(cacheKey);

        if (cachedBrands && (isCacheValid || this.networkService.isOffline)) {
          this.brands.set(cachedBrands);
          return cachedBrands;
        }

        if (this.networkService.isOffline) {
          console.warn('Cannot load brands: offline and no cached data available');
          return [];
        }

        const response = await firstValueFrom(this.http.get<Brand[]>(`${environment.bowwwlEndpoint}brands`));
        this.brands.set(response);

        if (response.length !== 0) {
          await this.cacheService.set(cacheKey, response, 7 * 24 * 60 * 60 * 1000); // 7 days
        }

        return response;
      } catch (error) {
        console.error('Error loading brands:', error);

        // Try to use cached data as fallback
        const cachedBrands = await this.cacheService.get<Brand[]>(cacheKey);
        if (cachedBrands) {
          this.brands.set(cachedBrands);
          return cachedBrands;
        }

        throw error;
      }
    });
  }

  getCores(): Observable<Core[]> {
    const cacheKey = 'cores';
    return defer(async () => {
      try {
        const cachedCores = await this.cacheService.get<Core[]>(cacheKey);
        const isCacheValid = await this.cacheService.isValid(cacheKey);

        if (cachedCores && (isCacheValid || this.networkService.isOffline)) {
          cachedCores.sort((a, b) => a.brand.localeCompare(b.brand));
          this.cores.set(cachedCores);
          return cachedCores;
        }

        if (this.networkService.isOffline) {
          console.warn('Cannot load cores: offline and no cached data available');
          return [];
        }

        const response = await firstValueFrom(this.http.get<Core[]>(`${environment.bowwwlEndpoint}cores`));
        response.sort((a, b) => a.brand.localeCompare(b.brand));
        this.cores.set(response);

        if (response.length !== 0) {
          await this.cacheService.set(cacheKey, response, 7 * 24 * 60 * 60 * 1000); // 7 days
        }

        return response;
      } catch (error) {
        console.error('Error loading cores:', error);

        // Try to use cached data as fallback
        const cachedCores = await this.cacheService.get<Core[]>(cacheKey);
        if (cachedCores) {
          cachedCores.sort((a, b) => a.brand.localeCompare(b.brand));
          this.cores.set(cachedCores);
          return cachedCores;
        }

        throw error;
      }
    });
  }

  getCoverstocks(): Observable<Coverstock[]> {
    const cacheKey = 'coverstocks';
    return defer(async () => {
      try {
        const cachedCoverstocks = await this.cacheService.get<Coverstock[]>(cacheKey);
        const isCacheValid = await this.cacheService.isValid(cacheKey);

        if (cachedCoverstocks && (isCacheValid || this.networkService.isOffline)) {
          cachedCoverstocks.sort((a, b) => a.brand.localeCompare(b.brand));
          this.coverstocks.set(cachedCoverstocks);
          return cachedCoverstocks;
        }

        if (this.networkService.isOffline) {
          console.warn('Cannot load coverstocks: offline and no cached data available');
          return [];
        }

        const response = await firstValueFrom(this.http.get<Coverstock[]>(`${environment.bowwwlEndpoint}coverstocks`));
        response.sort((a, b) => a.brand.localeCompare(b.brand));
        this.coverstocks.set(response);

        if (response.length !== 0) {
          await this.cacheService.set(cacheKey, response, 7 * 24 * 60 * 60 * 1000); // 7 days
        }

        return response;
      } catch (error) {
        console.error('Error loading coverstocks:', error);

        // Try to use cached data as fallback
        const cachedCoverstocks = await this.cacheService.get<Coverstock[]>(cacheKey);
        if (cachedCoverstocks) {
          cachedCoverstocks.sort((a, b) => a.brand.localeCompare(b.brand));
          this.coverstocks.set(cachedCoverstocks);
          return cachedCoverstocks;
        }

        throw error;
      }
    });
  }

  getBallsByMovementPattern(ball: Ball, allBalls: Ball[]): Observable<Ball[]> {
    return defer(() => {
      try {
        const ballRg = parseFloat(ball.core_rg);
        const ballDiff = parseFloat(ball.core_diff);
        const ballIntDiff = parseFloat(ball.core_int_diff);

        if (isNaN(ballRg) || isNaN(ballDiff)) {
          return of([]);
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
        return of([ball, ...similarBalls.slice(0, 10)]);
      } catch (error) {
        console.error(`Error finding balls with similar movement pattern for ball ID ${ball.ball_id}:`, error);
        return throwError(() => error);
      }
    });
  }
}
