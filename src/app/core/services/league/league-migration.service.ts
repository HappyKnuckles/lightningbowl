import { Injectable } from '@angular/core';
import { Game } from 'src/app/core/models/game.model';
import { League, createLeague } from 'src/app/core/models/league';
import { GamesStore } from 'src/app/core/stores/games.store';
import { META_KEYS } from 'src/app/core/services/storage/storage-keys';
import { StorageRepository } from 'src/app/core/services/storage/storage.repository';
import { LeagueRepository } from './league.repository';
import { SeasonService } from './season.service';

/** Bump when the migration logic must re-run against already-migrated installs. */
export const LEAGUE_MIGRATION_VERSION = 1;

export interface MigrationResult {
  ran: boolean;
  leaguesCreated: number;
  gamesStamped: number;
}

/**
 * One-time, idempotent migration from legacy string-leagues to rich League aggregates.
 *
 * Idempotency is guaranteed two ways:
 *  1. A persisted version marker — once at the current version, `run()` is a no-op.
 *  2. Even if the marker were lost, leagues are only created for names that don't already
 *     have an aggregate, and games are only stamped when their ids are missing/changed.
 *
 * Legacy `league_<name>` keys are intentionally left in place (no deletion = no data loss).
 * Stats are never recomputed/stored, so nothing can be lost in translation.
 */
@Injectable({ providedIn: 'root' })
export class LeagueMigrationService {
  constructor(
    private leagueRepository: LeagueRepository,
    private gamesStore: GamesStore,
    private seasonService: SeasonService,
    private storage: StorageRepository,
  ) {}

  async run(): Promise<MigrationResult> {
    const version = (await this.storage.get<number>(META_KEYS.leagueMigrationVersion)) ?? 0;
    if (version >= LEAGUE_MIGRATION_VERSION) {
      return { ran: false, leaguesCreated: 0, gamesStamped: 0 };
    }

    const result = await this.migrate();

    await this.storage.set(META_KEYS.leagueMigrationVersion, LEAGUE_MIGRATION_VERSION);
    return result;
  }

  /** The migration body, factored out so it can be unit-tested directly. */
  async migrate(): Promise<MigrationResult> {
    const games = this.gamesStore.games();
    const existing = await this.leagueRepository.loadAll();
    const byName = new Map(existing.map((l) => [l.name.toLowerCase(), l]));

    // Collect every league name in play: legacy keys + names referenced by games.
    const legacyNames = await this.leagueRepository.loadLegacyLeagueNames();
    const gameLeagueNames = games.map((g) => g.league).filter((n): n is string => !!n && n !== 'New');
    const allNames = [...new Set([...legacyNames, ...gameLeagueNames])];

    const created: League[] = [];
    // gameId -> relational ids to stamp.
    const stamp = new Map<string, { leagueId: string; seasonId: string; sessionId: string }>();

    for (const name of allNames) {
      if (byName.has(name.toLowerCase())) {
        continue; // already migrated
      }
      const leagueGames = games.filter((g) => g.league === name);
      const league = createLeague(name, { legacyName: name });

      if (leagueGames.length) {
        const season = this.seasonService.createSeasonFromGames(1, `${name} — Imported Season`, leagueGames, league.numberOfGamesPerNight);
        league.seasons = [season];
        league.startDate = season.startDate;
        league.endDate = season.endDate;
        for (const session of season.sessions) {
          for (const gameId of session.gameIds) {
            stamp.set(gameId, { leagueId: league.id, seasonId: season.id, sessionId: session.id });
          }
        }
      }

      created.push(league);
      byName.set(name.toLowerCase(), league);
    }

    if (created.length) {
      await this.leagueRepository.saveMany(created);
    }

    const gamesStamped = await this.stampGames(games, stamp);

    return { ran: true, leaguesCreated: created.length, gamesStamped };
  }

  private async stampGames(games: Game[], stamp: Map<string, { leagueId: string; seasonId: string; sessionId: string }>): Promise<number> {
    const updated: Game[] = [];
    for (const game of games) {
      const ids = stamp.get(game.gameId);
      if (ids && (game.leagueId !== ids.leagueId || game.seasonId !== ids.seasonId || game.sessionId !== ids.sessionId)) {
        updated.push({ ...game, ...ids });
      }
    }
    if (updated.length) {
      await this.gamesStore.saveGamesToLocalStorage(updated);
    }
    return updated.length;
  }
}
