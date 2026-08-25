import { computed, Injectable, Signal, signal } from '@angular/core';
import { GameFilter, TimeRange } from 'src/app/core/models/filter.model';
import { Game } from 'src/app/core/models/game.model';
import { GamesStore } from 'src/app/core/stores/games.store';

import { UtilsService } from '../../utils/utils.service';
const FIFTY_YEARS_MS = 50 * 365.25 * 24 * 60 * 60 * 1000;

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
    startDate: new Date(Date.now() - FIFTY_YEARS_MS).toISOString(),
    endDate: new Date(Date.now() + FIFTY_YEARS_MS).toISOString(),
  };

  readonly filters = signal<GameFilter>({ ...this.defaultFilters });

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

  readonly filteredGames = computed(() => {
    const games = this.gamesStore.games();
    const filters = this.filters();
    return this.filterGames(games, filters);
  });

  constructor(
    private utilsService: UtilsService,
    private gamesStore: GamesStore,
  ) {
    this.setDefaultFilters();
  }

  filterGames(games: Game[], filters: GameFilter): Game[] {
    const formatDate = (date: string) => date.split('T')[0];
    const startDate = formatDate(filters.startDate ?? new Date(Date.now() - FIFTY_YEARS_MS).toISOString());
    const endDate = formatDate(filters.endDate ?? new Date(Date.now() + FIFTY_YEARS_MS).toISOString());

    const matchesMultiSelect = (selected: string[], gameValues: string[]): boolean => {
      if (selected.includes('all') || selected.length === 0) {
        return true;
      }

      const wantsNone = selected.includes('');
      const specific = selected.filter((value) => value !== '' && value !== 'all');

      const noneMatch = wantsNone && gameValues.length === 0;
      const specificMatch = specific.length > 0 && gameValues.some((value) => specific.includes(value));

      return noneMatch || specificMatch;
    };

    return games.filter((game) => {
      const gameDate = formatDate(new Date(game.date).toISOString());

      return (
        gameDate >= startDate &&
        gameDate <= endDate &&
        game.totalScore >= filters.minScore &&
        game.totalScore <= filters.maxScore &&
        (filters.excludePractice ? !game.isPractice : true) &&
        (!filters.isPerfect || game.isPerfect) &&
        (!filters.isClean || game.isClean) &&
        (filters.leagues.includes('all') || filters.leagues.length === 0 || filters.leagues.includes(game.league || '')) &&
        matchesMultiSelect(filters.patterns, game.patterns ?? []) &&
        matchesMultiSelect(filters.balls, game.balls ?? [])
      );
    });
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
