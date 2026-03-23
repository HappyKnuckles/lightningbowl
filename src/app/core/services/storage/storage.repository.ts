import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';

@Injectable({ providedIn: 'root' })
export class StorageRepository {
  constructor(private storage: Storage) {}

  async create(): Promise<void> {
    await this.storage.create();
  }

  async get<T>(key: string): Promise<T | null> {
    return this.storage.get(key);
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.storage.set(key, value);
  }

  async remove(key: string): Promise<void> {
    await this.storage.remove(key);
  }

  async forEach(callback: (value: unknown, key: string) => void): Promise<void> {
    await this.storage.forEach(callback);
  }

  async clear(): Promise<void> {
    await this.storage.clear();
  }
}
