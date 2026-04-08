import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { ModalController } from '@ionic/angular/standalone';
import { of } from 'rxjs';
import { BallFilterService } from 'src/app/core/services/ball-filter/ball-filter.service';
import { BallService } from 'src/app/core/services/ball/ball.service';
import { FavoritesService } from 'src/app/core/services/favorites/favorites.service';
import { HapticService } from 'src/app/core/services/haptic/haptic.service';
import { LoadingService } from 'src/app/core/services/loader/loading.service';
import { NetworkService } from 'src/app/core/services/network/network.service';
import { SortService } from 'src/app/core/services/sort/sort.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { BallsPage } from './balls.page';

describe('BallsPage', () => {
  let component: BallsPage;
  let fixture: ComponentFixture<BallsPage>;
  let favoritesService: jasmine.SpyObj<FavoritesService>;

  beforeEach(async () => {
    const favoritesServiceSpy = jasmine.createSpyObj('FavoritesService', ['toggleBallFavorite', 'isBallFavorite']);
    const toastServiceSpy = jasmine.createSpyObj('ToastService', ['showToast']);
    const ballServiceSpy = jasmine.createSpyObj('BallService', ['loadBalls', 'getBallsByCore', 'getBallsByCoverstock']);
    const ballFilterServiceSpy = jasmine.createSpyObj('BallFilterService', ['filteredBalls', 'activeFilterCount']);
    const ballsStoreSpy = jasmine.createSpyObj('BallsStore', ['allBalls', 'arsenal', 'saveBallToArsenal', 'removeFromArsenal']);
    const loadingServiceSpy = jasmine.createSpyObj('LoadingService', ['setLoading']);
    const hapticServiceSpy = jasmine.createSpyObj('HapticService', ['vibrate']);
    const sortServiceSpy = jasmine.createSpyObj('SortService', ['sortBalls']);
    const networkServiceSpy = jasmine.createSpyObj('NetworkService', ['isOffline']);

    ballsStoreSpy.allBalls.and.returnValue([]);
    ballsStoreSpy.arsenal.and.returnValue([]);

    await TestBed.configureTestingModule({
      imports: [BallsPage],
      providers: [
        { provide: FavoritesService, useValue: favoritesServiceSpy },
        { provide: ToastService, useValue: toastServiceSpy },
        { provide: BallService, useValue: ballServiceSpy },
        { provide: BallFilterService, useValue: ballFilterServiceSpy },
        { provide: BallsStore, useValue: ballsStoreSpy },
        { provide: LoadingService, useValue: loadingServiceSpy },
        { provide: HapticService, useValue: hapticServiceSpy },
        { provide: SortService, useValue: sortServiceSpy },
        { provide: NetworkService, useValue: networkServiceSpy },
        { provide: ActivatedRoute, useValue: { queryParams: of({}) } },
        ModalController,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BallsPage);
    component = fixture.componentInstance;
    favoritesService = TestBed.inject(FavoritesService) as jasmine.SpyObj<FavoritesService>;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should toggle favorite and show appropriate toast', () => {
    const mockBall = {
      ball_id: 'test-ball-id',
      core_weight: '15lb',
      ball_name: 'Test Ball',
    } as any;

    const mockEvent = { stopPropagation: jasmine.createSpy() } as any;
    favoritesService.toggleBallFavorite.and.returnValue(true);

    component.toggleFavorite(mockEvent, mockBall);

    expect(mockEvent.stopPropagation).toHaveBeenCalled();
    expect(favoritesService.toggleBallFavorite).toHaveBeenCalledWith('test-ball-id', '15lb');
  });
});
