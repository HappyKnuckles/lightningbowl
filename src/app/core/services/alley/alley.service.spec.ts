import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { AlleyService } from './alley.service';

describe('AlleyService', () => {
  let service: AlleyService;
  let httpMock: HttpTestingController;

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
});
