import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';
import { firstValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Alley } from '../../models/alley.model';

interface OverpassTags {
  name?: string;
  leisure?: string;
  sport?: string;
  amenity?: string;
  tourism?: string;
  lanes?: string;
  opening_hours?: string;
  phone?: string;
  'contact:phone'?: string;
  website?: string;
  'contact:website'?: string;
  'addr:housenumber'?: string;
  'addr:street'?: string;
  'addr:city'?: string;
  'addr:postcode'?: string;
  [key: string]: string | undefined;
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: OverpassTags;
}

interface OverpassResponse {
  elements?: OverpassElement[];
  /** Set by Overpass for server-side errors like query timeouts (still HTTP 200). */
  remark?: string;
}

export interface GeocodeResult {
  lat: number;
  lon: number;
  label: string;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

interface GooglePlace {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  nationalPhoneNumber?: string;
  websiteUri?: string;
}

interface GooglePlacesResponse {
  places?: GooglePlace[];
}

const CACHE_TTL_MS = 5 * 60 * 1000;
/** Radius searched around a geocoded place when looking an alley up by name. */
const TEXT_SEARCH_RADIUS_KM = 25;

/**
 * Domain the /api proxies (api/overpass.mjs, api/nominatim.mjs) are deployed
 * to for the branch this build was made from.
 */
const APP_ORIGIN = environment.branch === 'test' ? 'https://test.lightningbowl.de' : 'https://lightningbowl.de';

@Injectable({ providedIn: 'root' })
export class AlleyService {
  private http = inject(HttpClient);
  private readonly overpassUrl = this.resolveEndpoint('/api/overpass', 'https://overpass-api.de/api/interpreter');
  private readonly nominatimUrl = this.resolveEndpoint('/api/nominatim', 'https://nominatim.openstreetmap.org/search');
  // Places always needs the serverless proxy — the API key can't ship in a client.
  private readonly placesUrl = this.resolveEndpoint('/api/places', environment.placesEndpoint);
  private cache = new Map<string, { timestamp: number; alleys: Alley[] }>();
  private inflight = new Map<string, Promise<Alley[]>>();

  /**
   * Picks where map-data requests go. The public Overpass/Nominatim instances
   * throttle/block browser requests unpredictably (HTTP 406/429/504) —
   * observed for both the hosted *.vercel.app origin and the native app's
   * capacitor://localhost origin, not just one of them (see api/overpass.mjs).
   * So both the deployed web app and native route through the /api proxies,
   * which call upstream server-side with a descriptive User-Agent and no
   * browser-origin exposure. Native uses the proxies' full production URL
   * (its own bundle has no live server behind a relative /api path); the
   * proxies send Access-Control-Allow-Origin: * so that cross-origin call is
   * actually readable. Local dev calls the upstreams directly since there's no
   * local proxy running.
   */
  private resolveEndpoint(proxyPath: string, directUrl: string): string {
    if (Capacitor.isNativePlatform()) {
      return `${APP_ORIGIN}${proxyPath}`;
    }
    const host = typeof location !== 'undefined' ? location.hostname : '';
    const isLocalDev = host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
    return isLocalDev ? directUrl : proxyPath;
  }

