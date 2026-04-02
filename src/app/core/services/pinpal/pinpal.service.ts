import { Injectable } from '@angular/core';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import { Game, Frame, Throw, numberArraysToFrames } from 'src/app/core/models/game.model';
import { StorageService } from 'src/app/core/services/storage/storage.service';
import { GameScoreCalculatorService } from 'src/app/core/services/game-score-calculator/game-score-calculator.service';
import { GameUtilsService } from 'src/app/core/services/game-utils/game-utils.service';
import { SortUtilsService } from 'src/app/core/services/sort-utils/sort-utils.service';
import { GameFilterService } from 'src/app/core/services/game-filter/game-filter.service';

/** Row returned from the games JOIN query */
interface GameRow {
  pk: number;
  totalScore: number | null;
  notes: string | null;
  leagueName: string | null;
  ballName: string | null;
  patternName: string | null;
  weekDate: number | null;
}

/** Row returned from the frames query */
interface FrameRow {
  frameNum: number;
  scores: number;
}

@Injectable({
  providedIn: 'root',
})
export class PinpalService {
  private sqlInstance: SqlJsStatic | null = null;

  constructor(
    private storageService: StorageService,
    private scoreCalculator: GameScoreCalculatorService,
    private gameUtilsService: GameUtilsService,
    private sortUtils: SortUtilsService,
    private gameFilterService: GameFilterService,
  ) {}

  /**
   * Reads a PinPal .pinpal (SQLite) backup file and returns the number of games imported.
   */
  async importFromFile(file: File): Promise<number> {
    const buffer = await this.readFileAsArrayBuffer(file);
    const SQL = await this.getSqlJs();
    const sqliteBytes = this.extractSqliteBytes(buffer);
    const db = new SQL.Database(sqliteBytes);

    try {
      const hasFrameTable = this.tableExists(db, 'frame');
      const gameRows = this.queryGames(db);
      const timestamp = Date.now();

      const games: Game[] = [];
      for (let i = 0; i < gameRows.length; i++) {
        const row = gameRows[i];
        const frames = hasFrameTable ? this.queryFrames(db, row.pk) : [];

        // Only include complete games (10 frames) when frame data is available
        if (hasFrameTable && frames.length !== 10) continue;

        const { totalScore: calcTotal, frameScores } = hasFrameTable
          ? this.scoreCalculator.calculateScoreFromFrames(frames)
          : { totalScore: row.totalScore ?? 0, frameScores: [] };

        const totalScore = hasFrameTable ? calcTotal : (row.totalScore ?? 0);
        const isClean = hasFrameTable ? this.gameUtilsService.calculateIsClean(frames) : false;
        const isPerfect = totalScore === 300;
        const league = row.leagueName ?? '';

        games.push({
          gameId: `${timestamp}_${i}_${Math.random().toString(36).slice(2, 9)}`,
          date: this.parseDate(row.weekDate),
          frames,
          totalScore,
          frameScores,
          isClean,
          isPerfect,
          isPractice: league === '',
          isPinMode: false,
          league,
          patterns: row.patternName ? [row.patternName] : [],
          balls: row.ballName ? [row.ballName] : [],
          note: row.notes ?? '',
        });
      }

      const sortedGames = this.sortUtils.sortGameHistoryByDate(games);
      await this.storageService.saveGamesToLocalStorage(sortedGames);
      this.gameFilterService.setDefaultFilters();
      return games.length;
    } finally {
      db.close();
    }
  }

  private async getSqlJs(): Promise<SqlJsStatic> {
    if (!this.sqlInstance) {
      // Fetch the WASM binary as an ArrayBuffer so sql.js uses the non-streaming
      // WebAssembly.instantiate() path, which doesn't enforce the application/wasm
      // MIME type that servers sometimes omit.
      const wasmResponse = await fetch('assets/sql-wasm.wasm');
      const wasmBinary = await wasmResponse.arrayBuffer();
      this.sqlInstance = await initSqlJs({ wasmBinary });
    }
    return this.sqlInstance;
  }

  private readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Extracts the SQLite database bytes from a PinPal backup file.
   *
   * Some PinPal exports include leading metadata before the SQLite payload.
   * In that case we locate the SQLite file signature and slice from there.
   */
  private extractSqliteBytes(buffer: ArrayBuffer): Uint8Array {
    const bytes = new Uint8Array(buffer);
    const sqliteMagic = [
      0x53, // S
      0x51, // Q
      0x4c, // L
      0x69, // i
      0x74, // t
      0x65, // e
      0x20, // space
      0x66, // f
      0x6f, // o
      0x72, // r
      0x6d, // m
      0x61, // a
      0x74, // t
      0x20, // space
      0x33, // 3
      0x00, // \0
    ];

    const firstByte = sqliteMagic[0];
    let start = bytes.indexOf(firstByte);

    while (start !== -1 && start <= bytes.length - sqliteMagic.length) {
      let isMatch = true;
      for (let i = 1; i < sqliteMagic.length; i++) {
        if (bytes[start + i] !== sqliteMagic[i]) {
          isMatch = false;
          break;
        }
      }

      if (isMatch) return bytes.slice(start);
      start = bytes.indexOf(firstByte, start + 1);
    }

    throw new Error('Selected file does not contain a valid PinPal SQLite database.');
  }

