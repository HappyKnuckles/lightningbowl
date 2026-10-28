import { computed, Injectable, signal } from '@angular/core';

import { League } from 'src/app/core/models/league.model';
import { AnalyticsService } from 'src/app/core/services/analytics/analytics.service';
import { STORAGE_PREFIX, StorageKeys } from 'src/app/core/services/storage/storage-keys';
import { StorageRepository } from 'src/app/core/services/storage/storage.repository';
import { createLeague, normalizeLeague } from 'src/app/core/utils/league-utils/league.utils';

@Injectable({ providedIn: 'root' })
export class LeaguesStore {
  readonly #leagueList = signal<League[]>([]);
  /** Names of all leagues, which is how games refer to them. */
  readonly leagues = computed(() => this.#leagueList().map((league) => league.name));
  readonly leaguesByName = computed(() => new Map(this.#leagueList().map((league) => [league.name, league])));
  /** Leagues and tournaments with their type and seasons, most recently added first. */
  readonly leagueList = this.#leagueList.asReadonly();

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
      const leagues = stored.map(normalizeLeague).filter((league): league is League => league !== null);
      this.#leagueList.set([...leagues].reverse());
      return this.leagues();
    } catch (error) {
      console.error('Error loading leagues:', error);
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
