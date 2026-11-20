import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { environment } from 'src/environments/environment';

import { CacheService } from '../cache/cache.service';
import { NetworkService } from '../network/network.service';
import { PATTERN_PAGE_SIZE, PatternService } from './pattern.service';

describe('PatternService', () => {
  let service: PatternService;
  let http: HttpTestingController;
  let network: { isOffline: boolean; isOnline: boolean };
  const store = new Map<string, unknown>();

  /** The next request matching `path`, once the service has looked in its cache and sent it. */
  const request = async (path: string): Promise<TestRequest> => {
    const url = `${environment.patternEndpoint}${path}`;
    let sent: TestRequest[] = [];
    // `match` takes the requests off the list, so keep what it found
    await vi.waitFor(() => {
      sent = [...sent, ...http.match((r) => r.url === url)];
      expect(sent).toHaveLength(1);
    });
    return sent[0];
  };

  beforeEach(() => {
    store.clear();
    network = { isOffline: false, isOnline: true };
    TestBed.configureTestingModule({
      providers: [
        {
          provide: CacheService,
          useValue: {
            get: vi.fn(async (key: string) => store.get(key) ?? null),
            set: vi.fn(async (key: string, data: unknown) => void store.set(key, data)),
            isValid: vi.fn(async (key: string) => store.has(key)),
          },
        },
        { provide: NetworkService, useValue: network },
      ],
    });
    service = TestBed.inject(PatternService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads a page of the list without the oil rows', async () => {
    const result = service.getPatterns(2, false, 'distance', 'desc');

    const req = await request('patterns');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('per_page')).toBe(String(PATTERN_PAGE_SIZE));
    expect(req.request.params.get('sort_field')).toBe('distance');
    expect(req.request.params.get('sort_direction')).toBe('desc');
    expect(req.request.params.get('include_oil')).toBe('false');
    expect(req.request.params.has('q')).toBe(false);
    req.flush({ total: 120, page: 2, per_page: 50, patterns: [{ url: 'u1', title: 'Badger' }] });

    expect(await result).toMatchObject({ total: 120, patterns: [{ title: 'Badger' }] });
  });

  it('searches through the same paged list, and keeps each search page apart', async () => {
    const first = service.getPatterns(1, false, 'title', 'asc', ' Shark ');
    const req = await request('patterns');
    expect(req.request.params.get('q')).toBe('Shark');
    req.flush({ total: 1, patterns: [{ url: 'u2', title: 'Shark' }] });
    await first;

    // the same search again comes from the cache; the plain list doesn't
    expect((await service.getPatterns(1, false, 'title', 'asc', 'shark')).patterns[0].title).toBe('Shark');
    const list = service.getPatterns(1, false, 'title', 'asc');
    (await request('patterns')).flush({ total: 0, patterns: [] });
    await list;
  });

  it('sends the favorites to be listed first, and caches that list apart', async () => {
    const result = service.getPatterns(1, false, 'title', 'asc', '', ['u2', 'u1']);

    const req = await request('patterns');
    expect(req.request.params.getAll('favorite')).toEqual(['u2', 'u1']);
    req.flush({ total: 2, patterns: [{ url: 'u2' }, { url: 'u1' }] });
    await result;

    expect([...store.keys()]).toEqual(['patterns_page_1_title_asc_fav_u1,u2']);
  });

  it('keeps an opened pattern for offline use', async () => {
    const pattern = { url: 'https://patternlibrary.kegel.net/pattern/abc', title: 'Badger', forwards_data: [], reverse_data: [] };
    const first = service.getPatternData(pattern.url);
    (await request(`patterns/${pattern.url}`)).flush(pattern);
    expect(await first).toEqual(pattern);

    network.isOffline = true;
    store.set('unrelated', true);
    expect(await service.getPatternData(pattern.url)).toEqual(pattern);
  });
});
