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

    it('rethrows storage failures', async () => {
      storageRepository.loadByPrefix.mockRejectedValue(new Error('storage down'));

      await expect(store.loadLeagues()).rejects.toThrow('storage down');
    });
  });

  describe('addLeague', () => {
    it('persists the league under its key and appends it', async () => {
      await store.addLeague('Monday');

      expect(storageRepository.set).toHaveBeenCalledWith('league_Monday', 'Monday');
      expect(store.leagues()).toEqual(['Monday']);
    });

    it('rethrows storage failures', async () => {
      storageRepository.set.mockRejectedValue(new Error('quota'));

      await expect(store.addLeague('Monday')).rejects.toThrow('quota');
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
