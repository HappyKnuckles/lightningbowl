import { computed, effect, Injectable, signal, untracked } from '@angular/core';
import { Ball } from 'src/app/core/models/ball.model';
import { isInArsenal } from 'src/app/core/utils/ball-utils/arsenal-ball.utils';
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
  readonly #arsenalIds = computed(() =>
    (this.ballsStore.arsenal() ?? [])
      .map((ball) => ball.arsenalId)
      .sort()
      .join(),
  );
  /** Set once games, arsenal and ball cache are loaded and the games' balls are migrated. */
  readonly #ballDataLoaded = signal(false);
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
    // Games name their balls. When the arsenal gets a ball, the games that must mean it are linked to it
    // (e.g. a ball added after its games were imported, or added back after it was removed).
    effect(() => {
      this.#arsenalIds();
      if (!this.#ballDataLoaded()) return;
      untracked(() => void this.gamesStore.migrateBallWeights(this.ballsStore.arsenal(), this.ballsStore.knownBalls()));
    });
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
      console.error('Error during AppFacade init:', error);
    }
  }

  async loadInitialData(): Promise<void> {
    try {
      this.settingsStore.loadPinInputMode();
      this.settingsStore.loadBallTracking();
      this.settingsStore.loadHandedness();
      const ballData = Promise.all([this.ballsStore.loadBallCache(), this.gamesStore.loadGameHistory(), this.ballsStore.loadArsenal()])
        .then(() => this.gamesStore.migrateBallWeights(this.ballsStore.arsenal(), this.ballsStore.knownBalls()))
        .then(() => this.#ballDataLoaded.set(true));
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
      // Then migrate again, so games take the catalog spelling of balls resolved just now.
      void this.ballsStore
        .resolveBallNames(this.gamesStore.games().flatMap((game) => game.balls ?? []))
        .then(() => this.gamesStore.migrateBallWeights(this.ballsStore.arsenal(), this.ballsStore.knownBalls()));
      // Arsenal and favorite balls saved before the ball API get its data (images on its own host) once.
      void this.ballsStore.refreshSavedBalls(true).catch((error) => console.error('Error refreshing saved balls:', error));
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
      await this.gamesStore.saveGamesToLocalStorage(updatedGames, { recordLayouts: false });
      this.gamesStore.updateGamesInMemory(() => updatedGames);
    } catch (error) {
      console.error('Error editing league:', error);
      throw error;
    }
  }

  /**
   * Removes a ball from the arsenal (see `BallsStore.removeFromArsenal`). Games that used it stay as they
   * are when the arsenal still has that ball in that weight: they point at the one that left, not at the
   * one that stayed. When it was the only one, the games simply name the ball again, so they find it
   * should it come back.
   */
  async removeArsenalBall(ball: Ball): Promise<void> {
    const removed = await this.ballsStore.removeFromArsenal(ball);
    if (removed?.arsenalId && !isInArsenal(removed, this.ballsStore.arsenal())) {
      await this.gamesStore.unlinkArsenalBall(removed.arsenalId);
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
