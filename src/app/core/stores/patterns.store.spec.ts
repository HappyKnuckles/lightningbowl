import { TestBed } from '@angular/core/testing';
import { CacheService } from 'src/app/core/services/cache/cache.service';
import { NetworkService } from 'src/app/core/services/network/network.service';
import { PatternService } from 'src/app/core/services/pattern/pattern.service';
import { makePattern } from 'src/testing/fixtures';
import { createSpyObj, SpyObj } from 'src/testing/spy-obj';
import { PatternsStore } from './patterns.store';

/** Chart payload shape returned by `PatternService.getAllPatternCharts`. */
function charts(patterns: { url?: string; title: string; chart_standard: string; chart_horizontal?: string }[]) {
  return { count: patterns.length, patterns: patterns.map((p) => ({ url: '', chart_horizontal: '', ...p })) };
}

describe('PatternsStore', () => {
  let store: PatternsStore;
  let patternService: SpyObj<PatternService>;
  let cacheService: SpyObj<CacheService>;
  let isOnline: boolean;

  beforeEach(() => {
    isOnline = true;
    patternService = createSpyObj<PatternService>(['getAllPatternsStripped', 'getAllPatternCharts']);
    patternService.getAllPatternsStripped.mockResolvedValue([]);
    patternService.getAllPatternCharts.mockResolvedValue(charts([]));

    cacheService = createSpyObj<CacheService>(['get', 'set', 'isValid', 'isStale']);
    cacheService.get.mockResolvedValue(null);
    cacheService.set.mockResolvedValue(undefined);
    cacheService.isValid.mockResolvedValue(false);
    cacheService.isStale.mockResolvedValue(false);

    const networkService = {
      get isOnline() {
        return isOnline;
      },
      get isOffline() {
        return !isOnline;
      },
    } as NetworkService;

    TestBed.configureTestingModule({
      providers: [
        { provide: PatternService, useValue: patternService },
        { provide: CacheService, useValue: cacheService },
        { provide: NetworkService, useValue: networkService },
      ],
    });
    store = TestBed.inject(PatternsStore);
  });

  describe('loadAllPatterns', () => {
    const cached = [makePattern({ title: 'Cached' })];
    const fetched = [makePattern({ title: 'Fetched' })];

    it('fetches and caches when there is no cache', async () => {
      patternService.getAllPatternsStripped.mockResolvedValue(fetched);

      await store.loadAllPatterns();

      expect(store.allPatterns()).toEqual(fetched);
      expect(store.isUsingCache()).toBe(false);
      expect(cacheService.set).toHaveBeenCalledWith('all_patterns', fetched);
    });

    it('serves a valid cache without hitting the network', async () => {
      cacheService.get.mockResolvedValue(cached);
      cacheService.isValid.mockResolvedValue(true);

      await store.loadAllPatterns();

      expect(store.allPatterns()).toEqual(cached);
      expect(store.isUsingCache()).toBe(true);
      expect(patternService.getAllPatternsStripped).not.toHaveBeenCalled();
    });

    it('refreshes a stale cache in the background', async () => {
      cacheService.get.mockResolvedValue(cached);
      cacheService.isValid.mockResolvedValue(true);
      cacheService.isStale.mockResolvedValue(true);
      patternService.getAllPatternsStripped.mockResolvedValue(fetched);

      await store.loadAllPatterns();
      await Promise.resolve();
      await Promise.resolve();

      expect(store.allPatterns()).toEqual(fetched);
      expect(store.isUsingCache()).toBe(false);
    });

    it('serves an expired cache while offline', async () => {
      isOnline = false;
      cacheService.get.mockResolvedValue(cached);

      await store.loadAllPatterns();

      expect(store.allPatterns()).toEqual(cached);
      expect(store.isUsingCache()).toBe(true);
    });

    it('does nothing when offline without a cache', async () => {
      isOnline = false;

      await store.loadAllPatterns();

      expect(store.allPatterns()).toEqual([]);
      expect(patternService.getAllPatternsStripped).not.toHaveBeenCalled();
    });

    it('bypasses the cache on a forced refresh', async () => {
      cacheService.get.mockResolvedValue(cached);
      cacheService.isValid.mockResolvedValue(true);
      patternService.getAllPatternsStripped.mockResolvedValue(fetched);

      await store.loadAllPatterns(true);

      expect(store.allPatterns()).toEqual(fetched);
    });

    it('falls back to the cache when the fetch fails', async () => {
      patternService.getAllPatternsStripped.mockRejectedValue(new Error('api down'));
      cacheService.get.mockResolvedValueOnce(null).mockResolvedValueOnce(cached);

      await store.loadAllPatterns();

      expect(store.allPatterns()).toEqual(cached);
      expect(store.isUsingCache()).toBe(true);
    });

    it('swallows a failed fetch when there is no cache either', async () => {
      patternService.getAllPatternsStripped.mockRejectedValue(new Error('api down'));

      await expect(store.loadAllPatterns()).resolves.toBeUndefined();
      expect(store.allPatterns()).toEqual([]);
    });
  });

  describe('loadPatternImageMap', () => {
    it('maps pattern titles to their standard chart', async () => {
      patternService.getAllPatternCharts.mockResolvedValue(charts([{ title: 'Shark', chart_standard: 'shark.png' }]));

      await store.loadPatternImageMap();

      expect(store.patternImageMap()).toEqual({ Shark: 'shark.png' });
      expect(cacheService.set).toHaveBeenCalledWith('pattern_image_map', { Shark: 'shark.png' });
    });

    it('skips patterns without a title or a chart', async () => {
      patternService.getAllPatternCharts.mockResolvedValue(
        charts([
          { title: 'Shark', chart_standard: '' },
          { title: '', chart_standard: 'nameless.png' },
        ]),
      );

      await store.loadPatternImageMap();

      expect(store.patternImageMap()).toEqual({});
    });

    it('serves the cached map when both it and the pattern cache are valid', async () => {
      cacheService.get.mockResolvedValue({ Shark: 'cached.png' });
      cacheService.isValid.mockResolvedValue(true);

      await store.loadPatternImageMap();

      expect(store.patternImageMap()).toEqual({ Shark: 'cached.png' });
      expect(patternService.getAllPatternCharts).not.toHaveBeenCalled();
    });

    it('refetches when the pattern cache went stale even if the map is still valid', async () => {
      cacheService.get.mockResolvedValue({ Shark: 'cached.png' });
      cacheService.isValid.mockImplementation((key: string) => Promise.resolve(key === 'pattern_image_map'));
      patternService.getAllPatternCharts.mockResolvedValue(charts([{ title: 'Shark', chart_standard: 'fresh.png' }]));

      await store.loadPatternImageMap();

      expect(store.patternImageMap()).toEqual({ Shark: 'fresh.png' });
    });

    it('refreshes a stale map in the background', async () => {
      cacheService.get.mockResolvedValue({ Shark: 'cached.png' });
      cacheService.isValid.mockResolvedValue(true);
      cacheService.isStale.mockResolvedValue(true);
      patternService.getAllPatternCharts.mockResolvedValue(charts([{ title: 'Shark', chart_standard: 'fresh.png' }]));

      await store.loadPatternImageMap();
      await Promise.resolve();
      await Promise.resolve();

      expect(store.patternImageMap()).toEqual({ Shark: 'fresh.png' });
    });

    it('does nothing when offline without a cache', async () => {
      isOnline = false;

      await store.loadPatternImageMap();

      expect(store.patternImageMap()).toEqual({});
      expect(patternService.getAllPatternCharts).not.toHaveBeenCalled();
    });

    it('falls back to the cached map when the fetch fails', async () => {
      patternService.getAllPatternCharts.mockRejectedValue(new Error('api down'));
      cacheService.get.mockResolvedValueOnce(null).mockResolvedValueOnce({ Shark: 'cached.png' });

      await store.loadPatternImageMap();

      expect(store.patternImageMap()).toEqual({ Shark: 'cached.png' });
    });
  });
});
