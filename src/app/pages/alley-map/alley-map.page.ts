import { Component, ElementRef, ViewChild, OnInit, OnDestroy, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IonToolbar, IonHeader, IonContent, IonSearchbar, IonTitle } from '@ionic/angular/standalone';
import * as L from 'leaflet';
import { SearchbarCustomEvent } from '@ionic/angular';
import { AnalyticsService } from 'src/app/core/services/analytics/analytics.service';

// Type definitions for Overpass API
interface OverpassTags {
  name?: string;
  leisure?: string;
  sport?: string;
  amenity?: string;
  opening_hours?: string;
  phone?: string;
  website?: string;
  'addr:housenumber'?: string;
  'addr:street'?: string;
  'addr:city'?: string;
  'addr:postcode'?: string;
  'addr:country'?: string;
  [key: string]: string | undefined;
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: {
    lat: number;
    lon: number;
  };
  tags?: OverpassTags;
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

if (L.Icon?.Default?.prototype) {
  const iconPrototype = L.Icon.Default.prototype as unknown as Record<string, unknown>;
  if (typeof iconPrototype['_getIconUrl'] === 'function') {
    delete iconPrototype['_getIconUrl'];
  }

  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'assets/leaflet/marker-icon-2x.png',
    iconUrl: 'assets/leaflet/marker-icon.png',
    shadowUrl: 'assets/leaflet/marker-shadow.png',
  });
}

