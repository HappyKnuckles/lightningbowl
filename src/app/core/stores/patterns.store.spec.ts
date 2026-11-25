import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Game } from 'src/app/core/models/game.model';
import { Pattern, PatternSummary } from 'src/app/core/models/pattern.model';
import { CacheService } from 'src/app/core/services/cache/cache.service';
import { NetworkService } from 'src/app/core/services/network/network.service';
import { PatternService } from 'src/app/core/services/pattern/pattern.service';
import { StorageKeys } from 'src/app/core/services/storage/storage-keys';
import { StorageRepository } from 'src/app/core/services/storage/storage.repository';
import { makeGame, makePattern } from 'src/testing/fixtures';
import { createSpyObj, SpyObj } from 'src/testing/spy-obj';
import { GamesStore } from './games.store';
import { PatternsStore } from './patterns.store';

const summary = (overrides: Partial<Pattern>): PatternSummary => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { forwards_data, reverse_data, ...rest } = makePattern(overrides);
  return rest;
};

describe('PatternsStore', () => {
  let store: PatternsStore;
  let patternService: SpyObj<PatternService>;
  let storage: SpyObj<StorageRepository>;
  let cacheService: SpyObj<CacheService>;
  let games: ReturnType<typeof signal<Game[]>>;
  let online: ReturnType<typeof signal<boolean>>;
  /** What the API finds per title; anything else isn't found. */
  let catalog: PatternSummary[];

  const played = (...titles: string[][]) => games.set(titles.map((patterns, i) => makeGame({ gameId: `g${i}`, date: i, patterns })));

  beforeEach(() => {
    catalog = [];
    games = signal<Game[]>([]);
    online = signal(true);

    patternService = createSpyObj<PatternService>(['findPatternByTitle']);
    patternService.findPatternByTitle.mockImplementation(async (title) => catalog.find((p) => p.title.toLowerCase() === title.toLowerCase()));

    storage = createSpyObj<StorageRepository>(['get', 'set']);
    storage.get.mockResolvedValue(null);
    storage.set.mockResolvedValue(undefined);

    cacheService = createSpyObj<CacheService>(['delete']);
    cacheService.delete.mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      providers: [
        { provide: PatternService, useValue: patternService },
        { provide: StorageRepository, useValue: storage },
        { provide: CacheService, useValue: cacheService },
        { provide: GamesStore, useValue: { games } },
        {
          provide: NetworkService,
          useValue: {
            get isOnline() {
              return online();
            },
            get isOffline() {
              return !online();
            },
          },
        },
      ],
    });
    store = TestBed.inject(PatternsStore);
  });

  /** Runs the store's effect and waits for the lookups it starts. */
  async function settle(): Promise<void> {
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve));
  }

  describe('loadPatternCache', () => {
    it('loads the persisted patterns and drops the old full-list caches', async () => {
      const shark = summary({ url: 'shark', title: 'Shark', chart_standard: 'shark.png' });
      storage.get.mockResolvedValue([shark]);

      await store.loadPatternCache();

      expect(storage.get).toHaveBeenCalledWith(StorageKeys.patternCache);
      expect(store.myPatterns()).toEqual([shark]);
      expect(store.patternImageMap()).toEqual({ Shark: 'shark.png' });
      expect(cacheService.delete).toHaveBeenCalledWith('all_patterns');
      expect(cacheService.delete).toHaveBeenCalledWith('pattern_image_map');
    });

    it('starts empty when storage fails', async () => {
      storage.get.mockRejectedValue(new Error('broken'));

      await store.loadPatternCache();

      expect(store.myPatterns()).toEqual([]);
    });
  });

  describe('myPatterns', () => {
    it('lists played patterns by usage, then the other known ones, with unresolved titles as the title alone', async () => {
      online.set(false);
      storage.get.mockResolvedValue([summary({ url: 'picked', title: 'Picked' }), summary({ url: 'shark', title: 'Shark' })]);
      await store.loadPatternCache();
      played(['Cheetah'], ['Shark'], ['Shark']);

      expect(store.myPatterns().map((p) => p.title)).toEqual(['Shark', 'Cheetah', 'Picked']);
      expect(store.myPatterns()[1]).toEqual({ title: 'Cheetah', url: 'Cheetah' });
    });
  });

  describe('rememberPatterns', () => {
    it('persists picked patterns without oil rows and replaces older copies', async () => {
      await store.rememberPatterns([makePattern({ url: 'shark', title: 'Shark', chart_standard: 'old.png' })]);
      await store.rememberPatterns([makePattern({ url: 'shark', title: 'Shark', chart_standard: 'new.png' })]);

      const saved = storage.set.mock.lastCall![1] as PatternSummary[];
      expect(saved).toHaveLength(1);
      expect(saved[0].chart_standard).toBe('new.png');
      expect('forwards_data' in saved[0]).toBe(false);
    });

    it('skips patterns that are only a title', async () => {
      await store.rememberPatterns([{ title: 'Cheetah', url: 'Cheetah' }]);

      expect(storage.set).not.toHaveBeenCalled();
    });
  });

  describe('resolving the patterns named in games', () => {
    it('looks up unknown titles once loaded and remembers what it finds', async () => {
      catalog = [summary({ url: 'shark', title: 'Shark', chart_standard: 'shark.png' })];
      played(['Shark', 'Gone']);
      await settle();
      expect(patternService.findPatternByTitle).not.toHaveBeenCalled();

      await store.loadPatternCache();
      await settle();

      expect(patternService.findPatternByTitle).toHaveBeenCalledTimes(2);
      expect(store.myPatterns()[0].url).toBe('shark');
      expect(store.patternImageMap()).toEqual({ Shark: 'shark.png' });
    });

    it('searches each title once while online, and again after reconnecting', async () => {
      await store.loadPatternCache();
      played(['Gone']);
      await settle();
      played(['Gone'], ['Gone']);
      await settle();
      expect(patternService.findPatternByTitle).toHaveBeenCalledTimes(1);

      online.set(false);
      await settle();
      online.set(true);
      await settle();

      expect(patternService.findPatternByTitle).toHaveBeenCalledTimes(2);
    });

    it("doesn't search offline", async () => {
      online.set(false);
      await store.loadPatternCache();
      played(['Shark']);
      await settle();

      expect(patternService.findPatternByTitle).not.toHaveBeenCalled();
    });
  });
});
