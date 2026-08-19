import { TestBed } from '@angular/core/testing';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { GamesStore } from 'src/app/core/stores/games.store';
import { LeaguesStore } from 'src/app/core/stores/leagues.store';
import { GameFilterService } from '../game-filter/game-filter.service';
import { GameStatsService } from '../game-stats/game-stats.service';
import { HapticService } from '../haptic/haptic.service';
import { ToastService } from '../toast/toast.service';
import { ExcelService } from './excel.service';
import { vi } from 'vitest';
import { createSpyObj, SpyObj } from '../../../../testing/spy-obj';

describe('ExcelService', () => {
  let service: ExcelService;
  let mockGamesStore: SpyObj<GamesStore>;
  let mockBallsStore: SpyObj<BallsStore>;
  let mockLeaguesStore: SpyObj<LeaguesStore>;

  beforeEach(() => {
    const gamesStoreSpy = createSpyObj(['games', 'saveGamesToLocalStorage']);
    const ballsStoreSpy = createSpyObj(['allBalls', 'arsenal', 'saveBallToArsenal']);
    const leaguesStoreSpy = createSpyObj(['addLeague']);

    TestBed.configureTestingModule({
      providers: [
        {
          provide: ToastService,
          useValue: {
            showToast: vi.fn(),
          },
        },
        {
          provide: HapticService,
          useValue: {
            triggerHaptic: vi.fn(),
          },
        },
        {
          provide: GamesStore,
          useValue: gamesStoreSpy,
        },
        {
          provide: BallsStore,
          useValue: ballsStoreSpy,
        },
        {
          provide: LeaguesStore,
          useValue: leaguesStoreSpy,
        },
        {
          provide: GameFilterService,
          useValue: {
            setDefaultFilters: vi.fn(),
          },
        },
        {
          provide: GameStatsService,
          useValue: {
            calculateStats: vi.fn(),
          },
        },
      ],
    });
    service = TestBed.inject(ExcelService);
    mockGamesStore = TestBed.inject(GamesStore) as SpyObj<GamesStore>;
    mockBallsStore = TestBed.inject(BallsStore) as SpyObj<BallsStore>;
    mockLeaguesStore = TestBed.inject(LeaguesStore) as SpyObj<LeaguesStore>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should support legacy Pattern field in transformData', async () => {
    // Mock storage service methods
    mockBallsStore.allBalls.mockReturnValue([]);
    mockBallsStore.arsenal.mockReturnValue([]);
    mockLeaguesStore.addLeague.mockReturnValue(Promise.resolve());
    mockBallsStore.saveBallToArsenal.mockReturnValue(Promise.resolve([]));
    mockGamesStore.saveGamesToLocalStorage.mockReturnValue(Promise.resolve());

    const testData = [
      // Header row
      {
        Game: 'Game',
        Date: 'Date',
        'Frame 1': 'Frame 1',
        'Frame 2': 'Frame 2',
        'Frame 3': 'Frame 3',
        'Frame 4': 'Frame 4',
        'Frame 5': 'Frame 5',
        'Frame 6': 'Frame 6',
        'Frame 7': 'Frame 7',
        'Frame 8': 'Frame 8',
        'Frame 9': 'Frame 9',
        'Frame 10': 'Frame 10',
        'Total Score': 'Total Score',
        'Frame Scores': 'Frame Scores',
        League: 'League',
        Practice: 'Practice',
        Clean: 'Clean',
        Perfect: 'Perfect',
        Series: 'Series',
        'Series ID': 'Series ID',
        Pattern: 'Pattern', // Legacy field name
        Balls: 'Balls',
        Notes: 'Notes',
      },
      // Data row with legacy Pattern field
      {
        Game: '1',
        Date: '1/1/2024',
        'Frame 1': '10',
        'Frame 2': '10',
        'Frame 3': '10',
        'Frame 4': '10',
        'Frame 5': '10',
        'Frame 6': '10',
        'Frame 7': '10',
        'Frame 8': '10',
        'Frame 9': '10',
        'Frame 10': '10 / 10 / 10',
        'Total Score': '300',
        'Frame Scores': '30, 60, 90, 120, 150, 180, 210, 240, 270, 300',
        League: 'Test League',
        Practice: 'false',
        Clean: 'true',
        Perfect: 'true',
        Series: 'false',
        'Series ID': '',
        Pattern: 'Test Pattern, House Shot', // A single legacy pattern name that happens to contain a comma
        Balls: 'Storm Ball',
        Notes: 'Test game',
      },
    ];

    // This should not throw and should process the legacy Pattern field
    await expect(service.transformData(testData)).resolves.toBeUndefined();

    // Verify that the storageService methods were called
    expect(mockGamesStore.saveGamesToLocalStorage).toHaveBeenCalled();

    // The singular legacy `Pattern` column holds exactly one pattern name, so its
    // value is taken verbatim rather than split on commas (only the plural
    // `Patterns` column is comma-separated).
    const savedGamesCall = mockGamesStore.saveGamesToLocalStorage.mock.calls.at(-1)!;
    const savedGames = savedGamesCall[0];
    expect(savedGames.length).toBe(1);
    expect(savedGames[0].patterns).toEqual(['Test Pattern, House Shot']);
  });

  it('should prefer new Patterns field over legacy Pattern field', async () => {
    // Mock storage service methods
    mockBallsStore.allBalls.mockReturnValue([]);
    mockBallsStore.arsenal.mockReturnValue([]);
    mockLeaguesStore.addLeague.mockReturnValue(Promise.resolve());
    mockBallsStore.saveBallToArsenal.mockReturnValue(Promise.resolve([]));
    mockGamesStore.saveGamesToLocalStorage.mockReturnValue(Promise.resolve());

    const testData = [
      // Header row
      {
        Game: 'Game',
        Date: 'Date',
        'Frame 1': 'Frame 1',
        'Frame 2': 'Frame 2',
        'Frame 3': 'Frame 3',
        'Frame 4': 'Frame 4',
        'Frame 5': 'Frame 5',
        'Frame 6': 'Frame 6',
        'Frame 7': 'Frame 7',
        'Frame 8': 'Frame 8',
        'Frame 9': 'Frame 9',
        'Frame 10': 'Frame 10',
        'Total Score': 'Total Score',
        'Frame Scores': 'Frame Scores',
        League: 'League',
        Practice: 'Practice',
        Clean: 'Clean',
        Perfect: 'Perfect',
        Series: 'Series',
        'Series ID': 'Series ID',
        Patterns: 'Patterns', // New field name
        Pattern: 'Pattern', // Legacy field name
        Balls: 'Balls',
        Notes: 'Notes',
      },
      // Data row with both fields present
      {
        Game: '1',
        Date: '1/1/2024',
        'Frame 1': '10',
        'Frame 2': '10',
        'Frame 3': '10',
        'Frame 4': '10',
        'Frame 5': '10',
        'Frame 6': '10',
        'Frame 7': '10',
        'Frame 8': '10',
        'Frame 9': '10',
        'Frame 10': '10 / 10 / 10',
        'Total Score': '300',
        'Frame Scores': '30, 60, 90, 120, 150, 180, 210, 240, 270, 300',
        League: 'Test League',
        Practice: 'false',
        Clean: 'true',
        Perfect: 'true',
        Series: 'false',
        'Series ID': '',
        Patterns: 'New Pattern, Sport Pattern', // New field should be preferred
        Pattern: 'Old Pattern, Legacy Pattern', // Legacy field should be ignored
        Balls: 'Storm Ball',
        Notes: 'Test game',
      },
    ];

    await expect(service.transformData(testData)).resolves.toBeUndefined();

    // Check that the new Patterns field was used, not the legacy one
    const savedGamesCall = mockGamesStore.saveGamesToLocalStorage.mock.calls.at(-1)!;
    const savedGames = savedGamesCall[0];
    expect(savedGames.length).toBe(1);
    expect(savedGames[0].patterns).toEqual(['New Pattern', 'Sport Pattern']);
  });
});
