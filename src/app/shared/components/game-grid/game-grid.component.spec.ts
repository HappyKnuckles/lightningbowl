import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { GameGridComponent } from './game-grid.component';
import { SettingsStore } from 'src/app/core/stores/settings.store';
import { PatternsStore } from 'src/app/core/stores/patterns.store';
import { BallsStore } from 'src/app/core/stores/balls.store';

const mockSettingsStore = {
  pinInputMode: jasmine.createSpy('pinInputMode').and.returnValue(true),
};

const mockPatternsStore = {
  allPatterns: jasmine.createSpy('allPatterns').and.returnValue([]),
};

const mockBallsStore = {
  allBalls: jasmine.createSpy('allBalls').and.returnValue([]),
  arsenal: jasmine.createSpy('arsenal').and.returnValue([]),
};

describe('TrackGridComponent', () => {
  let component: GameGridComponent;
  let fixture: ComponentFixture<GameGridComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [GameGridComponent],
      providers: [
        { provide: SettingsStore, useValue: mockSettingsStore },
        { provide: PatternsStore, useValue: mockPatternsStore },
        { provide: BallsStore, useValue: mockBallsStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GameGridComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
