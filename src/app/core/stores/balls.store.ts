import { computed, inject, Injectable, signal } from '@angular/core';

import { BOWWWL_URL } from 'src/app/core/constants/app.constants';
import { Ball, BallDrilling } from 'src/app/core/models/ball.model';
import { AnalyticsService } from 'src/app/core/services/analytics/analytics.service';
import { BallService } from 'src/app/core/services/ball/ball.service';
import { FavoritesService } from 'src/app/core/services/favorites/favorites.service';
import { NetworkService } from 'src/app/core/services/network/network.service';
import { STORAGE_PREFIX, StorageKeys } from 'src/app/core/services/storage/storage-keys';
import { StorageRepository } from 'src/app/core/services/storage/storage.repository';
import { ballKey, formatStoredBall, parseStoredBall, toStoredBall } from 'src/app/core/utils/ball-utils/stored-ball.utils';

/** Unique by ball and weight; earlier entries win. */
function uniqueBalls(balls: Ball[]): Ball[] {
  const byKey = new Map<string, Ball>();
  for (const ball of balls) {
    if (!byKey.has(ballKey(ball))) byKey.set(ballKey(ball), ball);
  }
  return [...byKey.values()];
}

const sameWeight = (a: number | string, b: number | string) => Number(a) === Number(b);

/**
 * The weight a name alone most likely means, from variants of one ball: the variant in the
 * arsenal, then the preferred weight, then the weight most of the arsenal has, then the heaviest.
 */
export function pickVariant(
  variants: Ball[],
  preferredWeight?: number | string,
  arsenal: Pick<Ball, 'ball_id' | 'core_weight'>[] = [],
): Ball | undefined {
  const owned = variants.find((variant) =>
    arsenal.some((ball) => ball.ball_id === variant.ball_id && sameWeight(ball.core_weight, variant.core_weight)),
  );
  if (owned) return owned;
  for (const weight of [preferredWeight, usualWeight(arsenal)]) {
    const match = weight === undefined ? undefined : variants.find((b) => sameWeight(b.core_weight, weight));
    if (match) return match;
  }
  return [...variants].sort((a, b) => Number(b.core_weight) - Number(a.core_weight))[0];
}

