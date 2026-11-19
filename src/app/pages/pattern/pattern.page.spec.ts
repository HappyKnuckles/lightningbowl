import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController } from '@ionic/angular/standalone';
import { vi } from 'vitest';
import { Pattern, PatternSummary } from 'src/app/core/models/pattern.model';
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
import { createSpyObj } from '../../../testing/spy-obj';

describe('PatternPage', () => {
  let component: PatternPage;
  let fixture: ComponentFixture<PatternPage>;
  let allPatterns: ReturnType<typeof signal<Partial<Pattern>[]>>;
  let patternService: ReturnType<typeof createSpyObj<PatternService>>;

  beforeEach(async () => {
    allPatterns = signal<Partial<Pattern>[]>([]);
    const mockPatternsStore = { allPatterns };
    const patternServiceSpy = createSpyObj<PatternService>(['getPatterns', 'searchPattern', 'getPatternData']);
    patternService = patternServiceSpy;
    const toastServiceSpy = createSpyObj(['showToast']);
    const loadingServiceSpy = createSpyObj(['setLoading']);
    const hapticServiceSpy = createSpyObj(['vibrate']);
    const sortServiceSpy = createSpyObj(['sortPatterns'], { PATTERN_SORT_OPTIONS: [] });
    const networkServiceSpy = createSpyObj([], { isOffline: false });
    const favoritesServiceSpy = createSpyObj(['toggleFavorite', 'isFavorite']);
    const analyticsServiceSpy = createSpyObj(['trackEvent', 'trackPatternLookup']);

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
    expect(component.searchDisabled()).toBe(true);

    allPatterns.set([{ title: 'PBA Shark' }]);

    expect(component.searchDisabled()).toBe(false);
  });

  it('builds search suggestions from the loaded pattern titles', () => {
    allPatterns.set([{ title: 'PBA Shark' }, { title: 'Kegel Main Street' }, { title: 'PBA Cheetah 35' }]);

    component.searchTerm.set('pba');

    expect(component.searchSuggestions()).toEqual(['PBA Shark', 'PBA Cheetah 35']);
  });

  describe('loading the list from the API', () => {
    const summary = (n: number): PatternSummary => ({ url: `u${n}`, title: `Pattern ${n}` }) as PatternSummary;
    const page = (total: number, from: number, count: number) => ({
      total,
      patterns: Array.from({ length: count }, (_, i) => summary(from + i)),
    });

    beforeEach(() => {
      component.content = { scrollToTop: vi.fn() } as never;
    });

    it('searches page by page, and knows when all matches are there', async () => {
      patternService.getPatterns.mockResolvedValueOnce(page(3, 1, 2)).mockResolvedValueOnce(page(3, 3, 1));

      await component.searchPatterns(new CustomEvent('ionInput', { detail: { value: 'shark' } }));
      expect(patternService.getPatterns).toHaveBeenLastCalledWith(1, false, 'title', 'asc', 'shark');
      expect(component.hasMoreData).toBe(true);

      const complete = vi.fn();
      // past the guard against infinite scroll firing twice in a row
      const now = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 1000);
      await component.loadPatterns({ target: { complete } } as never);
      now.mockRestore();
      expect(patternService.getPatterns).toHaveBeenLastCalledWith(2, false, 'title', 'asc', 'shark');
      expect(component.patterns().map((p) => p.url)).toEqual(['u1', 'u2', 'u3']);
      expect(component.hasMoreData).toBe(false);
      expect(complete).toHaveBeenCalled();
    });

    it('drops an answer that comes in after a newer search', async () => {
      let answerOld!: (value: ReturnType<typeof page>) => void;
      patternService.getPatterns.mockReturnValueOnce(new Promise((resolve) => (answerOld = resolve))).mockResolvedValueOnce(page(1, 9, 1));

      const old = component.searchPatterns(new CustomEvent('ionInput', { detail: { value: 'sh' } }));
      await component.searchPatterns(new CustomEvent('ionInput', { detail: { value: 'shark' } }));
      answerOld(page(50, 1, 50));
      await old;

      expect(component.patterns().map((p) => p.url)).toEqual(['u9']);
    });

    it('loads the oil rows when a pattern is opened', async () => {
      const full = { ...summary(1), forwards_data: [], reverse_data: [] } as Pattern;
      patternService.getPatternData.mockResolvedValue(full);

      await component.openPattern(summary(1));

      expect(patternService.getPatternData).toHaveBeenCalledWith('u1');
      expect(component.selectedPatternDetail()).toBe(full);
    });
  });
});
