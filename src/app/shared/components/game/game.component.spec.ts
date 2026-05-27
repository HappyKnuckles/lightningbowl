import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { BallsStore } from '@stores/balls.store';
import { GamesStore } from '@stores/games.store';
import { LeaguesStore } from '@stores/leagues.store';
import { PatternsStore } from '@stores/patterns.store';
import { SettingsStore } from '@stores/settings.store';
import { GameComponent } from './game.component';

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

describe('GameComponent', () => {
  let component: GameComponent;
  let fixture: ComponentFixture<GameComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [GameComponent],
      providers: [
        { provide: GamesStore, useValue: mockGamesStore },
        { provide: BallsStore, useValue: mockBallsStore },
        { provide: SettingsStore, useValue: mockSettingsStore },
        { provide: PatternsStore, useValue: mockPatternsStore },
        { provide: LeaguesStore, useValue: mockLeaguesStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GameComponent);
    component = fixture.componentInstance;
    component.games = [];
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
