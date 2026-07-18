import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PIN_STAT_DEFINITIONS } from 'src/app/core/configs/stat-definitions/stat-definitions';
import { GameStatsService } from 'src/app/core/services/game-stats/game-stats.service';
import { AppFacade } from 'src/app/core/stores/app.facade';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { GamesStore } from 'src/app/core/stores/games.store';
import { LeaguesStore } from 'src/app/core/stores/leagues.store';
import { LeaguePage } from './league.page';

const mockGamesStore = {
  games: jasmine.createSpy('games').and.returnValue([]),
  loadGameHistory: jasmine.createSpy('loadGameHistory').and.returnValue(Promise.resolve([])),
};

const mockBallsStore = {
  allBalls: jasmine.createSpy('allBalls').and.returnValue([]),
};

const mockLeaguesStore = {
  leagues: jasmine.createSpy('leagues').and.returnValue([]),
  addLeague: jasmine.createSpy('addLeague').and.returnValue(Promise.resolve()),
  deleteLeague: jasmine.createSpy('deleteLeague').and.returnValue(Promise.resolve()),
};

const mockAppFacade = {
  editLeague: jasmine.createSpy('editLeague').and.returnValue(Promise.resolve()),
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
    mockGamesStore.games.and.returnValue([{ league: 'League A' } as any]);

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
    spyOn(statService, 'calculateMostPlayedPatternStats').and.returnValue(mostPlayedPattern);
    spyOn(statService, 'calculateBestPatternStats').and.returnValue(bestPattern);
    spyOn(statService, 'calculateAllPatternStats').and.returnValue([mostPlayedPattern, bestPattern]);

    expect(component.mostPlayedPatternsByLeague()['League A']).toEqual(mostPlayedPattern);
    expect(component.bestPatternsByLeague()['League A']).toEqual(bestPattern);
    expect(component.allPatternsByLeague()['League A']).toEqual([mostPlayedPattern, bestPattern]);
  });

  it('should calculate pin leave stats per league', () => {
    mockGamesStore.games.and.returnValue([{ league: 'League A' } as any]);

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
    spyOn(statService, 'calculateAllLeaves').and.returnValue(allLeaves);
    spyOn(statService, 'calculateMostCommonLeaves').and.returnValue(commonLeaves);
    spyOn(statService, 'calculateBestSpares').and.returnValue(bestLeaves);
    spyOn(statService, 'calculateWorstSpares').and.returnValue(worstLeaves);

    expect(component.leaveStatsByLeague()['League A']).toEqual({
      all: allLeaves,
      common: commonLeaves,
      best: bestLeaves,
      worst: worstLeaves,
    });
  });
});
