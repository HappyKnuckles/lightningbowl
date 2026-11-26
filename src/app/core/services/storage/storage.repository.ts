import { Injectable, NgZone } from '@angular/core';
import { Storage } from '@ionic/storage-angular';
import { STORAGE_PREFIX } from './storage-keys';

@Injectable({ providedIn: 'root' })
export class StorageRepository {
  #scanInflight: Promise<Map<string, unknown[]>> | null = null;

  constructor(
    private storage: Storage,
    private ngZone: NgZone,
  ) {}

  async create(): Promise<void> {
    await this.storage.create();
  }

  async get<T>(key: string): Promise<T | null> {
    return this.storage.get(key);
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.storage.set(key, value);
  }

  async remove(key: string): Promise<void> {
    await this.storage.remove(key);
  }

  async forEach(callback: (value: unknown, key: string) => void): Promise<void> {
    await this.storage.forEach(callback);
  }

  async loadByPrefix<T>(prefix: string): Promise<T[]> {
    const knownPrefixes = Object.values(STORAGE_PREFIX) as string[];
    if (!knownPrefixes.includes(prefix)) {
      return this.scanSinglePrefix<T>(prefix);
    }

    const buckets = await this.scanAll(knownPrefixes);
    return (buckets.get(prefix) ?? []) as T[];
  }

  private scanAll(prefixes: string[]): Promise<Map<string, unknown[]>> {
    if (this.#scanInflight) {
      return this.#scanInflight;
    }

    const scan = (async () => {
      const buckets = new Map<string, unknown[]>(prefixes.map((prefix) => [prefix, []]));
      await this.scanOutsideAngular((value, key) => {
        for (const prefix of prefixes) {
          if (key.startsWith(prefix)) {
            buckets.get(prefix)!.push(value);
          }
        }
      });
      return buckets;
    })().finally(() => {
      this.#scanInflight = null;
    });

    this.#scanInflight = scan;
    return scan;
  }

  private async scanSinglePrefix<T>(prefix: string): Promise<T[]> {
    const data: T[] = [];
    await this.scanOutsideAngular((value, key) => {
      if (key.startsWith(prefix)) {
        data.push(value as T);
      }
    });
    return data;
  }

  async clear(): Promise<void> {
    await this.storage.clear();
  }

  /**
   * Walks every stored entry outside Angular's zone. Each IndexedDB cursor step is its own event, and inside the
   * zone every one of them ran app-wide change detection: ~2,000 runs while loading 2,000 games. The callbacks only
   * collect values; awaiting the result re-enters the zone once.
   */
  private scanOutsideAngular(callback: (value: unknown, key: string) => void): Promise<void> {
    return this.ngZone.runOutsideAngular(() => this.storage.forEach(callback));
  }
}
