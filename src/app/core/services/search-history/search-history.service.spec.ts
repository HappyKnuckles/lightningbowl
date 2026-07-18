import { TestBed } from '@angular/core/testing';
import { StorageRepository } from '../storage/storage.repository';
import { SearchHistoryService } from './search-history.service';

/** Lets pending storage promises (load/persist) settle. */
const flushAsync = (): Promise<void> => new Promise((resolve) => setTimeout(resolve));

describe('SearchHistoryService', () => {
  let service: SearchHistoryService;
  let storageRepository: jasmine.SpyObj<StorageRepository>;

  beforeEach(() => {
    storageRepository = jasmine.createSpyObj('StorageRepository', ['get', 'set']);
    storageRepository.get.and.resolveTo(null);
    storageRepository.set.and.resolveTo();

    TestBed.configureTestingModule({
      providers: [{ provide: StorageRepository, useValue: storageRepository }],
    });
    service = TestBed.inject(SearchHistoryService);
  });

  it('starts with an empty history', () => {
    expect(service.history('balls')()).toEqual([]);
  });

  it('loads the persisted history on first access', async () => {
    storageRepository.get.and.resolveTo(['zen', 'phaze']);

    const history = service.history('balls');
    await flushAsync();

    expect(storageRepository.get).toHaveBeenCalledWith('search_history_balls');
    expect(history()).toEqual(['zen', 'phaze']);
  });

  it('adds a trimmed search to the front and persists it', async () => {
    await service.addSearch('balls', '  zen  ');
    await service.addSearch('balls', 'phaze');

    expect(service.history('balls')()).toEqual(['phaze', 'zen']);
    expect(storageRepository.set).toHaveBeenCalledWith('search_history_balls', ['phaze', 'zen']);
  });

  it('ignores terms shorter than two characters', async () => {
    await service.addSearch('balls', ' z ');

    expect(service.history('balls')()).toEqual([]);
    expect(storageRepository.set).not.toHaveBeenCalled();
  });

  it('moves a re-searched term to the front instead of duplicating it, case-insensitively', async () => {
    await service.addSearch('balls', 'zen');
    await service.addSearch('balls', 'phaze');
    await service.addSearch('balls', 'ZEN');

    expect(service.history('balls')()).toEqual(['ZEN', 'phaze']);
  });

  it('caps the history at ten entries, dropping the oldest', async () => {
    for (let i = 1; i <= 11; i++) {
      await service.addSearch('balls', `term ${i}`);
    }

    const history = service.history('balls')();
    expect(history.length).toBe(10);
    expect(history[0]).toBe('term 11');
    expect(history).not.toContain('term 1');
  });

  it('removes an entry and persists the removal', async () => {
    await service.addSearch('balls', 'zen');
    await service.addSearch('balls', 'phaze');

    await service.removeSearch('balls', 'zen');

    expect(service.history('balls')()).toEqual(['phaze']);
    expect(storageRepository.set).toHaveBeenCalledWith('search_history_balls', ['phaze']);
  });

  it('keeps histories of different contexts separate', async () => {
    await service.addSearch('balls', 'zen');

    expect(service.history('patterns')()).toEqual([]);
  });

  it('does not clobber a search made while the persisted history is still loading', async () => {
    let resolveLoad!: (value: string[]) => void;
    storageRepository.get.and.returnValue(new Promise((resolve) => (resolveLoad = resolve)));

    const history = service.history('balls');
    await service.addSearch('balls', 'zen');
    resolveLoad(['stored entry']);
    await flushAsync();

    expect(history()).toEqual(['zen']);
  });
});
