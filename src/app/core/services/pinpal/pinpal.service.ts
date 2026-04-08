import { Injectable } from '@angular/core';
import initSqlJs, { Database, SqlJsStatic, SqlValue } from 'sql.js';
import { Ball } from 'src/app/core/models/ball.model';
import { Frame, Game, Throw, createEmptyFrames } from 'src/app/core/models/game.model';
import { GameFilterService } from 'src/app/core/services/game-filter/game-filter.service';
import { GameScoreCalculatorService } from 'src/app/core/services/game-score-calculator/game-score-calculator.service';
import { GameUtilsService } from 'src/app/core/services/game-utils/game-utils.service';
import { SortUtilsService } from 'src/app/core/services/sort-utils/sort-utils.service';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { GamesStore } from 'src/app/core/stores/games.store';
import { PatternsStore } from 'src/app/core/stores/patterns.store';
import { ToastService } from '../toast/toast.service';

interface GameRow {
  pk: number;
  totalScore: number | null;
  notes: string | null;
  leagueName: string | null;
  ballName: string | null;
  patternName: string | null;
  weekDate: number | null;
}
interface RawFrameRow {
  frameNum: number;
  scores: number | null;
  pins: number | null;
}
@Injectable({
  providedIn: 'root',
})
export class PinpalService {
  private static readonly SQLITE_HEADER = 'SQLite format 3';
  private sqlInstance: SqlJsStatic | null = null;

