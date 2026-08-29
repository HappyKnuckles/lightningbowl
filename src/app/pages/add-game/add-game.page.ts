import { Component, computed, CUSTOM_ELEMENTS_SCHEMA, effect, HostListener, OnInit, QueryList, signal, untracked, ViewChildren } from '@angular/core';
import { ImpactStyle } from '@capacitor/haptics';
import { ModalController, SegmentCustomEvent, Platform } from '@ionic/angular';
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
  IonMenuButton,
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
import { bowlingBall, bowlingBallOutline, chevronDown, chevronUp } from 'ionicons/icons';
import { LIVE_SERIES_STAT_DEFINTIONS } from 'src/app/core/configs/stat-definitions/stat-definitions';
import { TOAST_MESSAGES } from 'src/app/core/constants/toast-messages.constants';
import { Frame, Game, GameDraft, PinModeState } from 'src/app/core/models/game.model';
import { StatDefinition } from 'src/app/core/models/stat-definitions.model';
import { LiveSeriesStats } from 'src/app/core/models/stats.model';
import { AnalyticsService } from 'src/app/core/services/analytics/analytics.service';
import { GameDraftService } from 'src/app/core/services/game-draft/game-draft.service';
import { GameScoreCalculatorService } from 'src/app/core/services/game-score-calculator/game-score-calculator.service';
import { GameStatsService } from 'src/app/core/services/game-stats/game-stats.service';
import { GameDataTransformerService } from 'src/app/core/services/game-transform/game-data-transform.service';
import { HapticService } from 'src/app/core/services/haptic/haptic.service';
import { HighScoreAlertService } from 'src/app/core/services/high-score-alert/high-score-alert.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { GamesStore } from 'src/app/core/stores/games.store';
import { SettingsStore } from 'src/app/core/stores/settings.store';
import { cloneFrames, createEmptyGame, recordThrow, removeThrow, toCompletedFramesGame } from 'src/app/core/utils/game-utils/frame.utils';
import {
  canRecordSpare,
  canRecordStrike,
  canUndoLastThrow,
  isGameValid,
  isValidFrameScore,
} from 'src/app/core/utils/game-utils/game-validation.utils';
import { applyPinModeUndo, getAvailablePins, isCellAccessible, processPinThrow } from 'src/app/core/utils/game-utils/pin.utils';
import { parseInputValue } from 'src/app/core/utils/game-utils/score-input.utils';
import { UtilsService } from 'src/app/core/utils/utils.service';
import { GameScoreToolbarComponent } from 'src/app/shared/components/game-score-toolbar/game-score-toolbar.component';
import { GameComponent } from 'src/app/shared/components/game/game.component';
import { PinInputComponent, ThrowConfirmedEvent } from 'src/app/shared/components/pin-input/pin-input.component';
import { StatDisplayComponent } from 'src/app/shared/components/stat-display/stat-display.component';
import { StatPinLeaveComponent } from 'src/app/shared/components/stat-pin-leave/stat-pin-leave.component';

