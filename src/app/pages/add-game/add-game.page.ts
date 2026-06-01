import { NgFor, NgIf } from '@angular/common';
import { Component, computed, CUSTOM_ELEMENTS_SCHEMA, effect, OnInit, QueryList, signal, untracked, ViewChild, ViewChildren } from '@angular/core';
import { ImpactStyle } from '@capacitor/haptics';
import { InputCustomEvent, ModalController, SegmentCustomEvent } from '@ionic/angular';
import {
  ActionSheetController,
  AlertController,
  IonAlert,
  IonButton,
  IonButtons,
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonIcon,
  IonLabel,
  IonModal,
  IonRow,
  IonSegment,
  IonSegmentButton,
  IonSegmentContent,
  IonSegmentView,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { defineCustomElements } from '@teamhive/lottie-player/loader';
import { addIcons } from 'ionicons';
import { add, bowlingBall, bowlingBallOutline, cameraOutline, chevronDown, chevronUp, documentTextOutline, medalOutline } from 'ionicons/icons';
import { TOAST_MESSAGES } from 'src/app/core/constants/toast-messages.constants';
import { cloneFrames, createEmptyGame, Frame, Game, GameDraft, PinModeState } from 'src/app/core/models/game.model';
import { AnalyticsService } from 'src/app/core/services/analytics/analytics.service';
import { GameDraftService } from 'src/app/core/services/game-draft/game-draft.service';
import { GameImageImportService } from 'src/app/core/services/game-image-import/game-image-import.service';
import { GameScoreCalculatorService } from 'src/app/core/services/game-score-calculator/game-score-calculator.service';
import { GameDataTransformerService } from 'src/app/core/services/game-transform/game-data-transform.service';
import { BowlingGameValidationService } from 'src/app/core/services/game-utils/bowling-game-validation.service';
import { GameUtilsService } from 'src/app/core/services/game-utils/game-utils.service';
import { HapticService } from 'src/app/core/services/haptic/haptic.service';
import { HighScoreAlertService } from 'src/app/core/services/high-score-alert/high-score-alert.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { UtilsService } from 'src/app/core/services/utils/utils.service';
import { GamesStore } from 'src/app/core/stores/games.store';
import { GameGridComponent } from 'src/app/shared/components/game-grid/game-grid.component';
import { GameScoreToolbarComponent } from 'src/app/shared/components/game-score-toolbar/game-score-toolbar.component';
import { ThrowConfirmedEvent } from 'src/app/shared/components/pin-input/pin-input.component';

const enum SeriesMode {
  Single = 'Single',
  Series3 = '3 Series',
  Series4 = '4 Series',
  Series5 = '5 Series',
  Series6 = '6 Series',
}

defineCustomElements(window);

@Component({
  selector: 'app-add-game',
  templateUrl: 'add-game.page.html',
  styleUrls: ['add-game.page.scss'],
  providers: [ModalController],
  imports: [
    IonHeader,
    IonToolbar,
    IonButton,
    IonIcon,
    IonTitle,
    IonAlert,
    IonContent,
    IonGrid,
    IonRow,
    IonCol,
    IonModal,
    IonButtons,
    IonSegmentButton,
    IonSegment,
    IonSegmentContent,
    IonSegmentView,
    IonLabel,
    NgIf,
    NgFor,
    GameGridComponent,
    GameScoreToolbarComponent,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AddGamePage implements OnInit {
  // UI State
  selectedMode: SeriesMode = SeriesMode.Single;
  sheetOpen = false;
  isAlertOpen = false;
  isModalOpen = false;
  is300 = false;
  selectedSegment = 'Game 1';
  segments: string[] = ['Game 1'];
  showScoreToolbar = false;
  toolbarOffset = 0;
  toolbarDisabledState = { strikeDisabled: true, spareDisabled: true };

  // Game Data State
  gameData!: Game;
  games = signal(Array.from({ length: 19 }, () => createEmptyGame()));
  totalScores = signal(new Array(19).fill(0));
  maxScores = signal(new Array(19).fill(300));

  // Pin input mode state
  isPinInputMode = false;

  pinModeState = signal<PinModeState[]>(
    Array.from({ length: 19 }, () => ({
      currentFrameIndex: 0,
      currentThrowIndex: 0,
      throwsData: Array.from({ length: 10 }, () => []),
    })),
  );

  // computed state
  seriesMaxscore = computed(() => {
    return this.getActiveTrackIndexes().reduce((acc, idx) => acc + this.maxScores()[idx], 0);
  });

  seriesCurrentScore = computed(() => {
    return this.getActiveTrackIndexes().reduce((acc, idx) => acc + this.totalScores()[idx], 0);
  });

  // View Children & DOM References
  @ViewChildren(GameGridComponent) gameGrids!: QueryList<GameGridComponent>;
  @ViewChild('modalGrid', { static: false }) modalGrid!: GameGridComponent;
  presentingElement: HTMLElement = document.querySelector('.ion-page')!;

  // Internal Logic State
  private isStorageReady = false;
  private seriesId = '';
  private activeGameIndex = 0;

  constructor(
    private actionSheetCtrl: ActionSheetController,
    private alertController: AlertController,
    private toastService: ToastService,
    private gameScoreCalculatorService: GameScoreCalculatorService,
    private transformGameService: GameDataTransformerService,
    private hapticService: HapticService,
    private gameUtilsService: GameUtilsService,
    private utilsService: UtilsService,
    private validationService: BowlingGameValidationService,
    private highScroreAlertService: HighScoreAlertService,
    private gamesStore: GamesStore,
    private analyticsService: AnalyticsService,
    private gameDraftService: GameDraftService,
    private gameImageImport: GameImageImportService,
  ) {
    addIcons({ cameraOutline, bowlingBallOutline, bowlingBall, chevronDown, chevronUp, medalOutline, documentTextOutline, add });
    effect(() => {
      const games = this.games();
      const pinModeState = this.pinModeState();
      const totalScores = this.totalScores();
      const maxScores = this.maxScores();

      const selectedMode = untracked(() => this.selectedMode);
      const isPinInputMode = untracked(() => this.isPinInputMode);
      const gameIndex = untracked(() => this.selectedSegment);
      const segments = untracked(() => this.segments);

      if (!this.isStorageReady) return;

      this.gameDraftService.save({
        games,
        pinModeState,
        totalScores,
        maxScores,
        selectedMode,
        isPinInputMode,
        gameIndex,
        segments,
      });
    });
  }

  async ngOnInit(): Promise<void> {
    this.loadPinInputMode();
    await this.checkAndRestoreDraft();
  }

  // PIN INPUT MODE
  getPinsLeftStanding(gameIndex: number): number[] {
    const state = this.pinModeState()[gameIndex];
    const { currentFrameIndex, currentThrowIndex, throwsData } = state;
    const throws = throwsData[currentFrameIndex] || [];

    return this.gameUtilsService.getAvailablePins(currentFrameIndex, currentThrowIndex, throws);
  }

  canRecordStrike(gameIndex: number): boolean {
    const state = this.pinModeState()[gameIndex];
    const game = this.games()[gameIndex];
    return this.validationService.canRecordStrike(state.currentFrameIndex, state.currentThrowIndex, game.frames);
  }

  canRecordSpare(gameIndex: number): boolean {
    const state = this.pinModeState()[gameIndex];
    const game = this.games()[gameIndex];
    return this.validationService.canRecordSpare(state.currentFrameIndex, state.currentThrowIndex, game.frames);
  }

  canUndoForPinMode(gameIndex: number): boolean {
    const game = this.games()[gameIndex];
    const state = this.pinModeState()[gameIndex];

    if (!game || !state) return false;

    return this.validationService.canUndoLastThrow(game.frames, state.currentFrameIndex, state.currentThrowIndex);
  }

  isGameComplete(gameIndex: number): boolean {
    const game = this.games()[gameIndex];
    return this.validationService.isGameValid(game);
  }

  getCurrentFrameIndex(gameIndex: number): number {
    return this.pinModeState()[gameIndex].currentFrameIndex;
  }

  getCurrentThrowIndex(gameIndex: number): number {
    return this.pinModeState()[gameIndex].currentThrowIndex;
  }

  onPinThrowConfirmed(event: ThrowConfirmedEvent, gameIndex: number): void {
    const state = this.pinModeState()[gameIndex];
    const game = this.games()[gameIndex];

    const result = this.gameUtilsService.processPinThrow(game.frames, state.currentFrameIndex, state.currentThrowIndex, event.pinsKnockedDown);

    this.pinModeState.update((states) => {
      const newStates = [...states];
      newStates[gameIndex] = {
        currentFrameIndex: result.nextFrameIndex,
        currentThrowIndex: result.nextThrowIndex,
        throwsData: result.updatedFrames.map((f) => f.throws),
      };
      return newStates;
    });

    this.updateGameState(result.updatedFrames, gameIndex, false);
  }

  handlePinUndoRequested(gameIndex: number): void {
    const state = this.pinModeState()[gameIndex];
    const game = this.games()[gameIndex];

    const result = this.gameUtilsService.applyPinModeUndo(game.frames, state.currentFrameIndex, state.currentThrowIndex);

    if (!result) return;

    this.pinModeState.update((states) => {
      const newStates = [...states];
      newStates[gameIndex] = {
        currentFrameIndex: result.nextFrameIndex,
        currentThrowIndex: result.nextThrowIndex,
        throwsData: result.updatedFrames.map((f) => f.throws),
      };
      return newStates;
    });

    this.updateGameState(result.updatedFrames, gameIndex, false);
  }

  onScoreCellClick(event: { frameIndex: number; throwIndex: number }, gameIndex: number): void {
    if (!this.isPinInputMode) return;

    const { frameIndex, throwIndex } = event;
    const game = this.games()[gameIndex];
    const state = this.pinModeState()[gameIndex];

    const canClick = this.gameUtilsService.isCellAccessible(game.frames, frameIndex, throwIndex);

    if (canClick) {
      this.pinModeState.update((states) => {
        const newStates = [...states];
        newStates[gameIndex] = {
          ...state,
          currentFrameIndex: frameIndex,
          currentThrowIndex: throwIndex,
        };
        return newStates;
      });
    }
  }

  // GAME STATE UPDATE HANDLERS
  onGameChange(game: Game, index = 0, isModal = false): void {
    if (isModal) {
      this.gameData = { ...game };
    } else {
      this.games.update((games) => games.map((g, i) => (i === index ? { ...game } : g)));
    }
  }

  updateSingleGameProperty(key: keyof Game, value: unknown, index: number, isModal: boolean): void {
    if (isModal) {
      this.gameData = { ...this.gameData, [key]: value };
    } else {
      this.games.update((games) => games.map((g, i) => (i === index ? { ...g, [key]: value } : g)));
    }
  }

  updateSeriesProperty(key: keyof Game, value: unknown, isModal: boolean): void {
    if (isModal) {
      this.gameData = { ...this.gameData, [key]: value };

      if (key === 'league') {
        const isPractice = value === '' || value === 'New';
        this.gameData.isPractice = isPractice;
        if (this.modalGrid?.checkbox) {
          this.modalGrid.checkbox.checked = isPractice;
          this.modalGrid.checkbox.disabled = !isPractice;
        }
      }
    } else {
      const trackIndexes = this.getActiveTrackIndexes();

      this.games.update((games) =>
        games.map((g, i) => {
          if (trackIndexes.includes(i)) {
            const updates: Partial<Game> = { [key]: value };

            if (key === 'league') {
              updates.isPractice = value === '' || value === 'New';
            }
            if (key === 'patterns' && Array.isArray(value) && value.length > 2) {
              updates.patterns = value.slice(-2);
            }
            return { ...g, ...updates };
          }
          return g;
        }),
      );

      if (key === 'league') {
        const isPractice = value === '' || value === 'New';
        this.gameGrids.forEach((grid, i) => {
          if (trackIndexes.includes(i)) {
            grid.leagueSelector.selectedLeague = value as string;
            grid.checkbox.checked = isPractice;
            grid.checkbox.disabled = !isPractice;
          }
        });
      }
    }
  }

  // Wrapper methods for Template Binding
  onNoteChange(note: string, index = 0, isModal = false) {
    this.updateSingleGameProperty('note', note, index, isModal);
  }
  onBallsChange(balls: string[], index = 0, isModal = false) {
    this.updateSingleGameProperty('balls', balls, index, isModal);
  }
  onIsPracticeChange(isPractice: boolean, index = 0, isModal = false) {
    this.updateSingleGameProperty('isPractice', isPractice, index, isModal);
  }
  onLeagueChange(league: string, isModal = false) {
    this.updateSeriesProperty('league', league, isModal);
  }
  onPatternChange(patterns: string[], isModal = false) {
    this.updateSeriesProperty('patterns', patterns, isModal);
  }

  // GRID MODE INPUT & SCORING LOGIC
  handleThrowInput(event: { frameIndex: number; throwIndex: number; value: string }, index: number, isModal = false): void {
    const { frameIndex, throwIndex, value } = event;
    const currentGame = isModal ? this.gameData : this.games()[index];
    const frames = cloneFrames(currentGame.frames);

    if (value.length === 0) {
      this.gameUtilsService.removeThrow(frames, frameIndex, throwIndex);
      this.updateGameState(frames, index, isModal);
      return;
    }

    const parsedValue = this.gameUtilsService.parseInputValue(value, frameIndex, throwIndex, frames);
    const isValidNumber = this.utilsService.isValidNumber0to10(parsedValue);
    const isValidScore = this.validationService.isValidFrameScore(parsedValue, frameIndex, throwIndex, frames);

    if (!isValidNumber || !isValidScore) {
      this.handleInvalidInputUI(index, frameIndex, throwIndex, isModal);
      return;
    }

    this.gameUtilsService.recordThrow(frames, frameIndex, throwIndex, parsedValue);
    this.updateGameState(frames, index, isModal);
    this.focusNextInputUI(index, frameIndex, throwIndex, isModal);
  }

  updateFrameScore(event: InputCustomEvent, index: number): void {
    this.gameData.frameScores[index] = parseInt(event.detail.value!, 10);
  }

  // UI INTERACTION
  onSegmentChange(event: SegmentCustomEvent): void {
    this.selectedSegment = event.detail.value as string;
  }

  togglePinInputMode(): void {
    this.isPinInputMode = !this.isPinInputMode;
    localStorage.setItem('pinInputMode', String(this.isPinInputMode));
  }

  onInputFocused(event: { frameIndex: number; throwIndex: number }, index: number): void {
    this.activeGameIndex = index;
    this.pinModeState.update((states) => {
      const newStates = [...states];
      newStates[index] = {
        ...newStates[index],
        currentFrameIndex: event.frameIndex,
        currentThrowIndex: event.throwIndex,
      };
      return newStates;
    });
    this.updateToolbarDisabledState(index);
  }

  onToolbarStateChange(state: { show: boolean; offset: number }): void {
    this.showScoreToolbar = state.show;
    this.toolbarOffset = state.offset;
  }

  onToolbarButtonClick(char: string): void {
    const activeGrid = this.gameGrids.toArray().find((_, i) => i === this.activeGameIndex);
    if (activeGrid) {
      activeGrid.selectSpecialScore(char);
    }
  }

  async presentActionSheet(): Promise<void> {
    const buttons: { text: string; handler?: () => void; role?: string }[] = [];
    this.hapticService.vibrate(ImpactStyle.Medium);
    this.sheetOpen = true;

    const modes = [SeriesMode.Single, SeriesMode.Series3, SeriesMode.Series4, SeriesMode.Series5, SeriesMode.Series6];

    modes.forEach((mode) => {
      if (mode !== this.selectedMode) {
        buttons.push({
          text: mode,
          handler: () => {
            this.selectedMode = mode;
            this.propagateMetadataToSeries();
            this.recalculateActiveGameScores();
          },
        });
      }
    });

    buttons.push({ text: 'Cancel', role: 'cancel' });

    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Choose series mode',
      buttons,
    });

    actionSheet.onWillDismiss().then(() => {
      this.sheetOpen = false;
      this.updateSegments();
    });
    await actionSheet.present();
  }

  // IMAGE IMPORT
  async handleImageUpload(): Promise<void> {
    const game = await this.gameImageImport.captureAndParseGame();
    if (game) {
      this.gameData = game;
      this.isModalOpen = true;
    }
  }

  // SAVE & RESET LOGIC
  isGameValid(game: Game): boolean {
    return this.validationService.isGameValid(game);
  }

  clearFrames(index?: number): void {
    if (index !== undefined && index >= 0) {
      this.games.update((games) => games.map((g, i) => (i === index ? createEmptyGame() : g)));
      this.pinModeState.update((states) => {
        const newStates = [...states];
        newStates[index] = {
          currentFrameIndex: 0,
          currentThrowIndex: 0,
          throwsData: Array.from({ length: 10 }, () => []),
        };
        return newStates;
      });
    } else {
      this.initializeGames();
      this.pinModeState.set(
        Array.from({ length: 19 }, () => ({
          currentFrameIndex: 0,
          currentThrowIndex: 0,
          throwsData: Array.from({ length: 10 }, () => []),
        })),
      );
      this.gameDraftService.clear();
    }
    this.toastService.showToast(TOAST_MESSAGES.gameResetSuccess, 'refresh-outline');
  }

  async confirm(modal: IonModal): Promise<void> {
    const success = await this.processAndSaveGames([this.gameData]);
    if (success) modal.dismiss();
  }

  async calculateScore(): Promise<void> {
    const activeIndexes = this.getActiveTrackIndexes();
    const gamesToSave = activeIndexes.map((idx) => this.games()[idx]);
    const isSeries = this.selectedMode !== SeriesMode.Single;

    if (isSeries) {
      this.seriesId = this.gameUtilsService.generateUniqueSeriesId();
    }

    const success = await this.processAndSaveGames(gamesToSave, isSeries, this.seriesId);
    if (success) {
      this.gameDraftService.clear();
      const perfectGame = gamesToSave.some((g) => g.totalScore === 300);
      if (perfectGame) {
        this.is300 = true;
        setTimeout(() => (this.is300 = false), 4000);
      }
      this.initializeGames();
      this.gameGrids.forEach((grid) => (grid.checkbox.disabled = false));
      this.pinModeState.set(
        Array.from({ length: 19 }, () => ({
          currentFrameIndex: 0,
          currentThrowIndex: 0,
          throwsData: Array.from({ length: 10 }, () => []),
        })),
      );
    }
  }

  private async processAndSaveGames(games: Game[], isSeries = false, seriesId = ''): Promise<boolean> {
    if (!games.every((g) => this.isGameValid(g))) {
      this.hapticService.vibrate(ImpactStyle.Heavy);
      this.isAlertOpen = true;
      return false;
    }

    try {
      const seriesConfig = isSeries ? { isSeries, seriesId } : undefined;
      const gamesToPersist: Game[] = [];
      const baseDate = Date.now();
      for (const [i, game] of games.entries()) {
        if (game.league === 'New') {
          this.toastService.showToast(TOAST_MESSAGES.selectLeague, 'bug', true);
          return false;
        }
        game.date = baseDate + i;
        // Apply isPinMode to the game before saving
        const gameWithPinMode: Game = { ...game, isPinMode: this.isPinInputMode };
        gamesToPersist.push(this.transformGameService.transformGameData(gameWithPinMode, seriesConfig));
      }

      if (gamesToPersist.length > 0) {
        await this.gamesStore.saveGamesToLocalStorage(gamesToPersist);
      }

      const savedGames = gamesToPersist;

      if (savedGames.length > 0) {
        savedGames.forEach((gameData) => this.analyticsService.trackGameSaved({ score: gameData.totalScore }));
        const allGames = this.gamesStore.games();
        if (savedGames.length === 1) {
          await this.highScroreAlertService.checkAndDisplayHighScoreAlerts(savedGames[0], allGames);
        } else {
          await this.highScroreAlertService.checkAndDisplayHighScoreAlertsForMultipleGames(savedGames, allGames);
        }
        this.hapticService.vibrate(ImpactStyle.Medium);
        this.toastService.showToast(TOAST_MESSAGES.gameSaveSuccess, 'add');
        return true;
      }
    } catch (error) {
      console.error(error);
      this.toastService.showToast(TOAST_MESSAGES.gameSaveError, 'bug', true);
      await this.analyticsService.trackError('game_save_error', error instanceof Error ? error.message : String(error));
    }
    return false;
  }

  // PRIVATE HELPERS - GAME STATE
  private loadPinInputMode(): void {
    const pinInputMode = localStorage.getItem('pinInputMode');
    this.isPinInputMode = pinInputMode === null ? true : pinInputMode === 'true';
  }

  private updateGameState(frames: Frame[], index: number, isModal: boolean): void {
    const scoreResult = this.gameScoreCalculatorService.calculateScoreFromFrames(frames);
    const maxScore = this.gameScoreCalculatorService.calculateMaxScoreFromFrames(frames, scoreResult.totalScore);
    const updatedGameData = { frames, frameScores: scoreResult.frameScores, totalScore: scoreResult.totalScore };

    if (isModal) {
      this.gameData = { ...this.gameData, ...updatedGameData };
    } else {
      this.games.update((games) => games.map((g, i) => (i === index ? { ...g, ...updatedGameData } : g)));
      this.totalScores.update((scores) => {
        const s = [...scores];
        s[index] = scoreResult.totalScore;
        return s;
      });
      this.maxScores.update((scores) => {
        const s = [...scores];
        s[index] = maxScore;
        return s;
      });
    }
  }

  private initializeGames(): void {
    this.maxScores.set(new Array(19).fill(300));
    this.totalScores.set(new Array(19).fill(0));
    this.games.set(Array.from({ length: 19 }, () => createEmptyGame()));
  }

  private getActiveTrackIndexes(): number[] {
    const countMatch = this.selectedMode.match(/\d+/);
    const count = countMatch ? parseInt(countMatch[0], 10) : 1;
    return Array.from({ length: count }, (_, i) => i);
  }

  private propagateMetadataToSeries(): void {
    const activeIndexes = this.getActiveTrackIndexes();
    const sourceGame = this.games()[0];

    this.games.update((games) =>
      games.map((g, i) => {
        if (activeIndexes.includes(i) && i !== 0) {
          return {
            ...g,
            league: sourceGame.league,
            isPractice: sourceGame.isPractice,
            patterns: [...sourceGame.patterns],
          };
        }
        return g;
      }),
    );

    setTimeout(() => {
      this.gameGrids.forEach((grid, i) => {
        if (activeIndexes.includes(i)) {
          if (grid.leagueSelector) {
            grid.leagueSelector.selectedLeague = sourceGame.league || '';
          }
          if (grid.checkbox) {
            grid.checkbox.checked = sourceGame.isPractice;
            grid.checkbox.disabled = !sourceGame.isPractice;
          }
        }
      });
    }, 50);
  }

  private updateSegments(): void {
    const activeIndexes = this.getActiveTrackIndexes();
    const oldSelectedSegment = this.selectedSegment;
    this.segments = activeIndexes.map((i) => `Game ${i + 1}`);

    // Reset to Game 1 if current segment is beyond the new series range
    if (!this.segments.includes(oldSelectedSegment)) {
      this.selectedSegment = 'Game 1';
    }
  }

  private recalculateActiveGameScores(): void {
    const activeIndexes = this.getActiveTrackIndexes();
    const currentGames = this.games();
    const newTotalScores = [...this.totalScores()];
    const newMaxScores = [...this.maxScores()];

    activeIndexes.forEach((index) => {
      const game = currentGames[index];
      const scoreResult = this.gameScoreCalculatorService.calculateScoreFromFrames(game.frames);
      const maxScore = this.gameScoreCalculatorService.calculateMaxScoreFromFrames(game.frames, scoreResult.totalScore);

      newTotalScores[index] = scoreResult.totalScore;
      newMaxScores[index] = maxScore;
    });

    this.totalScores.set(newTotalScores);
    this.maxScores.set(newMaxScores);
  }

  // PRIVATE HELPERS - VALIDATION
  private handleInvalidInputUI(index: number, frameIndex: number, throwIndex: number, isModal: boolean): void {
    this.hapticService.vibrate(ImpactStyle.Heavy);
    const grid = isModal ? this.modalGrid : this.gameGrids.toArray()[index];
    if (grid) grid.handleInvalidInput(frameIndex, throwIndex);
  }

  private focusNextInputUI(index: number, frameIndex: number, throwIndex: number, isModal: boolean): void {
    const grid = isModal ? this.modalGrid : this.gameGrids.toArray()[index];
    if (grid) grid.focusNextInput(frameIndex, throwIndex);
  }

  private updateToolbarDisabledState(index: number): void {
    this.toolbarDisabledState = {
      strikeDisabled: !this.canRecordStrike(index),
      spareDisabled: !this.canRecordSpare(index),
    };
  }

  // SESSION DRAFT
  private async checkAndRestoreDraft(): Promise<void> {
    const draft = this.gameDraftService.load();

    if (!draft) {
      this.isStorageReady = true;
      return;
    }

    const isSeries = draft.selectedMode !== SeriesMode.Single;
    const typeText = isSeries ? 'series' : 'game';

    const alert = await this.alertController.create({
      header: 'Resume Session?',
      message: `We found an unfinished ${typeText} from earlier. Do you want to restore it?`,
      backdropDismiss: false,
      buttons: [
        {
          text: 'No, Start New',
          role: 'cancel',
          handler: () => {
            this.gameDraftService.clear();
            this.isStorageReady = true;
          },
        },
        {
          text: 'Yes, Resume',
          handler: () => {
            this.restoreDraft(draft);
          },
        },
      ],
    });
    await alert.present();
  }

  private restoreDraft(draft: GameDraft): void {
    this.isStorageReady = true;

    this.selectedMode = draft.selectedMode as SeriesMode;
    this.isPinInputMode = draft.isPinInputMode;
    this.updateSegments();

    this.games.set(draft.games);
    this.totalScores.set(draft.totalScores);
    this.maxScores.set(draft.maxScores);
    this.pinModeState.set(draft.pinModeState);
    this.selectedSegment = draft.gameIndex;

    setTimeout(() => {
      this.propagateMetadataToSeries();
    }, 100);

    this.toastService.showToast('Session restored successfully.', 'refresh-outline');
  }
}
