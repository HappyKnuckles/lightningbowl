import { NgIf, NgFor, DatePipe } from '@angular/common';
import { Component, Renderer2, ViewChild, ViewChildren, QueryList, computed, OnInit, input, signal } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { ImpactStyle } from '@capacitor/haptics';
import { Share } from '@capacitor/share';
import { AlertController, InfiniteScrollCustomEvent, ModalController } from '@ionic/angular';
import {
  IonButton,
  IonSelect,
  IonSelectOption,
  IonItemSliding,
  IonAccordionGroup,
  IonItemOption,
  IonIcon,
  IonItemOptions,
  IonItem,
  IonAccordion,
  IonTextarea,
  IonGrid,
  IonRow,
  IonCol,
  IonInput,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonText,
  IonList,
  IonItemDivider,
  IonLabel,
  IonBadge,
  IonModal,
} from '@ionic/angular/standalone';
import { toPng } from 'html-to-image';
import { addIcons } from 'ionicons';
import {
  cloudUploadOutline,
  cloudDownloadOutline,
  filterOutline,
  trashOutline,
  createOutline,
  shareOutline,
  documentTextOutline,
  medalOutline,
  bowlingBallOutline,
  gridOutline,
} from 'ionicons/icons';
import { ToastMessages } from 'src/app/core/constants/toast-messages.constants';
import { Game, Frame, cloneFrames, createThrow } from 'src/app/core/models/game.model';
import { HapticService } from 'src/app/core/services/haptic/haptic.service';
import { LoadingService } from 'src/app/core/services/loader/loading.service';
import { StorageService } from 'src/app/core/services/storage/storage.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { UtilsService } from 'src/app/core/services/utils/utils.service';
import { GenericTypeaheadComponent } from '../generic-typeahead/generic-typeahead.component';
import { createPartialPatternTypeaheadConfig } from '../generic-typeahead/typeahead-configs';
import { TypeaheadConfig } from '../generic-typeahead/typeahead-config.interface';
import { PatternService } from 'src/app/core/services/pattern/pattern.service';
import { Pattern } from 'src/app/core/models/pattern.model';
import { LongPressDirective } from 'src/app/core/directives/long-press/long-press.directive';
import { Router } from '@angular/router';
import { GameGridComponent } from '../game-grid/game-grid.component';
import { BallSelectComponent } from '../ball-select/ball-select.component';
import { alertEnterAnimation, alertLeaveAnimation } from '../../animations/alert.animation';
import { AnalyticsService } from 'src/app/core/services/analytics/analytics.service';
import { BowlingGameValidationService } from 'src/app/core/services/game-utils/bowling-game-validation.service';
import { GameScoreCalculatorService } from 'src/app/core/services/game-score-calculator/game-score-calculator.service';
import { PinDeckFrameRowComponent } from '../pin-deck-frame-row/pin-deck-frame-row.component';
import { GameUtilsService } from 'src/app/core/services/game-utils/game-utils.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

interface MonthHeader {
  name: string;
  count: number;
}

@Component({
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.scss'],
  providers: [DatePipe, ModalController],
  imports: [
    IonModal,
    IonBadge,
    IonLabel,
    IonItemDivider,
    IonList,
    IonText,
    IonInfiniteScrollContent,
    IonInfiniteScroll,
    IonInput,
    IonCol,
    IonRow,
    IonGrid,
    IonTextarea,
    IonAccordion,
    IonItem,
    IonAccordion,
    IonAccordionGroup,
    IonTextarea,
    IonItemOption,
    IonItemOptions,
    IonItem,
    IonItemSliding,
    IonButton,
    IonIcon,
    IonGrid,
    IonRow,
    IonCol,
    IonInput,
    NgIf,
    NgFor,
    IonSelect,
    IonSelectOption,
    ReactiveFormsModule,
    FormsModule,
    LongPressDirective,
    DatePipe,
    GameGridComponent,
    GenericTypeaheadComponent,
    BallSelectComponent,
    PinDeckFrameRowComponent,
    TranslateModule,
  ],
})
export class GameComponent implements OnInit {
  // DOM Elements
  @ViewChild('modal', { static: false }) modal!: IonModal;
  @ViewChild('accordionGroup') accordionGroup!: IonAccordionGroup;
  @ViewChildren(GameGridComponent) gameGrids!: QueryList<GameGridComponent>;

