import { Injectable } from '@angular/core';
import { AnalyticsService } from 'src/app/core/services/analytics/analytics.service';
import { BallFilterService } from 'src/app/core/services/ball-filter/ball-filter.service';
import { BallService } from 'src/app/core/services/ball/ball.service';
import { BOWLER_KEYS } from 'src/app/core/services/storage/storage-keys';
import { StorageRepository } from 'src/app/core/services/storage/storage.repository';
import { getGameBowlerId } from '../utils/bowler-utils/bowler.utils';
import { sortGameHistoryByDate } from '../utils/sort-utils/sort.utils';
import { BallsStore } from './balls.store';
import { BowlersStore } from './bowlers.store';
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
    private bowlersStore: BowlersStore,
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
      await Promise.all([
        this.patternsStore.loadAllPatterns(),
        this.patternsStore.loadPatternImageMap(),
        this.ballsStore.loadAllBalls(undefined, weight),
        this.leaguesStore.loadLeagues(),
        this.gamesStore.loadGameHistory(),
        this.ballsStore.loadArsenal(),
        this.bowlersStore.loadBowlers(),
        this.ballService.getBrands(),
        this.ballService.getCores(),
        this.ballService.getCoverstocks(),
      ]);
      await this.runBowlerMigration();
    } catch (error) {
      console.error('Error during initial data load:', error);
      throw error;
    }
  }

  /**
   * One-way, versioned, idempotent: ensures a default bowler exists (seeded from
   * the stored username) and stamps its id onto games/arsenal records that predate
   * multi-bowler support. Safe to re-run after a mid-migration interruption; only
   * adds fields, never renames keys or deletes data.
   */
  async runBowlerMigration(): Promise<void> {
    const migrationDone = await this.storageRepository.get<boolean>(BOWLER_KEYS.migrationV1);

    // Invariant: at least one bowler always exists (also restores it after deleteAllData).
    let defaultId = this.bowlersStore.defaultBowlerId();
    if (this.bowlersStore.bowlers().length === 0) {
      const name = localStorage.getItem('username') || 'Me';
      const bowler = await this.bowlersStore.addBowler(name);
      defaultId = bowler.bowlerId;
      await this.bowlersStore.setDefaultBowlerId(defaultId);
    } else if (!defaultId) {
      defaultId = this.bowlersStore.bowlers()[0].bowlerId;
      await this.bowlersStore.setDefaultBowlerId(defaultId);
    }

    if (migrationDone) {
      return;
    }

    const unstampedGames = this.gamesStore.games().filter((game) => !game.bowlerId);
    if (unstampedGames.length > 0) {
      await this.gamesStore.saveGamesToLocalStorage(unstampedGames.map((game) => ({ ...game, bowlerId: defaultId })));
      // saveGamesToLocalStorage moves updated games to the top; restore date order.
      this.gamesStore.updateGamesInMemory((games) => sortGameHistoryByDate([...games], false));
    }

    const untaggedBalls = this.ballsStore.arsenal().filter((ball) => !ball.bowlerIds?.length);
    if (untaggedBalls.length > 0) {
      await this.ballsStore.updateArsenalBalls(untaggedBalls.map((ball) => ({ ...ball, bowlerIds: [defaultId] })));
    }

    await this.storageRepository.set(BOWLER_KEYS.migrationV1, true);
  }

  /**
   * Deletes a bowler and either reassigns their games/arsenal to another bowler
   * or cascades the delete. The last remaining bowler cannot be deleted.
   */
  async deleteBowler(bowlerId: string, reassignToBowlerId?: string): Promise<void> {
    try {
      if (this.bowlersStore.bowlers().length <= 1) {
        throw new Error('Cannot delete the last bowler');
      }

      const defaultId = this.bowlersStore.defaultBowlerId();
      const ownedGames = this.gamesStore.games().filter((game) => getGameBowlerId(game, defaultId) === bowlerId);
      if (ownedGames.length > 0) {
        if (reassignToBowlerId) {
          await this.gamesStore.saveGamesToLocalStorage(ownedGames.map((game) => ({ ...game, bowlerId: reassignToBowlerId })));
          this.gamesStore.updateGamesInMemory((games) => sortGameHistoryByDate([...games], false));
        } else {
          await this.gamesStore.deleteGames(ownedGames.map((game) => game.gameId));
        }
      }

      const ownedBalls = this.ballsStore.arsenal().filter((ball) => (ball.bowlerIds ?? [defaultId]).includes(bowlerId));
      for (const ball of ownedBalls) {
        const remainingOwners = (ball.bowlerIds ?? [defaultId]).filter((id) => id !== bowlerId);
        if (reassignToBowlerId && !remainingOwners.includes(reassignToBowlerId)) {
          remainingOwners.push(reassignToBowlerId);
        }
        if (remainingOwners.length > 0) {
          await this.ballsStore.updateArsenalBalls([{ ...ball, bowlerIds: remainingOwners }]);
        } else {
          await this.ballsStore.removeFromArsenal(ball, bowlerId);
        }
      }

      await this.bowlersStore.deleteBowler(bowlerId);
    } catch (error) {
      console.error('Error deleting bowler:', error);
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
      this.bowlersStore.clearBowlers();
      // Restore the "at least one bowler" invariant right away.
      await this.runBowlerMigration();
    } catch (error) {
      console.error('Error deleting all data:', error);
      throw error;
    }
  }
}
