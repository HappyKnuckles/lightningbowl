import { inject, Injectable } from '@angular/core';
import { Pattern } from '../../models/pattern.model';
import { PatternSortOption, PatternSortField, SortDirection } from '../../models/sort.model';
import { FavoritesService } from '../favorites/favorites.service';

@Injectable({
  providedIn: 'root',
})
export class PatternSortService {
  private favoritesService = inject(FavoritesService);

  readonly PATTERN_SORT_OPTIONS: PatternSortOption[] = [
    { field: PatternSortField.TITLE, direction: SortDirection.ASC, label: 'Title (A-Z)' },
    { field: PatternSortField.TITLE, direction: SortDirection.DESC, label: 'Title (Z-A)' },
    { field: PatternSortField.CATEGORY, direction: SortDirection.ASC, label: 'Category (A-Z)' },
    { field: PatternSortField.DISTANCE, direction: SortDirection.ASC, label: 'Distance (Low to High)' },
    { field: PatternSortField.DISTANCE, direction: SortDirection.DESC, label: 'Distance (High to Low)' },
    { field: PatternSortField.RATIO, direction: SortDirection.ASC, label: 'Ratio (Low to High)' },
    { field: PatternSortField.RATIO, direction: SortDirection.DESC, label: 'Ratio (High to Low)' },
    { field: PatternSortField.VOLUME, direction: SortDirection.ASC, label: 'Volume (Low to High)' },
    { field: PatternSortField.VOLUME, direction: SortDirection.DESC, label: 'Volume (High to Low)' },
  ];

  sortPatterns(patterns: Pattern[], sortOption: PatternSortOption, favoritesFirst = false): Pattern[] {
    const sortedPatterns = [...patterns];

    if (favoritesFirst) {
      const favorites = this.favoritesService.favoritePatterns();
      const favoritePatterns: Pattern[] = [];
      const nonFavoritePatterns: Pattern[] = [];

      // Separate favorites from non-favorites
      sortedPatterns.forEach((pattern) => {
        if (favorites.has(pattern.url)) {
          favoritePatterns.push(pattern);
        } else {
          nonFavoritePatterns.push(pattern);
        }
      });

      // Sort both groups using the selected sort option
      const sortedFavorites = this.applySortToPatterns(favoritePatterns, sortOption);
      const sortedNonFavorites = this.applySortToPatterns(nonFavoritePatterns, sortOption);

      return [...sortedFavorites, ...sortedNonFavorites];
    }

    return this.applySortToPatterns(sortedPatterns, sortOption);
  }

  private applySortToPatterns(patterns: Pattern[], sortOption: PatternSortOption): Pattern[] {
    return patterns.sort((a, b) => {
      const { field, direction } = sortOption;

      let aValue: string | number | undefined | null = a[field];
      let bValue: string | number | undefined | null = b[field];

      // Handle numeric fields
      if (
        field === PatternSortField.DISTANCE ||
        field === PatternSortField.VOLUME ||
        field === PatternSortField.FORWARD ||
        field === PatternSortField.REVERSE ||
        field === PatternSortField.PUMP
      ) {
        aValue = parseFloat(aValue as string) || 0;
        bValue = parseFloat(bValue as string) || 0;
      }
      // Handle ratio field (extract numeric value from "X:Y" format)
      else if (field === PatternSortField.RATIO && aValue && bValue) {
        const aRatio = this.extractRatioValue(aValue as string);
        const bRatio = this.extractRatioValue(bValue as string);
        aValue = aRatio;
        bValue = bRatio;
      }
      // Handle string fields
      else if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      // Ensure values are defined for comparison
      if (aValue === undefined || aValue === null) aValue = '';
      if (bValue === undefined || bValue === null) bValue = '';

      let comparison = 0;
      if (aValue < bValue) {
        comparison = -1;
      } else if (aValue > bValue) {
        comparison = 1;
      }

      return direction === SortDirection.DESC ? -comparison : comparison;
    });
  }

  private extractRatioValue(ratio: string): number {
    if (!ratio) return 0;
    const parts = ratio.split(':');
    if (parts.length >= 2) {
      const numerator = parseFloat(parts[0]) || 0;
      const denominator = parseFloat(parts[1]) || 1;
      return numerator / denominator;
    }
    return parseFloat(ratio) || 0;
  }
}
