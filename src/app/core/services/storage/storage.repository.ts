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
    const data: T[] = [];
    await this.storage.forEach((value, key) => {
      if (key.startsWith(prefix)) {
        data.push(value as T);
      }
    });
    return data;
  }

  async clear(): Promise<void> {
    await this.storage.clear();
  }
}
