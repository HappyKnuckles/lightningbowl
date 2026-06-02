import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { BallsStore } from 'src/app/core/stores/balls.store';
import { GamesStore } from 'src/app/core/stores/games.store';
import { LeaguesStore } from 'src/app/core/stores/leagues.store';
import { PatternsStore } from 'src/app/core/stores/patterns.store';
import { SettingsStore } from 'src/app/core/stores/settings.store';
import { GameListComponent } from './game-list.component';

const mockGamesStore = {
  games: jasmine.createSpy('games').and.returnValue([]),
  deleteGame: jasmine.createSpy('deleteGame').and.returnValue(Promise.resolve()),
  saveGameToLocalStorage: jasmine.createSpy('saveGameToLocalStorage').and.returnValue(Promise.resolve()),
  saveGamesToLocalStorage: jasmine.createSpy('saveGamesToLocalStorage').and.returnValue(Promise.resolve()),
  updateGamesInMemory: jasmine.createSpy('updateGamesInMemory'),
};

const mockBallsStore = {
  allBalls: jasmine.createSpy('allBalls').and.returnValue([]),
  arsenal: jasmine.createSpy('arsenal').and.returnValue([]),
};

const mockSettingsStore = {
  pinInputMode: jasmine.createSpy('pinInputMode').and.returnValue(true),
};

const mockPatternsStore = {
  allPatterns: jasmine.createSpy('allPatterns').and.returnValue([]),
};

const mockLeaguesStore = {
  leagues: jasmine.createSpy('leagues').and.returnValue([]),
};

describe('GameListComponent', () => {
  let component: GameListComponent;
  let fixture: ComponentFixture<GameListComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [GameListComponent],
      providers: [
        { provide: GamesStore, useValue: mockGamesStore },
        { provide: BallsStore, useValue: mockBallsStore },
        { provide: SettingsStore, useValue: mockSettingsStore },
        { provide: PatternsStore, useValue: mockPatternsStore },
        { provide: LeaguesStore, useValue: mockLeaguesStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GameListComponent);
    component = fixture.componentInstance;
    component.games = [];
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
