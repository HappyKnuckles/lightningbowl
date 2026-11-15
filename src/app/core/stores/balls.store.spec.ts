import { vi } from 'vitest';
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
  let updateFavoriteBalls: ReturnType<typeof vi.fn>;
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
    updateFavoriteBalls = vi.fn();

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
        { provide: FavoritesService, useValue: { favoriteBalls, updateFavoriteBalls } },
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

    it('gives balls saved before arsenal ids an id and moves them to a key by that id', async () => {
      const drilling: BallDrilling = { thumbSize: 1 };
      storageRepository.loadByPrefix.mockResolvedValue([makeBall({ ball_id: 'b1', core_weight: '15', position: 1, drilling })] as Ball[]);

      await store.loadArsenal();

      const [ball] = store.arsenal();
      expect(ball.arsenalId).toBeTruthy();
      expect(ball).toMatchObject({ ball_id: 'b1', position: 1, drilling });
      expect(storageRepository.set).toHaveBeenCalledWith(`arsenal_${ball.arsenalId}`, ball);
      expect(storageRepository.remove).toHaveBeenCalledWith('arsenal_b1_15');
    });

    it('leaves balls that have an id alone', async () => {
      const ball = makeBall({ ball_id: 'b1', arsenalId: 'one' });
      storageRepository.loadByPrefix.mockResolvedValue([ball]);

      await store.loadArsenal();

      expect(store.arsenal()).toEqual([ball]);
      expect(storageRepository.set).not.toHaveBeenCalled();
      expect(storageRepository.remove).not.toHaveBeenCalled();
    });

    it('does not add a ball twice when its old record is still there after an interrupted move', async () => {
      const moved = makeBall({ ball_id: 'b1', core_weight: '15', arsenalId: 'one' });
      storageRepository.loadByPrefix.mockResolvedValue([moved, makeBall({ ball_id: 'b1', core_weight: '15' })]);

      await store.loadArsenal();

      expect(store.arsenal()).toEqual([moved]);
      expect(storageRepository.remove).toHaveBeenCalledWith('arsenal_b1_15');
    });

    it('keeps two of the same ball, each with its id', async () => {
      const first = makeBall({ ball_id: 'b1', arsenalId: 'one', position: 1 });
      const second = makeBall({ ball_id: 'b1', arsenalId: 'two', position: 2 });
      storageRepository.loadByPrefix.mockResolvedValue([second, first]);

      await store.loadArsenal();

      expect(store.arsenal()).toEqual([first, second]);
    });

    it('gives a ball one id when loaded twice at once', async () => {
      storageRepository.loadByPrefix.mockResolvedValue([makeBall({ ball_id: 'b1' })]);

      await Promise.all([store.loadArsenal(), store.loadArsenal()]);

      expect(storageRepository.set).toHaveBeenCalledTimes(1);
    });
  });

  describe('knownBalls', () => {
    it('combines arsenal, favorites and cached balls, one entry per ball and weight', async () => {
      const arsenalBall = makeBall({ ball_id: 'a', core_weight: '15' });
      const favorite = makeBall({ ball_id: 'f', core_weight: '15' });
      const cached = makeBall({ ball_id: 'c', core_weight: '14' });
      store.arsenal.set([
        { ...arsenalBall, arsenalId: 'one' },
        { ...arsenalBall, arsenalId: 'two' },
      ]);
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

    it('remembers an arsenal ball as the catalog ball it is, without what the bowler added', async () => {
      const ball = makeBall({ ball_id: 'b1' });

      await store.rememberBalls([{ ...ball, arsenalId: 'one', position: 2, drilling: { thumbSize: 1 } }]);

      expect(storageRepository.set).toHaveBeenLastCalledWith('ball_cache', [ball]);
    });

    it('never resolves a name without a weight, whatever weights are known', async () => {
      await store.saveBallToArsenal(makeBall({ ball_id: 'z', ball_name: 'Zen', core_weight: '14' }));
      await store.rememberBalls([makeBall({ ball_id: 'z', ball_name: 'Zen', core_weight: '15' })]);

      expect(store.findKnownBall({ name: 'Zen' })).toBeUndefined();
      expect(store.findKnownBall({ name: 'Zen', weight: '14' })?.core_weight).toBe('14');
    });

    it('does not stand in another weight for a stored weight', async () => {
      await store.rememberBalls([makeBall({ ball_id: 'p', ball_name: 'Phaze II', core_weight: '16' })]);

      expect(store.findKnownBall({ name: 'Phaze II', weight: '15' })).toBeUndefined();
    });

    it('finds a ball in the weight it names', async () => {
      await store.rememberBalls([
        makeBall({ ball_id: 'p', ball_name: 'Phaze II', core_weight: '15' }),
        makeBall({ ball_id: 'p', ball_name: 'Phaze II', core_weight: '14' }),
      ]);

      expect(store.findKnownBall({ name: 'Phaze II', weight: '14' })?.core_weight).toBe('14');
      expect(store.findKnownBall({ name: 'Phaze II', weight: '15' })?.core_weight).toBe('15');
    });

    it('keeps a ball removed from the arsenal resolvable', async () => {
      const ball = makeBall({ ball_id: 'b1', ball_name: 'Zen', core_weight: '15' });
      await store.saveBallToArsenal(ball);

      await store.removeFromArsenal(ball);

      expect(store.findKnownBall({ name: 'Zen', weight: '15' })).toEqual(ball);
    });
  });

  describe('resolveBallNames', () => {
    it('uses known balls and fetches only the unknown ones, remembering just the weight named', async () => {
      const zen = makeBall({ ball_id: 'z', ball_name: 'Zen', core_weight: '15' });
      await store.rememberBalls([zen]);
      const phaze14 = makeBall({ ball_id: 'p', ball_name: 'Phaze II', core_weight: '14' });
      const phaze15 = makeBall({ ball_id: 'p', ball_name: 'Phaze II', core_weight: '15' });
      ballService.getBallsByNames.mockResolvedValue([phaze14, phaze15]);

      await store.resolveBallNames([
        { name: 'Zen', weight: '15' },
        { name: 'Phaze II', weight: '14' },
        { name: 'Phaze II', weight: '14' },
        { name: '' },
      ]);

      expect(ballService.getBallsByNames).toHaveBeenCalledWith(['Phaze II']);
      expect(store.findKnownBall({ name: 'Zen', weight: '15' })).toEqual(zen);
      expect(store.findKnownBall({ name: 'Phaze II', weight: '14' })).toEqual(phaze14);
      expect(store.knownBalls().filter((ball) => ball.ball_id === 'p')).toEqual([phaze14]);
    });

    it('leaves names without a weight alone', async () => {
      await store.resolveBallNames([{ name: 'Phaze II' }]);

      expect(ballService.getBallsByNames).not.toHaveBeenCalled();
      expect(store.knownBalls()).toEqual([]);
    });

    it('does not call the API offline', async () => {
      isOnline = false;

      await store.resolveBallNames([{ name: 'Unknown', weight: '15' }]);

      expect(ballService.getBallsByNames).not.toHaveBeenCalled();
      expect(store.knownBalls()).toEqual([]);
    });

    it('keeps what it knows when the API fails', async () => {
      await store.rememberBalls([makeBall({ ball_name: 'Zen', core_weight: '15' })]);
      ballService.getBallsByNames.mockRejectedValue(new Error('offline'));

      await expect(
        store.resolveBallNames([
          { name: 'Zen', weight: '15' },
          { name: 'Unknown', weight: '15' },
        ]),
      ).resolves.toBeUndefined();

      expect(store.knownBalls().map((ball) => ball.ball_name)).toEqual(['Zen']);
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

  describe('refreshSavedBalls', () => {
    const oldImage = 'images/balls/phaze.png';
    const newImage = 'https://images.lightningbowl.de/balls/phaze.png';

    it('swaps arsenal balls for fresh copies, keeping position and drilling, and saves them', async () => {
      const drilling: BallDrilling = { thumbSize: 1 };
      store.arsenal.set([makeBall({ ball_id: 'a', core_weight: '15', ball_image: oldImage, arsenalId: 'one', position: 2, drilling })]);
      const fresh = makeBall({ ball_id: 'a', core_weight: '15', ball_image: newImage });
      ballService.getBallsByIds.mockResolvedValue([fresh, makeBall({ ball_id: 'a', core_weight: '14' })]);

      await store.refreshSavedBalls();

      expect(store.arsenal()).toEqual([{ ...fresh, arsenalId: 'one', position: 2, drilling }]);
      expect(storageRepository.set).toHaveBeenCalledWith('arsenal_one', { ...fresh, arsenalId: 'one', position: 2, drilling });
      expect(updateFavoriteBalls).toHaveBeenCalledWith([fresh]);
    });

    it('refreshes both of two of the same ball, each keeping its own drilling', async () => {
      const first = makeBall({ ball_id: 'a', ball_image: oldImage, arsenalId: 'one', drilling: { thumbSize: 1 } });
      const second = makeBall({ ball_id: 'a', ball_image: oldImage, arsenalId: 'two', drilling: { thumbSize: 2 } });
      store.arsenal.set([first, second]);
      ballService.getBallsByIds.mockResolvedValue([makeBall({ ball_id: 'a', ball_image: newImage })]);

      await store.refreshSavedBalls();

      expect(store.arsenal().map((ball) => [ball.arsenalId, ball.ball_image, ball.drilling?.thumbSize])).toEqual([
        ['one', newImage, 1],
        ['two', newImage, 2],
      ]);
    });

    it('fetches favorites too, once per ball', async () => {
      const favorite = makeBall({ ball_id: 'f', core_weight: '14' });
      favoriteBalls.set(new Map([[favorite.key, favorite]]));
      store.arsenal.set([makeBall({ ball_id: 'f', core_weight: '15' })]);

      await store.refreshSavedBalls();

      expect(ballService.getBallsByIds).toHaveBeenCalledWith(['f']);
    });

    it('can limit itself to balls saved before the ball API', async () => {
      store.arsenal.set([makeBall({ ball_id: 'old', first_seen_at: '' }), makeBall({ ball_id: 'new' })]);

      await store.refreshSavedBalls(true);

      expect(ballService.getBallsByIds).toHaveBeenCalledWith(['old']);
    });

    it('does nothing offline or without balls saved before the ball API', async () => {
      store.arsenal.set([makeBall({ ball_id: 'new' })]);
      await store.refreshSavedBalls(true);
      isOnline = false;
      await store.refreshSavedBalls();

      expect(ballService.getBallsByIds).not.toHaveBeenCalled();
    });
  });

  describe('saveBallsToArsenal', () => {
    it('makes a catalog ball an arsenal ball with its own id, stored under that id, and tracks it', async () => {
      const ball = makeBall({ ball_id: 'b1', core_weight: '15' });

      const { added, failed } = await store.addBallsToArsenal([ball]);

      expect(failed).toEqual([]);
      expect(added).toEqual([{ ...ball, arsenalId: expect.any(String) }]);
      expect(storageRepository.set).toHaveBeenCalledWith(`arsenal_${added[0].arsenalId}`, added[0]);
      expect(store.arsenal()).toEqual(added);
      expect(analyticsService.trackBallAdded).toHaveBeenCalledWith({ brand: ball.brand_name, name: ball.ball_name });
      // the ball passed in stays a catalog ball
      expect(ball.arsenalId).toBeUndefined();
    });

    it('does not add a ball the arsenal already has in that weight', async () => {
      const ball = makeBall({ ball_id: 'b1', core_weight: '15' });
      await store.saveBallToArsenal(ball);

      const { added } = await store.addBallsToArsenal([ball]);

      expect(added).toEqual([]);
      expect(store.arsenal()).toHaveLength(1);
    });

    it('adds a second one of the same ball when asked to', async () => {
      const ball = makeBall({ ball_id: 'b1', core_weight: '15' });
      await store.saveBallToArsenal(ball);

      const { added } = await store.addBallsToArsenal([ball], { allowTwin: true });

      expect(added).toHaveLength(1);
      expect(store.arsenal()).toHaveLength(2);
      expect(new Set(store.arsenal().map((b) => b.arsenalId)).size).toBe(2);
    });

    it('adds a ball picked twice in one go only once', async () => {
      const ball = makeBall({ ball_id: 'b1', core_weight: '15' });

      await store.saveBallsToArsenal([ball, { ...ball }]);

      expect(store.arsenal()).toHaveLength(1);
    });

    it('keeps the same ball in a different weight', async () => {
      await store.saveBallToArsenal(makeBall({ ball_id: 'b1', core_weight: '15' }));

      await store.saveBallToArsenal(makeBall({ ball_id: 'b1', core_weight: '14' }));

      expect(store.arsenal()).toHaveLength(2);
    });

    it('updates an arsenal ball in place', async () => {
      await store.saveBallsToArsenal([makeBall({ ball_id: 'b1' }), makeBall({ ball_id: 'b2' })]);
      const [first, second] = store.arsenal();

      const { added } = await store.addBallsToArsenal([{ ...second, position: 1 }]);

      expect(added).toEqual([]);
      expect(store.arsenal()).toEqual([first, { ...second, position: 1 }]);
      expect(storageRepository.set).toHaveBeenLastCalledWith(`arsenal_${second.arsenalId}`, { ...second, position: 1 });
      expect(analyticsService.trackBallAdded).toHaveBeenCalledTimes(2);
    });

    it('reports the balls that could not be saved', async () => {
      const ok = makeBall({ ball_id: 'ok', core_weight: '15' });
      const broken = makeBall({ ball_id: 'broken', core_weight: '15' });
      storageRepository.set.mockImplementation((_key: string, ball: unknown) =>
        (ball as Ball).ball_id === 'broken' ? Promise.reject(new Error('quota')) : Promise.resolve(),
      );

      const failed = await store.saveBallsToArsenal([ok, broken]);

      expect(failed).toEqual([broken]);
      expect(store.arsenal().map((ball) => ball.ball_id)).toEqual(['ok']);
    });
  });

  describe('updateArsenalBall', () => {
    it('swaps the catalog data and keeps the id, position and drilling', async () => {
      const oldBall = makeBall({ ball_id: 'b1', core_weight: '15', arsenalId: 'one', position: 3, drilling: { thumbSize: 1 } });
      store.arsenal.set([oldBall]);
      const newBall = makeBall({ ball_id: 'b1', core_weight: '14' });

      await store.updateArsenalBall(oldBall, newBall);

      const updated = { ...newBall, arsenalId: 'one', position: 3, drilling: { thumbSize: 1 } };
      expect(storageRepository.set).toHaveBeenCalledWith('arsenal_one', updated);
      expect(store.arsenal()).toEqual([updated]);
      // the ball passed in stays as it was
      expect(newBall.position).toBeUndefined();
    });

    it('changes only the one of two of the same ball', async () => {
      const first = makeBall({ ball_id: 'b1', core_weight: '15', arsenalId: 'one' });
      const second = makeBall({ ball_id: 'b1', core_weight: '15', arsenalId: 'two' });
      store.arsenal.set([first, second]);

      await store.updateArsenalBall(second, makeBall({ ball_id: 'b1', core_weight: '14' }));

      expect(store.arsenal().map((ball) => [ball.arsenalId, ball.core_weight])).toEqual([
        ['one', '15'],
        ['two', '14'],
      ]);
    });

    it('rethrows storage failures', async () => {
      storageRepository.set.mockRejectedValue(new Error('storage down'));

      await expect(store.updateArsenalBall(makeBall({ arsenalId: 'one' }), makeBall())).rejects.toThrow('storage down');
    });
  });

  describe('updateBallDrilling', () => {
    const drilling: BallDrilling = {
      layout: { system: 'dual-angle', drillingAngle: 45, pinToPap: 4.5, valAngle: 30 },
      thumbSize: 63 / 64,
    };

    it('stores the drilling under the ball id and replaces the ball in memory', async () => {
      const ball = makeBall({ ball_id: 'b1', core_weight: '15', arsenalId: 'one', position: 2 });
      store.arsenal.set([ball]);

      await store.updateBallDrilling(ball, drilling);

      expect(storageRepository.set).toHaveBeenLastCalledWith('arsenal_one', { ...ball, drilling });
      expect(store.arsenal()).toEqual([{ ...ball, drilling }]);
    });

    it('drills only the one of two of the same ball', async () => {
      const first = makeBall({ ball_id: 'b1', arsenalId: 'one' });
      const second = makeBall({ ball_id: 'b1', arsenalId: 'two' });
      store.arsenal.set([first, second]);

      await store.updateBallDrilling(second, drilling);

      expect(store.arsenal()).toEqual([first, { ...second, drilling }]);
    });

    it('clears the drilling when set to undefined', async () => {
      const ball = makeBall({ ball_id: 'b1', arsenalId: 'one', drilling });
      store.arsenal.set([ball]);

      await store.updateBallDrilling(ball, undefined);

      expect(store.arsenal()[0].drilling).toBeUndefined();
    });

    it('rethrows storage failures', async () => {
      storageRepository.set.mockRejectedValue(new Error('storage down'));

      await expect(store.updateBallDrilling(makeBall({ arsenalId: 'one' }), drilling)).rejects.toThrow('storage down');
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

      expect(store.myBalls()).toEqual([store.arsenal()[0], favorite]);
    });
  });

  describe('removeFromArsenal', () => {
    it('removes the ball from storage and memory and returns it', async () => {
      const ball = makeBall({ ball_id: 'b1', core_weight: '15', arsenalId: 'one' });
      store.arsenal.set([ball]);

      const removed = await store.removeFromArsenal(ball);

      expect(removed).toEqual(ball);
      expect(storageRepository.remove).toHaveBeenCalledWith('arsenal_one');
      expect(store.arsenal()).toEqual([]);
    });

    it('removes only the one of two of the same ball', async () => {
      const first = makeBall({ ball_id: 'b1', arsenalId: 'one' });
      const second = makeBall({ ball_id: 'b1', arsenalId: 'two' });
      store.arsenal.set([first, second]);

      await store.removeFromArsenal(first);

      expect(store.arsenal()).toEqual([second]);
    });

    it('removes the arsenal ball a catalog ball is', async () => {
      const ball = makeBall({ ball_id: 'b1', core_weight: '15' });
      await store.saveBallToArsenal(ball);

      const removed = await store.removeFromArsenal(ball);

      expect(removed?.arsenalId).toBeTruthy();
      expect(store.arsenal()).toEqual([]);
    });

    it('drops the ball from myBalls but keeps it resolvable in knownBalls, as a catalog ball', async () => {
      const ball = makeBall({ ball_id: 'b1', core_weight: '15' });
      await store.saveBallToArsenal(ball);
      expect(store.myBalls()).toHaveLength(1);

      await store.removeFromArsenal(ball);

      expect(store.myBalls()).toEqual([]);
      expect(store.knownBalls()).toEqual([ball]);
    });

    it('keeps the same ball in another weight', async () => {
      const fifteen = makeBall({ ball_id: 'b1', core_weight: '15' });
      const fourteen = makeBall({ ball_id: 'b1', core_weight: '14' });
      await store.saveBallsToArsenal([fifteen, fourteen]);

      await store.removeFromArsenal(fifteen);

      expect(store.arsenal().map((ball) => ball.core_weight)).toEqual(['14']);
    });

    it('does nothing for a ball that is not in the arsenal', async () => {
      expect(await store.removeFromArsenal(makeBall())).toBeUndefined();
      expect(storageRepository.remove).not.toHaveBeenCalled();
    });

    it('rethrows storage failures', async () => {
      storageRepository.remove.mockRejectedValue(new Error('storage down'));
      const ball = makeBall({ arsenalId: 'one' });
      store.arsenal.set([ball]);

      await expect(store.removeFromArsenal(ball)).rejects.toThrow('storage down');
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
