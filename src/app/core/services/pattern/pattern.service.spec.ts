import { vi } from 'vitest';
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PATTERN_API_BASE_PATH } from './pattern-api.provider';
import { PatternService } from './pattern.service';

describe('PatternService', () => {
  let service: PatternService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PatternService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads a pattern by its Kegel URL without a double slash in the path', async () => {
    const url = 'https://patternlibrary.kegel.net/pattern/abc';
    const result = service.getPatternData(url);

    const request = await vi.waitFor(() => http.expectOne((r) => r.url.startsWith(`${PATTERN_API_BASE_PATH}/api/patterns/`)));
    expect(request.request.url).not.toContain('https://patternlibrary');
    expect(decodeURIComponent(request.request.url.split('/api/patterns/')[1])).toBe(url);
    request.flush({ url, title: 'Shark' });

    expect((await result).title).toBe('Shark');
  });

  it('calculates a pattern through the API', async () => {
    const input = { forwards_data: [{ start: '2L', stop: '2R', load: 2, mics: 45, speed: 14 }] };
    const result = service.calculatePattern(input);

    const request = await vi.waitFor(() => http.expectOne(`${PATTERN_API_BASE_PATH}/api/patterns/calculate`));
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(input);
    request.flush({ distance: "1.96'", volume: '3.33', forward: '3.33', reverse: '0.00', forwards_data: [], reverse_data: [] });

    expect((await result).distance).toBe("1.96'");
  });

  it("passes on the API's message for input it can't calculate", async () => {
    const result = service.calculatePattern({ forwards_data: [] });

    const request = await vi.waitFor(() => http.expectOne(`${PATTERN_API_BASE_PATH}/api/patterns/calculate`));
    request.flush({ error: 'Add at least one forward row' }, { status: 400, statusText: 'Bad Request' });

    await expect(result).rejects.toThrow('Add at least one forward row');
  });

  it('adds a pattern and returns its url', async () => {
    const result = service.addPattern({ title: 'House', forwards_data: [{ start: '2L', stop: '2R', load: 2, mics: 45, speed: 14 }] });

    const request = await vi.waitFor(() => http.expectOne(`${PATTERN_API_BASE_PATH}/api/add-pattern`));
    request.flush({ success: true, pattern_id: 'abc-123' }, { status: 201, statusText: 'Created' });

    expect(await result).toBe('abc-123');
  });

  it('reports a generic error when saving fails for other reasons', async () => {
    const result = service.addPattern({ title: 'House', forwards_data: [] });

    const request = await vi.waitFor(() => http.expectOne(`${PATTERN_API_BASE_PATH}/api/add-pattern`));
    request.flush({ error: 'boom' }, { status: 500, statusText: 'Server Error' });

    await expect(result).rejects.toThrow('Error saving pattern.');
  });

  it('searches with the sort and the oil rows when asked', async () => {
    const result = service.searchPattern('house', true, 'ratio', 'desc');

    const request = await vi.waitFor(() => http.expectOne((r) => r.url === `${PATTERN_API_BASE_PATH}/api/search`));
    expect(request.request.params.get('q')).toBe('house');
    expect(request.request.params.get('include_metadata')).toBe('true');
    expect(request.request.params.get('sort_field')).toBe('ratio');
    expect(request.request.params.get('sort_direction')).toBe('desc');
    request.flush({ query: 'house', count: 0, patterns: [] });

    expect((await result).count).toBe(0);
  });
});