  // Inputs
  games = input.required<Game[]>();
  isLeaguePage = input<boolean>(false);
  gameCount = input<number | undefined>(undefined);

  // Computed Signals
  leagues = computed(() => {
    const savedLeagues = this.storageService.leagues();
    if (!this.games) return savedLeagues;
    const leagueKeys = this.games().reduce((acc: string[], game: Game) => {
      if (game.league && !acc.includes(game.league)) {
        acc.push(game.league);
      }
      return acc;
    }, []);
    return [...new Set([...leagueKeys, ...savedLeagues])];
  });

  sortedGames = computed(() => {
    return [...this.games()].sort((a, b) => b.date - a.date);
  });

  showingGames = computed(() => {
    return this.sortedGames().slice(0, this.loadedCount());
  });

  monthHeaders = computed(() => {
    const games = this.showingGames();
    const headers = new Map<number, MonthHeader>();

    if (games.length === 0) return headers;

    const getMonthKey = (timestamp: number) => {
      const d = new Date(timestamp);
      return `${d.getFullYear()}-${d.getMonth()}`;
    };

    const formatName = (timestamp: number) => {
      const date = new Date(timestamp);
      return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    };

    const counts = new Map<string, number>();
    for (const game of games) {
      const key = getMonthKey(game.date);
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    const firstKey = getMonthKey(games[0].date);
    headers.set(0, {
      name: formatName(games[0].date),
      count: counts.get(firstKey) || 0,
    });

    for (let i = 1; i < games.length; i++) {
      const currentKey = getMonthKey(games[i].date);
      const prevKey = getMonthKey(games[i - 1].date);

      if (currentKey !== prevKey) {
        headers.set(i, {
          name: formatName(games[i].date),
          count: counts.get(currentKey) || 0,
        });
      }
    }

    return headers;
  });

  // State Properties
  private batchSize = 100;
  public loadedCount = signal(this.batchSize);
  public presentingElement?: HTMLElement;
  public isEditMode: Record<string, boolean> = {};
  public delayedCloseMap: Record<string, boolean> = {};
  private originalGameState: Record<string, Game> = {};
  public editedGameStates: Record<string, Game> = {};
  public editedFocus: Record<string, { frameIndex: number; throwIndex: number }> = {};
  private closeTimers: Record<string, NodeJS.Timeout> = {};

  // Config
  patternTypeaheadConfig!: TypeaheadConfig<Partial<Pattern>>;
  enterAnimation = alertEnterAnimation;
  leaveAnimation = alertLeaveAnimation;

  constructor(
    private alertController: AlertController,
    private toastService: ToastService,
    public storageService: StorageService,
    private loadingService: LoadingService,
    private datePipe: DatePipe,
    private hapticService: HapticService,
    private renderer: Renderer2,
    private utilsService: UtilsService,
    private router: Router,
    private modalCtrl: ModalController,
    private patternService: PatternService,
    private analyticsService: AnalyticsService,
    private validationService: BowlingGameValidationService,
    private gameUtilsService: GameUtilsService,
    private gameScoreCalculatorService: GameScoreCalculatorService,
    private translate: TranslateService,
  ) {
    addIcons({
      trashOutline,
      createOutline,
      shareOutline,
      bowlingBallOutline,
      gridOutline,
      documentTextOutline,
      medalOutline,
      cloudUploadOutline,
      cloudDownloadOutline,
      filterOutline,
    });
  }

  ngOnInit(): void {
    this.presentingElement = document.querySelector('.ion-page')!;
    this.patternTypeaheadConfig = createPartialPatternTypeaheadConfig((searchTerm: string) => this.patternService.searchPattern(searchTerm));
  }

  // PAGINATION
  loadMoreGames(event: InfiniteScrollCustomEvent): void {
    setTimeout(() => {
      this.loadedCount.update((count) => count + this.batchSize);
      event.target.complete();
      if (this.loadedCount() >= this.games().length) {
        event.target.disabled = true;
      }
    }, 50);
  }

  // NAVIGATION & UI
  openExpansionPanel(accordionId?: string): void {
    const nativeEl = this.accordionGroup;
    if (nativeEl.value === accordionId) nativeEl.value = undefined;
    else nativeEl.value = accordionId;
  }

  hideContent(event: CustomEvent): void {
    const openGameIds: string[] = event.detail.value || [];

    openGameIds.forEach((gameId) => {
      if (this.closeTimers[gameId]) {
        clearTimeout(this.closeTimers[gameId]);
        delete this.closeTimers[gameId];
      }
      this.delayedCloseMap[gameId] = true;
    });

    Object.keys(this.delayedCloseMap).forEach((gameId) => {
      if (!openGameIds.includes(gameId)) {
        if (!this.closeTimers[gameId]) {
          this.closeTimers[gameId] = setTimeout(() => {
            if (!(this.accordionGroup?.value || []).includes(gameId)) {
              this.delayedCloseMap[gameId] = false;
            }
            delete this.closeTimers[gameId];
          }, 500);
        }
      }
    });
  }

  navigateToBallsPage(balls: string[]): void {
    const searchQuery = balls.join(', ');
    if (this.isLeaguePage()) {
      this.modalCtrl.dismiss();
    }
    this.router.navigate(['tabs/balls'], { queryParams: { search: searchQuery } });
  }

  // GAME ACTIONS (DELETE / SHARE)
  async deleteGame(gameId: string): Promise<void> {
    this.hapticService.vibrate(ImpactStyle.Heavy);
    const alert = await this.alertController.create({
      header: 'Confirm Deletion',
      message: 'Are you sure you want to delete this game?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Delete',
          handler: async () => {
            try {
              await this.storageService.deleteGame(gameId);
              this.toastService.showToast(this.translate.instant(ToastMessages.gameDeleteSuccess), 'remove-outline');
            } catch (error) {
              console.error('Error deleting game:', error);
              this.toastService.showToast(this.translate.instant(ToastMessages.gameDeleteError), 'bug', true);
            }
          },
        },
      ],
    });

