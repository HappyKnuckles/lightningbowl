import { TestBed } from '@angular/core/testing';
import { Ball } from 'src/app/core/models/ball.model';
import { Game } from 'src/app/core/models/game.model';
import { AnalyticsService } from 'src/app/core/services/analytics/analytics.service';
import { BallFilterService } from 'src/app/core/services/ball-filter/ball-filter.service';
import { BallService } from 'src/app/core/services/ball/ball.service';
import { CacheService } from 'src/app/core/services/cache/cache.service';
import { LoadingService } from 'src/app/core/services/loader/loading.service';
import { NetworkService } from 'src/app/core/services/network/network.service';
import { BOWLER_KEYS, STORAGE_PREFIX, StorageKeys } from 'src/app/core/services/storage/storage-keys';
import { StorageRepository } from 'src/app/core/services/storage/storage.repository';
import { AppFacade } from './app.facade';
import { BallsStore } from './balls.store';
import { BowlersStore } from './bowlers.store';
import { GamesStore } from './games.store';
import { LeaguesStore } from './leagues.store';
import { PatternsStore } from './patterns.store';
import { SettingsStore } from './settings.store';

class InMemoryStorageRepository {
  store = new Map<string, unknown>();
  async create(): Promise<void> {
    /* empty */
  }
  async get<T>(key: string): Promise<T | null> {
    return this.store.has(key) ? (this.store.get(key) as T) : null;
  }
  async set<T>(key: string, value: T): Promise<void> {
    this.store.set(key, value);
  }
  async remove(key: string): Promise<void> {
    this.store.delete(key);
  }
  async forEach(callback: (value: unknown, key: string) => void): Promise<void> {
    this.store.forEach((value, key) => callback(value, key));
  }
  async loadByPrefix<T>(prefix: string): Promise<T[]> {
    const data: T[] = [];
    this.store.forEach((value, key) => {
      if (key.startsWith(prefix)) {
        data.push(value as T);
      }
    });
    return data;
  }
  async clear(): Promise<void> {
    this.store.clear();
  }
}

const makeGame = (gameId: string, overrides: Partial<Game> = {}): Game => ({
  gameId,
  date: Date.now(),
  frames: [],
  totalScore: 100,
  frameScores: [],
  isClean: false,
  isPerfect: false,
  isPractice: false,
  isPinMode: false,
  patterns: [],
  ...overrides,
});

const makeBall = (ballId: string, overrides: Partial<Ball> = {}): Ball =>
  ({ ball_id: ballId, core_weight: '15', ball_name: `Ball ${ballId}`, brand_name: 'Brand', ...overrides }) as Ball;

