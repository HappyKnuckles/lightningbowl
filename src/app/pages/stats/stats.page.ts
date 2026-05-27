import { animate, state, style, transition, trigger } from '@angular/animations';
import { DatePipe, DecimalPipe, NgFor, NgIf } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  effect,
  ElementRef,
  OnInit,
  Signal,
  signal,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ImpactStyle } from '@capacitor/haptics';
import { FileHeaderButtonsComponent } from '@components/file-header-buttons/file-header-buttons.component';
import { GameFilterComponent } from '@components/game-filter/game-filter.component';
import { GenericFilterActiveComponent } from '@components/generic-filter-active/generic-filter-active.component';
import { SpareDisplayComponent } from '@components/spare-display/spare-display.component';
import { StatDisplayComponent } from '@components/stat-display/stat-display.component';
import { ToastMessages } from '@constants/toast-messages.constants';
import { ModalController, RefresherCustomEvent, SegmentCustomEvent } from '@ionic/angular';
import {
  IonContent,
  IonHeader,
  IonLabel,
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
import { SessionStats } from '@models/stats.model';
import { ChartGenerationService } from '@services/chart/chart-generation.service';
import { GameFilterService } from '@services/game-filter/game-filter.service';
import { GameStatsService } from '@services/game-stats/game-stats.service';
import { HapticService } from '@services/haptic/haptic.service';
import { LoadingService } from '@services/loader/loading.service';
import { SortUtilsService } from '@services/sort-utils/sort-utils.service';
import { ToastService } from '@services/toast/toast.service';
import { UtilsService } from '@services/utils/utils.service';
import { BallsStore } from '@stores/balls.store';
import { GamesStore } from '@stores/games.store';
import Chart from 'chart.js/auto';
import { addIcons } from 'ionicons';
import { calendarNumber, calendarNumberOutline, filterOutline } from 'ionicons/icons';
import { GAME_FILTER_CONFIGS } from 'src/app/core/configs//filter-configs';
import {
  overallStatDefinitions,
  pinStatDefinitions,
  playFrequencyStatDefinitions,
  seriesStatDefinitions,
  sessionStatDefinitions,
  spareStatDefinitions,
  specialStatDefinitions,
  strikeStatDefinitions,
  throwStatDefinitions,
} from '../../core/constants/stats.definitions.constants';
import { BallStatsComponent } from '../../shared/components/ball-stats/ball-stats.component';
import { PatternStatsComponent } from '../../shared/components/pattern-stats/pattern-stats.component';
import { PinLeaveStatsComponent } from '../../shared/components/pin-leave-stats/pin-leave-stats.component';

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
    StatDisplayComponent,
    SpareDisplayComponent,
    GenericFilterActiveComponent,
    BallStatsComponent,
    PinLeaveStatsComponent,
    PatternStatsComponent,
    FileHeaderButtonsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatsPage implements OnInit, AfterViewInit {
  @ViewChild(IonContent) content!: IonContent;
  overallStatDefinitions = overallStatDefinitions;
  seriesStatDefinitions = seriesStatDefinitions;
  throwStatDefinitions = throwStatDefinitions;
  sessionStatDefinitions = sessionStatDefinitions;
  playFrequencyStatDefinitions = playFrequencyStatDefinitions;
  specialStatDefinitions = specialStatDefinitions;
  strikeStatDefinitions = strikeStatDefinitions;
  spareStatDefinitions = spareStatDefinitions;
  pinStatDefinitions = pinStatDefinitions;
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

  sessionStats: Signal<SessionStats> = computed(() => {
    return this.statsService.calculateBowlingStats(this.gamesForSelectedSession()) as SessionStats;
  });

  sessionLeaves = computed(() => this.statsService.calculateLeaveAnalytics(this.gamesForSelectedSession()));

  sessionBestBallStats = computed(() => this.statsService.calculateBestBallStats(this.gamesForSelectedSession()));
  sessionMostPlayedBallStats = computed(() => this.statsService.calculateMostPlayedBallStats(this.gamesForSelectedSession()));
  sessionAllBallStats = computed(() => this.statsService.calculateAllBallStats(this.gamesForSelectedSession()));

  sessionBestPatternStats = computed(() => this.statsService.calculateBestPatternStats(this.gamesForSelectedSession()));
  sessionMostPlayedPatternStats = computed(() => this.statsService.calculateMostPlayedPatternStats(this.gamesForSelectedSession()));
  sessionAllPatternStats = computed(() => this.statsService.calculateAllPatternStats(this.gamesForSelectedSession()));
  sessionAllLeaves = computed(() => this.statsService.calculateAllLeaves(this.gamesForSelectedSession()));

  chartViewMode: 'week' | 'game' | 'session' | 'monthly' | 'yearly' = 'game';
  averageChartViewMode: 'session' | 'weekly' | 'monthly' | 'yearly' = 'monthly';
  selectedSegment = 'Overall';
  segments: string[] = ['Overall', 'Throws', 'Spares', 'Pins', 'Sessions'];

  // Viewchilds and Instances
  @ViewChild('scoreChart', { static: false }) scoreChart?: ElementRef;
  @ViewChild('averageScoreChart', { static: false }) averageScoreChart?: ElementRef;
  @ViewChild('pinChart', { static: false }) pinChart?: ElementRef;
  @ViewChild('throwChart', { static: false }) throwChart?: ElementRef;
  @ViewChild('scoreDistributionChart', { static: false }) scoreDistributionChart?: ElementRef;
  @ViewChild('spareDistributionChart', { static: false }) spareDistributionChart?: ElementRef;
  private spareDistributionChartInstance: Chart | null = null;
  private scoreDistributionChartInstance: Chart | null = null;
  private pinChartInstance: Chart | null = null;
  private throwChartInstance: Chart | null = null;
  private scoreChartInstance: Chart | null = null;
  private averageScoreChartInstance: Chart | null = null;

  gameFilterConfigs = GAME_FILTER_CONFIGS;

  constructor(
    public loadingService: LoadingService,
    public statsService: GameStatsService,
    public gamesStore: GamesStore,
    public ballsStore: BallsStore,
    public gameFilterService: GameFilterService,
    private hapticService: HapticService,
    private modalCtrl: ModalController,
    private sortUtilsService: SortUtilsService,
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

  ngAfterViewInit(): void {
    this.generateCharts(true);
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
    try {
      this.hapticService.vibrate(ImpactStyle.Medium);
      await this.gamesStore.loadGameHistory();
      this.generateCharts(true);
    } catch (error) {
      console.error(error);
      this.toastService.showToast(ToastMessages.gameLoadError, 'bug', true);
    } finally {
      event.target.complete();
    }
  }
  onSegmentChanged(event: SegmentCustomEvent): void {
    this.selectedSegment = event.detail.value?.toString() || 'Overall';
    this.generateCharts();
    setTimeout(() => {
      this.content.scrollToTop(300);
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
  private generateScoreChart(isReload?: boolean): void {
    try {
      if (!this.scoreChart) {
        return;
      }

      this.scoreChartInstance = this.chartService.generateScoreChart(
        this.scoreChart,
        this.sortUtilsService.sortGameHistoryByDate([...this.gameFilterService.filteredGames()], true),
        this.scoreChartInstance!,
        this.chartViewMode,
        () => this.toggleChartView(),
        isReload,
      );
    } catch (error) {
      this.toastService.showToast(ToastMessages.chartGenerationError, 'bug', true);
      console.error('Error generating score chart:', error);
    }
  }
  private toggleChartView() {
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

  private toggleAverageChartView() {
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

  private generateAverageScoreChart(isReload?: boolean): void {
    try {
      if (!this.averageScoreChart) {
        return;
      }

      this.averageScoreChartInstance = this.chartService.generateAverageScoreChart(
        this.averageScoreChart,
        this.sortUtilsService.sortGameHistoryByDate([...this.gameFilterService.filteredGames()], true),
        this.averageScoreChartInstance!,
        this.averageChartViewMode,
        () => this.toggleAverageChartView(),
        isReload,
      );
    } catch (error) {
      this.toastService.showToast(ToastMessages.chartGenerationError, 'bug', true);
      console.error('Error generating average score chart:', error);
    }
  }

  private generateScoreDistributionChart(isReload?: boolean): void {
    try {
      if (!this.scoreDistributionChart) {
        return;
      }

      this.scoreDistributionChartInstance = this.chartService.generateScoreDistributionChart(
        this.scoreDistributionChart,
        this.sortUtilsService.sortGameHistoryByDate([...this.gameFilterService.filteredGames()], true),
        this.scoreDistributionChartInstance!,
        isReload,
      );
    } catch (error) {
      this.toastService.showToast(ToastMessages.chartGenerationError, 'bug', true);
      console.error('Error generating score distribution chart:', error);
    }
  }

  private generateSpareDistributionChart(isReload?: boolean): void {
    try {
      if (!this.spareDistributionChart) {
        return;
      }

      this.spareDistributionChartInstance = this.chartService.generateSpareDistributionChart(
        this.spareDistributionChart,
        this.statsService.currentStats(),
        this.spareDistributionChartInstance!,
        isReload,
      );
    } catch (error) {
      this.toastService.showToast(ToastMessages.chartGenerationError, 'bug', true);
      console.error('Error generating spare distribution chart:', error);
    }
  }

  private generatePinChart(isReload?: boolean): void {
    try {
      if (!this.pinChart) {
        return;
      }

      this.pinChartInstance = this.chartService.generatePinChart(this.pinChart, this.statsService.currentStats(), this.pinChartInstance!, isReload);
    } catch (error) {
      this.toastService.showToast(ToastMessages.chartGenerationError, 'bug', true);
      console.error('Error generating pin chart:', error);
    }
  }

  private generateThrowChart(isReload?: boolean): void {
    try {
      if (!this.throwChart) {
        return;
      }

      this.throwChartInstance = this.chartService.generateThrowChart(
        this.throwChart,
        this.statsService.currentStats(),
        this.throwChartInstance!,
        isReload,
      );
    } catch (error) {
      this.toastService.showToast(ToastMessages.chartGenerationError, 'bug', true);
      console.error('Error generating throw chart:', error);
    }
  }

  get currentFilters(): Record<string, unknown> {
    return this.gameFilterService.filters() as unknown as Record<string, unknown>;
  }

  get defaultFilters(): Record<string, unknown> {
    return this.gameFilterService.defaultFilters as unknown as Record<string, unknown>;
  }
}
