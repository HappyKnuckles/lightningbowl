import { Injectable, signal } from '@angular/core';
import { Ball } from 'src/app/core/models/ball.model';
import { StorageRepository } from 'src/app/core/services/storage/storage.repository';
import { BallService } from 'src/app/core/services/ball/ball.service';
import { CacheService } from 'src/app/core/services/cache/cache.service';
import { NetworkService } from 'src/app/core/services/network/network.service';
import { AnalyticsService } from 'src/app/core/services/analytics/analytics.service';

@Injectable({ providedIn: 'root' })
export class BallsStore {
  readonly url = 'https://bowwwl.com';

  #arsenal = signal<Ball[]>([]);
  #allBalls = signal<Ball[]>([]);
  #isUsingCache = signal<boolean>(false);

  get arsenal() {
    return this.#arsenal;
  }

  get allBalls() {
    return this.#allBalls;
  }

  get isUsingCache() {
    return this.#isUsingCache;
  }

  constructor(
    private storageRepository: StorageRepository,
    private ballService: BallService,
    private cacheService: CacheService,
    private networkService: NetworkService,
    private analyticsService: AnalyticsService,
  ) {}

  async loadArsenal(): Promise<void> {
    try {
      const arsenal = await this.loadData<Ball>('arsenal');
      const sortedArsenal = arsenal.sort((a, b) => (a.position || arsenal.length + 1) - (b.position || arsenal.length + 1));
      this.#arsenal.set(sortedArsenal);
    } catch (error) {
      console.error('Error loading arsenal:', error);
      throw error;
    }
  }

  async loadAllBalls(updated?: string, weight?: number, forceRefresh = false): Promise<void> {
    const cacheKey = `all_balls_${weight || 'default'}`;

    try {
      if (!forceRefresh) {
        const cachedBalls = await this.cacheService.get<Ball[]>(cacheKey);
        const isCacheValid = await this.cacheService.isValid(cacheKey);

        if (cachedBalls && (isCacheValid || this.networkService.isOffline)) {
          this.#allBalls.set(cachedBalls);
          this.#isUsingCache.set(true);
          if (this.networkService.isOnline && (await this.cacheService.isStale(cacheKey))) {
            this.refreshBallsInBackground(updated, weight, cacheKey);
          }
          return;
        }
      }

      if (this.networkService.isOffline) {
        console.warn('Cannot fetch balls: offline and no valid cache available');
        return;
      }

      const response = await this.ballService.loadAllBalls(updated, weight);
      this.#allBalls.set(response);
      this.#isUsingCache.set(false);
      await this.cacheService.set(cacheKey, response);
    } catch (error) {
      console.error('Failed to load all balls:', error);

      const cachedBalls = await this.cacheService.get<Ball[]>(cacheKey);
      if (cachedBalls) {
        this.#allBalls.set(cachedBalls);
        this.#isUsingCache.set(true);
      } else {
        throw error;
      }
    }
  }

  async saveBallToArsenal(ball: Ball): Promise<void> {
    try {
      const key = 'arsenal' + '_' + ball.ball_id + '_' + ball.core_weight;
      await this.storageRepository.set(key, ball);
      this.#arsenal.update((balls) => {
        const isUnique = !balls.some((b) => b.ball_id === ball.ball_id && b.core_weight === ball.core_weight);
        if (isUnique) {
          return [...balls, ball];
        }
        return balls;
      });
      this.analyticsService.trackBallAdded({ brand: ball.brand_name, name: ball.ball_name });
    } catch (error) {
      console.error('Error saving ball to arsenal:', error);
      throw error;
    }
  }

  async saveBallsToArsenal(balls: Ball[]): Promise<void> {
    try {
      for (const ball of balls) {
        const key = 'arsenal' + '_' + ball.ball_id + '_' + ball.core_weight;
        await this.storageRepository.set(key, ball);
      }
      this.#arsenal.update(() => [...balls]);
    } catch (error) {
      console.error('Error saving balls to arsenal:', error);
      throw error;
    }
  }

  async removeFromArsenal(ball: Ball): Promise<void> {
    try {
      const key = 'arsenal' + '_' + ball.ball_id + '_' + ball.core_weight;
      await this.storageRepository.remove('arsenal' + '_' + ball.ball_id);
      await this.storageRepository.remove(key);
      this.#arsenal.update((balls) => balls.filter((b) => !(b.ball_id === ball.ball_id && b.core_weight === ball.core_weight)));
    } catch (error) {
      console.error('Error removing ball from arsenal:', error);
      throw error;
    }
  }

  clearArsenal(): void {
    this.#arsenal.set([]);
  }

  private async refreshBallsInBackground(updated?: string, weight?: number, cacheKey?: string): Promise<void> {
    try {
      const response = await this.ballService.loadAllBalls(updated, weight);
      this.#allBalls.set(response);
      this.#isUsingCache.set(false);
      if (cacheKey) {
        await this.cacheService.set(cacheKey, response);
      }
    } catch (error) {
      console.error('Background refresh failed for balls:', error);
    }
  }

  private async loadData<T>(prefix: string): Promise<T[]> {
    try {
      const data: T[] = [];
      await this.storageRepository.forEach((value, key) => {
        if (key.startsWith(prefix)) {
          data.push(value as T);
        }
      });
      return data;
    } catch (error) {
      console.error(`Error loading data for prefix "${prefix}":`, error);
      throw error;
    }
  }
}
