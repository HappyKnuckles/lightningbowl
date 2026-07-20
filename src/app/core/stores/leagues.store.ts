import { computed, Injectable, signal } from '@angular/core';
import { LeagueRecord } from 'src/app/core/models/league.model';
import { AnalyticsService } from 'src/app/core/services/analytics/analytics.service';
import { STORAGE_PREFIX, StorageKeys } from 'src/app/core/services/storage/storage-keys';
import { StorageRepository } from 'src/app/core/services/storage/storage.repository';
import { BowlersStore } from './bowlers.store';

@Injectable({ providedIn: 'root' })
export class LeaguesStore {
  readonly #leagueRecords = signal<LeagueRecord[]>([]);
  readonly leagueRecords = this.#leagueRecords.asReadonly();

  // League names of the active bowler — the list every selector shows.
  readonly leagues = computed(() => {
    const activeId = this.bowlersStore.activeBowlerId();
    const defaultId = this.bowlersStore.defaultBowlerId();
    return this.#leagueRecords()
      .filter((record) => (record.bowlerIds.length ? record.bowlerIds : [defaultId]).includes(activeId))
      .map((record) => record.name);
  });

  readonly allLeagues = computed(() => this.#leagueRecords().map((record) => record.name));

  constructor(
    private storageRepository: StorageRepository,
    private analyticsService: AnalyticsService,
    private bowlersStore: BowlersStore,
  ) {}

  async loadLeagues(): Promise<LeagueRecord[]> {
    try {
      const raw = await this.storageRepository.loadByPrefix<string | LeagueRecord>(STORAGE_PREFIX.league);
      // Legacy records are plain strings; normalize without rewriting storage (the migration does that).
      const records = raw.map((value): LeagueRecord => (typeof value === 'string' ? { name: value, bowlerIds: [] } : value));
      records.reverse();
      this.#leagueRecords.set(records);
      return records;
    } catch (error) {
      console.error('Error loading leagues:', error);
      throw error;
    }
  }

  async addLeague(league: string, bowlerId = this.bowlersStore.activeBowlerId()): Promise<void> {
    try {
      const existing = this.#leagueRecords().find((record) => record.name === league);
      const owners = new Set(existing?.bowlerIds ?? []);
      if (bowlerId) {
        owners.add(bowlerId);
      }
      const record: LeagueRecord = { name: league, bowlerIds: [...owners] };
      await this.storageRepository.set(StorageKeys.league(league), record);
      this.#leagueRecords.update((records) => (existing ? records.map((r) => (r.name === league ? record : r)) : [...records, record]));
    } catch (error) {
      console.error('Error adding league:', error);
      throw error;
    }
  }

  async deleteLeague(league: string, bowlerId = this.bowlersStore.activeBowlerId()): Promise<void> {
    try {
      const existing = this.#leagueRecords().find((record) => record.name === league);
      if (!existing) {
        return;
      }
      const defaultId = this.bowlersStore.defaultBowlerId();
      const remainingOwners = (existing.bowlerIds.length ? existing.bowlerIds : [defaultId]).filter((id) => id !== bowlerId);

      if (remainingOwners.length > 0) {
        const record: LeagueRecord = { ...existing, bowlerIds: remainingOwners };
        await this.storageRepository.set(StorageKeys.league(league), record);
        this.#leagueRecords.update((records) => records.map((r) => (r.name === league ? record : r)));
      } else {
        await this.storageRepository.remove(StorageKeys.league(league));
        this.#leagueRecords.update((records) => records.filter((r) => r.name !== league));
      }
      this.analyticsService.trackLeagueDeleted();
    } catch (error) {
      console.error('Error deleting league:', error);
      throw error;
    }
  }

  /** Renames a league record while keeping its bowler memberships. */
  async renameLeague(oldName: string, newName: string): Promise<void> {
    try {
      const existing = this.#leagueRecords().find((record) => record.name === oldName);
      const record: LeagueRecord = { name: newName, bowlerIds: existing?.bowlerIds ?? [this.bowlersStore.activeBowlerId()] };
      await this.storageRepository.remove(StorageKeys.league(oldName));
      await this.storageRepository.set(StorageKeys.league(newName), record);
      this.#leagueRecords.update((records) => {
        const withoutOld = records.filter((r) => r.name !== oldName && r.name !== newName);
        return [...withoutOld, record];
      });
    } catch (error) {
      console.error('Error renaming league:', error);
      throw error;
    }
  }

  /** Stamps legacy league records without owners with the default bowler (migration). */
  async stampUntaggedLeagues(bowlerId: string): Promise<void> {
    const untagged = this.#leagueRecords().filter((record) => record.bowlerIds.length === 0);
    for (const record of untagged) {
      const stamped: LeagueRecord = { ...record, bowlerIds: [bowlerId] };
      await this.storageRepository.set(StorageKeys.league(record.name), stamped);
    }
    if (untagged.length > 0) {
      this.#leagueRecords.update((records) => records.map((r) => (r.bowlerIds.length === 0 ? { ...r, bowlerIds: [bowlerId] } : r)));
    }
  }

  /** Removes a deleted bowler from all league records; drops records left without owners. */
  async removeBowlerFromLeagues(bowlerId: string, reassignToBowlerId?: string): Promise<void> {
    const affected = this.#leagueRecords().filter((record) => record.bowlerIds.includes(bowlerId));
    for (const record of affected) {
      const owners = new Set(record.bowlerIds.filter((id) => id !== bowlerId));
      if (reassignToBowlerId) {
        owners.add(reassignToBowlerId);
      }
      if (owners.size > 0) {
        await this.storageRepository.set(StorageKeys.league(record.name), { ...record, bowlerIds: [...owners] });
      } else {
        await this.storageRepository.remove(StorageKeys.league(record.name));
      }
    }
    if (affected.length > 0) {
      this.#leagueRecords.update((records) =>
        records
          .map((record) => {
            if (!record.bowlerIds.includes(bowlerId)) {
              return record;
            }
            const owners = new Set(record.bowlerIds.filter((id) => id !== bowlerId));
            if (reassignToBowlerId) {
              owners.add(reassignToBowlerId);
            }
            return { ...record, bowlerIds: [...owners] };
          })
          .filter((record) => record.bowlerIds.length > 0),
      );
    }
  }

  clearLeagues(): void {
    this.#leagueRecords.set([]);
  }
}
