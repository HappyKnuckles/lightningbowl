import { Injectable, signal } from '@angular/core';
import { Game, ThrowBall } from 'src/app/core/models/game.model';
import { LoadingService } from 'src/app/core/services/loader/loading.service';
import { STORAGE_PREFIX, StorageKeys } from 'src/app/core/services/storage/storage-keys';
import { StorageRepository } from 'src/app/core/services/storage/storage.repository';
import { sortGameHistoryByDate } from '../utils/sort-utils/sort.utils';

@Injectable({ providedIn: 'root' })
export class GamesStore {
  readonly games = signal<Game[]>([]);
  #firstGameDate: number | null = null;

  constructor(
    private storageRepository: StorageRepository,
    private loadingService: LoadingService,
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
        if (game.balls && Array.isArray(game.balls) && !this.isSorted(game.balls)) {
          game.balls.sort();
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
        if (!game.ballTracking) {
          const hasThrowLevelBalls = (game.frames || []).some((frame) => (frame.throws || []).some((throwData) => throwData.ball?.name));
          game.ballTracking = hasThrowLevelBalls ? 'throw' : 'game';
          needsUpdate = true;
        }
      });

      if (needsUpdate) {
        await this.saveGamesToLocalStorage(gameHistory);
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

  async saveGameToLocalStorage(gameData: Game): Promise<void> {
    try {
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

  async saveGamesToLocalStorage(gameData: Game[]): Promise<void> {
    try {
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
}
