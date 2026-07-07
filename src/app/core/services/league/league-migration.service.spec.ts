import { Game } from 'src/app/core/models/game.model';
import { League, createLeague, createSeason } from 'src/app/core/models/league';
import { LeagueMigrationService } from './league-migration.service';
import { SeasonService } from './season.service';

function game(partial: Partial<Game>): Game {
  return {
    gameId: 'g',
    date: 0,
    frames: [],
    totalScore: 180,
    frameScores: [],
    isClean: false,
    isPerfect: false,
    isPractice: false,
    isPinMode: false,
    patterns: [],
    ...partial,
  };
}

class FakeLeagueRepo {
  store = new Map<string, League>();
  legacy: string[] = [];
  async loadAll(): Promise<League[]> {
    return [...this.store.values()];
  }
  async save(league: League): Promise<void> {
    this.store.set(league.id, league);
  }
  async saveMany(leagues: League[]): Promise<void> {
    leagues.forEach((l) => this.store.set(l.id, l));
  }
  async remove(id: string): Promise<void> {
    this.store.delete(id);
  }
  async loadLegacyLeagueNames(): Promise<string[]> {
    return this.legacy;
  }
}

class FakeGamesStore {
  _games: Game[] = [];
  games(): Game[] {
    return this._games;
  }
  async saveGamesToLocalStorage(updated: Game[]): Promise<void> {
    const map = new Map(this._games.map((g) => [g.gameId, g]));
    updated.forEach((g) => map.set(g.gameId, g));
    this._games = [...map.values()];
  }
}

class FakeStorage {
  map = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | null> {
    return (this.map.has(key) ? (this.map.get(key) as T) : null) ?? null;
  }
  async set<T>(key: string, value: T): Promise<void> {
    this.map.set(key, value);
  }
}

const ONE_DAY = 86_400_000;

describe('LeagueMigrationService', () => {
  let repo: FakeLeagueRepo;
  let gamesStore: FakeGamesStore;
  let storage: FakeStorage;
  let service: LeagueMigrationService;

  beforeEach(() => {
    repo = new FakeLeagueRepo();
    gamesStore = new FakeGamesStore();
    storage = new FakeStorage();
    service = new LeagueMigrationService(repo as never, gamesStore as never, new SeasonService(), storage as never);
  });

  it('creates an aggregate per legacy league and stamps its games', async () => {
    gamesStore._games = [game({ gameId: 'a', date: 1 * ONE_DAY, league: 'Monday' }), game({ gameId: 'b', date: 8 * ONE_DAY, league: 'Monday' })];
    repo.legacy = ['Monday'];

    const result = await service.migrate();

    expect(result.leaguesCreated).toBe(1);
    expect(result.gamesStamped).toBe(2);
    expect(repo.store.size).toBe(1);

    const league = [...repo.store.values()][0];
    expect(league.name).toBe('Monday');
    expect(league.seasons.length).toBe(1);
    expect(league.seasons[0].sessions.length).toBe(2); // two distinct nights
    expect(gamesStore._games.every((g) => g.leagueId === league.id)).toBeTrue();
  });

  it('is idempotent — a second migration creates nothing and re-stamps nothing', async () => {
    gamesStore._games = [game({ gameId: 'a', date: 1 * ONE_DAY, league: 'Monday' })];
    repo.legacy = ['Monday'];

    await service.migrate();
    const second = await service.migrate();

    expect(second.leaguesCreated).toBe(0);
    expect(second.gamesStamped).toBe(0);
    expect(repo.store.size).toBe(1);
  });

  it('run() honours the version marker and only runs once', async () => {
    gamesStore._games = [game({ gameId: 'a', date: 1 * ONE_DAY, league: 'Monday' })];
    repo.legacy = ['Monday'];

    const first = await service.run();
    expect(first.ran).toBeTrue();

    const second = await service.run();
    expect(second.ran).toBeFalse();
    expect(second.leaguesCreated).toBe(0);
  });

  it('also migrates leagues referenced only by games (no legacy key)', async () => {
    gamesStore._games = [game({ gameId: 'a', date: 1 * ONE_DAY, league: 'Orphan League' })];
    repo.legacy = [];

    const result = await service.migrate();

    expect(result.leaguesCreated).toBe(1);
    expect([...repo.store.values()][0].name).toBe('Orphan League');
  });

  it('folds games into the existing Season 1 of a league created before its games (no new league)', async () => {
    const existing = createLeague('Monday');
    existing.seasons = [createSeason('s1', 1, 'Season 1', { active: true })];
    repo.store.set(existing.id, existing);

    gamesStore._games = [game({ gameId: 'a', date: 1 * ONE_DAY, league: 'Monday' }), game({ gameId: 'b', date: 8 * ONE_DAY, league: 'Monday' })];
    repo.legacy = [];

    const result = await service.migrate();

    expect(result.leaguesCreated).toBe(0); // aggregate already existed
    expect(result.gamesStamped).toBe(2);

    const saved = repo.store.get(existing.id)!;
    expect(saved.seasons[0].sessions.length).toBe(2); // both nights folded into Season 1
    expect(gamesStore._games.every((g) => g.seasonId === 's1')).toBeTrue();
  });
});
