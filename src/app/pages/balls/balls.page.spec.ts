import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { ModalController } from '@ionic/angular/standalone';
import { of } from 'rxjs';
import { Ball, BallPage } from 'src/app/core/models/ball.model';
import { BallSortField, BallSortOption, SortDirection } from 'src/app/core/models/sort.model';
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
import { BallsPage } from './balls.page';
import { vi } from 'vitest';
import { createSpyObj, SpyObj } from '../../../testing/spy-obj';

describe('BallsPage', () => {
  let component: BallsPage;
  let fixture: ComponentFixture<BallsPage>;
  let favoritesService: SpyObj<FavoritesService>;
  let knownBalls: ReturnType<typeof signal<Ball[]>>;
  let online: ReturnType<typeof signal<boolean>>;
  let ballService: SpyObj<BallService>;

  const ball = (name: string): Ball => ({ ball_id: name, ball_name: name, core_weight: '15' }) as Ball;
  const page = (content: Ball[], number = 0, totalPages = 1): BallPage => ({
    content,
    page: { number, size: 50, totalElements: totalPages * 50, totalPages },
  });
  const infiniteEvent = () => ({ target: { complete: vi.fn() } }) as never;
  const newestFirst: BallSortOption = { field: BallSortField.RELEASE_DATE, direction: SortDirection.DESC, label: 'Newest First' };
  const bestMatch: BallSortOption = { field: BallSortField.RELEVANCE, direction: SortDirection.DESC, label: 'Best Match' };
  const rgHighFirst: BallSortOption = { field: BallSortField.CORE_RG, direction: SortDirection.DESC, label: 'RG (High to Low)' };

  beforeEach(async () => {
    knownBalls = signal<Ball[]>([]);
    online = signal(true);
    const mockBallsStore = {
      url: '',
      knownBalls,
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
    const ballServiceSpy = createSpyObj<BallService>(['searchBalls', 'getBallsByCore', 'getBallsByCoverstock', 'getBallsByMovementPattern']);
    ballServiceSpy.searchBalls.mockResolvedValue(page([]));
    const loadingServiceSpy = createSpyObj(['setLoading']);
    const hapticServiceSpy = createSpyObj(['vibrate']);
    const sortServiceSpy = createSpyObj<BallSortService>(['sortBalls'], { BALL_SORT_OPTIONS: [newestFirst], BEST_MATCH_OPTION: bestMatch });
    sortServiceSpy.sortBalls.mockImplementation((balls: Ball[]) => balls);
    const networkServiceSpy = {
      get isOnline() {
        return online();
      },
      get isOffline() {
        return !online();
      },
    };
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
    ballService = TestBed.inject(BallService) as SpyObj<BallService>;
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

  it('keeps the search enabled online, where the API searches', () => {
    expect(component.searchDisabled()).toBe(false);
  });

  it('disables the search offline when there are no known balls', () => {
    online.set(false);
    expect(component.searchDisabled()).toBe(true);

    knownBalls.set([ball('Zen')]);

    expect(component.searchDisabled()).toBe(false);
  });

  it('builds search suggestions from known balls', () => {
    knownBalls.set([ball('Phaze II'), ball('Zen'), ball('Hammer Phaze')]);

    component.searchTerm.set('phaze');

    expect(component.searchSuggestions()).toEqual(['Phaze II', 'Hammer Phaze']);
  });

  it('loads the first page from the API and knows whether more pages exist', async () => {
    ballService.searchBalls.mockResolvedValue(page([ball('A'), ball('B')], 0, 3));

    await component.loadFirstPage();

    expect(ballService.searchBalls).toHaveBeenCalledWith(expect.objectContaining({ page: '0', size: '50' }));
    expect(component.displayedBalls().map((b) => b.ball_id)).toEqual(['A', 'B']);
    expect(component.hasMoreData()).toBe(true);
  });

  it('appends the next page on infinite scroll', async () => {
    ballService.searchBalls.mockResolvedValueOnce(page([ball('A')], 0, 2)).mockResolvedValueOnce(page([ball('B')], 1, 2));
    await component.loadFirstPage();
    const event = infiniteEvent();

    await component.loadMore(event);

    expect(ballService.searchBalls).toHaveBeenLastCalledWith(expect.objectContaining({ page: '1' }));
    expect(component.displayedBalls().map((b) => b.ball_id)).toEqual(['A', 'B']);
    expect(component.hasMoreData()).toBe(false);
    expect((event as { target: { complete: () => void } }).target.complete).toHaveBeenCalled();
  });

  it('drops a response that arrives after a newer query', async () => {
    let resolveStale!: (value: BallPage) => void;
    ballService.searchBalls
      .mockReturnValueOnce(new Promise<BallPage>((resolve) => (resolveStale = resolve)))
      .mockResolvedValueOnce(page([ball('New')]));

    const stale = component.loadFirstPage();
    await component.loadFirstPage();
    resolveStale(page([ball('Old')]));
    await stale;

    expect(component.displayedBalls().map((b) => b.ball_id)).toEqual(['New']);
  });

  it('sends the search term to the API', async () => {
    component.searchTerm.set('phaze');

    await component.loadFirstPage();

    expect(ballService.searchBalls).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'phaze' }));
  });

  it('searches known balls when offline', () => {
    online.set(false);
    knownBalls.set([ball('Phaze II'), ball('Zen')]);

    component.searchTerm.set('phaze');

    expect(component.displayedBalls().map((b) => b.ball_name)).toEqual(['Phaze II']);
    expect(ballService.searchBalls).not.toHaveBeenCalled();
  });

  it('pages through known balls offline', () => {
    online.set(false);
    knownBalls.set(Array.from({ length: 150 }, (_, i) => ball(`Ball ${i}`)));

    expect(component.displayedBalls().length).toBe(100);
    expect(component.hasMoreData()).toBe(true);

    void component.loadMore(infiniteEvent());

    expect(component.displayedBalls().length).toBe(150);
    expect(component.hasMoreData()).toBe(false);
  });

  describe('Best Match', () => {
    it('is selected when a search starts and offered only while searching', () => {
      expect(component.sortOptions()).toEqual([newestFirst]);

      component.searchSubject.next('phaze');

      expect(component.currentSortOption()).toEqual(bestMatch);
      expect(component.sortOptions()).toEqual([bestMatch, newestFirst]);
    });

    it('restores the previous sort when the search is cleared', () => {
      component.onSortChanged(rgHighFirst);
      component.searchSubject.next('phaze');

      component.searchSubject.next('');

      expect(component.currentSortOption()).toEqual(rgHighFirst);
    });

    it('keeps a sort picked during the search and sends it with the search', async () => {
      component.searchSubject.next('phaze');
      component.onSortChanged(rgHighFirst);

      await component.loadFirstPage();
      expect(ballService.searchBalls).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'phaze', sort: 'core_rg,desc' }));

      component.searchSubject.next('');
      expect(component.currentSortOption()).toEqual(rgHighFirst);
    });
  });
});
