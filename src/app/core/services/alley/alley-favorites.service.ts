import { Injectable, Signal, signal } from '@angular/core';

import { Alley } from '../../models/alley.model';

const FAVORITES_KEY = 'favoriteAlleys';
const RECENTS_KEY = 'recentAlleys';
const MAX_RECENTS = 10;

@Injectable({ providedIn: 'root' })
export class AlleyFavoritesService {
  private _favorites = signal<Map<string, Alley>>(new Map());
  private _recents = signal<Alley[]>([]);
  readonly favorites: Signal<Map<string, Alley>> = this._favorites;
  readonly recents: Signal<Alley[]> = this._recents;

  constructor() {
    this.loadFromStorage();
  }

  isFavorite(alleyId: string): boolean {
    return this._favorites().has(alleyId);
  }

  toggleFavorite(alley: Alley): boolean {
    const favorites = new Map(this._favorites());
    let isFavorited: boolean;
    if (favorites.has(alley.id)) {
      favorites.delete(alley.id);
      isFavorited = false;
    } else {
      favorites.set(alley.id, alley);
      isFavorited = true;
    }
    this._favorites.set(favorites);
    this.save(FAVORITES_KEY, Array.from(favorites.values()));
    return isFavorited;
  }

  addRecent(alley: Alley): void {
    const recents = [alley, ...this._recents().filter((r) => r.id !== alley.id)].slice(0, MAX_RECENTS);
    this._recents.set(recents);
    this.save(RECENTS_KEY, recents);
  }

  private loadFromStorage(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      const favorites: Alley[] = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? '[]');
      this._favorites.set(new Map(favorites.map((a) => [a.id, a])));
      const recents: Alley[] = JSON.parse(localStorage.getItem(RECENTS_KEY) ?? '[]');
      this._recents.set(recents);
    } catch (error) {
      console.warn('Failed to parse saved alleys:', error);
    }
  }

  private save(key: string, value: Alley[]): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }
}
