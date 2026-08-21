import { TestBed } from '@angular/core/testing';
import { Ball } from 'src/app/core/models/ball.model';
import { AnalyticsService } from 'src/app/core/services/analytics/analytics.service';
import { BallService } from 'src/app/core/services/ball/ball.service';
import { CacheService } from 'src/app/core/services/cache/cache.service';
import { NetworkService } from 'src/app/core/services/network/network.service';
import { StorageRepository } from 'src/app/core/services/storage/storage.repository';
import { makeBall } from 'src/testing/fixtures';
import { createSpyObj, SpyObj } from 'src/testing/spy-obj';
import { BallsStore } from './balls.store';

describe('BallsStore', () => {
  let store: BallsStore;
  let storageRepository: SpyObj<StorageRepository>;
  let ballService: SpyObj<BallService>;
  let cacheService: SpyObj<CacheService>;
  let analyticsService: SpyObj<AnalyticsService>;
  let isOnline: boolean;

  beforeEach(() => {
    isOnline = true;
    storageRepository = createSpyObj<StorageRepository>(['loadByPrefix', 'set', 'remove']);
    storageRepository.loadByPrefix.mockResolvedValue([]);
    storageRepository.set.mockResolvedValue(undefined);
    storageRepository.remove.mockResolvedValue(undefined);

    ballService = createSpyObj<BallService>(['loadAllBalls']);
    ballService.loadAllBalls.mockResolvedValue([]);

    cacheService = createSpyObj<CacheService>(['get', 'set', 'isValid', 'isStale']);
    cacheService.get.mockResolvedValue(null);
    cacheService.set.mockResolvedValue(undefined);
    cacheService.isValid.mockResolvedValue(false);
    cacheService.isStale.mockResolvedValue(false);

    analyticsService = createSpyObj<AnalyticsService>(['trackBallAdded']);

    const networkService = {
      get isOnline() {
        return isOnline;
      },
      get isOffline() {
        return !isOnline;
      },
    } as NetworkService;

    TestBed.configureTestingModule({
      providers: [
        { provide: StorageRepository, useValue: storageRepository },
        { provide: BallService, useValue: ballService },
        { provide: CacheService, useValue: cacheService },
        { provide: NetworkService, useValue: networkService },
        { provide: AnalyticsService, useValue: analyticsService },
      ],
    });
    store = TestBed.inject(BallsStore);
  });

  describe('loadArsenal', () => {
    it('sorts the stored arsenal by position', async () => {
      storageRepository.loadByPrefix.mockResolvedValue([
        makeBall({ ball_id: 'b1', position: 2 }),
        makeBall({ ball_id: 'b2', position: 1 }),
      ] as Ball[]);

      await store.loadArsenal();

      expect(store.arsenal().map((b) => b.ball_id)).toEqual(['b2', 'b1']);
    });

    it('keeps balls without a position at the end', async () => {
      storageRepository.loadByPrefix.mockResolvedValue([makeBall({ ball_id: 'b1' }), makeBall({ ball_id: 'b2', position: 1 })] as Ball[]);

      await store.loadArsenal();

      expect(store.arsenal().map((b) => b.ball_id)).toEqual(['b2', 'b1']);
    });

    it('rethrows storage failures', async () => {
      storageRepository.loadByPrefix.mockRejectedValue(new Error('storage down'));

      await expect(store.loadArsenal()).rejects.toThrow('storage down');
    });
  });

  describe('loadAllBalls', () => {
    const cached = [makeBall({ ball_id: 'cached' })];
    const fetched = [makeBall({ ball_id: 'fetched' })];

    it('fetches and caches when there is no cache', async () => {
      ballService.loadAllBalls.mockResolvedValue(fetched);

      await store.loadAllBalls(undefined, 15);

      expect(ballService.loadAllBalls).toHaveBeenCalledWith(undefined, 15);
      expect(store.allBalls()).toEqual(fetched);
      expect(store.isUsingCache()).toBe(false);
      expect(cacheService.set).toHaveBeenCalledWith('all_balls_15', fetched);
    });

    it('serves a valid cache without hitting the network', async () => {
      cacheService.get.mockResolvedValue(cached);
      cacheService.isValid.mockResolvedValue(true);

      await store.loadAllBalls();

      expect(store.allBalls()).toEqual(cached);
      expect(store.isUsingCache()).toBe(true);
      expect(ballService.loadAllBalls).not.toHaveBeenCalled();
    });

    it('refreshes a stale cache in the background', async () => {
      cacheService.get.mockResolvedValue(cached);
      cacheService.isValid.mockResolvedValue(true);
      cacheService.isStale.mockResolvedValue(true);
      ballService.loadAllBalls.mockResolvedValue(fetched);

      await store.loadAllBalls();
      await Promise.resolve();
      await Promise.resolve();

      expect(store.allBalls()).toEqual(fetched);
      expect(store.isUsingCache()).toBe(false);
    });

    it('keeps serving the cache when a background refresh fails', async () => {
      cacheService.get.mockResolvedValue(cached);
      cacheService.isValid.mockResolvedValue(true);
      cacheService.isStale.mockResolvedValue(true);
      ballService.loadAllBalls.mockRejectedValue(new Error('offline mid-refresh'));

      await store.loadAllBalls();
      await Promise.resolve();
      await Promise.resolve();

      expect(store.allBalls()).toEqual(cached);
      expect(store.isUsingCache()).toBe(true);
    });

    it('serves an expired cache while offline', async () => {
      isOnline = false;
      cacheService.get.mockResolvedValue(cached);

      await store.loadAllBalls();

      expect(store.allBalls()).toEqual(cached);
      expect(store.isUsingCache()).toBe(true);
    });

    it('does nothing when offline without a cache', async () => {
      isOnline = false;

      await store.loadAllBalls();

      expect(store.allBalls()).toEqual([]);
      expect(ballService.loadAllBalls).not.toHaveBeenCalled();
    });

    it('bypasses the cache on a forced refresh', async () => {
      cacheService.get.mockResolvedValue(cached);
      cacheService.isValid.mockResolvedValue(true);
      ballService.loadAllBalls.mockResolvedValue(fetched);

      await store.loadAllBalls(undefined, undefined, true);

      expect(store.allBalls()).toEqual(fetched);
      expect(cacheService.set).toHaveBeenCalledWith('all_balls_default', fetched);
    });

    it('falls back to the cache when the fetch fails', async () => {
      ballService.loadAllBalls.mockRejectedValue(new Error('api down'));
      cacheService.get.mockResolvedValueOnce(null).mockResolvedValueOnce(cached);

      await store.loadAllBalls();

      expect(store.allBalls()).toEqual(cached);
      expect(store.isUsingCache()).toBe(true);
    });

    it('rethrows when the fetch fails and there is no cache', async () => {
      ballService.loadAllBalls.mockRejectedValue(new Error('api down'));

      await expect(store.loadAllBalls()).rejects.toThrow('api down');
    });
  });

  describe('saveBallsToArsenal', () => {
    it('persists each ball under its arsenal key and tracks it', async () => {
      const ball = makeBall({ ball_id: 'b1', core_weight: '15' });

      const failed = await store.saveBallsToArsenal([ball]);

      expect(failed).toEqual([]);
      expect(storageRepository.set).toHaveBeenCalledWith('arsenal_b1_15', ball);
      expect(store.arsenal()).toEqual([ball]);
      expect(analyticsService.trackBallAdded).toHaveBeenCalledWith({ brand: ball.brand_name, name: ball.ball_name });
    });

    it('does not add the same ball and weight twice', async () => {
      const ball = makeBall({ ball_id: 'b1', core_weight: '15' });
      await store.saveBallToArsenal(ball);

      await store.saveBallToArsenal(ball);

      expect(store.arsenal()).toHaveLength(1);
    });

    it('keeps the same ball in a different weight', async () => {
      await store.saveBallToArsenal(makeBall({ ball_id: 'b1', core_weight: '15' }));

      await store.saveBallToArsenal(makeBall({ ball_id: 'b1', core_weight: '14' }));

      expect(store.arsenal()).toHaveLength(2);
    });

    it('reports the balls that could not be saved', async () => {
      const ok = makeBall({ ball_id: 'ok', core_weight: '15' });
      const broken = makeBall({ ball_id: 'broken', core_weight: '15' });
      storageRepository.set.mockImplementation((key: string) => (key.includes('broken') ? Promise.reject(new Error('quota')) : Promise.resolve()));

      const failed = await store.saveBallsToArsenal([ok, broken]);

      expect(failed).toEqual([broken]);
      expect(store.arsenal()).toEqual([ok]);
    });
  });

  describe('updateArsenalBall', () => {
    it('rewrites the storage key, keeps the position and swaps the ball in memory', async () => {
      const oldBall = makeBall({ ball_id: 'b1', core_weight: '15', position: 3 });
      await store.saveBallToArsenal(oldBall);
      const newBall = makeBall({ ball_id: 'b2', core_weight: '14' });

      await store.updateArsenalBall(oldBall, newBall);

      expect(storageRepository.remove).toHaveBeenCalledWith('arsenal_b1_15');
      expect(storageRepository.set).toHaveBeenCalledWith('arsenal_b2_14', newBall);
      expect(newBall.position).toBe(3);
      expect(store.arsenal()).toEqual([newBall]);
    });

    it('rethrows storage failures', async () => {
      storageRepository.remove.mockRejectedValue(new Error('storage down'));

      await expect(store.updateArsenalBall(makeBall(), makeBall())).rejects.toThrow('storage down');
    });
  });

  describe('removeFromArsenal', () => {
    it('removes the ball from storage and memory', async () => {
      const ball = makeBall({ ball_id: 'b1', core_weight: '15' });
      await store.saveBallToArsenal(ball);

      await store.removeFromArsenal(ball);

      expect(storageRepository.remove).toHaveBeenCalledWith('arsenal_b1_15');
      expect(store.arsenal()).toEqual([]);
    });

    it('keeps the same ball in another weight', async () => {
      const fifteen = makeBall({ ball_id: 'b1', core_weight: '15' });
      const fourteen = makeBall({ ball_id: 'b1', core_weight: '14' });
      await store.saveBallsToArsenal([fifteen, fourteen]);

      await store.removeFromArsenal(fifteen);

      expect(store.arsenal()).toEqual([fourteen]);
    });

    it('rethrows storage failures', async () => {
      storageRepository.remove.mockRejectedValue(new Error('storage down'));

      await expect(store.removeFromArsenal(makeBall())).rejects.toThrow('storage down');
    });
  });

  describe('clearArsenal', () => {
    it('empties the arsenal in memory', async () => {
      await store.saveBallToArsenal(makeBall());

      store.clearArsenal();

      expect(store.arsenal()).toEqual([]);
    });
  });
});
