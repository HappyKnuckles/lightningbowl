import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AddGamePage } from './add-game.page';
import { GamesStore } from 'src/app/core/stores/games.store';

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
