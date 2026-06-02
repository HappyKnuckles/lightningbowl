import { Injectable, signal, inject } from '@angular/core';
import { StorageRepository } from 'src/app/core/services/storage/storage.repository';
import { StorageKeys, STORAGE_PREFIX } from 'src/app/core/services/storage/storage-keys';
import { AnalyticsService } from 'src/app/core/services/analytics/analytics.service';

@Injectable({ providedIn: 'root' })
export class LeaguesStore {
  private storageRepository = inject(StorageRepository);
  private analyticsService = inject(AnalyticsService);

  #leagues = signal<string[]>([]);

  get leagues() {
    return this.#leagues;
  }

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
