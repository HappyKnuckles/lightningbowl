import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { SqlJsStatic } from 'sql.js';
import { Ball } from 'src/app/core/models/ball.model';
import { Frame, Throw } from 'src/app/core/models/game.model';
import { Pattern } from 'src/app/core/models/pattern.model';
import { GameFilterService } from 'src/app/core/services/game-filter/game-filter.service';
import { GameScoreCalculatorService } from 'src/app/core/services/game-score-calculator/game-score-calculator.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { GamesStore } from 'src/app/core/stores/games.store';
import { PatternsStore } from 'src/app/core/stores/patterns.store';
import { makeBall, makePattern } from 'src/testing/fixtures';
import { createSpyObj, SpyObj } from 'src/testing/spy-obj';
import { vi } from 'vitest';

import { PinpalService } from './pinpal.service';

/** Pin mask Pinpal writes for a frame it has no pin data for. */
const DUMMY_MASK = 1073741823;
/** Frames 1-9 leaving pins 8, 9 and 10 standing after the first throw. */
const SEVEN_THEN_SPARE_MASK = 896;

interface FrameRowInput {
  frameNum: number;
  scores: number | null;
  pins: number | null;
}

interface GameRowInput {
  pk: number;
  totalScore?: number | null;
  notes?: string | null;
  weekDate?: number | null;
  leagueName?: string | null;
  ballName?: string | null;
  patternName?: string | null;
}

/** Twelve frame rows — nine regular frames, then the three rows the 10th spans. */
function frameRows(rows: Partial<Record<number, Partial<FrameRowInput>>> = {}): FrameRowInput[] {
  return Array.from({ length: 12 }, (_, i) => ({ frameNum: i, scores: 0, pins: 0, ...rows[i] }));
}

