import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AngularDelegate } from '@ionic/angular';
import { BallsStore } from '@stores/balls.store';
import { GamesStore } from '@stores/games.store';
import { StatsPage } from './stats.page';

const mockGamesStore = {
  games: jasmine.createSpy('games').and.returnValue([]),
  loadGameHistory: jasmine.createSpy('loadGameHistory').and.returnValue(Promise.resolve([])),
};

const mockBallsStore = {
  allBalls: jasmine.createSpy('allBalls').and.returnValue([]),
};

describe('StatsPage', () => {
  let component: StatsPage;
  let fixture: ComponentFixture<StatsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatsPage],
      providers: [{ provide: GamesStore, useValue: mockGamesStore }, { provide: BallsStore, useValue: mockBallsStore }, AngularDelegate],
    }).compileComponents();

    fixture = TestBed.createComponent(StatsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
