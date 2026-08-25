import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GamesStore } from 'src/app/core/stores/games.store';
import { vi } from 'vitest';

import { AddGamePage } from './add-game.page';

const mockGamesStore = {
  games: vi.fn().mockReturnValue([]),
  saveGameToLocalStorage: vi.fn().mockReturnValue(Promise.resolve()),
};

describe('AddGamePage', () => {
  let component: AddGamePage;
  let fixture: ComponentFixture<AddGamePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddGamePage],
      providers: [{ provide: GamesStore, useValue: mockGamesStore }],
    }).compileComponents();

    fixture = TestBed.createComponent(AddGamePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
