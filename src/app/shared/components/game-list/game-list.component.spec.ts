import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { GamesStore } from 'src/app/core/stores/games.store';
import { LeaguesStore } from 'src/app/core/stores/leagues.store';
import { PatternsStore } from 'src/app/core/stores/patterns.store';
import { SettingsStore } from 'src/app/core/stores/settings.store';
import { vi } from 'vitest';

import { GameListComponent } from './game-list.component';

const mockGamesStore = {
  games: vi.fn().mockReturnValue([]),
  deleteGame: vi.fn().mockReturnValue(Promise.resolve()),
  saveGameToLocalStorage: vi.fn().mockReturnValue(Promise.resolve()),
  saveGamesToLocalStorage: vi.fn().mockReturnValue(Promise.resolve()),
  updateGamesInMemory: vi.fn(),
};

const mockBallsStore = {
  allBalls: vi.fn().mockReturnValue([]),
  arsenal: vi.fn().mockReturnValue([]),
};

const mockSettingsStore = {
  pinInputMode: vi.fn().mockReturnValue(true),
};

const mockPatternsStore = {
  allPatterns: vi.fn().mockReturnValue([]),
};

const mockLeaguesStore = {
  leagues: vi.fn().mockReturnValue([]),
};

describe('GameListComponent', () => {
  let component: GameListComponent;
  let fixture: ComponentFixture<GameListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
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
    fixture.componentRef.setInput('games', []);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
