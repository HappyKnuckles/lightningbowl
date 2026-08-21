import { DecimalPipe, NgIf } from '@angular/common';
import { Component, computed, CUSTOM_ELEMENTS_SCHEMA, effect, ElementRef, Signal, signal, ViewChild } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ImpactStyle } from '@capacitor/haptics';
import { AlertController, RefresherCustomEvent, SegmentCustomEvent } from '@ionic/angular';
import {
  IonButton,
  IonButtons,
  IonCheckbox,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonModal,
  IonRefresher,
  IonSegment,
  IonSegmentButton,
  IonSegmentContent,
  IonSegmentView,
  IonText,
  IonTitle,
  IonMenuButton,
  IonToolbar,
} from '@ionic/angular/standalone';
import Chart from 'chart.js/auto';
import { addIcons } from 'ionicons';
import {
  addOutline,
  cameraOutline,
  checkmarkOutline,
  chevronBack,
  chevronForward,
  createOutline,
  documentTextOutline,
  shareOutline,
  trashOutline,
  trophyOutline,
} from 'ionicons/icons';
import { LEAGUE_STAT_DEFINITIONS, PIN_STAT_DEFINITIONS } from 'src/app/core/configs/stat-definitions/stat-definitions';
import { TOAST_MESSAGES } from 'src/app/core/constants/toast-messages.constants';
import { LongPressDirective } from 'src/app/core/directives/long-press/long-press.directive';
import { Game } from 'src/app/core/models/game.model';
import { LeagueLeaveStats, Stats } from 'src/app/core/models/stats.model';
import { AnalyticsService } from 'src/app/core/services/analytics/analytics.service';
import { ChartGenerationService } from 'src/app/core/services/chart/chart-generation.service';
import { GameStatsService } from 'src/app/core/services/game-stats/game-stats.service';
import { HapticService } from 'src/app/core/services/haptic/haptic.service';
import { HiddenLeagueSelectionService } from 'src/app/core/services/hidden-league/hidden-league.service';
import { LoadingService } from 'src/app/core/services/loader/loading.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { AppFacade } from 'src/app/core/stores/app.facade';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { GamesStore } from 'src/app/core/stores/games.store';
import { LeaguesStore } from 'src/app/core/stores/leagues.store';
import { sortGameHistoryByDate, sortGamesByLeagues } from 'src/app/core/utils/sort-utils/sort.utils';
import { GameListComponent } from 'src/app/shared/components/game-list/game-list.component';
import { StatDisplayComponent } from 'src/app/shared/components/stat-display/stat-display.component';
import { StatPinLeaveComponent } from 'src/app/shared/components/stat-pin-leave/stat-pin-leave.component';
import { StatSpareComponent } from 'src/app/shared/components/stat-spare/stat-spare.component';
import { BowlingRefresherComponent } from '../../shared/components/bowling-refresher/bowling-refresher.component';
import { StatHighlightItemComponent } from 'src/app/shared/components/stat-highlight-item/stat-highlight-item.component';
import { environment } from 'src/environments/environment';
import { buildHighlights } from 'src/app/core/utils/stat-utils/stat.utils';

