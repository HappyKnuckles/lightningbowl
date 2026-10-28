import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { Component, computed, CUSTOM_ELEMENTS_SCHEMA, effect, ElementRef, Signal, signal, ViewChild } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ImpactStyle } from '@capacitor/haptics';
import { AlertController, RefresherCustomEvent, SegmentCustomEvent } from '@ionic/angular';
import {
  IonButton,
  IonButtons,
  IonCheckbox,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonMenuButton,
  IonModal,
  IonRefresher,
  IonSegment,
  IonSegmentButton,
  IonSegmentContent,
  IonSegmentView,
  IonText,
  IonTitle,
  IonToolbar,
  ModalController,
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
  statsChartOutline,
  trashOutline,
  trophyOutline,
} from 'ionicons/icons';
import { LEAGUE_STAT_DEFINITIONS, PIN_STAT_DEFINITIONS } from 'src/app/core/configs/stat-definitions/stat-definitions';
import { TOAST_MESSAGES } from 'src/app/core/constants/toast-messages.constants';
import { LongPressDirective } from 'src/app/core/directives/long-press/long-press.directive';
import { Game } from 'src/app/core/models/game.model';
import { League, SeasonRange } from 'src/app/core/models/league.model';
import { LeagueLeaveStats, Stats } from 'src/app/core/models/stats.model';
import { ChartGenerationService } from 'src/app/core/services/chart/chart-generation.service';
import { GameFilterService } from 'src/app/core/services/game-filter/game-filter.service';
import { GameStatsService } from 'src/app/core/services/game-stats/game-stats.service';
import { HapticService } from 'src/app/core/services/haptic/haptic.service';
import { HiddenLeagueSelectionService } from 'src/app/core/services/hidden-league/hidden-league.service';
import { LoadingService } from 'src/app/core/services/loader/loading.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { GamesStore } from 'src/app/core/stores/games.store';
import { LeaguesStore } from 'src/app/core/stores/leagues.store';
import { currentSeason, isInRange, seasonRanges } from 'src/app/core/utils/league-utils/league.utils';
import { sortGameHistoryByDate, sortGamesByLeagues } from 'src/app/core/utils/sort-utils/sort.utils';
import { buildHighlights } from 'src/app/core/utils/stat-utils/stat.utils';
import { GameListComponent } from 'src/app/shared/components/game-list/game-list.component';
import { LeagueFormComponent } from 'src/app/shared/components/league-form/league-form.component';
import { StatDisplayComponent } from 'src/app/shared/components/stat-display/stat-display.component';
import { StatHighlightItemComponent } from 'src/app/shared/components/stat-highlight-item/stat-highlight-item.component';
import { StatPinLeaveComponent } from 'src/app/shared/components/stat-pin-leave/stat-pin-leave.component';
import { StatSpareComponent } from 'src/app/shared/components/stat-spare/stat-spare.component';
import { environment } from 'src/environments/environment';

import { BowlingRefresherComponent } from '../../shared/components/bowling-refresher/bowling-refresher.component';

const PRACTICE = 'Practice';
const ALL_SEASONS = 'all';

/** What a league's row in the list shows besides its all-time numbers. */
interface LeagueSummary {
  isTournament: boolean;
  /** The running season, when the league has seasons. */
  season?: { name: string; games: number; average: number };
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
    IonChip,
    IonContent,
    IonHeader,
    IonTitle,
    IonMenuButton,
    IonToolbar,
    IonCheckbox,
    FormsModule,
    GameListComponent,
    ReactiveFormsModule,
    DecimalPipe,
    NgTemplateOutlet,
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
  readonly practice = PRACTICE;
  readonly allSeasons = ALL_SEASONS;

  gamesByLeague: Signal<Record<string, Game[]>> = computed(() => {
    const games = this.gamesStore.games();
    return sortGamesByLeagues(games, true);
  });

  /** Leagues with games (most played first), then saved leagues without games yet. */
  leagueKeys: Signal<string[]> = computed(() => {
    const withGames = Object.keys(this.gamesByLeague());
    const withoutGames = this.leaguesStore.leagues().filter((league) => !withGames.includes(league));
    return [...withGames, ...withoutGames];
  });

  overallStats: Signal<Stats> = computed(() => {
    const games = this.gamesStore.games();
    return this.statService.calculateBowlingStats(games);
  });

  statsByLeague = computed(() =>
    Object.fromEntries(Object.entries(this.gamesByLeague()).map(([league, games]) => [league, this.statService.calculateBowlingStats(games ?? [])])),
  );

