import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { PatternsStore } from 'src/app/core/stores/patterns.store';
import { SettingsStore } from 'src/app/core/stores/settings.store';
import { GameComponent } from './game.component';

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

describe('GameComponent', () => {
  let component: GameComponent;
  let fixture: ComponentFixture<GameComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [GameComponent],
      providers: [
        { provide: SettingsStore, useValue: mockSettingsStore },
        { provide: PatternsStore, useValue: mockPatternsStore },
        { provide: BallsStore, useValue: mockBallsStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GameComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
