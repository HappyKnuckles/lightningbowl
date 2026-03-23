import { Component, computed, CUSTOM_ELEMENTS_SCHEMA, OnInit, QueryList, signal, ViewChild, ViewChildren, effect, untracked } from '@angular/core';
import {
  ActionSheetController,
  AlertController,
  IonModal,
  isPlatform,
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
  IonButtons,
  IonSegment,
  IonSegmentButton,
  IonSegmentView,
  IonSegmentContent,
  IonLabel,
} from '@ionic/angular/standalone';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Game, Frame, createEmptyGame, numberArraysToFrames, cloneFrames, createThrow, Throw } from 'src/app/core/models/game.model';
import { addIcons } from 'ionicons';
import { add, chevronDown, chevronUp, cameraOutline, documentTextOutline, medalOutline, bowlingBallOutline, bowlingBall } from 'ionicons/icons';
import { NgIf, NgFor } from '@angular/common';
import { ImpactStyle } from '@capacitor/haptics';
import { HapticService } from 'src/app/core/services/haptic/haptic.service';
import { ImageProcesserService } from 'src/app/core/services/image-processer/image-processer.service';
import { LoadingService } from 'src/app/core/services/loader/loading.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { UserService } from 'src/app/core/services/user/user.service';
import { defineCustomElements } from '@teamhive/lottie-player/loader';
import { GameUtilsService } from 'src/app/core/services/game-utils/game-utils.service';
import { GameScoreCalculatorService } from 'src/app/core/services/game-score-calculator/game-score-calculator.service';
import { GameDataTransformerService } from 'src/app/core/services/game-transform/game-data-transform.service';
import { InputCustomEvent, ModalController } from '@ionic/angular';
import { ToastMessages } from 'src/app/core/constants/toast-messages.constants';
import { GameGridComponent } from 'src/app/shared/components/game-grid/game-grid.component';
import { HighScoreAlertService } from 'src/app/core/services/high-score-alert/high-score-alert.service';
import { StorageService } from 'src/app/core/services/storage/storage.service';
import { AnalyticsService } from 'src/app/core/services/analytics/analytics.service';
import { BowlingGameValidationService } from 'src/app/core/services/game-utils/bowling-game-validation.service';
import { GameScoreToolbarComponent } from 'src/app/shared/components/game-score-toolbar/game-score-toolbar.component';
import { ThrowConfirmedEvent } from 'src/app/shared/components/pin-input/pin-input.component';
import { UtilsService } from 'src/app/core/services/utils/utils.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

const enum SeriesMode {
  Single = 'Single',
  Series3 = '3 Series',
  Series4 = '4 Series',
  Series5 = '5 Series',
  Series6 = '6 Series',
}

interface GameDraft {
  timestamp: number;
  games: Game[];
  pinModeState: { currentFrameIndex: number; currentThrowIndex: number; throwsData: Throw[][] }[];
  totalScores: number[];
  maxScores: number[];
  isPinInputMode: boolean;
  selectedMode: SeriesMode;
  segments: string[];
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
    TranslateModule,
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

  pinModeState = signal<
    {
      currentFrameIndex: number;
      currentThrowIndex: number;
      throwsData: Throw[][];
    }[]
  >(
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
  presentingElement!: HTMLElement;

  // Internal Logic State
  private isStorageReady = false;
  private seriesId = '';
  private activeGameIndex = 0;
  private readonly DRAFT_KEY = 'bowling_game_draft';
  private readonly DRAFT_TTL = 4 * 60 * 60 * 1000;

  constructor(
    private actionSheetCtrl: ActionSheetController,
    private imageProcessingService: ImageProcesserService,
    private alertController: AlertController,
    private toastService: ToastService,
    private gameScoreCalculatorService: GameScoreCalculatorService,
    private transformGameService: GameDataTransformerService,
    private loadingService: LoadingService,
    private userService: UserService,
    private hapticService: HapticService,
    private gameUtilsService: GameUtilsService,
    private utilsService: UtilsService,
    private validationService: BowlingGameValidationService,
    private highScroreAlertService: HighScoreAlertService,
    private storageService: StorageService,
    private analyticsService: AnalyticsService,
    private translate: TranslateService,
  ) {
    addIcons({ cameraOutline, bowlingBallOutline, bowlingBall, chevronDown, chevronUp, medalOutline, documentTextOutline, add });
    effect(() => {
      const gameState = this.games();
      const pinState = this.pinModeState();
      const totals = this.totalScores();
      const maxs = this.maxScores();

      const mode = untracked(() => this.selectedMode);
      const isPinMode = untracked(() => this.isPinInputMode);
      const segments = untracked(() => this.segments);

      if (!this.isStorageReady) return;

      this.saveDraft(gameState, pinState, totals, maxs, mode, isPinMode, segments);
    });
  }

  async ngOnInit(): Promise<void> {
    this.presentingElement = document.querySelector('.ion-page')!;
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
      this.removeThrow(frames, frameIndex, throwIndex);
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

    this.recordThrow(frames, frameIndex, throwIndex, parsedValue);
    this.updateGameState(frames, index, isModal);
    this.focusNextInputUI(index, frameIndex, throwIndex, isModal);
  }

  updateFrameScore(event: InputCustomEvent, index: number): void {
    this.gameData.frameScores[index] = parseInt(event.detail.value!, 10);
  }

  // UI INTERACTION
  onSegmentChange(event: any): void {
    this.selectedSegment = event.detail.value;
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

  async presentWarningAlert() {
    localStorage.removeItem('alert');
    const alert = await this.alertController.create({
      header: 'Warning!',
      subHeader: 'Experimental Feature',
      message: 'It only works in certain alleys and will probably NOT work in yours!',
      buttons: [
        { text: 'Dismiss', role: 'cancel' },
        { text: 'OK', role: 'confirm' },
      ],
    });
    await alert.present();
    alert.onDidDismiss().then((data) => {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 7);
      const alertData = { value: 'true', expiration: expirationDate.getTime() };
      localStorage.setItem('alert', JSON.stringify(alertData));
      if (data.role === 'confirm') {
        this.handleImageUpload();
      }
    });
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
      this.clearDraft();
    }
    this.toastService.showToast(this.translate.instant(ToastMessages.gameResetSuccess), 'refresh-outline');
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
      this.seriesId = this.generateUniqueSeriesId();
    }