  /**
   * Finds bowling alleys around the given origin in a single Overpass request.
   * Results are normalized, deduplicated, enriched with distance and sorted by it.
   * Identical concurrent calls share one request; the public Overpass API
   * rate-limits aggressively, so a 429 is retried once after a pause.
   */
  searchNearby(lat: number, lon: number, radiusKm: number): Promise<Alley[]> {
    const cacheKey = `${lat.toFixed(3)},${lon.toFixed(3)},${radiusKm}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return Promise.resolve(cached.alleys);
    }

    const existing = this.inflight.get(cacheKey);
    if (existing) {
      return existing;
    }

    const request = this.fetchNearby(lat, lon, radiusKm, cacheKey).finally(() => this.inflight.delete(cacheKey));
    this.inflight.set(cacheKey, request);
    return request;
  }

  private async fetchNearby(lat: number, lon: number, radiusKm: number, cacheKey: string): Promise<Alley[]> {
    const radius = radiusKm * 1000;
    // Equality filters only: regex filters (especially on "name") make Overpass
    // scan every named element in the radius and time the whole query out.
    const query = `
[out:json][timeout:25];
(
  nwr["leisure"="bowling_alley"](around:${radius},${lat},${lon});
  nwr["sport"="bowling"](around:${radius},${lat},${lon});
  nwr["sport"="10pin"](around:${radius},${lat},${lon});
  nwr["sport"="9pin"](around:${radius},${lat},${lon});
  nwr["amenity"="bowling_alley"](around:${radius},${lat},${lon});
);
out center;`;

    const response = await this.postWithRetry(query);
    if (response.remark?.toLowerCase().includes('timed out')) {
      // Overpass reports server-side timeouts as HTTP 200 with empty elements.
      throw new Error(`Overpass query timed out: ${response.remark}`);
    }

    const alleys = this.dedupe(
      (response.elements ?? [])
        .filter((elem) => this.isLikelyBowlingAlley(elem))
        .map((elem) => this.toAlley(elem, lat, lon))
        .filter((alley): alley is Alley => alley !== null),
    ).sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));

    this.cache.set(cacheKey, { timestamp: Date.now(), alleys });
    return alleys;
  }

  async geocode(query: string): Promise<GeocodeResult | null> {
    const url = `${this.nominatimUrl}?q=${encodeURIComponent(query)}&format=json&limit=1`;
    const results = await firstValueFrom(this.http.get<NominatimResult[]>(url));
    if (!results?.length) {
      return null;
    }
    const { lat, lon, display_name } = results[0];
    return { lat: parseFloat(lat), lon: parseFloat(lon), label: display_name };
  }

  /**
   * Looks an alley up by free text: geocodes the term, then lists the alleys
   * around that place. OSM only knows what someone mapped, so when Overpass
   * comes back empty the same term goes to Google Places, which indexes far
   * more of the smaller alleys.
   */
  async searchByText(query: string): Promise<Alley[]> {
    const term = query.trim();
    if (!term) {
      return [];
    }

    let origin: GeocodeResult | null = null;
    let alleys: Alley[] = [];
    try {
      origin = await this.geocode(term);
      if (origin) {
        alleys = await this.searchNearby(origin.lat, origin.lon, TEXT_SEARCH_RADIUS_KM);
      }
    } catch (error) {
      // A failing Overpass/Nominatim lookup shouldn't block the Places fallback.
      console.warn('Alley text search via OSM failed:', error);
    }

    if (alleys.length > 0) {
      return alleys;
    }
    return this.searchPlaces(term, origin ?? undefined);
  }

  /**
   * Google Places text search through the serverless proxy. Returns an empty
   * list when the proxy has no API key configured (HTTP 501) or is unreachable,
   * so callers can treat it as "no extra results" rather than an error.
   */
  async searchPlaces(query: string, origin?: { lat: number; lon: number }): Promise<Alley[]> {
    const params = new URLSearchParams({ q: query });
    if (origin) {
      params.set('lat', String(origin.lat));
      params.set('lon', String(origin.lon));
    }

    try {
      const response = await firstValueFrom(this.http.get<GooglePlacesResponse>(`${this.placesUrl}?${params.toString()}`));
      return (response.places ?? []).map((place) => this.toAlleyFromPlace(place, origin)).filter((alley): alley is Alley => alley !== null);
    } catch (error) {
      console.warn('Places search unavailable:', error);
      return [];
    }
  }

  private toAlleyFromPlace(place: GooglePlace, origin?: { lat: number; lon: number }): Alley | null {
    const lat = place.location?.latitude;
    const lon = place.location?.longitude;
    const name = place.displayName?.text;
    if (lat === undefined || lon === undefined || !name) {
      return null;
    }

    return {
      id: `google/${place.id}`,
      name,
      lat,
      lon,
      address: place.formattedAddress,
      phone: place.nationalPhoneNumber,
      website: place.websiteUri,
      distanceMeters: origin ? this.calculateDistance(origin.lat, origin.lon, lat, lon) : undefined,
      source: 'google',
    };
  }

  /** POSTs an Overpass query, retrying once after a pause when the instance throttles. */
  private async postWithRetry(query: string): Promise<OverpassResponse> {
    // 406/429/504 are the transient responses the overloaded public instance
    // returns under load; a short pause and one retry usually clears them.
    const retryableStatuses = [406, 429, 504];
    try {
      return await firstValueFrom(this.http.post<OverpassResponse>(this.overpassUrl, query, { headers: { 'Content-Type': 'text/plain' } }));
    } catch (error) {
      if (error instanceof HttpErrorResponse && retryableStatuses.includes(error.status)) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        return firstValueFrom(this.http.post<OverpassResponse>(this.overpassUrl, query, { headers: { 'Content-Type': 'text/plain' } }));
      }
      throw error;
    }
  }

  calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private toAlley(elem: OverpassElement, originLat: number, originLon: number): Alley | null {
    const lat = elem.center?.lat ?? elem.lat;
    const lon = elem.center?.lon ?? elem.lon;
    if (lat === undefined || lon === undefined) {
      return null;
    }

    const tags = elem.tags ?? {};
    const laneCount = tags.lanes ? parseInt(tags.lanes, 10) : undefined;
    return {
      id: `${elem.type}/${elem.id}`,
      name: tags.name ?? 'Bowling Alley',
      lat,
      lon,
      address: this.formatAddress(tags) || undefined,
      phone: tags.phone ?? tags['contact:phone'],
      website: this.normalizeWebsite(tags.website ?? tags['contact:website']),
      openingHours: tags.opening_hours,
      laneCount: laneCount && !isNaN(laneCount) ? laneCount : undefined,
      distanceMeters: this.calculateDistance(originLat, originLon, lat, lon),
      source: 'osm',
    };
  }

  private isLikelyBowlingAlley(elem: OverpassElement): boolean {
    const tags = elem.tags ?? {};
    if (
      tags.leisure === 'bowling_alley' ||
      tags.sport === 'bowling' ||
      tags.sport === '10pin' ||
      tags.sport === '9pin' ||
      tags.amenity === 'bowling_alley'
    ) {
      return true;
    }

    const name = (tags.name ?? '').toLowerCase();
    const positiveKeywords = ['bowling', 'bowl', 'lanes', 'ten pin', 'tenpin'];
    const negativeKeywords = ['restaurant', 'bar', 'pub', 'hotel', 'motel', 'casino', 'pool', 'billiard', 'golf'];
    return positiveKeywords.some((k) => name.includes(k)) && !negativeKeywords.some((k) => name.includes(k));
  }

  /** Removes entries mapped multiple times in OSM (e.g. both node and building way). */
  private dedupe(alleys: Alley[]): Alley[] {
    const result: Alley[] = [];
    for (const alley of alleys) {
      const duplicate = result.some(
        (existing) => this.calculateDistance(alley.lat, alley.lon, existing.lat, existing.lon) < 100 && existing.name === alley.name,
      );
      if (!duplicate) {
        result.push(alley);
      }
    }
    return result;
  }

  private formatAddress(tags: OverpassTags): string {
    const parts: string[] = [];
    if (tags['addr:street']) {
      parts.push(tags['addr:housenumber'] ? `${tags['addr:street']} ${tags['addr:housenumber']}` : tags['addr:street']);
    }
    const city = [tags['addr:postcode'], tags['addr:city']].filter(Boolean).join(' ');
    if (city) {
      parts.push(city);
    }
    return parts.join(', ');
  }

  private normalizeWebsite(website?: string): string | undefined {
    if (!website) {
      return undefined;
    }
    return website.startsWith('http') ? website : `https://${website}`;
  }
}
