import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController } from '@ionic/angular/standalone';
import { Pattern } from 'src/app/core/models/pattern.model';
import { AnalyticsService } from 'src/app/core/services/analytics/analytics.service';
import { FavoritesService } from 'src/app/core/services/favorites/favorites.service';
import { HapticService } from 'src/app/core/services/haptic/haptic.service';
import { LoadingService } from 'src/app/core/services/loader/loading.service';
import { NetworkService } from 'src/app/core/services/network/network.service';
import { PatternService } from 'src/app/core/services/pattern/pattern.service';
import { PatternSortService } from 'src/app/core/services/sort/pattern-sort.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { PatternsStore } from 'src/app/core/stores/patterns.store';
import { PatternPage } from './pattern.page';

describe('PatternPage', () => {
  let component: PatternPage;
  let fixture: ComponentFixture<PatternPage>;
  let allPatterns: ReturnType<typeof signal<Partial<Pattern>[]>>;

  beforeEach(async () => {
    allPatterns = signal<Partial<Pattern>[]>([]);
    const mockPatternsStore = { allPatterns };
    const patternServiceSpy = jasmine.createSpyObj('PatternService', ['getPatterns', 'searchPattern']);
    const toastServiceSpy = jasmine.createSpyObj('ToastService', ['showToast']);
    const loadingServiceSpy = jasmine.createSpyObj('LoadingService', ['setLoading']);
    const hapticServiceSpy = jasmine.createSpyObj('HapticService', ['vibrate']);
    const sortServiceSpy = jasmine.createSpyObj('PatternSortService', ['sortPatterns'], { PATTERN_SORT_OPTIONS: [] });
    const networkServiceSpy = jasmine.createSpyObj('NetworkService', [], { isOffline: false });
    const favoritesServiceSpy = jasmine.createSpyObj('FavoritesService', ['toggleFavorite', 'isFavorite']);
    const analyticsServiceSpy = jasmine.createSpyObj('AnalyticsService', ['trackEvent', 'trackPatternLookup']);

    await TestBed.configureTestingModule({
      imports: [PatternPage],
      providers: [
        { provide: PatternService, useValue: patternServiceSpy },
        { provide: PatternsStore, useValue: mockPatternsStore },
        { provide: ToastService, useValue: toastServiceSpy },
        { provide: LoadingService, useValue: loadingServiceSpy },
        { provide: HapticService, useValue: hapticServiceSpy },
        { provide: PatternSortService, useValue: sortServiceSpy },
        { provide: NetworkService, useValue: networkServiceSpy },
        { provide: FavoritesService, useValue: favoritesServiceSpy },
        { provide: AnalyticsService, useValue: analyticsServiceSpy },
        ModalController,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PatternPage);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('disables the search until the pattern library has loaded', () => {
    expect(component.searchDisabled()).toBeTrue();

    allPatterns.set([{ title: 'PBA Shark' }]);

    expect(component.searchDisabled()).toBeFalse();
  });

  it('builds search suggestions from the loaded pattern titles', () => {
    allPatterns.set([{ title: 'PBA Shark' }, { title: 'Kegel Main Street' }, { title: 'PBA Cheetah 35' }]);

    component.searchTerm.set('pba');

    expect(component.searchSuggestions()).toEqual(['PBA Shark', 'PBA Cheetah 35']);
  });
});
