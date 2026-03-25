import { Injectable, signal } from '@angular/core';
import { Game } from 'src/app/core/models/game.model';
import { Ball } from 'src/app/core/models/ball.model';
import { AppFacade } from 'src/app/core/stores/app.facade';
import { GamesStore } from 'src/app/core/stores/games.store';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { PatternsStore } from 'src/app/core/stores/patterns.store';
import { LeaguesStore } from 'src/app/core/stores/leagues.store';
import { SettingsStore } from 'src/app/core/stores/settings.store';
import { CacheService } from '../cache/cache.service';
import { NetworkService } from '../network/network.service';
import { PatternService } from '../pattern/pattern.service';

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  #patternImageMap = signal<Record<string, string>>({});

  get url() {
    return this.ballsStore.url;
  }

  get pinInputMode() {
    return this.settingsStore.pinInputMode;
  }

  get leagues() {
    return this.leaguesStore.leagues;
  }

  get games() {
    return this.gamesStore.games;
  }

  get arsenal() {
    return this.ballsStore.arsenal;
  }

  get allBalls() {
    return this.ballsStore.allBalls;
  }

  get allPatterns() {
    return this.patternsStore.allPatterns;
  }

  get patternImageMap() {
    return this.#patternImageMap;
  }

  constructor(
    private appFacade: AppFacade,
    private gamesStore: GamesStore,
    private ballsStore: BallsStore,
    private patternsStore: PatternsStore,
    private leaguesStore: LeaguesStore,
    private settingsStore: SettingsStore,
    private cacheService: CacheService,
    private networkService: NetworkService,
    private patternService: PatternService,
  ) {}

  async loadArsenal(): Promise<void> {
    return this.ballsStore.loadArsenal();
  }

  async loadLeagues(): Promise<string[]> {
    return this.leaguesStore.loadLeagues();
  }

  async loadGameHistory(): Promise<Game[]> {
    return this.gamesStore.loadGameHistory();
  }

  loadPinInputMode(): void {
    this.settingsStore.loadPinInputMode();
  }

  async loadAllBalls(updated?: string, weight?: number, forceRefresh = false): Promise<void> {
    return this.ballsStore.loadAllBalls(updated, weight, forceRefresh);
  }

  async loadAllPatterns(forceRefresh = false): Promise<void> {
    return this.patternsStore.loadAllPatterns(forceRefresh);
  }

  async loadPatternImageMap(forceRefresh = false): Promise<void> {
    const cacheKey = 'pattern_image_map';

    try {
      if (!forceRefresh) {
        const cached = await this.cacheService.get<Record<string, string>>(cacheKey);
        const isCacheValid = await this.cacheService.isValid(cacheKey);

        if (cached && (isCacheValid || this.networkService.isOffline)) {
          this.#patternImageMap.set(cached);
          if (this.networkService.isOnline && (await this.cacheService.isStale(cacheKey))) {
            this.refreshPatternImageMapInBackground(cacheKey);
          }
          return;
        }
      }

      if (this.networkService.isOffline) {
        return;
      }

      const response = await this.patternService.getAllPatternCharts();
      const patterns = response.patterns;
      const imageMap: Record<string, string> = {};
      for (const p of patterns) {
        if (p.title && p.chart_horizontal) {
          imageMap[p.title] = p.chart_horizontal;
        }
      }
      this.#patternImageMap.set(imageMap);
      await this.cacheService.set(cacheKey, imageMap);
    } catch (error) {
      console.error('Error loading pattern image map:', error);
      const cached = await this.cacheService.get<Record<string, string>>(cacheKey);
      if (cached) {
        this.#patternImageMap.set(cached);
      }
    }
  }

  private async refreshPatternImageMapInBackground(cacheKey: string): Promise<void> {
    try {
      const response = await this.patternService.getAllPatternCharts();
      const patterns = response.patterns;

      const imageMap: Record<string, string> = {};
      for (const p of patterns) {
        if (p.title && p.chart_horizontal) {
          imageMap[p.title] = p.chart_horizontal;
        }
      }
      this.#patternImageMap.set(imageMap);
      await this.cacheService.set(cacheKey, imageMap);
    } catch (error) {
      console.error('Background refresh failed for pattern image map:', error);
    }
  }

  savePinInputMode(pinMode: string): void {
    this.settingsStore.savePinInputMode(pinMode);
  }

  async saveBallToArsenal(ball: Ball): Promise<void> {
    return this.ballsStore.saveBallToArsenal(ball);
  }

  async saveBallsToArsenal(balls: Ball[]): Promise<void> {
    return this.ballsStore.saveBallsToArsenal(balls);
  }

  async addLeague(league: string): Promise<void> {
    return this.leaguesStore.addLeague(league);
  }

  async saveGamesToLocalStorage(gameData: Game[]): Promise<void> {
    return this.gamesStore.saveGamesToLocalStorage(gameData);
  }

  async saveGameToLocalStorage(gameData: Game): Promise<void> {
    return this.gamesStore.saveGameToLocalStorage(gameData);
  }

  async removeFromArsenal(ball: Ball): Promise<void> {
    return this.ballsStore.removeFromArsenal(ball);
  }

  async deleteLeague(league: string): Promise<void> {
    return this.leaguesStore.deleteLeague(league);
  }

  async deleteGame(gameId: string): Promise<void> {
    return this.gamesStore.deleteGame(gameId);
  }

  async editLeague(newLeague: string, oldLeague: string): Promise<void> {
    return this.appFacade.editLeague(newLeague, oldLeague);
  }

  async deleteAllData(): Promise<void> {
    return this.appFacade.deleteAllData();
  }
}
