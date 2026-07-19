import { computed, Injectable, signal } from '@angular/core';
import { ALL_BOWLERS, Bowler } from 'src/app/core/models/bowler.model';
import { BOWLER_KEYS, STORAGE_PREFIX, StorageKeys } from 'src/app/core/services/storage/storage-keys';
import { StorageRepository } from 'src/app/core/services/storage/storage.repository';

const ACTIVE_BOWLER_STORAGE_KEY = 'active-bowler-id';

@Injectable({ providedIn: 'root' })
export class BowlersStore {
  readonly #bowlers = signal<Bowler[]>([]);
  readonly #activeBowlerId = signal<string>(localStorage.getItem(ACTIVE_BOWLER_STORAGE_KEY) ?? '');
  readonly #defaultBowlerId = signal<string>('');
  // View selections: history is a multi-select, stats is single. An empty stats
  // selection means "follow the active bowler".
  readonly #historyBowlerIds = signal<string[]>([ALL_BOWLERS]);
  readonly #statsBowlerId = signal<string>('');

  readonly bowlers = this.#bowlers.asReadonly();
  readonly defaultBowlerId = this.#defaultBowlerId.asReadonly();
  readonly historyBowlerIds = this.#historyBowlerIds.asReadonly();

  readonly hasMultipleBowlers = computed(() => this.#bowlers().length > 1);

  // Falls back to the first bowler when unset or pointing at a deleted bowler.
  readonly activeBowlerId = computed(() => {
    const bowlers = this.#bowlers();
    const id = this.#activeBowlerId();
    return bowlers.some((bowler) => bowler.bowlerId === id) ? id : (bowlers[0]?.bowlerId ?? '');
  });

  readonly activeBowler = computed(() => this.#bowlers().find((bowler) => bowler.bowlerId === this.activeBowlerId()));

  readonly statsBowlerId = computed(() => {
    const id = this.#statsBowlerId();
    return this.#bowlers().some((bowler) => bowler.bowlerId === id) ? id : this.activeBowlerId();
  });

  constructor(private storageRepository: StorageRepository) {}

  async loadBowlers(): Promise<Bowler[]> {
    try {
      const bowlers = await this.storageRepository.loadByPrefix<Bowler>(STORAGE_PREFIX.bowler);
      bowlers.sort((a, b) => a.createdAt - b.createdAt);
      this.#bowlers.set(bowlers);
      const defaultBowlerId = await this.storageRepository.get<string>(BOWLER_KEYS.defaultBowler);
      this.#defaultBowlerId.set(defaultBowlerId ?? bowlers[0]?.bowlerId ?? '');
      return bowlers;
    } catch (error) {
      console.error('Error loading bowlers:', error);
      throw error;
    }
  }

  async addBowler(name: string): Promise<Bowler> {
    try {
      const bowler: Bowler = {
        bowlerId: Date.now() + '_' + Math.random().toString(36).slice(2, 9),
        name: name.trim(),
        createdAt: Date.now(),
      };
      await this.storageRepository.set(StorageKeys.bowler(bowler.bowlerId), bowler);
      this.#bowlers.update((bowlers) => [...bowlers, bowler]);
      return bowler;
    } catch (error) {
      console.error('Error adding bowler:', error);
      throw error;
    }
  }

  async updateBowler(bowler: Bowler): Promise<void> {
    try {
      await this.storageRepository.set(StorageKeys.bowler(bowler.bowlerId), bowler);
      this.#bowlers.update((bowlers) => bowlers.map((b) => (b.bowlerId === bowler.bowlerId ? bowler : b)));
    } catch (error) {
      console.error('Error updating bowler:', error);
      throw error;
    }
  }

  async deleteBowler(bowlerId: string): Promise<void> {
    try {
      await this.storageRepository.remove(StorageKeys.bowler(bowlerId));
      this.#bowlers.update((bowlers) => bowlers.filter((bowler) => bowler.bowlerId !== bowlerId));
      if (this.#activeBowlerId() === bowlerId) {
        this.setActiveBowler(this.#bowlers()[0]?.bowlerId ?? '');
      }
      if (this.#statsBowlerId() === bowlerId) {
        this.#statsBowlerId.set('');
      }
      this.#historyBowlerIds.update((ids) => {
        const remaining = ids.filter((id) => id !== bowlerId);
        return remaining.length ? remaining : [ALL_BOWLERS];
      });
      if (this.#defaultBowlerId() === bowlerId) {
        await this.setDefaultBowlerId(this.#bowlers()[0]?.bowlerId ?? '');
      }
    } catch (error) {
      console.error('Error deleting bowler:', error);
      throw error;
    }
  }

  async setDefaultBowlerId(bowlerId: string): Promise<void> {
    await this.storageRepository.set(BOWLER_KEYS.defaultBowler, bowlerId);
    this.#defaultBowlerId.set(bowlerId);
  }

  setActiveBowler(bowlerId: string): void {
    this.#activeBowlerId.set(bowlerId);
    localStorage.setItem(ACTIVE_BOWLER_STORAGE_KEY, bowlerId);
    // Stats follows the active bowler again after a deliberate switch.
    this.#statsBowlerId.set('');
  }

  setHistoryBowlerIds(bowlerIds: string[]): void {
    this.#historyBowlerIds.set(bowlerIds.length ? bowlerIds : [ALL_BOWLERS]);
  }

  setStatsBowlerId(bowlerId: string): void {
    this.#statsBowlerId.set(bowlerId);
  }

  clearBowlers(): void {
    this.#bowlers.set([]);
    this.#defaultBowlerId.set('');
    this.#activeBowlerId.set('');
    localStorage.removeItem(ACTIVE_BOWLER_STORAGE_KEY);
    this.#historyBowlerIds.set([ALL_BOWLERS]);
    this.#statsBowlerId.set('');
  }
}
