import { DatePipe, NgIf, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal, viewChild, viewChildren } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ImpactStyle } from '@capacitor/haptics';
import { AlertController, InfiniteScrollCustomEvent, ModalController } from '@ionic/angular';
import {
  IonAccordion,
  IonAccordionGroup,
  IonBadge,
  IonButton,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonItem,
  IonItemDivider,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonModal,
  IonText,
  IonTextarea,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  bowlingBallOutline,
  cloudDownloadOutline,
  cloudUploadOutline,
  createOutline,
  documentTextOutline,
  filterOutline,
  gridOutline,
  layersOutline,
  shareOutline,
  trashOutline,
  trophyOutline,
} from 'ionicons/icons';

import { TOAST_MESSAGES } from 'src/app/core/constants/toast-messages.constants';
import { Game } from 'src/app/core/models/game.model';
import { Pattern } from 'src/app/core/models/pattern.model';
import { GameEditService } from 'src/app/core/services/game-edit/game-edit.service';
import { GameShareService } from 'src/app/core/services/game-share/game-share.service';
import { HapticService } from 'src/app/core/services/haptic/haptic.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { GamesStore } from 'src/app/core/stores/games.store';
import { PatternsStore } from 'src/app/core/stores/patterns.store';
import { SettingsStore } from 'src/app/core/stores/settings.store';
import { isGameValid } from 'src/app/core/utils/game-utils/game-validation.utils';
import { UtilsService } from 'src/app/core/utils/utils.service';

import { AccordionDelayedCloseDirective } from 'src/app/core/directives/accordion-delayed-close/accordion-delayed-close.directive';
import { LongPressDirective } from 'src/app/core/directives/long-press/long-press.directive';
import { Ball } from 'src/app/core/models/ball.model';
import { TypeaheadConfig } from 'src/app/core/models/typeahead-config.model';
import { TypeaheadConfigService } from 'src/app/core/services/typeahead-config/typeahead-config.service';
import { alertEnterAnimation, alertLeaveAnimation } from '../../animations/alert.animation';
import { BallSelectComponent } from '../ball-select/ball-select.component';
import { GameReadonlyComponent } from '../game-readonly/game-readonly.component';
import { GameComponent } from '../game/game.component';
import { GenericTypeaheadComponent } from '../generic-typeahead/generic-typeahead.component';
import { GameCardTemplateDirective } from './game-card-template.directive';
import { LeagueSelectorComponent } from '../league-selector/league-selector.component';

interface MonthRow {
  kind: 'month';
  id: string;
  name: string;
  count: number;
}

interface SingleRow {
  kind: 'single';
  id: string;
  game: Game;
  title: string;
  meta: string;
  numberTag: string;
}

interface SeriesRow {
  kind: 'series';
  id: string;
  games: Game[];
  count: number;
  total: number;
  avg: number;
  firstNumber: number;
  lastNumber: number;
}

type DisplayRow = MonthRow | SingleRow | SeriesRow;

@Component({
  selector: 'app-game-list',
  templateUrl: './game-list.component.html',
  styleUrls: ['./game-list.component.scss'],
  providers: [DatePipe, ModalController, GameEditService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonModal,
    IonBadge,
    IonLabel,
    IonItemDivider,
    IonList,
    IonText,
    IonInfiniteScrollContent,
    IonInfiniteScroll,
    IonTextarea,
    IonAccordion,
    IonItem,
    IonAccordionGroup,
    IonItemOption,
    IonItemOptions,
    IonItemSliding,
    IonButton,
    IonIcon,
    NgIf,
    NgTemplateOutlet,
    ReactiveFormsModule,
    FormsModule,
    DatePipe,
    LongPressDirective,
    AccordionDelayedCloseDirective,
    GameCardTemplateDirective,
    GameComponent,
    GameReadonlyComponent,
    GenericTypeaheadComponent,
    BallSelectComponent,
    LeagueSelectorComponent,
  ],
})
export class GameListComponent implements OnInit {
  // Services
  public editService = inject(GameEditService);
  public gamesStore = inject(GamesStore);
  public ballsStore = inject(BallsStore);

