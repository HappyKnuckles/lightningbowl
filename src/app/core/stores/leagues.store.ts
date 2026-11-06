import { computed, Injectable, signal } from '@angular/core';

import { Game } from 'src/app/core/models/game.model';
import { League } from 'src/app/core/models/league.model';
import { AnalyticsService } from 'src/app/core/services/analytics/analytics.service';
import { STORAGE_PREFIX, StorageKeys } from 'src/app/core/services/storage/storage-keys';
import { StorageRepository } from 'src/app/core/services/storage/storage.repository';
import { createLeague, isCurrentLeagueShape, leaguesToMigrate, normalizeLeague } from 'src/app/core/utils/league-utils/league.utils';

@Injectable({ providedIn: 'root' })
export class LeaguesStore {
  readonly #leagueList = signal<League[]>([]);
  /** Names of all leagues, which is how games refer to them. */
  readonly leagues = computed(() => this.#leagueList().map((league) => league.name));
  readonly leaguesByName = computed(() => new Map(this.#leagueList().map((league) => [league.name, league])));
  /** Leagues and tournaments with their type and seasons, most recently added first. */
  readonly leagueList = this.#leagueList.asReadonly();
  /** Leagues loaded from an older shape (plain names), rewritten by `migrateLeagues`. */
  readonly #legacyNames = new Set<string>();
  /** Leagues carried over from before leagues had a type, seasons and handicap, not set up since. */
  readonly leaguesNeedingReview = computed(() => this.#leagueList().filter((league) => league.needsReview));

  constructor(
    private storageRepository: StorageRepository,
    private analyticsService: AnalyticsService,
  ) {}

  getLeague(name: string | undefined): League | undefined {
    return name ? this.leaguesByName().get(name) : undefined;
  }

  async loadLeagues(): Promise<string[]> {
    try {
      // leagues saved as plain names (before type and seasons) are read as leagues without seasons
      const stored = await this.storageRepository.loadByPrefix<unknown>(STORAGE_PREFIX.league);
      const leagues: League[] = [];
      this.#legacyNames.clear();
      for (const value of stored) {
        const league = normalizeLeague(value);
        if (!league) continue;
        leagues.push(league);
        if (!isCurrentLeagueShape(value)) this.#legacyNames.add(league.name);
      }
      this.#leagueList.set([...leagues].reverse());
      return this.leagues();
    } catch (error) {
      console.error('Error loading leagues:', error);
      throw error;
    }
  }

  /**
   * Brings stored leagues up to the current design: leagues saved as plain names are rewritten as
   * leagues (without seasons, so all their games stay together until a season is added), leagues that
   * only games refer to are created, and leagues without a creation date get their first game's.
   * Rewritten and created leagues are marked `needsReview`, so the user is told to set them up.
   * Failures are logged, not thrown: the leagues already work in memory and the next start retries.
   */
  async migrateLeagues(games: Game[]): Promise<void> {
    try {
      const updates = new Map(leaguesToMigrate(this.#leagueList(), games).map((league) => [league.name, league]));
      for (const name of this.#legacyNames) {
        const league = this.getLeague(name);
        if (league) updates.set(name, { ...(updates.get(name) ?? league), needsReview: true });
      }
      if (updates.size === 0) return;
      await Promise.all([...updates.values()].map((league) => this.storageRepository.set(StorageKeys.league(league.name), league)));
      this.#legacyNames.clear();
      this.#leagueList.update((leagues) => {
        const updated = leagues.map((league) => updates.get(league.name) ?? league);
        const known = new Set(leagues.map((league) => league.name));
        return [...updated, ...[...updates.values()].filter((league) => !known.has(league.name))];
      });
    } catch (error) {
      console.error('Error migrating leagues:', error);
    }
  }

  /** Keeps the leagues waiting to be set up as they are: they stop asking for it. */
  async markLeaguesReviewed(): Promise<void> {
    const reviewed = this.leaguesNeedingReview().map((league) => {
      const copy = { ...league };
      delete copy.needsReview;
      return copy;
    });
    if (reviewed.length === 0) return;
    try {
      await Promise.all(reviewed.map((league) => this.storageRepository.set(StorageKeys.league(league.name), league)));
      const byName = new Map(reviewed.map((league) => [league.name, league]));
      this.#leagueList.update((leagues) => leagues.map((league) => byName.get(league.name) ?? league));
    } catch (error) {
      console.error('Error saving leagues:', error);
      throw error;
    }
  }

  /** Adds a league, or returns the existing one of that name unchanged (imports add every league they find). */
  async addLeague(league: string | League): Promise<League> {
    try {
      const toAdd = typeof league === 'string' ? createLeague(league) : league;
      const existing = this.getLeague(toAdd.name);
      if (existing) return existing;
      await this.storageRepository.set(StorageKeys.league(toAdd.name), toAdd);
      this.#leagueList.update((leagues) => [...leagues, toAdd]);
      return toAdd;
    } catch (error) {
      console.error('Error adding league:', error);
      throw error;
    }
  }

  /**
   * Saves changes to a league. With `previousName`, the league was renamed: it's stored under the
   * new name and keeps its place in the list. Games are moved over by the AppFacade.
   */
  async saveLeague(league: League, previousName = league.name): Promise<void> {
    try {
      if (previousName !== league.name) {
        await this.storageRepository.remove(StorageKeys.league(previousName));
      }
      await this.storageRepository.set(StorageKeys.league(league.name), league);
      this.#leagueList.update((leagues) => {
        const index = leagues.findIndex((candidate) => candidate.name === previousName);
        const others = leagues.filter((candidate) => candidate.name !== previousName && candidate.name !== league.name);
        if (index === -1) return [...others, league];
        others.splice(Math.min(index, others.length), 0, league);
        return others;
      });
    } catch (error) {
      console.error('Error saving league:', error);
      throw error;
    }
  }

  async deleteLeague(league: string): Promise<void> {
    try {
      await this.storageRepository.remove(StorageKeys.league(league));
      this.analyticsService.trackLeagueDeleted();
      this.#leagueList.update((leagues) => leagues.filter((candidate) => candidate.name !== league));
    } catch (error) {
      console.error('Error deleting league:', error);
      throw error;
    }
  }

  clearLeagues(): void {
    this.#leagueList.set([]);
  }
}
