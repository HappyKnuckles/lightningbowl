import { CommonModule } from '@angular/common';
import { Component, computed, CUSTOM_ELEMENTS_SCHEMA, Input, OnInit } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ModalController } from '@ionic/angular';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonButtons,
  IonToolbar,
  IonItem,
  IonButton,
  IonLabel,
  IonToggle,
  IonFooter,
  IonSelectOption,
  IonSelect,
  IonList,
  IonInput,
  IonModal,
} from '@ionic/angular/standalone';
import { GameFilter } from 'src/app/core/models/filter.model';
import { Game } from 'src/app/core/models/game.model';
import { GameFilterService } from 'src/app/core/services/game-filter/game-filter.service';
import { SortUtilsService } from 'src/app/core/services/sort-utils/sort-utils.service';
import { StorageService } from 'src/app/core/services/storage/storage.service';
import { AnalyticsService } from 'src/app/core/services/analytics/analytics.service';
import { alertEnterAnimation, alertLeaveAnimation } from '../../animations/alert.animation';
import { addIcons } from 'ionicons';
import { chevronExpandOutline } from 'ionicons/icons';
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
    IonInput,
    IonLabel,
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
  leagues: string[] = [];
  patterns = computed<string[]>(() => {
    return this.storageService
      .games()
      .map((game) => game.patterns)
      .flat()
      .filter((pattern, index, self) => pattern && self.indexOf(pattern) === index);
  });
  enterAnimation = alertEnterAnimation;
  leaveAnimation = alertLeaveAnimation;

  constructor(
    private modalCtrl: ModalController,
    public gameFilterService: GameFilterService,
    private sortUtilsService: SortUtilsService,
    public storageService: StorageService,
    private analyticsService: AnalyticsService,
  ) {
    addIcons({ chevronExpandOutline });
  }

  ngOnInit(): void {
    this.getLeagues();
  }

  getSelectedBallsText(): string {
    const balls = this.gameFilterService.filters().balls || [];
    if (balls.length === 1 && balls[0] === 'all') {
      return 'All';
    }
    return balls.length > 0 ? balls.join(', ') : 'All';
  }

  handleSelect(event: CustomEvent): void {
    if (event.detail.value.includes('all')) {
      this.gameFilterService.filters.update((filters) => ({ ...filters, leagues: ['all'] }));
    }
  }

  cancel(): Promise<boolean> {
    this.gameFilterService.filters.update(() =>
      localStorage.getItem('game-filter') ? JSON.parse(localStorage.getItem('game-filter')!) : this.gameFilterService.filters(),
    );
    return this.modalCtrl.dismiss(null, 'cancel');
  }

  handleBallSelect(balls: string[], modal: IonModal) {
    modal.dismiss();
    const filteredBalls = balls.filter((ball) => ball !== 'all');
    this.gameFilterService.filters().balls = filteredBalls;
    this.updateFilter('balls', filteredBalls);
  }

  updateFilter<T extends keyof GameFilter>(key: T, value: unknown): void {
    this.gameFilterService.filters.update((filters) => ({ ...filters, [key]: value }));
  }

  reset(): void {
    this.gameFilterService.resetFilters();
  }

  confirm(): Promise<boolean> {
    const activeFilters = this.gameFilterService.activeFilterCount();
    const filters = this.gameFilterService.filters();

    this.gameFilterService.filters.update((filters) => ({ ...filters }));
    this.gameFilterService.saveFilters();

    if (activeFilters > 0) {
      void this.analyticsService.trackGameFilterApplied({
        active_filter_count: activeFilters,
        has_leagues: filters.leagues.length > 0,
        has_balls: filters.balls.length > 0,
        has_patterns: filters.patterns.length > 0,
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
    const gamesByLeague = this.sortUtilsService.sortGamesByLeagues(this.storageService.games(), false);
    this.leagues = Object.keys(gamesByLeague);
  }
}
