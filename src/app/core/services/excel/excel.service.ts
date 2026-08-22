import { Injectable } from '@angular/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { ImpactStyle } from '@capacitor/haptics';
import { Share } from '@capacitor/share';
import { isPlatform } from '@ionic/angular';
import type { Workbook, Worksheet } from 'exceljs';
import { Ball } from 'src/app/core/models/ball.model';
import { Game, Throw, ThrowBall } from 'src/app/core/models/game.model';
import { HighlightItemStats, LeaveStats, Stats } from 'src/app/core/models/stats.model';
import { HapticService } from 'src/app/core/services/haptic/haptic.service';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { GamesStore } from 'src/app/core/stores/games.store';
import { LeaguesStore } from 'src/app/core/stores/leagues.store';
import { formatThrowBall, getGameBalls } from '../../utils/game-utils/ball.utils';
import { isSplit } from '../../utils/game-utils/pin.utils';
import { sortGameHistoryByDate } from '../../utils/sort-utils/sort.utils';
import { GameFilterService } from '../game-filter/game-filter.service';
import { GameStatsService } from '../game-stats/game-stats.service';

type ExcelCellValue = string | number | boolean | Date | null;
type ExcelRow = Record<string, ExcelCellValue>;

/**
 * 'cancelled' means the file was generated and written to disk, but the user
 * dismissed the native share sheet without saving/sending it anywhere —
 * distinct from 'permission-denied' so the UI doesn't show a misleading
 * permission alert for a plain cancel.
 */
export type ExcelExportResult = 'success' | 'cancelled' | 'permission-denied';

@Injectable({
  providedIn: 'root',
})
export class ExcelService {
  #excelJs?: Promise<typeof import('exceljs')>;

  constructor(
    private hapticService: HapticService,
    private gamesStore: GamesStore,
    private ballsStore: BallsStore,
    private leaguesStore: LeaguesStore,
    private gameFilterService: GameFilterService,
    private statsService: GameStatsService,
  ) {}

  // TODO make one folder for all and one for each league and in there have stats and game history for the league
  async exportToExcel(): Promise<ExcelExportResult> {
    try {
      const isTemplateExport = this.gamesStore.games().length === 0;
      const gamesForExport = isTemplateExport ? [this.createSampleGame()] : this.gamesStore.games();
      const buffer = await this.generateExcelWorkbook(gamesForExport);

      const date = new Date();
      const formattedDate = date.toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });

      const isIos = isPlatform('ios');
      if (isIos) {
        const permissionRequestResult = await Filesystem.requestPermissions();
        if (permissionRequestResult.publicStorage !== 'granted') {
          return 'permission-denied';
        }
      }

      this.hapticService.vibrate(ImpactStyle.Light);
      let suffix = '';
      const fileName = isTemplateExport ? 'lightningbowl_import_template' : `game_data_${formattedDate}`;
      let i = 1;
      const existingFiles = JSON.parse(localStorage.getItem('savedFilenames') || '[]');

      if (isPlatform('mobileweb')) {
        while (existingFiles.includes(fileName + suffix + '.xlsx')) {
          suffix = `(${i++})`;
        }
      } else if (isPlatform('android') || isPlatform('ios')) {
        while (await this.fileExists(fileName + suffix)) {
          suffix = `(${i++})`;
        }
      }

      const completed = await this.saveExcelFile(buffer, `${fileName + suffix}.xlsx`);

