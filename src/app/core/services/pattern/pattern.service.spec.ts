import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from 'src/environments/environment';

import { PatternService } from './pattern.service';

/** Patterns are keyed by their full Kegel source URL, not by a slug. */
const PATTERN_URL = 'https://patternlibrary.kegel.net/pattern/ba78effc-ce52-ec11-8c62-000d3a5afff3';

describe('PatternService', () => {
  let service: PatternService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PatternService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getPatternData', () => {
    it('encodes the pattern id so it stays a single path segment', async () => {
      const pending = service.getPatternData(PATTERN_URL);

      // Interpolated raw this reads ".../patterns/https://patternlibrary..."
      // whose double slash proxies collapse, breaking the lookup.
      const request = http.expectOne(`${environment.patternEndpoint}patterns/${encodeURIComponent(PATTERN_URL)}`);

      expect(request.request.url).not.toContain('patterns/https://');
      request.flush({ url: PATTERN_URL, title: 'Test Pattern' });

      await expectAsync(pending).toBeResolved();
    });

    it('resolves to an empty object when the lookup fails', async () => {
      const pending = service.getPatternData(PATTERN_URL);

      http.expectOne(`${environment.patternEndpoint}patterns/${encodeURIComponent(PATTERN_URL)}`).flush('Not found', {
        status: 404,
        statusText: 'Not Found',
      });

      // Callers detect failure by the missing url rather than by a rejection.
      await expectAsync(pending).toBeResolvedTo({} as never);
    });
  });
});
