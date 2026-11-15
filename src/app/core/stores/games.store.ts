import { Injectable, signal } from '@angular/core';
import { Game, ThrowBall } from 'src/app/core/models/game.model';
import { LoadingService } from 'src/app/core/services/loader/loading.service';
import { STORAGE_PREFIX, StorageKeys } from 'src/app/core/services/storage/storage-keys';
import { StorageRepository } from 'src/app/core/services/storage/storage.repository';
import { Ball } from 'src/app/core/models/ball.model';
import { getBallTracking, migrateGameBalls, unlinkArsenalBall, withBallLayouts } from '../utils/game-utils/game-ball.utils';
import { BallsStore } from './balls.store';
import { sortGameHistoryByDate } from '../utils/sort-utils/sort.utils';

type ArsenalRef = Pick<Ball, 'ball_name' | 'core_weight'> & Pick<Partial<Ball>, 'arsenalId'>;

@Injectable({ providedIn: 'root' })
export class GamesStore {
  readonly games = signal<Game[]>([]);
  #firstGameDate: number | null = null;

  constructor(
    private storageRepository: StorageRepository,
    private loadingService: LoadingService,
    private ballsStore: BallsStore,
  ) {}

  async loadGameHistory(): Promise<Game[]> {
    this.loadingService.setLoading(true);
    try {
      const gameHistory = await this.storageRepository.loadByPrefix<Game>(STORAGE_PREFIX.game);
      let needsUpdate = false;

      // Legacy migration: support games stored before ThrowBall was introduced
      // (where throw.ball was a plain string)
      interface LegacyThrow {
        ball?: string | ThrowBall;
      }

      gameHistory.forEach((game) => {
        const legacyGame = game as Game & { pattern?: string };
        if (legacyGame.pattern && !game.patterns) {
          game.patterns = [legacyGame.pattern];
          delete legacyGame.pattern;
          needsUpdate = true;
        } else if (!game.patterns) {
          game.patterns = [];
          needsUpdate = true;
        }

        if (legacyGame.pattern !== undefined) {
          delete legacyGame.pattern;
          needsUpdate = true;
        }

        if (game.patterns && Array.isArray(game.patterns) && !this.isSorted(game.patterns)) {
          game.patterns.sort();
          needsUpdate = true;
        }

        // Migrate legacy string ball data to ThrowBall objects
        (game.frames || []).forEach((frame) => {
          (frame.throws || []).forEach((throwData) => {
            const rawBall = (throwData as LegacyThrow).ball;
            if (typeof rawBall === 'string') {
              const trimmed = rawBall.trim();
              if (trimmed.length === 0) {
                delete throwData.ball;
              } else {
                throwData.ball = { name: trimmed };
              }
              needsUpdate = true;
            }
          });
        });

        // Tag how this game recorded its balls. Games that never had a ball picked per throw
        // stay on game-level tracking. Their throws are deliberately left empty rather than
        // backfilled, so per-throw stats never count balls the user did not actually record.
        // The tag is derivable from the frames, so it is set in memory only and reaches storage
        // with the game's next save, instead of rewriting the whole history on first load.
        if (!game.ballTracking) {
          game.ballTracking = getBallTracking(game);
        }
      });

      if (needsUpdate) {
        // straight to storage: the balls are migrated once the arsenal is loaded (see `migrateBallWeights`)
        await Promise.all(gameHistory.map((game) => this.storageRepository.set(StorageKeys.game(game.gameId), game)));
      }

      sortGameHistoryByDate(gameHistory, false);
      this.games.set(gameHistory);
      this.updateFirstGameDate(this.games());

      return gameHistory;
    } catch (error) {
      console.error('Error loading game history:', error);
      throw error;
    } finally {
      this.loadingService.setLoading(false);
    }
  }

  /**
   * Brings every ball the loaded games store to canonical `{ name, weight }` and links it to its arsenal
   * ball (see `migrateGameBalls`), and saves the games that changed. Needs the arsenal and known balls,
   * so it runs once they are loaded, and again when the arsenal gets a ball.
   */
  async migrateBallWeights(arsenal: ArsenalRef[], known: ArsenalRef[] = arsenal): Promise<void> {
    await this.replaceGames((game) => migrateGameBalls(game, arsenal, known), 'Error saving migrated ball weights:');
  }

  /**
   * Takes the link to an arsenal ball off every game that used it (see `unlinkArsenalBall`), for a ball
   * that left the arsenal.
   */
  async unlinkArsenalBall(arsenalId: string): Promise<void> {
    await this.replaceGames((game) => unlinkArsenalBall(game, arsenalId), 'Error unlinking arsenal ball from games:');
  }

  async saveGameToLocalStorage(game: Game): Promise<void> {
    try {
      const gameData = await this.prepareForSave(game, true);
      const key = StorageKeys.game(gameData.gameId);
      await this.storageRepository.set(key, gameData);
      const previousGame = this.games().find((game) => game.gameId === gameData.gameId);
      let updatedGames: Game[] = [];
      this.games.update((games) => {
        const index = games.findIndex((game) => game.gameId === gameData.gameId);
        if (index !== -1) {
          updatedGames = games.map((game, i) => (i === index ? gameData : game));
          return updatedGames;
        } else {
          updatedGames = [gameData, ...games];
          return updatedGames;
        }
      });
      this.updateFirstGameDateAfterSave(previousGame, gameData, updatedGames);
    } catch (error) {
      console.error('Error saving game to local storage:', error);
      throw error;
    }
  }

