import { Injectable, signal } from '@angular/core';
import { Game } from 'src/app/core/models/game.model';
import { StorageRepository } from 'src/app/core/services/storage/storage.repository';
import { StorageKeys, STORAGE_PREFIX } from 'src/app/core/services/storage/storage-keys';
import { SortUtilsService } from 'src/app/core/services/sort-utils/sort-utils.service';
import { LoadingService } from 'src/app/core/services/loader/loading.service';

@Injectable({ providedIn: 'root' })
export class GamesStore {
  #games = signal<Game[]>([]);

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
      const gameHistory = await this.loadData<Game>(STORAGE_PREFIX.game);
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
      this.#games.update((games) => {
        const index = games.findIndex((game) => game.gameId === gameData.gameId);
        if (index !== -1) {
          return games.map((game, i) => (i === index ? gameData : game));
        } else {
          return [gameData, ...games];
        }
      });
    } catch (error) {
      console.error('Error saving game to local storage:', error);
      throw error;
    }
  }

  async saveGamesToLocalStorage(gameData: Game[]): Promise<void> {
    try {
      await Promise.all(gameData.map((game) => this.storageRepository.set(StorageKeys.game(game.gameId), game)));
      this.#games.update((games) => {
        const existingMap = new Map(games.map((g) => [g.gameId, g]));
        for (const game of gameData) {
          existingMap.set(game.gameId, game);
        }
        const updatedIds = new Set(gameData.map((g) => g.gameId));
        const others = games.filter((g) => !updatedIds.has(g.gameId));
        return [...gameData, ...others];
      });
    } catch (error) {
      console.error('Error saving games to local storage:', error);
      throw error;
    }
  }

  async deleteGame(gameId: string): Promise<void> {
    try {
      const key = StorageKeys.game(gameId);
      await this.storageRepository.remove(key);
      this.#games.update((games) => {
        const newGames = games.filter((g) => g.gameId !== gameId);
        return [...newGames];
      });
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
  }

  private async loadData<T>(prefix: string): Promise<T[]> {
    try {
      const data: T[] = [];
      await this.storageRepository.forEach((value, key) => {
        if (key.startsWith(prefix)) {
          data.push(value as T);
        }
      });
      return data;
    } catch (error) {
      console.error(`Error loading data for prefix "${prefix}":`, error);
      throw error;
    }
  }
}
