import { animate, state, style, transition, trigger } from '@angular/animations';
import { DatePipe, DecimalPipe, NgFor, NgIf } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  effect,
  ElementRef,
  OnInit,
  Signal,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ImpactStyle } from '@capacitor/haptics';
import { ModalController, RefresherCustomEvent, SegmentCustomEvent } from '@ionic/angular';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonLabel,
  IonMenuButton,
  IonRefresher,
  IonSegment,
  IonSegmentButton,
  IonSegmentContent,
  IonSegmentView,
  IonSelect,
  IonSelectOption,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import Chart from 'chart.js/auto';
import { addIcons } from 'ionicons';
import { calendarNumber, calendarNumberOutline, filterOutline } from 'ionicons/icons';
import { TOAST_MESSAGES } from 'src/app/core/constants/toast-messages.constants';
import { ChartGenerationService } from 'src/app/core/services/chart/chart-generation.service';
import { GameFilterService } from 'src/app/core/services/game-filter/game-filter.service';
import { GameStatsService } from 'src/app/core/services/game-stats/game-stats.service';
import { HapticService } from 'src/app/core/services/haptic/haptic.service';
import { LoadingService } from 'src/app/core/services/loader/loading.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { GamesStore } from 'src/app/core/stores/games.store';
import { UtilsService } from 'src/app/core/utils/utils.service';
import { GameFilterComponent } from 'src/app/shared/components/game-filter/game-filter.component';
import { GenericFilterActiveComponent } from 'src/app/shared/components/generic-filter-active/generic-filter-active.component';
import { StatDisplayComponent } from 'src/app/shared/components/stat-display/stat-display.component';

import { GAME_FILTER_CONFIGS } from 'src/app/core/configs/filter/game-filter.config';
import {
  OVERALL_STAT_DEFINITIONS,
  PIN_STAT_DEFINITIONS,
  PLAY_FREQUENCY_STAT_DEFINITIONS,
  SERIES_STAT_DEFINITIONS,
  SESSION_STAT_DEFINITIONS,
  SPARE_STAT_DEFINITIONS,
  SPECIAL_STAT_DEFINITIONS,
  STRIKE_STAT_DEFINITIONS,
  THROW_STAT_DEFINITIONS,
} from 'src/app/core/configs/stat-definitions/stat-definitions';
import { Stats } from 'src/app/core/models/stats.model';
import { byAvg, byGameCount, sortGameHistoryByDate } from 'src/app/core/utils/sort-utils/sort.utils';
import { buildHighlights, pickTopFromList } from 'src/app/core/utils/stat-utils/stat.utils';
import { StatHighlightItemComponent } from 'src/app/shared/components/stat-highlight-item/stat-highlight-item.component';
import { StatPinLeaveComponent } from 'src/app/shared/components/stat-pin-leave/stat-pin-leave.component';
import { StatSpareComponent } from 'src/app/shared/components/stat-spare/stat-spare.component';
import { environment } from 'src/environments/environment';
import { BowlingRefresherComponent } from '../../shared/components/bowling-refresher/bowling-refresher.component';

