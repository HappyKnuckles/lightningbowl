import { Injectable, signal } from '@angular/core';
import { BOWWWL_URL } from 'src/app/core/constants/app.constants';
import { Ball } from 'src/app/core/models/ball.model';
import { AnalyticsService } from 'src/app/core/services/analytics/analytics.service';
import { BallService } from 'src/app/core/services/ball/ball.service';
import { CacheService } from 'src/app/core/services/cache/cache.service';
import { NetworkService } from 'src/app/core/services/network/network.service';
import { STORAGE_PREFIX, StorageKeys } from 'src/app/core/services/storage/storage-keys';
import { StorageRepository } from 'src/app/core/services/storage/storage.repository';

@Injectable({ providedIn: 'root' })
export class BallsStore {
  readonly arsenal = signal<Ball[]>([]);

  readonly allBalls = signal<Ball[]>([]);
  readonly isUsingCache = signal<boolean>(false);
  readonly url = BOWWWL_URL;

  constructor(
    private storageRepository: StorageRepository,
    private ballService: BallService,
    private cacheService: CacheService,
    private networkService: NetworkService,
    private analyticsService: AnalyticsService,
  ) {}

  async loadArsenal(): Promise<void> {
    try {
      const arsenal = await this.storageRepository.loadByPrefix<Ball>(STORAGE_PREFIX.arsenal);
      const sortedArsenal = arsenal.sort((a, b) => (a.position || arsenal.length + 1) - (b.position || arsenal.length + 1));
      this.arsenal.set(sortedArsenal);
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
          this.allBalls.set(cachedBalls);
          this.isUsingCache.set(true);
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
      this.allBalls.set(response);
      this.isUsingCache.set(false);
      await this.cacheService.set(cacheKey, response);
    } catch (error) {
      console.error('Failed to load all balls:', error);

      const cachedBalls = await this.cacheService.get<Ball[]>(cacheKey);
      if (cachedBalls) {
        this.allBalls.set(cachedBalls);
        this.isUsingCache.set(true);
      } else {
        throw error;
      }
    }
  }
  async updateArsenalBall(oldBall: Ball, newBall: Ball): Promise<void> {
    try {
      newBall.position = oldBall.position;
      const oldKey = StorageKeys.arsenal(oldBall.ball_id, oldBall.core_weight);
      const newKey = StorageKeys.arsenal(newBall.ball_id, newBall.core_weight);
      await this.storageRepository.remove(oldKey);
      await this.storageRepository.set(newKey, newBall);
      this.arsenal.update((balls) => balls.map((b) => (b.ball_id === oldBall.ball_id && b.core_weight === oldBall.core_weight ? newBall : b)));
    } catch (error) {
      console.error('Error updating ball in arsenal:', error);
      throw error;
    }
  }

  async saveBallToArsenal(ball: Ball): Promise<Ball[]> {
    return this.saveBallsToArsenal([ball]);
  }

  async saveBallsToArsenal(balls: Ball[]): Promise<Ball[]> {
    const saved: Ball[] = [];
    const failed: Ball[] = [];

    await Promise.all(
      balls.map(async (ball) => {
        try {
          const key = StorageKeys.arsenal(ball.ball_id, ball.core_weight);
          await this.storageRepository.set(key, ball);
          saved.push(ball);
        } catch (error) {
          console.error(`Error saving ball ${ball.ball_name} to arsenal:`, error);
          failed.push(ball);
        }
      }),
    );

    if (saved.length) {
      this.arsenal.update((existing) => {
        const merged = [...existing];
        for (const ball of saved) {
          const isUnique = !merged.some((b) => b.ball_id === ball.ball_id && b.core_weight === ball.core_weight);
          if (isUnique) merged.push(ball);
        }
        return merged;
      });
      saved.forEach((ball) => this.analyticsService.trackBallAdded({ brand: ball.brand_name, name: ball.ball_name }));
    }

    return failed;
  }

  async removeFromArsenal(ball: Ball): Promise<void> {
    try {
      const key = StorageKeys.arsenal(ball.ball_id, ball.core_weight);
      await this.storageRepository.remove(`${STORAGE_PREFIX.arsenal}_${ball.ball_id}`);
      await this.storageRepository.remove(key);
      this.arsenal.update((balls) => balls.filter((b) => !(b.ball_id === ball.ball_id && b.core_weight === ball.core_weight)));
    } catch (error) {
      console.error('Error removing ball from arsenal:', error);
      throw error;
    }
  }

  clearArsenal(): void {
    this.arsenal.set([]);
  }

  private async refreshBallsInBackground(updated?: string, weight?: number, cacheKey?: string): Promise<void> {
    try {
      const response = await this.ballService.loadAllBalls(updated, weight);
      this.allBalls.set(response);
      this.isUsingCache.set(false);
      if (cacheKey) {
        await this.cacheService.set(cacheKey, response);
      }
    } catch (error) {
      console.error('Background refresh failed for balls:', error);
    }
  }
}
