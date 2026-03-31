import { Injectable } from '@angular/core';
import { Game, Frame, Throw, numberArraysToFrames } from 'src/app/core/models/game.model';
import { StorageService } from 'src/app/core/services/storage/storage.service';
import { GameScoreCalculatorService } from 'src/app/core/services/game-score-calculator/game-score-calculator.service';
import { GameUtilsService } from 'src/app/core/services/game-utils/game-utils.service';
import { SortUtilsService } from 'src/app/core/services/sort-utils/sort-utils.service';
import { GameFilterService } from 'src/app/core/services/game-filter/game-filter.service';

/**
 * Represents a single frame in the PinPal backup format.
 * PinPal uses either an array of throw values or an object with ball1/ball2/ball3 fields.
 */
type PinpalFrame = number[] | { ball1?: number | null; ball2?: number | null; ball3?: number | null };

/**
 * Represents a single game in the PinPal backup format.
 */
interface PinpalGame {
  id?: string;
  date?: string | number;
  score?: number;
  totalScore?: number;
  league?: string;
  leagueName?: string;
  location?: string;
  frames?: PinpalFrame[];
  notes?: string;
  note?: string;
}

/**
 * Represents a bowler entry (used in multi-bowler PinPal backups).
 */
interface PinpalBowler {
  name?: string;
  games?: PinpalGame[];
}

/**
 * Represents the top-level PinPal backup file structure.
 */
interface PinpalBackup {
  version?: number;
  games?: PinpalGame[];
  bowlers?: PinpalBowler[];
}

@Injectable({
  providedIn: 'root',
})
export class PinpalService {
  constructor(
    private storageService: StorageService,
    private scoreCalculator: GameScoreCalculatorService,
    private gameUtilsService: GameUtilsService,
    private sortUtils: SortUtilsService,
    private gameFilterService: GameFilterService,
  ) {}

  /**
   * Reads a PinPal backup JSON file and returns the number of games imported.
   */
  async importFromFile(file: File): Promise<number> {
    const text = await this.readFileAsText(file);
    const parsed = JSON.parse(text);
    const pinpalGames = this.extractGames(parsed);
    const timestamp = Date.now();
    const games = pinpalGames.map((pg, index) => this.convertGame(pg, timestamp, index));
    const validGames = games.filter((g) => g.frames.length === 10);
    const sortedGames = this.sortUtils.sortGameHistoryByDate(validGames);
    await this.storageService.saveGamesToLocalStorage(sortedGames);
    this.gameFilterService.setDefaultFilters();
    return validGames.length;
  }

  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  /**
   * Extracts the array of PinPal games from various possible backup structures.
   */
  private extractGames(data: unknown): PinpalGame[] {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid PinPal backup: not a valid JSON object or array');
    }

    // Direct array of games
    if (Array.isArray(data)) {
      return data as PinpalGame[];
    }

    const backup = data as PinpalBackup;

    // Top-level "games" array
    if (Array.isArray(backup.games)) {
      return backup.games;
    }

    // Top-level "bowlers" array (multi-bowler backup)
    if (Array.isArray(backup.bowlers)) {
      return backup.bowlers.flatMap((b) => b.games ?? []);
    }

    throw new Error('Invalid PinPal backup: no "games" or "bowlers" field found');
  }

  /**
   * Converts a PinPal game object to a Lightning Bowl Game model.
   */
  private convertGame(pg: PinpalGame, timestamp: number, index: number): Game {
    const frames = this.convertFrames(pg.frames ?? []);
    const { totalScore, frameScores } = this.scoreCalculator.calculateScoreFromFrames(frames);
    const isClean = this.gameUtilsService.calculateIsClean(frames);
    const isPerfect = totalScore === 300;
    const date = this.parseDate(pg.date);
    const league = pg.league ?? pg.leagueName ?? '';
    const gameId = pg.id ?? `${timestamp}_${index}_${Math.random().toString(36).slice(2, 9)}`;

    return {
      gameId,
      date,
      frames,
      totalScore,
      frameScores,
      isClean,
      isPerfect,
      isPractice: league === '',
      isPinMode: false,
      league,
      patterns: [],
      balls: [],
      note: pg.notes ?? pg.note ?? '',
    };
  }

  /**
   * Converts PinPal frames to the app's Frame[] format.
   */
  private convertFrames(pinpalFrames: PinpalFrame[]): Frame[] {
    const numberArrays: number[][] = pinpalFrames.map((frame) => {
      if (Array.isArray(frame)) {
        return frame.map(Number).filter((v) => !isNaN(v));
      }
      // Object format: { ball1, ball2, ball3 }
      const values: number[] = [];
      if (frame.ball1 != null) values.push(Number(frame.ball1));
      if (frame.ball2 != null) values.push(Number(frame.ball2));
      if (frame.ball3 != null) values.push(Number(frame.ball3));
      return values;
    });

    return numberArraysToFrames(numberArrays).map((frame) =>
      this.normalizeThrows(frame),
    );
  }

  /**
   * Re-indexes throwIndex values to be 1-based and sequential.
   */
  private normalizeThrows(frame: Frame): Frame {
    return {
      ...frame,
      throws: frame.throws.map((t: Throw, i: number) => ({ ...t, throwIndex: i + 1 })),
    };
  }

  /**
   * Parses a date value (string or timestamp number) to a millisecond timestamp.
   */
  private parseDate(date: string | number | undefined): number {
    if (!date) return Date.now();
    if (typeof date === 'number') {
      // If the number looks like seconds (< 1e12), convert to ms
      return date < 1e12 ? date * 1000 : date;
    }
    const parsed = Date.parse(date);
    return isNaN(parsed) ? Date.now() : parsed;
  }
}
