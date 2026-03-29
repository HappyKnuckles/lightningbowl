import { computed, Injectable, Signal, signal } from '@angular/core';
import { GameFilter, TimeRange } from 'src/app/core/models/filter.model';
import { Game, getGameBalls } from 'src/app/core/models/game.model';
import { UtilsService } from '../utils/utils.service';
import { StorageService } from '../storage/storage.service';

@Injectable({
  providedIn: 'root',
})
export class GameFilterService {
  defaultFilters: GameFilter = {
    excludePractice: false,
    minScore: 0,
    maxScore: 300,
    isClean: false,
    isPerfect: false,
    leagues: ['all'],
    balls: ['all'],
    patterns: ['all'],
    timeRange: TimeRange.ALL,
    startDate: '',
    endDate: '',
  };

  activeFilterCount: Signal<number> = computed(() => {
    return Object.keys(this.filters()).reduce((count, key) => {
      const filterValue = this.filters()[key as keyof GameFilter];
      const defaultValue = this.defaultFilters[key as keyof GameFilter];
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

  #filteredGames = computed(() => {
    const games = this.storageService.games();
    const filters = this.filters();
    return this.filterGames(games, filters);
  });
  get filteredGames() {
    return this.#filteredGames;
  }

  #filters = signal<GameFilter>({ ...this.defaultFilters });
  get filters() {
    return this.#filters;
  }

  constructor(
    private utilsService: UtilsService,
    private storageService: StorageService,
  ) {
    this.setDefaultFilters();
  }

  filterGames(games: Game[], filters: GameFilter): Game[] {
    const filteredGames = games.filter((game) => {
      const formatDate = (date: string) => date.split('T')[0];
      const gameDate = formatDate(new Date(game.date).toISOString());
      const startDate = formatDate(filters.startDate!);
      const endDate = formatDate(filters.endDate!);

      return (
        gameDate >= startDate &&
        gameDate <= endDate &&
        game.totalScore >= filters.minScore &&
        game.totalScore <= filters.maxScore &&
        (filters.excludePractice ? !game.isPractice : true) &&
        (!filters.isPerfect || game.isPerfect) &&
        (!filters.isClean || game.isClean) &&
        (filters.leagues.includes('all') || filters.leagues.length === 0 || filters.leagues.includes(game.league || '')) &&
        (filters.patterns.includes('all') || filters.patterns.length === 0 || game.patterns!.some((pattern) => filters.patterns.includes(pattern))) &&
        (filters.balls.includes('all') || filters.balls.length === 0 || getGameBalls(game).some((ball) => filters.balls.includes(ball)))
      );
    });
    return filteredGames;
  }

  saveFilters(): void {
    localStorage.setItem('game-filter', JSON.stringify(this.filters()));
  }

  resetFilters(): void {
    this.filters.update(() => ({ ...this.defaultFilters }));
  }

  setDefaultFilters(): void {
    const startDate = localStorage.getItem('first-game');
    const defaultStartDate = startDate ? new Date(parseInt(startDate)).toISOString() : new Date(0).toISOString();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 7);

    this.defaultFilters = {
      ...this.defaultFilters,
      startDate: defaultStartDate,
      endDate: endDate.toISOString(),
    };

    this.filters.set(this.loadInitialFilters());
  }

  private loadInitialFilters(): GameFilter {
    localStorage.removeItem('filter');
    const storedFilter = localStorage.getItem('game-filter');
    return storedFilter ? JSON.parse(storedFilter) : { ...this.defaultFilters };
  }
}
