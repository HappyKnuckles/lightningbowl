import { Injectable } from '@angular/core';
import { League } from 'src/app/core/models/league';
import { STORAGE_PREFIX, StorageKeys } from 'src/app/core/services/storage/storage-keys';
import { StorageRepository } from 'src/app/core/services/storage/storage.repository';

/**
 * Persistence for League aggregates. Each league is stored as a single document under the
 * `lg-entity_` prefix. Also exposes a reader for the legacy `league_<name>` string entries
 * so the migration can pick them up.
 */
@Injectable({ providedIn: 'root' })
export class LeagueRepository {
  constructor(private storage: StorageRepository) {}

  /** Loads all League aggregates. */
  async loadAll(): Promise<League[]> {
    const leagues = await this.storage.loadByPrefix<League>(`${STORAGE_PREFIX.leagueEntity}_`);
    return leagues.filter((l): l is League => !!l && typeof l === 'object' && !!l.id);
  }

  async save(league: League): Promise<void> {
    league.updatedAt = Date.now();
    await this.storage.set(StorageKeys.leagueEntity(league.id), league);
  }

  async saveMany(leagues: League[]): Promise<void> {
    await Promise.all(leagues.map((league) => this.save(league)));
  }

  async remove(leagueId: string): Promise<void> {
    await this.storage.remove(StorageKeys.leagueEntity(leagueId));
  }

  /**
   * Reads the legacy string-league names (`league_<name>` → the name). Used only by the
   * migration; these keys are intentionally left untouched afterwards.
   */
  async loadLegacyLeagueNames(): Promise<string[]> {
    const names = new Set<string>();
    await this.storage.forEach((value, key) => {
      if (key.startsWith(`${STORAGE_PREFIX.league}_`)) {
        const name = typeof value === 'string' ? value : key.slice(`${STORAGE_PREFIX.league}_`.length);
        if (name) {
          names.add(name);
        }
      }
    });
    return [...names];
  }
}
