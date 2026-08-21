import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Geolocation } from '@capacitor/geolocation';
import { ModalController, SearchbarCustomEvent } from '@ionic/angular';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSearchbar,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronBack, heart, heartOutline, locateOutline, searchOutline } from 'ionicons/icons';
import { Alley } from 'src/app/core/models/alley.model';
import { SearchBlurDirective } from 'src/app/core/directives/search-blur/search-blur.directive';
import { AlleyFavoritesService } from 'src/app/core/services/alley/alley-favorites.service';
import { AlleyService } from 'src/app/core/services/alley/alley.service';
import { GamesStore } from 'src/app/core/stores/games.store';
import { countAlleyUsage, rankByUsage } from 'src/app/core/utils/game-utils/usage.utils';
import { DistancePipe } from 'src/app/shared/pipes/distance-pipe/distance.pipe';

/** Radius searched around the device position when using "Near me". */
const NEARBY_RADIUS_KM = 25;

@Component({
  selector: 'app-alley-select',
  imports: [
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonSearchbar,
    IonSpinner,
    IonTitle,
    IonToolbar,
    SearchBlurDirective,
    DistancePipe,
    NgTemplateOutlet,
  ],
  templateUrl: './alley-select.component.html',
  styleUrls: ['./alley-select.component.scss'],
})
export class AlleySelectComponent {
  private alleyService = inject(AlleyService);
  private modalCtrl = inject(ModalController);
  private gamesStore = inject(GamesStore);
  favoritesService = inject(AlleyFavoritesService);

  /** Alley name already on the game, passed in via `componentProps` to mark the active row. */
  selectedAlley = '';

  searchTerm = signal('');
  results = signal<Alley[]>([]);
  isLoading = signal(false);
  /** Set once a search ran, so the empty state doesn't show before the first query. */
  hasSearched = signal(false);

  /**
   * Saved alleys — the same favorites the alley map keeps — ranked by how often
   * they were played at, matching how the ball and pattern pickers order theirs.
   */
  savedAlleys = computed(() => {
    const usage = countAlleyUsage(this.gamesStore.games());
    return rankByUsage(Array.from(this.favoritesService.favorites().values()), usage, (alley) => alley.name);
  });

  recentAlleys = computed(() => {
    const favoriteIds = this.favoritesService.favorites();
    return this.favoritesService.recents().filter((alley) => !favoriteIds.has(alley.id));
  });

  showSavedLists = computed(() => this.searchTerm().trim().length === 0 && this.results().length === 0);

  /** Nothing found anywhere — offer the typed term as a plain name so the user isn't stuck. */
  showCustomEntry = computed(() => this.hasSearched() && !this.isLoading() && this.results().length === 0 && this.searchTerm().trim().length > 0);

  constructor() {
    addIcons({ chevronBack, heart, heartOutline, locateOutline, searchOutline });
  }

  onSearchInput(event: SearchbarCustomEvent): void {
    const term = event.detail.value ?? '';
    this.searchTerm.set(term);
    if (term.trim().length === 0) {
      this.results.set([]);
      this.hasSearched.set(false);
    }
  }

  async search(): Promise<void> {
    const term = this.searchTerm().trim();
    if (!term) {
      return;
    }

    this.isLoading.set(true);
    try {
      this.results.set(await this.alleyService.searchByText(term));
    } finally {
      this.hasSearched.set(true);
      this.isLoading.set(false);
    }
  }

  async searchNearMe(): Promise<void> {
    this.isLoading.set(true);
    try {
      const position = await Geolocation.getCurrentPosition();
      this.results.set(await this.alleyService.searchNearby(position.coords.latitude, position.coords.longitude, NEARBY_RADIUS_KM));
    } catch (error) {
      console.warn('Could not search alleys near the current position:', error);
      this.results.set([]);
    } finally {
      this.hasSearched.set(true);
      this.isLoading.set(false);
    }
  }

  /** Dismisses with the picked name; the caller applies it to the game. */
  select(alley: Alley): Promise<boolean> {
    this.favoritesService.addRecent(alley);
    return this.modalCtrl.dismiss(alley.name, 'select');
  }

  selectCustom(): Promise<boolean> {
    return this.modalCtrl.dismiss(this.searchTerm().trim(), 'select');
  }

  clear(): Promise<boolean> {
    return this.modalCtrl.dismiss('', 'select');
  }

  cancel(): Promise<boolean> {
    return this.modalCtrl.dismiss(null, 'cancel');
  }

  toggleFavorite(event: Event, alley: Alley): void {
    // The row itself picks the alley; the heart only saves it for later.
    event.stopPropagation();
    this.favoritesService.toggleFavorite(alley);
  }

  isFavorite(alley: Alley): boolean {
    return this.favoritesService.favorites().has(alley.id);
  }

  isSelected(alley: Alley): boolean {
    return this.selectedAlley === alley.name;
  }
}
