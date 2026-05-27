import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { ModalController } from '@ionic/angular';
import { TimeRange } from '@models/filter.model';
import { GameFilterService } from '@services/game-filter/game-filter.service';
import { BehaviorSubject } from 'rxjs';
import { GameFilterComponent } from './game-filter.component';

const mockFilters = {
  excludePractice: false,
  minScore: 0,
  maxScore: 300,
  isClean: false,
  isPerfect: false,
  league: ['all'],
  timeRange: TimeRange.ALL,
  startDate: '',
  endDate: '',
};

const FilterServiceMock = {
  filterGames: jasmine.createSpy('filterGames').and.returnValue([]),
  // Mock filters$ as a BehaviorSubject to allow subscriptions
  filters$: new BehaviorSubject(mockFilters),
};

describe('GameFilterComponent', () => {
  let component: GameFilterComponent;
  let fixture: ComponentFixture<GameFilterComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [GameFilterComponent], // Corrected here
      providers: [
        {
          provide: ModalController,
          useValue: {
            create: jasmine.createSpy('create').and.returnValue(Promise.resolve({ present: jasmine.createSpy('present') })),
          },
        },
        { provide: GameFilterService, useValue: FilterServiceMock }, // Mocked FilterService with filters$
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GameFilterComponent);
    component = fixture.componentInstance;

    component.filteredGames = [];
    fixture.detectChanges();

    // Ensure filters are initialized by triggering the subscription manually
    FilterServiceMock.filters$.next(mockFilters);
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
