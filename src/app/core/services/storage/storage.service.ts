import { Injectable } from '@angular/core';
import { Game } from 'src/app/core/models/game.model';
import { Ball } from 'src/app/core/models/ball.model';
import { AppFacade } from 'src/app/core/stores/app.facade';
import { GamesStore } from 'src/app/core/stores/games.store';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { PatternsStore } from 'src/app/core/stores/patterns.store';
import { LeaguesStore } from 'src/app/core/stores/leagues.store';
import { SettingsStore } from 'src/app/core/stores/settings.store';

@Injectable({
  providedIn: 'root',
})
export class StorageService {
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

  constructor(
    private appFacade: AppFacade,
    private gamesStore: GamesStore,
    private ballsStore: BallsStore,
    private patternsStore: PatternsStore,
    private leaguesStore: LeaguesStore,
    private settingsStore: SettingsStore,
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
