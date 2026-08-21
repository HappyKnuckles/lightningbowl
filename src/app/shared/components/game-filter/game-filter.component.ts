import { CommonModule } from '@angular/common';
import { Component, computed, CUSTOM_ELEMENTS_SCHEMA, Input, OnInit } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ModalController } from '@ionic/angular';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonDatetime,
  IonDatetimeButton,
  IonFooter,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToggle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronExpandOutline } from 'ionicons/icons';
import { GameFilter, TimeRange } from 'src/app/core/models/filter.model';
import { Game } from 'src/app/core/models/game.model';
import { AnalyticsService } from 'src/app/core/services/analytics/analytics.service';
import { GameFilterService } from 'src/app/core/services/game-filter/game-filter.service';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { GamesStore } from 'src/app/core/stores/games.store';
import { sortGamesByLeagues } from 'src/app/core/utils/sort-utils/sort.utils';
import { UtilsService } from 'src/app/core/utils/utils.service';
import { alertEnterAnimation, alertLeaveAnimation } from '../../animations/alert.animation';
import { BallSelectComponent } from '../ball-select/ball-select.component';

@Component({
  selector: 'app-game-filter',
  templateUrl: './game-filter.component.html',
  styleUrls: ['./game-filter.component.scss'],
  imports: [
    IonList,
    IonFooter,
    IonToggle,
    IonModal,
    IonDatetime,
    IonDatetimeButton,
    IonLabel,
    IonInput,
    IonButton,
    IonItem,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonButtons,
    IonSelect,
    FormsModule,
    ReactiveFormsModule,
    CommonModule,
    IonSelectOption,
    BallSelectComponent,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class GameFilterComponent implements OnInit {
  @Input() filteredGames!: Game[];
  defaultFilters = this.gameFilterService.defaultFilters;
  highlightedDates: { date: string; textColor: string; backgroundColor: string }[] = [];
  leagues: string[] = [];
  patterns = computed<string[]>(() => {
    return this.gamesStore
      .games()
      .map((game) => game.patterns)
      .flat()
      .filter((pattern, index, self) => pattern && self.indexOf(pattern) === index);
  });
  alleys = computed<string[]>(() => {
    const names = this.gamesStore
      .games()
      .map((game) => game.alley)
      .filter((alley): alley is string => !!alley);
    return [...new Set(names)].sort((a, b) => a.localeCompare(b));
  });
  enterAnimation = alertEnterAnimation;
  leaveAnimation = alertLeaveAnimation;

  constructor(
    private modalCtrl: ModalController,
    public gameFilterService: GameFilterService,
    public gamesStore: GamesStore,
    public ballsStore: BallsStore,
    private utilsService: UtilsService,
    private analyticsService: AnalyticsService,
  ) {
    addIcons({ chevronExpandOutline });
  }

  ngOnInit(): void {
    if (!this.gameFilterService.filters().startDate && !this.gameFilterService.filters().endDate) {
      this.gameFilterService.filters.update((filters) => ({
        ...filters,
        startDate: new Date(this.gamesStore.games()[this.gamesStore.games().length - 1].date).toISOString() || Date.now().toString(),
        endDate: new Date(this.gamesStore.games()[0].date).toISOString() || Date.now().toString(),
      }));
    }
    this.getHighlightedDates();
    this.getLeagues();
  }

  getSelectedBallsText(): string {
    const balls = this.gameFilterService.filters().balls || [];
    if (balls.length === 1 && balls[0] === 'all') {
      return 'All';
    }
    return balls.length > 0 ? balls.join(', ') : 'All';
  }

  startDateChange(event: CustomEvent): void {
    const now = new Date(Date.now());
    let newStartDate: string;
    switch (event.detail.value) {
      case TimeRange.TODAY:
        newStartDate = new Date(now.setHours(0, 0, 0, 0)).toISOString();
        break;
      case TimeRange.WEEK:
        newStartDate = new Date(now.setDate(now.getDate() - 7)).toISOString();
        break;
      case TimeRange.MONTH:
        newStartDate = new Date(now.setMonth(now.getMonth() - 1)).toISOString();
        break;
      case TimeRange.QUARTER:
        newStartDate = new Date(now.setMonth(now.getMonth() - 3)).toISOString();
        break;
      case TimeRange.HALF:
        newStartDate = new Date(now.setMonth(now.getMonth() - 6)).toISOString();
        break;
      case TimeRange.YEAR:
        newStartDate = new Date(now.setFullYear(now.getFullYear() - 1)).toISOString();
        break;
      case TimeRange.ALL:
      default:
        newStartDate = this.defaultFilters.startDate!;
        break;
    }
    this.gameFilterService.filters.update((filters) => ({ ...filters, startDate: newStartDate, timeRange: event.detail.value }));
  }

  cancel(): Promise<boolean> {
    this.gameFilterService.filters.update(() =>
      localStorage.getItem('game-filter') ? JSON.parse(localStorage.getItem('game-filter')!) : this.gameFilterService.filters(),
    );
    return this.modalCtrl.dismiss(null, 'cancel');
  }

  updateFilter<T extends keyof GameFilter>(key: T, value: GameFilter[T]): void {
    const normalized = Array.isArray(value) && value.length === 0 ? (['all'] as GameFilter[T]) : value;
    this.gameFilterService.filters.update((filters) => ({ ...filters, [key]: normalized }));
  }

  updateNumericFilter<T extends keyof GameFilter>(key: T, raw: string | undefined | null): void {
    if (!raw?.trim()) {
      this.updateFilter(key, this.defaultFilters[key]);
      return;
    }
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) return;
    this.updateFilter(key, parsed as GameFilter[T]);
  }

  updateDateFilter(key: 'startDate' | 'endDate', value: string | string[] | null | undefined): void {
    const date = Array.isArray(value) ? value[0] : value;
    this.updateFilter(key, date ?? undefined);
  }

  reset(): void {
    this.gameFilterService.resetFilters();
  }

  confirm(): Promise<boolean> {
    const activeFilters = this.gameFilterService.activeFilterCount();
    const filters = this.gameFilterService.filters();

    this.gameFilterService.filters.update((filters) => ({ ...filters }));
    this.gameFilterService.saveFilters();
    // this.filterService.filterGames(this.gamesStore.games());
    this.getHighlightedDates();

    if (activeFilters > 0) {
      void this.analyticsService.trackGameFilterApplied({
        active_filter_count: activeFilters,
        has_leagues: filters.leagues.length > 0,
        has_balls: filters.balls.length > 0,
        has_patterns: filters.patterns.length > 0,
        has_alleys: filters.alleys.length > 0,
        has_date_range: !!filters.startDate || !!filters.endDate,
        has_score_range: filters.minScore > 0 || filters.maxScore < 300,
        exclude_practice: filters.excludePractice,
        is_clean_only: filters.isClean,
        is_perfect_only: filters.isPerfect,
        time_range: filters.timeRange,
      });
    }

    return this.modalCtrl.dismiss('confirm');
  }

  private getLeagues(): void {
    const gamesByLeague = sortGamesByLeagues(this.gamesStore.games(), false);
    this.leagues = Object.keys(gamesByLeague);
  }

  private getHighlightedDates(): void {
    const textColor = '#000000';
    const rootStyles = getComputedStyle(document.documentElement);
    const backgroundColor = rootStyles.getPropertyValue('--ion-color-primary').trim();
    this.highlightedDates = this.gamesStore.games().map((game) => {
      const date = new Date(game.date);
      const formattedDate = this.utilsService.transformDate(date);
      return {
        date: formattedDate,
        textColor: textColor,
        backgroundColor: backgroundColor,
      };
    });
  }
}