  /** Returns true if the given table exists in the database. */
  private tableExists(db: Database, tableName: string): boolean {
    const result = db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`);
    return result.length > 0 && result[0].values.length > 0;
  }

  /**
   * Queries all games joined with their week date, league, ball, and pattern names.
   */
  private queryGames(db: Database): GameRow[] {
    const sql = `
      SELECT
        g.pk          AS pk,
        g.score       AS totalScore,
        g.notes       AS notes,
        w.date        AS weekDate,
        l.name        AS leagueName,
        b.name        AS ballName,
        p.name        AS patternName
      FROM game g
      LEFT JOIN week    w ON g.weekFk    = w.pk
      LEFT JOIN league  l ON g.leagueFk  = l.pk
      LEFT JOIN ball    b ON g.ballFk    = b.pk
      LEFT JOIN pattern p ON g.patternFk = p.pk
    `;

    const result = db.exec(sql);
    if (!result.length) return [];

    const { columns, values } = result[0];
    const col = (name: string) => columns.indexOf(name);

    return values.map((row) => ({
      pk: row[col('pk')] as number,
      totalScore: row[col('totalScore')] as number | null,
      notes: row[col('notes')] as string | null,
      weekDate: row[col('weekDate')] as number | null,
      leagueName: row[col('leagueName')] as string | null,
      ballName: row[col('ballName')] as string | null,
      patternName: row[col('patternName')] as string | null,
    }));
  }

  /**
   * Queries the frame rows for a given game primary key,
   * decodes the throw values and returns a Frame[] array.
   *
   * PinPal encodes throw values in the `scores` INTEGER column as packed bytes:
   *   throw1 = scores & 0xFF
   *   throw2 = (scores >> 8) & 0xFF
   *   throw3 = (scores >> 16) & 0xFF  (10th frame only)
   */
  private queryFrames(db: Database, gamePk: number): Frame[] {
    const sql = `
      SELECT frameNum, scores
      FROM frame
      WHERE gameFk = ${gamePk}
      ORDER BY frameNum ASC
    `;

    const result = db.exec(sql);
    if (!result.length) return [];

    const { columns, values } = result[0];
    const col = (name: string) => columns.indexOf(name);

    const frameRows: FrameRow[] = values.map((row) => ({
      frameNum: row[col('frameNum')] as number,
      scores: row[col('scores')] as number,
    }));

    const numberArrays: number[][] = frameRows.map(({ frameNum, scores }) =>
      this.decodeThrows(frameNum, scores),
    );

    return numberArraysToFrames(numberArrays).map((frame) => this.normalizeThrows(frame));
  }

  /**
   * Decodes the packed `scores` integer for a single frame into individual throw values.
   *
   * Encoding:  throw1 = scores & 0xFF
   *            throw2 = (scores >> 8) & 0xFF
   *            throw3 = (scores >> 16) & 0xFF
   */
  private decodeThrows(frameNum: number, scores: number): number[] {
    const throw1 = scores & 0xff;
    const throw2 = (scores >> 8) & 0xff;
    const throw3 = (scores >> 16) & 0xff;

    if (frameNum < 10) {
      // Frames 1–9: strike = only 1 throw; spare/open = 2 throws
      return throw1 === 10 ? [10] : [throw1, throw2];
    }

    // 10th frame: always 2–3 throws
    if (throw1 === 10 || throw1 + throw2 === 10) {
      return [throw1, throw2, throw3];
    }
    return [throw1, throw2];
  }

  /** Re-indexes throwIndex values to be 1-based and sequential. */
  private normalizeThrows(frame: Frame): Frame {
    return {
      ...frame,
      throws: frame.throws.map((t: Throw, i: number) => ({ ...t, throwIndex: i + 1 })),
    };
  }

  /**
   * Converts a SQLite date value to a millisecond Unix timestamp.
   *
   * PinPal stores dates as a REAL in the `week.date` column. Depending on the
   * app version the value may be:
   *   - A Julian Day Number   (JDN, ~2 400 000–2 500 000 for 1968–2040)
   *   - A Unix timestamp in seconds  (<  1 × 10^10)
   *   - A Unix timestamp in milliseconds (>= 1 × 10^10)
   */
  private parseDate(value: number | null): number {
    if (!value) return Date.now();
    if (value < 3_000_000) {
      // Julian Day Number → milliseconds
      return (value - 2440587.5) * 86400 * 1000;
    }
    if (value < 1e10) {
      // Unix timestamp in seconds
      return value * 1000;
    }
    // Unix timestamp in milliseconds
    return value;
  }
}
