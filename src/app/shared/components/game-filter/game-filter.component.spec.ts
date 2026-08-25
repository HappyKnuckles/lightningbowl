import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController } from '@ionic/angular';
import { vi } from 'vitest';

import { TimeRange } from 'src/app/core/models/filter.model';
import { GameFilterService } from 'src/app/core/services/game-filter/game-filter.service';
import { GamesStore } from 'src/app/core/stores/games.store';
import { makeGame } from 'src/testing/fixtures';

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

// GameFilterService exposes `filters` as a writable signal, and the component
// calls `.update()` on it, so the mock has to be a real signal.
const FilterServiceMock = {
  filterGames: vi.fn().mockReturnValue([]),
  filters: signal(mockFilters),
  filteredGames: signal([]),
  defaultFilters: mockFilters,
  activeFilterCount: vi.fn().mockReturnValue(0),
  resetFilters: vi.fn(),
  saveFilters: vi.fn(),
};

// ngOnInit indexes games()[length - 1] without a guard, so the store must be non-empty.
const GamesStoreMock = {
  games: vi
    .fn()
    .mockReturnValue([makeGame({ gameId: 'game-1', date: Date.UTC(2026, 0, 2) }), makeGame({ gameId: 'game-2', date: Date.UTC(2026, 0, 1) })]),
};

describe('GameFilterComponent', () => {
  let component: GameFilterComponent;
  let fixture: ComponentFixture<GameFilterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameFilterComponent], // Corrected here
      providers: [
        {
          provide: ModalController,
          useValue: {
            create: vi.fn().mockReturnValue(Promise.resolve({ present: vi.fn() })),
          },
        },
        { provide: GameFilterService, useValue: FilterServiceMock },
        { provide: GamesStore, useValue: GamesStoreMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GameFilterComponent);
    component = fixture.componentInstance;

    component.filteredGames = [];
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
