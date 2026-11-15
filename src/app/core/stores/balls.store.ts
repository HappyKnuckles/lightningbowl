import { computed, inject, Injectable, signal } from '@angular/core';

import { BOWWWL_URL } from 'src/app/core/constants/app.constants';
import { Ball, BallDrilling } from 'src/app/core/models/ball.model';
import { AnalyticsService } from 'src/app/core/services/analytics/analytics.service';
import { BallService } from 'src/app/core/services/ball/ball.service';
import { FavoritesService } from 'src/app/core/services/favorites/favorites.service';
import { NetworkService } from 'src/app/core/services/network/network.service';
import { STORAGE_PREFIX, StorageKeys } from 'src/app/core/services/storage/storage-keys';
import { StorageRepository } from 'src/app/core/services/storage/storage.repository';
import { ThrowBall } from 'src/app/core/models/game.model';
import { findBall, getThrowBallKey } from 'src/app/core/utils/game-utils/game-ball.utils';
import { ballKey, SavedBall, savedBeforeBallApi, toStoredBall } from 'src/app/core/utils/ball-utils/stored-ball.utils';
import { isInArsenal, newArsenalId, ownBallFields } from 'src/app/core/utils/ball-utils/arsenal-ball.utils';

/** Unique by ball and weight; earlier entries win. */
function uniqueBalls(balls: Ball[]): Ball[] {
  const byKey = new Map<string, Ball>();
  for (const ball of balls) {
    if (!byKey.has(ballKey(ball))) byKey.set(ballKey(ball), ball);
  }
  return [...byKey.values()];
}

const sameWeight = (a: number | string, b: number | string) => Number(a) === Number(b);

/** The catalog ball an arsenal ball is, without what the bowler added to it. */
function toCatalogBall(ball: Ball): Ball {
  const catalog = { ...ball };
  for (const field of Object.keys(ownBallFields(ball)) as (keyof Ball)[]) delete catalog[field];
  return catalog;
}

export interface AddToArsenalOptions {
  /** Add the ball even when the arsenal already has it in this weight (a second one of the same ball). */
  allowTwin?: boolean;
}

/**
 * Balls the app works with offline. There is no full catalog on the device:
 * the balls page searches the ball API, and everything else uses
 * `knownBalls`: the arsenal, favorites, and balls resolved on demand (balls
 * named in games, balls picked in pickers), which are persisted.
 */
@Injectable({ providedIn: 'root' })
export class BallsStore {
  readonly #storageRepository = inject(StorageRepository);

  readonly #ballService = inject(BallService);

  readonly #favoritesService = inject(FavoritesService);
  readonly #networkService = inject(NetworkService);
  readonly #analyticsService = inject(AnalyticsService);
  /** The bowler's balls. Each is one physical ball with its own `arsenalId`; the same ball can be in it twice. */
  readonly arsenal = signal<Ball[]>([]);
  readonly #cachedBalls = signal<Ball[]>([]);

