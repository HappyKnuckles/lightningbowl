import { inject, Injectable, signal, Signal } from '@angular/core';
import { Pattern } from '../../models/pattern.model';
import { PatternService } from '../pattern/pattern.service';

@Injectable({
  providedIn: 'root',
})
export class FavoritesService {
  private patternService = inject(PatternService);
  private _favoritePatterns = signal<Map<string, Pattern>>(new Map());
  private _favoriteBalls = signal<Set<string>>(new Set());
  readonly favoritePatterns: Signal<Map<string, Pattern>> = this._favoritePatterns;
  readonly favoriteBalls: Signal<Set<string>> = this._favoriteBalls;

  constructor() {
    const urlsToMigrate = this.loadFavoritesFromStorage();
    if (urlsToMigrate.length > 0) {
      void this.migrateOldFavorites(urlsToMigrate);
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

  toggleBallFavorite(ballId: string, coreWeight: string): boolean {
    const ballKey = `${ballId}-${coreWeight}`;
    const currentFavorites = new Set(this._favoriteBalls());
    let isFavorited: boolean;

    if (currentFavorites.has(ballKey)) {
      currentFavorites.delete(ballKey);
      isFavorited = false;
    } else {
      currentFavorites.add(ballKey);
      isFavorited = true;
    }

    this._favoriteBalls.set(currentFavorites);
    this.saveFavoritesToStorage();

    return isFavorited;
  }

  addBallFavorite(ballId: string, coreWeight: string): void {
    const ballKey = `${ballId}-${coreWeight}`;
    const currentFavorites = new Set(this._favoriteBalls());
    currentFavorites.add(ballKey);
    this._favoriteBalls.set(currentFavorites);
    this.saveFavoritesToStorage();
  }

  removeBallFavorite(ballId: string, coreWeight: string): void {
    const ballKey = `${ballId}-${coreWeight}`;
    const currentFavorites = new Set(this._favoriteBalls());
    currentFavorites.delete(ballKey);
    this._favoriteBalls.set(currentFavorites);
    this.saveFavoritesToStorage();
  }

  getFavoriteBallKeys(): string[] {
    return Array.from(this._favoriteBalls());
  }

  private loadFavoritesFromStorage(): string[] {
    if (typeof localStorage !== 'undefined') {
      // Load favorite patterns
      const savedPatterns = localStorage.getItem('favoritePatterns');
      if (savedPatterns) {
        try {
          const parsed: unknown[] = JSON.parse(savedPatterns);
          if (Array.isArray(parsed) && parsed.length > 0) {
            if (typeof parsed[0] === 'string') {
              // Old format — return URLs for async migration
              this._favoritePatterns.set(new Map());

              // Load balls before returning
              this.loadBallsFromStorage();
              return parsed as string[];
            } else if (typeof parsed[0] === 'object' && parsed[0] !== null) {
              const map = new Map<string, Pattern>((parsed as Pattern[]).map((p) => [p.url, p]));
              this._favoritePatterns.set(map);
            }
          }
        } catch (error) {
          console.warn('Failed to parse saved favorite patterns:', error);
          this._favoritePatterns.set(new Map());
        }
      }

      this.loadBallsFromStorage();
    }
    return [];
  }

  private loadBallsFromStorage(): void {
    const savedBalls = localStorage.getItem('favoriteBalls');
    if (savedBalls) {
      try {
        const favoritesArray: string[] = JSON.parse(savedBalls);
        this._favoriteBalls.set(new Set(favoritesArray));
      } catch (error) {
        console.warn('Failed to parse saved favorite balls:', error);
        this._favoriteBalls.set(new Set());
      }
    }
  }

  private async migrateOldFavorites(urls: string[]): Promise<void> {
    const results = await Promise.all(urls.map((url) => this.patternService.getPatternData(url)));
    const valid = results.filter((p) => !!p.url);
    this._favoritePatterns.set(new Map(valid.map((p) => [p.url, p])));
    this.saveFavoritesToStorage();
  }

  private saveFavoritesToStorage(): void {
    if (typeof localStorage !== 'undefined') {
      const patternsArray = Array.from(this._favoritePatterns().values());
      localStorage.setItem('favoritePatterns', JSON.stringify(patternsArray));

      const ballFavoritesArray = Array.from(this._favoriteBalls());
      localStorage.setItem('favoriteBalls', JSON.stringify(ballFavoritesArray));
    }
  }
}
