import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Ball, BallDrilling } from 'src/app/core/models/ball.model';
import { AnalyticsService } from 'src/app/core/services/analytics/analytics.service';
import { BallService } from 'src/app/core/services/ball/ball.service';
import { FavoritesService } from 'src/app/core/services/favorites/favorites.service';
import { NetworkService } from 'src/app/core/services/network/network.service';
import { StorageRepository } from 'src/app/core/services/storage/storage.repository';
import { makeBall } from 'src/testing/fixtures';
import { createSpyObj, SpyObj } from 'src/testing/spy-obj';
import { BallsStore } from './balls.store';

describe('BallsStore', () => {
  let store: BallsStore;
  let storageRepository: SpyObj<StorageRepository>;
  let ballService: SpyObj<BallService>;
  let favoriteBalls: ReturnType<typeof signal<Map<string, Ball>>>;
  let analyticsService: SpyObj<AnalyticsService>;
  let isOnline: boolean;

  beforeEach(() => {
    isOnline = true;
    storageRepository = createSpyObj<StorageRepository>(['loadByPrefix', 'get', 'set', 'remove']);
    storageRepository.loadByPrefix.mockResolvedValue([]);
    storageRepository.get.mockResolvedValue(null);
    storageRepository.set.mockResolvedValue(undefined);
    storageRepository.remove.mockResolvedValue(undefined);

    ballService = createSpyObj<BallService>(['getBallsByNames', 'getBallsByIds']);
    ballService.getBallsByNames.mockResolvedValue([]);
    ballService.getBallsByIds.mockResolvedValue([]);

    favoriteBalls = signal(new Map<string, Ball>());

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
        { provide: FavoritesService, useValue: { favoriteBalls } },
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

  describe('knownBalls', () => {
    it('combines arsenal, favorites and cached balls, one entry per ball and weight', async () => {
      const arsenalBall = makeBall({ ball_id: 'a', core_weight: '15' });
      const favorite = makeBall({ ball_id: 'f', core_weight: '15' });
      const cached = makeBall({ ball_id: 'c', core_weight: '14' });
      await store.saveBallToArsenal(arsenalBall);
      favoriteBalls.set(
        new Map([
          ['f-15', favorite],
          ['a-15', arsenalBall],
        ]),
      );
      storageRepository.get.mockResolvedValue([cached, arsenalBall]);

      await store.loadBallCache();

      expect(store.knownBalls().map((b) => `${b.ball_id}-${b.core_weight}`)).toEqual(['a-15', 'f-15', 'c-14']);
    });

    it('remembers balls persistently, newest copy first', async () => {
      const old = makeBall({ ball_id: 'b1', core_weight: '15', ball_name: 'Old' });
      const updated = makeBall({ ball_id: 'b1', core_weight: '15', ball_name: 'Updated' });

      await store.rememberBalls([old]);
      await store.rememberBalls([updated]);

      expect(store.knownBalls()).toEqual([updated]);
      expect(storageRepository.set).toHaveBeenLastCalledWith('ball_cache', [updated]);
    });

    it('finds a known ball by name, preferring the given weight', async () => {
      await store.rememberBalls([
        makeBall({ ball_id: 'z', ball_name: 'Zen', core_weight: '15' }),
        makeBall({ ball_id: 'z', ball_name: 'Zen', core_weight: '14' }),
      ]);

      expect(store.findKnownBall('zen', 14)?.core_weight).toBe('14');
      expect(store.findKnownBall('Zen')?.core_weight).toBe('15');
      expect(store.findKnownBall('Phaze')).toBeUndefined();
    });

    it('finds balls stored with their weight appended, in that weight', async () => {
      await store.rememberBalls([
        makeBall({ ball_id: 'p', ball_name: 'Phaze II', core_weight: '15' }),
        makeBall({ ball_id: 'p', ball_name: 'Phaze II', core_weight: '14' }),
      ]);

      expect(store.findKnownBall('Phaze II14')?.core_weight).toBe('14');
      expect(store.findKnownBall('phaze ii 15lbs')?.core_weight).toBe('15');
    });

    it('describes stored balls as "Name 15lbs", plain names unchanged', async () => {
      const phaze = makeBall({ ball_id: 'p', ball_name: 'Phaze II', core_weight: '15' });
      await store.rememberBalls([phaze]);

      expect(store.describeStoredBall('Phaze II15')).toEqual({ label: 'Phaze II 15lbs', ball: phaze });
      expect(store.describeStoredBall('Phaze II')).toEqual({ label: 'Phaze II', ball: phaze });
      expect(store.describeStoredBall('Unknown16')).toEqual({ label: 'Unknown 16lbs', ball: undefined });
    });

    it('keeps a ball removed from the arsenal resolvable', async () => {
      const ball = makeBall({ ball_id: 'b1', ball_name: 'Zen' });
      await store.saveBallToArsenal(ball);

      await store.removeFromArsenal(ball);

      expect(store.findKnownBall('Zen')).toEqual(ball);
    });
  });

  describe('resolveBallNames', () => {
    it('uses known balls and fetches only the unknown names', async () => {
      const zen = makeBall({ ball_id: 'z', ball_name: 'Zen' });
      await store.rememberBalls([zen]);
      const phaze14 = makeBall({ ball_id: 'p', ball_name: 'Phaze II', core_weight: '14' });
      const phaze15 = makeBall({ ball_id: 'p', ball_name: 'Phaze II', core_weight: '15' });
      ballService.getBallsByNames.mockResolvedValue([phaze14, phaze15]);

      const resolved = await store.resolveBallNames(['Zen', 'Phaze II', 'Phaze II', ''], 14);

      expect(ballService.getBallsByNames).toHaveBeenCalledWith(['Phaze II']);
      expect(resolved.get('zen')).toEqual(zen);
      expect(resolved.get('phaze ii')).toEqual(phaze14);
      expect(store.findKnownBall('Phaze II', 15)).toEqual(phaze15);
    });

    it('resolves values with the weight appended through the bare name', async () => {
      const phaze14 = makeBall({ ball_id: 'p', ball_name: 'Phaze II', core_weight: '14' });
      const phaze15 = makeBall({ ball_id: 'p', ball_name: 'Phaze II', core_weight: '15' });
      ballService.getBallsByNames.mockResolvedValue([phaze14, phaze15]);

      const resolved = await store.resolveBallNames(['Phaze II14']);

      expect(ballService.getBallsByNames).toHaveBeenCalledWith(['Phaze II14', 'Phaze II']);
      expect(resolved.get('phaze ii14')).toEqual(phaze14);
    });

    it('does not call the API offline', async () => {
      isOnline = false;

      const resolved = await store.resolveBallNames(['Unknown']);

      expect(ballService.getBallsByNames).not.toHaveBeenCalled();
      expect(resolved.size).toBe(0);
    });

    it('returns what it knows when the API fails', async () => {
      await store.rememberBalls([makeBall({ ball_name: 'Zen' })]);
      ballService.getBallsByNames.mockRejectedValue(new Error('offline'));

      const resolved = await store.resolveBallNames(['Zen', 'Unknown']);

      expect([...resolved.keys()]).toEqual(['zen']);
    });
  });

  describe('refreshKnownBalls', () => {
    it('re-fetches cached balls and keeps ones the API no longer returns', async () => {
      const stale = makeBall({ ball_id: 'a', core_weight: '15', availability: 'Available' });
      const gone = makeBall({ ball_id: 'gone', core_weight: '15' });
      await store.rememberBalls([stale, gone]);
      const fresh = makeBall({ ball_id: 'a', core_weight: '15', availability: 'Discontinued' });
      ballService.getBallsByIds.mockResolvedValue([fresh]);

      await store.refreshKnownBalls();

      expect(ballService.getBallsByIds).toHaveBeenCalledWith(['a', 'gone']);
      expect(store.knownBalls()).toEqual([fresh, gone]);
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

    it('keeps the drilling when the weight changes', async () => {
      const oldBall = makeBall({ ball_id: 'b1', core_weight: '15', drilling: { thumbSize: 1 } });
      await store.saveBallToArsenal(oldBall);
      const newBall = makeBall({ ball_id: 'b1', core_weight: '14' });

      await store.updateArsenalBall(oldBall, newBall);

      expect(store.arsenal()[0].drilling).toEqual({ thumbSize: 1 });
    });
  });

  describe('updateBallDrilling', () => {
    const drilling: BallDrilling = {
      layout: { system: 'dual-angle', drillingAngle: 45, pinToPap: 4.5, valAngle: 30 },
      thumbSize: 63 / 64,
    };

    it('stores the drilling under the ball key and replaces the ball in memory', async () => {
      const ball = makeBall({ ball_id: 'b1', core_weight: '15', position: 2 });
      await store.saveBallToArsenal(ball);

      await store.updateBallDrilling(ball, drilling);

      expect(storageRepository.set).toHaveBeenLastCalledWith('arsenal_b1_15', { ...ball, drilling });
      expect(store.arsenal()).toEqual([{ ...ball, drilling }]);
    });

    it('clears the drilling when set to undefined', async () => {
      const ball = makeBall({ ball_id: 'b1', drilling });
      await store.saveBallToArsenal(ball);

      await store.updateBallDrilling(ball, undefined);

      expect(store.arsenal()[0].drilling).toBeUndefined();
    });

    it('rethrows storage failures', async () => {
      storageRepository.set.mockRejectedValue(new Error('storage down'));

      await expect(store.updateBallDrilling(makeBall(), drilling)).rejects.toThrow('storage down');
    });
  });

  describe('myBalls', () => {
    it('lists the arsenal first, then favorites, without duplicates', async () => {
      const owned = makeBall({ ball_id: 'b1', core_weight: '15' });
      const favorite = makeBall({ ball_id: 'b2', core_weight: '15' });
      await store.saveBallToArsenal(owned);
      favoriteBalls.set(
        new Map([
          ['b2-15', favorite],
          ['b1-15', owned],
        ]),
      );

      expect(store.myBalls()).toEqual([owned, favorite]);
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

    it('drops the ball from myBalls but keeps it resolvable in knownBalls', async () => {
      const ball = makeBall({ ball_id: 'b1', core_weight: '15' });
      await store.saveBallToArsenal(ball);
      expect(store.myBalls()).toEqual([ball]);

      await store.removeFromArsenal(ball);

      expect(store.myBalls()).toEqual([]);
      expect(store.knownBalls().map((b) => b.ball_id)).toContain('b1');
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
