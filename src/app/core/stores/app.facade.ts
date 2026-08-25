import { Injectable } from '@angular/core';

import { AnalyticsService } from 'src/app/core/services/analytics/analytics.service';
import { BallFilterService } from 'src/app/core/services/ball-filter/ball-filter.service';
import { BallService } from 'src/app/core/services/ball/ball.service';
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
  ) {}

  async init(): Promise<void> {
    if (this.#initPromise) {
      return this.#initPromise;
    }

    this.#initPromise = this.runInit();
    return this.#initPromise;
  }

  async loadInitialData(weight: number): Promise<void> {
    try {
      this.settingsStore.loadPinInputMode();
      await Promise.all([
        this.patternsStore.loadAllPatterns(),
        this.patternsStore.loadPatternImageMap(),
        this.ballsStore.loadAllBalls(undefined, weight),
        this.leaguesStore.loadLeagues(),
        this.gamesStore.loadGameHistory(),
        this.ballsStore.loadArsenal(),
        this.ballService.getBrands(),
        this.ballService.getCores(),
        this.ballService.getCoverstocks(),
      ]);
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
}
