import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StatsPage } from './stats.page';
import { GamesStore } from 'src/app/core/stores/games.store';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { AngularDelegate } from '@ionic/angular';
import { vi } from 'vitest';

const mockGamesStore = {
  games: vi.fn().mockReturnValue([]),
  loadGameHistory: vi.fn().mockReturnValue(Promise.resolve([])),
};

const mockBallsStore = {
  allBalls: vi.fn().mockReturnValue([]),
  arsenal: vi.fn().mockReturnValue([]),
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
