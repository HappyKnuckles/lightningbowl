import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { AlleyService } from './alley.service';

/** One Overpass element as the API returns it. */
function element(overrides: Record<string, unknown> = {}) {
  return { type: 'node', id: 1, lat: 50, lon: 8, tags: { leisure: 'bowling_alley', name: 'Strike Zone' }, ...overrides };
}

describe('AlleyService', () => {
  let service: AlleyService;
  let httpMock: HttpTestingController;

  /** The Overpass POST, whichever endpoint the build resolved to. */
  function expectOverpass(): TestRequest {
    return httpMock.expectOne((r) => r.method === 'POST');
  }

  beforeEach(() => {
    // The builder's providersFile is applied per TestBed; reset so each test gets
    // its own service instance (and an empty HTTP backend) instead of a shared one.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    service = TestBed.inject(AlleyService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  /** Lets the pending promise chain hand the next request to the testing backend. */
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

  /** Answers the Nominatim lookup and the Overpass query a text search fires first. */
  async function respondToOsmLookup(elements: unknown[]): Promise<void> {
    await tick();
    httpMock.expectOne((req) => req.url.includes('nominatim')).flush([{ lat: '52.5', lon: '13.4', display_name: 'Berlin' }]);

    await tick();
    httpMock.expectOne((req) => req.url.includes('overpass')).flush({ elements });
    await tick();
  }

  it('returns the Overpass results without asking Google when OSM knows the alley', async () => {
    const search = service.searchByText('Berlin');

    await respondToOsmLookup([{ type: 'node', id: 1, lat: 52.5, lon: 13.4, tags: { name: 'Berlin Bowling', leisure: 'bowling_alley' } }]);

    const alleys = await search;
    expect(alleys.map((alley) => alley.name)).toEqual(['Berlin Bowling']);
    expect(alleys[0].source).toBe('osm');
    httpMock.expectNone((req) => req.url.includes('places'));
  });

  it('falls back to Google Places when Overpass finds nothing', async () => {
    const search = service.searchByText('Berlin');

    await respondToOsmLookup([]);

    const places = httpMock.expectOne((req) => req.url.includes('places'));
    expect(places.request.urlWithParams).toContain('q=Berlin');
    expect(places.request.urlWithParams).toContain('lat=52.5');
    places.flush({
      places: [
        {
          id: 'ChIJ123',
          displayName: { text: 'Hidden Lanes' },
          formattedAddress: 'Hauptstr. 1, Berlin',
          location: { latitude: 52.51, longitude: 13.41 },
        },
      ],
    });

    const alleys = await search;
    expect(alleys).toHaveLength(1);
    expect(alleys[0]).toMatchObject({ id: 'google/ChIJ123', name: 'Hidden Lanes', source: 'google' });
    expect(alleys[0].distanceMeters).toBeGreaterThan(0);
  });

  it('treats an unconfigured Places proxy as "no results" rather than an error', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const search = service.searchPlaces('Berlin');

    await tick();
    httpMock
      .expectOne((req) => req.url.includes('places'))
      .flush({ error: 'Places search is not configured' }, { status: 501, statusText: 'Not Implemented' });

    await expect(search).resolves.toEqual([]);
  });

  it('does not search for an empty term', async () => {
    await expect(service.searchByText('   ')).resolves.toEqual([]);
  });

  describe('searchNearby', () => {
    it('normalizes an Overpass element into an alley', async () => {
      const pending = service.searchNearby(50, 8, 10);

      expectOverpass().flush({
        elements: [
          element({
            tags: {
              leisure: 'bowling_alley',
              name: 'Strike Zone',
              lanes: '24',
              opening_hours: 'Mo-Fr 14:00-23:00',
              phone: '+49 123',
              website: 'strike-zone.de',
              'addr:street': 'Bahnhofstr.',
              'addr:housenumber': '5',
              'addr:postcode': '12345',
              'addr:city': 'Bowltown',
            },
          }),
        ],
      });

      const [alley] = await pending;
      expect(alley).toMatchObject({
        id: 'node/1',
        name: 'Strike Zone',
        laneCount: 24,
        openingHours: 'Mo-Fr 14:00-23:00',
        phone: '+49 123',
        website: 'https://strike-zone.de',
        address: 'Bahnhofstr. 5, 12345 Bowltown',
      });
    });

    it('falls back to a generic name and leaves unknown fields undefined', async () => {
      const pending = service.searchNearby(50, 8, 10);

      expectOverpass().flush({ elements: [element({ tags: { leisure: 'bowling_alley' } })] });

      const [alley] = await pending;
      expect(alley.name).toBe('Bowling Alley');
      expect(alley.address).toBeUndefined();
      expect(alley.laneCount).toBeUndefined();
      expect(alley.website).toBeUndefined();
    });

    it('keeps a website that already carries its scheme', async () => {
      const pending = service.searchNearby(50, 8, 10);

      expectOverpass().flush({ elements: [element({ tags: { leisure: 'bowling_alley', website: 'http://strike-zone.de' } })] });

      expect((await pending)[0].website).toBe('http://strike-zone.de');
    });

    it('reads the center of a way or relation', async () => {
      const pending = service.searchNearby(50, 8, 10);

      expectOverpass().flush({ elements: [element({ type: 'way', id: 7, lat: undefined, lon: undefined, center: { lat: 51, lon: 9 } })] });

      const [alley] = await pending;
      expect(alley.id).toBe('way/7');
      expect(alley.lat).toBe(51);
    });

    it('drops elements without coordinates', async () => {
      const pending = service.searchNearby(50, 8, 10);

      expectOverpass().flush({ elements: [element({ lat: undefined, lon: undefined })] });

      await expect(pending).resolves.toEqual([]);
    });

    it('sorts results by distance from the origin', async () => {
      const pending = service.searchNearby(50, 8, 10);

      expectOverpass().flush({
        elements: [
          element({ id: 1, lat: 50.05, tags: { leisure: 'bowling_alley', name: 'Far' } }),
          element({ id: 2, lat: 50.005, tags: { leisure: 'bowling_alley', name: 'Near' } }),
        ],
      });

      expect((await pending).map((a) => a.name)).toEqual(['Near', 'Far']);
    });

    it('drops the duplicate when the same alley is mapped twice', async () => {
      const pending = service.searchNearby(50, 8, 10);

      expectOverpass().flush({
        elements: [element({ id: 1 }), element({ id: 2, type: 'way', lat: 50.0001, lon: 8.0001 })],
      });

      expect(await pending).toHaveLength(1);
    });

    it('keeps a nearby alley that has a different name', async () => {
      const pending = service.searchNearby(50, 8, 10);

      expectOverpass().flush({
        elements: [element({ id: 1 }), element({ id: 2, lat: 50.0001, tags: { leisure: 'bowling_alley', name: 'Other House' } })],
      });

      expect(await pending).toHaveLength(2);
    });

    it('accepts a bowling-sounding name without bowling tags', async () => {
      const pending = service.searchNearby(50, 8, 10);

      expectOverpass().flush({ elements: [element({ tags: { name: 'Sunset Bowling Lanes' } })] });

      expect(await pending).toHaveLength(1);
    });

    it('rejects a name that reads like another venue', async () => {
      const pending = service.searchNearby(50, 8, 10);

      expectOverpass().flush({ elements: [element({ tags: { name: 'Bowling Bar & Restaurant' } })] });

      await expect(pending).resolves.toEqual([]);
    });

    it('serves a repeated search from the cache', async () => {
      const first = service.searchNearby(50, 8, 10);
      expectOverpass().flush({ elements: [element()] });
      await first;

      const second = await service.searchNearby(50, 8, 10);

      expect(second).toHaveLength(1);
      httpMock.expectNone((r) => r.method === 'POST');
    });

    it('shares one request between identical concurrent searches', async () => {
      const first = service.searchNearby(50, 8, 10);
      const second = service.searchNearby(50, 8, 10);

      expectOverpass().flush({ elements: [element()] });

      expect(await first).toEqual(await second);
    });

    it('fails when Overpass reports a server-side timeout', async () => {
      const pending = service.searchNearby(50, 8, 10);

      expectOverpass().flush({ elements: [], remark: 'runtime error: Query timed out' });

      await expect(pending).rejects.toThrow(/timed out/);
    });

    it('retries once when the instance throttles', async () => {
      // The service pauses 3s before retrying; run that timer straight through.
      const timeout = vi.spyOn(window, 'setTimeout').mockImplementation(((handler: TimerHandler) => {
        if (typeof handler === 'function') handler();
        return 0;
      }) as unknown as typeof window.setTimeout);

      try {
        const pending = service.searchNearby(50, 8, 10);
        expectOverpass().flush('too many requests', { status: 429, statusText: 'Too Many Requests' });
        for (let i = 0; i < 5; i++) {
          await Promise.resolve();
        }

        expectOverpass().flush({ elements: [element()] });

        expect(await pending).toHaveLength(1);
        expect(timeout).toHaveBeenCalled();
      } finally {
        timeout.mockRestore();
      }
    });

    it('does not retry other errors', async () => {
      const pending = service.searchNearby(50, 8, 10);

      expectOverpass().flush('boom', { status: 500, statusText: 'Server Error' });

      await expect(pending).rejects.toBeTruthy();
    });
  });

  describe('geocode', () => {
    it('returns the first match as coordinates and a label', async () => {
      const pending = service.geocode('Bowltown');

      const req = httpMock.expectOne((r) => r.method === 'GET');
      expect(req.request.url).toContain('q=Bowltown');
      req.flush([{ lat: '50.5', lon: '8.5', display_name: 'Bowltown, Germany' }]);

      await expect(pending).resolves.toEqual({ lat: 50.5, lon: 8.5, label: 'Bowltown, Germany' });
    });

    it('returns null when nothing matches', async () => {
      const pending = service.geocode('nowhere');

      httpMock.expectOne((r) => r.method === 'GET').flush([]);

      await expect(pending).resolves.toBeNull();
    });
  });

  describe('calculateDistance', () => {
    it('is zero for the same point', () => {
      expect(service.calculateDistance(50, 8, 50, 8)).toBe(0);
    });

    it('measures roughly 111 km per degree of latitude', () => {
      expect(service.calculateDistance(50, 8, 51, 8)).toBeCloseTo(111195, -2);
    });

    it('is symmetric', () => {
      expect(service.calculateDistance(50, 8, 51, 9)).toBeCloseTo(service.calculateDistance(51, 9, 50, 8), 5);
    });
  });
});
