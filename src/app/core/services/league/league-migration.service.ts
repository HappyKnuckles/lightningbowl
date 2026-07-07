import { Injectable } from '@angular/core';
import { Game } from 'src/app/core/models/game.model';
import { League, createLeague } from 'src/app/core/models/league';
import { GamesStore } from 'src/app/core/stores/games.store';
import { META_KEYS } from 'src/app/core/services/storage/storage-keys';
import { StorageRepository } from 'src/app/core/services/storage/storage.repository';
import { LeagueRepository } from './league.repository';
import { SeasonService } from './season.service';

/** Bump when the migration logic must re-run against already-migrated installs. */
export const LEAGUE_MIGRATION_VERSION = 2;

export interface MigrationResult {
  ran: boolean;
  leaguesCreated: number;
  gamesStamped: number;
}

interface SeasonStamp {
  leagueId: string;
  seasonId: string;
  sessionId: string;
}

/**
 * One-time, idempotent migration from legacy string-leagues to rich League aggregates.
 *
 * Every game that pre-dates the migration is folded into its league's Season 1 ("Imported
 * Season") as a weekly session and stamped with `leagueId`/`seasonId`/`sessionId`. This
 * holds even when the aggregate already exists (e.g. a league created through the form, or
 * an earlier migration that ran before those games were added) — such leagues are
 * reconciled rather than skipped.
 *
 * Idempotency is guaranteed two ways:
 *  1. A persisted version marker — once at the current version, `run()` is a no-op.
 *  2. Even without the marker, leagues are only created when missing and a game is only
 *     (re)stamped/folded when it isn't already assigned to one of its league's seasons.
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
    const byName = new Map(existing.map((l) => [l.name.toLowerCase(), this.clone(l)]));

    // Collect every league name in play: legacy keys + names referenced by games.
    const legacyNames = await this.leagueRepository.loadLegacyLeagueNames();
    const gameLeagueNames = games.map((g) => g.league).filter((n): n is string => !!n && n !== 'New');
    const allNames = [...new Set([...legacyNames, ...gameLeagueNames])];

    const toSave: League[] = [];
    const stamp = new Map<string, SeasonStamp>();
    let leaguesCreated = 0;

    for (const name of allNames) {
      const key = name.toLowerCase();
      let league = byName.get(key);
      let dirty = false;

      if (!league) {
        league = createLeague(name, { legacyName: name });
        byName.set(key, league);
        leaguesCreated += 1;
        dirty = true;
      }

      const leagueGames = games.filter((g) => g.league === name);
      if (this.reconcileSeasons(league, leagueGames, stamp)) {
        dirty = true;
      }

      if (dirty) {
        toSave.push(league);
      }
    }

    if (toSave.length) {
      await this.leagueRepository.saveMany(toSave);
    }

    const gamesStamped = await this.stampGames(games, stamp);

    return { ran: true, leaguesCreated, gamesStamped };
  }

  /**
   * Ensures all of a league's games belong to a season. Leagues with no season yet get an
   * "Imported Season" built from every game; otherwise each game not already assigned to a
   * season is folded into the season whose date window contains it (Season 1 for legacy
   * data). Mutates `league` and fills `stamp`. Returns whether anything changed.
   */
  private reconcileSeasons(league: League, leagueGames: Game[], stamp: Map<string, SeasonStamp>): boolean {
    if (!leagueGames.length) {
      return false;
    }

    if (!league.seasons.length) {
      const season = this.seasonService.createSeasonFromGames(1, `${league.name} — Imported Season`, leagueGames, league.numberOfGamesPerNight);
      league.seasons = [season];
      league.startDate = league.startDate ?? season.startDate;
      league.endDate = season.endDate;
      for (const session of season.sessions) {
        for (const gameId of session.gameIds) {
          stamp.set(gameId, { leagueId: league.id, seasonId: season.id, sessionId: session.id });
        }
      }
      return true;
    }

    const seasonIds = new Set(league.seasons.map((s) => s.id));
    let changed = false;
    for (const game of leagueGames) {
      if (game.seasonId && seasonIds.has(game.seasonId)) {
        continue; // already assigned to one of this league's seasons
      }
      const season = this.seasonService.seasonForDate(league, game.date) ?? league.seasons[0];
      const sessionId = this.seasonService.foldGameIntoSeason(season, game, league.numberOfGamesPerNight);
      stamp.set(game.gameId, { leagueId: league.id, seasonId: season.id, sessionId });
      changed = true;
    }
    return changed;
  }

  private async stampGames(games: Game[], stamp: Map<string, SeasonStamp>): Promise<number> {
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

  private clone<T>(value: T): T {
    return typeof structuredClone === 'function' ? structuredClone(value) : (JSON.parse(JSON.stringify(value)) as T);
  }
}
