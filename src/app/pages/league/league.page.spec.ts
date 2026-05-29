import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LeaguePage } from './league.page';
import { GamesStore } from 'src/app/core/stores/games.store';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { LeaguesStore } from 'src/app/core/stores/leagues.store';
import { AppFacade } from 'src/app/core/stores/app.facade';
import { pinStatDefinitions } from 'src/app/core/constants/stats.definitions.constants';

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
    expect(component.pinStatDefinitions).toBe(pinStatDefinitions);
  });

  it('should calculate pattern stats per league', () => {
    mockGamesStore.games.and.returnValue([{ league: 'League A' } as any]);

    const mostPlayedPattern = {
      patternName: 'Pattern Most Played',
      patternImage: '',
      patternAvg: 200,
      patternHighestGame: 250,
      patternLowestGame: 180,
      gameCount: 5,
    };
    const bestPattern = {
      patternName: 'Pattern Best',
      patternImage: '',
      patternAvg: 215,
      patternHighestGame: 270,
      patternLowestGame: 190,
      gameCount: 3,
    };

    const statService = (component as any).statService;
    spyOn(statService, 'calculateMostPlayedPatternStats').and.returnValue(mostPlayedPattern);
    spyOn(statService, 'calculateBestPatternStats').and.returnValue(bestPattern);
    spyOn(statService, 'calculateAllPatternStats').and.returnValue([mostPlayedPattern, bestPattern]);

    expect(component.mostPlayedPatternsByLeague()['League A']).toEqual(mostPlayedPattern);
    expect(component.bestPatternsByLeague()['League A']).toEqual(bestPattern);
    expect(component.allPatternsByLeague()['League A']).toEqual([mostPlayedPattern, bestPattern]);
  });
});