@Component({
  selector: 'app-alley-map',
  imports: [IonTitle, IonSearchbar, IonContent, IonHeader, IonToolbar],
  templateUrl: './alley-map.page.html',
  styleUrls: ['./alley-map.page.css'],
})
export class AlleyMapPage implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private analyticsService = inject(AnalyticsService);

  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef;

  private map!: L.Map;
  private markerClusterGroup!: L.LayerGroup;
  private userMarker!: L.CircleMarker;
  private userCoords: [number, number] = [40.7128, -74.006];
  private initialUserCoords: [number, number] | null = null;
  private readonly overpassUrl = 'https://overpass-api.de/api/interpreter';
  private readonly nominatimUrl = 'https://nominatim.openstreetmap.org/search';

  async ngOnInit(): Promise<void> {
    this.initializeMapAndAttemptGeolocation();
  }

  async onSearch(event: SearchbarCustomEvent): Promise<void> {
    const query = event.detail.value;
    if (!query || query.trim() === '') {
      this.resetToInitialLocation();
      return;
    }

    void this.analyticsService.trackAlleySearch(query);

    try {
      const url = `${this.nominatimUrl}?q=${encodeURIComponent(query)}&format=json&limit=1`;
      const results: NominatimResult[] = (await this.http.get<NominatimResult[]>(url).toPromise()) || [];
      if (results && results.length > 0) {
        const { lat, lon } = results[0];
        this.userCoords = [parseFloat(lat), parseFloat(lon)];
        this.map.setView(this.userCoords, 13);
        if (this.userMarker) {
          this.userMarker.setLatLng(this.userCoords).setPopupContent('Searched Location').openPopup();
        }
        await this.loadBowlingAlleysWithFallback();
      } else {
        console.warn('No results found for:', query);
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    }
  }

  private async resetToInitialLocation(): Promise<void> {
    if (this.initialUserCoords) {
      this.userCoords = [...this.initialUserCoords];
      this.map.setView(this.userCoords, 13);
      if (this.userMarker) {
        this.userMarker.setLatLng(this.userCoords).setPopupContent('You!').openPopup();
      }
      await this.loadBowlingAlleysWithFallback();
    }
  }
  private initializeMapAndAttemptGeolocation(): void {
    if (this.map) {
      this.map.off();
      this.map.remove();
    }
    this.map = L.map(this.mapContainer.nativeElement);

    if (navigator.geolocation) {
      const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      };

      navigator.geolocation.getCurrentPosition(
        async ({ coords }) => {
          this.userCoords = [coords.latitude, coords.longitude];
          this.initialUserCoords = [coords.latitude, coords.longitude];
          this.map.setView(this.userCoords, 13);
          await this.addMapLayersAndMarkers();
        },
        async (error) => {
          console.warn(`Error getting current location: ${error.message} (Code: ${error.code})`);
          this.initialUserCoords = [...this.userCoords];
          this.map.setView(this.userCoords, 13);
          await this.addMapLayersAndMarkers();
        },
        options,
      );
    } else {
      console.warn('Geolocation not supported.');
      this.initialUserCoords = [...this.userCoords];
      this.map.setView(this.userCoords, 13);
      void this.addMapLayersAndMarkers();
    }
  }

  private async addMapLayersAndMarkers(): Promise<void> {
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(this.map);

    this.userMarker = L.circleMarker(this.userCoords, {
      radius: 8,
      fillColor: 'red',
      color: 'red',
      weight: 1,
      opacity: 1,
      fillOpacity: 0.8,
    })
      .addTo(this.map)
      .bindPopup('You!')
      .openPopup();

    if (typeof (L as unknown as { markerClusterGroup?: () => L.LayerGroup }).markerClusterGroup === 'function') {
      this.markerClusterGroup = (L as unknown as { markerClusterGroup: () => L.LayerGroup }).markerClusterGroup();
      this.map.addLayer(this.markerClusterGroup);
    }

    await this.loadBowlingAlleysWithFallback();
  }

  private async loadBowlingAlleys(): Promise<void> {
    if (this.markerClusterGroup) {
      this.markerClusterGroup.clearLayers();
    }

    const [lat, lon] = this.userCoords;
    const radius = 50000;

    // More comprehensive but simpler query to avoid API errors
    const query = `
[out:json][timeout:25];
(
  node["leisure"="bowling_alley"](around:${radius},${lat},${lon});
  way["leisure"="bowling_alley"](around:${radius},${lat},${lon});
  relation["leisure"="bowling_alley"](around:${radius},${lat},${lon});
  node["sport"="bowling"](around:${radius},${lat},${lon});
  way["sport"="bowling"](around:${radius},${lat},${lon});
  relation["sport"="bowling"](around:${radius},${lat},${lon});
  node["sport"="10pin"](around:${radius},${lat},${lon});
  way["sport"="10pin"](around:${radius},${lat},${lon});
  relation["sport"="10pin"](around:${radius},${lat},${lon});
  node["amenity"="bowling_alley"](around:${radius},${lat},${lon});
  way["amenity"="bowling_alley"](around:${radius},${lat},${lon});
  relation["amenity"="bowling_alley"](around:${radius},${lat},${lon});
);
out center;`;

    try {
      const response = (await this.http
        .post(this.overpassUrl, query, {
          headers: { 'Content-Type': 'text/plain' },
        })
        .toPromise()) as OverpassResponse;

      if (response?.elements?.length) {
        // Filter and score results for accuracy
        const validBowlingAlleys = this.filterBowlingAlleys(response.elements);
        this.addMarkersToMap(validBowlingAlleys, lat, lon);
        console.warn(`Found ${validBowlingAlleys.length} bowling alleys out of ${response.elements.length} total results`);
      } else {
        console.warn('No bowling alleys found nearby.');
        // Try a simpler fallback search
        await this.searchWithSimpleQuery(lat, lon, radius);
      }
    } catch (error) {
      console.error('Error loading bowling alleys:', error);
      console.warn('Trying fallback search method...');
      // Try a simpler search as fallback
      await this.searchWithSimpleQuery(lat, lon, radius);
    }
  }

  private async searchWithSimpleQuery(lat: number, lon: number, radius: number): Promise<void> {
    const simpleQuery = `
[out:json][timeout:15];
(
  node["leisure"="bowling_alley"](around:${radius},${lat},${lon});
  way["leisure"="bowling_alley"](around:${radius},${lat},${lon});
);
out center;`;

    try {
      const response = (await this.http
        .post(this.overpassUrl, simpleQuery, {
          headers: { 'Content-Type': 'text/plain' },
        })
        .toPromise()) as OverpassResponse;

      if (response?.elements?.length) {
        this.addMarkersToMap(response.elements, lat, lon);
        console.warn(`Fallback search found ${response.elements.length} bowling alleys`);
      }
    } catch (error) {
      console.error('Fallback search also failed:', error);
    }
  }

  private addMarkersToMap(elements: OverpassElement[], lat: number, lon: number): void {
    const blueIcon = new L.Icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    });

    elements.forEach((elem) => {
      const elemLat = elem.center?.lat ?? elem.lat;
      const elemLon = elem.center?.lon ?? elem.lon;

      if (elemLat === undefined || elemLon === undefined) {
        return; // Skip elements without coordinates
      }

      const coords: [number, number] = [elemLat, elemLon];
      const tags = elem.tags || {};
      const name = tags.name || 'Bowling Alley';
      const openingHours = tags.opening_hours;
      const phone = tags.phone;
      const website = tags.website;
      const address = this.formatAddress(tags);

      // Calculate distance from user
      const distanceKm = this.calculateDistance(lat, lon, coords[0], coords[1]) / 1000;

      let popupContent = `<b>${name}</b>`;
      if (address) {
        popupContent += `<br><i>${address}</i>`;
      }
      popupContent += `<br><b>Distance:</b> ${distanceKm.toFixed(1)} km`;
      if (openingHours) {
        const formattedHours = openingHours.replace(/;\s*/g, '<br>');
        popupContent += `<br><b>Hours:</b><br>${formattedHours}`;
      }
      if (phone) {
        popupContent += `<br><b>Phone:</b> ${phone}`;
      }
      if (website) {
        const url = website.startsWith('http') ? website : `http://${website}`;
        popupContent += `<br><a href="${url}" target="_blank" rel="noopener noreferrer">Website</a>`;
      }

      const marker = L.marker(coords, { icon: blueIcon });
      marker.bindPopup(popupContent);
      if (this.markerClusterGroup) {
        this.markerClusterGroup.addLayer(marker);
      } else {
        marker.addTo(this.map);
      }
    });
  }

  private filterBowlingAlleys(elements: OverpassElement[]): OverpassElement[] {
    return elements.filter((elem) => {
      const tags = elem.tags || {};
      const name = (tags.name || '').toLowerCase();

      // Primary bowling identifiers - always include these
      if (tags.leisure === 'bowling_alley' || tags.sport === 'bowling' || tags.sport === '10pin' || tags.amenity === 'bowling_alley') {
        return true;
      }

      // Name-based filtering with positive and negative keywords
      const positiveKeywords = ['bowling', 'bowl', 'alley', 'lanes', 'ten pin', 'tenpin', 'strike', 'spare'];
      const negativeKeywords = ['restaurant', 'bar', 'pub', 'hotel', 'motel', 'casino', 'pool', 'billiard', 'golf'];

      const hasPositiveKeyword = positiveKeywords.some((keyword) => name.includes(keyword));
      const hasNegativeKeyword = negativeKeywords.some((keyword) => name.includes(keyword));

      // Include if it has bowling-related keywords and no negative keywords
      if (hasPositiveKeyword && !hasNegativeKeyword) {
        return true;
      }

      // Additional filtering for entertainment venues
      if (tags.amenity === 'entertainment' && hasPositiveKeyword) {
        return true;
      }

      // Tourism attractions with bowling in the name
      if (tags['tourism'] === 'attraction' && hasPositiveKeyword) {
        return true;
      }

      return false;
    });
  }

  private formatAddress(tags: OverpassTags): string {
    const parts = [];

    if (tags['addr:housenumber'] && tags['addr:street']) {
      parts.push(`${tags['addr:housenumber']} ${tags['addr:street']}`);
    } else if (tags['addr:street']) {
      parts.push(tags['addr:street']);
    }

    if (tags['addr:city']) {
      parts.push(tags['addr:city']);
    }

    if (tags['addr:postcode']) {
      parts.push(tags['addr:postcode']);
    }

    return parts.join(', ');
  }

  private async loadBowlingAlleysWithFallback(): Promise<void> {
    // Try the comprehensive search first
    await this.loadBowlingAlleys();

    // If we didn't find many results, try additional searches
    const currentMarkers = this.markerClusterGroup?.getLayers().length || 0;
    console.warn(`Initial search found ${currentMarkers} bowling alleys`);

    if (currentMarkers < 5) {
      console.warn('Few results found, trying fallback searches...');

      // Try name-based search first (faster and more reliable)
      const [lat, lon] = this.userCoords;
      await this.searchByNameFallback(lat, lon, 50000);

      // If still not enough results, try wider radius search
      const newMarkerCount = this.markerClusterGroup?.getLayers().length || 0;
      if (newMarkerCount < 3) {
        await this.searchWithDifferentRadii();
      }
    }
  }

  private async searchWithDifferentRadii(): Promise<void> {
    const [lat, lon] = this.userCoords;
    const radii = [75000, 100000]; // 75km, 100km

    for (const radius of radii) {
      const query = `
[out:json][timeout:30];
(
  // Focus on the most reliable tags for wider searches
  node["leisure"="bowling_alley"](around:${radius},${lat},${lon});
  way["leisure"="bowling_alley"](around:${radius},${lat},${lon});
  node["sport"="bowling"](around:${radius},${lat},${lon});
  way["sport"="bowling"](around:${radius},${lat},${lon});
  
  // Name-based search with stricter filtering
  node["name"~".*[Bb]owling.*"](around:${radius},${lat},${lon});
  way["name"~".*[Bb]owling.*"](around:${radius},${lat},${lon});
);
out center;`;

      try {
        const response = (await this.http
          .post(this.overpassUrl, query, {
            headers: { 'Content-Type': 'text/plain' },
          })
          .toPromise()) as OverpassResponse;

        if (response?.elements?.length) {
          const newAlleys = this.filterBowlingAlleys(response.elements);
          const existingMarkers = this.markerClusterGroup?.getLayers() || [];

          newAlleys.forEach((elem) => {
            const elemLat = elem.center?.lat ?? elem.lat;
            const elemLon = elem.center?.lon ?? elem.lon;

            if (elemLat === undefined || elemLon === undefined) {
              return; // Skip elements without coordinates
            }

            const coords: [number, number] = [elemLat, elemLon];

            // Check if this location already exists (avoid duplicates)
            const isDuplicate = existingMarkers.some((marker: L.Layer) => {
              const markerLatLng = (marker as L.Marker).getLatLng();
              const distance = this.calculateDistance(coords[0], coords[1], markerLatLng.lat, markerLatLng.lng);
              return distance < 100; // Less than 100 meters apart
            });

            if (!isDuplicate) {
              const tags = elem.tags || {};
              const name = tags.name || 'Bowling Alley';
              const address = this.formatAddress(tags);

              // Calculate distance from user
              const distanceKm = this.calculateDistance(lat, lon, coords[0], coords[1]) / 1000;

              const blueIcon = new L.Icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41],
              });

              let popupContent = `<b>${name}</b>`;
              if (address) {
                popupContent += `<br><i>${address}</i>`;
              }
              popupContent += `<br><b>Distance:</b> ${distanceKm.toFixed(1)} km`;

              const marker = L.marker(coords, { icon: blueIcon });
              marker.bindPopup(popupContent);
              if (this.markerClusterGroup) {
                this.markerClusterGroup.addLayer(marker);
              } else {
                marker.addTo(this.map);
              }
            }
          });

          // Use console.warn instead of console.log per linting rules
        }
      } catch (error) {
        console.error(`Error in fallback search with radius ${radius}:`, error);
      }
    }
  }

  private async searchByNameFallback(lat: number, lon: number, radius: number): Promise<void> {
    // Search for places with bowling-related names
    const nameQuery = `
[out:json][timeout:15];
(
  node["name"~"[Bb]owling"](around:${radius},${lat},${lon});
  way["name"~"[Bb]owling"](around:${radius},${lat},${lon});
  node["name"~"[Aa]lley"](around:${radius},${lat},${lon});
  way["name"~"[Aa]lley"](around:${radius},${lat},${lon});
  node["name"~"[Ll]anes"](around:${radius},${lat},${lon});
  way["name"~"[Ll]anes"](around:${radius},${lat},${lon});
);
out center;`;

    try {
      const response = (await this.http
        .post(this.overpassUrl, nameQuery, {
          headers: { 'Content-Type': 'text/plain' },
        })
        .toPromise()) as OverpassResponse;

      if (response?.elements?.length) {
        // Filter results to only include likely bowling alleys
        const filteredResults = this.filterBowlingAlleys(response.elements);
        if (filteredResults.length > 0) {
          this.addMarkersToMap(filteredResults, lat, lon);
          console.warn(`Name-based search found ${filteredResults.length} additional bowling alleys`);
        }
      }
    } catch (error) {
      console.error('Name-based search failed:', error);
    }
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }
}
