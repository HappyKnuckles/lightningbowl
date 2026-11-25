import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { Pattern, PatternSummary } from 'src/app/core/models/pattern.model';
import { CacheService } from 'src/app/core/services/cache/cache.service';
import { NetworkService } from 'src/app/core/services/network/network.service';
import { PatternService } from 'src/app/core/services/pattern/pattern.service';
import { StorageKeys } from 'src/app/core/services/storage/storage-keys';
import { StorageRepository } from 'src/app/core/services/storage/storage.repository';
import { countPatternUsage, rankByUsage } from 'src/app/core/utils/game-utils/usage.utils';
import { isResolvedPattern, patternTitleKey, titleOnlyPattern, toPatternSummary } from 'src/app/core/utils/pattern-utils/known-pattern.utils';
import { GamesStore } from './games.store';

/** Parallel API searches while resolving the patterns named in games. */
const RESOLVE_CONCURRENCY = 4;

/** Caches of the full pattern list and chart map, which the app no longer loads. */
const LEGACY_CACHE_KEYS = ['all_patterns', 'pattern_image_map'];

/**
 * Patterns the app works with offline. There is no full catalog on the device: the pattern page and
 * the pickers page through the pattern API, and everything else uses the known patterns: patterns
 * picked in pickers and patterns named in games (resolved on demand), which are persisted.
 */
@Injectable({ providedIn: 'root' })
export class PatternsStore {
  readonly #storageRepository = inject(StorageRepository);
  readonly #patternService = inject(PatternService);
  readonly #networkService = inject(NetworkService);
  readonly #cacheService = inject(CacheService);
  readonly #gamesStore = inject(GamesStore);

  readonly #known = signal<PatternSummary[]>([]);
  readonly #knownByTitle = computed(() => new Map(this.#known().map((pattern) => [patternTitleKey(pattern.title), pattern])));

  /** Titles of the patterns played in games, most played first (ties: most recently played). */
  readonly #playedTitles = computed(() => {
    const usage = countPatternUsage(this.#gamesStore.games());
    return rankByUsage([...usage.keys()], usage, (title) => title);
  });

  /**
   * The bowler's patterns for pickers and suggestions: the ones played in games, most played first, then
   * the other known ones (e.g. just picked for a game not saved yet). A played pattern that isn't resolved
   * yet comes as its title alone.
   */
  readonly myPatterns = computed<Partial<Pattern>[]>(() => {
    const known = this.#knownByTitle();
    const played = this.#playedTitles().map((title) => known.get(patternTitleKey(title)) ?? titleOnlyPattern(title));
    const playedKeys = new Set(played.map((pattern) => patternTitleKey(pattern.title!)));
    return [...played, ...this.#known().filter((pattern) => !playedKeys.has(patternTitleKey(pattern.title)))];
  });

  /** Chart image per title, for the known patterns. */
  readonly patternImageMap = computed<Record<string, string>>(() =>
    Object.fromEntries(
      this.#known()
        .filter((pattern) => pattern.chart_standard)
        .map((pattern) => [pattern.title, pattern.chart_standard]),
    ),
  );

  readonly #loaded = signal(false);

  /** Titles searched on the API since the app was last online, found or not, so they aren't searched again. */
  readonly #searched = new Set<string>();

  constructor() {
    // Resolve the patterns named in games once loaded, again when games name new ones, and after reconnecting.
    effect(() => {
      if (!this.#loaded()) return;
      const titles = this.#playedTitles();
      if (this.#networkService.isOffline) {
        this.#searched.clear();
        return;
      }
      untracked(() => void this.resolvePatternTitles(titles));
    });
  }

  async loadPatternCache(): Promise<void> {
    try {
      const cached = await this.#storageRepository.get<PatternSummary[]>(StorageKeys.patternCache);
      this.#known.set(cached ?? []);
      await Promise.all(LEGACY_CACHE_KEYS.map((key) => this.#cacheService.delete(key)));
    } catch (error) {
      console.error('Error loading pattern cache:', error);
    } finally {
      this.#loaded.set(true);
    }
  }

  /**
   * Adds patterns to the persisted known patterns (replacing older copies of the same title), without
   * their oil rows. Patterns that are only a title (not resolved yet) are skipped.
   */
  async rememberPatterns(patterns: readonly Partial<Pattern>[]): Promise<void> {
    const fresh = patterns.filter(isResolvedPattern).map(toPatternSummary);
    if (fresh.length === 0) return;
    const freshKeys = new Set(fresh.map((pattern) => patternTitleKey(pattern.title)));
    const merged = [...fresh, ...this.#known().filter((pattern) => !freshKeys.has(patternTitleKey(pattern.title)))];
    this.#known.set(merged);
    try {
      await this.#storageRepository.set(StorageKeys.patternCache, merged);
    } catch (error) {
      console.error('Error saving pattern cache:', error);
    }
  }

  /**
   * Looks up titles that aren't known yet on the pattern API (exact title) and remembers what it finds,
   * so pickers and charts have them, also offline afterwards. Each title is searched once while online.
   */
  async resolvePatternTitles(titles: readonly string[]): Promise<void> {
    if (this.#networkService.isOffline) return;
    const known = this.#knownByTitle();
    const missing = [...new Set(titles.filter((title) => title?.trim()))].filter(
      (title) => !known.has(patternTitleKey(title)) && !this.#searched.has(patternTitleKey(title)),
    );
    if (missing.length === 0) return;
    missing.forEach((title) => this.#searched.add(patternTitleKey(title)));

    const found: PatternSummary[] = [];
    let next = 0;
    const worker = async () => {
      while (next < missing.length) {
        const pattern = await this.#patternService.findPatternByTitle(missing[next++]);
        if (pattern) found.push(pattern);
      }
    };
    await Promise.all(Array.from({ length: Math.min(RESOLVE_CONCURRENCY, missing.length) }, worker));
    await this.rememberPatterns(found);
  }
}