  public settingsStore = inject(SettingsStore);
  public patternsStore = inject(PatternsStore);
  private alertController = inject(AlertController);
  private toastService = inject(ToastService);

  private hapticService = inject(HapticService);
  private utilsService = inject(UtilsService);
  private router = inject(Router);
  private modalCtrl = inject(ModalController);
  private shareService = inject(GameShareService);

  private typeaheadConfigService = inject(TypeaheadConfigService);
  // Inputs
  games = input.required<Game[]>();
  isLeaguePage = input<boolean>(false);
  batchSize = input<number>(100);
  initialBatchSize = input<number>(25);
  // DOM
  accordionGroup = viewChild.required<IonAccordionGroup>('accordionGroup');
  delayedClose = viewChild.required(AccordionDelayedCloseDirective);
  gameComponents = viewChildren(GameComponent);

  // Computed
  leagues = computed(() => {
    return this.games().reduce((acc: string[], game: Game) => {
      if (game.league && !acc.includes(game.league)) acc.push(game.league);
      return acc;
    }, []);
  });

  sortedGames = computed(() => [...this.games()].sort((a, b) => b.date - a.date));

  // Pagination state
  public loadedCount = signal(0);

  showingGames = computed(() => {
    const games = this.sortedGames();
    let end = Math.min(this.loadedCount(), games.length);

    // Never cut a series at the pagination boundary — extend to the end of its run.
    const boundarySeriesId = end > 0 ? games[end - 1].seriesId : undefined;
    if (boundarySeriesId) {
      while (end < games.length && games[end].seriesId === boundarySeriesId) end++;
    }

    return games.slice(0, end);
  });

  gameNumberMap = computed(() => {
    const allGames = this.sortedGames();
    const total = allGames.length;
    const map = new Map<string, number>();
    allGames.forEach((game, idx) => map.set(game.gameId, total - idx));
    return map;
  });

  // One pass over the (date-sorted) visible games producing the rows the template renders:
  // month dividers, standalone games, and multi-game series (adjacent games sharing a
  // seriesId) with their combined total and average.
  displayRows = computed<DisplayRow[]>(() => {
    const games = this.showingGames();
    const numbers = this.gameNumberMap();
    const onLeaguePage = this.isLeaguePage();
    const rows: DisplayRow[] = [];

    const getMonthKey = (timestamp: number) => {
      const d = new Date(timestamp);
      return `${d.getFullYear()}-${d.getMonth()}`;
    };

    const monthCounts = new Map<string, number>();
    for (const game of games) {
      const key = getMonthKey(game.date);
      monthCounts.set(key, (monthCounts.get(key) || 0) + 1);
    }

    let currentMonthKey = '';
    let i = 0;
    while (i < games.length) {
      const game = games[i];

      const monthKey = getMonthKey(game.date);
      if (monthKey !== currentMonthKey) {
        currentMonthKey = monthKey;
        rows.push({
          kind: 'month',
          id: `month-${monthKey}`,
          name: new Date(game.date).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
          count: monthCounts.get(monthKey) || 0,
        });
      }

      if (game.seriesId) {
        let j = i;
        while (j < games.length && games[j].seriesId === game.seriesId) j++;

        if (j - i > 1) {
          // Chronological inside the series block (#1 first), unlike the newest-first outer list.
          const run = games.slice(i, j).reverse();
          const total = run.reduce((sum, g) => sum + g.totalScore, 0);
          rows.push({
            kind: 'series',
            id: `series-${run[0].gameId}`,
            games: run,
            count: run.length,
            total,
            avg: Math.round(total / run.length),
            firstNumber: numbers.get(run[0].gameId) ?? 0,
            lastNumber: numbers.get(run[run.length - 1].gameId) ?? 0,
          });
          i = j;
          continue;
        }
      }

      const number = numbers.get(game.gameId) ?? 0;
      rows.push({
        kind: 'single',
        id: game.gameId,
        game,
        title: onLeaguePage ? `Game ${number}` : game.league || 'Practice',
        meta: game.patterns && game.patterns.length > 0 ? game.patterns.join(', ') : '',
        numberTag: onLeaguePage ? '' : `#${number}`,
      });
      i++;
    }

    return rows;
  });
  // Series header editing (league/patterns preview in memory, persist on Save)
  editingSeriesId = signal<string | null>(null);