const enum SeriesMode {
  Single = 'Single',
  Series3 = '3-Series',
  Series4 = '4-Series',
  Series5 = '5-Series',
  Series6 = '6-Series',
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
    IonMenuButton,
    IonSegmentButton,
    IonSegment,
    IonSegmentContent,
    IonSegmentView,
    IonLabel,
    GameComponent,
    PinInputComponent,
    GameScoreToolbarComponent,
    StatDisplayComponent,
    StatPinLeaveComponent,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AddGamePage implements OnInit {
  // Live stats
  liveSeriesStats: LiveSeriesStats | null = null;
  allStats = this.gameStatsService.overallStats;
  isLiveStatsOpen = false;
  readonly hasLiveStats = computed(() => {
    const active = new Set(this.getActiveTrackIndexes());
    const games = this.games().filter((_, i) => active.has(i));
    return games.map(toCompletedFramesGame).some((g) => g.frames.length > 0);
  });
  readonly liveStatDefinitions: StatDefinition[] = LIVE_SERIES_STAT_DEFINTIONS;

  // UI State
  selectedMode = signal<SeriesMode>(SeriesMode.Single);
  sheetOpen = false;
  isAlertOpen = false;
  is300 = false;
  selectedSegment = 'Game 1';
  segments: string[] = ['Game 1'];
  showScoreToolbar = false;
  toolbarOffset = 0;
  toolbarDisabledState = { strikeDisabled: true, spareDisabled: true };

  // Game Data State
  games = signal(Array.from({ length: 19 }, () => createEmptyGame()));
  totalScores = signal(new Array(19).fill(0));
  maxScores = signal(new Array(19).fill(300));

  // Pin input mode state
  isPinInputMode = true;

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
  @ViewChildren(GameComponent) gameComponents!: QueryList<GameComponent>;
  presentingElement!: HTMLElement | null;

  // Internal Logic State
  private isStorageReady = false;
  private seriesId = '';
  private activeGameIndex = 0;

  /**
   * Mobile installed presents the deck as a bottom sheet over the score grid.
   */
  readonly sheetPinInput = this.platform.is('mobile');

  /**
   * Whether the deck's sheet is up. Raised by tapping a score cell, and put away
   * once the game is complete or the user taps outside it.
   */
  readonly pinSheetOpen = signal(false);

  /** Index of the game the segment view is currently showing. */
  get activeSegmentIndex(): number {
    const index = this.segments.indexOf(this.selectedSegment);
    return index === -1 ? 0 : index;
  }

  constructor(
    private actionSheetCtrl: ActionSheetController,
    private alertController: AlertController,
    private toastService: ToastService,
    private gameScoreCalculatorService: GameScoreCalculatorService,
    private transformGameService: GameDataTransformerService,
    private hapticService: HapticService,
    private utilsService: UtilsService,
    private highScroreAlertService: HighScoreAlertService,
    private gamesStore: GamesStore,
    private analyticsService: AnalyticsService,
    private gameDraftService: GameDraftService,
    private gameStatsService: GameStatsService,
    public settingsStore: SettingsStore,
    private platform: Platform,
  ) {
    addIcons({
      bowlingBallOutline,
      bowlingBall,
      chevronDown,
      chevronUp,
    });
    effect(() => {
      const games = this.games();
      const pinModeState = this.pinModeState();
      const totalScores = this.totalScores();
      const maxScores = this.maxScores();

      const selectedMode = untracked(() => this.selectedMode());
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
    this.presentingElement = document.querySelector('.ion-page');
    this.focusCurrentThrowCell();
  }

  // PIN INPUT MODE
  getPinsLeftStanding(gameIndex: number): number[] {
    const state = this.pinModeState()[gameIndex];
    const { currentFrameIndex, currentThrowIndex, throwsData } = state;
    const throws = throwsData[currentFrameIndex] || [];

    return getAvailablePins(currentFrameIndex, currentThrowIndex, throws);
  }

  canRecordStrike(gameIndex: number): boolean {
    const state = this.pinModeState()[gameIndex];
    const game = this.games()[gameIndex];
    return canRecordStrike(state.currentFrameIndex, state.currentThrowIndex, game.frames);
  }

  canRecordSpare(gameIndex: number): boolean {
    const state = this.pinModeState()[gameIndex];
    const game = this.games()[gameIndex];
    return canRecordSpare(state.currentFrameIndex, state.currentThrowIndex, game.frames);
  }

  canUndoForPinMode(gameIndex: number): boolean {
    const game = this.games()[gameIndex];
    const state = this.pinModeState()[gameIndex];

    if (!game || !state) return false;

    return canUndoLastThrow(game.frames, state.currentFrameIndex, state.currentThrowIndex);
  }

  isGameComplete(gameIndex: number): boolean {
    const game = this.games()[gameIndex];
    return isGameValid(game);
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

    const result = processPinThrow(game.frames, state.currentFrameIndex, state.currentThrowIndex, event.pinsKnockedDown);

    this.pinModeState.update((states) => {
      const newStates = [...states];
      newStates[gameIndex] = {
        currentFrameIndex: result.nextFrameIndex,
        currentThrowIndex: result.nextThrowIndex,
        throwsData: result.updatedFrames.map((f) => f.throws),
      };
      return newStates;
    });

    this.updateGameState(result.updatedFrames, gameIndex);

    if (this.isGameComplete(gameIndex)) {
      this.pinSheetOpen.set(false);
    }
  }

  @HostListener('click', ['$event'])
  onPageTap(event: MouseEvent): void {
    if (!this.pinSheetOpen()) return;

    const target = event.target as HTMLElement;

    if (target.closest('app-pin-input') || target.closest('.score-cell')) return;

    this.pinSheetOpen.set(false);
  }

  handlePinUndoRequested(gameIndex: number): void {
    const state = this.pinModeState()[gameIndex];
    const game = this.games()[gameIndex];

    const result = applyPinModeUndo(game.frames, state.currentFrameIndex, state.currentThrowIndex);

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

    this.updateGameState(result.updatedFrames, gameIndex);
  }

  onScoreCellClick(event: { frameIndex: number; throwIndex: number }, gameIndex: number): void {
    if (!this.isPinInputMode) return;

    const { frameIndex, throwIndex } = event;
    const game = this.games()[gameIndex];
    const state = this.pinModeState()[gameIndex];

    const canClick = isCellAccessible(game.frames, frameIndex, throwIndex);

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
      this.activeGameIndex = gameIndex;
      this.pinSheetOpen.set(true);
    }
  }

  // GAME STATE UPDATE HANDLERS
  onGameChange(game: Game, index = 0): void {
    this.games.update((games) => games.map((g, i) => (i === index ? { ...game } : g)));
  }

  updateSingleGameProperty<K extends keyof Game>(key: K, value: Game[K], index: number): void {
    this.games.update((games) => games.map((g, i) => (i === index ? { ...g, [key]: value } : g)));
  }

  updateSeriesProperty<K extends keyof Game>(key: K, value: Game[K]): void {
    const league = key === 'league' ? (value as Game['league']) : undefined;
    const isPractice = league === '' || league === 'New';
    const trackIndexes = this.getActiveTrackIndexes();

    this.games.update((games) =>
      games.map((g, i) => {
        if (trackIndexes.includes(i)) {
          const updates: Partial<Game> = { [key]: value };

          if (key === 'league') {
            updates.isPractice = isPractice;
          }
          if (key === 'patterns' && Array.isArray(value) && value.length > 2) {
            updates.patterns = value.slice(-2) as Game['patterns'];
          }
          return { ...g, ...updates };
        }
        return g;
      }),
    );

    if (key === 'league') {
      this.gameComponents.forEach((game, i) => {
        if (trackIndexes.includes(i)) {
          game.leagueSelector.selectedLeague.set(league as string);
          game.checkbox.checked = isPractice;
          game.checkbox.disabled = !isPractice;
        }
      });
    }
  }

  // Wrapper methods for Template Binding
  onNoteChange(note: string, index = 0) {
    this.updateSingleGameProperty('note', note, index);
  }
  onBallsChange(balls: string[], index = 0) {
    this.updateSingleGameProperty('balls', balls, index);
  }
  onIsPracticeChange(isPractice: boolean, index = 0) {
    this.updateSingleGameProperty('isPractice', isPractice, index);
  }
  onLeagueChange(league: string) {
    this.updateSeriesProperty('league', league);
  }
  onPatternChange(patterns: string[]) {
    this.updateSeriesProperty('patterns', patterns);
  }

  // GRID MODE INPUT & SCORING LOGIC
  handleThrowInput(event: { frameIndex: number; throwIndex: number; value: string }, index: number): void {
    const { frameIndex, throwIndex, value } = event;
    const frames = cloneFrames(this.games()[index].frames);

    if (value.length === 0) {
      removeThrow(frames, frameIndex, throwIndex);
      this.updateGameState(frames, index);
      return;
    }

    const parsedValue = parseInputValue(value, frameIndex, throwIndex, frames);
    const isValidNumber = this.utilsService.isValidNumber0to10(parsedValue);
    const isValidScore = isValidFrameScore(parsedValue, frameIndex, throwIndex, frames);

    if (!isValidNumber || !isValidScore) {
      this.handleInvalidInputUI(index, frameIndex, throwIndex);
      return;
    }

    recordThrow(frames, frameIndex, throwIndex, parsedValue);
    this.updateGameState(frames, index);
    this.focusNextInputUI(index, frameIndex, throwIndex);
  }

  // UI INTERACTION
  onSegmentChange(event: SegmentCustomEvent): void {
    this.selectedSegment = event.detail.value as string;
    this.pinSheetOpen.set(false);
  }

  togglePinInputMode(): void {
    this.isPinInputMode = !this.isPinInputMode;
    localStorage.setItem('pinInputMode', String(this.isPinInputMode));
    this.focusCurrentThrowCell();
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
    const activeGrid = this.gameComponents.toArray().find((_, i) => i === this.activeGameIndex);
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
      if (mode !== this.selectedMode()) {
        buttons.push({
          text: mode,
          handler: () => {
            this.selectedMode.set(mode);
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

  // SAVE & RESET LOGIC
  isGameValid(game: Game): boolean {
    return isGameValid(game);
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

  async calculateScore(): Promise<void> {
    const activeIndexes = this.getActiveTrackIndexes();
    const gamesToSave = activeIndexes.map((idx) => this.games()[idx]);
    const isSeries = this.selectedMode() !== SeriesMode.Single;

    if (isSeries) {
      this.seriesId = this.utilsService.generateUniqueSeriesId();
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
      this.gameComponents.forEach((grid) => (grid.checkbox.disabled = false));
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
  /**
   * Raise the deck on the throw that's up next, without waiting for a score cell
   * tap — the highlighted cell is what tells pin mode apart from the classic
   * grid at a glance.
   */
  private focusCurrentThrowCell(): void {
    if (!this.isPinInputMode || !this.sheetPinInput) {
      this.pinSheetOpen.set(false);
      return;
    }

    const index = this.activeSegmentIndex;
    if (this.isGameComplete(index)) return;

    this.activeGameIndex = index;

    setTimeout(() => this.pinSheetOpen.set(true));
  }

  private loadPinInputMode(): void {
    const pinInputMode = localStorage.getItem('pinInputMode');
    this.isPinInputMode = pinInputMode === null ? true : pinInputMode === 'true';
  }

  private updateGameState(frames: Frame[], index: number): void {
    const scoreResult = this.gameScoreCalculatorService.calculateScoreFromFrames(frames);
    const maxScore = this.gameScoreCalculatorService.calculateMaxScoreFromFrames(frames, scoreResult.totalScore);
    const updatedGameData = { frames, frameScores: scoreResult.frameScores, totalScore: scoreResult.totalScore };

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

  private initializeGames(): void {
    this.maxScores.set(new Array(19).fill(300));
    this.totalScores.set(new Array(19).fill(0));
    this.games.set(Array.from({ length: 19 }, () => createEmptyGame()));
  }

  private getActiveTrackIndexes(): number[] {
    const countMatch = this.selectedMode().match(/\d+/);
    const count = countMatch ? parseInt(countMatch[0], 10) : 1;
    return Array.from({ length: count }, (_, i) => i);
  }

  onSeriesStatsClick(): void {
    const active = new Set(this.getActiveTrackIndexes());
    const games = this.games().filter((_, i) => active.has(i));
    this.liveSeriesStats = this.gameStatsService.calculateLiveSeriesStats(games);
    if (this.liveSeriesStats) {
      this.isLiveStatsOpen = true;
    }
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
      this.gameComponents.forEach((component, i) => {
        if (activeIndexes.includes(i)) {
          if (component.leagueSelector) {
            component.leagueSelector.selectedLeague.set(sourceGame.league || '');
          }
          if (component.checkbox) {
            component.checkbox.checked = sourceGame.isPractice;
            component.checkbox.disabled = !sourceGame.isPractice;
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
  private handleInvalidInputUI(index: number, frameIndex: number, throwIndex: number): void {
    this.hapticService.vibrate(ImpactStyle.Heavy);
    const grid = this.gameComponents.toArray()[index];
    if (grid) grid.handleInvalidInput(frameIndex, throwIndex);
  }

  private focusNextInputUI(index: number, frameIndex: number, throwIndex: number): void {
    const grid = this.gameComponents.toArray()[index];
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
    await alert.onDidDismiss();
  }

  private restoreDraft(draft: GameDraft): void {
    this.isStorageReady = true;

    this.selectedMode.set(draft.selectedMode as SeriesMode);
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
