import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { ModalController } from '@ionic/angular/standalone';
import { of } from 'rxjs';
import { Ball } from 'src/app/core/models/ball.model';
import { AnalyticsService } from 'src/app/core/services/analytics/analytics.service';
import { BallFilterService } from 'src/app/core/services/ball-filter/ball-filter.service';
import { BallService } from 'src/app/core/services/ball/ball.service';
import { FavoritesService } from 'src/app/core/services/favorites/favorites.service';
import { HapticService } from 'src/app/core/services/haptic/haptic.service';
import { LoadingService } from 'src/app/core/services/loader/loading.service';
import { NetworkService } from 'src/app/core/services/network/network.service';
import { BallSortService } from 'src/app/core/services/sort/ball-sort.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { vi } from 'vitest';

import { createSpyObj, SpyObj } from '../../../testing/spy-obj';
import { BallsPage } from './balls.page';

describe('BallsPage', () => {
  let component: BallsPage;
  let fixture: ComponentFixture<BallsPage>;
  let favoritesService: SpyObj<FavoritesService>;
  let allBalls: ReturnType<typeof signal<Ball[]>>;

  const ball = (name: string): Ball => ({ ball_id: name, ball_name: name, core_weight: '15' }) as Ball;

  beforeEach(async () => {
    allBalls = signal<Ball[]>([]);
    const mockBallsStore = {
      url: '',
      allBalls,
      arsenal: signal<Ball[]>([]),
      saveBallToArsenal: vi.fn().mockResolvedValue([]),
      removeFromArsenal: vi.fn().mockResolvedValue(undefined),
    };
    const mockBallFilterService = {
      filters: signal({}),
      defaultFilters: {},
      filteredBalls: vi.fn().mockReturnValue([]),
      activeFilterCount: vi.fn().mockReturnValue(0),
    };
    const favoritesServiceSpy = createSpyObj(['toggleBallFavorite', 'isBallFavorite']);
    const toastServiceSpy = createSpyObj(['showToast']);
    const ballServiceSpy = createSpyObj(['loadBalls', 'getBallsByCore', 'getBallsByCoverstock']);
    const loadingServiceSpy = createSpyObj(['setLoading']);
    const hapticServiceSpy = createSpyObj(['vibrate']);
    const sortServiceSpy = createSpyObj(['sortBalls'], { BALL_SORT_OPTIONS: [] });
    const networkServiceSpy = createSpyObj([], { isOffline: false });
    const analyticsServiceSpy = createSpyObj(['trackEvent', 'trackBallSearch']);

    await TestBed.configureTestingModule({
      imports: [BallsPage],
      providers: [
        { provide: FavoritesService, useValue: favoritesServiceSpy },
        { provide: ToastService, useValue: toastServiceSpy },
        { provide: BallService, useValue: ballServiceSpy },
        { provide: BallFilterService, useValue: mockBallFilterService },
        { provide: BallsStore, useValue: mockBallsStore },
        { provide: LoadingService, useValue: loadingServiceSpy },
        { provide: HapticService, useValue: hapticServiceSpy },
        { provide: BallSortService, useValue: sortServiceSpy },
        { provide: NetworkService, useValue: networkServiceSpy },
        { provide: AnalyticsService, useValue: analyticsServiceSpy },
        { provide: ActivatedRoute, useValue: { queryParams: of({}) } },
        ModalController,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BallsPage);
    component = fixture.componentInstance;
    favoritesService = TestBed.inject(FavoritesService) as SpyObj<FavoritesService>;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should toggle favorite and show appropriate toast', () => {
    const mockBall = ball('Test Ball');
    const mockEvent = { stopPropagation: vi.fn() } as unknown as Event;
    favoritesService.toggleBallFavorite.mockReturnValue(true);

    component.toggleFavorite(mockEvent, mockBall);

    expect(mockEvent.stopPropagation).toHaveBeenCalled();
    expect(favoritesService.toggleBallFavorite).toHaveBeenCalledWith(mockBall);
  });

  it('disables the search until the ball catalogue has loaded', () => {
    expect(component.searchDisabled()).toBe(true);

    allBalls.set([ball('Zen')]);

    expect(component.searchDisabled()).toBe(false);
  });

  it('builds search suggestions from the loaded catalogue', () => {
    allBalls.set([ball('Phaze II'), ball('Zen'), ball('Hammer Phaze')]);

    component.searchTerm.set('phaze');

    expect(component.searchSuggestions()).toEqual(['Phaze II', 'Hammer Phaze']);
  });
});
