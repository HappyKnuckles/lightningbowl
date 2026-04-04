import { Injectable } from '@angular/core';
import initSqlJs, { Database, SqlJsStatic, SqlValue } from 'sql.js';
import { Frame, Game, Throw, createEmptyFrames } from 'src/app/core/models/game.model';
import { GameFilterService } from 'src/app/core/services/game-filter/game-filter.service';
import { GameScoreCalculatorService } from 'src/app/core/services/game-score-calculator/game-score-calculator.service';
import { GameUtilsService } from 'src/app/core/services/game-utils/game-utils.service';
import { SortUtilsService } from 'src/app/core/services/sort-utils/sort-utils.service';
import { StorageService } from 'src/app/core/services/storage/storage.service';

interface GameRow {
  pk: number;
  totalScore: number | null;
  notes: string | null;
  leagueName: string | null;
  ballName: string | null;
  patternName: string | null;
  weekDate: number | null;
}

@Injectable({
  providedIn: 'root',
})
export class PinpalService {
  private static readonly SQLITE_HEADER = 'SQLite format 3';
  private sqlInstance: SqlJsStatic | null = null;

  constructor(
    private storageService: StorageService,
    private scoreCalculator: GameScoreCalculatorService,
    private gameUtilsService: GameUtilsService,
    private sortUtils: SortUtilsService,
    private gameFilterService: GameFilterService,
  ) {}

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

        const frames = hasFrameTable ? this.queryFrames(db, row.pk) : createEmptyFrames();

        const { totalScore: calcTotal, frameScores } = this.scoreCalculator.calculateScoreFromFrames(frames);

        const totalScore = frames.some((f) => f.throws.length > 0) ? calcTotal : (row.totalScore ?? 0);

        const isClean = this.gameUtilsService.calculateIsClean(frames);
        const league = row.leagueName ?? '';

