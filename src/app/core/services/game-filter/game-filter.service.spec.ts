import { TestBed } from '@angular/core/testing';
import { GameFilter } from 'src/app/core/models/filter.model';
import { Game } from 'src/app/core/models/game.model';
import { createEmptyGame } from 'src/app/core/utils/game-utils/frame.utils';

import { GameFilterService } from './game-filter.service';

/**
 * `filterGames(games, filters)` is the pure predicate behind every filtered view
 * (history/stats/leagues). The e2e suite checks the modal→list wiring; these
 * exercise the predicate exhaustively.
 */
describe('GameFilterService.filterGames', () => {
  let service: GameFilterService;
  let nextId = 0;

  const makeGame = (overrides: Partial<Game> = {}): Game => ({
    ...createEmptyGame(),
    gameId: `g${++nextId}`,
    date: Date.UTC(2025, 0, 15), // 2025-01-15, comfortably inside the default range
    ...overrides,
  });

  /** A baseline "match everything" filter; tests override one axis at a time. */
  const baseFilters = (): GameFilter => ({ ...service.defaultFilters });

  const ids = (games: Game[]): string[] => games.map((g) => g.gameId);

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GameFilterService);
    nextId = 0;
  });

  it('returns every game with the default (no-op) filters', () => {
    const games = [makeGame({ totalScore: 150 }), makeGame({ totalScore: 200 }), makeGame({ totalScore: 90 })];
    expect(service.filterGames(games, baseFilters()).length).toBe(3);
  });

  it('filters by score range (min/max inclusive)', () => {
    const low = makeGame({ totalScore: 80 });
    const mid = makeGame({ totalScore: 150 });
    const high = makeGame({ totalScore: 250 });

    const result = service.filterGames([low, mid, high], { ...baseFilters(), minScore: 100, maxScore: 200 });

    expect(ids(result)).toEqual([mid.gameId]);
  });

  it('treats score bounds as inclusive', () => {
    const a = makeGame({ totalScore: 100 });
    const b = makeGame({ totalScore: 200 });
    const result = service.filterGames([a, b], { ...baseFilters(), minScore: 100, maxScore: 200 });
    expect(result.length).toBe(2);
  });

  it('excludes practice games when excludePractice is set', () => {
    const practice = makeGame({ isPractice: true });
    const league = makeGame({ isPractice: false });

    const result = service.filterGames([practice, league], { ...baseFilters(), excludePractice: true });

    expect(ids(result)).toEqual([league.gameId]);
  });

  it('keeps only clean games when isClean is set', () => {
    const clean = makeGame({ isClean: true });
    const dirty = makeGame({ isClean: false });

    const result = service.filterGames([clean, dirty], { ...baseFilters(), isClean: true });

    expect(ids(result)).toEqual([clean.gameId]);
  });

  it('keeps only perfect games when isPerfect is set', () => {
    const perfect = makeGame({ isPerfect: true, totalScore: 300 });
    const notPerfect = makeGame({ isPerfect: false, totalScore: 280 });

    const result = service.filterGames([perfect, notPerfect], { ...baseFilters(), isPerfect: true });

    expect(ids(result)).toEqual([perfect.gameId]);
  });

  describe('leagues', () => {
    it('matches a specific league', () => {
      const monday = makeGame({ league: 'Monday Night League' });
      const classic = makeGame({ league: 'City Classic' });

      const result = service.filterGames([monday, classic], { ...baseFilters(), leagues: ['Monday Night League'] });

      expect(ids(result)).toEqual([monday.gameId]);
    });

    it('passes everything for ["all"]', () => {
      const games = [makeGame({ league: 'A' }), makeGame({ league: 'B' }), makeGame({ league: '' })];
      expect(service.filterGames(games, { ...baseFilters(), leagues: ['all'] }).length).toBe(3);
    });

    it('matches games with no league via the empty-string value', () => {
      const leagued = makeGame({ league: 'A' });
      const practice = makeGame({ league: '' });

      const result = service.filterGames([leagued, practice], { ...baseFilters(), leagues: [''] });

      expect(ids(result)).toEqual([practice.gameId]);
    });
  });

  describe('multi-select balls / patterns', () => {
    it('matches games containing a selected pattern', () => {
      const cheetah = makeGame({ patterns: ['PBA Cheetah 35'] });
      const scorpion = makeGame({ patterns: ['PBA Scorpion 41'] });

      const result = service.filterGames([cheetah, scorpion], { ...baseFilters(), patterns: ['PBA Cheetah 35'] });

      expect(ids(result)).toEqual([cheetah.gameId]);
    });

    it('matches games with no patterns via the empty-string ("none") value', () => {
      const withPattern = makeGame({ patterns: ['PBA Cheetah 35'] });
      const without = makeGame({ patterns: [] });

      const result = service.filterGames([withPattern, without], { ...baseFilters(), patterns: [''] });

      expect(ids(result)).toEqual([without.gameId]);
    });

    it('matches games containing a selected ball', () => {
      const phaze = makeGame({ balls: ['Phaze II'] });
      const other = makeGame({ balls: ['Zen Master'] });

      const result = service.filterGames([phaze, other], { ...baseFilters(), balls: ['Phaze II'] });

      expect(ids(result)).toEqual([phaze.gameId]);
    });
  });

  describe('date range', () => {
    it('keeps games inside [startDate, endDate] and drops the rest', () => {
      const before = makeGame({ date: Date.UTC(2025, 0, 1) });
      const inside = makeGame({ date: Date.UTC(2025, 1, 15) });
      const after = makeGame({ date: Date.UTC(2025, 5, 1) });

      const result = service.filterGames([before, inside, after], {
        ...baseFilters(),
        startDate: new Date(Date.UTC(2025, 1, 1)).toISOString(),
        endDate: new Date(Date.UTC(2025, 2, 1)).toISOString(),
      });

      expect(ids(result)).toEqual([inside.gameId]);
    });
  });

  it('applies multiple active filters together (logical AND)', () => {
    const match = makeGame({ totalScore: 180, league: 'City Classic', isPractice: false });
    const wrongScore = makeGame({ totalScore: 120, league: 'City Classic', isPractice: false });
    const wrongLeague = makeGame({ totalScore: 180, league: 'Monday Night League', isPractice: false });
    const practice = makeGame({ totalScore: 180, league: 'City Classic', isPractice: true });

    const result = service.filterGames([match, wrongScore, wrongLeague, practice], {
      ...baseFilters(),
      minScore: 150,
      maxScore: 200,
      leagues: ['City Classic'],
      excludePractice: true,
    });

    expect(ids(result)).toEqual([match.gameId]);
  });
});
