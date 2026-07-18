import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, effect, inject, signal, untracked } from '@angular/core';
import { Geolocation } from '@capacitor/geolocation';
import { SearchbarCustomEvent } from '@ionic/angular';
import {
  IonButton,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonLabel,
  IonModal,
  IonSearchbar,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { bowlingBall, cloudOfflineOutline, heart, listOutline, locateOutline, refreshOutline, searchOutline } from 'ionicons/icons';
import * as L from 'leaflet';
import { SearchBlurDirective } from 'src/app/core/directives/search-blur/search-blur.directive';
import { SearchHistoryDirective } from 'src/app/core/directives/search-history/search-history.directive';
import { Alley, AlleyFilters, AlleySearchOrigin, DEFAULT_ALLEY_FILTERS } from 'src/app/core/models/alley.model';
import { AlleyFavoritesService } from 'src/app/core/services/alley/alley-favorites.service';
import { AlleyService } from 'src/app/core/services/alley/alley.service';
import { AnalyticsService } from 'src/app/core/services/analytics/analytics.service';
import { NetworkService } from 'src/app/core/services/network/network.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { getOpenState } from 'src/app/core/utils/opening-hours.util';
import { SearchSuggestionsComponent } from 'src/app/shared/components/search-suggestions/search-suggestions.component';
import { AlleyDetailSheetComponent } from './components/alley-detail-sheet/alley-detail-sheet.component';
import { AlleyListComponent } from './components/alley-list/alley-list.component';

const RADIUS_OPTIONS_KM = [10, 25, 50, 100];
const DEFAULT_COORDS: [number, number] = [40.7128, -74.006];
const DEFAULT_ZOOM = 12;

@Component({
  selector: 'app-alley-map',
  imports: [
    IonLabel,
    IonButton,
    IonChip,
    IonContent,
    IonHeader,
    IonIcon,
    IonModal,
    IonSearchbar,
    IonSpinner,
    IonTitle,
    IonToolbar,
    SearchBlurDirective,
    SearchHistoryDirective,
    SearchSuggestionsComponent,
    AlleyDetailSheetComponent,
    AlleyListComponent,
  ],
  templateUrl: './alley-map.page.html',
  styleUrls: ['./alley-map.page.scss'],
})
export class AlleyMapPage implements OnInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  private alleyService = inject(AlleyService);
  private analyticsService = inject(AnalyticsService);
  private toastService = inject(ToastService);
  favoritesService = inject(AlleyFavoritesService);
  networkService = inject(NetworkService);

  alleys = signal<Alley[]>([]);
  searchTerm = signal('');
  filters = signal<AlleyFilters>({ ...DEFAULT_ALLEY_FILTERS });
  selectedAlley = signal<Alley | null>(null);
  isLoading = signal(false);
  hasError = signal(false);
  errorMessage = signal("Couldn't load alleys.");
  isListOpen = signal(false);
  locationState = signal<'pending' | 'granted' | 'denied'>('pending');
  searchOrigin = signal<AlleySearchOrigin>({ lat: DEFAULT_COORDS[0], lon: DEFAULT_COORDS[1], source: 'user' });

  filteredAlleys = computed(() => {
    const { openNow, favoritesOnly } = this.filters();
    const favorites = this.favoritesService.favorites();
    return this.alleys().filter((alley) => (!openNow || getOpenState(alley.openingHours) === 'open') && (!favoritesOnly || favorites.has(alley.id)));
  });

  showEmptyState = computed(() => !this.isLoading() && !this.hasError() && this.alleys().length > 0 && this.filteredAlleys().length === 0);
  showNoResults = computed(() => !this.isLoading() && !this.hasError() && this.alleys().length === 0 && this.locationState() !== 'pending');

  private map?: L.Map;
  private clusterGroup?: L.MarkerClusterGroup;
  private userMarker?: L.Marker;
  private markersById = new Map<string, L.Marker>();
  private resizeObserver?: ResizeObserver;
  private radiusReloadTimer?: ReturnType<typeof setTimeout>;
  private moveFetchTimer?: ReturnType<typeof setTimeout>;
  private loadSequence = 0;

  constructor() {
    addIcons({ bowlingBall, cloudOfflineOutline, heart, listOutline, locateOutline, refreshOutline, searchOutline });

    // Rebuild markers when the visible set changes; update icons in place on
    // selection/favorite changes so open clusters don't collapse.
    effect(() => {
      const alleys = this.filteredAlleys();
      untracked(() => this.renderMarkers(alleys));
    });
    effect(() => {
      const selectedId = this.selectedAlley()?.id ?? null;
      const favorites = this.favoritesService.favorites();
      untracked(() => this.updateMarkerIcons(selectedId, favorites));
    });
  }

  async ngOnInit(): Promise<void> {
    await this.initializeMap();
    void this.locateAndLoad();
  }

  ngOnDestroy(): void {
    clearTimeout(this.radiusReloadTimer);
    clearTimeout(this.moveFetchTimer);
    this.resizeObserver?.disconnect();
    this.map?.off();
    this.map?.remove();
  }

  async onSearch(query: string): Promise<void> {
    await this.runPlaceSearch(query);
  }

  onSearchInput(event: SearchbarCustomEvent): void {
    this.searchTerm.set(event.detail.value ?? '');
  }

  onSearchSuggestionSelected(term: string): void {
    this.searchTerm.set(term);
    void this.runPlaceSearch(term);
  }

  private async runPlaceSearch(query: string | undefined): Promise<void> {
    if (!query) {
      // Only jump back when clearing an active place search, not on a blur of an empty bar.
      if (this.searchOrigin().source === 'search') {
        await this.recenterOnUser(false);
      }
      return;
    }

    void this.analyticsService.trackAlleySearch(query);
    try {
      const result = await this.alleyService.geocode(query);
      if (!result) {
        this.toastService.showToast(`No place found for "${query}"`, 'search-outline');
        return;
      }
      this.searchOrigin.set({ lat: result.lat, lon: result.lon, source: 'search', label: result.label });
      this.map?.flyTo([result.lat, result.lon], DEFAULT_ZOOM, { duration: 0.8 });
      await this.loadAlleys();
    } catch {
      this.toastService.showToast('Search failed. Check your connection.', 'cloud-offline-outline', true);
    }
  }

  async recenterOnUser(showErrors = true): Promise<void> {
    try {
      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
      const coords: [number, number] = [position.coords.latitude, position.coords.longitude];
      this.locationState.set('granted');
      this.searchOrigin.set({ lat: coords[0], lon: coords[1], source: 'user' });
      this.updateUserMarker(coords);
      this.map?.flyTo(coords, DEFAULT_ZOOM, { duration: 0.8 });
      await this.loadAlleys();
    } catch {
      this.locationState.set('denied');
      if (showErrors) {
        this.toastService.showToast('Location unavailable. Search for a place instead.', 'locate-outline', true);
      }
    }
  }

  toggleOpenNow(): void {
    this.filters.update((f) => ({ ...f, openNow: !f.openNow }));
  }

  toggleFavoritesOnly(): void {
    this.filters.update((f) => ({ ...f, favoritesOnly: !f.favoritesOnly }));
  }

  cycleRadius(): void {
    const current = this.filters().radiusKm;
    const next = RADIUS_OPTIONS_KM[(RADIUS_OPTIONS_KM.indexOf(current) + 1) % RADIUS_OPTIONS_KM.length];
    this.filters.update((f) => ({ ...f, radiusKm: next }));
    // Debounced so tapping through the radius options fires one request, not four.
    clearTimeout(this.radiusReloadTimer);
    this.radiusReloadTimer = setTimeout(() => void this.loadAlleys(), 700);
  }

  async expandRadius(): Promise<void> {
    const larger = RADIUS_OPTIONS_KM.find((r) => r > this.filters().radiusKm);
    if (larger) {
      this.filters.update((f) => ({ ...f, radiusKm: larger }));
      await this.loadAlleys();
    }
  }

  async retry(): Promise<void> {
    await this.loadAlleys();
  }

  selectAlley(alley: Alley): void {
    this.selectedAlley.set(alley);
    this.isListOpen.set(false);
    this.favoritesService.addRecent(alley);
    this.panToAlley(alley);
  }

  onListSelect(alley: Alley): void {
    this.isListOpen.set(false);
    this.selectAlley(alley);
  }

  onSheetDismiss(): void {
    this.selectedAlley.set(null);
  }

  private async initializeMap(): Promise<void> {
    // The markercluster dist bundle attaches itself to the global `L`, not to
    // the Leaflet module instance this page imports. In optimized builds those
    // are different objects, so point the global at our instance and only then
    // load the plugin. Loaded dynamically because a static import would be
    // hoisted above the assignment (and import sorters could reorder it).
    (window as unknown as { L: typeof L }).L = L;
    await import('leaflet.markercluster/dist/leaflet.markercluster.js');

    this.map = L.map(this.mapContainer.nativeElement, {
      center: DEFAULT_COORDS,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(this.map);

    this.clusterGroup = L.markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      maxClusterRadius: 60,
    });
    this.map.addLayer(this.clusterGroup);

    this.map.on('moveend', () => this.onMapMoved());

    // The container gets its final size only after Ionic finishes layout;
    // without this Leaflet renders tiles for a collapsed viewport.
    this.resizeObserver = new ResizeObserver(() => this.map?.invalidateSize());
    this.resizeObserver.observe(this.mapContainer.nativeElement);
  }

  private async locateAndLoad(): Promise<void> {
    await this.recenterOnUser(false);
    // Without a location fix we stay at the default view; load it anyway so
    // the map isn't empty and the user can search from there.
    if (this.locationState() === 'denied') {
      await this.loadAlleys();
    }
  }

  private async loadAlleys(): Promise<void> {
    const origin = this.searchOrigin();
    const sequence = ++this.loadSequence;
    this.isLoading.set(true);
    this.hasError.set(false);
    try {
      const alleys = await this.alleyService.searchNearby(origin.lat, origin.lon, this.filters().radiusKm);
      if (sequence === this.loadSequence) {
        this.alleys.set(alleys);
      }
    } catch (error) {
      console.error('Error loading bowling alleys:', error);
      if (sequence === this.loadSequence) {
        this.hasError.set(true);
        const busy = error instanceof HttpErrorResponse && [406, 429, 504].includes(error.status);
        this.errorMessage.set(busy ? 'The map server is busy. Wait a moment, then retry.' : "Couldn't load alleys.");
      }
    } finally {
      if (sequence === this.loadSequence) {
        this.isLoading.set(false);
      }
    }
  }

  private onMapMoved(): void {
    clearTimeout(this.moveFetchTimer);
    this.moveFetchTimer = setTimeout(() => void this.fetchAroundMapCenter(), 900);
  }

  /** Reloads alleys around the map center once panning settles far enough from the last origin. */
  private async fetchAroundMapCenter(): Promise<void> {
    // Skip while a fly-to animation for a selected alley is showing its sheet.
    if (!this.map || this.isLoading() || this.selectedAlley() !== null) {
      return;
    }
    const origin = this.searchOrigin();
    const center = this.map.getCenter();
    const movedMeters = this.alleyService.calculateDistance(origin.lat, origin.lon, center.lat, center.lng);
    const threshold = Math.max(2000, this.filters().radiusKm * 1000 * 0.25);
    if (movedMeters <= threshold) {
      return;
    }
    this.searchOrigin.set({ lat: center.lat, lon: center.lng, source: 'search' });
    await this.loadAlleys();
  }

  private renderMarkers(alleys: Alley[]): void {
    if (!this.map || !this.clusterGroup) {
      return;
    }
    this.clusterGroup.clearLayers();
    this.markersById.clear();

    const selectedId = this.selectedAlley()?.id ?? null;
    const favorites = this.favoritesService.favorites();
    for (const alley of alleys) {
      const marker = L.marker([alley.lat, alley.lon], {
        icon: this.createPinIcon(favorites.has(alley.id), alley.id === selectedId),
        alt: alley.name,
        keyboard: true,
      });
      marker.on('click', () => this.selectAlley(alley));
      this.markersById.set(alley.id, marker);
      this.clusterGroup.addLayer(marker);
    }
  }

  private updateMarkerIcons(selectedId: string | null, favorites: Map<string, Alley>): void {
    this.markersById.forEach((marker, id) => {
      marker.setIcon(this.createPinIcon(favorites.has(id), id === selectedId));
      marker.setZIndexOffset(id === selectedId ? 1000 : 0);
    });
  }

  private createPinIcon(isFavorite: boolean, isSelected: boolean): L.DivIcon {
    const classes = ['alley-pin'];
    if (isFavorite) {
      classes.push('alley-pin--favorite');
    }
    if (isSelected) {
      classes.push('alley-pin--selected');
    }
    return L.divIcon({
      className: '',
      html: `<div class="${classes.join(' ')}"><ion-icon name="bowling-ball" aria-hidden="true"></ion-icon></div>`,
      iconSize: [36, 44],
      iconAnchor: [18, 44],
    });
  }

  private updateUserMarker(coords: [number, number]): void {
    if (!this.map) {
      return;
    }
    if (!this.userMarker) {
      this.userMarker = L.marker(coords, {
        icon: L.divIcon({ className: '', html: '<div class="user-dot"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }),
        interactive: false,
        keyboard: false,
      }).addTo(this.map);
    } else {
      this.userMarker.setLatLng(coords);
    }
  }

  /** Flies to the alley, offset downwards so the pin stays visible above the bottom sheet. */
  private panToAlley(alley: Alley): void {
    if (!this.map) {
      return;
    }
    const zoom = Math.max(this.map.getZoom(), 14);
    const offsetY = this.mapContainer.nativeElement.clientHeight * 0.15;
    const point = this.map.project([alley.lat, alley.lon], zoom).add([0, offsetY]);
    this.map.flyTo(this.map.unproject(point, zoom), zoom, { duration: 0.6 });
  }
}
