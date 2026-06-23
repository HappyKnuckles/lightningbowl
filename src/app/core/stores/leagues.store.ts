import { computed, Injectable, signal } from '@angular/core';
import { League, createLeague } from 'src/app/core/models/league';
import { AnalyticsService } from 'src/app/core/services/analytics/analytics.service';
import { LeagueRepository } from 'src/app/core/services/league/league.repository';
import { StorageKeys } from 'src/app/core/services/storage/storage-keys';
import { StorageRepository } from 'src/app/core/services/storage/storage.repository';

/**
 * Holds the rich League aggregates. For backward compatibility it still exposes a flat
 * list of league *names* (`leagueNames`) and a string-based `addLeague`, so the existing
 * selector / Excel / facade code keeps working while the rest of the app moves to objects.
 */
@Injectable({ providedIn: 'root' })
export class LeaguesStore {
  readonly leagues = signal<League[]>([]);

  /** Backward-compatible flat list of league names (newest first). */
  readonly leagueNames = computed<string[]>(() => this.leagues().map((l) => l.name));

  constructor(
    private leagueRepository: LeagueRepository,
    private storageRepository: StorageRepository,
    private analyticsService: AnalyticsService,
  ) {}

  async loadLeagues(): Promise<League[]> {
    try {
      const leagues = await this.leagueRepository.loadAll();
      leagues.sort((a, b) => b.createdAt - a.createdAt);
      this.leagues.set(leagues);
      return leagues;
    } catch (error) {
      console.error('Error loading leagues:', error);
      throw error;
    }
  }

  getByName(name: string): League | undefined {
    const lower = name.toLowerCase();
    return this.leagues().find((l) => l.name.toLowerCase() === lower);
  }

  getById(id: string): League | undefined {
    return this.leagues().find((l) => l.id === id);
  }

  /**
   * Backward-compatible add by name. Creates a full aggregate with defaults if the league
   * does not already exist; otherwise a no-op (keeps callers idempotent).
   */
  async addLeague(name: string): Promise<League> {
    const trimmed = name.trim();
    const existing = this.getByName(trimmed);
    if (existing) {
      return existing;
    }
    return this.createLeague(createLeague(trimmed));
  }

  /** Creates (persists) a fully-formed League aggregate. */
  async createLeague(league: League): Promise<League> {
    try {
      await this.leagueRepository.save(league);
      this.leagues.update((leagues) => [league, ...leagues]);
      return league;
    } catch (error) {
      console.error('Error creating league:', error);
      throw error;
    }
  }

  /** Persists changes to an existing aggregate. */
  async updateLeague(league: League): Promise<void> {
    try {
      await this.leagueRepository.save(league);
      this.leagues.update((leagues) => leagues.map((l) => (l.id === league.id ? league : l)));
    } catch (error) {
      console.error('Error updating league:', error);
      throw error;
    }
  }

  /** Renames a league aggregate (the caller keeps `game.league` in sync). */
  async renameLeague(oldName: string, newName: string): Promise<void> {
    const league = this.getByName(oldName);
    if (!league) {
      // Nothing migrated yet — create the renamed aggregate so it exists going forward.
      await this.addLeague(newName);
      return;
    }
    await this.updateLeague({ ...league, name: newName.trim() });
  }

  /** Deletes by league id or (legacy) name. Also clears any stale legacy string key. */
  async deleteLeague(idOrName: string): Promise<void> {
    try {
      const league = this.getById(idOrName) ?? this.getByName(idOrName);
      if (league) {
        await this.leagueRepository.remove(league.id);
        this.leagues.update((leagues) => leagues.filter((l) => l.id !== league.id));
      }
      // Remove the legacy `league_<name>` entry if it lingers so it can't resurrect.
      await this.storageRepository.remove(StorageKeys.league(league?.name ?? idOrName));
      this.analyticsService.trackLeagueDeleted();
    } catch (error) {
      console.error('Error deleting league:', error);
      throw error;
    }
  }

  clearLeagues(): void {
    this.leagues.set([]);
  }
}