  /**
   * Saves games. `recordLayouts: false` is for games that aren't being bowled or edited now (an import, a
   * change across the whole history): the layout their balls have today says nothing about those games.
   */
  async saveGamesToLocalStorage(games: Game[], options: { recordLayouts?: boolean } = {}): Promise<void> {
    try {
      const gameData = await Promise.all(games.map((game) => this.prepareForSave(game, options.recordLayouts ?? true)));
      // Save all games in parallel
      await Promise.all(gameData.map((game) => this.storageRepository.set(StorageKeys.game(game.gameId), game)));

      // Efficient signal update
      let mergedGames: Game[] = [];
      this.games.update((games) => {
        const existingMap = new Map(games.map((g) => [g.gameId, g]));
        for (const game of gameData) {
          existingMap.set(game.gameId, game);
        }

        // Keep new/updated games at top
        const updatedIds = new Set(gameData.map((g) => g.gameId));
        const others = games.filter((g) => !updatedIds.has(g.gameId));
        mergedGames = [...gameData, ...others];
        return mergedGames;
      });

      this.updateFirstGameDate(mergedGames);
    } catch (error) {
      console.error('Error saving games to local storage:', error);
      throw error;
    }
  }

  async deleteGame(gameId: string): Promise<void> {
    try {
      const key = StorageKeys.game(gameId);
      await this.storageRepository.remove(key);
      const deletedGame = this.games().find((game) => game.gameId === gameId);
      let updatedGames: Game[] = [];
      this.games.update((games) => {
        const newGames = games.filter((g) => g.gameId !== gameId);
        updatedGames = [...newGames];
        return updatedGames;
      });
      this.updateFirstGameDateAfterDelete(deletedGame, updatedGames);
    } catch (error) {
      console.error('Error deleting game:', error);
      throw error;
    }
  }

  updateGamesInMemory(updater: (games: Game[]) => Game[]): void {
    this.games.update(updater);
  }

  clearGames(): void {
    this.games.set([]);
    this.updateFirstGameDate([]);
  }

  private updateFirstGameDate(games: Game[]): void {
    this.setFirstGameDate(this.calculateEarliestDate(games));
  }

  private updateFirstGameDateAfterSave(previousGame: Game | undefined, savedGame: Game, games: Game[]): void {
    const currentFirstGameDate = this.#firstGameDate;

    if (currentFirstGameDate === null) {
      this.updateFirstGameDate(games);
      return;
    }

    if (!previousGame) {
      if (savedGame.date < currentFirstGameDate) {
        this.setFirstGameDate(savedGame.date);
      }
      return;
    }

    if (savedGame.date <= currentFirstGameDate) {
      this.setFirstGameDate(savedGame.date);
      return;
    }

    if (previousGame.date === currentFirstGameDate) {
      this.updateFirstGameDate(games);
    }
  }

  private updateFirstGameDateAfterDelete(deletedGame: Game | undefined, games: Game[]): void {
    if (!games.length) {
      this.setFirstGameDate(null);
      return;
    }

    const currentFirstGameDate = this.#firstGameDate;
    if (currentFirstGameDate === null) {
      this.updateFirstGameDate(games);
      return;
    }

    if (deletedGame?.date === currentFirstGameDate) {
      this.updateFirstGameDate(games);
    }
  }

  private calculateEarliestDate(games: Game[]): number | null {
    if (!games.length) {
      return null;
    }

    const earliestDate = games.reduce((minDate, game) => Math.min(minDate, game.date), Number.POSITIVE_INFINITY);
    return Number.isFinite(earliestDate) ? earliestDate : null;
  }

  private setFirstGameDate(date: number | null): void {
    this.#firstGameDate = date;

    if (date === null) {
      localStorage.removeItem('first-game');
      return;
    }

    localStorage.setItem('first-game', date.toString());
  }

  /** Cheap already-sorted check so loadGameHistory can skip sort+save for the common case without JSON.stringify-ing every game's arrays. */
  private isSorted(values: string[]): boolean {
    for (let i = 1; i < values.length; i++) {
      if (values[i - 1] > values[i]) {
        return false;
      }
    }
    return true;
  }

  /** Saves the games `change` returns a new object for, and puts them in place of the old ones. */
  private async replaceGames(change: (game: Game) => Game, errorMessage: string): Promise<void> {
    const changed = this.games()
      .map((game) => [game, change(game)] as const)
      .filter(([before, after]) => before !== after)
      .map(([, after]) => after);
    if (changed.length === 0) return;
    try {
      await Promise.all(changed.map((game) => this.storageRepository.set(StorageKeys.game(game.gameId), game)));
    } catch (error) {
      console.error(errorMessage, error);
    }
    const byId = new Map(changed.map((game) => [game.gameId, game]));
    this.games.update((games) => games.map((game) => byId.get(game.gameId) ?? game));
  }

  /**
   * A game as it goes to storage: its balls canonical and linked to the arsenal, and with `recordLayouts`
   * the layout of each ball recorded on it (see `withBallLayouts`). The stored game is read back for that,
   * as the game in memory may be the very object that was edited.
   */
  private async prepareForSave(game: Game, recordLayouts: boolean): Promise<Game> {
    const arsenal = this.ballsStore.arsenal();
    const linked = migrateGameBalls(game, arsenal, this.ballsStore.knownBalls());
    if (!recordLayouts) return linked;
    const saved = await this.storageRepository.get<Game>(StorageKeys.game(game.gameId));
    return withBallLayouts(linked, saved, arsenal);
  }
}
