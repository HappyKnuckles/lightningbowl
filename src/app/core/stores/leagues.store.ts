import { Injectable, signal } from '@angular/core';
import { AnalyticsService } from '@services/analytics/analytics.service';
import { STORAGE_PREFIX, StorageKeys } from '@services/storage/storage-keys';
import { StorageRepository } from '@services/storage/storage.repository';

@Injectable({ providedIn: 'root' })
export class LeaguesStore {
  #leagues = signal<string[]>([]);

  get leagues() {
    return this.#leagues;
  }

  constructor(
    private storageRepository: StorageRepository,
    private analyticsService: AnalyticsService,
  ) {}

  async loadLeagues(): Promise<string[]> {
    try {
      const leagues = await this.storageRepository.loadByPrefix<string>(STORAGE_PREFIX.league);
      const reversedLeagues = [...leagues].reverse();
      this.#leagues.set(reversedLeagues);
      return reversedLeagues;
    } catch (error) {
      console.error('Error loading leagues:', error);
      throw error;
    }
  }

  async addLeague(league: string): Promise<void> {
    try {
      const key = StorageKeys.league(league);
      await this.storageRepository.set(key, league);
      this.#leagues.update((leagues) => [...leagues, league]);
    } catch (error) {
      console.error('Error adding league:', error);
      throw error;
    }
  }

  async deleteLeague(league: string): Promise<void> {
    try {
      const key = StorageKeys.league(league);
      await this.storageRepository.remove(key);
      this.analyticsService.trackLeagueDeleted();
      this.#leagues.update((leagues) => leagues.filter((l) => l !== league));
    } catch (error) {
      console.error('Error deleting league:', error);
      throw error;
    }
  }

  clearLeagues(): void {
    this.#leagues.set([]);
  }
}
