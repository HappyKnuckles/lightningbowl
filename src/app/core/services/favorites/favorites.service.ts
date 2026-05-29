import { Injectable, signal, Signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class FavoritesService {
  private _favoritePatterns = signal<Set<string>>(new Set());
  private _favoriteBalls = signal<Set<string>>(new Set());
  readonly favoritePatterns: Signal<Set<string>> = this._favoritePatterns;
  readonly favoriteBalls: Signal<Set<string>> = this._favoriteBalls;

  constructor() {
    this.loadFavoritesFromStorage();
  }

  private loadFavoritesFromStorage(): void {
    if (typeof localStorage !== 'undefined') {
      // Load favorite patterns
      const savedPatterns = localStorage.getItem('favoritePatterns');
      if (savedPatterns) {
        try {
          const favoritesArray: string[] = JSON.parse(savedPatterns);
          this._favoritePatterns.set(new Set(favoritesArray));
        } catch (error) {
          console.warn('Failed to parse saved favorite patterns:', error);
          this._favoritePatterns.set(new Set());
        }
      }

      // Load favorite balls
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
  }

  private saveFavoritesToStorage(): void {
    if (typeof localStorage !== 'undefined') {
      const patternFavoritesArray = Array.from(this._favoritePatterns());
      localStorage.setItem('favoritePatterns', JSON.stringify(patternFavoritesArray));

      const ballFavoritesArray = Array.from(this._favoriteBalls());
      localStorage.setItem('favoriteBalls', JSON.stringify(ballFavoritesArray));
    }
  }

  // Pattern methods
  isFavorite(patternUrl: string): boolean {
    return this._favoritePatterns().has(patternUrl);
  }

  toggleFavorite(patternUrl: string): boolean {
    const currentFavorites = new Set(this._favoritePatterns());
    let isFavorited: boolean;

    if (currentFavorites.has(patternUrl)) {
      currentFavorites.delete(patternUrl);
      isFavorited = false;
    } else {
      currentFavorites.add(patternUrl);
      isFavorited = true;
    }

    this._favoritePatterns.set(currentFavorites);
    this.saveFavoritesToStorage();

    return isFavorited;
  }

  addFavorite(patternUrl: string): void {
    const currentFavorites = new Set(this._favoritePatterns());
    currentFavorites.add(patternUrl);
    this._favoritePatterns.set(currentFavorites);
    this.saveFavoritesToStorage();
  }

  removeFavorite(patternUrl: string): void {
    const currentFavorites = new Set(this._favoritePatterns());
    currentFavorites.delete(patternUrl);
    this._favoritePatterns.set(currentFavorites);
    this.saveFavoritesToStorage();
  }

  getFavoritePatternUrls(): string[] {
    return Array.from(this._favoritePatterns());
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
}
