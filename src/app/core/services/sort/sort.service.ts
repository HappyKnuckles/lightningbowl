import { Injectable, inject } from '@angular/core';
import { Ball } from '../../models/ball.model';
import { Pattern } from '../../models/pattern.model';
import {
  BallSortField,
  PatternSortField,
  SortDirection,
  BallSortOption,
  PatternSortOption,
  GameSortField,
  GameSortOption,
} from '../../models/sort.model';
import { Game } from '../../models/game.model';
import { FavoritesService } from '../favorites/favorites.service';

@Injectable({
  providedIn: 'root',
})
export class SortService {
  private favoritesService = inject(FavoritesService);
  // Default sort options for balls
  readonly BALL_SORT_OPTIONS: BallSortOption[] = [
    { field: BallSortField.BALL_NAME, direction: SortDirection.ASC, label: 'SORT.NAME_AZ' },
    { field: BallSortField.BALL_NAME, direction: SortDirection.DESC, label: 'SORT.NAME_ZA' },
    { field: BallSortField.BRAND_NAME, direction: SortDirection.ASC, label: 'SORT.BRAND_AZ' },
    { field: BallSortField.BRAND_NAME, direction: SortDirection.DESC, label: 'SORT.BRAND_ZA' },
    { field: BallSortField.RELEASE_DATE, direction: SortDirection.DESC, label: 'SORT.NEWEST_FIRST' },
    { field: BallSortField.RELEASE_DATE, direction: SortDirection.ASC, label: 'SORT.OLDEST_FIRST' },
    { field: BallSortField.CORE_RG, direction: SortDirection.ASC, label: 'SORT.RG_LOW_HIGH' },
    { field: BallSortField.CORE_RG, direction: SortDirection.DESC, label: 'SORT.RG_HIGH_LOW' },
    { field: BallSortField.CORE_DIFF, direction: SortDirection.ASC, label: 'SORT.DIFF_LOW_HIGH' },
    { field: BallSortField.CORE_DIFF, direction: SortDirection.DESC, label: 'SORT.DIFF_HIGH_LOW' },
    { field: BallSortField.CORE_TYPE, direction: SortDirection.ASC, label: 'SORT.CORE_TYPE_AZ' },
    { field: BallSortField.CORE_TYPE, direction: SortDirection.DESC, label: 'SORT.CORE_TYPE_ZA' },
    { field: BallSortField.COVERSTOCK_TYPE, direction: SortDirection.ASC, label: 'SORT.COVERSTOCK_AZ' },
    { field: BallSortField.COVERSTOCK_TYPE, direction: SortDirection.DESC, label: 'SORT.COVERSTOCK_ZA' },
  ];

  // Default sort options for patterns
  readonly PATTERN_SORT_OPTIONS: PatternSortOption[] = [
    { field: PatternSortField.TITLE, direction: SortDirection.ASC, label: 'SORT.TITLE_AZ' },
    { field: PatternSortField.TITLE, direction: SortDirection.DESC, label: 'SORT.TITLE_ZA' },
    { field: PatternSortField.CATEGORY, direction: SortDirection.ASC, label: 'SORT.CATEGORY_AZ' },
    { field: PatternSortField.DISTANCE, direction: SortDirection.ASC, label: 'SORT.DISTANCE_LOW_HIGH' },
    { field: PatternSortField.DISTANCE, direction: SortDirection.DESC, label: 'SORT.DISTANCE_HIGH_LOW' },
    { field: PatternSortField.RATIO, direction: SortDirection.ASC, label: 'SORT.RATIO_LOW_HIGH' },
    { field: PatternSortField.RATIO, direction: SortDirection.DESC, label: 'SORT.RATIO_HIGH_LOW' },
    { field: PatternSortField.VOLUME, direction: SortDirection.ASC, label: 'SORT.VOLUME_LOW_HIGH' },
    { field: PatternSortField.VOLUME, direction: SortDirection.DESC, label: 'SORT.VOLUME_HIGH_LOW' },
  ];

