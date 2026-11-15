import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Ball } from 'src/app/core/models/ball.model';
import { vi } from 'vitest';
import { AnalyticsService } from 'src/app/core/services/analytics/analytics.service';
import { BallService } from 'src/app/core/services/ball/ball.service';
import { StorageRepository } from 'src/app/core/services/storage/storage.repository';
import { makeBall, makeGame } from 'src/testing/fixtures';
import { createSpyObj, SpyObj } from 'src/testing/spy-obj';
import { AppFacade } from './app.facade';
import { BallsStore } from './balls.store';
import { GamesStore } from './games.store';
import { LeaguesStore } from './leagues.store';
import { PatternsStore } from './patterns.store';
import { SettingsStore } from './settings.store';

describe('AppFacade', () => {
  let facade: AppFacade;
  let storageRepository: SpyObj<StorageRepository>;
  let gamesStore: SpyObj<GamesStore>;
  let ballsStore: SpyObj<BallsStore>;
  let patternsStore: SpyObj<PatternsStore>;
  let leaguesStore: SpyObj<LeaguesStore>;
  let settingsStore: SpyObj<SettingsStore>;
  let ballService: SpyObj<BallService>;
  let analyticsService: SpyObj<AnalyticsService>;

  function build(): void {
    TestBed.configureTestingModule({
      providers: [
        { provide: StorageRepository, useValue: storageRepository },
        { provide: GamesStore, useValue: gamesStore },
        { provide: BallsStore, useValue: ballsStore },
        { provide: PatternsStore, useValue: patternsStore },
        { provide: LeaguesStore, useValue: leaguesStore },
        { provide: SettingsStore, useValue: settingsStore },
        { provide: BallService, useValue: ballService },
        { provide: AnalyticsService, useValue: analyticsService },
      ],
    });
    facade = TestBed.inject(AppFacade);
  }

  beforeEach(() => {
    storageRepository = createSpyObj<StorageRepository>(['create', 'clear']);
    storageRepository.create.mockResolvedValue(undefined);
    storageRepository.clear.mockResolvedValue(undefined);

    gamesStore = createSpyObj<GamesStore>([
      'loadGameHistory',
      'games',
      'saveGamesToLocalStorage',
      'updateGamesInMemory',
      'clearGames',
      'migrateBallWeights',
      'unlinkArsenalBall',
    ]);
    gamesStore.loadGameHistory.mockResolvedValue([]);
    gamesStore.migrateBallWeights.mockResolvedValue(undefined);
    gamesStore.games.mockReturnValue([]);
    gamesStore.saveGamesToLocalStorage.mockResolvedValue(undefined);

    ballsStore = createSpyObj<BallsStore>([
      'loadBallCache',
      'resolveBallNames',
      'refreshSavedBalls',
      'loadArsenal',
      'clearArsenal',
      'removeFromArsenal',
      'arsenal',
      'knownBalls',
    ]);
    ballsStore.arsenal.mockReturnValue([]);
    ballsStore.knownBalls.mockReturnValue([]);
    ballsStore.loadBallCache.mockResolvedValue(undefined);
    ballsStore.resolveBallNames.mockResolvedValue(undefined);
    ballsStore.refreshSavedBalls.mockResolvedValue(undefined);
    ballsStore.loadArsenal.mockResolvedValue(undefined);

    patternsStore = createSpyObj<PatternsStore>(['loadAllPatterns', 'loadPatternImageMap']);
    patternsStore.loadAllPatterns.mockResolvedValue(undefined);
    patternsStore.loadPatternImageMap.mockResolvedValue(undefined);

    leaguesStore = createSpyObj<LeaguesStore>(['loadLeagues', 'addLeague', 'deleteLeague', 'clearLeagues']);
    leaguesStore.loadLeagues.mockResolvedValue([]);
    leaguesStore.addLeague.mockResolvedValue(undefined);
    leaguesStore.deleteLeague.mockResolvedValue(undefined);

    settingsStore = createSpyObj<SettingsStore>(['loadPinInputMode', 'loadBallTracking', 'loadHandedness', 'loadFit', 'loadLayoutPresets']);

    ballService = createSpyObj<BallService>(['getBrands', 'getCores', 'getCoverstocks']);
    ballService.getBrands.mockResolvedValue([]);
    ballService.getCores.mockResolvedValue([]);
    ballService.getCoverstocks.mockResolvedValue([]);

    analyticsService = createSpyObj<AnalyticsService>(['trackLeagueEdited']);

    vi.spyOn(navigator.storage, 'persisted').mockResolvedValue(true);
    vi.spyOn(navigator.storage, 'persist').mockResolvedValue(true);

    build();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('init', () => {
    it('creates storage and loads every store', async () => {
      await facade.init();

      expect(storageRepository.create).toHaveBeenCalled();
      expect(settingsStore.loadPinInputMode).toHaveBeenCalled();
      expect(settingsStore.loadBallTracking).toHaveBeenCalled();
      expect(settingsStore.loadHandedness).toHaveBeenCalled();
      expect(settingsStore.loadFit).toHaveBeenCalled();
      expect(settingsStore.loadLayoutPresets).toHaveBeenCalled();
      expect(ballsStore.loadBallCache).toHaveBeenCalled();
      expect(ballsStore.resolveBallNames).toHaveBeenCalledWith([]);
      expect(gamesStore.loadGameHistory).toHaveBeenCalled();
      expect(leaguesStore.loadLeagues).toHaveBeenCalled();
      expect(patternsStore.loadAllPatterns).toHaveBeenCalled();
      expect(ballsStore.loadArsenal).toHaveBeenCalled();
    });

    it('requests persistent storage only when it is not granted yet', async () => {
      vi.mocked(navigator.storage.persisted).mockResolvedValue(false);

      await facade.init();

      expect(navigator.storage.persist).toHaveBeenCalled();
    });

    it('skips the request when storage is already persisted', async () => {
      await facade.init();

      expect(navigator.storage.persist).not.toHaveBeenCalled();
    });

    it('runs only once no matter how often it is called', async () => {
      await Promise.all([facade.init(), facade.init()]);
      await facade.init();

      expect(storageRepository.create).toHaveBeenCalledTimes(1);
    });

    it('swallows load failures so the app can still start', async () => {
      gamesStore.loadGameHistory.mockRejectedValue(new Error('storage down'));

      await expect(facade.init()).resolves.toBeUndefined();
      expect(gamesStore.migrateBallWeights).not.toHaveBeenCalled();
    });

    it("migrates the games' balls against the loaded arsenal and known balls", async () => {
      const arsenal = [makeBall({ ball_name: 'Phaze', core_weight: '14' })];
      const known = [...arsenal, makeBall({ ball_name: 'Zen', core_weight: '15' })];
      ballsStore.arsenal.mockReturnValue(arsenal);
      ballsStore.knownBalls.mockReturnValue(known);

      await facade.init();

      expect(gamesStore.migrateBallWeights).toHaveBeenCalledWith(arsenal, known);
    });
  });

  describe('loadInitialData', () => {
    it('rethrows when a store fails to load', async () => {
      patternsStore.loadAllPatterns.mockRejectedValue(new Error('api down'));

      await expect(facade.loadInitialData()).rejects.toThrow('api down');
    });
  });

  describe('editLeague', () => {
    it('replaces the league and moves its games over', async () => {
      gamesStore.games.mockReturnValue([
        makeGame({ gameId: 'g1', league: 'Monday' }),
        makeGame({ gameId: 'g2', league: 'Friday' }),
        makeGame({ gameId: 'g3' }),
      ]);

      await facade.editLeague('Tuesday', 'Monday');

      expect(leaguesStore.deleteLeague).toHaveBeenCalledWith('Monday');
      expect(leaguesStore.addLeague).toHaveBeenCalledWith('Tuesday');
      const savedGames = gamesStore.saveGamesToLocalStorage.mock.calls[0][0];
      expect(savedGames.map((g) => g.league)).toEqual(['Tuesday', 'Friday', undefined]);
      expect(gamesStore.updateGamesInMemory).toHaveBeenCalled();
      expect(analyticsService.trackLeagueEdited).toHaveBeenCalled();
    });

    it('rethrows and leaves the games untouched when the rename fails', async () => {
      leaguesStore.addLeague.mockRejectedValue(new Error('quota'));

      await expect(facade.editLeague('Tuesday', 'Monday')).rejects.toThrow('quota');
      expect(gamesStore.saveGamesToLocalStorage).not.toHaveBeenCalled();
    });
  });

  describe('removeArsenalBall', () => {
    const phaze = makeBall({ ball_id: 'p', core_weight: '15', arsenalId: 'one' });

    it("takes the link off the games when the arsenal's only ball of that kind leaves", async () => {
      ballsStore.removeFromArsenal.mockResolvedValue(phaze);
      ballsStore.arsenal.mockReturnValue([makeBall({ ball_id: 'p', core_weight: '14', arsenalId: 'lighter' })]);

      await facade.removeArsenalBall(phaze);

      expect(ballsStore.removeFromArsenal).toHaveBeenCalledWith(phaze);
      expect(gamesStore.unlinkArsenalBall).toHaveBeenCalledWith('one');
    });

    it('leaves the games pointing at the ball that left when the same ball is still there', async () => {
      ballsStore.removeFromArsenal.mockResolvedValue(phaze);
      ballsStore.arsenal.mockReturnValue([{ ...phaze, arsenalId: 'two' }]);

      await facade.removeArsenalBall(phaze);

      expect(gamesStore.unlinkArsenalBall).not.toHaveBeenCalled();
    });

    it('does nothing more when no ball was removed', async () => {
      ballsStore.removeFromArsenal.mockResolvedValue(undefined);

      await facade.removeArsenalBall(phaze);

      expect(gamesStore.unlinkArsenalBall).not.toHaveBeenCalled();
    });
  });

  describe('when the arsenal gets a ball', () => {
    it("links the games that name it, once the app's data is loaded", async () => {
      const arsenal = signal<Ball[]>([]);
      TestBed.resetTestingModule();
      (ballsStore as { arsenal: unknown }).arsenal = arsenal;
      build();
      const added = makeBall({ arsenalId: 'one' });

      // before the data is loaded the games are left to the startup migration
      arsenal.set([makeBall({ arsenalId: 'early' })]);
      TestBed.tick();
      expect(gamesStore.migrateBallWeights).not.toHaveBeenCalled();

      await facade.init();
      gamesStore.migrateBallWeights.mockClear();
      arsenal.set([added]);
      TestBed.tick();

      expect(gamesStore.migrateBallWeights).toHaveBeenCalledWith([added], []);

      // a change to a ball that is already there (drilling, order) links nothing
      gamesStore.migrateBallWeights.mockClear();
      arsenal.set([{ ...added, position: 1 }]);
      TestBed.tick();
      expect(gamesStore.migrateBallWeights).not.toHaveBeenCalled();
    });
  });

  describe('deleteAllData', () => {
    it('clears storage and every store holding user data', async () => {
      await facade.deleteAllData();

      expect(storageRepository.clear).toHaveBeenCalled();
      expect(gamesStore.clearGames).toHaveBeenCalled();
      expect(ballsStore.clearArsenal).toHaveBeenCalled();
      expect(leaguesStore.clearLeagues).toHaveBeenCalled();
    });

    it('rethrows when clearing storage fails', async () => {
      storageRepository.clear.mockRejectedValue(new Error('storage down'));

      await expect(facade.deleteAllData()).rejects.toThrow('storage down');
    });
  });
});
