import { Injectable, inject } from '@angular/core';
import { ImpactStyle } from '@capacitor/haptics';
import { TOAST_MESSAGES } from 'src/app/core/constants/toast-messages.constants';
import { GamesStore } from 'src/app/core/stores/games.store';
import { AnalyticsService } from '../analytics/analytics.service';
import { GameScoreCalculatorService } from '../game-score-calculator/game-score-calculator.service';
import { HapticService } from '../haptic/haptic.service';
import { ToastService } from '../toast/toast.service';
import { UtilsService } from '../utils/utils.service';
import { parseInputValue } from '../game-utils/bowling-frame-formatter.service';
import { isGameValid, isValidFrameScore, canUndoLastThrow } from '../game-utils/bowling-game-validation.service';
import {
  removeThrow,
  recordThrow,
  isCellAccessible,
  processPinThrow,
  applyPinModeUndo,
  getAvailablePins,
  calculateIsClean,
  cloneFrames,
} from '../game-utils/game-utils.service';
import { Game, Frame } from '../../models/game.model';

export interface EditFocus {
  frameIndex: number;
  throwIndex: number;
}

export type ThrowInputResult = 'invalid' | 'recorded' | 'removed';

@Injectable()
export class GameEditService {
  private gamesStore = inject(GamesStore);
  private hapticService = inject(HapticService);
  private toastService = inject(ToastService);
  private utilsService = inject(UtilsService);
  private gameScoreCalculator = inject(GameScoreCalculatorService);
  private analyticsService = inject(AnalyticsService);

  private isEditModeMap: Record<string, boolean> = {};
  private originalGameState: Record<string, Game> = {};
  private editedGameStates: Record<string, Game> = {};
  private editedFocusMap: Record<string, EditFocus> = {};

  // QUERIES
  isEditMode(gameId: string): boolean {
    return !!this.isEditModeMap[gameId];
  }

  getEditedGame(gameId: string): Game | undefined {
    return this.editedGameStates[gameId];
  }

  getFocus(gameId: string): EditFocus | undefined {
    return this.editedFocusMap[gameId];
  }

  startEdit(game: Game): void {
    if (this.isEditModeMap[game.gameId]) return;

    this.originalGameState[game.gameId] = structuredClone(game);
    this.editedGameStates[game.gameId] = structuredClone(game);
    this.isEditModeMap[game.gameId] = true;
    this.hapticService.vibrate(ImpactStyle.Light);

    if (game.isPinMode) {
      this.editedFocusMap[game.gameId] = this.computeInitialFocus(this.editedGameStates[game.gameId]);
    }
  }

  cancelEdit(game: Game): void {
    const saved = this.originalGameState[game.gameId];
    if (saved) {
      Object.assign(game, saved);
      delete this.originalGameState[game.gameId];
    }

    delete this.editedGameStates[game.gameId];
    delete this.editedFocusMap[game.gameId];

    if (game.isSeries) {
      this.propagateSeriesFields(game, game.league, game.patterns);
    }

    this.isEditModeMap[game.gameId] = false;
    this.hapticService.vibrate(ImpactStyle.Light);
  }

  async saveEdit(game: Game): Promise<boolean> {
    try {
      const editedState = this.editedGameStates[game.gameId];
      const updatedGame = this.buildUpdatedGame(game, editedState);

      if (!isGameValid(updatedGame)) {
        this.hapticService.vibrate(ImpactStyle.Heavy);
        this.toastService.showToast(TOAST_MESSAGES.invalidInput, 'bug', true);
        return false;
      }

      const original = this.originalGameState[game.gameId];
      const leagueChanged = original && original.league !== updatedGame.league;
      const patternsChanged = original && JSON.stringify(original.patterns) !== JSON.stringify(updatedGame.patterns);

      if (updatedGame.isSeries && (leagueChanged || patternsChanged)) {
        await this.saveWithSeriesPropagation(updatedGame);
      } else {
        await this.gamesStore.saveGameToLocalStorage(updatedGame);
      }

      this.toastService.showToast(TOAST_MESSAGES.gameUpdateSuccess, 'refresh-outline');
      this.hapticService.vibrate(ImpactStyle.Light);
      this.analyticsService.trackGameEdited();

      this.isEditModeMap[game.gameId] = false;
      delete this.originalGameState[game.gameId];
      delete this.editedGameStates[game.gameId];
      delete this.editedFocusMap[game.gameId];

      return true;
    } catch (error) {
      this.toastService.showToast(TOAST_MESSAGES.gameUpdateError, 'bug', true);
      console.error('Error saving game edit:', error);
      return false;
    }
  }

  // SCORE MODE
  handleThrowInput(event: { frameIndex: number; throwIndex: number; value: string }, game: Game): ThrowInputResult {
    const { frameIndex, throwIndex, value } = event;
    const editedGame = this.editedGameStates[game.gameId] ?? structuredClone(game);
    const frames = cloneFrames(editedGame.frames);

    if (value.length === 0) {
      removeThrow(frames, frameIndex, throwIndex);
      this.updateGameWithNewFrames(game.gameId, frames);
      return 'removed';
    }

    const parsed = parseInputValue(value, frameIndex, throwIndex, frames);

    if (!this.utilsService.isValidNumber0to10(parsed)) {
      this.hapticService.vibrate(ImpactStyle.Heavy);
      return 'invalid';
    }

    if (!isValidFrameScore(parsed, frameIndex, throwIndex, frames)) {
      this.hapticService.vibrate(ImpactStyle.Heavy);
      return 'invalid';
    }

    recordThrow(frames, frameIndex, throwIndex, parsed);
    this.updateGameWithNewFrames(game.gameId, frames);
    return 'recorded';
  }

