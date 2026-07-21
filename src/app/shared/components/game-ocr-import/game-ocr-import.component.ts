import { Component, ViewChild, inject } from '@angular/core';
import { ImpactStyle } from '@capacitor/haptics';
import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonModal, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronBack } from 'ionicons/icons';
import { TOAST_MESSAGES } from 'src/app/core/constants/toast-messages.constants';
import { Frame, Game } from 'src/app/core/models/game.model';
import { AnalyticsService } from 'src/app/core/services/analytics/analytics.service';
import { GameImageImportService } from 'src/app/core/services/game-image-import/game-image-import.service';
import { GameScoreCalculatorService } from 'src/app/core/services/game-score-calculator/game-score-calculator.service';
import { GameDataTransformerService } from 'src/app/core/services/game-transform/game-data-transform.service';
import { HapticService } from 'src/app/core/services/haptic/haptic.service';
import { HighScoreAlertService } from 'src/app/core/services/high-score-alert/high-score-alert.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { GamesStore } from 'src/app/core/stores/games.store';
import { cloneFrames, recordThrow, removeThrow } from 'src/app/core/utils/game-utils/frame.utils';
import { isGameValid, isValidFrameScore } from 'src/app/core/utils/game-utils/game-validation.utils';
import { parseInputValue } from 'src/app/core/utils/game-utils/score-input.utils';
import { UtilsService } from 'src/app/core/utils/utils.service';
import { GameComponent } from '../game/game.component';
import { UserService } from 'src/app/core/services/user/user.service';

/**
 * Scoreboard photo import: captures an image, runs OCR and opens a review modal
 * so the parsed game can be corrected before it is saved. Self-contained so it
 * can be triggered from anywhere (see app-side-menu), not just the add-game page.
 */
@Component({
  selector: 'app-game-ocr-import',
  templateUrl: './game-ocr-import.component.html',
  imports: [IonModal, IonHeader, IonToolbar, IonButtons, IonButton, IonIcon, IonTitle, IonContent, GameComponent],
})
export class GameOcrImportComponent {
  gameData!: Game;
  isOpen = false;

  @ViewChild('modalGrid', { static: false }) modalGrid!: GameComponent;

  private gameImageImport = inject(GameImageImportService);
  private gameScoreCalculatorService = inject(GameScoreCalculatorService);
  private transformGameService = inject(GameDataTransformerService);
  private highScoreAlertService = inject(HighScoreAlertService);
  private analyticsService = inject(AnalyticsService);
  private hapticService = inject(HapticService);
  private utilsService = inject(UtilsService);
  private toastService = inject(ToastService);
  private gamesStore = inject(GamesStore);
  private userService = inject(UserService);

  constructor() {
    addIcons({ chevronBack });
  }

  /**
   * Runs the capture + OCR flow and opens the review modal when a game was parsed.
   * Resolves to whether the modal was opened, so callers can react to a cancelled capture.
   */
  async open(): Promise<boolean> {
    const game = await this.gameImageImport.captureAndParseGame();
    if (!game) return false;

    this.gameData = game;
    this.isOpen = true;
    return true;
  }

  isGameValid(game: Game): boolean {
    return isGameValid(game);
  }

  handleThrowInput(event: { frameIndex: number; throwIndex: number; value: string }): void {
    const { frameIndex, throwIndex, value } = event;
    const frames = cloneFrames(this.gameData.frames);

    if (value.length === 0) {
      removeThrow(frames, frameIndex, throwIndex);
      this.updateGameState(frames);
      return;
    }

    const parsedValue = parseInputValue(value, frameIndex, throwIndex, frames);
    const isValidNumber = this.utilsService.isValidNumber0to10(parsedValue);
    const isValidScore = isValidFrameScore(parsedValue, frameIndex, throwIndex, frames);

    if (!isValidNumber || !isValidScore) {
      this.hapticService.vibrate(ImpactStyle.Heavy);
      this.modalGrid?.handleInvalidInput(frameIndex, throwIndex);
      return;
    }

    recordThrow(frames, frameIndex, throwIndex, parsedValue);
    this.updateGameState(frames);
    this.modalGrid?.focusNextInput(frameIndex, throwIndex);
  }

  onNoteChange(note: string): void {
    this.gameData = { ...this.gameData, note };
  }

  onBallsChange(balls: string[]): void {
    this.gameData = { ...this.gameData, balls };
  }

  onIsPracticeChange(isPractice: boolean): void {
    this.gameData = { ...this.gameData, isPractice };
  }

  onPatternChange(patterns: string[]): void {
    this.gameData = { ...this.gameData, patterns };
  }

  onLeagueChange(league: string): void {
    const isPractice = league === '' || league === 'New';
    this.gameData = { ...this.gameData, league, isPractice };

    if (this.modalGrid?.checkbox) {
      this.modalGrid.checkbox.checked = isPractice;
      this.modalGrid.checkbox.disabled = !isPractice;
    }
  }

  async confirm(modal: IonModal): Promise<void> {
    if (!isGameValid(this.gameData)) {
      this.hapticService.vibrate(ImpactStyle.Heavy);
      return;
    }

    if (this.gameData.league === 'New') {
      this.toastService.showToast(TOAST_MESSAGES.selectLeague, 'bug', true);
      return;
    }

    try {
      const game = this.transformGameService.transformGameData({ ...this.gameData, date: Date.now(), isPinMode: false });

      await this.gamesStore.saveGamesToLocalStorage([game]);
      this.analyticsService.trackGameSaved({ score: game.totalScore });

      await this.highScoreAlertService.checkAndDisplayHighScoreAlerts(game, this.gamesStore.games());

      this.hapticService.vibrate(ImpactStyle.Medium);
      this.toastService.showToast(TOAST_MESSAGES.gameSaveSuccess, 'add');
      await modal.dismiss();
    } catch (error) {
      console.error(error);
      this.toastService.showToast(TOAST_MESSAGES.gameSaveError, 'bug', true);
      await this.analyticsService.trackError('game_save_error', error instanceof Error ? error.message : String(error));
    }
  }

  private updateGameState(frames: Frame[]): void {
    const { frameScores, totalScore } = this.gameScoreCalculatorService.calculateScoreFromFrames(frames);
    this.gameData = { ...this.gameData, frames, frameScores, totalScore };
  }
}
