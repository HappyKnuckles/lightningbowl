import { Injectable, computed, signal, Signal } from '@angular/core';
import { Game, Frame, Throw, createEmptyGame, cloneFrames, createThrow, getThrowValue } from 'src/app/core/models/game.model';
import { GameScoreCalculatorService } from 'src/app/core/services/game-score-calculator/game-score-calculator.service';
import { BowlingGameValidationService } from 'src/app/core/services/game-utils/bowling-game-validation.service';
import { GameDataTransformerService } from 'src/app/core/services/game-transform/game-data-transform.service';
import { StorageService } from 'src/app/core/services/storage/storage.service';
import { AnalyticsService } from 'src/app/core/services/analytics/analytics.service';
import { HighScoreAlertService } from 'src/app/core/services/high-score-alert/high-score-alert.service';

export interface PinModeState {
  currentFrameIndex: number;
  currentThrowIndex: number;
  throwsData: Throw[][];
}

@Injectable({
  providedIn: 'root',
})
export class GameSessionFacade {
  // STATE SIGNALS

  // Holds the state of all 19 potential games
  private _games = signal<Game[]>(Array.from({ length: 19 }, () => createEmptyGame()));

  // Holds cursor positions and throw history for Pin Input Mode
  private _pinModeState = signal<PinModeState[]>(
    Array.from({ length: 19 }, () => ({
      currentFrameIndex: 0,
      currentThrowIndex: 0,
      throwsData: Array.from({ length: 10 }, () => []),
    })),
  );

  // PUBLIC SELECTORS

  readonly games: Signal<Game[]> = this._games.asReadonly();
  readonly pinModeState: Signal<PinModeState[]> = this._pinModeState.asReadonly();

  readonly totalScores = computed(() => this._games().map((g) => g.totalScore));

  readonly maxScores = computed(() => this._games().map((g) => this.scoreCalculator.calculateMaxScoreFromFrames(g.frames, g.totalScore)));

  constructor(
    private scoreCalculator: GameScoreCalculatorService,
    private validationService: BowlingGameValidationService,
    private transformerService: GameDataTransformerService,
    private storageService: StorageService,
    private analyticsService: AnalyticsService,
    private highScoreService: HighScoreAlertService,
  ) {}

  // GAME MANAGEMENT

  /**
   * Resets a specific game or all games to empty state.
   */
  resetGames(specificIndex?: number): void {
    if (specificIndex !== undefined && specificIndex >= 0) {
      // Reset Single
      this._games.update((games) => games.map((g, i) => (i === specificIndex ? createEmptyGame() : g)));
      this.resetPinModeState(specificIndex);
    } else {
      // Reset All
      this._games.set(Array.from({ length: 19 }, () => createEmptyGame()));
      this.resetPinModeState();
    }
  }
  readonly hasThrows = computed(() => this._games().some((game) => game.frames.some((frame) => frame.throws.length > 0)));
  /**
   * Updates metadata (note, balls, league, etc) for a specific game.
   */
  updateGame(index: number, updates: Partial<Game>): void {
    this._games.update((games) => games.map((g, i) => (i === index ? { ...g, ...updates } : g)));
  }