  // PIN MODE
  selectCell(game: Game, frameIndex: number, throwIndex: number): void {
    if (!this.isEditModeMap[game.gameId] || !game.isPinMode) return;

    const editedGame = this.editedGameStates[game.gameId];
    if (isCellAccessible(editedGame.frames, frameIndex, throwIndex)) {
      this.editedFocusMap[game.gameId] = { frameIndex, throwIndex };
    }
  }

  confirmPinThrow(pinsKnockedDown: number[], game: Game): void {
    if (!this.isEditModeMap[game.gameId] || !game.isPinMode) return;

    const focus = this.editedFocusMap[game.gameId] ?? { frameIndex: 0, throwIndex: 0 };
    const editedGame = this.editedGameStates[game.gameId] ?? structuredClone(game);

    const result = processPinThrow(editedGame.frames, focus.frameIndex, focus.throwIndex, pinsKnockedDown);

    this.editedFocusMap[game.gameId] = {
      frameIndex: result.nextFrameIndex,
      throwIndex: result.nextThrowIndex,
    };

    this.updateGameWithNewFrames(game.gameId, result.updatedFrames);
  }

  undoPinThrow(game: Game): void {
    if (!this.isEditModeMap[game.gameId] || !game.isPinMode) return;

    const focus = this.editedFocusMap[game.gameId];
    if (!focus) return;

    const editedGame = this.editedGameStates[game.gameId];
    const result = applyPinModeUndo(editedGame.frames, focus.frameIndex, focus.throwIndex);
    if (!result) return;

    this.editedFocusMap[game.gameId] = {
      frameIndex: result.nextFrameIndex,
      throwIndex: result.nextThrowIndex,
    };

    this.updateGameWithNewFrames(game.gameId, result.updatedFrames);
  }

  getPinsLeftStanding(game: Game): number[] {
    const focus = this.editedFocusMap[game.gameId];
    if (!focus) return getAvailablePins(0, 0, []);

    const editedGame = this.editedGameStates[game.gameId];
    const frame = editedGame.frames[focus.frameIndex];
    return getAvailablePins(focus.frameIndex, focus.throwIndex, frame.throws ?? []);
  }

  canRecordStrike(game: Game): boolean {
    return this.getPinsLeftStanding(game).length === 10;
  }

  canRecordSpare(game: Game): boolean {
    const left = this.getPinsLeftStanding(game);
    return left.length > 0 && left.length < 10;
  }

  canUndoPinThrow(game: Game): boolean {
    const focus = this.editedFocusMap[game.gameId];
    if (!focus) return false;

    const editedGame = this.editedGameStates[game.gameId];
    return canUndoLastThrow(editedGame.frames, focus.frameIndex, focus.throwIndex);
  }

  // SERIES PROPAGATION (in-memory only)
  propagateSeriesFields(game: Game, league?: string, patterns?: string[]): void {
    if (!game.isSeries) return;

    this.gamesStore.updateGamesInMemory((games) =>
      games.map((g) => {
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

  // PRIVATE HELPERS
  private computeInitialFocus(game: Game): EditFocus {
    for (let i = 9; i >= 0; i--) {
      const f = game.frames[i];
      if (f?.throws?.length) {
        return { frameIndex: i, throwIndex: Math.max(0, f.throws.length - 1) };
      }
    }
    return { frameIndex: 9, throwIndex: 0 };
  }

  private buildUpdatedGame(game: Game, editedState: Game | undefined): Game {
    if (!editedState) {
      return { ...game, isPractice: !game.league };
    }
    return {
      ...game,
      frames: editedState.frames,
      frameScores: editedState.frameScores,
      totalScore: editedState.totalScore,
      isPractice: !game.league,
      isPerfect: editedState.totalScore === 300,
      isClean: calculateIsClean(editedState.frames),
    };
  }

  private async saveWithSeriesPropagation(updatedGame: Game): Promise<void> {
    await this.gamesStore.saveGameToLocalStorage(updatedGame);

    const seriesMembers = this.gamesStore
      .games()
      .filter((g) => g.seriesId === updatedGame.seriesId && g.gameId !== updatedGame.gameId)
      .map((g) => ({
        ...g,
        league: updatedGame.league,
        patterns: updatedGame.patterns,
        isPractice: !updatedGame.league,
      }));

    await this.gamesStore.saveGamesToLocalStorage(seriesMembers);
  }

  private updateGameWithNewFrames(gameId: string, frames: Frame[]): void {
    const scoreResult = this.gameScoreCalculator.calculateScoreFromFrames(frames);
    const editedGame = this.editedGameStates[gameId];
    if (!editedGame) return;

    this.editedGameStates[gameId] = {
      ...editedGame,
      frames,
      frameScores: scoreResult.frameScores,
      totalScore: scoreResult.totalScore,
    };
  }
}
