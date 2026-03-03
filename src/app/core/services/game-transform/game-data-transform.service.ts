import { Injectable } from '@angular/core';
import { Game, Frame, Throw } from 'src/app/core/models/game.model';
import { GameUtilsService } from '../game-utils/game-utils.service';

/**
 * Configuration for series-specific properties that override game defaults
 */
export interface SeriesConfig {
  isSeries: boolean;
  seriesId: string;
}

@Injectable({
  providedIn: 'root',
})
export class GameDataTransformerService {
  constructor(private gameUtilsService: GameUtilsService) {}

  /**
   * Transforms and normalizes a Game object for persistence.
   * - Generates gameId and date if not present
   * - Normalizes frames to proper Frame[] format
   * - Calculates isClean and isPerfect
   * - Applies series configuration if provided
   *
   * @param game - The game object to transform
   * @param seriesConfig - Optional series configuration to apply
   * @returns A fully normalized Game object ready for storage
   */
  transformGameData(game: Game, seriesConfig?: SeriesConfig): Game {
    try {
      const gameId = game.gameId || Date.now() + '_' + Math.random().toString(36).slice(2, 9);
      const date = game.date || Date.now();
      const isPerfect = game.totalScore === 300;

      const isClean = this.gameUtilsService.calculateIsClean(game.frames);

      // Ensure frames are in proper Frame[] format
      const normalizedFrames: Frame[] = this.normalizeFrames(game.frames);

      return {
        gameId,
        date,
        frames: normalizedFrames,
        frameScores: game.frameScores,
        totalScore: game.totalScore,
        isSeries: seriesConfig?.isSeries ?? game.isSeries,
        seriesId: seriesConfig?.seriesId ?? game.seriesId,
        note: game.note,
        isPractice: game.isPractice,
        isPinMode: game.isPinMode ?? false,
        league: game.league,
        isClean,
        isPerfect,
        patterns: game.patterns ? [...game.patterns].sort() : [],
        balls: game.balls ? [...game.balls].sort() : undefined,
      };
    } catch (error) {
      throw new Error(`Error transforming game data: ${error}`);
    }
  }

  /**
   * Normalizes frames to ensure consistent Frame[] format.
   * Handles legacy number[][] format and ensures all throws have proper structure.
   */
  private normalizeFrames(frames: Frame[]): Frame[] {
    return frames.map((frame, frameIndex) => {
      if (Array.isArray(frame) && typeof frame[0] === 'number') {
        // Old format: number[]
        const numberArray = frame as unknown as number[];
        return {
          frameIndex: frameIndex + 1,
          throws: numberArray.map(
            (value: number, throwIndex: number): Throw => ({
              value,
              throwIndex: throwIndex + 1,
            }),
          ),
        };
      } else if (frame && 'throws' in frame) {
        return {
          frameIndex: frame.frameIndex || frameIndex + 1,
          throws: (frame.throws || []).map(
            (t: Throw, throwIndex: number): Throw => ({
              value: typeof t.value === 'string' ? parseInt(t.value, 10) : t.value,
              throwIndex: t.throwIndex || throwIndex + 1,
              isSplit: t.isSplit,
              pinsLeftStanding: t.pinsLeftStanding,
              pinsKnockedDown: t.pinsKnockedDown,
            }),
          ),
        };
      } else {
        // Empty frame
        return {
          frameIndex: frameIndex + 1,
          throws: [],
        };
      }
    });
  }
}
