import { computed, inject, Injectable, Signal, signal } from '@angular/core';
import { Alley } from '../../models/alley.model';
import { BowlersStore } from '../../stores/bowlers.store';

const FAVORITES_KEY = 'favoriteAlleys';
const RECENTS_KEY = 'recentAlleys';
const MAX_RECENTS = 10;

/** Bucket for favorites saved before multi-bowler support (default bowler's). */
const LEGACY_BUCKET = '';

@Injectable({ providedIn: 'root' })
export class AlleyFavoritesService {
  private bowlersStore = inject(BowlersStore);
  private _favoritesByBowler = signal<Record<string, Alley[]>>({});
  // Recents are a device-level convenience and stay shared between bowlers.
  private _recents = signal<Alley[]>([]);

  // Favorite alleys of the active bowler.
  readonly favorites: Signal<Map<string, Alley>> = computed(() => {
    return new Map(this.resolveBucket().map((alley) => [alley.id, alley]));
  });
  readonly recents: Signal<Alley[]> = this._recents;

  constructor() {
    this.loadFromStorage();
  }

  isFavorite(alleyId: string): boolean {
    return this.favorites().has(alleyId);
  }

  toggleFavorite(alley: Alley): boolean {
    const activeId = this.bowlersStore.activeBowlerId();
    if (!activeId) {
      return false;
    }
    const isFavorited = !this.isFavorite(alley.id);
    this._favoritesByBowler.update((byBowler) => {
      const current = byBowler[activeId] ?? (activeId === this.bowlersStore.defaultBowlerId() ? (byBowler[LEGACY_BUCKET] ?? []) : []);
      const updated = isFavorited ? [...current, alley] : current.filter((a) => a.id !== alley.id);
      const next = { ...byBowler, [activeId]: updated };
      if (activeId === this.bowlersStore.defaultBowlerId()) {
        delete next[LEGACY_BUCKET];
      }
      return next;
    });
    this.persistFavorites();
    return isFavorited;
  }

  addRecent(alley: Alley): void {
    const recents = [alley, ...this._recents().filter((r) => r.id !== alley.id)].slice(0, MAX_RECENTS);
    this._recents.set(recents);
    this.save(RECENTS_KEY, recents);
  }

  /** Drops (or reassigns) a deleted bowler's favorite alleys. */
  removeBowler(bowlerId: string, reassignToBowlerId?: string): void {
    this._favoritesByBowler.update((byBowler) => {
      if (!(bowlerId in byBowler)) {
        return byBowler;
      }
      const { [bowlerId]: removed, ...rest } = byBowler;
      if (reassignToBowlerId) {
        const existing = rest[reassignToBowlerId] ?? [];
        const merged = [...existing];
        for (const alley of removed) {
          if (!merged.some((a) => a.id === alley.id)) {
            merged.push(alley);
          }
        }
        rest[reassignToBowlerId] = merged;
      }
      return rest;
    });
    this.persistFavorites();
  }

  private resolveBucket(): Alley[] {
    const byBowler = this._favoritesByBowler();
    const activeId = this.bowlersStore.activeBowlerId();
    if (byBowler[activeId]) {
      return byBowler[activeId];
    }
    if (activeId && activeId === this.bowlersStore.defaultBowlerId()) {
      return byBowler[LEGACY_BUCKET] ?? [];
    }
    return [];
  }

  private loadFromStorage(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      const favorites: unknown = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? '[]');
      if (Array.isArray(favorites)) {
        // Legacy format: a flat list belonging to the default bowler.
        if (favorites.length > 0) {
          this._favoritesByBowler.set({ [LEGACY_BUCKET]: favorites as Alley[] });
        }
      } else if (favorites && typeof favorites === 'object') {
        this._favoritesByBowler.set(favorites as Record<string, Alley[]>);
      }
      const recents: Alley[] = JSON.parse(localStorage.getItem(RECENTS_KEY) ?? '[]');
      this._recents.set(recents);
    } catch (error) {
      console.warn('Failed to parse saved alleys:', error);
    }
  }

  private persistFavorites(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(this._favoritesByBowler()));
    }
  }

  private save(key: string, value: Alley[]): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }
}
