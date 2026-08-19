import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Game } from 'src/app/core/models/game.model';
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

const mockLeaguesStore = {
  leagues: vi.fn().mockReturnValue([]),
  addLeague: vi.fn().mockReturnValue(Promise.resolve()),
  deleteLeague: vi.fn().mockReturnValue(Promise.resolve()),
};

const mockAppFacade = {
  editLeague: vi.fn().mockReturnValue(Promise.resolve()),
};

describe('LeaguePage', () => {
  let component: LeaguePage;
  let fixture: ComponentFixture<LeaguePage>;

  beforeEach(async () => {
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

  it('should calculate pattern stats per league', () => {
    gamesSignal.set([makeGame({ league: 'League A' })]);

    const mostPlayedPattern = {
      name: 'Pattern Most Played',
      image: '',
      avg: 200,
      highestGame: 250,
      lowestGame: 180,
      gameCount: 5,
    };
    const bestPattern = {
      name: 'Pattern Best',
      image: '',
      avg: 215,
      highestGame: 270,
      lowestGame: 190,
      gameCount: 3,
    };

    const statService = TestBed.inject(GameStatsService);
    vi.spyOn(statService, 'calculateMostPlayedPatternStats').mockReturnValue(mostPlayedPattern);
    vi.spyOn(statService, 'calculateBestPatternStats').mockReturnValue(bestPattern);
    vi.spyOn(statService, 'calculateAllPatternStats').mockReturnValue([mostPlayedPattern, bestPattern]);

    expect(component.mostPlayedPatternsByLeague()['League A']).toEqual(mostPlayedPattern);
    expect(component.bestPatternsByLeague()['League A']).toEqual(bestPattern);
    expect(component.allPatternsByLeague()['League A']).toEqual([mostPlayedPattern, bestPattern]);
  });

  it('should calculate pin leave stats per league', () => {
    gamesSignal.set([makeGame({ league: 'League A' })]);

    const allLeaves = [
      {
        pins: [7, 10],
        occurrences: 3,
        pickups: 1,
        pickupPercentage: 33.3,
      },
    ];
    const commonLeaves = [
      {
        pins: [7, 10],
        occurrences: 3,
        pickups: 1,
        pickupPercentage: 33.3,
      },
    ];
    const bestLeaves = [
      {
        pins: [2, 4],
        occurrences: 2,
        pickups: 2,
        pickupPercentage: 100,
      },
    ];
    const worstLeaves = [
      {
        pins: [4, 6, 7, 10],
        occurrences: 2,
        pickups: 0,
        pickupPercentage: 0,
      },
    ];

    const statService = TestBed.inject(GameStatsService);
    vi.spyOn(statService, 'calculateAllLeaves').mockReturnValue(allLeaves);
    vi.spyOn(statService, 'calculateMostCommonLeaves').mockReturnValue(commonLeaves);
    vi.spyOn(statService, 'calculateBestSpares').mockReturnValue(bestLeaves);
    vi.spyOn(statService, 'calculateWorstSpares').mockReturnValue(worstLeaves);

    expect(component.leaveStatsByLeague()['League A']).toEqual({
      all: allLeaves,
      common: commonLeaves,
      best: bestLeaves,
      worst: worstLeaves,
    });
  });
});
