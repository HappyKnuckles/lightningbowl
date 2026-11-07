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

    it('never resolves a name without a weight, whatever weights are known', async () => {
      await store.saveBallToArsenal(makeBall({ ball_id: 'z', ball_name: 'Zen', core_weight: '14' }));
      await store.rememberBalls([makeBall({ ball_id: 'z', ball_name: 'Zen', core_weight: '15' })]);

      expect(store.findKnownBall('Zen')).toBeUndefined();
      expect(store.findKnownBall('zen14')?.core_weight).toBe('14');
    });

    it('does not stand in another weight for a stored weight', async () => {
      await store.rememberBalls([makeBall({ ball_id: 'p', ball_name: 'Phaze II', core_weight: '16' })]);

      expect(store.findKnownBall('Phaze II15')).toBeUndefined();
    });

    it('finds balls stored with their weight appended, in that weight', async () => {
      await store.rememberBalls([
        makeBall({ ball_id: 'p', ball_name: 'Phaze II', core_weight: '15' }),
        makeBall({ ball_id: 'p', ball_name: 'Phaze II', core_weight: '14' }),
      ]);

      expect(store.findKnownBall('Phaze II14')?.core_weight).toBe('14');
      expect(store.findKnownBall('phaze ii 15lbs')?.core_weight).toBe('15');
    });

    it('keeps a ball removed from the arsenal resolvable', async () => {
      const ball = makeBall({ ball_id: 'b1', ball_name: 'Zen', core_weight: '15' });
      await store.saveBallToArsenal(ball);

      await store.removeFromArsenal(ball);

      expect(store.findKnownBall('Zen15')).toEqual(ball);
    });
  });

  describe('resolveBallNames', () => {
    it('uses known balls and fetches only the unknown ones, remembering just the weight named', async () => {
      const zen = makeBall({ ball_id: 'z', ball_name: 'Zen', core_weight: '15' });
      await store.rememberBalls([zen]);
      const phaze14 = makeBall({ ball_id: 'p', ball_name: 'Phaze II', core_weight: '14' });
      const phaze15 = makeBall({ ball_id: 'p', ball_name: 'Phaze II', core_weight: '15' });
      ballService.getBallsByNames.mockResolvedValue([phaze14, phaze15]);

      await store.resolveBallNames(['Zen15', 'Phaze II14', 'Phaze II14', '']);

      expect(ballService.getBallsByNames).toHaveBeenCalledWith(['Phaze II']);
      expect(store.findKnownBall('Zen15')).toEqual(zen);
      expect(store.findKnownBall('Phaze II14')).toEqual(phaze14);
      expect(store.knownBalls().filter((ball) => ball.ball_id === 'p')).toEqual([phaze14]);
    });

    it('leaves names without a weight alone: their weight is asked for', async () => {
      await store.resolveBallNames(['Phaze II']);

      expect(ballService.getBallsByNames).not.toHaveBeenCalled();
      expect(store.knownBalls()).toEqual([]);
    });

    it('does not call the API offline', async () => {
      isOnline = false;

      await store.resolveBallNames(['Unknown15']);

      expect(ballService.getBallsByNames).not.toHaveBeenCalled();
      expect(store.knownBalls()).toEqual([]);
    });

    it('keeps what it knows when the API fails', async () => {
      await store.rememberBalls([makeBall({ ball_name: 'Zen', core_weight: '15' })]);
      ballService.getBallsByNames.mockRejectedValue(new Error('offline'));

      await expect(store.resolveBallNames(['Zen15', 'Unknown15'])).resolves.toBeUndefined();

      expect(store.knownBalls().map((ball) => ball.ball_name)).toEqual(['Zen']);
    });
  });

  describe('weightOptions', () => {
    it("lists every weight a name comes in, the API's and the known ones, lightest first", async () => {
      const own14 = makeBall({ ball_id: 'p', ball_name: 'Phaze II', core_weight: '14' });
      await store.saveBallToArsenal(own14);
      ballService.getBallsByNames.mockResolvedValue([
        makeBall({ ball_id: 'p', ball_name: 'Phaze II', core_weight: '15' }),
        makeBall({ ball_id: 'p', ball_name: 'Phaze II', core_weight: '12' }),
        makeBall({ ball_id: 'p', ball_name: 'Phaze II', core_weight: '14' }),
      ]);

      const { options, complete } = await store.weightOptions(['phaze ii', 'Unknown']);

      expect(complete).toBe(true);
      expect(options.get('phaze ii')?.map((ball) => ball.core_weight)).toEqual(['12', '14', '15']);
      expect(options.get('Unknown')).toEqual([]);
    });

    it('offline, offers only the known weights and says the list may be incomplete', async () => {
      isOnline = false;
      await store.rememberBalls([makeBall({ ball_id: 'p', ball_name: 'Phaze II', core_weight: '15' })]);

      const { options, complete } = await store.weightOptions(['Phaze II']);

      expect(ballService.getBallsByNames).not.toHaveBeenCalled();
      expect(complete).toBe(false);
      expect(options.get('Phaze II')?.map((ball) => ball.core_weight)).toEqual(['15']);
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

    it('refreshes only the weights that were cached, once per ball', async () => {
      await store.rememberBalls([makeBall({ ball_id: 'a', core_weight: '15' }), makeBall({ ball_id: 'a', core_weight: '14' })]);
      ballService.getBallsByIds.mockResolvedValue(['12', '14', '15', '16'].map((weight) => makeBall({ ball_id: 'a', core_weight: weight })));

      await store.refreshKnownBalls();

      expect(ballService.getBallsByIds).toHaveBeenCalledWith(['a']);
      expect(
        store
          .knownBalls()
          .map((ball) => ball.core_weight)
          .sort(),
      ).toEqual(['14', '15']);
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