      if (isPlatform('mobileweb')) {
        existingFiles.push(`${fileName + suffix}.xlsx`);
        localStorage.setItem('savedFilenames', JSON.stringify(existingFiles));
      }
      return completed ? 'success' : 'cancelled';
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      throw new Error(`Export failed: ${error}`);
    }
  }

  async generateExcelArrayBuffer(): Promise<ArrayBuffer> {
    return await this.generateExcelWorkbook();
  }

  async readExcelData(file: File): Promise<ExcelRow[]> {
    try {
      const ExcelJS = await this.loadExcelJs();
      const workbook = new ExcelJS.Workbook();
      const buffer = await this.fileToBuffer(file);
      await workbook.xlsx.load(buffer);
      const worksheet = workbook.worksheets[0];
      const gameData: ExcelRow[] = [];
      worksheet.eachRow((row) => {
        const rowData: Record<string, any> = {};
        row.eachCell((cell, colNumber) => {
          rowData[worksheet.getRow(1).getCell(colNumber).value as string] = cell.value;
        });
        gameData.push(rowData);
      });
      return gameData;
    } catch (error) {
      console.error('Error reading Excel data:', error);
      throw new Error(`Failed to read Excel file: ${error}`);
    }
  }

  async transformData(data: ExcelRow[]): Promise<void> {
    try {
      const gameData: Game[] = [];
      const leagueMap = new Set<string>();
      const ballMap = new Set<string>();

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const frames = [];
        const isPinMode = (row['isPinMode'] as string)?.trim().toLowerCase() === 'true';

        for (let j = 1; j <= 10; j++) {
          const frameIndex = j;
          const frame: {
            frameIndex: number;
            throws: { value: number; throwIndex: number; pinsLeftStanding?: number[]; isSplit?: boolean; ball?: ThrowBall }[];
          } = {
            frameIndex: frameIndex,
            throws: [],
          };

          const throwsData = row[`Frame ${frameIndex}`] as string;
          const throwValues: number[] = [];

          if (typeof throwsData === 'string' && throwsData.trim() !== '') {
            if (throwsData.includes('/')) {
              throwValues.push(...throwsData.split(' / ').map((value: string) => parseInt(value)));
            } else {
              throwValues.push(parseInt(throwsData));
            }
          }

          const pinsLeft1 = (row[`Frame ${frameIndex} Throw 1`] as string) || '';
          const pinsLeft2 = (row[`Frame ${frameIndex} Throw 2`] as string) || '';
          const pinsLeft3 = frameIndex === 10 ? (row[`Frame ${frameIndex} Throw 3`] as string) || '' : '';
          const pinsLefts = [pinsLeft1, pinsLeft2, pinsLeft3];
          const ball1 = (row[`Frame ${frameIndex} Ball 1`] as string) || '';
          const ball2 = (row[`Frame ${frameIndex} Ball 2`] as string) || '';
          const ball3 = frameIndex === 10 ? (row[`Frame ${frameIndex} Ball 3`] as string) || '' : '';
          const throwBalls = [ball1, ball2, ball3];

          const maxThrowsInFrame = frameIndex === 10 ? 3 : 2;

          for (let k = 0; k < throwValues.length && k < maxThrowsInFrame; k++) {
            const throwObj: { value: number; throwIndex: number; pinsLeftStanding?: number[]; isSplit?: boolean; ball?: ThrowBall } = {
              value: throwValues[k],
              throwIndex: k + 1,
            };

            const throwBall = throwBalls[k]?.trim();
            if (throwBall) {
              const formattedName = this.formatBallDisplayName(throwBall);
              throwObj.ball = formattedName ? { name: formattedName } : { name: throwBall };
            }

            if (isPinMode) {
              const pinsLeftString = pinsLefts[k];

              if (pinsLeftString.trim() === '') {
                throwObj.pinsLeftStanding = [];
              } else if (pinsLeftString.trim().length > 0) {
                const pinArray = pinsLeftString
                  .split(',')
                  .map((p) => parseInt(p))
                  .filter((p) => !isNaN(p));
                if (pinArray.length > 0) {
                  throwObj.pinsLeftStanding = pinArray;
                  if (frameIndex < 9) {
                    if (k === 0) throwObj.isSplit = !!isSplit(pinArray);
                  } else {
                    const prevThrow = frame.throws[k - 1];

                    let allowSplit = true;

                    if (prevThrow) {
                      const prevValue = prevThrow.value;
                      const prevWasSplit = prevThrow.isSplit;
                      const prevWasSpareOrStrike = prevValue === 10;

                      if (prevWasSplit && !prevWasSpareOrStrike) {
                        allowSplit = false;
                      }
                    }

                    if (allowSplit) {
                      throwObj.isSplit = isSplit(pinArray);
                    }
                  }
                }
              } else {
                throwObj.pinsLeftStanding = [];
              }
            }

            frame.throws.push(throwObj);
          }
          frames.push(frame);
        }

        const game: Game = {
          gameId: row['Game'] as string,
          date: new Date(row['Date'] as string).getTime(),
          frames: frames,
          totalScore: parseInt(row['Total Score'] as string),
          frameScores: (row['Frame Scores'] as string).split(', ').map((score: string) => parseInt(score)),
          league: row['League'] as string,
          isPractice: (row['Practice'] as string)?.trim().toLowerCase() === 'true',
          isClean: (row['Clean'] as string)?.trim().toLowerCase() === 'true',
          isPerfect: (row['Perfect'] as string)?.trim().toLowerCase() === 'true',
          isSeries: (row['Series'] as string)?.trim().toLowerCase() === 'true',
          seriesId: row['Series ID'] as string,
          isPinMode: isPinMode,
          patterns: (row['Patterns'] as string)?.trim()
            ? (row['Patterns'] as string).split(', ').slice(0, 2)
            : (row['Pattern'] as string)?.trim()
              ? [(row['Pattern'] as string).trim()]
              : [],
          balls: (row['Balls'] as string)?.trim()
            ? (row['Balls'] as string)
                .split(', ')
                .map((ball) => this.formatBallDisplayName(ball))
                .filter((ball) => !!ball)
            : [],
          note: row['Notes'] as string,
        };

        if (game.league !== undefined && game.league !== '') {
          leagueMap.add(game.league);
        }

        if (game.balls) {
          for (const ball of game.balls) {
            ballMap.add(this.formatBallDisplayName(ball));
          }
        }

        for (const frame of game.frames) {
          for (const throwData of frame.throws) {
            if (throwData.ball?.name) {
              const formattedName = this.formatBallDisplayName(formatThrowBall(throwData.ball));
              if (formattedName) ballMap.add(formattedName);
            }
          }
        }

        gameData.push(game);
      }

      for (const league of leagueMap.values()) {
        await this.leaguesStore.addLeague(league);
      }

      for (const ball of ballMap.values()) {
        const ballToAdd = this.resolveBallReference(ball);
        if (ballToAdd !== undefined && !this.ballsStore.arsenal().some((b) => b.ball_name === ballToAdd.ball_name)) {
          await this.ballsStore.saveBallToArsenal(ballToAdd);
        }
      }
      const sortedGames = sortGameHistoryByDate(gameData);
      await this.gamesStore.saveGamesToLocalStorage(sortedGames);
      this.gameFilterService.setDefaultFilters();
    } catch (error) {
      console.error('Error transforming data:', error);
      throw new Error(`Data transformation failed: ${error}`);
    }
  }

  private async generateExcelWorkbook(gameHistory: Game[] = this.gamesStore.games()): Promise<ArrayBuffer> {
    try {
      const gameData = this.getGameDataForExport(gameHistory);
      const { overall, spares, throwStats, strike, special, playFrequency, series, pinStats } = this.getStatsTablesForExport(
        this.statsService.currentStats(),
      );

      const ExcelJS = await this.loadExcelJs();
      const workbook = new ExcelJS.Workbook();
      const gameWorksheet = workbook.addWorksheet('Game History');
      const statsWorksheet = workbook.addWorksheet('Statistics');

      // Game History Table
      this.addTable(gameWorksheet, 'GameHistoryTable', 'A1', Object.keys(gameData[0]), gameData);
      this.addHeaderNotes(gameWorksheet, 1, this.getGameHistoryNotes());

      // Stats Tables
      const sections = [
        { name: 'OverallStats', start: 'A1', headers: ['Overall', 'Value'], data: overall },
        { name: 'SparesStats', start: 'D1', headers: ['Spares', 'Value'], data: spares },
        { name: 'ThrowStats', start: 'G1', headers: ['Throw', 'Value'], data: throwStats },
        { name: 'PinStats', start: 'J1', headers: ['Pin', 'Value'], data: pinStats },
        { name: 'StrikeStats', start: 'M1', headers: ['Strike', 'Value'], data: strike },
        { name: 'SpecialStats', start: 'P1', headers: ['Special', 'Value'], data: special },
        { name: 'PlayFrequency', start: 'S1', headers: ['Frequency', 'Value'], data: playFrequency },
        { name: 'SeriesStats', start: 'V1', headers: ['Series', 'Value'], data: series },
      ];

      sections.forEach(({ name, start, headers, data }) => {
        this.addTable(statsWorksheet, name, start, headers, data);
      });

      // Set column widths for each section
      sections.forEach(({ headers, data }, idx) => {
        const startColIndex = idx * 3; // each section is 2 cols + 1-col gap
        this.setColumnWidths(statsWorksheet, headers, data, startColIndex + 1);
      });

      this.setColumnWidths(gameWorksheet, Object.keys(gameData[0]), gameData, 1);

      const allBallStats = this.statsService.allBallStats();
      if (allBallStats.length > 0) {
        this.addBallStatsWorksheet(workbook, allBallStats);
      }

      const allPatternStats = this.statsService.allPatternStats();
      if (allPatternStats.length > 0) {
        this.addPatternStatsWorksheet(workbook, allPatternStats);
      }

      const allLeaves = this.statsService.allLeaves();
      if (allLeaves.length > 0) {
        this.addLeaveStatsWorksheet(workbook, allLeaves);
      }

      const buffer = await workbook.xlsx.writeBuffer();
      return buffer;
    } catch (error) {
      console.error('Error generating Excel workbook:', error);
      throw new Error(`Excel generation failed: ${error}`);
    }
  }

  /** @returns false only when the user dismissed the native share sheet without saving/sending the file anywhere. */
  private async saveExcelFile(buffer: ArrayBuffer, fileName: string): Promise<boolean> {
    try {
      let binary = '';
      const bytes = new Uint8Array(buffer);
      const length = bytes.byteLength;

      for (let i = 0; i < length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }

      const base64Data = btoa(binary);
      const dataUri = 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + base64Data;

      if (isPlatform('desktop') || isPlatform('mobileweb') || isPlatform('pwa')) {
        const anchor = document.createElement('a');
        anchor.href = dataUri;
        anchor.download = fileName;

        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        return true;
      }

      await Filesystem.writeFile({
        path: fileName,
        data: dataUri,
        directory: Directory.Documents,
        recursive: true,
      });

      const fileUri = await Filesystem.getUri({
        directory: Directory.Documents,
        path: fileName,
      });

      try {
        await Share.share({
          title: fileName,
          url: fileUri.uri,
          dialogTitle: 'Save or Share Excel File',
        });
        return true;
      } catch (shareError) {
        if (shareError instanceof Error && shareError.message === 'Share canceled') {
          return false;
        }
        throw shareError;
      }
    } catch (error) {
      console.error('Error saving Excel file:', error);
      throw new Error(`Failed to save file: ${error}`);
    }
  }

  private getGameDataForExport(gameHistory: Game[]): Record<string, ExcelCellValue>[] {
    const baseHeaders = ['Game', 'Date', ...Array.from({ length: 10 }, (_, i) => `Frame ${i + 1}`), 'Total Score'];

    const pinHeaders: string[] = [];
    const throwBallHeaders: string[] = [];
    for (let i = 0; i < 10; i++) {
      const frameIndex = i + 1;
      pinHeaders.push(`Frame ${frameIndex} Throw 1`);
      pinHeaders.push(`Frame ${frameIndex} Throw 2`);
      throwBallHeaders.push(`Frame ${frameIndex} Ball 1`);
      throwBallHeaders.push(`Frame ${frameIndex} Ball 2`);

      if (frameIndex === 10) {
        pinHeaders.push(`Frame ${frameIndex} Throw 3`);
        throwBallHeaders.push(`Frame ${frameIndex} Ball 3`);
      }
    }

    const finalStaticHeaders = [
      'Frame Scores',
      'League',
      'Practice',
      'Clean',
      'Perfect',
      'Series',
      'Series ID',
      'Patterns',
      'Balls',
      'Notes',
      'isPinMode',
    ];

    const headers = [...baseHeaders, ...finalStaticHeaders, ...pinHeaders, ...throwBallHeaders];

    return gameHistory.map((game) => {
      const frameValues = Array.from({ length: 10 }, (_, i) => {
        if (game.frames[i]) {
          const throws = game.frames[i].throws.map((t: any) => t.value);
          if (throws.length === 1) {
            return `${throws[0]}`;
          } else if (throws.length === 2) {
            return `${throws[0]} / ${throws[1]}`;
          } else if (throws.length === 3) {
            return `${throws[0]} / ${throws[1]} / ${throws[2]}`;
          }
        }
        return '';
      });

      const pinData: string[] = [];
      const throwBallData: string[] = [];
      for (let i = 0; i < 10; i++) {
        const frame = game.frames[i];
        const frameIndex = i + 1;

        const framePins: string[] = ['', '', ''];
        const frameBalls: string[] = ['', '', ''];

        if (frame) {
          const pins = frame.throws.map((t: Throw) => t.pinsLeftStanding?.join(',') || '');
          const balls = frame.throws.map((t: Throw) => formatThrowBall(t.ball) || '');

          const maxThrows = frameIndex === 10 ? 3 : 2;
          for (let k = 0; k < maxThrows; k++) {
            framePins[k] = pins[k] || '';
            frameBalls[k] = balls[k] || '';
          }
        }

        pinData.push(framePins[0], framePins[1]);
        throwBallData.push(frameBalls[0], frameBalls[1]);
        if (frameIndex === 10) {
          pinData.push(framePins[2]);
          throwBallData.push(frameBalls[2]);
        }
      }

      const rowData = [
        game.gameId.toString(),
        new Date(game.date).toLocaleDateString('en-US'),
        ...frameValues,
        game.totalScore.toString(),
        game.frameScores.map((s) => s.toString()).join(', '),
        game.league || '',
        game.isPractice ? 'true' : 'false',
        game.isClean ? 'true' : 'false',
        game.isPerfect ? 'true' : 'false',
        game.isSeries ? 'true' : 'false',
        game.seriesId || '',
        game.patterns?.join(', ') || '',
        getGameBalls(game)
          .map((ball) => this.formatBallDisplayName(ball))
          .join(', ') || '',
        game.note || '',
        game.isPinMode ? 'true' : 'false',
        ...pinData,
        ...throwBallData,
      ];

      return headers.reduce(
        (obj, header, idx) => {
          obj[header] = rowData[idx];
          return obj;
        },
        {} as Record<string, ExcelCellValue>,
      );
    });
  }

  private getGameHistoryNotes(): Record<string, string> {
    const notes: Record<string, string> = {
      Game: 'Unique game ID. Keep existing IDs when updating imports. For new games, any unique value is fine.',
      Date: 'Date in MM/DD/YYYY format.',
      'Total Score': 'Final game score (sum of all frames).',
      'Frame Scores': 'Comma-separated cumulative frame totals. Example: 20, 40, 59, ...',
      League: 'League name for this game. Leave empty if not a league game.',
      Practice: 'Boolean value: true or false. Use true for practice games.',
      Clean: 'Boolean value: true or false. True means no open frames in the game.',
      Perfect: 'Boolean value: true or false. True means a 300 game.',
      Series: 'Boolean value: true or false. Set true if this game belongs to a series.',
      'Series ID': 'Use the same Series ID on each game that belongs to the same series.',
      Patterns: 'Optional. One or two pattern names separated by comma and space.',
      Balls: 'Optional. Ball names separated by comma and space.',
      Notes: 'Optional free-text note for the game.',
      isPinMode: 'Enter true for pin-layout mode, false for score-only mode.',
    };

    for (let frameIndex = 1; frameIndex <= 10; frameIndex++) {
      notes[`Frame ${frameIndex}`] = 'Throw values separated by " / ". Examples: "10", "9 / 1", "10 / 10 / 10" (10th frame).';
      notes[`Frame ${frameIndex} Throw 1`] = 'Pins left standing after throw 1, comma-separated (e.g. 7,10). Leave empty if none.';
      notes[`Frame ${frameIndex} Throw 2`] = 'Pins left standing after throw 2, comma-separated. Only relevant when isPinMode=true.';
      notes[`Frame ${frameIndex} Ball 1`] = 'Optional. Ball name used for throw 1 of this frame.';
      notes[`Frame ${frameIndex} Ball 2`] = 'Optional. Ball name used for throw 2 of this frame.';
      if (frameIndex === 10) {
        notes[`Frame ${frameIndex} Throw 3`] = 'Pins left standing after throw 3 in 10th frame (if present).';
        notes[`Frame ${frameIndex} Ball 3`] = 'Optional. Ball name used for throw 3 in the 10th frame.';
      }
    }

    return notes;
  }

  private addHeaderNotes(worksheet: Worksheet, rowNumber: number, notesMap: Record<string, string>): void {
    const row = worksheet.getRow(rowNumber);
    row.eachCell((cell) => {
      const headerName = cell.value?.toString();
      if (headerName && notesMap[headerName]) {
        cell.dataValidation = {
          type: 'custom',
          formulae: ['TRUE'],
          allowBlank: true,
          showInputMessage: true,
          promptTitle: headerName,
          prompt: notesMap[headerName],
        };
      }
    });
  }

  // TODO add new stats to export
  private getStatsTablesForExport(stats: Stats): Record<string, Record<string, ExcelCellValue>[]> {
    const formatPercent = (v: number) => `${v.toFixed(2)}%`;
    const formatFixed = (v: number) => v.toFixed(2);
    const formatRatio = (hits: number | undefined, opportunities: number | undefined): ExcelCellValue => {
      const h = hits ?? 0;
      const o = opportunities ?? 0;
      return o > 0 ? `${h} / ${o}` : `${h}`;
    };

    // Overall Stats
    const overallDefs: [string, ExcelCellValue][] = [
      ['Total Games', stats.totalGames.toString()],
      ['Perfect Games', stats.perfectGameCount.toString()],
      ['Clean Games', stats.cleanGameCount.toString()],
      ['Clean Game %', formatPercent(stats.cleanGamePercentage)],
      ['Average Score', formatFixed(stats.averageScore)],
      ['High Game', stats.highGame.toString()],
      ['Total Pins', stats.totalPins.toString()],
      ['First Ball Avg', formatFixed(stats.averageFirstCount)],
    ];
    const overall = overallDefs.map(([label, val]) => ({ Overall: label, Value: val }));

    // Throw Stats
    const throwDefs: [string, ExcelCellValue][] = [
      ['Total Strikes', stats.totalStrikes.toString()],
      ['Strikes per Game', formatFixed(stats.averageStrikesPerGame)],
      ['Total Spares', stats.totalSpares.toString()],
      ['Spares per Game', formatFixed(stats.averageSparesPerGame)],
      ['Total Opens', stats.totalSparesMissed.toString()],
      ['Opens per Game', formatFixed(stats.averageOpensPerGame)],
      ['Spare Conversion %', formatPercent(stats.overallSpareRate)],
      ['Mark %', formatPercent(stats.markPercentage)],
      ['Strike %', formatPercent(stats.strikePercentage)],
      ['Spare %', formatPercent(stats.sparePercentage)],
      ['Open %', formatPercent(stats.openPercentage)],
    ];
    const throwStats = throwDefs.map(([label, val]) => ({ Throw: label, Value: val }));

    // Spares Table
    const sparesEntries: [string, ExcelCellValue][] = [
      ['Total Spares Converted', stats.totalSpares.toString()],
      ['Total Spares Missed', stats.totalSparesMissed.toString()],
      ...stats.pinCounts.slice(1).map((count, index): [string, ExcelCellValue] => {
        const hit = count.toString();
        const miss = stats.missedCounts.slice(1)[index]?.toString() || '0';
        const rate = stats.spareRates.slice(1)[index] !== undefined ? formatPercent(stats.spareRates.slice(1)[index]) : '0%';
        return [`${index + 1} ${index + 1 === 1 ? 'Pin' : 'Pins'} Hit / Miss / Rate`, `${hit} / ${miss} / ${rate}`];
      }),
      ['Overall Spare Rate', formatPercent(stats.overallSpareRate)],
      ['Overall Missed Rate', formatPercent(stats.overallMissedRate)],
    ];
    const spares = sparesEntries.map(([metric, value]) => ({
      Spares: metric,
      Value: value,
    }));

    // Strike Stats
    const strikeDefs: [string, ExcelCellValue][] = [
      ['Turkeys', stats.turkeyCount?.toString() || '0'],
      ['4-Baggers', stats.bagger4Count?.toString() || '0'],
      ['5-Baggers', stats.bagger5Count?.toString() || '0'],
      ['6-Baggers', stats.bagger6Count?.toString() || '0'],
      ['7-Baggers', stats.bagger7Count?.toString() || '0'],
      ['8-Baggers', stats.bagger8Count?.toString() || '0'],
      ['9-Baggers', stats.bagger9Count?.toString() || '0'],
      ['10-Baggers', stats.bagger10Count?.toString() || '0'],
      ['11-Baggers', stats.bagger11Count?.toString() || '0'],
      ['Longest Strike Streak', stats['longestStrikeStreak']?.toString() || ''],
      ['Strike-to-Strike %', formatPercent(stats.strikeToStrikePercentage || 0)],
      ['Strikeouts (10th Frame)', stats.strikeoutCount?.toString() || '0'],
    ];
    const strike = strikeDefs.map(([label, val]) => ({ Strike: label, Value: val }));

    // Special Stats
    const specialDefs: [string, ExcelCellValue][] = [
      ['Dutch 200s', stats.dutch200Count?.toString() || '0'],
      ['Varipapa 300s', stats.varipapa300Count?.toString() || '0'],
      ['Full Spare Games', stats.allSparesGameCount?.toString() || '0'],
    ];
    const special = specialDefs.map(([label, val]) => ({ Special: label, Value: val }));

    // Play Frequency
    const freqDefs: [string, ExcelCellValue][] = [
      ['Avg Games/Week', stats.averageGamesPerWeek?.toFixed(2) || '0'],
      ['Avg Games/Month', stats.averageGamesPerMonth?.toFixed(2) || '0'],
      ['Avg Sessions/Week', stats.averageSessionsPerWeek?.toFixed(2) || '0'],
      ['Avg Sessions/Month', stats.averageSessionsPerMonth?.toFixed(2) || '0'],
      ['Avg Games/Session', stats.averageGamesPerSession?.toFixed(2) || '0'],
    ];
    const playFrequency = freqDefs.map(([label, val]) => ({ Frequency: label, Value: val }));

    // Series Stats
    const seriesDefs: [string, ExcelCellValue][] = [
      ['Avg 3-Series Score', stats.average3SeriesScore?.toFixed(2) || ''],
      ['High 3-Series', stats.high3Series?.toString() || ''],
      ['Avg 4-Series Score', stats.average4SeriesScore?.toFixed(2) || ''],
      ['High 4-Series', stats.high4Series?.toString() || ''],
      ['Avg 5-Series Score', stats.average5SeriesScore?.toFixed(2) || ''],
      ['High 5-Series', stats.high5Series?.toString() || ''],
      ['Avg 6-Series Score', stats.average6SeriesScore?.toFixed(2) || ''],
      ['High 6-Series', stats.high6Series?.toString() || ''],
    ];
    const series = seriesDefs.map(([label, val]) => ({ Series: label, Value: val }));

    // Pin Stats
    const pinDefs: [string, ExcelCellValue][] = [
      ['Pocket Hits (Hit/Total)', formatRatio(stats.pocketHits, stats.totalFirstBalls)],
      ['Pocket Hit %', formatPercent(stats.pocketHitPercentage || 0)],
      ['Single Pin Spares (Hit/Total)', formatRatio(stats.singlePinSpares, stats.singlePinSpareOpportunities)],
      ['Single Pin Spare %', formatPercent(stats.singlePinSparePercentage || 0)],
      ['Multi Pin Spares (Hit/Total)', formatRatio(stats.multiPinSpares, stats.multiPinSpareOpportunities)],
      ['Multi Pin Spare %', formatPercent(stats.multiPinSparePercentage || 0)],
      ['Non-Split Spares (Hit/Total)', formatRatio(stats.nonSplitSpares, stats.nonSplitSpareOpportunities)],
      ['Non-Split Spare %', formatPercent(stats.nonSplitSparePercentage || 0)],
      ['Split Conversions (Hit/Total)', formatRatio(stats.splits, stats.splitOpportunities)],
      ['Split Conversion %', formatPercent(stats.splitConversionPercentage || 0)],
      ['Makeable Splits (Hit/Total)', formatRatio(stats.makeableSplits, stats.makeableSplitOpportunities)],
      ['Makeable Split %', formatPercent(stats.makeableSplitPercentage || 0)],
    ];
    const pinStats = pinDefs.map(([label, val]) => ({ Pin: label, Value: val }));

    return { overall, spares, throwStats, strike, special, playFrequency, series, pinStats };
  }

  private addBallStatsWorksheet(workbook: Workbook, allBallStats: HighlightItemStats[]): void {
    const worksheet = workbook.addWorksheet('Ball Stats');
    const headers = ['Ball', 'Games', 'Avg', 'High', 'Low', 'Strike Rate %', 'Clean Games'];

    const rows = [...allBallStats]
      .sort((a, b) => b.avg - a.avg)
      .map((ball) => ({
        Ball: ball.name,
        Games: ball.gameCount,
        Avg: ball.avg.toFixed(2),
        High: ball.highestGame,
        Low: ball.lowestGame,
        'Strike Rate %': ball.strikeRate !== undefined ? `${ball.strikeRate.toFixed(2)}%` : '',
        'Clean Games': ball.cleanGameCount ?? '',
      }));

    this.addTable(worksheet, 'BallStats', 'A1', headers, rows);
    this.setColumnWidths(worksheet, headers, rows, 1);
  }

  private addPatternStatsWorksheet(workbook: Workbook, allPatternStats: HighlightItemStats[]): void {
    const worksheet = workbook.addWorksheet('Pattern Stats');
    const headers = ['Pattern', 'Games', 'Avg', 'High', 'Low', 'Strike Rate %', 'Clean Games'];

    const rows = [...allPatternStats]
      .sort((a, b) => b.avg - a.avg)
      .map((pattern) => ({
        Pattern: pattern.name,
        Games: pattern.gameCount,
        Avg: pattern.avg.toFixed(2),
        High: pattern.highestGame,
        Low: pattern.lowestGame,
        'Strike Rate %': pattern.strikeRate !== undefined ? `${pattern.strikeRate.toFixed(2)}%` : '',
        'Clean Games': pattern.cleanGameCount ?? '',
      }));

    this.addTable(worksheet, 'PatternStats', 'A1', headers, rows);
    this.setColumnWidths(worksheet, headers, rows, 1);
  }

  private addLeaveStatsWorksheet(workbook: Workbook, allLeaves: LeaveStats[]): void {
    const leaveWorksheet = workbook.addWorksheet('Pin Leave Stats');
    const sharedCols = ['Occurrences', 'Pickups', 'Pickup %', 'Misses', 'Miss %'];

    const formatLeave = (leave: LeaveStats, firstColName: string): Record<string, ExcelCellValue> => {
      const misses = leave.occurrences - leave.pickups;
      const missPercent = leave.occurrences > 0 ? (misses / leave.occurrences) * 100 : 0;
      return {
        [firstColName]: leave.pins.join('-'),
        Occurrences: leave.occurrences,
        Pickups: leave.pickups,
        'Pickup %': `${leave.pickupPercentage.toFixed(2)}%`,
        Misses: misses,
        'Miss %': `${missPercent.toFixed(2)}%`,
      };
    };

    const sortedAllLeaves = [...allLeaves].sort((a, b) => b.occurrences - a.occurrences);
    const commonLeaves = this.statsService.commonLeaves();
    const bestLeaves = this.statsService.bestLeaves();
    const worstLeaves = this.statsService.worstLeaves();

    const leaveSections = [
      { name: 'MostCommonLeaves', firstCol: 'Most Common Leave (Top 10)', data: commonLeaves },
      { name: 'BestSpares', firstCol: 'Best Spare Leave', data: bestLeaves },
      { name: 'WorstSpares', firstCol: 'Worst Spare Leave', data: worstLeaves },
      { name: 'AllLeaves', firstCol: 'All Leaves (by frequency)', data: sortedAllLeaves },
    ].filter((s) => s.data.length > 0);

    const sectionWidth = 7; // 6 data cols + 1 gap col
    leaveSections.forEach(({ name, firstCol, data }, idx) => {
      const headers = [firstCol, ...sharedCols];
      const rows = data.map((leave) => formatLeave(leave, firstCol));
      const startColNum = idx * sectionWidth + 1;
      const start = `${this.columnNumberToLetter(startColNum)}1`;
      this.addTable(leaveWorksheet, name, start, headers, rows);
      this.setColumnWidths(leaveWorksheet, headers, rows, startColNum);
    });
  }

  private columnNumberToLetter(colNum: number): string {
    let result = '';
    while (colNum > 0) {
      const rem = (colNum - 1) % 26;
      result = String.fromCharCode(65 + rem) + result;
      colNum = Math.floor((colNum - 1) / 26);
    }
    return result;
  }

  private addTable(worksheet: Worksheet, name: string, ref: string, headers: string[], rows: Record<string, ExcelCellValue>[]): void {
    worksheet.addTable({
      name,
      ref,
      headerRow: true,
      totalsRow: false,
      style: { theme: 'TableStyleMedium1', showRowStripes: true },
      columns: headers.map((header) => ({ name: header })),
      rows: rows.map((row) => headers.map((header) => row[header])),
    });
  }

  private setColumnWidths(worksheet: Worksheet, headers: string[], data: Record<string, ExcelCellValue>[], startIndex: number): void {
    headers.forEach((header, index) => {
      const maxContentLength = Math.max(header.length, ...data.map((row) => (row[header] ?? '').toString().length));
      worksheet.getColumn(startIndex + index).width = maxContentLength + 1;
    });
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      await Filesystem.stat({
        path: path + '.xlsx',
        directory: Directory.Documents,
      });
      return true;
    } catch (error) {
      console.error('File existence check error:', error);
      return false;
    }
  }

  private fileToBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event: ProgressEvent<FileReader>) => resolve(event.target?.result as ArrayBuffer);
      reader.onerror = (err) => {
        console.error('Error reading file:', err);
        reject(err);
      };
      reader.readAsArrayBuffer(file);
    });
  }

  private normalizeBallKey(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '')
      .replace(/lbs?|#/g, '');
  }

  private resolveBallReference(rawBallValue: string | undefined): Ball | undefined {
    const raw = rawBallValue?.trim();
    if (!raw) return undefined;

    const normalizedRaw = this.normalizeBallKey(raw);
    return this.ballsStore.allBalls().find((ball) => {
      const byName = this.normalizeBallKey(ball.ball_name);
      const byNameAndWeight = this.normalizeBallKey(`${ball.ball_name}${ball.core_weight}`);
      return normalizedRaw === byName || normalizedRaw === byNameAndWeight;
    });
  }

  private formatBallDisplayName(rawBallValue: string | undefined): string {
    const raw = rawBallValue?.trim();
    if (!raw) return '';

    const resolvedBall = this.resolveBallReference(raw);
    if (!resolvedBall) return raw;

    return `${resolvedBall.ball_name} ${resolvedBall.core_weight}lbs`;
  }

  private createSampleGame(): Game {
    return {
      gameId: '1775331174465_1u39gi6',
      date: 1775331174465,
      frames: [
        {
          frameIndex: 1,
          throws: [
            { value: 9, throwIndex: 1, pinsLeftStanding: [10], ball: { name: 'Rocket A.I.' } },
            { value: 1, throwIndex: 2, pinsLeftStanding: [], ball: { name: 'Rocket A.I.' } },
          ],
        },
        { frameIndex: 2, throws: [{ value: 10, throwIndex: 1, pinsLeftStanding: [], ball: { name: 'Rocket A.I.' } }] },
        { frameIndex: 3, throws: [{ value: 10, throwIndex: 1, pinsLeftStanding: [], ball: { name: 'Rocket A.I.' } }] },
        {
          frameIndex: 4,
          throws: [
            { value: 8, throwIndex: 1, pinsLeftStanding: [7, 10], ball: { name: 'Rocket A.I.' } },
            { value: 9, throwIndex: 2, pinsLeftStanding: [5], ball: { name: 'Rocket A.I.' } },
          ],
        },
        {
          frameIndex: 5,
          throws: [
            { value: 9, throwIndex: 1, pinsLeftStanding: [10], ball: { name: 'Rocket A.I.' } },
            { value: 9, throwIndex: 2, pinsLeftStanding: [3], ball: { name: 'Rocket A.I.' } },
          ],
        },
        {
          frameIndex: 6,
          throws: [
            { value: 8, throwIndex: 1, pinsLeftStanding: [8, 10], ball: { name: 'Rocket A.I.' } },
            { value: 9, throwIndex: 2, pinsLeftStanding: [2], ball: { name: 'Rocket A.I.' } },
          ],
        },
        {
          frameIndex: 7,
          throws: [
            { value: 3, throwIndex: 1, pinsLeftStanding: [4, 6, 7, 8, 9, 10, 2], ball: { name: 'Rocket A.I.' } },
            { value: 4, throwIndex: 2, pinsLeftStanding: [6, 10, 2], ball: { name: 'Rocket A.I.' } },
          ],
        },
        { frameIndex: 8, throws: [{ value: 10, throwIndex: 1, pinsLeftStanding: [], ball: { name: 'Rocket A.I.' } }] },
        { frameIndex: 9, throws: [{ value: 10, throwIndex: 1, pinsLeftStanding: [], ball: { name: 'Rocket A.I.' } }] },
        {
          frameIndex: 10,
          throws: [
            { value: 10, throwIndex: 1, pinsLeftStanding: [], ball: { name: 'Rocket A.I.' } },
            { value: 10, throwIndex: 2, pinsLeftStanding: [], ball: { name: 'Rocket A.I.' } },
            { value: 10, throwIndex: 3, pinsLeftStanding: [], ball: { name: 'Rocket A.I.' } },
          ],
        },
      ],
      frameScores: [20, 40, 60, 77, 95, 112, 119, 149, 179, 209],
      totalScore: 209,
      isClean: false,
      isPerfect: false,
      isPractice: false,
      isPinMode: true,
      league: 'Example League',
      note: 'Example note',
      patterns: ['2000 PWBA Foundation Games Plastic Ball Pattern', '2003 EBT Vienna Open'],
      balls: ['Rocket A.I.'],
    };
  }

  /**
   * exceljs (with its jszip dependency) is ~900KB and was landing in the
   * eagerly-loaded startup bundle, because CloudSyncService — constructed by an
   * app initializer — injects this service. Import/export is a rare, explicit
   * user action, so the library is fetched on first use instead and cached for
   * subsequent calls.
   */
  private loadExcelJs(): Promise<typeof import('exceljs')> {
    this.#excelJs ??= import('exceljs').then((module) => {
      // exceljs is CommonJS, so the namespace may wrap the real exports in `default`.
      const commonJsExport = (module as { default?: typeof import('exceljs') }).default;
      return commonJsExport ?? module;
    });
    return this.#excelJs;
  }
}
