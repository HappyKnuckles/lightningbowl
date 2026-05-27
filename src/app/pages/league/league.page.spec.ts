import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppFacade } from '@stores/app.facade';
import { BallsStore } from '@stores/balls.store';
import { GamesStore } from '@stores/games.store';
import { LeaguesStore } from '@stores/leagues.store';
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
});