@Component({
  selector: 'app-league',
  templateUrl: './league.page.html',
  styleUrls: ['./league.page.scss'],
  imports: [
    IonRefresher,
    IonModal,
    IonText,
    IonItemOptions,
    IonItemOption,
    IonItemSliding,
    IonLabel,
    IonItem,
    IonIcon,
    IonButtons,
    IonButton,
    IonContent,
    IonHeader,
    IonTitle,
    IonMenuButton,
    IonToolbar,
    IonCheckbox,
    FormsModule,
    GameListComponent,
    ReactiveFormsModule,
    NgIf,
    DecimalPipe,
    StatDisplayComponent,
    IonSegmentButton,
    IonSegment,
    IonSegmentView,
    IonSegmentContent,
    LongPressDirective,
    StatHighlightItemComponent,
    StatSpareComponent,
    StatPinLeaveComponent,
    BowlingRefresherComponent,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class LeaguePage {
  @ViewChild('modalContent') content!: IonContent;
  @ViewChild('scoreChart', { static: false }) scoreChart?: ElementRef;
  @ViewChild('pinChart', { static: false }) pinChart?: ElementRef;
  imagesUrl = environment.imagesUrl;
  selectedSegment = 'Overall';
  segments: string[] = ['Overall', 'Spares', 'Pins', 'Games'];
  isEditMode: Record<string, boolean> = {};

  gamesByLeague: Signal<Record<string, Game[]>> = computed(() => {
    const games = this.gamesStore.games();
    return sortGamesByLeagues(games, true);
  });

  leagueKeys: Signal<string[]> = computed(() => {
    return Object.keys(this.gamesByLeague());
  });

  overallStats: Signal<Stats> = computed(() => {
    const games = this.gamesStore.games();
    return this.statService.calculateBowlingStats(games);
  });

  gamesByLeagueReverse = this.perLeague((games) => sortGameHistoryByDate(games, true));
  statsByLeague = this.perLeague((games) => this.statService.calculateBowlingStats(games));
  bestBallsByLeague = this.perLeague((games) => this.statService.calculateBestBallStats(games));
  mostPlayedBallsByLeague = this.perLeague((games) => this.statService.calculateMostPlayedBallStats(games));
  allBallsByLeague = this.perLeague((games) => this.statService.calculateAllBallStats(games));
  bestPatternsByLeague = this.perLeague((games) => this.statService.calculateBestPatternStats(games));
  mostPlayedPatternsByLeague = this.perLeague((games) => this.statService.calculateMostPlayedPatternStats(games));
  allPatternsByLeague = this.perLeague((games) => this.statService.calculateAllPatternStats(games));
  bestAlleysByLeague = this.perLeague((games) => this.statService.calculateBestAlleyStats(games));
  mostPlayedAlleysByLeague = this.perLeague((games) => this.statService.calculateMostPlayedAlleyStats(games));
  allAlleysByLeague = this.perLeague((games) => this.statService.calculateAllAlleyStats(games));
  leaveStatsByLeague = this.perLeague<LeagueLeaveStats>((games) => {
    const all = this.statService.calculateAllLeaves(games);
    return {
      all,
      common: this.statService.calculateMostCommonLeaves(all),
      best: this.statService.calculateBestSpares(all),
      worst: this.statService.calculateWorstSpares(all),
    };
  });
  // beobachten ob rebuild für alle leagues teuer ist
  readonly leagueHighlights = computed(() => {
    const statsByLeague = this.statsByLeague();
    const result: Record<string, ReturnType<typeof buildHighlights>> = {};

    for (const league of Object.keys(statsByLeague)) {
      result[league] = buildHighlights({
        mostPlayedBall: this.mostPlayedBallsByLeague()[league],
        bestBall: this.bestBallsByLeague()[league],
        allBalls: this.allBallsByLeague()[league],
        mostPlayedPattern: this.mostPlayedPatternsByLeague()[league],
        bestPattern: this.bestPatternsByLeague()[league],
        allPatterns: this.allPatternsByLeague()[league],
        mostPlayedAlley: this.mostPlayedAlleysByLeague()[league],
        bestAlley: this.bestAlleysByLeague()[league],
        allAlleys: this.allAlleysByLeague()[league],
      });
    }
    return result;
  });

  statDefinitions = LEAGUE_STAT_DEFINITIONS;
  PIN_STAT_DEFINITIONS = PIN_STAT_DEFINITIONS;

  private scoreChartInstances: Record<string, Chart> = {};
  private pinChartInstances: Record<string, Chart> = {};

  isVisibilityEdit = signal(false);
  selectedLeague = signal<string | null>(null);
  isRefreshing = signal(false);

  readonly noLeaguesShown = computed(() => !Object.values(this.hiddenLeagueSelectionService.selectionState()).some((isVisible) => isVisible));

  readonly leagueSelectionState = this.hiddenLeagueSelectionService.selectionState;

  private previousLeagueSelectionState: Record<string, boolean> = {};
  chartViewMode: 'week' | 'game' | 'session' | 'monthly' | 'yearly' = 'session';

  constructor(
    public gamesStore: GamesStore,
    public ballsStore: BallsStore,
    public leaguesStore: LeaguesStore,
    private appFacade: AppFacade,
    private hapticService: HapticService,
    private statService: GameStatsService,
    public loadingService: LoadingService,
    private alertController: AlertController,
    private toastService: ToastService,
    private chartService: ChartGenerationService,
    private hiddenLeagueSelectionService: HiddenLeagueSelectionService,
    private analyticsService: AnalyticsService,
  ) {
    addIcons({
      addOutline,
      checkmarkOutline,
      trashOutline,
      createOutline,
      chevronBack,
      chevronForward,
      cameraOutline,
      shareOutline,
      documentTextOutline,
      trophyOutline,
    });
    effect(() => {
      this.hiddenLeagueSelectionService.setAvailableLeagues(this.leagueKeys());
    });
  }

  closeLeague(): void {
    const league = this.selectedLeague();
    if (league) {
      this.destroyCharts(league);
    }
    this.selectedSegment = 'Overall';
    this.selectedLeague.set(null);
  }

  updateLeagueSelection(league: string, checked: boolean) {
    this.hiddenLeagueSelectionService.updateSelection(league, checked);
  }

  cancelEdit() {
    this.hiddenLeagueSelectionService.selectionStateValue = this.previousLeagueSelectionState;
    this.editVisibility();
  }

  editVisibility() {
    const newState = !this.isVisibilityEdit();
    this.isVisibilityEdit.set(newState);

    if (newState) {
      this.previousLeagueSelectionState = { ...this.hiddenLeagueSelectionService.selectionState() };
      this.toastService.showToast(TOAST_MESSAGES.leagueEditMode, 'eye-outline');
    } else {
      const current = this.hiddenLeagueSelectionService.selectionState();
      const previous = this.previousLeagueSelectionState;

      const nowHiding: string[] = [];
      const nowShowing: string[] = [];

      for (const league of Object.keys(current)) {
        if (previous[league] && !current[league]) {
          nowHiding.push(league);
        } else if (!previous[league] && current[league]) {
          nowShowing.push(league);
        }
      }

      const parts: string[] = [];

      if (nowHiding.length) {
        parts.push(`Now Hiding: ${nowHiding.slice(0, 3).join(', ')}${nowHiding.length > 3 ? '...' : ''}`);
      }
      if (nowShowing.length) {
        parts.push(`Now Showing: ${nowShowing.slice(0, 3).join(', ')}${nowShowing.length > 3 ? '...' : ''}`);
      }

      const message = parts.length > 0 ? parts.join('<br>') : 'No changes made.';
      this.toastService.showToast(message, 'checkmark-outline');
    }
  }

  async handleRefresh(event: RefresherCustomEvent): Promise<void> {
    this.isRefreshing.set(true);
    try {
      this.hapticService.vibrate(ImpactStyle.Medium);
      await this.gamesStore.loadGameHistory();
    } catch (error) {
      console.error(error);
      this.toastService.showToast(TOAST_MESSAGES.gameLoadError, 'bug', true);
    } finally {
      event.target.complete();
    }
  }

  destroyCharts(league: string): void {
    this.pinChartInstances[league]?.destroy();
    this.scoreChartInstances[league]?.destroy();
    delete this.pinChartInstances[league];
    delete this.scoreChartInstances[league];
  }

  onSegmentChanged(league: string, event: SegmentCustomEvent): void {
    this.selectedSegment = event.detail.value?.toString() || 'Overall';
    this.generateCharts(league);
    setTimeout(() => {
      this.content.scrollToTop(300);
    }, 300);
  }

  generateCharts(league: string, isReload?: boolean): void {
    if (this.gamesStore.games().length > 0) {
      if (this.selectedSegment === 'Overall') {
        this.generateScoreChart(league, isReload);
      } else if (this.selectedSegment === 'Spares') {
        this.generatePinChart(league, isReload);
      }
    }
  }

  async saveLeague(league: string): Promise<void> {
    try {
      await this.leaguesStore.addLeague(league);
      this.toastService.showToast(TOAST_MESSAGES.leagueSaveSuccess, 'add');
    } catch (error) {
      this.toastService.showToast(TOAST_MESSAGES.leagueSaveError, 'bug', true);
      console.error('Error saving league:', error);
    }
  }

  async addLeague() {
    const alert = await this.alertController.create({
      header: 'Add League',
      message: 'Enter the league name',
      inputs: [
        {
          name: 'league',
          type: 'text',
          placeholder: 'League name',
          cssClass: 'league-alert-input',
        },
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Add',
          handler: async (data: { league: string }) => {
            try {
              await this.leaguesStore.addLeague(data.league);
              this.toastService.showToast(TOAST_MESSAGES.leagueSaveSuccess, 'add');
              void this.analyticsService.trackLeagueCreated({ name: data.league });
            } catch (error) {
              this.toastService.showToast(TOAST_MESSAGES.leagueSaveError, 'bug', true);
              console.error('Error saving league:', error);
            }
          },
        },
      ],
    });
    await alert.present();
  }

  async deleteLeague(league: string): Promise<void> {
    this.hapticService.vibrate(ImpactStyle.Heavy);
    const alert = await this.alertController.create({
      header: 'Confirm Deletion',
      message: 'Are you sure you want to delete this league?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Delete',
          handler: async () => {
            try {
              await this.leaguesStore.deleteLeague(league);
              this.toastService.showToast(TOAST_MESSAGES.leagueDeleteSuccess, 'remove-outline');
            } catch (error) {
              this.toastService.showToast(TOAST_MESSAGES.leagueDeleteError, 'bug', true);
              console.error('Error deleting league:', error);
            }
          },
        },
      ],
    });

    await alert.present();
  }

  async editLeague(league: string): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Edit League',
      message: 'Enter the new league name',
      inputs: [
        {
          name: 'league',
          type: 'text',
          value: league,
          placeholder: 'League name',
          cssClass: 'alert-input',
        },
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Edit',
          handler: async (data: { league: string }) => {
            try {
              await this.appFacade.editLeague(data.league, league);
              this.toastService.showToast(TOAST_MESSAGES.leagueEditSuccess, 'checkmark-outline');
            } catch (error) {
              this.toastService.showToast(TOAST_MESSAGES.leagueEditError, 'bug', true);
              console.error('Error editing league:', error);
            }
          },
        },
      ],
    });
    await alert.present();
  }

  private perLeague<R>(fn: (games: Game[]) => R): Signal<Record<string, R>> {
    return computed(() => Object.fromEntries(Object.entries(this.gamesByLeague()).map(([league, games]) => [league, fn(games ?? [])])));
  }

  private generateScoreChart(league: string, isReload?: boolean): void {
    try {
      if (!this.scoreChart) return;

      this.scoreChartInstances[league] = this.chartService.generateScoreChart(
        this.scoreChart,
        this.gamesByLeagueReverse()[league],
        this.scoreChartInstances[league]!,
        this.chartViewMode,
        () => this.toggleChartView(league),
        isReload,
      );
    } catch (error) {
      this.toastService.showToast(TOAST_MESSAGES.chartGenerationError, 'bug', true);
      console.error('Error generating score chart:', error);
    }
  }

  private generatePinChart(league: string, isReload?: boolean): void {
    try {
      if (!this.pinChart) return;

      this.pinChartInstances[league] = this.chartService.generatePinChart(
        this.pinChart,
        this.statsByLeague()[league],
        this.pinChartInstances[league]!,
        isReload,
      );
    } catch (error) {
      this.toastService.showToast(TOAST_MESSAGES.chartGenerationError, 'bug', true);
      console.error('Error generating pin chart:', error);
    }
  }

  private toggleChartView(league: string) {
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

    this.generateScoreChart(league, true);
  }
}
