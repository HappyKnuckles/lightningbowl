import { Injectable, signal } from '@angular/core';
import { StorageRepository } from 'src/app/core/services/storage/storage.repository';
import { AnalyticsService } from 'src/app/core/services/analytics/analytics.service';

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
      const leagues = await this.loadData<string>('league');
      this.#leagues.set(leagues.reverse());
      return leagues.reverse();
    } catch (error) {
      console.error('Error loading leagues:', error);
      throw error;
    }
  }

  async addLeague(league: string): Promise<void> {
    try {
      const key = 'league' + '_' + league;
      await this.storageRepository.set(key, league);
      this.#leagues.update((leagues) => [...leagues, league]);
    } catch (error) {
      console.error('Error adding league:', error);
      throw error;
    }
  }

  async deleteLeague(league: string): Promise<void> {
    try {
      const key = 'league' + '_' + league;
      await this.storageRepository.remove(key);
      this.analyticsService.trackLeagueDeleted();
      this.#leagues.update((leagues) => leagues.filter((l) => l !== key.replace('league_', '')));
    } catch (error) {
      console.error('Error deleting league:', error);
      throw error;
    }
  }

  clearLeagues(): void {
    this.#leagues.set([]);
  }

  private async loadData<T>(prefix: string): Promise<T[]> {
    try {
      const data: T[] = [];
      await this.storageRepository.forEach((value, key) => {
        if (key.startsWith(prefix)) {
          data.push(value as T);
        }
      });
      return data;
    } catch (error) {
      console.error(`Error loading data for prefix "${prefix}":`, error);
      throw error;
    }
  }
}