    const success = await this.processAndSaveGames(gamesToSave, isSeries, this.seriesId);
    if (success) {
      this.clearDraft();
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
      const savePromises = games.map((game) => {
        // Apply isPinMode to the game before saving
        const gameWithPinMode: Game = { ...game, isPinMode: this.isPinInputMode };
        return this.saveGame(gameWithPinMode, seriesConfig);
      });

      const savedGames = (await Promise.all(savePromises)).filter((g): g is Game => g !== null);

      if (savedGames.length > 0) {
        const allGames = this.storageService.games();
        if (savedGames.length === 1) {
          await this.highScroreAlertService.checkAndDisplayHighScoreAlerts(savedGames[0], allGames);
        } else {
          await this.highScroreAlertService.checkAndDisplayHighScoreAlertsForMultipleGames(savedGames, allGames);
        }
        this.hapticService.vibrate(ImpactStyle.Medium);
        this.toastService.showToast(this.translate.instant(ToastMessages.gameSaveSuccess), 'add');
        return true;
      }
    } catch (error) {
      console.error(error);
      this.toastService.showToast(this.translate.instant(ToastMessages.gameSaveError), 'bug', true);
      await this.analyticsService.trackError('game_save_error', error instanceof Error ? error.message : String(error));
    }
    return false;
  }

  // PRIVATE HELPERS - GAME STATE
  private loadPinInputMode(): void {
    this.isPinInputMode = localStorage.getItem('pinInputMode') === 'true';
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

  private async saveGame(game: Game, seriesConfig?: { isSeries: boolean; seriesId: string }): Promise<Game | null> {
    if (game.league === 'New') {
      this.toastService.showToast(this.translate.instant(ToastMessages.selectLeague), 'bug', true);
      return null;
    }
    try {
      const gameData = this.transformGameService.transformGameData(game, seriesConfig);
      await this.storageService.saveGameToLocalStorage(gameData);
      this.analyticsService.trackGameSaved({ score: gameData.totalScore });
      return gameData;
    } catch (error) {
      console.error('Error saving game:', error);
      throw error;
    }
  }

  private generateUniqueSeriesId(): string {
    return 'series-' + Math.random().toString(36).substring(2, 15);
  }

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

  // CAMERA / OCR LOGIC
  async handleImageUpload(): Promise<void> {
    const alertData = localStorage.getItem('alert');
    if (!alertData) {
      await this.presentWarningAlert();
      return;
    }

    const { value, expiration } = JSON.parse(alertData);
    if (value !== 'true' || new Date().getTime() >= expiration) {
      await this.presentWarningAlert();
      return;
    }

    try {
      const imageUrl: File | Blob | undefined = await this.takeOrChoosePicture();
      if (imageUrl instanceof File) {
        this.loadingService.setLoading(true);
        const gameText = await this.imageProcessingService.performOCR(imageUrl);
        this.parseBowlingScores(gameText!);
        await this.analyticsService.trackOCRUsed(!!gameText);
      } else {
        this.toastService.showToast(this.translate.instant(ToastMessages.noImage), 'bug', true);
      }
    } catch (error) {
      this.toastService.showToast(this.translate.instant(ToastMessages.imageUploadError), 'bug', true);
      console.error(error);
      await this.analyticsService.trackError('ocr_error', error instanceof Error ? error.message : String(error));
    } finally {
      this.loadingService.setLoading(false);
    }
  }

  private async takeOrChoosePicture(): Promise<File | Blob | undefined> {
    if ((isPlatform('android') || isPlatform('ios')) && !isPlatform('mobileweb')) {
      const permissionRequestResult = await Camera.checkPermissions();
      if (permissionRequestResult.photos === 'prompt' || permissionRequestResult.photos === 'denied') {
        const permissions = await Camera.requestPermissions();
        if (!permissions.photos) {
          await this.showPermissionDeniedAlert();
          return undefined;
        }
      }
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Prompt,
      });
      return await fetch(image.webPath!).then((r) => r.blob());
    } else {
      return await this.openFileInput();
    }
  }

  private async openFileInput(): Promise<File | undefined> {
    return new Promise((resolve) => {
      try {
        const fileInput = document.getElementById('upload') as HTMLInputElement;
        fileInput.value = '';
        fileInput.onchange = () => resolve(fileInput.files?.[0]);
        fileInput.click();
      } catch (error) {
        console.error('Upload Error:', error);
        this.toastService.showToast(this.translate.instant(ToastMessages.unexpectedError), 'bug', true);
        resolve(undefined);
      }
    });
  }

  private async showPermissionDeniedAlert(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Permission Denied',
      message: 'To take or choose a picture, you need to grant camera access.',
      buttons: [
        {
          text: 'OK',
          handler: async () => {
            const res = await Camera.requestPermissions();
            if (res.photos === 'granted') this.takeOrChoosePicture();
          },
        },
      ],
    });
    await alert.present();
  }

  private parseBowlingScores(input: string): void {
    try {
      const { frames, frameScores, totalScore } = this.gameUtilsService.parseBowlingScores(input, this.userService.username());
      const framesAsFrameArray = numberArraysToFrames(frames);

      // Build a game object for transformation
      const parsedGame: Game = {
        gameId: '',
        date: 0,
        frames: framesAsFrameArray,
        frameScores,
        totalScore,
        isPractice: true,
        isPinMode: false,
        isClean: false,
        isPerfect: false,
        patterns: [],
        balls: [],
      };

      this.gameData = this.transformGameService.transformGameData(parsedGame);
      this.isModalOpen = true;
    } catch (error) {
      this.toastService.showToast(this.translate.instant(ToastMessages.unexpectedError), 'bug', true);
      console.error(error);
    }
  }

  // SESSION DRAFT LOGIC
  private async checkAndRestoreDraft(): Promise<void> {
    const draftJson = localStorage.getItem(this.DRAFT_KEY);

    if (!draftJson) {
      this.isStorageReady = true;
      return;
    }

    try {
      const draft: GameDraft = JSON.parse(draftJson);
      const now = Date.now();

      if (now - draft.timestamp > this.DRAFT_TTL) {
        this.clearDraft();
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
              this.clearDraft();
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
    } catch (e) {
      console.error('Error parsing draft', e);
      this.clearDraft();
      this.isStorageReady = true;
    }
  }
  private saveDraft(
    games: Game[],
    pinModeState: any[],
    totalScores: number[],
    maxScores: number[],
    selectedMode: SeriesMode,
    isPinInputMode: boolean,
    segments: string[],
  ): void {
    const hasData = games.some((game) => {
      const hasThrows = game.frames.some((f) => f.throws && f.throws.length > 0);

      return hasThrows;
    });

    if (!hasData) {
      this.clearDraft();
      return;
    }

    const draft: GameDraft = {
      timestamp: Date.now(),
      games,
      pinModeState,
      totalScores,
      maxScores,
      selectedMode,
      isPinInputMode,
      segments,
    };
    try {
      const tmpKey = this.DRAFT_KEY + '.tmp';
      const payload = JSON.stringify(draft);
      localStorage.setItem(tmpKey, payload);
      localStorage.setItem(this.DRAFT_KEY, payload);
      localStorage.removeItem(tmpKey);
    } catch (err) {
      console.error('Failed to save draft', err);
    }
  }

  private clearDraft(): void {
    localStorage.removeItem(this.DRAFT_KEY);
  }

  private restoreDraft(draft: GameDraft): void {
    this.isStorageReady = true;

    this.selectedMode = draft.selectedMode;
    this.isPinInputMode = draft.isPinInputMode;
    this.updateSegments();

    this.games.set(draft.games);
    this.totalScores.set(draft.totalScores);
    this.maxScores.set(draft.maxScores);
    this.pinModeState.set(draft.pinModeState);

    setTimeout(() => {
      this.propagateMetadataToSeries();
    }, 100);

    this.toastService.showToast(this.translate.instant(ToastMessages.sessionRestored), 'refresh-outline');
  }
}
