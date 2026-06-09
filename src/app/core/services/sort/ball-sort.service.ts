import { inject, Injectable } from '@angular/core';
import { Ball } from '../../models/ball.model';
import { BallSortOption, BallSortField, SortDirection } from '../../models/sort.model';
import { FavoritesService } from '../favorites/favorites.service';

@Injectable({
  providedIn: 'root',
})
export class BallSortService {
  private favoritesService = inject(FavoritesService);

  readonly BALL_SORT_OPTIONS: BallSortOption[] = [
    { field: BallSortField.BALL_NAME, direction: SortDirection.ASC, label: 'Name (A-Z)' },
    { field: BallSortField.BALL_NAME, direction: SortDirection.DESC, label: 'Name (Z-A)' },
    { field: BallSortField.BRAND_NAME, direction: SortDirection.ASC, label: 'Brand (A-Z)' },
    { field: BallSortField.BRAND_NAME, direction: SortDirection.DESC, label: 'Brand (Z-A)' },
    { field: BallSortField.RELEASE_DATE, direction: SortDirection.DESC, label: 'Newest First' },
    { field: BallSortField.RELEASE_DATE, direction: SortDirection.ASC, label: 'Oldest First' },
    { field: BallSortField.CORE_RG, direction: SortDirection.ASC, label: 'RG (Low to High)' },
    { field: BallSortField.CORE_RG, direction: SortDirection.DESC, label: 'RG (High to Low)' },
    { field: BallSortField.CORE_DIFF, direction: SortDirection.ASC, label: 'Diff (Low to High)' },
    { field: BallSortField.CORE_DIFF, direction: SortDirection.DESC, label: 'Diff (High to Low)' },
    { field: BallSortField.CORE_TYPE, direction: SortDirection.ASC, label: 'Core Type (A-Z)' },
    { field: BallSortField.CORE_TYPE, direction: SortDirection.DESC, label: 'Core Type (Z-A)' },
    { field: BallSortField.COVERSTOCK_TYPE, direction: SortDirection.ASC, label: 'Coverstock (A-Z)' },
    { field: BallSortField.COVERSTOCK_TYPE, direction: SortDirection.DESC, label: 'Coverstock (Z-A)' },
  ];

  sortBalls(balls: Ball[], sortOption: BallSortOption, favoritesFirst = false): Ball[] {
    if (favoritesFirst) {
      const favoriteBalls = this.favoritesService.getFavoriteBalls();
      const favoriteKeys = new Set(favoriteBalls.map((b) => `${b.ball_id}-${b.core_weight}`));

      const nonFavoriteBalls = balls.filter((b) => !favoriteKeys.has(`${b.ball_id}-${b.core_weight}`));

      const sortedFavorites = this.applySortToBalls([...favoriteBalls], sortOption);
      const sortedNonFavorites = this.applySortToBalls([...nonFavoriteBalls], sortOption);

      return [...sortedFavorites, ...sortedNonFavorites];
    }

    return this.applySortToBalls([...balls], sortOption);
  }

  private applySortToBalls(balls: Ball[], sortOption: BallSortOption): Ball[] {
    return balls.sort((a, b) => {
      const { field, direction } = sortOption;

      let aValue: string | number = a[field];
      let bValue: string | number = b[field];

      // Handle numeric fields
      if (field === BallSortField.CORE_RG || field === BallSortField.CORE_DIFF || field === BallSortField.CORE_INT_DIFF) {
        aValue = parseFloat(aValue) || 0;
        bValue = parseFloat(bValue) || 0;
      }
      // Handle date fields
      else if (field === BallSortField.RELEASE_DATE) {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }
      // Handle string fields
      else if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      let comparison = 0;
      if (aValue < bValue) {
        comparison = -1;
      } else if (aValue > bValue) {
        comparison = 1;
      }

      return direction === SortDirection.DESC ? -comparison : comparison;
    });
  }
}
