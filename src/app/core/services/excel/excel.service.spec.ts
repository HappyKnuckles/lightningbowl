import { TestBed } from '@angular/core/testing';
import { ExcelService } from './excel.service';
import { HapticService } from '../haptic/haptic.service';
import { GamesStore } from 'src/app/core/stores/games.store';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { LeaguesStore } from 'src/app/core/stores/leagues.store';
import { ToastService } from '../toast/toast.service';
import { SortUtilsService } from '../sort-utils/sort-utils.service';
import { GameFilterService } from '../game-filter/game-filter.service';
import { GameStatsService } from '../game-stats/game-stats.service';

describe('ExcelService', () => {
  let service: ExcelService;
  let mockGamesStore: jasmine.SpyObj<GamesStore>;
  let mockBallsStore: jasmine.SpyObj<BallsStore>;
  let mockLeaguesStore: jasmine.SpyObj<LeaguesStore>;

  beforeEach(() => {
    const gamesStoreSpy = jasmine.createSpyObj('GamesStore', ['games', 'saveGamesToLocalStorage']);
    const ballsStoreSpy = jasmine.createSpyObj('BallsStore', ['allBalls', 'arsenal', 'saveBallToArsenal']);
    const leaguesStoreSpy = jasmine.createSpyObj('LeaguesStore', ['addLeague']);

    TestBed.configureTestingModule({
      providers: [
        {
          provide: ToastService,
          useValue: {
            showToast: jasmine.createSpy('showToast'),
          },
        },
        {
          provide: HapticService,
          useValue: {
            triggerHaptic: jasmine.createSpy('triggerHaptic'),
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
          provide: SortUtilsService,
          useValue: {
            sortGameHistoryByDate: jasmine.createSpy('sortGameHistoryByDate').and.returnValue([]),
          },
        },
        {
          provide: GameFilterService,
          useValue: {
            setDefaultFilters: jasmine.createSpy('setDefaultFilters'),
          },
        },
        {
          provide: GameStatsService,
          useValue: {
            calculateStats: jasmine.createSpy('calculateStats'),
          },
        },
      ],
    });
    service = TestBed.inject(ExcelService);
    mockGamesStore = TestBed.inject(GamesStore) as jasmine.SpyObj<GamesStore>;
    mockBallsStore = TestBed.inject(BallsStore) as jasmine.SpyObj<BallsStore>;
    mockLeaguesStore = TestBed.inject(LeaguesStore) as jasmine.SpyObj<LeaguesStore>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should support legacy Pattern field in transformData', async () => {
    // Mock storage service methods
    mockBallsStore.allBalls.and.returnValue([]);
    mockBallsStore.arsenal.and.returnValue([]);
    mockLeaguesStore.addLeague.and.returnValue(Promise.resolve());
    mockBallsStore.saveBallToArsenal.and.returnValue(Promise.resolve());
    mockGamesStore.saveGamesToLocalStorage.and.returnValue(Promise.resolve());

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
        Pattern: 'Test Pattern, House Shot', // Legacy field with comma-separated values
        Balls: 'Storm Ball',
        Notes: 'Test game',
      },
    ];

    // This should not throw and should process the legacy Pattern field
    await expectAsync(service.transformData(testData)).toBeResolved();

    // Verify that the storageService methods were called
    expect(mockGamesStore.saveGamesToLocalStorage).toHaveBeenCalled();

    // Check that the game was processed with the patterns from the legacy field
    const savedGamesCall = mockGamesStore.saveGamesToLocalStorage.calls.mostRecent();
    const savedGames = savedGamesCall.args[0];
    expect(savedGames.length).toBe(1);
    expect(savedGames[0].patterns).toEqual(['Test Pattern', 'House Shot']);
  });

  it('should prefer new Patterns field over legacy Pattern field', async () => {
    // Mock storage service methods
    mockBallsStore.allBalls.and.returnValue([]);
    mockBallsStore.arsenal.and.returnValue([]);
    mockLeaguesStore.addLeague.and.returnValue(Promise.resolve());
    mockBallsStore.saveBallToArsenal.and.returnValue(Promise.resolve());
    mockGamesStore.saveGamesToLocalStorage.and.returnValue(Promise.resolve());

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

    await expectAsync(service.transformData(testData)).toBeResolved();

    // Check that the new Patterns field was used, not the legacy one
    const savedGamesCall = mockGamesStore.saveGamesToLocalStorage.calls.mostRecent();
    const savedGames = savedGamesCall.args[0];
    expect(savedGames.length).toBe(1);
    expect(savedGames[0].patterns).toEqual(['New Pattern', 'Sport Pattern']);
  });
});
