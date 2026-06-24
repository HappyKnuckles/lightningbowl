import { DecimalPipe, NgIf, NgTemplateOutlet } from '@angular/common';
import { Component, computed, CUSTOM_ELEMENTS_SCHEMA, effect, ElementRef, Signal, signal, ViewChild } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ImpactStyle } from '@capacitor/haptics';
import { AlertController, RefresherCustomEvent, SegmentCustomEvent } from '@ionic/angular';
import {
  IonBadge,
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
  IonNote,
  IonProgressBar,
  IonRefresher,
  IonSegment,
  IonSegmentButton,
  IonSegmentContent,
  IonSegmentView,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import Chart from 'chart.js/auto';
import { addIcons } from 'ionicons';
import {
  addOutline,
  cashOutline,
  cameraOutline,
  calendarOutline,
  checkmarkOutline,
  chevronBack,
  chevronForward,
  createOutline,
  documentTextOutline,
  ribbonOutline,
  shareOutline,
  timeOutline,
  trashOutline,
  trophyOutline,
} from 'ionicons/icons';
import { LEAGUE_STAT_DEFINITIONS, PIN_STAT_DEFINITIONS } from 'src/app/core/configs/stat-definitions/stat-definitions';
import { TOAST_MESSAGES } from 'src/app/core/constants/toast-messages.constants';
import { LongPressDirective } from 'src/app/core/directives/long-press/long-press.directive';
import { Game } from 'src/app/core/models/game.model';
import { FinanceSummary, League } from 'src/app/core/models/league';
import { LeagueLeaveStats, Stats } from 'src/app/core/models/stats.model';
import { AnalyticsService } from 'src/app/core/services/analytics/analytics.service';
import { ChartGenerationService } from 'src/app/core/services/chart/chart-generation.service';
import { GameStatsService } from 'src/app/core/services/game-stats/game-stats.service';
import { HandicapService } from 'src/app/core/services/league/handicap.service';
import { LeagueFinanceService } from 'src/app/core/services/league/league-finance.service';
import { SeasonService } from 'src/app/core/services/league/season.service';
import { HapticService } from 'src/app/core/services/haptic/haptic.service';
import { HiddenLeagueSelectionService } from 'src/app/core/services/hidden-league/hidden-league.service';
import { LoadingService } from 'src/app/core/services/loader/loading.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { GamesStore } from 'src/app/core/stores/games.store';
import { LeaguesStore } from 'src/app/core/stores/leagues.store';
import { sortGameHistoryByDate, sortGamesByLeagues } from 'src/app/core/utils/sort-utils/sort.utils';
import { GameListComponent } from 'src/app/shared/components/game-list/game-list.component';
import { LeagueFormComponent } from 'src/app/shared/components/league-form/league-form.component';
import { StatDisplayComponent } from 'src/app/shared/components/stat-display/stat-display.component';
import { StatPinLeaveComponent } from 'src/app/shared/components/stat-pin-leave/stat-pin-leave.component';
import { StatSpareComponent } from 'src/app/shared/components/stat-spare/stat-spare.component';
import { BowlingRefresherComponent } from '../../shared/components/bowling-refresher/bowling-refresher.component';
import { StatHighlightItemComponent } from 'src/app/shared/components/stat-highlight-item/stat-highlight-item.component';
import { environment } from 'src/environments/environment';
import { buildHighlights } from 'src/app/core/utils/stat-utils/stat.utils';

/** A league summary card built from a League aggregate (or a game-derived group). */
export interface LeagueCardVm {
  name: string;
  league: League | null;
  eventType: string;
  seasonName: string | null;
  averageScore: number;
  highGame: number;
  totalGames: number;
  active: boolean;
  color: string | null;
  countdownDays: number | null;
  isPractice: boolean;
  hasGames: boolean;
}

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
    IonToolbar,
    IonCheckbox,
    IonBadge,
    IonNote,
    IonProgressBar,
    FormsModule,
    GameListComponent,
    ReactiveFormsModule,
    NgIf,
    NgTemplateOutlet,
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
    LeagueFormComponent,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class LeaguePage {
  @ViewChild('modalContent') content!: IonContent;
  @ViewChild('scoreChart', { static: false }) scoreChart?: ElementRef;
  @ViewChild('pinChart', { static: false }) pinChart?: ElementRef;
  imagesUrl = environment.imagesUrl;
  selectedSegment = 'Overall';
  segments: string[] = ['Overall', 'Spares', 'Pins', 'Finances', 'Games'];
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

  // League create/edit form state.
  isFormOpen = signal(false);
  editingLeague = signal<League | null>(null);

  readonly noLeaguesShown = computed(() => !Object.values(this.hiddenLeagueSelectionService.selectionState()).some((isVisible) => isVisible));

  readonly leagueSelectionState = this.hiddenLeagueSelectionService.selectionState;

  /** Rich cards: League aggregates first, then any game-derived groups without one (e.g. Practice). */
  readonly leagueCards = computed<LeagueCardVm[]>(() => {
    const entities = this.leaguesStore.leagues();
    const gamesByName = this.gamesByLeague();
    const statsByName = this.statsByLeague();
    const entityNames = new Set(entities.map((e) => e.name));
    const cards: LeagueCardVm[] = [];

    for (const entity of entities) {
      const games = gamesByName[entity.name] ?? [];
      // Hide leagues/tournaments that have no games played yet.
      if (games.length === 0) {
        continue;
      }
      cards.push(this.buildCard(entity.name, entity, games, statsByName[entity.name]));
    }
    for (const name of Object.keys(gamesByName)) {
      if (!entityNames.has(name)) {
        cards.push(this.buildCard(name, null, gamesByName[name], statsByName[name]));
      }
    }
    return cards;
  });

  /** The aggregate behind the currently open detail view (null for game-only groups). */
  readonly selectedEntity = computed<League | null>(() => {
    const name = this.selectedLeague();
    return name ? (this.leaguesStore.getByName(name) ?? null) : null;
  });

  readonly selectedFinance = computed<FinanceSummary | null>(() => {
    const league = this.selectedEntity();
    if (!league || !league.seasons.length) {
      return null;
    }
    return this.financeService.summarizeSeasons(league.seasons);
  });

  readonly selectedSeasonProgress = computed(() => {
    const league = this.selectedEntity();
    return this.seasonService.seasonProgress(league ? this.seasonService.getActiveSeason(league) : undefined);
  });

  private previousLeagueSelectionState: Record<string, boolean> = {};
  chartViewMode: 'week' | 'game' | 'session' | 'monthly' | 'yearly' = 'session';

  constructor(
    public gamesStore: GamesStore,
    public ballsStore: BallsStore,
    public leaguesStore: LeaguesStore,
    private hapticService: HapticService,
    private statService: GameStatsService,
    public loadingService: LoadingService,
    private alertController: AlertController,
    private toastService: ToastService,
    private chartService: ChartGenerationService,
    private hiddenLeagueSelectionService: HiddenLeagueSelectionService,
    private analyticsService: AnalyticsService,
    private seasonService: SeasonService,
    private financeService: LeagueFinanceService,
    private handicapService: HandicapService,
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
      cashOutline,
      calendarOutline,
      ribbonOutline,
      timeOutline,
    });
    effect(() => {
      // Track visibility for every league name in play: aggregates + game-derived groups.
      const names = [...new Set([...this.leaguesStore.leagueNames(), ...this.leagueKeys()])];
      this.hiddenLeagueSelectionService.setAvailableLeagues(names);
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
      this.content?.scrollToTop(300);
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

  // ---- League create / edit via the rich form modal ----

  openCreateForm(): void {
    this.editingLeague.set(null);
    this.isFormOpen.set(true);
  }

  openEditForm(card: LeagueCardVm): void {
    if (!card.league) {
      // Game-derived group (e.g. Practice) with no aggregate yet — create one seeded by name.
      this.editingLeague.set(null);
      this.isFormOpen.set(true);
      return;
    }
    this.editingLeague.set(card.league);
    this.isFormOpen.set(true);
  }

  async onFormSaved(league: League): Promise<void> {
    this.isFormOpen.set(false);
    const isEdit = !!this.editingLeague();
    try {
      if (isEdit) {
        await this.leaguesStore.updateLeague(league);
        this.toastService.showToast(TOAST_MESSAGES.leagueEditSuccess, 'checkmark-outline');
        void this.analyticsService.trackLeagueEdited();
      } else {
        await this.leaguesStore.createLeague(league);
        this.toastService.showToast(TOAST_MESSAGES.leagueSaveSuccess, 'add');
        void this.analyticsService.trackLeagueCreated({ name: league.name });
      }
    } catch (error) {
      this.toastService.showToast(isEdit ? TOAST_MESSAGES.leagueEditError : TOAST_MESSAGES.leagueSaveError, 'bug', true);
      console.error('Error saving league:', error);
    } finally {
      this.editingLeague.set(null);
    }
  }

  onFormCancelled(): void {
    this.isFormOpen.set(false);
    this.editingLeague.set(null);
  }

  async deleteLeague(card: LeagueCardVm): Promise<void> {
    this.hapticService.vibrate(ImpactStyle.Heavy);
    const alert = await this.alertController.create({
      header: 'Confirm Deletion',
      message: card.hasGames
        ? `Delete the league "${card.name}"? Your games stay in your history but lose their league link.`
        : `Are you sure you want to delete "${card.name}"?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          handler: async () => {
            try {
              if (card.league) {
                await this.leaguesStore.deleteLeague(card.league.id);
              } else {
                await this.leaguesStore.deleteLeague(card.name);
              }
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

  openLeague(card: LeagueCardVm): void {
    this.selectedSegment = 'Overall';
    this.selectedLeague.set(card.name);
  }

  async startNewSeason(): Promise<void> {
    const league = this.selectedEntity();
    if (!league) {
      return;
    }
    const nextNumber = league.seasons.reduce((max, s) => Math.max(max, s.seasonNumber), 0) + 1;
    const alert = await this.alertController.create({
      header: 'Start New Season',
      message: 'The current season is archived and a new active season begins (fees carry over).',
      inputs: [{ name: 'name', type: 'text', value: `Season ${nextNumber}`, placeholder: 'Season name' }],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Start',
          handler: async (data: { name: string }) => {
            try {
              const updated = this.seasonService.startNewSeason(league, data.name);
              await this.leaguesStore.updateLeague(updated);
              this.toastService.showToast('New season started.', 'add');
            } catch (error) {
              this.toastService.showToast(TOAST_MESSAGES.leagueEditError, 'bug', true);
              console.error('Error starting new season:', error);
            }
          },
        },
      ],
    });
    await alert.present();
  }

  handicapForLeague(league: League | null, average: number): number {
    if (!league) {
      return 0;
    }
    return this.handicapService.handicapForAverage(league.handicap, average);
  }

  private buildCard(name: string, league: League | null, games: Game[], stats: Stats | undefined): LeagueCardVm {
    const isPractice = !league && name === 'Practice';
    const activeSeason = league ? this.seasonService.getActiveSeason(league) : undefined;
    return {
      name,
      league,
      eventType: league?.eventType ?? (isPractice ? 'Practice' : 'League'),
      seasonName: activeSeason?.seasonName ?? null,
      averageScore: stats?.averageScore ?? 0,
      highGame: stats?.highGame ?? 0,
      totalGames: stats?.totalGames ?? games.length,
      active: league?.active ?? true,
      color: league?.color ?? null,
      countdownDays: league ? this.seasonService.countdownDays(league) : null,
      isPractice,
      hasGames: games.length > 0,
    };
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
