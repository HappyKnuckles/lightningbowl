import { TestBed } from '@angular/core/testing';
import { AnalyticsService } from 'src/app/core/services/analytics/analytics.service';
import { StorageRepository } from 'src/app/core/services/storage/storage.repository';
import { createSpyObj, SpyObj } from 'src/testing/spy-obj';
import { LeaguesStore } from './leagues.store';

describe('LeaguesStore', () => {
  let store: LeaguesStore;
  let storageRepository: SpyObj<StorageRepository>;
  let analyticsService: SpyObj<AnalyticsService>;

  beforeEach(() => {
    storageRepository = createSpyObj<StorageRepository>(['loadByPrefix', 'set', 'remove']);
    storageRepository.loadByPrefix.mockResolvedValue([]);
    storageRepository.set.mockResolvedValue(undefined);
    storageRepository.remove.mockResolvedValue(undefined);
    analyticsService = createSpyObj<AnalyticsService>(['trackLeagueDeleted']);

    TestBed.configureTestingModule({
      providers: [
        { provide: StorageRepository, useValue: storageRepository },
        { provide: AnalyticsService, useValue: analyticsService },
      ],
    });
    store = TestBed.inject(LeaguesStore);
  });

  describe('loadLeagues', () => {
    it('shows the most recently added league first', async () => {
      storageRepository.loadByPrefix.mockResolvedValue(['Monday', 'Tuesday', 'Friday']);

      const leagues = await store.loadLeagues();

      expect(leagues).toEqual(['Friday', 'Tuesday', 'Monday']);
      expect(store.leagues()).toEqual(['Friday', 'Tuesday', 'Monday']);
    });

    it('reads leagues saved as plain names as leagues without seasons, next to saved league objects', async () => {
      const season = { id: 's1', name: '2026/27', start: 100 };
      storageRepository.loadByPrefix.mockResolvedValue([
        'Monday',
        { name: 'Cup', type: 'tournament', seasons: [], createdAt: 3 },
        { name: 'Friday', type: 'league', seasons: [season], createdAt: 4 },
      ]);

      await store.loadLeagues();

      expect(store.leagueList()).toEqual([
        { name: 'Friday', type: 'league', seasons: [season], createdAt: 4 },
        { name: 'Cup', type: 'tournament', seasons: [], createdAt: 3 },
        { name: 'Monday', type: 'league', seasons: [], createdAt: 0 },
      ]);
      expect(store.getLeague('Cup')?.type).toBe('tournament');
    });

    it('rethrows storage failures', async () => {
      storageRepository.loadByPrefix.mockRejectedValue(new Error('storage down'));

      await expect(store.loadLeagues()).rejects.toThrow('storage down');
    });
  });

  describe('addLeague', () => {
    it('persists the league under its key and appends it', async () => {
      await store.addLeague('Monday');

      expect(storageRepository.set).toHaveBeenCalledWith('league_Monday', expect.objectContaining({ name: 'Monday', type: 'league', seasons: [] }));
      expect(store.leagues()).toEqual(['Monday']);
    });

    it('keeps an existing league of that name as it is', async () => {
      const season = { id: 's1', name: '2026/27', start: 100 };
      await store.addLeague({ name: 'Monday', type: 'league', seasons: [season], createdAt: 1 });
      storageRepository.set.mockClear();

      const league = await store.addLeague('Monday');

      expect(storageRepository.set).not.toHaveBeenCalled();
      expect(league.seasons).toEqual([season]);
    });

    it('rethrows storage failures', async () => {
      storageRepository.set.mockRejectedValue(new Error('quota'));

      await expect(store.addLeague('Monday')).rejects.toThrow('quota');
    });
  });

  describe('saveLeague', () => {
    it('stores a renamed league under its new key, in the same place in the list', async () => {
      await store.addLeague('Monday');
      await store.addLeague('Friday');
      await store.addLeague('Sunday');

      await store.saveLeague({ name: 'Tuesday', type: 'league', seasons: [], createdAt: 0 }, 'Friday');

      expect(storageRepository.remove).toHaveBeenCalledWith('league_Friday');
      expect(storageRepository.set).toHaveBeenLastCalledWith('league_Tuesday', expect.objectContaining({ name: 'Tuesday' }));
      expect(store.leagues()).toEqual(['Monday', 'Tuesday', 'Sunday']);
    });

    it('updates a league in place when the name stays', async () => {
      await store.addLeague('Monday');

      await store.saveLeague({ name: 'Monday', type: 'tournament', seasons: [], createdAt: 0 });

      expect(storageRepository.remove).not.toHaveBeenCalled();
      expect(store.getLeague('Monday')?.type).toBe('tournament');
    });
  });

  describe('deleteLeague', () => {
    it('removes the league from storage and memory and tracks it', async () => {
      await store.addLeague('Monday');
      await store.addLeague('Friday');

      await store.deleteLeague('Monday');

      expect(storageRepository.remove).toHaveBeenCalledWith('league_Monday');
      expect(store.leagues()).toEqual(['Friday']);
      expect(analyticsService.trackLeagueDeleted).toHaveBeenCalled();
    });

    it('rethrows storage failures', async () => {
      storageRepository.remove.mockRejectedValue(new Error('storage down'));

      await expect(store.deleteLeague('Monday')).rejects.toThrow('storage down');
    });
  });

  describe('clearLeagues', () => {
    it('empties the list in memory', async () => {
      await store.addLeague('Monday');

      store.clearLeagues();

      expect(store.leagues()).toEqual([]);
    });
  });
});
