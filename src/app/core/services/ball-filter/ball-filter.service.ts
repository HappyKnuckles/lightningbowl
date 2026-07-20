import { computed, Injectable, Signal, signal } from '@angular/core';
import { Ball } from 'src/app/core/models/ball.model';
import { BallFilter, CoreType, CoverstockType, Market } from 'src/app/core/models/filter.model';
import { BallsStore } from 'src/app/core/stores/balls.store';
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

  readonly filteredBalls = computed(() => {
    const balls = this.ballsStore.allBalls();
    const filters = this.filters();
    return this.filterBalls(balls, filters);
  });

  constructor(
    private utilsService: UtilsService,
    private ballsStore: BallsStore,
  ) {}

  saveFilters(): void {
    localStorage.setItem('ball-filter', JSON.stringify(this.filters()));
  }

  resetFilters(): void {
    this.filters.update(() => ({ ...this.defaultFilters }));
  }

  filterBalls(balls: Ball[], filters: BallFilter): Ball[] {
    const filteredBalls = balls.filter((ball) => {
      return (
        (filters.brands.length === 0 || filters.brands.includes(ball.brand_name)) &&
        (filters.cores.length === 0 || filters.cores.includes(ball.core_name)) &&
        (filters.coverstocks.length === 0 || filters.coverstocks.includes(ball.ball_name)) &&
        (filters.coverstockTypes.length === 0 || filters.coverstockTypes.includes(ball.coverstock_type as CoverstockType)) &&
        (filters.market === Market.ALL || filters.market === ball.us_int) &&
        (filters.coreType === CoreType.ALL || filters.coreType === ball.core_type) &&
        (!filters.availability || ball.availability === 'Available') &&
        (filters.releaseDate === 'all' || filters.releaseDate === ball.release_date) &&
        filters.minRg <= parseFloat(ball.core_rg) &&
        filters.maxRg >= parseFloat(ball.core_rg) &&
        filters.minDiff <= parseFloat(ball.core_diff) &&
        filters.maxDiff >= parseFloat(ball.core_diff) &&
        (!filters.inArsenal || this.ballsStore.activeArsenal().some((arsenalBall) => arsenalBall.ball_id === ball.ball_id))
      );
    });
    return filteredBalls;
  }

  loadInitialFilters(): BallFilter {
    const storedFilter = localStorage.getItem('ball-filter');
    return storedFilter ? JSON.parse(storedFilter) : { ...this.defaultFilters };
  }
}
