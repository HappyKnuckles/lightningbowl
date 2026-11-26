import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { environment } from 'src/environments/environment';
import { CacheService } from '../cache/cache.service';
import { RULE_PAGE_SIZE, RulebookService } from './rulebook.service';

describe('RulebookService', () => {
  let service: RulebookService;
  let http: HttpTestingController;
  const cache = { get: vi.fn(), set: vi.fn() };
  const api = environment.rulebookApiEndpoint;

  beforeEach(() => {
    cache.get.mockReset().mockResolvedValue(null);
    cache.set.mockReset().mockResolvedValue(undefined);
    TestBed.configureTestingModule({ providers: [{ provide: CacheService, useValue: cache }] });
    service = TestBed.inject(RulebookService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** Lets the service reach its request (it may await the cache first). */
  const settle = () => new Promise((resolve) => setTimeout(resolve));

  it('loads the associations and caches them', async () => {
    const result = service.getAssociations();
    http.expectOne(`${api}associations`).flush([{ id: 'usbc' }]);
    expect(await result).toEqual([{ id: 'usbc' }]);
    expect(cache.set).toHaveBeenCalledWith('rulebook_associations', [{ id: 'usbc' }], expect.any(Number));
  });

  it('falls back to the cached rulebook when the API is unreachable', async () => {
    cache.get.mockResolvedValue({ id: 'usbc-playing-rules', rules: [] });
    const result = service.getRulebook('usbc-playing-rules');
    http.expectOne(`${api}rulebooks/usbc-playing-rules`).error(new ProgressEvent('error'));
    expect(await result).toEqual({ id: 'usbc-playing-rules', rules: [] });
    expect(cache.get).toHaveBeenCalledWith('rulebook_usbc-playing-rules');
  });

  it('fails when neither the API nor the cache has the rulebook', async () => {
    const result = service.getRulebook('nope');
    http.expectOne(`${api}rulebooks/nope`).error(new ProgressEvent('error'));
    await expect(result).rejects.toBeTruthy();
  });

  it('searches with the filters and page', async () => {
    const result = service.searchRules('foul line', { association: 'usbc' }, 2);
    await settle();
    const request = http.expectOne((r) => r.url === `${api}rules`);
    expect(request.request.params.get('search')).toBe('foul line');
    expect(request.request.params.get('association')).toBe('usbc');
    expect(request.request.params.get('rulebook')).toBeNull();
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('size')).toBe(String(RULE_PAGE_SIZE));
    request.flush({ content: [], page: { number: 2, size: RULE_PAGE_SIZE, totalElements: 0, totalPages: 0 } });
    expect((await result).content).toEqual([]);
  });
});
