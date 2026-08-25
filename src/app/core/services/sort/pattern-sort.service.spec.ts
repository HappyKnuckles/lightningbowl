import { TestBed } from '@angular/core/testing';

import { Pattern } from 'src/app/core/models/pattern.model';
import { PatternSortField, PatternSortOption, SortDirection } from 'src/app/core/models/sort.model';
import { FavoritesService } from 'src/app/core/services/favorites/favorites.service';
import { makePattern } from 'src/testing/fixtures';
import { createSpyObj, SpyObj } from 'src/testing/spy-obj';

import { PatternSortService } from './pattern-sort.service';

function option(field: PatternSortField, direction = SortDirection.ASC): PatternSortOption {
  return { field, direction, label: `${field} ${direction}` };
}

describe('PatternSortService', () => {
  let service: PatternSortService;
  let favoritesService: SpyObj<FavoritesService>;

  const patterns: Pattern[] = [
    makePattern({ url: 'p1', title: 'Shark', distance: '48', ratio: '3:1', volume: '30' }),
    makePattern({ url: 'p2', title: 'cheetah', distance: '35', ratio: '10:1', volume: '20' }),
    makePattern({ url: 'p3', title: 'Scorpion', distance: '42', ratio: '5:1', volume: '25' }),
  ];

  beforeEach(() => {
    favoritesService = createSpyObj<FavoritesService>(['getFavoritePatterns']);
    favoritesService.getFavoritePatterns.mockReturnValue([]);

    TestBed.configureTestingModule({
      providers: [{ provide: FavoritesService, useValue: favoritesService }],
    });
    service = TestBed.inject(PatternSortService);
  });

  it('offers a labelled option per sortable field', () => {
    expect(service.PATTERN_SORT_OPTIONS.length).toBeGreaterThan(0);
    expect(service.PATTERN_SORT_OPTIONS.every((o) => o.label.length > 0)).toBe(true);
  });

  describe('sortPatterns', () => {
    // The list itself arrives pre-sorted from the API; only the favorites block is reordered here.
    it('returns the list unchanged when favorites are not pinned', () => {
      const sorted = service.sortPatterns(patterns, option(PatternSortField.TITLE));

      expect(sorted.map((p) => p.url)).toEqual(['p1', 'p2', 'p3']);
      expect(sorted).not.toBe(patterns);
    });

    it('pulls favorites to the front and sorts them by title', () => {
      favoritesService.getFavoritePatterns.mockReturnValue([patterns[0], patterns[1]]);

      const sorted = service.sortPatterns(patterns, option(PatternSortField.TITLE), true);

      expect(sorted.map((p) => p.title)).toEqual(['cheetah', 'Shark', 'Scorpion']);
    });

    it('sorts favorites numerically on distance and volume', () => {
      favoritesService.getFavoritePatterns.mockReturnValue([...patterns]);

      const byDistance = service.sortPatterns(patterns, option(PatternSortField.DISTANCE), true);
      const byVolume = service.sortPatterns(patterns, option(PatternSortField.VOLUME, SortDirection.DESC), true);

      expect(byDistance.map((p) => p.distance)).toEqual(['35', '42', '48']);
      expect(byVolume.map((p) => p.volume)).toEqual(['30', '25', '20']);
    });

    it('sorts favorites by the numeric value of the oil ratio', () => {
      favoritesService.getFavoritePatterns.mockReturnValue([...patterns]);

      const sorted = service.sortPatterns(patterns, option(PatternSortField.RATIO), true);

      expect(sorted.map((p) => p.ratio)).toEqual(['3:1', '5:1', '10:1']);
    });

    it('treats a missing value as an empty one', () => {
      const nameless = makePattern({ url: 'p4', title: undefined as unknown as string });
      favoritesService.getFavoritePatterns.mockReturnValue([patterns[0], nameless]);

      const sorted = service.sortPatterns([...patterns, nameless], option(PatternSortField.TITLE), true);

      expect(sorted[0].url).toBe('p4');
    });

    it('does not mutate the input array', () => {
      favoritesService.getFavoritePatterns.mockReturnValue([patterns[1]]);

      service.sortPatterns(patterns, option(PatternSortField.TITLE), true);

      expect(patterns.map((p) => p.url)).toEqual(['p1', 'p2', 'p3']);
    });
  });
});
