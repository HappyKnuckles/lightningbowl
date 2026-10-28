import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Game } from 'src/app/core/models/game.model';
import { League } from 'src/app/core/models/league.model';
import { GameFilterService } from 'src/app/core/services/game-filter/game-filter.service';
import { Router } from '@angular/router';
import { PIN_STAT_DEFINITIONS } from 'src/app/core/configs/stat-definitions/stat-definitions';
import { GameStatsService } from 'src/app/core/services/game-stats/game-stats.service';
import { AppFacade } from 'src/app/core/stores/app.facade';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { GamesStore } from 'src/app/core/stores/games.store';
import { LeaguesStore } from 'src/app/core/stores/leagues.store';
import { LeaguePage } from './league.page';
import { makeGame } from 'src/testing/fixtures';
import { vi } from 'vitest';

// `games` must be a real signal: the page derives per-league stats with `computed`,
// which only recomputes when a signal it read actually changes.
const gamesSignal = signal<Game[]>([]);

const mockGamesStore = {
  games: gamesSignal,
  loadGameHistory: vi.fn().mockReturnValue(Promise.resolve([])),
};

const mockBallsStore = {
  allBalls: vi.fn().mockReturnValue([]),
};

const leagueList = signal<League[]>([]);
const mockLeaguesStore = {
  leagueList,
  leagues: computed(() => leagueList().map((league) => league.name)),
  getLeague: (name?: string) => leagueList().find((league) => league.name === name),
  addLeague: vi.fn().mockReturnValue(Promise.resolve()),
  deleteLeague: vi.fn().mockReturnValue(Promise.resolve()),
};

const mockAppFacade = {
  editLeague: vi.fn().mockReturnValue(Promise.resolve()),
};

const day = (iso: string) => new Date(`${iso}T20:00:00`).getTime();
const thursday: League = {
  name: 'Thursday',
  type: 'league',
  createdAt: 0,
  seasons: [
    { id: 'old', name: '2025/26', start: new Date('2025-09-04T00:00:00').getTime() },
    { id: 'new', name: '2026/27', start: new Date('2026-09-03T00:00:00').getTime() },
  ],
};

describe('LeaguePage', () => {
  let component: LeaguePage;
  let fixture: ComponentFixture<LeaguePage>;

  beforeEach(async () => {
    gamesSignal.set([]);
    leagueList.set([]);
    await TestBed.configureTestingModule({
      imports: [LeaguePage],
      providers: [
        { provide: GamesStore, useValue: mockGamesStore },
        { provide: BallsStore, useValue: mockBallsStore },
        { provide: LeaguesStore, useValue: mockLeaguesStore },
        { provide: AppFacade, useValue: mockAppFacade },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(LeaguePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should expose pin stat definitions used by stats page', () => {
    expect(component.PIN_STAT_DEFINITIONS).toBe(PIN_STAT_DEFINITIONS);
  });

  it('lists leagues with games first, then saved leagues that have none yet', () => {
    leagueList.set([thursday, { name: 'Cup', type: 'tournament', seasons: [], createdAt: 0 }]);
    gamesSignal.set([makeGame({ gameId: 'a', league: 'Thursday' }), makeGame({ gameId: 'b' })]);

    expect(component.leagueKeys()).toEqual(['Thursday', 'Practice', 'Cup']);
    expect(component.leagueSummaries()['Cup'].isTournament).toBe(true);
  });

  it('summarises the running season of a league in the list', () => {
    leagueList.set([thursday]);
    gamesSignal.set([
      makeGame({ gameId: 'a', league: 'Thursday', date: day('2025-10-02'), totalScore: 150 }),
      makeGame({ gameId: 'b', league: 'Thursday', date: day('2026-09-03'), totalScore: 200 }),
      makeGame({ gameId: 'c', league: 'Thursday', date: day('2026-09-10'), totalScore: 210 }),
    ]);

    expect(component.leagueSummaries()['Thursday'].season).toEqual({ name: '2026/27', games: 2, average: 205 });
  });

  it('calculates pattern and leave stats for the opened league only', () => {
    const games = [makeGame({ gameId: 'a', league: 'League A' }), makeGame({ gameId: 'b', league: 'League B' })];
    gamesSignal.set(games);
    const allLeaves = [{ pins: [7, 10], occurrences: 3, pickups: 1, pickupPercentage: 33.3 }];
    const statService = TestBed.inject(GameStatsService);
    const mostPlayed = vi.spyOn(statService, 'calculateMostPlayedPatternStats');
    vi.spyOn(statService, 'calculateAllLeaves').mockReturnValue(allLeaves);
    vi.spyOn(statService, 'calculateMostCommonLeaves').mockReturnValue(allLeaves);
    vi.spyOn(statService, 'calculateBestSpares').mockReturnValue([]);
    vi.spyOn(statService, 'calculateWorstSpares').mockReturnValue([]);

    component.openLeague('League A');
    component.detailHighlights();

    expect(mostPlayed).toHaveBeenCalledWith([games[0]]);
    expect(component.detailLeaves()).toEqual({ all: allLeaves, common: allLeaves, best: [], worst: [] });
  });

  describe('seasons', () => {
    const games = () => [
      makeGame({ gameId: 'old', league: 'Thursday', date: day('2025-10-02') }),
      makeGame({ gameId: 'new', league: 'Thursday', date: day('2026-09-10') }),
    ];

    it('opens a league on its running season and compares it with the season before', () => {
      leagueList.set([thursday]);
      gamesSignal.set(games());

      component.openLeague('Thursday');

      expect(component.selectedSeason()).toBe('new');
      expect(component.seasonOptions().map((option) => option.range.season.id)).toEqual(['new', 'old']);
      expect(component.detailGames().map((game) => game.gameId)).toEqual(['new']);
      expect(component.detailTitle()).toBe('Season 2026/27 vs 2025/26');
      expect(component.compareStats().totalGames).toBe(1);
    });

    it('shows all games compared with all games when "All" is picked', () => {
      leagueList.set([thursday]);
      gamesSignal.set(games());
      component.openLeague('Thursday');

      component.selectSeason('all');

      expect(component.detailGames()).toHaveLength(2);
      expect(component.detailTitle()).toBe('Overall Stats');
      expect(component.compareStats().totalGames).toBe(2);
    });

    it('opens on all games while the running season has none yet', () => {
      leagueList.set([thursday]);
      gamesSignal.set([games()[0]]);

      component.openLeague('Thursday');

      expect(component.selectedSeason()).toBe('all');
    });

    it('shows the opened season on the stats tab', async () => {
      leagueList.set([thursday]);
      gamesSignal.set(games());
      const filter = TestBed.inject(GameFilterService);
      const filterToLeague = vi.spyOn(filter, 'filterToLeague').mockImplementation(() => undefined);
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      component.openLeague('Thursday');

      await component.showInStats();

      expect(filterToLeague).toHaveBeenCalledWith('Thursday', thursday.seasons[1].start, undefined);
      expect(navigate).toHaveBeenCalledWith(['/tabs/stats']);
      expect(component.selectedLeague()).toBeNull();
    });
  });
});
