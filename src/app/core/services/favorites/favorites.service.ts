import { inject, Injectable, signal, Signal } from '@angular/core';

import { Ball } from '../../models/ball.model';
import { Pattern } from '../../models/pattern.model';
import { BallService } from '../ball/ball.service';
import { PatternService } from '../pattern/pattern.service';

@Injectable({
  providedIn: 'root',
})
export class FavoritesService {
  private patternService = inject(PatternService);
  private ballService = inject(BallService);
  private _favoritePatterns = signal<Map<string, Pattern>>(new Map());
  private _favoriteBalls = signal<Map<string, Ball>>(new Map());
  readonly favoritePatterns: Signal<Map<string, Pattern>> = this._favoritePatterns;
  readonly favoriteBalls: Signal<Map<string, Ball>> = this._favoriteBalls;

  constructor() {
    const patternUrlsToMigrate = this.loadPatternsFromStorage();
    const ballKeysToMigrate = this.loadBallsFromStorage();
    if (patternUrlsToMigrate.length > 0) {
      void this.migrateOldPatternFavorites(patternUrlsToMigrate);
    }
    if (ballKeysToMigrate.length > 0) {
      void this.migrateOldBallFavorites(ballKeysToMigrate);
    }
  }

  // Pattern methods
  isFavorite(patternUrl: string): boolean {
    return this._favoritePatterns().has(patternUrl);
  }

  toggleFavorite(pattern: Pattern): boolean {
    const currentFavorites = new Map(this._favoritePatterns());
    let isFavorited: boolean;

    if (currentFavorites.has(pattern.url)) {
      currentFavorites.delete(pattern.url);
      isFavorited = false;
    } else {
      currentFavorites.set(pattern.url, pattern);
      isFavorited = true;
    }

    this._favoritePatterns.set(currentFavorites);
    this.saveFavoritesToStorage();

    return isFavorited;
  }

  addFavorite(pattern: Pattern): void {
    const currentFavorites = new Map(this._favoritePatterns());
    currentFavorites.set(pattern.url, pattern);
    this._favoritePatterns.set(currentFavorites);
    this.saveFavoritesToStorage();
  }

  removeFavorite(patternUrl: string): void {
    const currentFavorites = new Map(this._favoritePatterns());
    currentFavorites.delete(patternUrl);
    this._favoritePatterns.set(currentFavorites);
    this.saveFavoritesToStorage();
  }

  getFavoritePatternUrls(): string[] {
    return Array.from(this._favoritePatterns().keys());
  }

  getFavoritePatterns(): Pattern[] {
    return Array.from(this._favoritePatterns().values());
  }

  // Ball methods
  isBallFavorite(ballId: string, coreWeight: string): boolean {
    const ballKey = `${ballId}-${coreWeight}`;
    return this._favoriteBalls().has(ballKey);
  }

  toggleBallFavorite(ball: Ball): boolean {
    const ballKey = `${ball.ball_id}-${ball.core_weight}`;
    const currentFavorites = new Map(this._favoriteBalls());
    let isFavorited: boolean;

    if (currentFavorites.has(ballKey)) {
      currentFavorites.delete(ballKey);
      isFavorited = false;
    } else {
      currentFavorites.set(ballKey, ball);
      isFavorited = true;
    }

    this._favoriteBalls.set(currentFavorites);
    this.saveFavoritesToStorage();

    return isFavorited;
  }

  addBallFavorite(ball: Ball): void {
    const ballKey = `${ball.ball_id}-${ball.core_weight}`;
    const currentFavorites = new Map(this._favoriteBalls());
    currentFavorites.set(ballKey, ball);
    this._favoriteBalls.set(currentFavorites);
    this.saveFavoritesToStorage();
  }

  removeBallFavorite(ballId: string, coreWeight: string): void {
    const ballKey = `${ballId}-${coreWeight}`;
    const currentFavorites = new Map(this._favoriteBalls());
    currentFavorites.delete(ballKey);
    this._favoriteBalls.set(currentFavorites);
    this.saveFavoritesToStorage();
  }

  getFavoriteBallKeys(): string[] {
    return Array.from(this._favoriteBalls().keys());
  }

  getFavoriteBalls(): Ball[] {
    return Array.from(this._favoriteBalls().values());
  }

  private loadPatternsFromStorage(): string[] {
    if (typeof localStorage === 'undefined') return [];

    const savedPatterns = localStorage.getItem('favoritePatterns');
    if (!savedPatterns) return [];

    try {
      const parsed: unknown[] = JSON.parse(savedPatterns);
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (typeof parsed[0] === 'string') {
          // Old format — return URLs for async migration
          return parsed as string[];
        } else if (typeof parsed[0] === 'object' && parsed[0] !== null) {
          const map = new Map<string, Pattern>((parsed as Pattern[]).map((p) => [p.url, p]));
          this._favoritePatterns.set(map);
        }
      }
    } catch (error) {
      console.warn('Failed to parse saved favorite patterns:', error);
    }
    return [];
  }

  private loadBallsFromStorage(): string[] {
    if (typeof localStorage === 'undefined') return [];

    const savedBalls = localStorage.getItem('favoriteBalls');
    if (!savedBalls) return [];

    try {
      const parsed: unknown[] = JSON.parse(savedBalls);
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (typeof parsed[0] === 'string') {
          // Old format — return keys for async migration
          return parsed as string[];
        } else if (typeof parsed[0] === 'object' && parsed[0] !== null) {
          const map = new Map<string, Ball>((parsed as Ball[]).map((b) => [`${b.ball_id}-${b.core_weight}`, b]));
          this._favoriteBalls.set(map);
        }
      }
    } catch (error) {
      console.warn('Failed to parse saved favorite balls:', error);
    }
    return [];
  }

  private async migrateOldPatternFavorites(urls: string[]): Promise<void> {
    const results = await Promise.all(urls.map((url) => this.patternService.getPatternData(url)));
    const valid = results.filter((p) => !!p.url);
    this._favoritePatterns.set(new Map(valid.map((p) => [p.url, p])));
    this.saveFavoritesToStorage();
  }

  private async migrateOldBallFavorites(keys: string[]): Promise<void> {
    // Old keys are "ballId-coreWeight". Group by weight to minimise API calls.
    const weightGroups = new Map<number, string[]>();
    for (const key of keys) {
      const lastDash = key.lastIndexOf('-');
      if (lastDash === -1) continue;
      const weight = parseInt(key.slice(lastDash + 1), 10);
      if (isNaN(weight)) continue;
      const ballId = key.slice(0, lastDash);
      if (!weightGroups.has(weight)) weightGroups.set(weight, []);
      weightGroups.get(weight)!.push(ballId);
    }

    const matched: Ball[] = [];
    for (const [weight, ballIds] of weightGroups) {
      try {
        const balls = await this.ballService.getBallsByWeight(weight);
        const idSet = new Set(ballIds);
        matched.push(...balls.filter((b) => idSet.has(b.ball_id)));
      } catch {
        // skip this weight group if the fetch fails
      }
    }

    if (matched.length > 0) {
      this._favoriteBalls.set(new Map(matched.map((b) => [`${b.ball_id}-${b.core_weight}`, b])));
      this.saveFavoritesToStorage();
    }
  }

  private saveFavoritesToStorage(): void {
    if (typeof localStorage !== 'undefined') {
      const patternsArray = Array.from(this._favoritePatterns().values());
      localStorage.setItem('favoritePatterns', JSON.stringify(patternsArray));

      const ballsArray = Array.from(this._favoriteBalls().values());
      localStorage.setItem('favoriteBalls', JSON.stringify(ballsArray));
    }
  }
}
