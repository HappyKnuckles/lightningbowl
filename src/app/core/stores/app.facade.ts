import { Injectable } from '@angular/core';
import { AnalyticsService } from 'src/app/core/services/analytics/analytics.service';
import { BallFilterService } from 'src/app/core/services/ball-filter/ball-filter.service';
import { BallService } from 'src/app/core/services/ball/ball.service';
import { LeagueMigrationService } from 'src/app/core/services/league/league-migration.service';
import { StorageRepository } from 'src/app/core/services/storage/storage.repository';
import { BallsStore } from './balls.store';
import { GamesStore } from './games.store';
import { LeaguesStore } from './leagues.store';
import { PatternsStore } from './patterns.store';
import { SettingsStore } from './settings.store';

@Injectable({ providedIn: 'root' })
export class AppFacade {
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
    private ballFilterService: BallFilterService,
    private leagueMigrationService: LeagueMigrationService,
  ) {}

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

      const weight = parseInt(this.ballFilterService.filters().weight, 10);
      await this.loadInitialData(weight);
    } catch (error) {
      console.error('Error during AppFacade init:', error);
    }
  }

  async loadInitialData(weight: number): Promise<void> {
    try {
      this.settingsStore.loadPinInputMode();
      await Promise.all([
        this.patternsStore.loadAllPatterns(),
        this.patternsStore.loadPatternImageMap(),
        this.ballsStore.loadAllBalls(undefined, weight),
        this.gamesStore.loadGameHistory(),
        this.ballsStore.loadArsenal(),
        this.ballService.getBrands(),
        this.ballService.getCores(),
        this.ballService.getCoverstocks(),
      ]);

      // Games are loaded above; migrate legacy string-leagues into rich aggregates
      // (one-time, idempotent) before loading the League store from those aggregates.
      try {
        await this.leagueMigrationService.run();
      } catch (migrationError) {
        console.error('League migration failed (continuing with existing data):', migrationError);
      }
      await this.leaguesStore.loadLeagues();
    } catch (error) {
      console.error('Error during initial data load:', error);
      throw error;
    }
  }

  async editLeague(newLeague: string, oldLeague: string): Promise<void> {
    try {
      // Rename the aggregate in place (preserves its seasons, fees, handicap, etc.)
      // instead of delete+recreate, then keep each game's display name in sync.
      await this.leaguesStore.renameLeague(oldLeague, newLeague);
      const games = this.gamesStore.games();
      const updatedGames = games.filter((game) => game.league === oldLeague).map((game) => ({ ...game, league: newLeague }));
      this.analyticsService.trackLeagueEdited();
      if (updatedGames.length) {
        await this.gamesStore.saveGamesToLocalStorage(updatedGames);
      }
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