  readonly leagueSummaries = computed(() => {
    const summaries: Record<string, LeagueSummary> = {};
    for (const name of this.leagueKeys()) {
      const league = this.leaguesStore.getLeague(name);
      const season = currentSeason(league);
      const summary: LeagueSummary = { isTournament: league?.type === 'tournament' };
      if (season) {
        const range = seasonRanges(league).find((candidate) => candidate.season.id === season.id)!;
        const games = (this.gamesByLeague()[name] ?? []).filter((game) => isInRange(game.date, range));
        const average = games.length ? games.reduce((sum, game) => sum + game.totalScore, 0) / games.length : 0;
        summary.season = { name: season.name, games: games.length, average };
      }
      summaries[name] = summary;
    }
    return summaries;
  });

  // ---- the opened league: all its games, or those of one season ----

  selectedLeague = signal<string | null>(null);
  readonly detailLeague = computed<League | undefined>(() => this.leaguesStore.getLeague(this.selectedLeague() ?? undefined));
  readonly detailAllGames = computed(() => {
    const league = this.selectedLeague();
    return league ? (this.gamesByLeague()[league] ?? []) : [];
  });
  /** Seasons of the opened league, newest first, with their games. */
  readonly seasonOptions = computed(() => {
    const games = this.detailAllGames();
    return seasonRanges(this.detailLeague())
      .map((range) => ({ range, games: games.filter((game) => isInRange(game.date, range)) }))
      .reverse();
  });
  /** Season id, or 'all'. */
  selectedSeason = signal<string>(ALL_SEASONS);
  readonly #selectedRange = computed<SeasonRange | undefined>(
    () => this.seasonOptions().find((option) => option.range.season.id === this.selectedSeason())?.range,
  );
  readonly detailGames = computed(() => {
    const range = this.#selectedRange();
    return range ? this.seasonOptions().find((option) => option.range === range)!.games : this.detailAllGames();
  });
  readonly #previousSeason = computed(() => {
    const options = this.seasonOptions();
    const index = options.findIndex((option) => option.range.season.id === this.selectedSeason());
    return index === -1 ? undefined : options.slice(index + 1).find((option) => option.games.length > 0);
  });
  /** A season is compared with the season before it (named in the title); everything else with all your games. */
  readonly detailTitle = computed(() => {
    const range = this.#selectedRange();
    if (!range) return 'Overall Stats';
    const previous = this.#previousSeason();
    return previous ? `Season ${range.season.name} vs ${previous.range.season.name}` : `Season ${range.season.name}`;
  });
  readonly detailStats = computed(() => this.statService.calculateBowlingStats(this.detailGames()));
  readonly compareStats = computed(() => {
    const previous = this.#previousSeason();
    return previous ? this.statService.calculateBowlingStats(previous.games) : this.overallStats();
  });
  readonly #detailGamesAscending = computed(() => sortGameHistoryByDate([...this.detailGames()], true));
  readonly detailHighlights = computed(() => {
    const games = this.detailGames();
    return buildHighlights({
      mostPlayedBall: this.statService.calculateMostPlayedBallStats(games),
      bestBall: this.statService.calculateBestBallStats(games),
      allBalls: this.statService.calculateAllBallStats(games),
      mostPlayedPattern: this.statService.calculateMostPlayedPatternStats(games),
      bestPattern: this.statService.calculateBestPatternStats(games),
      allPatterns: this.statService.calculateAllPatternStats(games),
    });
  });
  readonly detailLeaves = computed<LeagueLeaveStats>(() => {
    const all = this.statService.calculateAllLeaves(this.detailGames());
    return {
      all,
      common: this.statService.calculateMostCommonLeaves(all),
      best: this.statService.calculateBestSpares(all),
      worst: this.statService.calculateWorstSpares(all),
    };
  });

  statDefinitions = LEAGUE_STAT_DEFINITIONS;
  PIN_STAT_DEFINITIONS = PIN_STAT_DEFINITIONS;

  private scoreChartInstance?: Chart;
  private pinChartInstance?: Chart;

  isVisibilityEdit = signal(false);
  isRefreshing = signal(false);

  readonly noLeaguesShown = computed(() => !Object.values(this.hiddenLeagueSelectionService.selectionState()).some((isVisible) => isVisible));

  readonly leagueSelectionState = this.hiddenLeagueSelectionService.selectionState;

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
    private modalController: ModalController,
    private toastService: ToastService,
    private chartService: ChartGenerationService,
    private hiddenLeagueSelectionService: HiddenLeagueSelectionService,
    private gameFilterService: GameFilterService,
    private router: Router,
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
      statsChartOutline,
      trophyOutline,
    });
    effect(() => {
      this.hiddenLeagueSelectionService.setAvailableLeagues(this.leagueKeys());
    });
  }

  /** Opens a league on its running season, or on all games when that season has none yet. */
  openLeague(name: string): void {
    const league = this.leaguesStore.getLeague(name);
    const season = currentSeason(league);
    const games = this.gamesByLeague()[name] ?? [];
    const range = seasonRanges(league).find((candidate) => candidate.season.id === season?.id);
    const hasGames = range && games.some((game) => isInRange(game.date, range));
    this.selectedSeason.set(season && hasGames ? season.id : ALL_SEASONS);
    this.selectedLeague.set(name);
  }

  selectSeason(seasonId: string): void {
    if (seasonId === this.selectedSeason()) return;
    this.selectedSeason.set(seasonId);
    // the charts are drawn imperatively from the season's games
    setTimeout(() => this.generateCharts(true));
  }

  closeLeague(): void {
    this.destroyCharts();
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

  destroyCharts(): void {
    this.pinChartInstance?.destroy();
    this.scoreChartInstance?.destroy();
    this.pinChartInstance = undefined;
    this.scoreChartInstance = undefined;
  }

  onSegmentChanged(event: SegmentCustomEvent): void {
    this.selectedSegment = event.detail.value?.toString() || 'Overall';
    this.generateCharts();
    setTimeout(() => {
      this.content.scrollToTop(300);
    }, 300);
  }

  generateCharts(isReload?: boolean): void {
    if (this.gamesStore.games().length > 0) {
      if (this.selectedSegment === 'Overall') {
        this.generateScoreChart(isReload);
      } else if (this.selectedSegment === 'Spares') {
        this.generatePinChart(isReload);
      }
    }
  }

  /** New league or tournament. */
  async addLeague(): Promise<void> {
    await this.openLeagueForm();
  }

  /** Edits a league; opening it as a league that isn't saved yet (only known from its games) saves it. */
  async editLeague(name: string, newSeason = false): Promise<void> {
    const league = this.leaguesStore.getLeague(name) ?? (await this.leaguesStore.addLeague(name));
    const role = await this.openLeagueForm(league, newSeason);
    if (role === 'delete' && this.selectedLeague() === name) {
      this.selectedLeague.set(null);
    }
  }

  /** Starts a new season of the opened league and shows it. */
  async startNewSeason(): Promise<void> {
    const name = this.selectedLeague();
    if (!name) return;
    await this.editLeague(name, true);
    const season = currentSeason(this.leaguesStore.getLeague(name));
    if (season) this.selectSeason(season.id);
  }

  /** Shows the opened league (or season) on the stats tab, through the game filter. */
  async showInStats(): Promise<void> {
    const name = this.selectedLeague();
    if (!name) return;
    const range = this.#selectedRange();
    this.gameFilterService.filterToLeague(name === PRACTICE ? '' : name, range?.from, range?.to);
    this.selectedLeague.set(null);
    await this.router.navigate(['/tabs/stats']);
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

  private async openLeagueForm(league?: League, newSeason = false): Promise<string | undefined> {
    const modal = await this.modalController.create({
      component: LeagueFormComponent,
      componentProps: { league, newSeason },
    });
    await modal.present();
    const { data, role } = await modal.onWillDismiss<League>();
    // follow a rename in the opened league
    if (role === 'confirm' && data && league && this.selectedLeague() === league.name) {
      this.selectedLeague.set(data.name);
    }
    return role;
  }

  private generateScoreChart(isReload?: boolean): void {
    try {
      if (!this.scoreChart) return;

      this.scoreChartInstance = this.chartService.generateScoreChart(
        this.scoreChart,
        this.#detailGamesAscending(),
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

  private generatePinChart(isReload?: boolean): void {
    try {
      if (!this.pinChart) return;

      this.pinChartInstance = this.chartService.generatePinChart(this.pinChart, this.detailStats(), this.pinChartInstance!, isReload);
    } catch (error) {
      this.toastService.showToast(TOAST_MESSAGES.chartGenerationError, 'bug', true);
      console.error('Error generating pin chart:', error);
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
}
