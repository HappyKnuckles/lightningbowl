import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GamesStore } from '@stores/games.store';
import { AddGamePage } from './add-game.page';

const mockGamesStore = {
  games: jasmine.createSpy('games').and.returnValue([]),
  saveGameToLocalStorage: jasmine.createSpy('saveGameToLocalStorage').and.returnValue(Promise.resolve()),
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
