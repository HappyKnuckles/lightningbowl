import { Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { StorageKeys } from '../storage/storage-keys';
import { StorageRepository } from '../storage/storage.repository';

const MAX_HISTORY_ENTRIES = 10;
const MIN_TERM_LENGTH = 2;

@Injectable({ providedIn: 'root' })
export class SearchHistoryService {
  readonly #histories = new Map<string, WritableSignal<string[]>>();

  constructor(private storageRepository: StorageRepository) {}

  history(context: string): Signal<string[]> {
    return this.#getOrCreate(context).asReadonly();
  }

  async addSearch(context: string, term: string): Promise<void> {
    const trimmed = term.trim();
    if (trimmed.length < MIN_TERM_LENGTH) {
      return;
    }
    const history = this.#getOrCreate(context);
    const next = [trimmed, ...history().filter((entry) => entry.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_HISTORY_ENTRIES);
    history.set(next);
    await this.storageRepository.set(StorageKeys.searchHistory(context), next);
  }

  async removeSearch(context: string, term: string): Promise<void> {
    const history = this.#getOrCreate(context);
    const next = history().filter((entry) => entry !== term);
    history.set(next);
    await this.storageRepository.set(StorageKeys.searchHistory(context), next);
  }

  #getOrCreate(context: string): WritableSignal<string[]> {
    let history = this.#histories.get(context);
    if (!history) {
      history = signal<string[]>([]);
      this.#histories.set(context, history);
      void this.#load(context, history);
    }
    return history;
  }

  async #load(context: string, history: WritableSignal<string[]>): Promise<void> {
    try {
      const stored = await this.storageRepository.get<string[]>(StorageKeys.searchHistory(context));
      // Only apply stored entries if nothing was added while loading.
      if (stored?.length && history().length === 0) {
        history.set(stored);
      }
    } catch (error) {
      console.error(`Error loading search history for ${context}:`, error);
    }
  }
}
