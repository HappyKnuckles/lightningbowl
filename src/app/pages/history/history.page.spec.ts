import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AngularDelegate } from '@ionic/angular';
import { AppFacade } from '@stores/app.facade';
import { GamesStore } from '@stores/games.store';
import { HistoryPage } from './history.page';

const mockGamesStore = {
  games: jasmine.createSpy('games').and.returnValue([]),
  loadGameHistory: jasmine.createSpy('loadGameHistory').and.returnValue(Promise.resolve([])),
};

const mockAppFacade = {
  deleteAllData: jasmine.createSpy('deleteAllData').and.returnValue(Promise.resolve()),
};

describe('HistoryPage', () => {
  let component: HistoryPage;
  let fixture: ComponentFixture<HistoryPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HistoryPage],
      providers: [{ provide: GamesStore, useValue: mockGamesStore }, { provide: AppFacade, useValue: mockAppFacade }, AngularDelegate],
    }).compileComponents();

    fixture = TestBed.createComponent(HistoryPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