  public presentingElement?: HTMLElement;
  // Config
  patternTypeaheadConfig: TypeaheadConfig<Partial<Pattern>> = this.typeaheadConfigService.partialPattern;

  ballTypeaheadConfig: TypeaheadConfig<Ball> = this.typeaheadConfigService.ball;

  enterAnimation = alertEnterAnimation;
  leaveAnimation = alertLeaveAnimation;

  private seriesEditSnapshots = new Map<string, { game: Game; league: string; patterns: string[] }>();
  // Accordion open state per game before editing started, restored when editing ends
  private editAccordionWasOpen = new Map<string, boolean>();

  constructor() {
    addIcons({
      trashOutline,
      createOutline,
      shareOutline,
      bowlingBallOutline,
      gridOutline,
      documentTextOutline,
      trophyOutline,
      cloudUploadOutline,
      cloudDownloadOutline,
      filterOutline,
      layersOutline,
    });
  }

  ngOnInit(): void {
    this.loadedCount.set(this.initialBatchSize());

    this.presentingElement = document.querySelector('.ion-page')!;
  }

  // PAGINATION
  loadMoreGames(event: InfiniteScrollCustomEvent): void {
    setTimeout(() => {
      this.loadedCount.update((count) => count + this.batchSize());
      event.target.complete();
    }, 50);
  }

  // NAVIGATION
  navigateToBallsPage(balls: string[]): void {
    const searchQuery = balls.join(', ');
    if (this.isLeaguePage()) this.modalCtrl.dismiss();
    this.router.navigate(['tabs/balls'], { queryParams: { search: searchQuery } });
  }

