import { computed, inject, Injectable, signal, Signal, WritableSignal } from '@angular/core';
import { Ball } from '../../models/ball.model';
import { Pattern } from '../../models/pattern.model';
import { BowlersStore } from '../../stores/bowlers.store';
import { BallService } from '../ball/ball.service';
import { PatternService } from '../pattern/pattern.service';

/**
 * Sentinel bucket for favorites saved before multi-bowler support; resolved as
 * the default bowler's favorites until first written back.
 */
const LEGACY_BUCKET = '';

type FavoritesByBowler<T> = Record<string, T[]>;

@Injectable({
  providedIn: 'root',
})
export class FavoritesService {
  private patternService = inject(PatternService);
  private ballService = inject(BallService);
  private bowlersStore = inject(BowlersStore);

  private _patternsByBowler = signal<FavoritesByBowler<Pattern>>({});
  private _ballsByBowler = signal<FavoritesByBowler<Ball>>({});

  // Favorites of the active bowler.
  readonly favoritePatterns: Signal<Map<string, Pattern>> = computed(() => {
    return new Map(this.resolveBucket(this._patternsByBowler()).map((pattern) => [pattern.url, pattern]));
  });

  readonly favoriteBalls: Signal<Map<string, Ball>> = computed(() => {
    return new Map(this.resolveBucket(this._ballsByBowler()).map((ball) => [`${ball.ball_id}-${ball.core_weight}`, ball]));
  });

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
    return this.favoritePatterns().has(patternUrl);
  }

  toggleFavorite(pattern: Pattern): boolean {
    const isFavorited = !this.isFavorite(pattern.url);
    if (isFavorited) {
      this.addFavorite(pattern);
    } else {
      this.removeFavorite(pattern.url);
    }
    return isFavorited;
  }

  addFavorite(pattern: Pattern): void {
    this.updateActiveBucket(this._patternsByBowler, (patterns) => [...patterns.filter((p) => p.url !== pattern.url), pattern]);
    this.saveFavoritesToStorage();
  }

  removeFavorite(patternUrl: string): void {
    this.updateActiveBucket(this._patternsByBowler, (patterns) => patterns.filter((p) => p.url !== patternUrl));
    this.saveFavoritesToStorage();
  }

  getFavoritePatternUrls(): string[] {
    return Array.from(this.favoritePatterns().keys());
  }

  getFavoritePatterns(): Pattern[] {
    return Array.from(this.favoritePatterns().values());
  }

  // Ball methods
  isBallFavorite(ballId: string, coreWeight: string): boolean {
    return this.favoriteBalls().has(`${ballId}-${coreWeight}`);
  }

  toggleBallFavorite(ball: Ball): boolean {
    const isFavorited = !this.isBallFavorite(ball.ball_id, ball.core_weight);
    if (isFavorited) {
      this.addBallFavorite(ball);
    } else {
      this.removeBallFavorite(ball.ball_id, ball.core_weight);
    }
    return isFavorited;
  }

  addBallFavorite(ball: Ball): void {
    const key = `${ball.ball_id}-${ball.core_weight}`;
    this.updateActiveBucket(this._ballsByBowler, (balls) => [...balls.filter((b) => `${b.ball_id}-${b.core_weight}` !== key), ball]);
    this.saveFavoritesToStorage();
  }

  removeBallFavorite(ballId: string, coreWeight: string): void {
    const key = `${ballId}-${coreWeight}`;
    this.updateActiveBucket(this._ballsByBowler, (balls) => balls.filter((b) => `${b.ball_id}-${b.core_weight}` !== key));
    this.saveFavoritesToStorage();
  }

  getFavoriteBallKeys(): string[] {
    return Array.from(this.favoriteBalls().keys());
  }

  getFavoriteBalls(): Ball[] {
    return Array.from(this.favoriteBalls().values());
  }

  /** Drops (or reassigns) a deleted bowler's favorites. */
  removeBowler(bowlerId: string, reassignToBowlerId?: string): void {
    const strip = <T>(byBowler: FavoritesByBowler<T>): FavoritesByBowler<T> => {
      if (!(bowlerId in byBowler)) {
        return byBowler;
      }
      const { [bowlerId]: removed, ...rest } = byBowler;
      if (reassignToBowlerId) {
        const existing = rest[reassignToBowlerId] ?? [];
        rest[reassignToBowlerId] = [...existing, ...removed];
      }
      return rest;
    };
    this._patternsByBowler.update((byBowler) => strip(byBowler));
    this._ballsByBowler.update((byBowler) => strip(byBowler));
    this.saveFavoritesToStorage();
  }

  /** Returns the active bowler's list, falling back to the legacy bucket for the default bowler. */
  private resolveBucket<T>(byBowler: FavoritesByBowler<T>): T[] {
    const activeId = this.bowlersStore.activeBowlerId();
    if (byBowler[activeId]) {
      return byBowler[activeId];
    }
    if (activeId && activeId === this.bowlersStore.defaultBowlerId()) {
      return byBowler[LEGACY_BUCKET] ?? [];
    }
    return [];
  }

  private updateActiveBucket<T>(target: WritableSignal<FavoritesByBowler<T>>, updater: (items: T[]) => T[]): void {
    const activeId = this.bowlersStore.activeBowlerId();
    if (!activeId) {
      return;
    }
    target.update((byBowler) => {
      const current = byBowler[activeId] ?? (activeId === this.bowlersStore.defaultBowlerId() ? (byBowler[LEGACY_BUCKET] ?? []) : []);
      const next: FavoritesByBowler<T> = { ...byBowler, [activeId]: updater(current) };
      // The legacy bucket is folded into the default bowler's entry on first write.
      if (activeId === this.bowlersStore.defaultBowlerId()) {
        delete next[LEGACY_BUCKET];
      }
      return next;
    });
  }

  private loadPatternsFromStorage(): string[] {
    if (typeof localStorage === 'undefined') return [];

    const savedPatterns = localStorage.getItem('favoritePatterns');
    if (!savedPatterns) return [];

    try {
      const parsed: unknown = JSON.parse(savedPatterns);
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (typeof parsed[0] === 'string') {
          // Old format — return URLs for async migration
          return parsed as string[];
        } else if (typeof parsed[0] === 'object' && parsed[0] !== null) {
          this._patternsByBowler.set({ [LEGACY_BUCKET]: parsed as Pattern[] });
        }
      } else if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        this._patternsByBowler.set(parsed as FavoritesByBowler<Pattern>);
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
      const parsed: unknown = JSON.parse(savedBalls);
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (typeof parsed[0] === 'string') {
          // Old format — return keys for async migration
          return parsed as string[];
        } else if (typeof parsed[0] === 'object' && parsed[0] !== null) {
          this._ballsByBowler.set({ [LEGACY_BUCKET]: parsed as Ball[] });
        }
      } else if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        this._ballsByBowler.set(parsed as FavoritesByBowler<Ball>);
      }
    } catch (error) {
      console.warn('Failed to parse saved favorite balls:', error);
    }
    return [];
  }

  private async migrateOldPatternFavorites(urls: string[]): Promise<void> {
    const results = await Promise.all(urls.map((url) => this.patternService.getPatternData(url)));
    const valid = results.filter((p) => !!p.url);
    this._patternsByBowler.set({ [LEGACY_BUCKET]: valid });
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
      this._ballsByBowler.set({ [LEGACY_BUCKET]: matched });
      this.saveFavoritesToStorage();
    }
  }

  private saveFavoritesToStorage(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('favoritePatterns', JSON.stringify(this._patternsByBowler()));
      localStorage.setItem('favoriteBalls', JSON.stringify(this._ballsByBowler()));
    }
  }
}
