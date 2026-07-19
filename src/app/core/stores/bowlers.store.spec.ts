import { TestBed } from '@angular/core/testing';
import { ALL_BOWLERS, Bowler } from 'src/app/core/models/bowler.model';
import { BOWLER_KEYS, STORAGE_PREFIX } from 'src/app/core/services/storage/storage-keys';
import { StorageRepository } from 'src/app/core/services/storage/storage.repository';
import { BowlersStore } from './bowlers.store';

class InMemoryStorageRepository {
  store = new Map<string, unknown>();
  async create(): Promise<void> {
    /* empty */
  }
  async get<T>(key: string): Promise<T | null> {
    return this.store.has(key) ? (this.store.get(key) as T) : null;
  }
  async set<T>(key: string, value: T): Promise<void> {
    this.store.set(key, value);
  }
  async remove(key: string): Promise<void> {
    this.store.delete(key);
  }
  async forEach(callback: (value: unknown, key: string) => void): Promise<void> {
    this.store.forEach((value, key) => callback(value, key));
  }
  async loadByPrefix<T>(prefix: string): Promise<T[]> {
    const data: T[] = [];
    this.store.forEach((value, key) => {
      if (key.startsWith(prefix)) {
        data.push(value as T);
      }
    });
    return data;
  }
  async clear(): Promise<void> {
    this.store.clear();
  }
}

describe('BowlersStore', () => {
  let store: BowlersStore;
  let storage: InMemoryStorageRepository;

  beforeEach(() => {
    localStorage.removeItem('active-bowler-id');
    storage = new InMemoryStorageRepository();
    TestBed.configureTestingModule({
      providers: [{ provide: StorageRepository, useValue: storage }],
    });
    store = TestBed.inject(BowlersStore);
  });

  afterEach(() => {
    localStorage.removeItem('active-bowler-id');
  });

  it('starts empty with no active bowler', () => {
    expect(store.bowlers()).toEqual([]);
    expect(store.activeBowlerId()).toBe('');
    expect(store.hasMultipleBowlers()).toBeFalse();
  });

  it('adds a bowler, persists it, and trims the name', async () => {
    const bowler = await store.addBowler('  Nico ');
    expect(bowler.name).toBe('Nico');
    expect(store.bowlers().length).toBe(1);
    expect(storage.store.get(`${STORAGE_PREFIX.bowler}_${bowler.bowlerId}`)).toEqual(bowler);
  });

  it('loads bowlers sorted by creation time', async () => {
    const older: Bowler = { bowlerId: 'b1', name: 'First', createdAt: 100 };
    const newer: Bowler = { bowlerId: 'b2', name: 'Second', createdAt: 200 };
    storage.store.set(`${STORAGE_PREFIX.bowler}_b2`, newer);
    storage.store.set(`${STORAGE_PREFIX.bowler}_b1`, older);

    await store.loadBowlers();

    expect(store.bowlers().map((b) => b.bowlerId)).toEqual(['b1', 'b2']);
  });

  it('loads the default bowler id and falls back to the first bowler when missing', async () => {
    storage.store.set(`${STORAGE_PREFIX.bowler}_b1`, { bowlerId: 'b1', name: 'First', createdAt: 100 });
    await store.loadBowlers();
    expect(store.defaultBowlerId()).toBe('b1');

    storage.store.set(BOWLER_KEYS.defaultBowler, 'b1');
    await store.loadBowlers();
    expect(store.defaultBowlerId()).toBe('b1');
  });

  it('updates a bowler in place', async () => {
    const bowler = await store.addBowler('Nico');
    await store.updateBowler({ ...bowler, name: 'Nicolas' });
    expect(store.bowlers()[0].name).toBe('Nicolas');
  });

  it('falls back to the first bowler when the active id is stale', async () => {
    const first = await store.addBowler('First');
    await store.addBowler('Second');
    store.setActiveBowler('does-not-exist');
    expect(store.activeBowlerId()).toBe(first.bowlerId);
  });

  it('statsBowlerId follows the active bowler until explicitly set', async () => {
    const first = await store.addBowler('First');
    const second = await store.addBowler('Second');
    expect(store.statsBowlerId()).toBe(first.bowlerId);

    store.setStatsBowlerId(second.bowlerId);
    expect(store.statsBowlerId()).toBe(second.bowlerId);

    // switching the active bowler resets stats back to "follow active"
    store.setActiveBowler(first.bowlerId);
    expect(store.statsBowlerId()).toBe(first.bowlerId);
  });

  it('deleting a bowler heals active, stats, and history selections', async () => {
    const first = await store.addBowler('First');
    const second = await store.addBowler('Second');
    store.setActiveBowler(second.bowlerId);
    store.setStatsBowlerId(second.bowlerId);
    store.setHistoryBowlerIds([second.bowlerId]);

    await store.deleteBowler(second.bowlerId);

    expect(store.bowlers().map((b) => b.bowlerId)).toEqual([first.bowlerId]);
    expect(store.activeBowlerId()).toBe(first.bowlerId);
    expect(store.statsBowlerId()).toBe(first.bowlerId);
    expect(store.historyBowlerIds()).toEqual([ALL_BOWLERS]);
  });

  it('empty history selection resets to all', () => {
    store.setHistoryBowlerIds([]);
    expect(store.historyBowlerIds()).toEqual([ALL_BOWLERS]);
  });

  it('clearBowlers resets everything', async () => {
    await store.addBowler('Nico');
    await store.setDefaultBowlerId(store.bowlers()[0].bowlerId);
    store.clearBowlers();
    expect(store.bowlers()).toEqual([]);
    expect(store.defaultBowlerId()).toBe('');
    expect(store.activeBowlerId()).toBe('');
  });
});
