import { computed, inject, Injectable, Signal, signal } from '@angular/core';
import { Ball } from 'src/app/core/models/ball.model';
import { BallFilter, CoreType, CoverstockType, Market } from 'src/app/core/models/filter.model';
import { BallSortField, SortDirection } from 'src/app/core/models/sort.model';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { buildBallQueryParams } from 'src/app/core/utils/ball-query/ball-query.utils';
import { BallService } from '../ball/ball.service';
import { NetworkService } from '../network/network.service';
import { UtilsService } from '../../utils/utils.service';

@Injectable({
  providedIn: 'root',
})
export class BallFilterService {
  defaultFilters: BallFilter = {
    brands: [],
    coverstocks: [],
    coverstockTypes: [],
    cores: [],
    market: Market.ALL,
    coreType: CoreType.ALL,
    availability: false,
    releaseDate: 'all',
    weight: '15',
    minRg: 0,
    maxRg: 3,
    minDiff: 0,
    maxDiff: 0.1,
    inArsenal: false,
  };
  activeFilterCount: Signal<number> = computed(() => {
    return Object.keys(this.filters()).reduce((count, key) => {
      const filterValue = this.filters()[key as keyof BallFilter];
      const defaultValue = this.defaultFilters[key as keyof BallFilter];
      if (key === 'startDate' || key === 'endDate') {
        if (!this.utilsService.areDatesEqual(filterValue as string, defaultValue as string)) {
          return count + 1;
        }
      } else if (Array.isArray(filterValue) && Array.isArray(defaultValue)) {
        if (!this.utilsService.areArraysEqual(filterValue, defaultValue)) {
          return count + 1;
        }
      } else if (filterValue !== defaultValue) {
        return count + 1;
      }
      return count;
    }, 0);
  });

  readonly filters = signal<BallFilter>(this.loadInitialFilters());

  /** Offline only: filters the known balls (online, the ball API filters). */
  readonly filteredBalls = computed(() => {
    const balls = this.ballsStore.knownBalls();
    const filters = this.filters();
    return this.filterBalls(balls, filters);
  });

  readonly #ballService = inject(BallService);
  readonly #networkService = inject(NetworkService);

  constructor(
    private utilsService: UtilsService,
    private ballsStore: BallsStore,
  ) {}

  /**
   * How many balls match the filters: the whole catalog via the ball API when
   * online (one-ball page, only `totalElements` is used), the known balls
   * offline or when the request fails.
   */
  async countMatches(filters: BallFilter): Promise<number> {
    if (this.#networkService.isOnline) {
      try {
        const params = buildBallQueryParams({
          filters,
          defaultFilters: this.defaultFilters,
          favorites: [],
          search: '',
          // The order doesn't change the count; relevance sends no sort.
          sort: { field: BallSortField.RELEVANCE, direction: SortDirection.DESC, label: '' },
          arsenalIds: this.ballsStore.arsenal().map((ball) => ball.ball_id),
          page: 0,
          size: 1,
        });
        const page = await this.#ballService.searchBalls(params);
        return page.page.totalElements;
      } catch (error) {
        console.error('Error counting balls:', error);
      }
    }
    return this.filterBalls(this.ballsStore.knownBalls(), filters).length;
  }

  saveFilters(): void {
    localStorage.setItem('ball-filter', JSON.stringify(this.filters()));
  }

  resetFilters(): void {
    this.filters.update(() => ({ ...this.defaultFilters }));
  }

  filterBalls(balls: Ball[], filters: BallFilter): Ball[] {
    const filteredBalls = balls.filter((ball) => {
      return (
        (!filters.weight || ball.core_weight === filters.weight) &&
        (filters.brands.length === 0 || filters.brands.includes(ball.brand_name ?? '')) &&
        (filters.cores.length === 0 || filters.cores.includes(ball.core_name ?? '')) &&
        (filters.coverstocks.length === 0 || filters.coverstocks.includes(ball.coverstock_name ?? '')) &&
        (filters.coverstockTypes.length === 0 || filters.coverstockTypes.includes(ball.coverstock_type as CoverstockType)) &&
        (filters.market === Market.ALL || filters.market === ball.us_int) &&
        (filters.coreType === CoreType.ALL || filters.coreType === ball.core_type) &&
        (!filters.availability || ball.availability === 'Available') &&
        (filters.releaseDate === 'all' || filters.releaseDate === ball.release_date) &&
        // Missing specs become NaN and fail the range checks, as before.
        filters.minRg <= (ball.core_rg ?? NaN) &&
        filters.maxRg >= (ball.core_rg ?? NaN) &&
        filters.minDiff <= (ball.core_diff ?? NaN) &&
        filters.maxDiff >= (ball.core_diff ?? NaN) &&
        (!filters.inArsenal || this.ballsStore.arsenal().some((arsenalBall) => arsenalBall.ball_id === ball.ball_id))
      );
    });
    return filteredBalls;
  }

  loadInitialFilters(): BallFilter {
    const storedFilter = localStorage.getItem('ball-filter');
    return storedFilter ? JSON.parse(storedFilter) : { ...this.defaultFilters };
  }
}