        games.push({
          gameId: `${timestamp}_${i}_${Math.random().toString(36).slice(2, 9)}`,
          date: this.parseDate(row.weekDate),
          frames,
          totalScore,
          frameScores,
          isClean,
          isPerfect: totalScore === 300,
          isPractice: league === '',
          isPinMode: true,
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

  /**
   * Sucht nach "SQLite format 3" und schneidet alles davor ab.
   */
  private extractSqliteBytes(buffer: ArrayBuffer): Uint8Array {
    const bytes = new Uint8Array(buffer);
    const headerStr = PinpalService.SQLITE_HEADER;

    // Suche im Byte-Array nach dem Header-String
    const headerBytes = new TextEncoder().encode(headerStr);
    let start = -1;

    for (let i = 0; i < bytes.length - headerBytes.length; i++) {
      let match = true;
      for (let j = 0; j < headerBytes.length; j++) {
        if (bytes[i + j] !== headerBytes[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        start = i;
        break;
      }
    }

    if (start === -1) {
      throw new Error('Keine gültige SQLite Datenbank im PinPal Backup gefunden.');
    }

    return bytes.slice(start);
  }

  private queryFrames(db: Database, gamePk: number): Frame[] {
    const sql = `SELECT frameNum, scores, pins FROM frame WHERE gameFk = ${gamePk} ORDER BY frameNum ASC`;
    const result = db.exec(sql);
    const frames = createEmptyFrames();

    if (!result.length) return frames;

    const { columns, values } = result[0];
    const col = (name: string) => columns.indexOf(name);

    values.forEach((row: SqlValue[]) => {
      const dbFrameNum = row[col('frameNum')] as number;
      // PinPal nutzt oft 0-9 für FrameNum
      const frameIdx = dbFrameNum >= 0 && dbFrameNum <= 9 ? dbFrameNum : dbFrameNum - 1;

      if (frameIdx >= 0 && frameIdx < 10) {
        const pinMask = (row[col('pins')] as number) || 0;
        frames[frameIdx].throws = this.decodePinpalThrows(frameIdx + 1, pinMask);
      }
    });

    return frames;
  }

  /**
   * Dekodiert die 1024er Bitmaske in Throw-Objekte.
   * Logic: (Wurf2 * 1024) + Wurf1
   * Jeder Wurf ist eine 10-Bit Maske der STEHENDEN Pins.
   */
  private decodePinpalThrows(frameNum: number, pinMask: number): Throw[] {
    const throws: Throw[] = [];
    const ALL_PINS_MASK = 1023; // Alle 10 Pins stehen

    // Extrahiere stehende Pins pro Wurf
    const standingW1 = pinMask % 1024;
    const standingW2 = Math.floor(pinMask / 1024) % 1024;
    const standingW3 = Math.floor(pinMask / (1024 * 1024)) % 1024; // Nur für 10. Frame relevant

    const standingMasks = [standingW1, standingW2];
    if (frameNum === 10) standingMasks.push(standingW3);

    let previousStanding = ALL_PINS_MASK;

    for (let i = 0; i < standingMasks.length; i++) {
      const currentStanding = standingMasks[i];

      // Wenn 0, wurde dieser Wurf vielleicht nicht gemacht (außer im Falle eines Strikes im 1. Wurf)
      if (i > 0 && currentStanding === 0 && previousStanding === 0) continue;

      // Welche Pins sind in DIESEM Wurf gefallen?
      // (Pins die vorher standen, aber jetzt nicht mehr stehen)
      const knockedDownMask = previousStanding ^ (previousStanding & currentStanding);
      const value = this.countSetBits(knockedDownMask);

      const t: Throw = {
        value: value,
        throwIndex: i + 1,
        pinsKnockedDown: this.getPinListFromMask(knockedDownMask),
        pinsLeftStanding: this.getPinListFromMask(currentStanding),
      };

      throws.push(t);

      // Für den nächsten Wurf: Falls Strike oder Spare im 10., werden Pins neu aufgestellt
      if (frameNum < 10 && value === 10) break; // Strike beendet Frame

      if (currentStanding === 0 && (frameNum === 10 || value === 10)) {
        previousStanding = ALL_PINS_MASK; // Neu aufgestellt
      } else {
        previousStanding = currentStanding;
      }
    }

    return throws;
  }

  private countSetBits(n: number): number {
    let count = 0;
    while (n > 0) {
      n &= n - 1;
      count++;
    }
    return count;
  }

  private getPinListFromMask(mask: number): number[] {
    const pins = [];
    for (let i = 0; i < 10; i++) {
      if ((mask >> i) & 1) {
        pins.push(i + 1);
      }
    }
    return pins;
  }

  private async getSqlJs(): Promise<SqlJsStatic> {
    if (!this.sqlInstance) {
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

  private tableExists(db: Database, tableName: string): boolean {
    const result = db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`);
    return result.length > 0 && result[0].values.length > 0;
  }

  private queryGames(db: Database): GameRow[] {
    const sql = `
      SELECT g.pk, g.score as totalScore, g.notes, w.date as weekDate, 
             l.name as leagueName, b.name as ballName, p.name as patternName
      FROM game g
      LEFT JOIN week w ON g.weekFk = w.pk
      LEFT JOIN league l ON g.leagueFk = l.pk
      LEFT JOIN ball b ON g.ballFk = b.pk
      LEFT JOIN pattern p ON g.patternFk = p.pk`;

    const result = db.exec(sql);
    if (!result.length) return [];
    const { columns, values } = result[0];
    const col = (name: string) => columns.indexOf(name);

    return values.map((row: SqlValue[]) => ({
      pk: row[col('pk')] as number,
      totalScore: row[col('totalScore')] as number | null,
      notes: row[col('notes')] as string | null,
      weekDate: row[col('weekDate')] as number | null,
      leagueName: row[col('leagueName')] as string | null,
      ballName: row[col('ballName')] as string | null,
      patternName: row[col('patternName')] as string | null,
    }));
  }

  private parseDate(value: number | null): number {
    if (!value) return Date.now();
    if (value < 3_000_000) return (value - 2440587.5) * 86400 * 1000;
    if (value < 1e10) return value * 1000;
    return value;
  }
}