    await alert.present();
  }

  async takeScreenshotAndShare(game: Game): Promise<void> {
    this.delayedCloseMap[game.gameId] = true;
    const accordion = document.getElementById(game.gameId);
    if (!accordion) {
      throw new Error('Accordion not found');
    }

    await new Promise((resolve) => setTimeout(resolve, 30));

    const scoreTemplate = accordion.querySelector('.grid-container') as HTMLElement;

    if (!scoreTemplate) {
      throw new Error('Score template not found in the accordion');
    }

    const accordionGroupEl = this.accordionGroup;
    const accordionGroupValues = this.accordionGroup.value;
    const accordionIsOpen = accordionGroupEl.value?.includes(game.gameId) ?? false;

    if (!accordionIsOpen) {
      this.openExpansionPanel(game.gameId);
    }
    const childNode = accordion.childNodes[1] as HTMLElement;

    const originalWidth = childNode.style.width;

    try {
      this.loadingService.setLoading(true);

      this.renderer.setStyle(childNode, 'width', '700px');

      const formattedDate = this.datePipe.transform(game.date, 'dd.MM.yy');

      const messageParts = [
        game.totalScore === 300
          ? `Look at me bitches, perfect game on ${formattedDate}! 🎳🎉.`
          : `Check out this game from ${formattedDate}. A ${game.totalScore}.`,

        game.balls && game.balls.length > 0
          ? game.balls.length === 1
            ? `Bowled with: ${game.balls[0]}`
            : `Bowled with: ${game.balls.join(', ')}`
          : null,

        game.patterns && game.patterns.length > 0 ? `Patterns: ${game.patterns.join(', ')}` : null,
      ];

      const message = messageParts.filter((part) => part !== null).join('\n');

      await new Promise((resolve) => setTimeout(resolve, 100));

      const dataUrl = await toPng(scoreTemplate, { quality: 0.7 });
      const base64Data = dataUrl.split(',')[1];

      if (navigator.share && navigator.canShare({ files: [new File([], '')] })) {
        const blob = await (await fetch(dataUrl)).blob();
        const filesArray = [
          new File([blob], `score_${game.gameId}.png`, {
            type: blob.type,
          }),
        ];

        await navigator.share({
          title: 'Game Score',
          text: message,
          files: filesArray,
        });
      } else {
        const fileName = `score_${game.gameId}.png`;

        await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });

        const fileUri = await Filesystem.getUri({
          directory: Directory.Cache,
          path: fileName,
        });

        await Share.share({
          title: 'Game Score',
          text: message,
          url: fileUri.uri,
          dialogTitle: 'Share Game Score',
        });
        this.toastService.showToast(this.translate.instant(ToastMessages.screenshotShareSuccess), 'share-social-outline');
      }
    } catch (error) {
      console.error('Error taking screenshot and sharing', error);
      this.toastService.showToast(this.translate.instant(ToastMessages.screenshotShareError), 'bug', true);
    } finally {
      this.renderer.setStyle(childNode, 'width', originalWidth);
      this.accordionGroup.value = accordionGroupValues;
      this.delayedCloseMap[game.gameId] = false;
      this.loadingService.setLoading(false);
    }
  }

  // EDIT MODE LIFECYCLE
  saveOriginalStateAndEnableEdit(game: Game): void {
    if (!this.isEditMode[game.gameId]) {
      this.originalGameState[game.gameId] = structuredClone(game);
      this.editedGameStates[game.gameId] = structuredClone(game);

      this.enableEdit(game, game.gameId);

      if (game.isPinMode) {
        const edited = this.editedGameStates[game.gameId];
        let lastFrameIndex = 9;
        let lastThrowIndex = 0;

        for (let i = 9; i >= 0; i--) {
          const f = edited.frames[i];
          if (f && f.throws && f.throws.length > 0) {
            lastFrameIndex = i;
            lastThrowIndex = Math.max(0, f.throws.length - 1);
            break;
          }
        }
        this.editedFocus[game.gameId] = { frameIndex: lastFrameIndex, throwIndex: lastThrowIndex };
      }
    } else {
      this.cancelEdit(game);
    }
  }

  enableEdit(game: Game, accordionId?: string): void {
    this.isEditMode[game.gameId] = !this.isEditMode[game.gameId];
    this.hapticService.vibrate(ImpactStyle.Light);

    if (accordionId) {
      this.openExpansionPanel(accordionId);
      this.delayedCloseMap[game.gameId] = true;
    }
  }

  cancelEdit(game: Game): void {
    const saved = this.originalGameState[game.gameId];
    if (saved) {
      Object.assign(game, saved);
      delete this.originalGameState[game.gameId];
    }

    delete this.editedGameStates[game.gameId];

    if (game.isSeries) {
      this.updateSeries(game, game.league, game.patterns);
    }

    this.isEditMode[game.gameId] = false;
    this.hapticService.vibrate(ImpactStyle.Light);

    const wasOpen = this.delayedCloseMap[game.gameId];
    this.openExpansionPanel(wasOpen ? game.gameId : undefined);
    delete this.delayedCloseMap[game.gameId];
  }

  async saveEdit(game: Game): Promise<void> {
    try {
      const editedState = this.editedGameStates[game.gameId];

      const updatedGame: Game = editedState
        ? {
            ...game,
            frames: editedState.frames,
            frameScores: editedState.frameScores,
            totalScore: editedState.totalScore,
            isPractice: !game.league,
            isPerfect: editedState.totalScore === 300,
            isClean: this.gameUtilsService.calculateIsClean(editedState.frames),
          }
        : {
            ...game,
            isPractice: !game.league,
          };

      if (!this.isGameValid(updatedGame)) {
        this.hapticService.vibrate(ImpactStyle.Heavy);
        this.toastService.showToast(this.translate.instant(ToastMessages.invalidInput), 'bug', true);
        return;
      }

      const originalGameSnapshot = this.originalGameState[game.gameId];
      const leagueChanged = originalGameSnapshot && originalGameSnapshot.league !== updatedGame.league;
      const patternsChanged = originalGameSnapshot && JSON.stringify(originalGameSnapshot.patterns) !== JSON.stringify(updatedGame.patterns);

      if (updatedGame.isSeries && (leagueChanged || patternsChanged)) {
        const seriesIdToUpdate = updatedGame.seriesId;
        const newLeague = updatedGame.league;
        const newPatterns = updatedGame.patterns;
        const newIsPractice = !newLeague;

        await this.storageService.saveGameToLocalStorage(updatedGame);

        const gamesToUpdateInStorage = this.storageService
          .games()
          .filter((g) => g.seriesId === seriesIdToUpdate && g.gameId !== updatedGame.gameId)
          .map((g) => ({
            ...g,
            league: newLeague,
            patterns: newPatterns,
            isPractice: newIsPractice,
          }));
        await this.storageService.saveGamesToLocalStorage(gamesToUpdateInStorage);
      } else {
        await this.storageService.saveGameToLocalStorage(updatedGame);
      }

      this.toastService.showToast(this.translate.instant(ToastMessages.gameUpdateSuccess), 'refresh-outline');
      this.isEditMode[game.gameId] = false;
      this.hapticService.vibrate(ImpactStyle.Light);

      const wasOpen = this.delayedCloseMap[game.gameId];
      this.openExpansionPanel(wasOpen ? game.gameId : undefined);

      this.analyticsService.trackGameEdited();
      delete this.originalGameState[game.gameId];
      delete this.editedGameStates[game.gameId];
      delete this.delayedCloseMap[game.gameId];
    } catch (error) {
      this.toastService.showToast(this.translate.instant(ToastMessages.gameUpdateError), 'bug', true);
      console.error('Error saving game edit:', error);
    }
  }

  // PIN MODE LOGIC & INTERACTION
  onScoreCellClick(game: Game, frameIndex: number, throwIndex: number): void {
    if (!this.isEditMode[game.gameId] || !game.isPinMode) return;

    const editedGame = this.editedGameStates[game.gameId];
    const canClick = this.gameUtilsService.isCellAccessible(editedGame.frames, frameIndex, throwIndex);

    if (canClick) {
      this.editedFocus[game.gameId] = { frameIndex, throwIndex };
    }
  }

  onPinThrowConfirmed(event: { pinsKnockedDown: number[] }, game: Game): void {
    if (!this.isEditMode[game.gameId] || !game.isPinMode) return;

    const focus = this.editedFocus[game.gameId] || { frameIndex: 0, throwIndex: 0 };
    const editedGame = this.editedGameStates[game.gameId] || structuredClone(game);

    const result = this.gameUtilsService.processPinThrow(editedGame.frames, focus.frameIndex, focus.throwIndex, event.pinsKnockedDown || []);

    this.editedFocus[game.gameId] = {
      frameIndex: result.nextFrameIndex,
      throwIndex: result.nextThrowIndex,
    };

    this.updateEditedGameWithNewFrames(game.gameId, result.updatedFrames);
  }

  handlePinUndoRequested(game: Game): void {
    if (!this.isEditMode[game.gameId] || !game.isPinMode) return;
    const focus = this.editedFocus[game.gameId];
    if (!focus) return;

    const editedGame = this.editedGameStates[game.gameId];

    const result = this.gameUtilsService.applyPinModeUndo(editedGame.frames, focus.frameIndex, focus.throwIndex);

    if (!result) return;

    this.editedFocus[game.gameId] = {
      frameIndex: result.nextFrameIndex,
      throwIndex: result.nextThrowIndex,
    };

    this.updateEditedGameWithNewFrames(game.gameId, result.updatedFrames);
  }

  getPinsLeftStandingForEditedGame(game: Game): number[] {
    const focus = this.editedFocus[game.gameId];
    if (!focus) return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    const editedGame = this.editedGameStates[game.gameId];
    const frame = editedGame.frames[focus.frameIndex];
    const throws = frame.throws || [];

    return this.gameUtilsService.getAvailablePins(focus.frameIndex, focus.throwIndex, throws);
  }

  canRecordStrike(game: Game): boolean {
    const pinsLeft = this.getPinsLeftStandingForEditedGame(game);
    return pinsLeft.length === 10;
  }

  canRecordSpare(game: Game): boolean {
    const pinsLeft = this.getPinsLeftStandingForEditedGame(game);
    return pinsLeft.length > 0 && pinsLeft.length < 10;
  }

  canUndoForPinMode(game: Game): boolean {
    const focus = this.editedFocus[game.gameId];
    if (!focus) return false;

    const editedGame = this.editedGameStates[game.gameId];

    return this.validationService.canUndoLastThrow(editedGame.frames, focus.frameIndex, focus.throwIndex);
  }

  // INPUT HANDLING
  onEditThrowInput(event: { frameIndex: number; throwIndex: number; value: string }, game: Game): void {
    const { frameIndex, throwIndex, value } = event;

    const editedGame = this.editedGameStates[game.gameId] || structuredClone(game);
    const frames = cloneFrames(editedGame.frames);

    if (value.length === 0) {
      this.removeThrow(frames, frameIndex, throwIndex);
      this.updateEditedGameWithNewFrames(game.gameId, frames);
      return;
    }

    const parsedValue = this.gameUtilsService.parseInputValue(value, frameIndex, throwIndex, frames);

    if (!this.utilsService.isValidNumber0to10(parsedValue)) {
      this.handleEditInvalidInput(game.gameId, frameIndex, throwIndex);
      return;
    }

    if (!this.validationService.isValidFrameScore(parsedValue, frameIndex, throwIndex, frames)) {
      this.handleEditInvalidInput(game.gameId, frameIndex, throwIndex);
      return;
    }

    this.recordThrow(frames, frameIndex, throwIndex, parsedValue);
    this.updateEditedGameWithNewFrames(game.gameId, frames);

    const grid = this.gameGrids.find((g) => g.game()?.gameId === game.gameId);
    if (grid) {
      grid.focusNextInput(frameIndex, throwIndex);
    }
  }

  private handleEditInvalidInput(gameId: string, frameIndex: number, throwIndex: number): void {
    this.hapticService.vibrate(ImpactStyle.Heavy);
    const grid = this.gameGrids.find((g) => g.game()?.gameId === gameId);
    if (grid) {
      grid.handleInvalidInput(frameIndex, throwIndex);
    }
  }

  // GAME STATE UPDATE HANDLERS
  private recordThrow(frames: Frame[], frameIndex: number, throwIndex: number, value: number): void {
    const frame = frames[frameIndex];
    if (!frame) return;

    while (frame.throws.length <= throwIndex) {
      frame.throws.push(createThrow(0, frame.throws.length + 1));
    }

    frame.throws[throwIndex] = createThrow(value, throwIndex + 1);
  }

  private removeThrow(frames: Frame[], frameIndex: number, throwIndex: number): void {
    const frame = frames[frameIndex];
    if (!frame || !frame.throws) return;

    if (throwIndex >= 0 && throwIndex < frame.throws.length) {
      frame.throws.splice(throwIndex, 1);
      frame.throws.forEach((t, idx) => {
        t.throwIndex = idx + 1;
      });
    }
  }

  private updateEditedGameWithNewFrames(gameId: string, frames: Frame[]): void {
    const scoreResult = this.gameScoreCalculatorService.calculateScoreFromFrames(frames);
    const editedGame = this.editedGameStates[gameId];

    if (editedGame) {
      this.editedGameStates[gameId] = {
        ...editedGame,
        frames,
        frameScores: scoreResult.frameScores,
        totalScore: scoreResult.totalScore,
      };
    }
  }

  updateSeries(game: Game, league?: string, patterns?: string[]): void {
    if (!game.isSeries) return;

    this.storageService.games.update((gamesArr) =>
      gamesArr.map((g) => {
        if (g.seriesId === game.seriesId) {
          return {
            ...g,
            ...(league !== undefined && { league }),
            ...(patterns !== undefined && { patterns }),
          };
        }
        return g;
      }),
    );
  }

  onBallSelect(selectedBalls: string[], game: Game, modal: IonModal): void {
    modal.dismiss();
    game.balls = selectedBalls;
  }

  // VALIDATION & HELPERS
  isGameValid(game: Game): boolean {
    return this.validationService.isGameValid(game);
  }

  parseIntValue(value: unknown): number {
    return this.utilsService.parseIntValue(value) as number;
  }

  getSelectedBallsText(game: Game): string {
    const balls = game.balls || [];
    return balls.length > 0 ? balls.join(', ') : 'None';
  }
}
