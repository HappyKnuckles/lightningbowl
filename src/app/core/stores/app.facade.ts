import { Injectable } from '@angular/core';
import { AnalyticsService } from 'src/app/core/services/analytics/analytics.service';
import { BallService } from 'src/app/core/services/ball/ball.service';
import { StorageRepository } from 'src/app/core/services/storage/storage.repository';
import { BallsStore } from './balls.store';
import { GamesStore } from './games.store';
import { LeaguesStore } from './leagues.store';
import { PatternsStore } from './patterns.store';
import { SettingsStore } from './settings.store';

@Injectable({ providedIn: 'root' })
export class AppFacade {
  /**
   * Resolves once games, arsenal and ball cache are loaded (or failed to), without waiting for the
   * rest of startup: patterns and catalogs from the network can take long offline.
   */
  readonly gamesLoaded: Promise<void>;
  #resolveGamesLoaded!: () => void;
  #initPromise: Promise<void> | null = null;

  constructor(
    private storageRepository: StorageRepository,
    private gamesStore: GamesStore,
    private ballsStore: BallsStore,
    private patternsStore: PatternsStore,
    private leaguesStore: LeaguesStore,
    private settingsStore: SettingsStore,
    private ballService: BallService,
    private analyticsService: AnalyticsService,
  ) {
    this.gamesLoaded = new Promise<void>((resolve) => (this.#resolveGamesLoaded = resolve));
  }

  async init(): Promise<void> {
    if (this.#initPromise) {
      return this.#initPromise;
    }

    this.#initPromise = this.runInit();
    return this.#initPromise;
  }

  private async runInit(): Promise<void> {
    try {
      await this.storageRepository.create();

      if (navigator.storage && navigator.storage.persist) {
        const isPersisted = await navigator.storage.persisted();
        if (!isPersisted) {
          const requested = await navigator.storage.persist();
          if (!requested) {
            console.warn('Persistent storage request was denied or not granted.');
          }
        }
      } else {
        console.warn('Persistent Storage API is not supported by this browser.');
      }

      await this.loadInitialData();
    } catch (error) {
      this.#resolveGamesLoaded();
      console.error('Error during AppFacade init:', error);
    }
  }

  async loadInitialData(): Promise<void> {
    try {
      this.settingsStore.loadPinInputMode();
      this.settingsStore.loadBallTracking();
      this.settingsStore.loadHandedness();
      const ballData = Promise.all([this.ballsStore.loadBallCache(), this.gamesStore.loadGameHistory(), this.ballsStore.loadArsenal()]);
      void ballData.finally(() => this.#resolveGamesLoaded()).catch(() => undefined);
      await Promise.all([
        this.patternsStore.loadAllPatterns(),
        this.patternsStore.loadPatternImageMap(),
        ballData,
        this.leaguesStore.loadLeagues(),
        this.settingsStore.loadFit(),
        this.settingsStore.loadLayoutPresets(),
        this.ballService.getBrands(),
        this.ballService.getCores(),
        this.ballService.getCoverstocks(),
      ]);
      // Make the balls named in games available offline (fetches only unknown names).
      void this.ballsStore.resolveBallNames(this.gamesStore.games().flatMap((game) => game.balls ?? []));
    } catch (error) {
      console.error('Error during initial data load:', error);
      throw error;
    }
  }

  async editLeague(newLeague: string, oldLeague: string): Promise<void> {
    try {
      await this.leaguesStore.deleteLeague(oldLeague);
      await this.leaguesStore.addLeague(newLeague);
      const games = this.gamesStore.games();
      const updatedGames = games.map((game) => {
        if (game.league === oldLeague) {
          return { ...game, league: newLeague };
        }
        return game;
      });
      this.analyticsService.trackLeagueEdited();
      await this.gamesStore.saveGamesToLocalStorage(updatedGames);
      this.gamesStore.updateGamesInMemory(() => updatedGames);
    } catch (error) {
      console.error('Error editing league:', error);
      throw error;
    }
  }

  async deleteAllData(): Promise<void> {
    try {
      await this.storageRepository.clear();
      this.gamesStore.clearGames();
      this.ballsStore.clearArsenal();
      this.leaguesStore.clearLeagues();
    } catch (error) {
      console.error('Error deleting all data:', error);
      throw error;
    }
  }
}
