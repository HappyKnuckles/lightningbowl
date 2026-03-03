import { Component, CUSTOM_ELEMENTS_SCHEMA, ElementRef, ViewChild, ViewChildren, QueryList, computed, Signal, signal, effect } from '@angular/core';
import { DecimalPipe, NgIf } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
  IonContent,
  IonHeader,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
  IonButton,
  IonButtons,
  IonIcon,
  IonText,
  IonItem,
  IonLabel,
  IonItemSliding,
  IonItemOption,
  IonItemOptions,
  IonModal,
  IonRefresher,
  IonSegmentView,
  IonSegmentContent,
} from '@ionic/angular/standalone';
import { StorageService } from 'src/app/core/services/storage/storage.service';
import { addIcons } from 'ionicons';
import {
  chevronForward,
  trashOutline,
  createOutline,
  documentTextOutline,
  shareOutline,
  medalOutline,
  cameraOutline,
  addOutline,
  chevronBack,
  checkmarkOutline,
} from 'ionicons/icons';
import { Game } from 'src/app/core/models/game.model';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { AlertController, RefresherCustomEvent, SegmentCustomEvent } from '@ionic/angular';
import { LoadingService } from 'src/app/core/services/loader/loading.service';
import { BestBallStats, Stats } from 'src/app/core/models/stats.model';
import { GameStatsService } from 'src/app/core/services/game-stats/game-stats.service';
import { HapticService } from 'src/app/core/services/haptic/haptic.service';
import { ImpactStyle } from '@capacitor/haptics';
import { SortUtilsService } from 'src/app/core/services/sort-utils/sort-utils.service';
import Chart from 'chart.js/auto';
import { ChartGenerationService } from 'src/app/core/services/chart/chart-generation.service';
import { leagueStatDefinitions } from '../../core/constants/stats.definitions.constants';
import { ToastMessages } from 'src/app/core/constants/toast-messages.constants';
import { GameComponent } from 'src/app/shared/components/game/game.component';
import { SpareDisplayComponent } from 'src/app/shared/components/spare-display/spare-display.component';
import { StatDisplayComponent } from 'src/app/shared/components/stat-display/stat-display.component';
import { LongPressDirective } from 'src/app/core/directives/long-press/long-press.directive';
import { HiddenLeagueSelectionService } from 'src/app/core/services/hidden-league/hidden-league.service';
import { BallStatsComponent } from '../../shared/components/ball-stats/ball-stats.component';
import { AnalyticsService } from 'src/app/core/services/analytics/analytics.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

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
    FormsModule,
    GameComponent,
    ReactiveFormsModule,
    NgIf,
    DecimalPipe,
    StatDisplayComponent,
    SpareDisplayComponent,
    IonSegmentButton,
    IonSegment,
    IonSegmentView,
    IonSegmentContent,
    LongPressDirective,
    BallStatsComponent,
    TranslateModule,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class LeaguePage {
  @ViewChild('modalContent') content!: IonContent;
  @ViewChildren('modal') modals!: QueryList<IonModal>;
  @ViewChild('scoreChart', { static: false }) scoreChart?: ElementRef;
  @ViewChild('pinChart', { static: false }) pinChart?: ElementRef;
  selectedSegment = 'Overall';
  segments: string[] = ['Overall', 'Spares', 'Games'];
  isEditMode: Record<string, boolean> = {};
  gamesByLeague: Signal<Record<string, Game[]>> = computed(() => {
    const games = this.storageService.games();
    return this.sortUtilsService.sortGamesByLeagues(games, true);
  });
  leagueKeys: Signal<string[]> = computed(() => {
    return Object.keys(this.gamesByLeague());
  });
  overallStats: Signal<Stats> = computed(() => {
    const games = this.storageService.games();
    return this.statService.calculateBowlingStats(games);
  });
  gamesByLeagueReverse: Signal<Record<string, Game[]>> = computed(() => {
    const gamesByLeague = this.gamesByLeague();
    const gamesByLeagueReverse: Record<string, Game[]> = {};

    Object.keys(gamesByLeague).forEach((league) => {
      gamesByLeagueReverse[league] = this.sortUtilsService.sortGameHistoryByDate(gamesByLeague[league] || [], true);
    });

    return gamesByLeagueReverse;
  });
  statsByLeague: Signal<Record<string, Stats>> = computed(() => {
    const gamesByLeague = this.gamesByLeague();
    const statsByLeague: Record<string, Stats> = {};

    Object.keys(gamesByLeague).forEach((league) => {
      statsByLeague[league] = this.statService.calculateBowlingStats(gamesByLeague[league] || []);
    });

    return statsByLeague;
  });

  bestBallsByLeague: Signal<Record<string, BestBallStats>> = computed(() => {
    const gamesByLeague = this.gamesByLeague();
    const bestBallsByLeague: Record<string, BestBallStats> = {};
    Object.keys(gamesByLeague).forEach((league) => {
      bestBallsByLeague[league] = this.statService.calculateBestBallStats(gamesByLeague[league] || []);
    });
    return bestBallsByLeague;
  });

  mostPlayedBallsByLeague: Signal<Record<string, BestBallStats>> = computed(() => {
    const gamesByLeague = this.gamesByLeague();
    const mostUsedBallsByLeague: Record<string, BestBallStats> = {};
    Object.keys(gamesByLeague).forEach((league) => {
      mostUsedBallsByLeague[league] = this.statService.calculateMostPlayedBall(gamesByLeague[league] || []);
    });
    return mostUsedBallsByLeague;
  });

  statDefinitions = leagueStatDefinitions;
  private scoreChartInstances: Record<string, Chart> = {};
  private pinChartInstances: Record<string, Chart> = {};

  isVisibilityEdit = signal(false);
  get noLeaguesShown(): boolean {
    const state = this.hiddenLeagueSelectionService.selectionState();

    return !Object.values(state).some((isVisible) => isVisible);
  }

  get leagueSelectionState() {
    return this.hiddenLeagueSelectionService.selectionState();
  }
  private previousLeagueSelectionState: Record<string, boolean> = {};

  constructor(
    public storageService: StorageService,
    private sortUtilsService: SortUtilsService,
    private hapticService: HapticService,
    private statService: GameStatsService,
    public loadingService: LoadingService,
    private alertController: AlertController,
    private toastService: ToastService,
    private chartService: ChartGenerationService,
    private hiddenLeagueSelectionService: HiddenLeagueSelectionService,
    private analyticsService: AnalyticsService,
    private translate: TranslateService,
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
      medalOutline,
    });
    effect(
      () => {
        this.hiddenLeagueSelectionService.setAvailableLeagues(this.leagueKeys());
      },
      { allowSignalWrites: true },
    );
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
      this.toastService.showToast(this.translate.instant(ToastMessages.leagueEditMode), 'eye-outline');
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
    try {
      this.hapticService.vibrate(ImpactStyle.Medium);
      await this.storageService.loadGameHistory();
    } catch (error) {
      console.error(error);
      this.toastService.showToast(this.translate.instant(ToastMessages.gameLoadError), 'bug', true);
    } finally {
      event.target.complete();
    }
  }

  closeModal(league: string): void {
    this.selectedSegment = 'Overall';
    const modalToDismiss = this.modals.find((modal) => modal.trigger === league);

    if (modalToDismiss) {
      modalToDismiss.dismiss();
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
    if (this.storageService.games().length > 0) {
      if (this.selectedSegment === 'Overall') {
        this.generateScoreChart(league, isReload);
      } else if (this.selectedSegment === 'Spares') {
        this.generatePinChart(league, isReload);
      }
    }
  }

  async saveLeague(league: string): Promise<void> {
    try {
      await this.storageService.addLeague(league);
      this.toastService.showToast(this.translate.instant(ToastMessages.leagueSaveSuccess), 'add');
    } catch (error) {
      this.toastService.showToast(this.translate.instant(ToastMessages.leagueSaveError), 'bug', true);
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
              await this.storageService.addLeague(data.league);
              this.toastService.showToast(this.translate.instant(ToastMessages.leagueSaveSuccess), 'add');

              void this.analyticsService.trackLeagueCreated({ name: data.league });
            } catch (error) {
              this.toastService.showToast(this.translate.instant(ToastMessages.leagueSaveError), 'bug', true);
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
          // handler: () => { },
        },
        {
          text: 'Delete',
          handler: async () => {
            try {
              await this.storageService.deleteLeague(league);
              this.toastService.showToast(this.translate.instant(ToastMessages.leagueDeleteSuccess), 'remove-outline');
            } catch (error) {
              this.toastService.showToast(this.translate.instant(ToastMessages.leagueDeleteError), 'bug', true);
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
            const newLeagueName = data.league;
            const oldLeagueName = league;
            try {
              await this.storageService.editLeague(newLeagueName, oldLeagueName);
              this.toastService.showToast(this.translate.instant(ToastMessages.leagueEditSuccess), 'checkmark-outline');
            } catch (error) {
              this.toastService.showToast(this.translate.instant(ToastMessages.leagueEditError), 'bug', true);
              console.error('Error editing league:', error);
            }
          },
        },
      ],
    });

    await alert.present();
  }

  private generateScoreChart(league: string, isReload?: boolean): void {
    try {
      if (!this.scoreChart) {
        return;
      }

      this.scoreChartInstances[league] = this.chartService.generateScoreChart(
        this.scoreChart,
        this.gamesByLeagueReverse()[league],
        this.scoreChartInstances[league]!,
        undefined,
        undefined,
        isReload,
      );
    } catch (error) {
      this.toastService.showToast(this.translate.instant(ToastMessages.chartGenerationError), 'bug', true);
      console.error('Error generating score chart:', error);
    }
  }

  private generatePinChart(league: string, isReload?: boolean): void {
    try {
      if (!this.pinChart) {
        return;
      }

      this.pinChartInstances[league] = this.chartService.generatePinChart(
        this.pinChart,
        this.statsByLeague()[league],
        this.pinChartInstances[league]!,
        isReload,
      );
    } catch (error) {
      this.toastService.showToast(this.translate.instant(ToastMessages.chartGenerationError), 'bug', true);
      console.error('Error generating pin chart:', error);
    }
  }
}