@Component({
  selector: 'app-stats',
  templateUrl: 'stats.page.html',
  styleUrls: ['stats.page.scss'],
  providers: [DecimalPipe, DatePipe, ModalController],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  animations: [
    trigger('toolbarFade', [
      state(
        'hidden',
        style({
          height: '0px',
          minHeight: '0px',
          opacity: 0,
          overflow: 'hidden',
          paddingTop: '0px',
          paddingBottom: '0px',
          transform: 'translateY(-10px)',
          visibility: 'hidden',
        }),
      ),
      state(
        'visible',
        style({
          height: '*',
          opacity: 1,
          transform: 'translateY(0)',
          visibility: 'visible',
        }),
      ),
      transition('hidden => visible', [style({ visibility: 'visible' }), animate('300ms 100ms ease-out')]),
      transition('visible => hidden', [animate('300ms ease-in')]),
    ]),
  ],
  imports: [
    IonButtons,
    IonButton,
    IonIcon,
    IonMenuButton,
    IonLabel,
    IonSegmentButton,
    IonSegment,
    IonSegmentContent,
    IonSegmentView,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonRefresher,
    IonSelectOption,
    IonSelect,
    IonText,
    NgIf,
    NgFor,
    FormsModule,
    DatePipe,
    DecimalPipe,
    StatDisplayComponent,
    StatPinLeaveComponent,
    GenericFilterActiveComponent,
    StatSpareComponent,
    BowlingRefresherComponent,
    StatHighlightItemComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatsPage implements OnInit {
  readonly content = viewChild.required<IonContent>(IonContent);
  isRefreshing = signal(false);
  OVERALL_STAT_DEFINITIONS = OVERALL_STAT_DEFINITIONS;
  SERIES_STAT_DEFINITIONS = SERIES_STAT_DEFINITIONS;
  THROW_STAT_DEFINITIONS = THROW_STAT_DEFINITIONS;
  SESSION_STAT_DEFINITIONS = SESSION_STAT_DEFINITIONS;
  PLAY_FREQUENCY_STAT_DEFINITIONS = PLAY_FREQUENCY_STAT_DEFINITIONS;
  SPECIAL_STAT_DEFINITIONS = SPECIAL_STAT_DEFINITIONS;
  STRIKE_STAT_DEFINITIONS = STRIKE_STAT_DEFINITIONS;
  SPARE_STAT_DEFINITIONS = SPARE_STAT_DEFINITIONS;
  PIN_STAT_DEFINITIONS = PIN_STAT_DEFINITIONS;
  imagesUrl = environment.imagesUrl;
  uniqueSortedDates: Signal<number[]> = computed(() => {
    const dateSet = new Set<number>();
    this.gamesStore.games().forEach((game) => {
      const date = new Date(game.date);
      date.setHours(0, 0, 0, 0);
      dateSet.add(date.getTime());
    });

    return Array.from(dateSet).sort((a, b) => b - a);
  });

  _selectedDate = signal<number | null>(null);
  selectedDate = computed(() => {
    return this._selectedDate() !== null ? this._selectedDate()! : this.uniqueSortedDates()[0];
  });

  gamesForSelectedSession = computed(() => {
    const selDate = this.selectedDate();
    const allGames = this.gamesStore.games();

    return allGames.filter((game) => this.utilsService.isSameDay(game.date, selDate));
  });

  sessionStats: Signal<Stats> = computed(() => this.statsService.calculateBowlingStats(this.gamesForSelectedSession()));
  sessionLeaves = computed(() => this.statsService.calculateLeaveAnalytics(this.gamesForSelectedSession()));
  sessionAllBallStats = computed(() => this.statsService.calculateAllBallStats(this.gamesForSelectedSession()));

  sessionBestBallStats = computed(() => pickTopFromList(this.sessionAllBallStats(), byAvg));
  sessionMostPlayedBallStats = computed(() => pickTopFromList(this.sessionAllBallStats(), byGameCount));
  sessionAllPatternStats = computed(() => this.statsService.calculateAllPatternStats(this.gamesForSelectedSession()));
  sessionBestPatternStats = computed(() => pickTopFromList(this.sessionAllPatternStats(), byAvg));
  sessionMostPlayedPatternStats = computed(() => pickTopFromList(this.sessionAllPatternStats(), byGameCount));
  sessionAllLeaves = computed(() => this.statsService.calculateAllLeaves(this.gamesForSelectedSession()));
  readonly chartGames = computed(() => sortGameHistoryByDate([...this.gameFilterService.filteredGames()], true));

  readonly hasGames = computed(
    () =>
      !(
        (this.gameFilterService.filteredGames().length <= 0 && !this.loadingService.isLoading()) ||
        this.gameFilterService.filteredGames().length <= 0
      ),
  );
  readonly hasFilteredGames = computed(() => this.gameFilterService.filteredGames().length > 0);

  readonly averageVm = computed(() => {
    const stats = this.statsService.currentStats();
    const prev = this.statsService.prevStats();
    const curr = stats.averageScore;
    const prevScore = prev?.averageScore;

    if (prevScore == null || prevScore === 0 || curr === prevScore) {
      return { trend: null as 'up' | 'down' | null, diff: '', diffColor: '' };
    }

    const { delta } = this.utilsService.calculateStatDelta(curr, prevScore);
    if (delta === 0) {
      return { trend: null, diff: '', diffColor: '' };
    }
    return {
      trend: delta > 0 ? 'up' : 'down',
      diff: this.utilsService.formatStatDifference(curr, prevScore),
      diffColor: this.utilsService.getDiffColor(curr, prevScore),
    };
  });

  readonly seriesRows = computed(() => {
    const stats = this.statsService.currentStats();
    return [3, 4, 5, 6].map((n) => ({
      label: `${n}-series`,
      avg: stats[`average${n}SeriesScore`] as number,
      high: stats[`high${n}Series`] as number,
    }));
  });

  readonly accuracyRows = computed(() => {
    const stats = this.statsService.currentStats();
    return [
      { label: 'Strike %', value: stats.strikePercentage, suffix: '%', fill: stats.strikePercentage },
      { label: 'Spare %', value: stats.overallSpareRate, suffix: '%', fill: stats.overallSpareRate },
      { label: 'Mark %', value: stats.markPercentage, suffix: '%', fill: stats.markPercentage },
      { label: 'Open %', value: stats.overallMissedRate, suffix: '%', fill: stats.overallMissedRate },
      { label: 'First ball avg', value: stats.averageFirstCount, suffix: '/10', fill: stats.averageFirstCount * 10 },
    ];
  });

  readonly playFrequencyChips = computed(() => {
    const s = this.statsService.currentStats();
    return [
      { key: 'Games / week', value: s.averageGamesPerWeek },
      { key: 'Games / month', value: s.averageGamesPerMonth },
      { key: 'Games / year', value: s.averageGamesPerYear },
      { key: 'Sessions / wk', value: s.averageSessionsPerWeek },
      { key: 'Sessions / month', value: s.averageSessionsPerMonth },
      { key: 'Games / session', value: s.averageGamesPerSession },
    ];
  });
  readonly overallHighlights = computed(() =>
    buildHighlights({
      mostPlayedBall: this.statsService.mostPlayedBallStats(),
      bestBall: this.statsService.bestBallStats(),
      allBalls: this.statsService.allBallStats(),
      mostPlayedPattern: this.statsService.mostPlayedPatternStats(),
      bestPattern: this.statsService.bestPatternStats(),
      allPatterns: this.statsService.allPatternStats(),
    }),
  );

  readonly sessionHighlights = computed(() =>
    buildHighlights({
      mostPlayedBall: this.sessionMostPlayedBallStats(),
      bestBall: this.sessionBestBallStats(),
      allBalls: this.sessionAllBallStats(),
      mostPlayedPattern: this.sessionMostPlayedPatternStats(),
      bestPattern: this.sessionBestPatternStats(),
      allPatterns: this.sessionAllPatternStats(),
    }),
  );
  chartViewMode: 'week' | 'game' | 'session' | 'monthly' | 'yearly' = 'week';
  averageChartViewMode: 'session' | 'weekly' | 'monthly' | 'yearly' = 'monthly';
  selectedSegment = 'Overall';
  segments: string[] = ['Overall', 'Throws', 'Spares', 'Pins', 'Sessions'];

  // ViewChild signal queries — undefined when the @if block is not rendered
  readonly scoreChart = viewChild<ElementRef>('scoreChart');
  readonly averageScoreChart = viewChild<ElementRef>('averageScoreChart');
  readonly pinChart = viewChild<ElementRef>('pinChart');
  readonly throwChart = viewChild<ElementRef>('throwChart');
  readonly scoreDistributionChart = viewChild<ElementRef>('scoreDistributionChart');
  readonly spareDistributionChart = viewChild<ElementRef>('spareDistributionChart');

  private spareDistributionChartInstance: Chart | null = null;
  private scoreDistributionChartInstance: Chart | null = null;
  private pinChartInstance: Chart | null = null;
  private throwChartInstance: Chart | null = null;
  private scoreChartInstance: Chart | null = null;
  private averageScoreChartInstance: Chart | null = null;

  gameFilterConfigs = GAME_FILTER_CONFIGS;
  readonly currentFilters = this.gameFilterService.filters;
  readonly defaultFilters = this.gameFilterService.defaultFilters;

  constructor(
    public loadingService: LoadingService,
    public statsService: GameStatsService,
    public gamesStore: GamesStore,
    public ballsStore: BallsStore,
    public gameFilterService: GameFilterService,
    private hapticService: HapticService,
    private modalCtrl: ModalController,
    private utilsService: UtilsService,
    private chartService: ChartGenerationService,
    private toastService: ToastService,
  ) {
    addIcons({ filterOutline, calendarNumberOutline, calendarNumber });

    effect(() => {
      if (this.gameFilterService.filteredGames().length > 0) {
        this.generateCharts(true);
      }
    });
  }

  ngOnInit(): void {
    try {
      this.loadingService.setLoading(true);
      // this.processDates();
    } catch (error) {
      console.error(error);
    } finally {
      this.loadingService.setLoading(false);
    }
  }

  async openFilterModal(): Promise<void> {
    // TODO Think if using it like this so highlighted dates are only that match the current filter or not
    const modal = await this.modalCtrl.create({
      component: GameFilterComponent,
      componentProps: {},
    });

    await modal.present();
    /* modal.onDidDismiss().then(() => {
      if (this.gameFilterService.filteredGames().length > 0) {
        this.generateCharts(true);
      }
    });*/
  }

  async handleRefresh(event: RefresherCustomEvent): Promise<void> {
    this.isRefreshing.set(true);
    try {
      this.hapticService.vibrate(ImpactStyle.Medium);
      await this.gamesStore.loadGameHistory();
      this.generateCharts(true);
    } catch (error) {
      console.error(error);
      this.toastService.showToast(TOAST_MESSAGES.gameLoadError, 'bug', true);
    } finally {
      event.target.complete();
      this.isRefreshing.set(false);
    }
  }

  onSegmentChanged(event: SegmentCustomEvent): void {
    this.selectedSegment = event.detail.value?.toString() || 'Overall';
    this.generateCharts();
    setTimeout(() => {
      this.content().scrollToTop(300);
    }, 300);
  }

  private generateCharts(isReload?: boolean): void {
    if (this.gameFilterService.filteredGames().length > 0) {
      if (this.selectedSegment === 'Overall') {
        this.generateScoreChart(isReload);
        this.generateAverageScoreChart(isReload);
        this.generateScoreDistributionChart(isReload);
      } else if (this.selectedSegment === 'Spares') {
        this.generatePinChart(isReload);
        this.generateSpareDistributionChart(isReload);
      } else if (this.selectedSegment === 'Throws') {
        this.generateThrowChart(isReload);
      }
    }
  }

  private toggleChartView(): void {
    if (this.chartViewMode === 'game') {
      this.chartViewMode = 'session';
    } else if (this.chartViewMode === 'session') {
      this.chartViewMode = 'week';
    } else if (this.chartViewMode === 'week') {
      this.chartViewMode = 'monthly';
    } else if (this.chartViewMode === 'monthly') {
      this.chartViewMode = 'yearly';
    } else {
      this.chartViewMode = 'game';
    }
    this.generateScoreChart(true);
  }

  private toggleAverageChartView(): void {
    if (this.averageChartViewMode === 'session') {
      this.averageChartViewMode = 'weekly';
    } else if (this.averageChartViewMode === 'weekly') {
      this.averageChartViewMode = 'monthly';
    } else if (this.averageChartViewMode === 'monthly') {
      this.averageChartViewMode = 'yearly';
    } else {
      this.averageChartViewMode = 'session';
    }
    this.generateAverageScoreChart(true);
  }

  private generateScoreChart(isReload?: boolean): void {
    try {
      const canvas = this.scoreChart();
      if (!canvas) return;

      this.scoreChartInstance = this.chartService.generateScoreChart(
        canvas,
        this.chartGames(),
        this.scoreChartInstance!,
        this.chartViewMode,
        () => this.toggleChartView(),
        isReload,
      );
    } catch (error) {
      this.toastService.showToast(TOAST_MESSAGES.chartGenerationError, 'bug', true);
      console.error('Error generating score chart:', error);
    }
  }

  private generateAverageScoreChart(isReload?: boolean): void {
    try {
      const canvas = this.averageScoreChart();
      if (!canvas) return;

      this.averageScoreChartInstance = this.chartService.generateAverageScoreChart(
        canvas,
        this.chartGames(),
        this.averageScoreChartInstance!,
        this.averageChartViewMode,
        () => this.toggleAverageChartView(),
        isReload,
      );
    } catch (error) {
      this.toastService.showToast(TOAST_MESSAGES.chartGenerationError, 'bug', true);
      console.error('Error generating average score chart:', error);
    }
  }

  private generateScoreDistributionChart(isReload?: boolean): void {
    try {
      const canvas = this.scoreDistributionChart();
      if (!canvas) return;

      this.scoreDistributionChartInstance = this.chartService.generateScoreDistributionChart(
        canvas,
        this.chartGames(),
        this.scoreDistributionChartInstance!,
        isReload,
      );
    } catch (error) {
      this.toastService.showToast(TOAST_MESSAGES.chartGenerationError, 'bug', true);
      console.error('Error generating score distribution chart:', error);
    }
  }

  private generateSpareDistributionChart(isReload?: boolean): void {
    try {
      const canvas = this.spareDistributionChart();
      if (!canvas) return;

      this.spareDistributionChartInstance = this.chartService.generateSpareDistributionChart(
        canvas,
        this.statsService.currentStats(),
        this.spareDistributionChartInstance!,
        isReload,
      );
    } catch (error) {
      this.toastService.showToast(TOAST_MESSAGES.chartGenerationError, 'bug', true);
      console.error('Error generating spare distribution chart:', error);
    }
  }

  private generatePinChart(isReload?: boolean): void {
    try {
      const canvas = this.pinChart();
      if (!canvas) return;

      this.pinChartInstance = this.chartService.generatePinChart(canvas, this.statsService.currentStats(), this.pinChartInstance!, isReload);
    } catch (error) {
      this.toastService.showToast(TOAST_MESSAGES.chartGenerationError, 'bug', true);
      console.error('Error generating pin chart:', error);
    }
  }

  private generateThrowChart(isReload?: boolean): void {
    try {
      const canvas = this.throwChart();
      if (!canvas) return;

      this.throwChartInstance = this.chartService.generateThrowChart(canvas, this.statsService.currentStats(), this.throwChartInstance!, isReload);
    } catch (error) {
      this.toastService.showToast(TOAST_MESSAGES.chartGenerationError, 'bug', true);
      console.error('Error generating throw chart:', error);
    }
  }
}