  /**
   * Used for Series Mode: copies League, Practice, and Patterns from the first game
   * to the other games in the series.
   */
  propagateSeriesMetadata(sourceIndex: number, targetIndexes: number[]): void {
    const sourceGame = this._games()[sourceIndex];

    this._games.update((games) =>
      games.map((g, i) => {
        if (targetIndexes.includes(i) && i !== sourceIndex) {
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
  }

  // GRID INPUT LOGIC (Text/Keyboard Input)

  /**
   * Processes a text input from the Game Grid.
   * Returns true if valid (UI should focus next), false if invalid.
   */
  handleGridInput(index: number, frameIndex: number, throwIndex: number, value: string): boolean {
    const game = this._games()[index];
    const frames = cloneFrames(game.frames);

    // Case: Deleting a score
    if (value.length === 0) {
      this.removeThrow(frames, frameIndex, throwIndex);
      this.recalculateAndUpdate(index, frames);
      return true;
    }

    // Case: Entering a score
    const parsedValue = this.validationService.parseInputValue(value, frameIndex, throwIndex, frames);
    const isValidNumber = this.validationService.isValidNumber0to10(parsedValue);
    const isValidScore = this.validationService.isValidFrameScore(parsedValue, frameIndex, throwIndex, frames);

    if (!isValidNumber || !isValidScore) {
      return false; // Controller should trigger vibration/error UI
    }

    this.recordThrow(frames, frameIndex, throwIndex, parsedValue);
    this.recalculateAndUpdate(index, frames);

    // Also update pin mode cursor to sync up if user switches modes

    return true;
  }

  // PIN INPUT MODE LOGIC

  /**
   * Determines which pins are available to hit based on previous throws in the frame.
   */
  getPinsLeftStanding(gameIndex: number): number[] {
    const allPins = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const state = this._pinModeState()[gameIndex];
    const { currentFrameIndex, currentThrowIndex, throwsData } = state;

    // First throw is always full rack
    if (currentThrowIndex === 0) return allPins;

    const frameData = throwsData[currentFrameIndex];

    // 10th Frame Special Logic
    if (currentFrameIndex === 9) {
      const t1 = frameData?.[0];
      const t2 = frameData?.[1];

      if (currentThrowIndex === 1) {
        // If Strike on 1st, rack resets (all pins). Else return leftovers.
        if (t1?.value === 10) return allPins;
        return t1?.pinsLeftStanding ?? allPins;
      }

      if (currentThrowIndex === 2) {
        // XX (Two Strikes) -> Reset
        if (t1?.value === 10 && t2?.value === 10) return allPins;
        // X9 (Strike then miss) -> Leftovers from 2nd throw
        if (t1?.value === 10 && t2?.value !== 10) return t2?.pinsLeftStanding ?? allPins;
        // 9/ (Spare) -> Reset
        if (t1 && t2 && t1.value !== 10 && t1.value + t2.value === 10) return allPins;
      }
    }

    // Normal Frames (1-9): Return leftovers from previous throw
    const prevThrow = frameData?.[currentThrowIndex - 1];
    return prevThrow ? prevThrow.pinsLeftStanding! : allPins;
  }

  /**
   * Processes a confirmed selection of pins from the Pin Input Component.
   */
  handlePinThrow(gameIndex: number, pinsKnockedDown: number[]): void {
    const state = this._pinModeState()[gameIndex];
    const { currentFrameIndex, currentThrowIndex, throwsData } = state;

    // 1. Calculations
    const availablePins = this.getPinsLeftStanding(gameIndex);
    const pinsLeftStanding = availablePins.filter((pin) => !pinsKnockedDown.includes(pin));
    const count = pinsKnockedDown.length;

    // 2. Check Split
    const isSplit = this.calculateSplit(currentFrameIndex, currentThrowIndex, pinsLeftStanding, throwsData);

    // 3. Update Throws History (Local State)
    const newThrowsData = [...throwsData];
    if (!newThrowsData[currentFrameIndex]) newThrowsData[currentFrameIndex] = [];

    // Copy inner array to ensure immutability
    newThrowsData[currentFrameIndex] = [...newThrowsData[currentFrameIndex]];

    newThrowsData[currentFrameIndex][currentThrowIndex] = {
      value: count,
      throwIndex: currentThrowIndex + 1,
      pinsLeftStanding,
      pinsKnockedDown,
      isSplit,
    };

    // 4. Update Actual Game Frames (Shared State)
    const frames = cloneFrames(this._games()[gameIndex].frames);
    this.recordThrow(frames, currentFrameIndex, currentThrowIndex, count, pinsLeftStanding, pinsKnockedDown, isSplit);

    // 5. Calculate Next Cursor Position
    const nextPos = this.calculateNextPosition(currentFrameIndex, currentThrowIndex, count, frames);

    // 6. Commit State
    this._pinModeState.update((states) => {
      const copy = [...states];
      copy[gameIndex] = {
        currentFrameIndex: nextPos.nextFrameIndex,
        currentThrowIndex: nextPos.nextThrowIndex,
        throwsData: newThrowsData,
      };
      return copy;
    });

    // 7. Recalculate Scores
    this.recalculateAndUpdate(gameIndex, frames);
  }

  /**
   * Undoes the last throw in Pin Mode.
   */
  undoPinThrow(gameIndex: number): void {
    const state = this._pinModeState()[gameIndex];
    const { currentFrameIndex, currentThrowIndex, throwsData } = state;

    // 1. Detect Special 10th Frame Case
    const isGameFullAtCursor = currentFrameIndex === 9 && throwsData[9] && throwsData[9][currentThrowIndex] !== undefined;

    let prevFrameIndex: number;
    let prevThrowIndex: number;

    if (isGameFullAtCursor) {
      // Don't calculate "previous", just stay here to clear the current one
      prevFrameIndex = currentFrameIndex;
      prevThrowIndex = currentThrowIndex;
    } else {
      // Normal behavior: Step back one
      const pos = this.calculatePreviousPosition(currentFrameIndex, currentThrowIndex, throwsData);
      prevFrameIndex = pos.prevFrameIndex;
      prevThrowIndex = pos.prevThrowIndex;
    }

    if (prevFrameIndex < 0) return; // Cannot undo start of game

    // 2. Clear Data in History
    const newThrowsData = [...throwsData];
    if (newThrowsData[prevFrameIndex]) {
      newThrowsData[prevFrameIndex] = newThrowsData[prevFrameIndex].slice(0, prevThrowIndex);
    }

    // 3. Clear Data in Frames
    const frames = cloneFrames(this._games()[gameIndex].frames);
    const frame = frames[prevFrameIndex];
    if (frame.throws.length > prevThrowIndex) {
      frame.throws = frame.throws.slice(0, prevThrowIndex);
    }

    // 4. Update State
    this._pinModeState.update((states) => {
      const copy = [...states];
      copy[gameIndex] = {
        currentFrameIndex: prevFrameIndex,
        currentThrowIndex: prevThrowIndex,
        throwsData: newThrowsData,
      };
      return copy;
    });

    this.recalculateAndUpdate(gameIndex, frames);
  }
  // PERSISTENCE (Saving)

  /**
   * Validates and saves the specified games to storage.
   * Returns true on success, throws error on failure.
   */
  async saveGames(indexesToSave: number[], config: { isSeries: boolean; seriesId: string; isPinMode: boolean }): Promise<boolean> {
    const gamesToSave = indexesToSave.map((i) => this._games()[i]);

    // 1. Validation
    if (!gamesToSave.every((g) => this.validationService.isGameValid(g))) {
      return false; // Caller should handle UI alert
    }

    // 2. Transform and Save
    try {
      const savedGameObjects: Game[] = [];
      const seriesConfig = config.isSeries ? { isSeries: config.isSeries, seriesId: config.seriesId } : undefined;

      for (const game of gamesToSave) {
        if (game.league === 'New') continue; // Skip invalid league selections

        // Apply isPinMode to the game before transformation
        const gameWithPinMode: Game = { ...game, isPinMode: config.isPinMode };
        const gameData = this.transformerService.transformGameData(gameWithPinMode, seriesConfig);

        await this.storageService.saveGameToLocalStorage(gameData);
        savedGameObjects.push(gameData);
      }

      // 3. Post-Save Actions (Analytics & Alerts)
      if (savedGameObjects.length > 0) {
        this.analyticsService.trackGameSaved({
          score: savedGameObjects[0].totalScore, // tracking first game score/avg
        });

        const allGames = this.storageService.games();
        if (savedGameObjects.length === 1) {
          await this.highScoreService.checkAndDisplayHighScoreAlerts(savedGameObjects[0], allGames);
        } else {
          await this.highScoreService.checkAndDisplayHighScoreAlertsForMultipleGames(savedGameObjects, allGames);
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error in Facade Save:', error);
      throw error;
    }
  }

  // PRIVATE HELPERS

  private recalculateAndUpdate(index: number, frames: Frame[]) {
    const scoreResult = this.scoreCalculator.calculateScoreFromFrames(frames);
    this.updateGame(index, {
      frames,
      frameScores: scoreResult.frameScores,
      totalScore: scoreResult.totalScore,
    });
  }

  private recordThrow(
    frames: Frame[],
    fIdx: number,
    tIdx: number,
    value: number,
    pinsLeft?: number[],
    pinsKnocked?: number[],
    isSplit?: boolean,
  ): void {
    while (frames[fIdx].throws.length <= tIdx) {
      frames[fIdx].throws.push(createThrow(0, frames[fIdx].throws.length + 1));
    }
    const t = createThrow(value, tIdx + 1);

    // Optional properties for Pin Mode accuracy
    if (pinsLeft) t.pinsLeftStanding = pinsLeft;
    if (pinsKnocked) t.pinsKnockedDown = pinsKnocked;
    if (isSplit !== undefined) t.isSplit = isSplit;

    frames[fIdx].throws[tIdx] = t;
  }

  private removeThrow(frames: Frame[], fIdx: number, tIdx: number): void {
    const frame = frames[fIdx];
    if (!frame || !frame.throws) return;
    if (tIdx >= 0 && tIdx < frame.throws.length) {
      frame.throws.splice(tIdx, 1);
      // Re-index remaining throws
      frame.throws.forEach((t, idx) => (t.throwIndex = idx + 1));
    }
  }

  private resetPinModeState(index?: number): void {
    const emptyState = {
      currentFrameIndex: 0,
      currentThrowIndex: 0,
      throwsData: Array.from({ length: 10 }, () => []),
    };

    this._pinModeState.update((states) => {
      if (index !== undefined) {
        return states.map((s, i) => (i === index ? emptyState : s));
      }
      return Array.from({ length: 19 }, () => emptyState);
    });
  }

  private calculateSplit(frameIndex: number, throwIndex: number, pinsLeftStanding: number[], throwsData: Throw[][]): boolean {
    // Normal Frames 1-9
    if (frameIndex < 9) {
      if (throwIndex === 0) return this.validationService.isSplit(pinsLeftStanding);
      return false;
    }

    // 10th Frame
    if (frameIndex === 9) {
      if (throwIndex === 0) return this.validationService.isSplit(pinsLeftStanding);

      const t1 = throwsData[9]?.[0];
      // Split on 2nd throw if first was Strike
      if (throwIndex === 1 && t1?.value === 10) {
        return this.validationService.isSplit(pinsLeftStanding);
      }

      // Split on 3rd throw if (XX) or (Spare)
      if (throwIndex === 2) {
        const t2 = throwsData[9]?.[1];
        // XX -> Pins reset -> Split possible
        if (t1?.value === 10 && t2?.value === 10) return this.validationService.isSplit(pinsLeftStanding);
        // Spare -> Pins reset -> Split possible
        if (t1 && t2 && t1.value !== 10 && t1.value + t2.value === 10) return this.validationService.isSplit(pinsLeftStanding);
      }
    }
    return false;
  }

  private calculateNextPosition(
    frameIndex: number,
    throwIndex: number,
    pinsKnockedDown: number,
    frames: Frame[],
  ): { nextFrameIndex: number; nextThrowIndex: number } {
    // Frames 1-9
    if (frameIndex < 9) {
      if (throwIndex === 0) {
        // Strike -> Next Frame
        if (pinsKnockedDown === 10) return { nextFrameIndex: frameIndex + 1, nextThrowIndex: 0 };
        // Open -> Second Throw
        return { nextFrameIndex: frameIndex, nextThrowIndex: 1 };
      }
      // End of 2nd throw -> Next Frame
      return { nextFrameIndex: frameIndex + 1, nextThrowIndex: 0 };
    }

    // 10th Frame
    const frame = frames[9];
    const t1 = getThrowValue(frame, 0);
    const t2 = getThrowValue(frame, 1);

    if (throwIndex === 0) return { nextFrameIndex: 9, nextThrowIndex: 1 };

    if (throwIndex === 1) {
      // Earned 3rd throw? (Strike or Spare)
      if (t1 === 10 || (t1 !== undefined && t2 !== undefined && t1 + t2 === 10)) {
        return { nextFrameIndex: 9, nextThrowIndex: 2 };
      }
      // Game Over position (stay here or mark complete)
      return { nextFrameIndex: 9, nextThrowIndex: 1 };
    }

    // After 3rd throw
    return { nextFrameIndex: 9, nextThrowIndex: 2 };
  }

  private calculatePreviousPosition(
    frameIndex: number,
    throwIndex: number,
    throwsData: Throw[][],
  ): { prevFrameIndex: number; prevThrowIndex: number } {
    if (throwIndex > 0) {
      return { prevFrameIndex: frameIndex, prevThrowIndex: throwIndex - 1 };
    }

    if (frameIndex === 0) {
      return { prevFrameIndex: -1, prevThrowIndex: -1 }; // Start of game
    }

    // Move to end of previous frame
    const prevFrameData = throwsData[frameIndex - 1];
    const prevLastIndex = prevFrameData ? prevFrameData.length - 1 : 0;

    return { prevFrameIndex: frameIndex - 1, prevThrowIndex: Math.max(0, prevLastIndex) };
  }
}
