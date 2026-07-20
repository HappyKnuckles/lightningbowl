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
import {
  add,
  bowlingBall,
  bowlingBallOutline,
  cameraOutline,
  chevronDown,
  chevronUp,
  documentTextOutline,
  personCircleOutline,
  trophyOutline,
} from 'ionicons/icons';
import { LIVE_SERIES_STAT_DEFINTIONS } from 'src/app/core/configs/stat-definitions/stat-definitions';
import { TOAST_MESSAGES } from 'src/app/core/constants/toast-messages.constants';
import { Frame, Game, GameDraft, PinModeState } from 'src/app/core/models/game.model';
import { StatDefinition } from 'src/app/core/models/stat-definitions.model';
import { LiveSeriesStats, Stats } from 'src/app/core/models/stats.model';
import { AnalyticsService } from 'src/app/core/services/analytics/analytics.service';
import { GameDraftService } from 'src/app/core/services/game-draft/game-draft.service';
import { GameImageImportService } from 'src/app/core/services/game-image-import/game-image-import.service';
import { GameScoreCalculatorService } from 'src/app/core/services/game-score-calculator/game-score-calculator.service';
import { GameStatsService } from 'src/app/core/services/game-stats/game-stats.service';
import { GameDataTransformerService } from 'src/app/core/services/game-transform/game-data-transform.service';
import { HapticService } from 'src/app/core/services/haptic/haptic.service';
import { HighScoreAlertService } from 'src/app/core/services/high-score-alert/high-score-alert.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { BowlersStore } from 'src/app/core/stores/bowlers.store';
import { GamesStore } from 'src/app/core/stores/games.store';
import { filterGamesByBowlers } from 'src/app/core/utils/bowler-utils/bowler.utils';
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
import { ThrowConfirmedEvent } from 'src/app/shared/components/pin-input/pin-input.component';
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
    IonSegmentButton,
    IonSegment,
    IonSegmentContent,
    IonSegmentView,
    IonLabel,
    NgIf,
    NgFor,
    GameComponent,
    GameScoreToolbarComponent,
    StatDisplayComponent,
    StatPinLeaveComponent,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AddGamePage implements OnInit {
  // Live stats
  liveSeriesStats: LiveSeriesStats | null = null;
  // Comparison baseline for the open live-stats sheet: that bowler's full history.
  liveStatsBaseline = signal<Stats | null>(null);
  isLiveStatsOpen = false;
  // Live stats are per bowler: a track's button reflects only its own bowler's games.
  readonly liveStatsEnabledByTrack = computed<boolean[]>(() => {
    const games = this.games();
    const indexes = this.getActiveTrackIndexes();
    const hasDataByBowler = new Map<string, boolean>();

    for (const index of indexes) {
      const bowlerId = this.trackBowlerId(index);
      const hasData = toCompletedFramesGame(games[index]).frames.length > 0;
      hasDataByBowler.set(bowlerId, (hasDataByBowler.get(bowlerId) ?? false) || hasData);
    }

    return indexes.map((index) => hasDataByBowler.get(this.trackBowlerId(index)) ?? false);
  });
  readonly liveStatDefinitions: StatDefinition[] = LIVE_SERIES_STAT_DEFINTIONS;

  // UI State
  selectedMode = signal<SeriesMode>(SeriesMode.Single);

  // Multiplayer session: participating bowlers. Empty = solo (active bowler).
  // Combines freely with series modes: tracks = games-per-bowler × participants,
  // laid out game-major (everyone's Game 1, then everyone's Game 2, …).
  sessionBowlerIds = signal<string[]>([]);
  readonly effectiveSessionBowlerIds = computed(() => {
    const bowlers = this.bowlersStore.bowlers();
    const ids = this.sessionBowlerIds().filter((id) => bowlers.some((bowler) => bowler.bowlerId === id));
    return ids.length ? ids : [this.bowlersStore.activeBowlerId()];
  });
  readonly isMultiplayer = computed(() => this.effectiveSessionBowlerIds().length > 1);
  readonly gamesPerBowler = computed(() => {
    const countMatch = this.selectedMode().match(/\d+/);
    return countMatch ? parseInt(countMatch[0], 10) : 1;
  });
  readonly hasSegments = computed(() => this.gamesPerBowler() > 1 || this.isMultiplayer());

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
  @ViewChild('modalGrid', { static: false }) modalGrid!: GameComponent;
  presentingElement!: HTMLElement | null;

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
    private utilsService: UtilsService,
    private highScroreAlertService: HighScoreAlertService,
    private gamesStore: GamesStore,
    public bowlersStore: BowlersStore,
    private analyticsService: AnalyticsService,
    private gameDraftService: GameDraftService,
    private gameImageImport: GameImageImportService,
    private gameStatsService: GameStatsService,
  ) {
    addIcons({
      cameraOutline,
      bowlingBallOutline,
      bowlingBall,
      chevronDown,
      chevronUp,
      trophyOutline,
      documentTextOutline,
      add,
      personCircleOutline,
    });
    effect(() => {
      const games = this.games();
      const pinModeState = this.pinModeState();
      const totalScores = this.totalScores();
      const maxScores = this.maxScores();
      const sessionBowlerIds = this.sessionBowlerIds();

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
        sessionBowlerIds,
      });
    });
  }

  async ngOnInit(): Promise<void> {
    this.loadPinInputMode();
    await this.checkAndRestoreDraft();
    this.presentingElement = document.querySelector('.ion-page');
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

    this.updateGameState(result.updatedFrames, gameIndex, false);
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

    this.updateGameState(result.updatedFrames, gameIndex, false);
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

  updateSingleGameProperty<K extends keyof Game>(key: K, value: Game[K], index: number, isModal: boolean): void {
    if (isModal) {
      this.gameData = { ...this.gameData, [key]: value };
    } else {
      this.games.update((games) => games.map((g, i) => (i === index ? { ...g, [key]: value } : g)));
    }
  }

  updateSeriesProperty<K extends keyof Game>(key: K, value: Game[K], isModal: boolean): void {
    const league = key === 'league' ? (value as Game['league']) : undefined;
    const isPractice = league === '' || league === 'New';

    if (isModal) {
      this.gameData = { ...this.gameData, [key]: value };

      if (key === 'league') {
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
        const isPractice = value === '' || value === 'New';
        this.gameComponents.forEach((game, i) => {
          if (trackIndexes.includes(i)) {
            game.leagueSelector.selectedLeague.set(league as string);
            game.checkbox.checked = isPractice;
            game.checkbox.disabled = !isPractice;
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
      removeThrow(frames, frameIndex, throwIndex);
      this.updateGameState(frames, index, isModal);
      return;
    }

    const parsedValue = parseInputValue(value, frameIndex, throwIndex, frames);
    const isValidNumber = this.utilsService.isValidNumber0to10(parsedValue);
    const isValidScore = isValidFrameScore(parsedValue, frameIndex, throwIndex, frames);

    if (!isValidNumber || !isValidScore) {
      this.handleInvalidInputUI(index, frameIndex, throwIndex, isModal);
      return;
    }

    recordThrow(frames, frameIndex, throwIndex, parsedValue);
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
    const activeGrid = this.gameComponents.toArray().find((_, i) => i === this.activeGameIndex);
    if (activeGrid) {
      activeGrid.selectSpecialScore(char);
    }
  }

  /**
   * Session participant picker: one checked bowler = solo entry (also becomes the
   * active bowler), several = a multiplayer session with one game track each.
   */
  async presentBowlerSheet(): Promise<void> {
    this.hapticService.vibrate(ImpactStyle.Light);
    const selected = this.effectiveSessionBowlerIds();
    const alert = await this.alertController.create({
      header: 'Who is bowling?',
      inputs: this.bowlersStore.bowlers().map((bowler) => ({
        name: bowler.bowlerId,
        type: 'checkbox' as const,
        label: bowler.name,
        value: bowler.bowlerId,
        checked: selected.includes(bowler.bowlerId),
      })),
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'OK',
          handler: (bowlerIds: string[]) => {
            if (!bowlerIds?.length) {
              return false;
            }
            this.applySessionBowlers(bowlerIds);
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  private applySessionBowlers(bowlerIds: string[]): void {
    if (bowlerIds.length === 1) {
      this.bowlersStore.setActiveBowler(bowlerIds[0]);
      this.sessionBowlerIds.set([]);
    } else {
      this.sessionBowlerIds.set(bowlerIds);
    }
    this.updateSegments();
    this.propagateMetadataToSeries();
    this.recalculateActiveGameScores();
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
        Array.from({ length: Math.max(19, this.getActiveTrackIndexes().length) }, () => ({
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
    const bowlerIds = activeIndexes.map((idx) => this.trackBowlerId(idx));
    const isSeries = this.gamesPerBowler() > 1;

    // Each bowler's games form their own series.
    let seriesIds: string[] = [];
    if (isSeries) {
      const seriesIdByBowler = new Map(this.effectiveSessionBowlerIds().map((id) => [id, this.utilsService.generateUniqueSeriesId()]));
      seriesIds = activeIndexes.map((idx) => seriesIdByBowler.get(this.trackBowlerId(idx))!);
      this.seriesId = seriesIds[0];
    }

    const success = await this.processAndSaveGames(gamesToSave, isSeries, seriesIds, bowlerIds);
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

  private async processAndSaveGames(games: Game[], isSeries = false, seriesIds: string[] | string = '', bowlerIds?: string[]): Promise<boolean> {
    if (!games.every((g) => this.isGameValid(g))) {
      this.hapticService.vibrate(ImpactStyle.Heavy);
      this.isAlertOpen = true;
      return false;
    }

    try {
      const gamesToPersist: Game[] = [];
      const baseDate = Date.now();
      for (const [i, game] of games.entries()) {
        if (game.league === 'New') {
          this.toastService.showToast(TOAST_MESSAGES.selectLeague, 'bug', true);
          return false;
        }
        game.date = baseDate + i;
        const seriesId = Array.isArray(seriesIds) ? seriesIds[i] : seriesIds;
        const seriesConfig = isSeries && seriesId ? { isSeries, seriesId } : undefined;
        // Apply isPinMode and the owning bowler to the game before saving
        const bowlerId = bowlerIds?.[i] ?? this.bowlersStore.activeBowlerId();
        const gameWithPinMode: Game = { ...game, isPinMode: this.isPinInputMode, bowlerId };
        gamesToPersist.push(this.transformGameService.transformGameData(gameWithPinMode, seriesConfig));
      }

      if (gamesToPersist.length > 0) {
        await this.gamesStore.saveGamesToLocalStorage(gamesToPersist);
      }

      const savedGames = gamesToPersist;

      if (savedGames.length > 0) {
        savedGames.forEach((gameData) => this.analyticsService.trackGameSaved({ score: gameData.totalScore }));
        await this.showHighScoreAlertsPerBowler(savedGames);
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

  // High score alerts only compare a game against its owning bowler's history.
  private async showHighScoreAlertsPerBowler(savedGames: Game[]): Promise<void> {
    const defaultId = this.bowlersStore.defaultBowlerId();
    const byBowler = new Map<string, Game[]>();
    for (const game of savedGames) {
      const bowlerId = game.bowlerId ?? this.bowlersStore.activeBowlerId();
      byBowler.set(bowlerId, [...(byBowler.get(bowlerId) ?? []), game]);
    }

    for (const [bowlerId, games] of byBowler) {
      const bowlerGames = filterGamesByBowlers(this.gamesStore.games(), [bowlerId], defaultId);
      if (games.length === 1) {
        await this.highScroreAlertService.checkAndDisplayHighScoreAlerts(games[0], bowlerGames);
      } else {
        await this.highScroreAlertService.checkAndDisplayHighScoreAlertsForMultipleGames(games, bowlerGames);
      }
    }
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
    const count = Math.max(19, this.getActiveTrackIndexes().length);
    this.maxScores.set(new Array(count).fill(300));
    this.totalScores.set(new Array(count).fill(0));
    this.games.set(Array.from({ length: count }, () => createEmptyGame()));
  }

  private getActiveTrackIndexes(): number[] {
    const count = this.gamesPerBowler() * this.effectiveSessionBowlerIds().length;
    return Array.from({ length: count }, (_, i) => i);
  }

  /** Owner of a game track (game-major layout: track = gameIndex × participants + bowlerIndex). */
  trackBowlerId(index: number): string {
    const participants = this.effectiveSessionBowlerIds();
    return participants[index % participants.length] ?? this.bowlersStore.activeBowlerId();
  }

  /** 1-based game number of a track within its bowler's series. */
  private trackGameNumber(index: number): number {
    return Math.floor(index / this.effectiveSessionBowlerIds().length) + 1;
  }

  segmentLabel(index: number): string {
    if (!this.isMultiplayer()) {
      return this.segments[index];
    }
    const name = this.bowlersStore.bowlers().find((bowler) => bowler.bowlerId === this.trackBowlerId(index))?.name ?? this.segments[index];
    return this.gamesPerBowler() > 1 ? `${name} ${this.trackGameNumber(index)}` : name;
  }

  // Stats for the bowler whose track the button was pressed on, not the whole session.
  onSeriesStatsClick(trackIndex: number): void {
    const bowlerId = this.trackBowlerId(trackIndex);
    const games = this.getActiveTrackIndexes()
      .filter((index) => this.trackBowlerId(index) === bowlerId)
      .map((index) => this.games()[index]);

    this.liveSeriesStats = this.gameStatsService.calculateLiveSeriesStats(games);
    if (this.liveSeriesStats) {
      const history = filterGamesByBowlers(this.gamesStore.games(), [bowlerId], this.bowlersStore.defaultBowlerId());
      this.liveStatsBaseline.set(this.gameStatsService.calculateBowlingStats(history));
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
    this.ensureTrackCapacity(activeIndexes.length);
    const oldSelectedSegment = this.selectedSegment;
    // Segment ids stay "Game N" (they are DOM content ids); multiplayer labels show bowler names.
    this.segments = activeIndexes.map((i) => `Game ${i + 1}`);

    // Reset to Game 1 if current segment is beyond the new series range
    if (!this.segments.includes(oldSelectedSegment)) {
      this.selectedSegment = 'Game 1';
    }
  }

  // The track arrays start at 19 slots; large sessions (bowlers × series games) grow them in place.
  private ensureTrackCapacity(count: number): void {
    if (this.games().length >= count) {
      return;
    }
    const pad = <T>(arr: T[], make: () => T): T[] => [...arr, ...Array.from({ length: count - arr.length }, make)];
    this.games.update((games) => pad(games, createEmptyGame));
    this.pinModeState.update((states) =>
      pad(states, () => ({ currentFrameIndex: 0, currentThrowIndex: 0, throwsData: Array.from({ length: 10 }, () => []) })),
    );
    this.totalScores.update((scores) => pad(scores, () => 0));
    this.maxScores.update((scores) => pad(scores, () => 300));
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
    const grid = isModal ? this.modalGrid : this.gameComponents.toArray()[index];
    if (grid) grid.handleInvalidInput(frameIndex, throwIndex);
  }

  private focusNextInputUI(index: number, frameIndex: number, throwIndex: number, isModal: boolean): void {
    const grid = isModal ? this.modalGrid : this.gameComponents.toArray()[index];
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

    this.selectedMode.set(draft.selectedMode as SeriesMode);
    this.isPinInputMode = draft.isPinInputMode;
    this.sessionBowlerIds.set(draft.sessionBowlerIds ?? []);

    this.games.set(draft.games);
    this.totalScores.set(draft.totalScores);
    this.maxScores.set(draft.maxScores);
    this.pinModeState.set(draft.pinModeState);
    // After the arrays: updateSegments also grows track capacity for large sessions.
    this.updateSegments();
    this.selectedSegment = draft.gameIndex;

    setTimeout(() => {
      this.propagateMetadataToSeries();
    }, 100);

    this.toastService.showToast('Session restored successfully.', 'refresh-outline');
  }
}