  constructor(
    private ballsStore: BallsStore,
    private patternsStore: PatternsStore,
    private gamesStore: GamesStore,
    private scoreCalculator: GameScoreCalculatorService,
    private gameUtilsService: GameUtilsService,
    private sortUtils: SortUtilsService,
    private gameFilterService: GameFilterService,
    private toastService: ToastService,
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

      // Namen für Matching laden
      const availableBalls = this.ballsStore.allBalls();
      const availableBallNames = availableBalls.map((b) => b.ball_name);
      const availableBallsByName = new Map(availableBalls.map((ball) => [ball.ball_name.toLowerCase(), ball]));
      const availablePatternNames = this.patternsStore.allPatterns().map((p) => p.title || '');
      const ballsToAddToArsenal = new Map<string, Ball>();

      const games: Game[] = [];
      for (let i = 0; i < gameRows.length; i++) {
        const row = gameRows[i];

        const dbFrameResult = hasFrameTable ? this.getRawFrameData(db, row.pk) : [];

        if (dbFrameResult.length !== 12) {
          continue;
        }

        const { frames, isPinMode } = this.processFrames(dbFrameResult);

        const { totalScore: calcTotal, frameScores } = this.scoreCalculator.calculateScoreFromFrames(frames);
        const totalScore = frames.some((f) => f.throws.length > 0) ? calcTotal : (row.totalScore ?? 0);

        const matchedBall = this.findBestMatch(row.ballName, availableBallNames);
        const matchedPattern = this.findBestMatch(row.patternName, availablePatternNames);
        const matchedBallObject = matchedBall ? availableBallsByName.get(matchedBall.toLowerCase()) : undefined;

        if (matchedBallObject) {
          const ballKey = `${matchedBallObject.ball_id}_${matchedBallObject.core_weight}`;
          ballsToAddToArsenal.set(ballKey, matchedBallObject);
        }

        games.push({
          gameId: `${timestamp}_${i}_${Math.random().toString(36).slice(2, 9)}`,
          date: this.parseDate(row.weekDate),
          frames,
          totalScore,
          frameScores,
          isClean: this.gameUtilsService.calculateIsClean(frames),
          isPerfect: totalScore === 300,
          isPractice: (row.leagueName ?? '') === '',
          isPinMode: isPinMode,
          league: row.leagueName ?? '',
          patterns: matchedPattern ? [matchedPattern] : [],
          balls: matchedBall ? [matchedBall] : [],
          note: row.notes ?? '',
        });
      }

      const sortedGames = this.sortUtils.sortGameHistoryByDate(games);
      await this.gamesStore.saveGamesToLocalStorage(sortedGames);
      const arsenalSaveResults = await Promise.allSettled([...ballsToAddToArsenal.values()].map((ball) => this.ballsStore.saveBallToArsenal(ball)));
      const failedArsenalSaves = arsenalSaveResults.filter((result) => result.status === 'rejected');
      if (failedArsenalSaves.length > 0) {
        this.toastService.showToast("Import finished, but some balls couldn't be added to the arsenal.", 'bug-outline');
      }
      this.gameFilterService.setDefaultFilters();
      return games.length;
    } finally {
      db.close();
    }
  }

  private processFrames(dbRows: RawFrameRow[]): { frames: Frame[]; isPinMode: boolean } {
    const frames = createEmptyFrames();
    let allFramesHavePinData = true;

    const rows = dbRows.sort((a, b) => a.frameNum - b.frameNum);

    for (let i = 0; i < 9; i++) {
      const row = rows[i];
      if (!row) continue;
      const pins = row.pins ?? 0;
      const scores = row.scores ?? 0;

      const isDummyMask = row.pins === 1073741823 || row.pins === 1072694271;

      const isEmpty = row.pins === 0 && scores === 0;

      if (!isEmpty) {
        if (!isDummyMask) {
          frames[i].throws = this.decodePinpalThrows(i + 1, pins);
        } else {
          frames[i].throws = this.decodeManualNibbles(scores);
          allFramesHavePinData = false;
        }
      }
    }

    const r9 = rows[9];
    const r10 = rows[10];
    const r11 = rows[11];

    if (r9) {
      const r9Pins = r9.pins || 0;
      const r9Scores = r9.scores || 0;

      const isDummyMask10 = r9.pins === 1073741823 || r9.pins === 1072694271;
      const isEmpty10 = r9.pins === 0 && r9.scores === 0;

      if (!isEmpty10) {
        if (!isDummyMask10) {
          frames[9].throws = this.decodePinpalThrows(10, r9Pins);
        } else {
          frames[9].throws = this.decode10thFrameScores(r9Scores, r10?.scores || 0, r11?.scores || 0);
          allFramesHavePinData = false;
        }
      }
    }

    return { frames, isPinMode: allFramesHavePinData };
  }

  /**
   * Dekodiert Frames 1-9 aus der Score-Spalte.
   * W1 = Rechtes Nibble
   * Total = Linkes Nibble
   */
  private decodeManualNibbles(packedScore: number): Throw[] {
    if (!packedScore || packedScore === 0) return [];

    const w1 = packedScore & 0x0f;
    const total = (packedScore >> 4) & 0x0f;
    const w2 = total - w1;

    const throws: Throw[] = [];
    if (w1 <= 10) throws.push({ value: w1, throwIndex: 1 });
    if (w1 < 10 && w2 >= 0 && w2 <= 10) throws.push({ value: w2, throwIndex: 2 });

    return throws;
  }

  /**
   * Universeller Decoder für Frame 10. Liest über 3 Zeilen hinweg.
   */
  private decode10thFrameScores(s9 = 0, s10 = 0, s11 = 0): Throw[] {
    if (s9 === 0) return [];
    const throws: Throw[] = [];

    const w1 = s9 & 0x0f;
    const t1 = (s9 >> 4) & 0x0f;
    const w2_from_s9 = t1 - w1;

    if (w1 <= 10) throws.push({ value: w1, throwIndex: 1 });

    if (w1 === 10) {
      // Strike im ersten Wurf -> Zweiter Wurf steht in s10
      const w2 = s10 & 0x0f;
      const t2 = (s10 >> 4) & 0x0f;
      const w3_from_s10 = t2 - w2;

      if (w2 <= 10) throws.push({ value: w2, throwIndex: 2 });

      if (w2 === 10) {
        // Zwei Strikes -> Dritter Wurf steht in s11
        const w3 = s11 & 0x0f;
        if (w3 <= 10) throws.push({ value: w3, throwIndex: 3 });
      } else {
        // Strike, gefolgt von z.B. 9, 1 -> Dritter Wurf steht ebenfalls in s10 (Differenz)
        if (w3_from_s10 >= 0 && w3_from_s10 <= 10) throws.push({ value: w3_from_s10, throwIndex: 3 });
      }
    } else {
      // Normaler Wurf (kein Strike) -> Wurf 2 steht in s9
      if (w2_from_s9 >= 0 && w2_from_s9 <= 10) throws.push({ value: w2_from_s9, throwIndex: 2 });

      if (w1 + w2_from_s9 === 10) {
        // Spare -> Dritter Wurf steht in s10
        const w3 = s10 & 0x0f;
        if (w3 <= 10) throws.push({ value: w3, throwIndex: 3 });
      }
    }
    return throws;
  }

  private decodePinpalThrows(frameNum: number, pinMask: number): Throw[] {
    const throws: Throw[] = [];
    const ALL_PINS_MASK = 1023;

    const standingW1 = pinMask % 1024;
    const standingW2 = Math.floor(pinMask / 1024) % 1024;
    const standingW3 = Math.floor(pinMask / (1024 * 1024)) % 1024;

    const standingMasks = [standingW1, standingW2];
    if (frameNum === 10) standingMasks.push(standingW3);

    let previousStanding = ALL_PINS_MASK;

    for (let i = 0; i < standingMasks.length; i++) {
      const currentStanding = standingMasks[i];
      if (i > 0 && currentStanding === 0 && previousStanding === 0) continue;

      const knockedDownMask = previousStanding ^ (previousStanding & currentStanding);
      const value = this.countSetBits(knockedDownMask);

      throws.push({
        value: value,
        throwIndex: i + 1,
        pinsKnockedDown: this.getPinListFromMask(knockedDownMask),
        pinsLeftStanding: this.getPinListFromMask(currentStanding),
      });

      if (frameNum < 10 && value === 10) break;
      previousStanding = currentStanding === 0 && (frameNum === 10 || value === 10) ? ALL_PINS_MASK : currentStanding;
    }
    return throws;
  }

  /**
   * Fuzzy Matching Logik
   */
  private findBestMatch(input: string | null, available: string[]): string | null {
    if (!input) return null;
    const sanitized = input.trim().toLowerCase();

    const exact = available.find((a) => a.toLowerCase() === sanitized);
    if (exact) return exact;

    const partial = available.find((a) => a.toLowerCase().includes(sanitized) || sanitized.includes(a.toLowerCase()));
    if (partial) return partial;

    return input.trim();
  }

  private getRawFrameData(db: Database, gamePk: number): RawFrameRow[] {
    const sql = `SELECT frameNum, scores, pins FROM frame WHERE gameFk = ${gamePk} ORDER BY frameNum ASC`;
    const result = db.exec(sql);
    if (!result.length) return [];

    const { columns, values } = result[0];
    const colFrameNum = columns.indexOf('frameNum');
    const colScores = columns.indexOf('scores');
    const colPins = columns.indexOf('pins');

    return values.map((row: SqlValue[]) => ({
      frameNum: row[colFrameNum] as number,
      scores: row[colScores] as number | null,
      pins: row[colPins] as number | null,
    }));
  }

  private extractSqliteBytes(buffer: ArrayBuffer): Uint8Array {
    const bytes = new Uint8Array(buffer);
    const headerBytes = new TextEncoder().encode(PinpalService.SQLITE_HEADER);
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
    if (start === -1) throw new Error('Keine gültige SQLite Datenbank gefunden.');
    return bytes.slice(start);
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
      if ((mask >> i) & 1) pins.push(i + 1);
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
    return Math.round(value);
  }
}
