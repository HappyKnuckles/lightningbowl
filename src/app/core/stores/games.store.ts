import { Injectable, signal } from '@angular/core';
import { Game } from 'src/app/core/models/game.model';
import { LoadingService } from 'src/app/core/services/loader/loading.service';
import { SortUtilsService } from 'src/app/core/services/sort-utils/sort-utils.service';
import { STORAGE_PREFIX, StorageKeys } from 'src/app/core/services/storage/storage-keys';
import { StorageRepository } from 'src/app/core/services/storage/storage.repository';

@Injectable({ providedIn: 'root' })
export class GamesStore {
  #games = signal<Game[]>([]);
  #firstGameDate: number | null = null;

  get games() {
    return this.#games;
  }

  constructor(
    private storageRepository: StorageRepository,
    private sortUtilsService: SortUtilsService,
    private loadingService: LoadingService,
  ) {}

  async loadGameHistory(): Promise<Game[]> {
    this.loadingService.setLoading(true);
    try {
      const gameHistory = await this.storageRepository.loadByPrefix<Game>(STORAGE_PREFIX.game);
      let needsUpdate = false;

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

        if (game.patterns && Array.isArray(game.patterns)) {
          const originalPatternsStr = JSON.stringify(game.patterns);
          game.patterns.sort();
          if (JSON.stringify(game.patterns) !== originalPatternsStr) {
            needsUpdate = true;
          }
        }
        if (game.balls && Array.isArray(game.balls)) {
          const originalBallsStr = JSON.stringify(game.balls);
          game.balls.sort();
          if (JSON.stringify(game.balls) !== originalBallsStr) {
            needsUpdate = true;
          }
        }
      });

      if (needsUpdate) {
        await this.saveGamesToLocalStorage(gameHistory);
      }

      this.sortUtilsService.sortGameHistoryByDate(gameHistory, false);
      this.#games.set(gameHistory);
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
      const previousGame = this.#games().find((game) => game.gameId === gameData.gameId);
      let updatedGames: Game[] = [];
      this.#games.update((games) => {
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
      const deletedGame = this.#games().find((game) => game.gameId === gameId);
      let updatedGames: Game[] = [];
      this.#games.update((games) => {
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
    this.#games.update(updater);
  }

  clearGames(): void {
    this.#games.set([]);
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
}