describe('AppFacade bowler migration', () => {
  let facade: AppFacade;
  let storage: InMemoryStorageRepository;
  let gamesStore: GamesStore;
  let ballsStore: BallsStore;
  let bowlersStore: BowlersStore;

  beforeEach(() => {
    localStorage.removeItem('active-bowler-id');
    localStorage.setItem('username', 'Nico');
    storage = new InMemoryStorageRepository();
    TestBed.configureTestingModule({
      providers: [
        { provide: StorageRepository, useValue: storage },
        { provide: LoadingService, useValue: { setLoading: jasmine.createSpy('setLoading') } },
        { provide: BallService, useValue: {} },
        { provide: CacheService, useValue: {} },
        { provide: NetworkService, useValue: {} },
        { provide: AnalyticsService, useValue: { trackBallAdded: jasmine.createSpy('trackBallAdded') } },
        { provide: BallFilterService, useValue: {} },
        { provide: PatternsStore, useValue: {} },
        { provide: LeaguesStore, useValue: { clearLeagues: jasmine.createSpy('clearLeagues') } },
        { provide: SettingsStore, useValue: {} },
      ],
    });
    facade = TestBed.inject(AppFacade);
    gamesStore = TestBed.inject(GamesStore);
    ballsStore = TestBed.inject(BallsStore);
    bowlersStore = TestBed.inject(BowlersStore);
  });

  afterEach(() => {
    localStorage.removeItem('active-bowler-id');
    localStorage.removeItem('username');
    localStorage.removeItem('first-game');
  });

  async function loadAll(): Promise<void> {
    await gamesStore.loadGameHistory();
    await ballsStore.loadArsenal();
    await bowlersStore.loadBowlers();
  }

  it('creates a default bowler seeded from the username and stamps games and arsenal', async () => {
    storage.store.set(StorageKeys.game('1'), makeGame('1'));
    storage.store.set(StorageKeys.game('2'), makeGame('2'));
    storage.store.set(StorageKeys.arsenal('7', '15'), makeBall('7'));
    await loadAll();

    await facade.runBowlerMigration();

    const bowlers = bowlersStore.bowlers();
    expect(bowlers.length).toBe(1);
    expect(bowlers[0].name).toBe('Nico');
    expect(bowlersStore.defaultBowlerId()).toBe(bowlers[0].bowlerId);

    const storedGame = storage.store.get(StorageKeys.game('1')) as Game;
    expect(storedGame.bowlerId).toBe(bowlers[0].bowlerId);
    expect(gamesStore.games().every((game) => game.bowlerId === bowlers[0].bowlerId)).toBeTrue();

    const storedBall = storage.store.get(StorageKeys.arsenal('7', '15')) as Ball;
    expect(storedBall.bowlerIds).toEqual([bowlers[0].bowlerId]);

    expect(storage.store.get(BOWLER_KEYS.migrationV1)).toBeTrue();
  });

  it('is idempotent: running twice creates no second bowler and rewrites nothing', async () => {
    storage.store.set(StorageKeys.game('1'), makeGame('1'));
    await loadAll();
    await facade.runBowlerMigration();
    const firstRunId = bowlersStore.defaultBowlerId();

    await facade.runBowlerMigration();

    expect(bowlersStore.bowlers().length).toBe(1);
    expect(bowlersStore.defaultBowlerId()).toBe(firstRunId);
  });

  it('resumes a partial migration without touching already-stamped games', async () => {
    storage.store.set(`${STORAGE_PREFIX.bowler}_b-existing`, { bowlerId: 'b-existing', name: 'Partner', createdAt: 1 });
    storage.store.set(BOWLER_KEYS.defaultBowler, 'b-existing');
    storage.store.set(StorageKeys.game('1'), makeGame('1', { bowlerId: 'b-other' }));
    storage.store.set(StorageKeys.game('2'), makeGame('2'));
    await loadAll();

    await facade.runBowlerMigration();

    expect((storage.store.get(StorageKeys.game('1')) as Game).bowlerId).toBe('b-other');
    expect((storage.store.get(StorageKeys.game('2')) as Game).bowlerId).toBe('b-existing');
    expect(bowlersStore.bowlers().length).toBe(1);
  });

  it('falls back to "Me" when no username is stored', async () => {
    localStorage.removeItem('username');
    await loadAll();
    await facade.runBowlerMigration();
    expect(bowlersStore.bowlers()[0].name).toBe('Me');
  });

  describe('deleteBowler', () => {
    let keepId: string;
    let dropId: string;

    beforeEach(async () => {
      await loadAll();
      await facade.runBowlerMigration();
      keepId = bowlersStore.defaultBowlerId();
      const drop = await bowlersStore.addBowler('Partner');
      dropId = drop.bowlerId;
      await gamesStore.saveGamesToLocalStorage([makeGame('g-keep', { bowlerId: keepId }), makeGame('g-drop', { bowlerId: dropId })]);
      await ballsStore.saveBallToArsenal(makeBall('9', { bowlerIds: [dropId] }));
    });

    it('cascade-deletes the bowler games and arsenal membership', async () => {
      await facade.deleteBowler(dropId);

      expect(bowlersStore.bowlers().map((b) => b.bowlerId)).toEqual([keepId]);
      expect(gamesStore.games().map((g) => g.gameId)).toEqual(['g-keep']);
      expect(storage.store.has(StorageKeys.game('g-drop'))).toBeFalse();
      expect(ballsStore.arsenal().length).toBe(0);
    });

    it('reassigns games and arsenal to another bowler instead of deleting', async () => {
      await facade.deleteBowler(dropId, keepId);

      expect(gamesStore.games().length).toBe(2);
      expect((storage.store.get(StorageKeys.game('g-drop')) as Game).bowlerId).toBe(keepId);
      expect(ballsStore.arsenal()[0].bowlerIds).toEqual([keepId]);
    });

    it('refuses to delete the last bowler', async () => {
      await facade.deleteBowler(dropId);
      await expectAsync(facade.deleteBowler(keepId)).toBeRejected();
      expect(bowlersStore.bowlers().length).toBe(1);
    });
  });
});
