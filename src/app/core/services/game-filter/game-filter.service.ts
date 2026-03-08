import { computed, Injectable, Signal, signal } from '@angular/core';
import { GameFilter, TimeRange } from 'src/app/core/models/filter.model';
import { Game } from 'src/app/core/models/game.model';
import { UtilsService } from '../utils/utils.service';
import { StorageService } from '../storage/storage.service';

export type CalendarMode = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'overall';

export interface CalendarDateRange {
  start: Date;
  end: Date;
  label: string;
  mode: CalendarMode;
}

const MS_PER_DAY = 86_400_000;
const MS_PER_WEEK = MS_PER_DAY * 7;

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

  // Calendar navigation state
  calendarMode = signal<CalendarMode>('monthly');
  calendarOffset = signal<number>(0);

  calendarDateRange = computed<CalendarDateRange>(() => {
    return this.calculateCalendarDateRange(this.calendarMode(), this.calendarOffset());
  });

  calendarLabel = computed(() => this.calendarDateRange().label);

  calendarModeIcon = computed<string>(() => {
    switch (this.calendarMode()) {
      case 'daily':
        return 'today-outline';
      case 'weekly':
        return 'calendar-clear-outline';
      case 'monthly':
        return 'calendar-outline';
      case 'yearly':
        return 'calendar-number-outline';
      case 'overall':
        return 'infinite-outline';
    }
  });

  /** True when there are games before the current period (prev button enabled). */
  hasPrevPeriod = computed<boolean>(() => {
    if (this.calendarMode() === 'overall') return false;
    const range = this.calendarDateRange();
    return this.storageService.games().some((g) => new Date(g.date) < range.start);
  });

  /** True when we are not yet at the current period (next button enabled). */
  hasNextPeriod = computed<boolean>(() => {
    if (this.calendarMode() === 'overall') return false;
    return this.calendarOffset() < 0;
  });

  nextPeriod(): void {
    if (this.calendarMode() === 'overall' || this.calendarOffset() >= 0) return;
    const games = this.storageService.games();
    const currentRange = this.calendarDateRange();
    const now = new Date();

    // Find the oldest game that falls AFTER the current period end (up to now)
    const laterGames = games
      .map((g) => new Date(g.date))
      .filter((d) => d > currentRange.end && d <= now)
      .sort((a, b) => a.getTime() - b.getTime());

    if (laterGames.length > 0) {
      this.goToPeriodContaining(laterGames[0]);
    } else {
      // No later games – jump to current period
      this.calendarOffset.set(0);
    }
  }

  prevPeriod(): void {
    if (this.calendarMode() === 'overall') return;
    const games = this.storageService.games();
    const currentRange = this.calendarDateRange();

    // Find the most recent game that falls BEFORE the current period start
    const earlierGames = games
      .map((g) => new Date(g.date))
      .filter((d) => d < currentRange.start)
      .sort((a, b) => b.getTime() - a.getTime());

    if (earlierGames.length > 0) {
      this.goToPeriodContaining(earlierGames[0]);
    }
    // If no earlier games, button is disabled so nothing happens
  }

  setCalendarMode(mode: CalendarMode): void {
    this.calendarMode.set(mode);
    this.calendarOffset.set(0);
  }

  /** Navigate to the period that contains the given date (capped at current period). */
  goToPeriodContaining(date: Date): void {
    const now = new Date();
    const mode = this.calendarMode();
    let offset = 0;

    switch (mode) {
      case 'daily': {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        offset = Math.round((target.getTime() - today.getTime()) / MS_PER_DAY);
        break;
      }
      case 'weekly': {
        const todaySunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
        const targetSunday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay());
        offset = Math.round((targetSunday.getTime() - todaySunday.getTime()) / MS_PER_WEEK);
        break;
      }
      case 'monthly': {
        offset = (date.getFullYear() - now.getFullYear()) * 12 + (date.getMonth() - now.getMonth());
        break;
      }
      case 'yearly': {
        offset = date.getFullYear() - now.getFullYear();
        break;
      }
      default:
        return;
    }

    this.calendarOffset.set(Math.min(offset, 0));
  }

  activeFilterCount: Signal<number> = computed(() => {
    return Object.keys(this.filters()).reduce((count, key) => {
      // Date range is handled by calendar navigation, not counted as an active filter
      if (key === 'startDate' || key === 'endDate' || key === 'timeRange') {
        return count;
      }
      const filterValue = this.filters()[key as keyof GameFilter];
      const defaultValue = this.defaultFilters[key as keyof GameFilter];
      if (Array.isArray(filterValue) && Array.isArray(defaultValue)) {
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
    const calRange = this.calendarMode() === 'overall' ? null : this.calendarDateRange();
    return this.filterGames(games, filters, calRange);
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

  filterGames(games: Game[], filters: GameFilter, calendarRange?: CalendarDateRange | null): Game[] {
    return games.filter((game) => {
      // Apply calendar date range filter when provided
      if (calendarRange) {
        const gameDate = new Date(game.date);
        if (gameDate < calendarRange.start || gameDate > calendarRange.end) {
          return false;
        }
      }

      return (
        game.totalScore >= filters.minScore &&
        game.totalScore <= filters.maxScore &&
        (filters.excludePractice ? !game.isPractice : true) &&
        (!filters.isPerfect || game.isPerfect) &&
        (!filters.isClean || game.isClean) &&
        (filters.leagues.includes('all') || filters.leagues.length === 0 || filters.leagues.includes(game.league || '')) &&
        (filters.patterns.includes('all') || filters.patterns.length === 0 || game.patterns!.some((pattern) => filters.patterns.includes(pattern))) &&
        (filters.balls.includes('all') || filters.balls.length === 0 || game.balls!.some((ball) => filters.balls.includes(ball)))
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
    this.filters.set(this.loadInitialFilters());
  }

  private calculateCalendarDateRange(mode: CalendarMode, offset: number): CalendarDateRange {
    const now = new Date();

    switch (mode) {
      case 'daily': {
        const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
        const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0);
        const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
        const label = day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        return { start, end, label, mode };
      }
      case 'weekly': {
        const cur = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dayOfWeek = cur.getDay();
        const weekStart = new Date(cur);
        weekStart.setDate(cur.getDate() - dayOfWeek + offset * 7);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        const start = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate(), 0, 0, 0, 0);
        const end = new Date(weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate(), 23, 59, 59, 999);
        const label = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        return { start, end, label, mode };
      }
      case 'monthly': {
        const year = now.getFullYear();
        const month = now.getMonth() + offset;
        const firstDay = new Date(year, month, 1, 0, 0, 0, 0);
        const lastDay = new Date(year, month + 1, 0, 23, 59, 59, 999);
        const label = firstDay.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        return { start: firstDay, end: lastDay, label, mode };
      }
      case 'yearly': {
        const year = now.getFullYear() + offset;
        const start = new Date(year, 0, 1, 0, 0, 0, 0);
        const end = new Date(year, 11, 31, 23, 59, 59, 999);
        return { start, end, label: year.toString(), mode };
      }
      case 'overall':
      default: {
        const start = new Date(0);
        const end = new Date(9999, 11, 31);
        return { start, end, label: 'All Time', mode: 'overall' };
      }
    }
  }

  private loadInitialFilters(): GameFilter {
    localStorage.removeItem('filter');
    const storedFilter = localStorage.getItem('game-filter');
    return storedFilter ? JSON.parse(storedFilter) : { ...this.defaultFilters };
  }
}
