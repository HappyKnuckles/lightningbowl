import { Injectable } from '@angular/core';
import { League } from 'src/app/core/models/league.model';
import { createLeague } from 'src/app/core/utils/league-utils/league.utils';
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
      this.settingsStore.loadBallTracking();
      this.settingsStore.loadHandedness();
      await Promise.all([
        this.patternsStore.loadAllPatterns(),
        this.patternsStore.loadPatternImageMap(),
        this.ballsStore.loadAllBalls(undefined, weight),
        this.leaguesStore.loadLeagues(),
        this.gamesStore.loadGameHistory(),
        this.ballsStore.loadArsenal(),
        this.settingsStore.loadFit(),
        this.settingsStore.loadLayoutPresets(),
        this.ballService.getBrands(),
        this.ballService.getCores(),
        this.ballService.getCoverstocks(),
      ]);
    } catch (error) {
      console.error('Error during initial data load:', error);
      throw error;
    }
  }

  /** Renames a league, keeping its type and seasons, and moves its games over. */
  async editLeague(newLeague: string, oldLeague: string): Promise<void> {
    const existing = this.leaguesStore.getLeague(oldLeague) ?? createLeague(oldLeague);
    await this.updateLeague({ ...existing, name: newLeague }, oldLeague);
  }

  /** Saves a league (type, seasons, name). When it was renamed, its games move to the new name. */
  async updateLeague(league: League, previousName: string): Promise<void> {
    try {
      await this.leaguesStore.saveLeague(league, previousName);
      if (league.name !== previousName) {
        const updatedGames = this.gamesStore.games().map((game) => (game.league === previousName ? { ...game, league: league.name } : game));
        await this.gamesStore.saveGamesToLocalStorage(updatedGames.filter((game) => game.league === league.name));
        // saving moves the saved games to the top; keep the order they had
        this.gamesStore.updateGamesInMemory(() => updatedGames);
      }
      this.analyticsService.trackLeagueEdited();
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
