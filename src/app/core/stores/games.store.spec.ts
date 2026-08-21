import { TestBed } from '@angular/core/testing';
import { Game } from 'src/app/core/models/game.model';
import { LoadingService } from 'src/app/core/services/loader/loading.service';
import { StorageRepository } from 'src/app/core/services/storage/storage.repository';
import { createSpyObj, SpyObj } from 'src/testing/spy-obj';
import { makeGame } from 'src/testing/fixtures';
import { GamesStore } from './games.store';

describe('GamesStore', () => {
  let store: GamesStore;
  let storageRepository: SpyObj<StorageRepository>;
  let loadingService: SpyObj<LoadingService>;

  beforeEach(() => {
    storageRepository = createSpyObj<StorageRepository>(['loadByPrefix', 'set', 'remove']);
    storageRepository.loadByPrefix.mockResolvedValue([]);
    storageRepository.set.mockResolvedValue(undefined);
    storageRepository.remove.mockResolvedValue(undefined);
    loadingService = createSpyObj<LoadingService>(['setLoading']);

    TestBed.configureTestingModule({
      providers: [
        { provide: StorageRepository, useValue: storageRepository },
        { provide: LoadingService, useValue: loadingService },
      ],
    });
    store = TestBed.inject(GamesStore);
    localStorage.removeItem('first-game');
  });

  afterEach(() => {
    localStorage.removeItem('first-game');
  });

  describe('loadGameHistory', () => {
    it('sorts the loaded history newest first', async () => {
      storageRepository.loadByPrefix.mockResolvedValue([
        makeGame({ gameId: 'old', date: 100 }),
        makeGame({ gameId: 'new', date: 300 }),
        makeGame({ gameId: 'mid', date: 200 }),
      ]);

      await store.loadGameHistory();

      expect(store.games().map((g) => g.gameId)).toEqual(['new', 'mid', 'old']);
    });

    it('migrates a legacy single pattern into the patterns array', async () => {
      const legacy = { ...makeGame({ gameId: 'legacy' }), pattern: 'Shark', patterns: undefined } as unknown as Game;
      storageRepository.loadByPrefix.mockResolvedValue([legacy]);

      await store.loadGameHistory();

      expect(store.games()[0].patterns).toEqual(['Shark']);
      expect((store.games()[0] as Game & { pattern?: string }).pattern).toBeUndefined();
      expect(storageRepository.set).toHaveBeenCalled();
    });

    it('defaults games without patterns to an empty array', async () => {
      storageRepository.loadByPrefix.mockResolvedValue([{ ...makeGame({ gameId: 'g1' }), patterns: undefined } as unknown as Game]);

      await store.loadGameHistory();

      expect(store.games()[0].patterns).toEqual([]);
    });

    it('sorts unsorted patterns and balls, then persists the migration', async () => {
      storageRepository.loadByPrefix.mockResolvedValue([makeGame({ gameId: 'g1', patterns: ['Shark', 'Cheetah'], balls: ['Spare', 'Hammer'] })]);

      await store.loadGameHistory();

      expect(store.games()[0].patterns).toEqual(['Cheetah', 'Shark']);
      expect(store.games()[0].balls).toEqual(['Hammer', 'Spare']);
      expect(storageRepository.set).toHaveBeenCalledTimes(1);
    });

    it('skips the rewrite when nothing needs migrating', async () => {
      storageRepository.loadByPrefix.mockResolvedValue([makeGame({ gameId: 'g1', patterns: ['Cheetah', 'Shark'], balls: ['Hammer'] })]);

      await store.loadGameHistory();

      expect(storageRepository.set).not.toHaveBeenCalled();
    });

    it('remembers the earliest game date', async () => {
      storageRepository.loadByPrefix.mockResolvedValue([makeGame({ gameId: 'g1', date: 300 }), makeGame({ gameId: 'g2', date: 100 })]);

      await store.loadGameHistory();

      expect(localStorage.getItem('first-game')).toBe('100');
    });

    it('toggles the loading flag and rethrows storage failures', async () => {
      storageRepository.loadByPrefix.mockRejectedValue(new Error('storage down'));

      await expect(store.loadGameHistory()).rejects.toThrow('storage down');
      expect(loadingService.setLoading).toHaveBeenNthCalledWith(1, true);
      expect(loadingService.setLoading).toHaveBeenLastCalledWith(false);
    });
  });

  describe('saveGameToLocalStorage', () => {
    it('prepends a new game and persists it under its game key', async () => {
      await store.saveGameToLocalStorage(makeGame({ gameId: 'g1', date: 100 }));
      await store.saveGameToLocalStorage(makeGame({ gameId: 'g2', date: 200 }));

      expect(store.games().map((g) => g.gameId)).toEqual(['g2', 'g1']);
      expect(storageRepository.set).toHaveBeenCalledWith('gameg1', expect.objectContaining({ gameId: 'g1' }));
    });

    it('replaces an existing game in place', async () => {
      await store.saveGameToLocalStorage(makeGame({ gameId: 'g1', totalScore: 100 }));

      await store.saveGameToLocalStorage(makeGame({ gameId: 'g1', totalScore: 200 }));

      expect(store.games()).toHaveLength(1);
      expect(store.games()[0].totalScore).toBe(200);
    });

    it('moves the first-game date earlier when an older game arrives', async () => {
      await store.saveGameToLocalStorage(makeGame({ gameId: 'g1', date: 200 }));

      await store.saveGameToLocalStorage(makeGame({ gameId: 'g2', date: 100 }));

      expect(localStorage.getItem('first-game')).toBe('100');
    });

    it('recomputes the first-game date when the oldest game is moved forward', async () => {
      await store.saveGameToLocalStorage(makeGame({ gameId: 'g1', date: 100 }));
      await store.saveGameToLocalStorage(makeGame({ gameId: 'g2', date: 200 }));

      await store.saveGameToLocalStorage(makeGame({ gameId: 'g1', date: 300 }));

      expect(localStorage.getItem('first-game')).toBe('200');
    });

    it('rethrows storage failures', async () => {
      storageRepository.set.mockRejectedValue(new Error('quota'));

      await expect(store.saveGameToLocalStorage(makeGame())).rejects.toThrow('quota');
    });
  });

  describe('saveGamesToLocalStorage', () => {
    it('writes every game and keeps the saved batch on top', async () => {
      await store.saveGameToLocalStorage(makeGame({ gameId: 'existing', date: 100 }));
      storageRepository.set.mockClear();

      await store.saveGamesToLocalStorage([makeGame({ gameId: 'a', date: 200 }), makeGame({ gameId: 'b', date: 300 })]);

      expect(storageRepository.set).toHaveBeenCalledTimes(2);
      expect(store.games().map((g) => g.gameId)).toEqual(['a', 'b', 'existing']);
    });

    it('replaces games that are already in the store', async () => {
      await store.saveGameToLocalStorage(makeGame({ gameId: 'g1', totalScore: 100 }));

      await store.saveGamesToLocalStorage([makeGame({ gameId: 'g1', totalScore: 250 })]);

      expect(store.games()).toHaveLength(1);
      expect(store.games()[0].totalScore).toBe(250);
    });

    it('rethrows storage failures', async () => {
      storageRepository.set.mockRejectedValue(new Error('quota'));

      await expect(store.saveGamesToLocalStorage([makeGame()])).rejects.toThrow('quota');
    });
  });

  describe('deleteGame', () => {
    it('removes the game from storage and memory', async () => {
      await store.saveGameToLocalStorage(makeGame({ gameId: 'g1', date: 100 }));
      await store.saveGameToLocalStorage(makeGame({ gameId: 'g2', date: 200 }));

      await store.deleteGame('g1');

      expect(storageRepository.remove).toHaveBeenCalledWith('gameg1');
      expect(store.games().map((g) => g.gameId)).toEqual(['g2']);
    });

    it('recomputes the first-game date when the oldest game goes', async () => {
      await store.saveGameToLocalStorage(makeGame({ gameId: 'g1', date: 100 }));
      await store.saveGameToLocalStorage(makeGame({ gameId: 'g2', date: 200 }));

      await store.deleteGame('g1');

      expect(localStorage.getItem('first-game')).toBe('200');
    });

    it('forgets the first-game date once the history is empty', async () => {
      await store.saveGameToLocalStorage(makeGame({ gameId: 'g1', date: 100 }));

      await store.deleteGame('g1');

      expect(localStorage.getItem('first-game')).toBeNull();
    });

    it('rethrows storage failures', async () => {
      storageRepository.remove.mockRejectedValue(new Error('storage down'));

      await expect(store.deleteGame('g1')).rejects.toThrow('storage down');
    });
  });

  describe('updateGamesInMemory', () => {
    it('applies the updater without touching storage', async () => {
      await store.saveGameToLocalStorage(makeGame({ gameId: 'g1', league: 'Old' }));
      storageRepository.set.mockClear();

      store.updateGamesInMemory((games) => games.map((game) => ({ ...game, league: 'New' })));

      expect(store.games()[0].league).toBe('New');
      expect(storageRepository.set).not.toHaveBeenCalled();
    });
  });

  describe('clearGames', () => {
    it('empties the store and the first-game date', async () => {
      await store.saveGameToLocalStorage(makeGame({ gameId: 'g1', date: 100 }));

      store.clearGames();

      expect(store.games()).toEqual([]);
      expect(localStorage.getItem('first-game')).toBeNull();
    });
  });
});