  // DELETE
  async deleteGame(gameId: string): Promise<void> {
    this.hapticService.vibrate(ImpactStyle.Heavy);
    const alert = await this.alertController.create({
      header: 'Confirm Deletion',
      message: 'Are you sure you want to delete this game?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          handler: async () => {
            try {
              await this.gamesStore.deleteGame(gameId);
              this.toastService.showToast(TOAST_MESSAGES.gameDeleteSuccess, 'remove-outline');
            } catch (error) {
              console.error('Error deleting game:', error);
              this.toastService.showToast(TOAST_MESSAGES.gameDeleteError, 'bug', true);
            }
          },
        },
      ],
    });
    await alert.present();
  }

  async deleteSeries(row: SeriesRow): Promise<void> {
    this.hapticService.vibrate(ImpactStyle.Heavy);
    const seriesId = row.games[0].seriesId;
    const seriesGames = this.gamesStore.games().filter((g) => g.seriesId === seriesId);
    const alert = await this.alertController.create({
      header: 'Confirm Deletion',
      message: `Are you sure you want to delete this series and its ${seriesGames.length} games?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          handler: async () => {
            try {
              for (const game of seriesGames) {
                await this.gamesStore.deleteGame(game.gameId);
              }
              this.toastService.showToast(TOAST_MESSAGES.seriesDeleteSuccess, 'remove-outline');
            } catch (error) {
              console.error('Error deleting series:', error);
              this.toastService.showToast(TOAST_MESSAGES.seriesDeleteError, 'bug', true);
            }
          },
        },
      ],
    });
    await alert.present();
  }

  // SHARE
  async takeScreenshotAndShare(game: Game): Promise<void> {
    this.delayedClose().markVisible(game.gameId);

    const accordion = document.getElementById(game.gameId);
    if (!accordion) {
      console.error('Accordion not found');
      return;
    }

    await new Promise((r) => setTimeout(r, 30));

    const scoreTemplate = accordion.querySelector('.grid-container') as HTMLElement;
    if (!scoreTemplate) {
      console.error('Score template not found');
      return;
    }

    const previousValue = this.accordionGroup().value;
    if (!this.isAccordionOpen(game.gameId)) this.openAccordion(game.gameId);

    try {
      await this.shareService.shareGame(game, scoreTemplate);
    } finally {
      this.accordionGroup().value = previousValue;
      this.delayedClose().clear(game.gameId);
    }
  }

  // EDIT
  saveOriginalStateAndEnableEdit(game: Game): void {
    if (!this.editService.isEditMode(game.gameId)) {
      this.editAccordionWasOpen.set(game.gameId, this.isAccordionOpen(game.gameId));
      this.editService.startEdit(game);
      this.openAccordion(game.gameId);
      this.delayedClose().markVisible(game.gameId);
    } else {
      this.cancelEdit(game);
    }
  }

  cancelEdit(game: Game): void {
    this.editService.cancelEdit(game);
    this.restoreAccordionAfterEdit(game.gameId);
  }

  async saveEdit(game: Game): Promise<void> {
    const success = await this.editService.saveEdit(game);
    if (!success) return;

    this.restoreAccordionAfterEdit(game.gameId);
  }

  // EDIT INPUT
  onEditThrowInput(event: { frameIndex: number; throwIndex: number; value: string }, game: Game): void {
    const result = this.editService.handleThrowInput(event, game);

    if (result === 'invalid') {
      const grid = this.gameComponents().find((g) => g.game()?.gameId === game.gameId);
      grid?.handleInvalidInput(event.frameIndex, event.throwIndex);
      return;
    }

    if (result === 'recorded') {
      const grid = this.gameComponents().find((g) => g.game()?.gameId === game.gameId);
      grid?.focusNextInput(event.frameIndex, event.throwIndex);
    }
  }

  // PIN MODE
  onScoreCellClick(game: Game, frameIndex: number, throwIndex: number): void {
    this.editService.selectCell(game, frameIndex, throwIndex);
  }

  onPinThrowConfirmed(event: { pinsKnockedDown: number[] }, game: Game): void {
    this.editService.confirmPinThrow(event.pinsKnockedDown ?? [], game);
  }

  handlePinUndoRequested(game: Game): void {
    this.editService.undoPinThrow(game);
  }

  getPinsLeftStandingForEditedGame(game: Game): number[] {
    return this.editService.getPinsLeftStanding(game);
  }

  canRecordStrike(game: Game): boolean {
    return this.editService.canRecordStrike(game);
  }

  canRecordSpare(game: Game): boolean {
    return this.editService.canRecordSpare(game);
  }

  canUndoForPinMode(game: Game): boolean {
    return this.editService.canUndoPinThrow(game);
  }

  // BALLS / SERIES
  onBallAdd(ballIds: string[], game: Game, modal: IonModal) {
    const allBalls = this.ballsStore.allBalls();
    const selected = ballIds.map((id) => allBalls.find((b) => b.ball_id === id)).filter((b): b is Ball => !!b);
    this.onBallSelect(
      selected.map((b) => b.ball_name),
      game,
      modal,
    );
    this.saveBallToArsenal(selected);
  }

  onBallSelect(selectedBalls: string[], game: Game, modal: IonModal): void {
    modal.dismiss();
    game.balls = selectedBalls;
  }

  updateSeries(game: Game, league?: string, patterns?: string[]): void {
    this.editService.propagateSeriesFields(game, league, patterns);
  }

  // SERIES HEADER EDIT
  toggleSeriesEdit(row: SeriesRow): void {
    const openId = this.editingSeriesId();
    if (openId === row.id) {
      this.cancelSeriesEdit(row);
      return;
    }
    if (openId) this.revertSeriesEdit(openId);

    const lead = row.games[0];
    this.seriesEditSnapshots.set(row.id, { game: lead, league: lead.league ?? '', patterns: [...lead.patterns] });
    this.editingSeriesId.set(row.id);
  }

  cancelSeriesEdit(row: SeriesRow): void {
    this.revertSeriesEdit(row.id);
    this.editingSeriesId.set(null);
  }

  async saveSeriesEdit(row: SeriesRow): Promise<void> {
    const lead = row.games[0];
    await this.editService.saveSeriesFields(lead, lead.league ?? '', lead.patterns);
    this.seriesEditSnapshots.delete(row.id);
    this.editingSeriesId.set(null);
  }

  onSeriesLeagueChanged(row: SeriesRow, league: string): void {
    this.editService.propagateSeriesFields(row.games[0], league);
  }

  onSeriesPatternsChanged(row: SeriesRow, patterns: string[]): void {
    this.editService.propagateSeriesFields(row.games[0], undefined, patterns);
  }

  // LEAGUE
  onEditLeagueChanged(game: Game, league: string): void {
    game.league = league;
    this.updateSeries(game, league);
  }

  // HELPERS
  isGameValid(game: Game): boolean {
    return isGameValid(game);
  }

  parseIntValue(value: string): number {
    return this.utilsService.parseIntValue(value) as number;
  }

  getSelectedBallsText(game: Game): string {
    const balls = game.balls || [];
    return balls.length > 0 ? balls.join(', ') : 'None';
  }

  getBallIds(names: string[] | undefined): string[] {
    if (!names) return [];

    return this.ballsStore
      .allBalls()
      .filter((ball) => names.includes(ball.ball_name))
      .map((ball) => ball.ball_id);
  }

  // ACCORDION
  private isAccordionOpen(accordionId: string): boolean {
    const value = this.accordionGroup().value;
    return Array.isArray(value) ? value.includes(accordionId) : value === accordionId;
  }

  private openAccordion(accordionId: string): void {
    if (this.isAccordionOpen(accordionId)) return;
    const value = this.accordionGroup().value;
    const open = Array.isArray(value) ? value : value ? [value] : [];
    this.accordionGroup().value = [...open, accordionId];
  }

  private closeAccordion(accordionId: string): void {
    const value = this.accordionGroup().value;
    const open = Array.isArray(value) ? value : value ? [value] : [];
    this.accordionGroup().value = open.filter((id) => id !== accordionId);
  }

  // Editing always opens the accordion; afterwards it returns to its pre-edit state.
  private restoreAccordionAfterEdit(gameId: string): void {
    const wasOpen = this.editAccordionWasOpen.get(gameId) ?? false;
    this.editAccordionWasOpen.delete(gameId);

    if (!wasOpen) {
      this.closeAccordion(gameId);
      this.delayedClose().clear(gameId);
    }
  }

  private revertSeriesEdit(rowId: string): void {
    const snapshot = this.seriesEditSnapshots.get(rowId);
    if (snapshot) this.editService.propagateSeriesFields(snapshot.game, snapshot.league, snapshot.patterns);
    this.seriesEditSnapshots.delete(rowId);
  }

  private async saveBallToArsenal(balls: Ball[]): Promise<void> {
    const failed = await this.ballsStore.saveBallsToArsenal(balls);
    const saved = balls.filter((b) => !failed.includes(b));

    if (saved.length) {
      this.toastService.showToast(`Balls added to arsenal: ${saved.map((b) => b.ball_name).join(', ')}`, 'checkmark-outline');
    }
    if (failed.length) {
      this.toastService.showToast(`Failed to add: ${failed.map((b) => b.ball_name).join(', ')}.`, 'bug', true);
    }
  }
}