/** The weight most balls in the arsenal have (the heavier one on a tie). */
function usualWeight(arsenal: Pick<Ball, 'core_weight'>[]): string | undefined {
  const counts = new Map<number, number>();
  for (const { core_weight } of arsenal) {
    const weight = Number(core_weight);
    if (Number.isFinite(weight)) counts.set(weight, (counts.get(weight) ?? 0) + 1);
  }
  const [best] = [...counts].sort(([weightA, countA], [weightB, countB]) => countB - countA || weightB - weightA);
  return best ? String(best[0]) : undefined;
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
  readonly arsenal = signal<Ball[]>([]);
  readonly #cachedBalls = signal<Ball[]>([]);

  /**
   * The bowler's own balls for pickers: arsenal first, then favorites. Unlike `knownBalls` this leaves out
   * the cache, so a ball removed from the arsenal (which stays cached for old games) disappears here.
   */
  readonly myBalls = computed(() => uniqueBalls([...this.arsenal(), ...this.#favoritesService.favoriteBalls().values()]));

  /** Arsenal, favorites and cached balls, one entry per ball and weight. */
  readonly knownBalls = computed(() => uniqueBalls([...this.arsenal(), ...this.#favoritesService.favoriteBalls().values(), ...this.#cachedBalls()]));

  readonly url = BOWWWL_URL;

  // ----------------------------------------------------------- known balls

  async loadBallCache(): Promise<void> {
    try {
      const cached = await this.#storageRepository.get<Ball[]>(StorageKeys.ballCache);
      this.#cachedBalls.set((cached ?? []).map(toStoredBall));
    } catch (error) {
      console.error('Error loading ball cache:', error);
    }
  }

  /** Adds balls to the persisted cache (replacing older copies of the same ball and weight). */
  async rememberBalls(balls: Ball[]): Promise<void> {
    if (balls.length === 0) return;
    const merged = uniqueBalls([...balls, ...this.#cachedBalls()]);
    this.#cachedBalls.set(merged);
    try {
      await this.#storageRepository.set(StorageKeys.ballCache, merged);
    } catch (error) {
      console.error('Error saving ball cache:', error);
    }
  }

  /**
   * A known ball by name (case-insensitive), preferring the given weight. Also
   * accepts names with the weight appended ("Phaze II15", "Phaze II 15lbs"),
   * as games store them; that weight then wins over `preferredWeight`.
   */
  findKnownBall(name: string, preferredWeight?: number | string): Ball | undefined {
    const byName = (ballName: string) => this.knownBalls().filter((b) => b.ball_name.toLowerCase() === ballName.toLowerCase());
    const exact = byName(name.trim());
    if (exact.length > 0) return this.pickVariant(exact, preferredWeight);

    const parsed = parseStoredBall(name);
    if (!parsed.weight) return undefined;
    // the stored weight is what was thrown: no other weight stands in for it
    return byName(parsed.name).find((b) => sameWeight(b.core_weight, parsed.weight!));
  }

  /** Which of a ball's weights a bare name means; see `pickVariant`. */
  pickVariant(variants: Ball[], preferredWeight?: number | string): Ball | undefined {
    return pickVariant(variants, preferredWeight, this.arsenal());
  }

  /**
   * How to show a ball stored in a game: "Name 15lbs" when a weight was
   * stored with it, else the plain name, plus the matching known ball (for
   * its image), if any.
   */
  describeStoredBall(value: string): { label: string; ball: Ball | undefined } {
    const ball = this.findKnownBall(value);
    const isPlainName = ball?.ball_name.toLowerCase() === value.trim().toLowerCase();
    return { label: isPlainName ? value.trim() : formatStoredBall(parseStoredBall(value)), ball };
  }

  /**
   * Resolves ball names (as stored in games) to balls: known balls first, the
   * rest from the ball API by exact name when online. Resolved balls are
   * remembered, so this works offline afterwards. Keys are lower-cased names.
   */
  async resolveBallNames(names: string[], preferredWeight?: number | string): Promise<Map<string, Ball>> {
    const result = new Map<string, Ball>();
    const missing: string[] = [];
    for (const name of new Set(names.filter(Boolean))) {
      const known = this.findKnownBall(name, preferredWeight);
      if (known) result.set(name.toLowerCase(), known);
      else missing.push(name);
    }

    if (missing.length > 0 && this.#networkService.isOnline) {
      try {
        // Values may carry a weight ("Phaze II15"); look up both the value and the bare name.
        const lookups = [...new Set(missing.flatMap((value) => [value, parseStoredBall(value).name]))];
        const fetched = await this.#ballService.getBallsByNames(lookups);
        // The API returns every weight; keep only the one each value means, so later lookups by
        // name can't pick up a weight nobody threw.
        const meant = missing.map((value) => this.#meantVariant(value, fetched, preferredWeight)).filter((ball): ball is Ball => ball !== undefined);
        await this.rememberBalls(meant);
        for (const name of missing) {
          const ball = this.findKnownBall(name, preferredWeight);
          if (ball) result.set(name.toLowerCase(), ball);
        }
      } catch (error) {
        console.error('Error resolving ball names:', error);
      }
    }
    return result;
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

  /** The fetched ball a stored value means: its own weight when it has one, else `pickVariant`. */
  #meantVariant(value: string, fetched: Ball[], preferredWeight?: number | string): Ball | undefined {
    const named = (name: string) => fetched.filter((b) => b.ball_name.toLowerCase() === name.trim().toLowerCase());
    const exact = named(value);
    if (exact.length > 0) return this.pickVariant(exact, preferredWeight);
    const parsed = parseStoredBall(value);
    return parsed.weight ? named(parsed.name).find((b) => sameWeight(b.core_weight, parsed.weight!)) : undefined;
  }

  // --------------------------------------------------------------- arsenal

  async loadArsenal(): Promise<void> {
    try {
      const arsenal = (await this.#storageRepository.loadByPrefix<Ball>(STORAGE_PREFIX.arsenal)).map(toStoredBall);
      const sortedArsenal = arsenal.sort((a, b) => (a.position || arsenal.length + 1) - (b.position || arsenal.length + 1));
      this.arsenal.set(sortedArsenal);
    } catch (error) {
      console.error('Error loading arsenal:', error);
      throw error;
    }
  }

  async updateArsenalBall(oldBall: Ball, newBall: Ball): Promise<void> {
    try {
      newBall.position = oldBall.position;
      newBall.drilling = oldBall.drilling;
      const oldKey = StorageKeys.arsenal(oldBall.ball_id, oldBall.core_weight);
      const newKey = StorageKeys.arsenal(newBall.ball_id, newBall.core_weight);
      await this.#storageRepository.remove(oldKey);
      await this.#storageRepository.set(newKey, newBall);
      this.arsenal.update((balls) => balls.map((b) => (b.ball_id === oldBall.ball_id && b.core_weight === oldBall.core_weight ? newBall : b)));
    } catch (error) {
      console.error('Error updating ball in arsenal:', error);
      throw error;
    }
  }

  async updateBallDrilling(ball: Ball, drilling: BallDrilling | undefined): Promise<void> {
    try {
      const updated: Ball = { ...ball, drilling };
      await this.#storageRepository.set(StorageKeys.arsenal(ball.ball_id, ball.core_weight), updated);
      this.arsenal.update((balls) => balls.map((b) => (b.ball_id === ball.ball_id && b.core_weight === ball.core_weight ? updated : b)));
    } catch (error) {
      console.error('Error saving drilling:', error);
      throw error;
    }
  }

  async saveBallToArsenal(ball: Ball): Promise<Ball[]> {
    return this.saveBallsToArsenal([ball]);
  }

  async saveBallsToArsenal(balls: Ball[]): Promise<Ball[]> {
    const saved: Ball[] = [];
    const failed: Ball[] = [];

    await Promise.all(
      balls.map(async (ball) => {
        try {
          const key = StorageKeys.arsenal(ball.ball_id, ball.core_weight);
          await this.#storageRepository.set(key, ball);
          saved.push(ball);
        } catch (error) {
          console.error(`Error saving ball ${ball.ball_name} to arsenal:`, error);
          failed.push(ball);
        }
      }),
    );

    if (saved.length) {
      this.arsenal.update((existing) => {
        const merged = [...existing];
        for (const ball of saved) {
          const isUnique = !merged.some((b) => b.ball_id === ball.ball_id && b.core_weight === ball.core_weight);
          if (isUnique) merged.push(ball);
        }
        return merged;
      });
      saved.forEach((ball) => this.#analyticsService.trackBallAdded({ brand: ball.brand_name ?? undefined, name: ball.ball_name }));
    }

    return failed;
  }

  async removeFromArsenal(ball: Ball): Promise<void> {
    try {
      const key = StorageKeys.arsenal(ball.ball_id, ball.core_weight);
      await this.#storageRepository.remove(`${STORAGE_PREFIX.arsenal}_${ball.ball_id}`);
      await this.#storageRepository.remove(key);
      // Keep it resolvable (e.g. for games that used it) after leaving the arsenal.
      await this.rememberBalls([ball]);
      this.arsenal.update((balls) => balls.filter((b) => !(b.ball_id === ball.ball_id && b.core_weight === ball.core_weight)));
    } catch (error) {
      console.error('Error removing ball from arsenal:', error);
      throw error;
    }
  }

  clearArsenal(): void {
    this.arsenal.set([]);
  }
}