describe('PinpalService', () => {
  let service: PinpalService;
  let gamesStore: SpyObj<GamesStore>;
  let ballsStore: SpyObj<BallsStore>;
  let gameFilterService: SpyObj<GameFilterService>;
  let toastService: SpyObj<ToastService>;
  let scoreCalculator: SpyObj<GameScoreCalculatorService>;
  let close: ReturnType<typeof vi.fn>;

  const allBalls = signal<Ball[]>([]);
  const allPatterns = signal<Partial<Pattern>[]>([]);

  /** A file that carries the SQLite magic string, so the byte scan finds a database. */
  function pinpalFile(leadingBytes: number[] = []): File {
    const header = Array.from(new TextEncoder().encode('SQLite format 3\0'));
    return new File([new Uint8Array([...leadingBytes, ...header])], 'backup.pinpal');
  }

  /** Stubs sql.js with an in-memory database answering the three queries the import runs. */
  function stubDatabase(games: GameRowInput[], framesByGame: Record<number, FrameRowInput[]>, hasFrameTable = true): void {
    const exec = vi.fn((sql: string) => {
      if (sql.includes('sqlite_master')) {
        return hasFrameTable ? [{ columns: ['name'], values: [['frame']] }] : [];
      }

      if (sql.includes('FROM frame WHERE gameFk')) {
        const gamePk = Number(sql.match(/gameFk = (\d+)/)![1]);
        const rows = framesByGame[gamePk] ?? [];
        return rows.length ? [{ columns: ['frameNum', 'scores', 'pins'], values: rows.map((r) => [r.frameNum, r.scores ?? 0, r.pins ?? 0]) }] : [];
      }

      const columns = ['pk', 'totalScore', 'notes', 'weekDate', 'leagueName', 'ballName', 'patternName'];
      return games.length
        ? [
            {
              columns,
              values: games.map((g) => [
                g.pk,
                g.totalScore ?? null,
                g.notes ?? null,
                g.weekDate ?? null,
                g.leagueName ?? null,
                g.ballName ?? null,
                g.patternName ?? null,
              ]),
            },
          ]
        : [];
    });

    close = vi.fn();
    const database = { exec, close };
    service['sqlInstance'] = {
      Database: function Database() {
        return database;
      },
    } as unknown as SqlJsStatic;
  }

  /** The games handed to the store by the last import. */
  function savedGames() {
    return gamesStore.saveGamesToLocalStorage.mock.calls[0][0];
  }

  beforeEach(() => {
    allBalls.set([]);
    allPatterns.set([]);

    gamesStore = createSpyObj<GamesStore>(['saveGamesToLocalStorage']);
    gamesStore.saveGamesToLocalStorage.mockResolvedValue(undefined);

    ballsStore = createSpyObj<BallsStore>(['saveBallToArsenal'], { allBalls });
    ballsStore.saveBallToArsenal.mockResolvedValue([]);

    gameFilterService = createSpyObj<GameFilterService>(['setDefaultFilters']);
    toastService = createSpyObj<ToastService>(['showToast']);

    scoreCalculator = createSpyObj<GameScoreCalculatorService>(['calculateScoreFromFrames']);
    scoreCalculator.calculateScoreFromFrames.mockReturnValue({ totalScore: 170, frameScores: Array(10).fill(0) });

    TestBed.configureTestingModule({
      providers: [
        { provide: GamesStore, useValue: gamesStore },
        { provide: BallsStore, useValue: ballsStore },
        { provide: PatternsStore, useValue: { allPatterns } },
        { provide: GameFilterService, useValue: gameFilterService },
        { provide: ToastService, useValue: toastService },
        { provide: GameScoreCalculatorService, useValue: scoreCalculator },
      ],
    });
    service = TestBed.inject(PinpalService);
  });

  describe('importFromFile', () => {
    it('imports a game with its league, note and date', async () => {
      stubDatabase([{ pk: 1, totalScore: 170, notes: 'Good night', leagueName: 'Monday', weekDate: 1767225600 }], {
        1: frameRows({ 0: { frameNum: 0, pins: SEVEN_THEN_SPARE_MASK } }),
      });

      const imported = await service.importFromFile(pinpalFile());

      expect(imported).toBe(1);
      expect(savedGames()).toHaveLength(1);
      expect(savedGames()[0]).toMatchObject({ league: 'Monday', note: 'Good night', isPractice: false, totalScore: 170 });
      expect(savedGames()[0].date).toBe(1767225600000);
      expect(gameFilterService.setDefaultFilters).toHaveBeenCalled();
    });

    it('marks a game without a league as practice', async () => {
      stubDatabase([{ pk: 1 }], { 1: frameRows({ 0: { frameNum: 0, pins: SEVEN_THEN_SPARE_MASK } }) });

      await service.importFromFile(pinpalFile());

      expect(savedGames()[0].isPractice).toBe(true);
    });

    it('decodes pin data into throws and keeps the game in pin mode', async () => {
      stubDatabase([{ pk: 1 }], { 1: frameRows({ 0: { frameNum: 0, pins: SEVEN_THEN_SPARE_MASK } }) });

      await service.importFromFile(pinpalFile());

      const [game] = savedGames();
      expect(game.isPinMode).toBe(true);
      expect(game.frames[0].throws.map((t: Throw) => t.value)).toEqual([7, 3]);
      expect(game.frames[0].throws[0].pinsLeftStanding).toEqual([8, 9, 10]);
      expect(game.frames[0].throws[0].pinsKnockedDown).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    it('falls back to the packed scores when a frame has no pin data', async () => {
      stubDatabase([{ pk: 1 }], { 1: frameRows({ 0: { frameNum: 0, pins: DUMMY_MASK, scores: (9 << 4) | 7 } }) });

      await service.importFromFile(pinpalFile());

      const [game] = savedGames();
      expect(game.isPinMode).toBe(false);
      expect(game.frames[0].throws.map((t: Throw) => t.value)).toEqual([7, 2]);
    });

    it('reads a 10th frame that spans three score rows', async () => {
      stubDatabase([{ pk: 1 }], {
        1: frameRows({
          9: { frameNum: 9, pins: DUMMY_MASK, scores: (10 << 4) | 10 },
          10: { frameNum: 10, scores: (10 << 4) | 10 },
          11: { frameNum: 11, scores: 5 },
        }),
      });

      await service.importFromFile(pinpalFile());

      expect(savedGames()[0].frames[9].throws.map((t: Throw) => t.value)).toEqual([10, 10, 5]);
    });

    it('keeps the stored score when the game has no frame data at all', async () => {
      stubDatabase([{ pk: 1, totalScore: 143 }], { 1: frameRows() });

      await service.importFromFile(pinpalFile());

      expect(savedGames()[0].totalScore).toBe(143);
      expect(scoreCalculator.calculateScoreFromFrames).toHaveBeenCalled();
    });

    it('skips games whose frame data is incomplete', async () => {
      stubDatabase([{ pk: 1 }], { 1: [{ frameNum: 0, scores: 0, pins: SEVEN_THEN_SPARE_MASK }] });

      await expect(service.importFromFile(pinpalFile())).resolves.toBe(0);
      expect(savedGames()).toEqual([]);
    });

    it('skips every game when the database has no frame table', async () => {
      stubDatabase([{ pk: 1 }], { 1: frameRows() }, false);

      await expect(service.importFromFile(pinpalFile())).resolves.toBe(0);
    });

    it('matches balls and patterns against what the app knows and adds the ball to the arsenal', async () => {
      const ball = makeBall({ ball_id: 'b1', ball_name: 'Phaze II', core_weight: '15' });
      allBalls.set([ball]);
      allPatterns.set([makePattern({ title: 'Shark 48' })]);
      stubDatabase([{ pk: 1, ballName: 'phaze ii', patternName: 'shark' }], { 1: frameRows({ 0: { frameNum: 0, pins: SEVEN_THEN_SPARE_MASK } }) });

      await service.importFromFile(pinpalFile());

      expect(savedGames()[0].balls).toEqual(['Phaze II']);
      expect(savedGames()[0].patterns).toEqual(['Shark 48']);
      expect(ballsStore.saveBallToArsenal).toHaveBeenCalledWith(ball);
    });

    it('keeps an unknown ball name and leaves the arsenal alone', async () => {
      stubDatabase([{ pk: 1, ballName: 'Mystery Ball' }], { 1: frameRows({ 0: { frameNum: 0, pins: SEVEN_THEN_SPARE_MASK } }) });

      await service.importFromFile(pinpalFile());

      expect(savedGames()[0].balls).toEqual(['Mystery Ball']);
      expect(ballsStore.saveBallToArsenal).not.toHaveBeenCalled();
    });

    it('warns when a matched ball cannot be added to the arsenal', async () => {
      allBalls.set([makeBall({ ball_name: 'Phaze II' })]);
      ballsStore.saveBallToArsenal.mockRejectedValue(new Error('quota'));
      stubDatabase([{ pk: 1, ballName: 'Phaze II' }], { 1: frameRows({ 0: { frameNum: 0, pins: SEVEN_THEN_SPARE_MASK } }) });

      await service.importFromFile(pinpalFile());

      expect(toastService.showToast).toHaveBeenCalledWith("Import finished, but some balls couldn't be added to the arsenal.", 'bug-outline');
    });

    it('gives every imported game its own id', async () => {
      stubDatabase([{ pk: 1 }, { pk: 2 }], {
        1: frameRows({ 0: { frameNum: 0, pins: SEVEN_THEN_SPARE_MASK } }),
        2: frameRows({ 0: { frameNum: 0, pins: SEVEN_THEN_SPARE_MASK } }),
      });

      await service.importFromFile(pinpalFile());

      const ids = savedGames().map((g) => g.gameId);
      expect(new Set(ids).size).toBe(2);
    });

    it('closes the database even when the import fails', async () => {
      gamesStore.saveGamesToLocalStorage.mockRejectedValue(new Error('quota'));
      stubDatabase([{ pk: 1 }], { 1: frameRows({ 0: { frameNum: 0, pins: SEVEN_THEN_SPARE_MASK } }) });

      await expect(service.importFromFile(pinpalFile())).rejects.toThrow('quota');
      expect(close).toHaveBeenCalled();
    });

    it('finds the database even when the backup has a wrapper in front of it', async () => {
      stubDatabase([{ pk: 1 }], { 1: frameRows({ 0: { frameNum: 0, pins: SEVEN_THEN_SPARE_MASK } }) });

      await expect(service.importFromFile(pinpalFile([1, 2, 3, 4, 5]))).resolves.toBe(1);
    });

    it('rejects a file without a database in it', async () => {
      stubDatabase([], {});

      await expect(service.importFromFile(new File([new Uint8Array([1, 2, 3])], 'broken.pinpal'))).rejects.toThrow(/SQLite/);
    });
  });

  describe('decoding helpers', () => {
    it('decodes a strike from an empty pin mask', () => {
      const throws: Throw[] = service['decodePinpalThrows'](1, 0);

      expect(throws.map((t) => t.value)).toEqual([10]);
      expect(throws[0].pinsLeftStanding).toEqual([]);
    });

    it('resets the deck for the bonus throws of the 10th', () => {
      const throws: Throw[] = service['decodePinpalThrows'](10, 0);

      expect(throws.map((t) => t.value)).toEqual([10, 10, 10]);
    });

    it('reads an open frame from the packed nibbles', () => {
      expect(service['decodeManualNibbles']((9 << 4) | 7).map((t: Throw) => t.value)).toEqual([7, 2]);
      expect(service['decodeManualNibbles'](0)).toEqual([]);
    });

    it('reads a strike from the packed nibbles', () => {
      expect(service['decodeManualNibbles']((10 << 4) | 10).map((t: Throw) => t.value)).toEqual([10]);
    });

    it('reads a spare and its bonus ball in the 10th', () => {
      const throws: Throw[] = service['decode10thFrameScores']((10 << 4) | 7, 9, 0);

      expect(throws.map((t) => t.value)).toEqual([7, 3, 9]);
    });

    it('reads a strike followed by an open pair in the 10th', () => {
      const throws: Throw[] = service['decode10thFrameScores']((10 << 4) | 10, (7 << 4) | 4, 0);

      expect(throws.map((t) => t.value)).toEqual([10, 4, 3]);
    });

    it('reads an empty 10th frame', () => {
      expect(service['decode10thFrameScores'](0, 0, 0)).toEqual([]);
    });

    it('marks a game as manual when any frame lacks pin data', () => {
      const rows = frameRows({ 0: { frameNum: 0, pins: SEVEN_THEN_SPARE_MASK }, 1: { frameNum: 1, pins: DUMMY_MASK, scores: (9 << 4) | 7 } });

      const { frames, isPinMode }: { frames: Frame[]; isPinMode: boolean } = service['processFrames'](rows);

      expect(isPinMode).toBe(false);
      expect(frames[1].throws.map((t: Throw) => t.value)).toEqual([7, 2]);
    });
  });

  describe('findBestMatch', () => {
    it('prefers an exact name, ignoring case and padding', () => {
      expect(service['findBestMatch']('  phaze ii ', ['Phaze II', 'Phaze II Solid'])).toBe('Phaze II');
    });

    it('falls back to a partial match', () => {
      expect(service['findBestMatch']('phaze', ['Storm Phaze II'])).toBe('Storm Phaze II');
    });

    it('keeps the imported name when nothing matches', () => {
      expect(service['findBestMatch'](' Mystery ', ['Phaze II'])).toBe('Mystery');
    });

    it('has nothing to match without a name', () => {
      expect(service['findBestMatch'](null, ['Phaze II'])).toBeNull();
    });
  });

  describe('parseDate', () => {
    it('reads a julian day number', () => {
      expect(service['parseDate'](2460677)).toBe((2460677 - 2440587.5) * 86400 * 1000);
    });

    it('reads a unix timestamp in seconds', () => {
      expect(service['parseDate'](1767225600)).toBe(1767225600000);
    });

    it('reads a unix timestamp in milliseconds', () => {
      expect(service['parseDate'](1767225600000)).toBe(1767225600000);
    });

    it('falls back to now when there is no date', () => {
      expect(service['parseDate'](null)).toBeGreaterThan(0);
    });
  });
});