  readonly GAME_SORT_OPTIONS: GameSortOption[] = [
    { field: GameSortField.TOTAL_SCORE, direction: SortDirection.ASC, label: 'SORT.SCORE_LOW_HIGH' },
    { field: GameSortField.TOTAL_SCORE, direction: SortDirection.DESC, label: 'SORT.SCORE_HIGH_LOW' },
    { field: GameSortField.DATE, direction: SortDirection.ASC, label: 'SORT.DATE_OLDEST' },
    { field: GameSortField.DATE, direction: SortDirection.DESC, label: 'SORT.DATE_NEWEST' },
    { field: GameSortField.LEAGUE, direction: SortDirection.ASC, label: 'SORT.LEAGUE_AZ' },
    { field: GameSortField.LEAGUE, direction: SortDirection.DESC, label: 'SORT.LEAGUE_ZA' },
    { field: GameSortField.IS_PRACTICE, direction: SortDirection.ASC, label: 'SORT.LEAGUE_FIRST' },
    { field: GameSortField.IS_PRACTICE, direction: SortDirection.DESC, label: 'SORT.PRACTICE_FIRST' },
    { field: GameSortField.IS_CLEAN, direction: SortDirection.ASC, label: 'SORT.NON_CLEAN_FIRST' },
    { field: GameSortField.IS_CLEAN, direction: SortDirection.DESC, label: 'SORT.CLEAN_FIRST' },
    { field: GameSortField.IS_PERFECT, direction: SortDirection.DESC, label: 'SORT.PERFECT_FIRST' },
  ];

  sortGames(games: Game[], sortOption?: GameSortOption): Game[] {
    const option = sortOption;
    const sortedGames = [...games];

    return sortedGames.sort((a, b) => {
      let comparison = 0;

      switch (option!.field) {
        case GameSortField.TOTAL_SCORE:
          comparison = a.totalScore - b.totalScore;
          break;
        case GameSortField.DATE:
          comparison = a.date - b.date;
          break;
        case GameSortField.LEAGUE: {
          const leagueA = a.league || '';
          const leagueB = b.league || '';
          comparison = leagueA.localeCompare(leagueB);
          break;
        }
        case GameSortField.IS_PRACTICE:
          comparison = (a.isPractice ? 1 : 0) - (b.isPractice ? 1 : 0);
          break;
        case GameSortField.IS_CLEAN:
          comparison = (a.isClean ? 1 : 0) - (b.isClean ? 1 : 0);
          break;
        case GameSortField.IS_PERFECT:
          comparison = (a.isPerfect ? 1 : 0) - (b.isPerfect ? 1 : 0);
          break;
        default:
          comparison = 0;
      }

      return option!.direction === SortDirection.DESC ? -comparison : comparison;
    });
  }

  sortBalls(balls: Ball[], sortOption: BallSortOption, favoritesFirst = false, allBalls: Ball[] = []): Ball[] {
    const sortedBalls = [...balls];

    if (favoritesFirst) {
      const favorites = this.favoritesService.favoriteBalls();
      const favoriteBalls: Ball[] = [];
      const nonFavoriteBalls: Ball[] = [];

      // Get favorite balls from allBalls if provided, otherwise from the balls array
      const ballsToSearchForFavorites = allBalls.length > 0 ? allBalls : sortedBalls;

      // Extract all favorite balls from allBalls
      ballsToSearchForFavorites.forEach((ball) => {
        const ballKey = `${ball.ball_id}-${ball.core_weight}`;
        if (favorites.has(ballKey)) {
          favoriteBalls.push(ball);
        }
      });

      // Separate non-favorites from the current balls array
      sortedBalls.forEach((ball) => {
        const ballKey = `${ball.ball_id}-${ball.core_weight}`;
        if (!favorites.has(ballKey)) {
          nonFavoriteBalls.push(ball);
        }
      });

      // Sort both groups using the selected sort option
      const sortedFavorites = this.applySortToBalls(favoriteBalls, sortOption);
      const sortedNonFavorites = this.applySortToBalls(nonFavoriteBalls, sortOption);

      return [...sortedFavorites, ...sortedNonFavorites];
    }

    return this.applySortToBalls(sortedBalls, sortOption);
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