  /**
   * The bowler's own balls, one per ball and weight: arsenal first, then favorites. Unlike `knownBalls` this
   * leaves out the cache, so a ball removed from the arsenal (which stays cached for old games) disappears here.
   */
  readonly myBalls = computed(() => uniqueBalls([...this.arsenal(), ...this.#favoritesService.favoriteBalls().values()]));

  /** Arsenal, favorites and cached balls, one entry per ball and weight. */
  readonly knownBalls = computed(() => uniqueBalls([...this.arsenal(), ...this.#favoritesService.favoriteBalls().values(), ...this.#cachedBalls()]));

  readonly url = BOWWWL_URL;
  #arsenalLoad: Promise<void> | null = null;

  // ----------------------------------------------------------- known balls

  async loadBallCache(): Promise<void> {
    try {
      const cached = await this.#storageRepository.get<SavedBall[]>(StorageKeys.ballCache);
      this.#cachedBalls.set((cached ?? []).map(toStoredBall));
    } catch (error) {
      console.error('Error loading ball cache:', error);
    }
  }

  /** Adds balls to the persisted cache (replacing older copies of the same ball and weight). */
  async rememberBalls(balls: Ball[]): Promise<void> {
    if (balls.length === 0) return;
    // the cache holds catalog balls: an arsenal ball's own data stays in the arsenal
    const merged = uniqueBalls([...balls.map(toCatalogBall), ...this.#cachedBalls()]);
    this.#cachedBalls.set(merged);
    try {
      await this.#storageRepository.set(StorageKeys.ballCache, merged);
    } catch (error) {
      console.error('Error saving ball cache:', error);
    }
  }

  /**
   * The known ball a game's ball is. Only balls with a weight resolve: a name alone doesn't say
   * which weight was thrown.
   */
  findKnownBall(ball: ThrowBall): Ball | undefined {
    return ball.weight ? findBall(ball, this.knownBalls()) : undefined;
  }

  /**
   * Resolves games' balls to catalog balls: known balls first, the rest from the ball API by name
   * when online. Resolved balls are remembered, so `findKnownBall` finds them, also offline
   * afterwards. Balls without a weight are left alone.
   */
  async resolveBallNames(balls: ThrowBall[]): Promise<void> {
    const unique = new Map(balls.filter((ball) => ball?.name && ball.weight).map((ball) => [getThrowBallKey(ball), ball]));
    const missing = [...unique.values()].filter((ball) => !this.findKnownBall(ball));

    if (missing.length > 0 && this.#networkService.isOnline) {
      try {
        const fetched = await this.#ballService.getBallsByNames([...new Set(missing.map((ball) => ball.name))]);
        // The API returns every weight; keep only the one each value names, so the cache never
        // holds a weight nobody threw.
        const meant = missing
          // the API may spell the name differently ("Phaze Ii"); games take its spelling on the next migration
          .map((ball) => this.#named(fetched, ball.name).find((b) => sameWeight(b.core_weight, ball.weight!)))
          .filter((ball): ball is Ball => ball !== undefined);
        await this.rememberBalls(meant);
      } catch (error) {
        console.error('Error resolving ball names:', error);
      }
    }
  }

  /** Re-fetches cached balls so their data stays current (pull-to-refresh). */
  async refreshKnownBalls(): Promise<void> {
    const cached = this.#cachedBalls();
    if (cached.length === 0 || this.#networkService.isOffline) return;
    const cachedKeys = new Set(cached.map(ballKey));
    // The API returns every weight of a ball; refresh only the weights that were cached.
    const fresh = (await this.#ballService.getBallsByIds([...new Set(cached.map((b) => b.ball_id))])).filter((b) => cachedKeys.has(ballKey(b)));
    const freshKeys = new Set(fresh.map(ballKey));
    // Keep cached variants the API no longer returns (e.g. removed upstream).
    await this.rememberBalls([...fresh, ...cached.filter((b) => !freshKeys.has(ballKey(b)))]);
  }

  /**
   * Re-fetches the arsenal and favorite balls from the ball API and saves the fresh copies, keeping the
   * arsenal's order and drilling. With `onlySavedBeforeBallApi`, only balls saved before the ball API are
   * fetched: their images still point at bowwwl.com and their `first_seen_at` is unknown.
   */
  async refreshSavedBalls(onlySavedBeforeBallApi = false): Promise<void> {
    if (this.#networkService.isOffline) return;
    const saved = this.myBalls().filter((ball) => !onlySavedBeforeBallApi || savedBeforeBallApi(ball));
    if (saved.length === 0) return;

    const wanted = new Set(saved.map(ballKey));
    // The API returns every weight of a ball; keep only the saved weights.
    const fresh = (await this.#ballService.getBallsByIds([...new Set(saved.map((b) => b.ball_id))])).filter((b) => wanted.has(ballKey(b)));
    if (fresh.length === 0) return;
    const freshByKey = new Map(fresh.map((ball) => [ballKey(ball), ball]));

    // the bowler's own data comes from the arsenal as it is now, so edits made meanwhile stay
    const refreshed: Ball[] = [];
    this.arsenal.update((balls) =>
      balls.map((ball) => {
        const update = freshByKey.get(ballKey(ball));
        if (!update || !ball.arsenalId) return ball;
        const merged: Ball = { ...update, ...ownBallFields(ball) };
        refreshed.push(merged);
        return merged;
      }),
    );
    await Promise.all(refreshed.map((ball) => this.#storageRepository.set(StorageKeys.arsenal(ball.arsenalId!), ball)));

    this.#favoritesService.updateFavoriteBalls(fresh);
  }

  #named(balls: Ball[], name: string): Ball[] {
    const wanted = name.trim().toLowerCase();
    return balls.filter((b) => b.ball_name.toLowerCase() === wanted);
  }

  // --------------------------------------------------------------- arsenal

  loadArsenal(): Promise<void> {
    // one load at a time: two at once would each give the same not yet migrated ball a different id
    this.#arsenalLoad ??= this.#loadArsenal().finally(() => (this.#arsenalLoad = null));
    return this.#arsenalLoad;
  }

  /** Replaces an arsenal ball's catalog data (e.g. another weight of it); it stays the same arsenal ball. */
  async updateArsenalBall(oldBall: Ball, newBall: Ball): Promise<void> {
    try {
      if (!oldBall.arsenalId) throw new Error('not an arsenal ball');
      // a copy, so the ball passed in (e.g. from a list) doesn't change
      const updated: Ball = { ...newBall, ...ownBallFields(oldBall) };
      await this.#storageRepository.set(StorageKeys.arsenal(oldBall.arsenalId), updated);
      this.arsenal.update((balls) => balls.map((b) => (b.arsenalId === oldBall.arsenalId ? updated : b)));
    } catch (error) {
      console.error('Error updating ball in arsenal:', error);
      throw error;
    }
  }

  async updateBallDrilling(ball: Ball, drilling: BallDrilling | undefined): Promise<void> {
    try {
      if (!ball.arsenalId) throw new Error('not an arsenal ball');
      const updated: Ball = { ...ball, drilling };
      await this.#storageRepository.set(StorageKeys.arsenal(ball.arsenalId), updated);
      this.arsenal.update((balls) => balls.map((b) => (b.arsenalId === ball.arsenalId ? updated : b)));
    } catch (error) {
      console.error('Error saving drilling:', error);
      throw error;
    }
  }

  async saveBallToArsenal(ball: Ball): Promise<Ball[]> {
    return this.saveBallsToArsenal([ball]);
  }

  /** Saves balls to the arsenal (see `addBallsToArsenal`) and returns the ones that couldn't be saved. */
  async saveBallsToArsenal(balls: Ball[], options: AddToArsenalOptions = {}): Promise<Ball[]> {
    return (await this.addBallsToArsenal(balls, options)).failed;
  }

  /**
   * Saves balls to the arsenal:
   * - an arsenal ball (it has an `arsenalId`) is updated;
   * - a catalog ball becomes a new arsenal ball, unless the arsenal already has that ball in that
   *   weight. Then it is left alone, or with `allowTwin` added as a second one.
   *
   * `added` are the new arsenal balls, with their ids.
   */
  async addBallsToArsenal(balls: Ball[], options: AddToArsenalOptions = {}): Promise<{ added: Ball[]; failed: Ball[] }> {
    const added: Ball[] = [];
    const updated: Ball[] = [];
    const failed: Ball[] = [];
    const taken = this.arsenal();

    await Promise.all(
      balls.map(async (ball) => {
        const isNew = !ball.arsenalId;
        if (isNew && !options.allowTwin && isInArsenal(ball, [...taken, ...added])) return;
        const entry: Ball = isNew ? { ...ball, arsenalId: newArsenalId() } : ball;
        // listed before the save, so the same ball twice in one call isn't added twice
        if (isNew) added.push(entry);
        try {
          await this.#storageRepository.set(StorageKeys.arsenal(entry.arsenalId!), entry);
          if (!isNew) updated.push(entry);
        } catch (error) {
          console.error(`Error saving ball ${ball.ball_name} to arsenal:`, error);
          if (isNew) added.splice(added.indexOf(entry), 1);
          failed.push(ball);
        }
      }),
    );

    if (added.length || updated.length) {
      const updatedById = new Map(updated.map((ball) => [ball.arsenalId, ball]));
      this.arsenal.update((existing) => [...existing.map((ball) => updatedById.get(ball.arsenalId) ?? ball), ...added]);
      added.forEach((ball) => this.#analyticsService.trackBallAdded({ brand: ball.brand_name ?? undefined, name: ball.ball_name }));
    }

    return { added, failed };
  }

  /**
   * Removes a ball from the arsenal: the arsenal ball itself, or for a catalog ball the arsenal's ball of
   * that model and weight (the last one added, when there are two). Returns the arsenal ball that was removed.
   * Games that used it keep pointing at it; `AppFacade.removeArsenalBall` also takes care of those.
   */
  async removeFromArsenal(ball: Ball): Promise<Ball | undefined> {
    try {
      const entry = ball.arsenalId
        ? this.arsenal().find((b) => b.arsenalId === ball.arsenalId)
        : [...this.arsenal()].reverse().find((b) => ballKey(b) === ballKey(ball));
      if (!entry?.arsenalId) return undefined;
      await this.#storageRepository.remove(StorageKeys.arsenal(entry.arsenalId));
      // Keep it resolvable (e.g. for games that used it) after leaving the arsenal.
      await this.rememberBalls([entry]);
      this.arsenal.update((balls) => balls.filter((b) => b.arsenalId !== entry.arsenalId));
      return entry;
    } catch (error) {
      console.error('Error removing ball from arsenal:', error);
      throw error;
    }
  }

  clearArsenal(): void {
    this.arsenal.set([]);
  }

  async #loadArsenal(): Promise<void> {
    try {
      const stored = (await this.#storageRepository.loadByPrefix<SavedBall>(STORAGE_PREFIX.arsenal)).map(toStoredBall);
      const arsenal = await this.#migrateArsenalIds(stored);
      const sortedArsenal = arsenal.sort((a, b) => (a.position || arsenal.length + 1) - (b.position || arsenal.length + 1));
      this.arsenal.set(sortedArsenal);
    } catch (error) {
      console.error('Error loading arsenal:', error);
      throw error;
    }
  }

  /**
   * Arsenal balls saved before they had their own id (stored one per ball and weight) get an id and
   * move to a key by that id. A ball that already moved but whose old record is still there (the
   * move was interrupted) is not added a second time.
   */
  async #migrateArsenalIds(stored: Ball[]): Promise<Ball[]> {
    const current = stored.filter((ball) => ball.arsenalId);
    const moved = new Set(current.map(ballKey));
    const legacy = stored.filter((ball) => !ball.arsenalId);
    const migrated = legacy.filter((ball) => !moved.has(ballKey(ball))).map((ball): Ball => ({ ...ball, arsenalId: newArsenalId() }));

    await Promise.all(migrated.map((ball) => this.#storageRepository.set(StorageKeys.arsenal(ball.arsenalId!), ball)));
    try {
      await Promise.all(legacy.map((ball) => this.#storageRepository.remove(StorageKeys.legacyArsenal(ball.ball_id, ball.core_weight))));
    } catch (error) {
      // the next load removes them
      console.error('Error removing migrated arsenal records:', error);
    }
    return [...current, ...migrated];
  }
}
