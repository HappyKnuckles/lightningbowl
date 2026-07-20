import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, OnInit, Signal, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ImpactStyle } from '@capacitor/haptics';
import { InfiniteScrollCustomEvent, ModalController, RefresherCustomEvent, SearchbarCustomEvent } from '@ionic/angular';
import {
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonIcon,
  IonImg,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonModal,
  IonRefresher,
  IonRippleEffect,
  IonSkeletonText,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import Fuse from 'fuse.js';
import { addIcons } from 'ionicons';
import { addOutline, camera, chevronDownOutline, closeCircle, filterOutline, globeOutline, heart, heartOutline, openOutline } from 'ionicons/icons';
import { Subject } from 'rxjs';
import { BALL_FILTER_CONFIGS } from 'src/app/core/configs/filter/ball-filter.config';
import { TOAST_MESSAGES } from 'src/app/core/constants/toast-messages.constants';
import { SearchBlurDirective } from 'src/app/core/directives/search-blur/search-blur.directive';
import { SearchHistoryDirective } from 'src/app/core/directives/search-history/search-history.directive';
import { Ball } from 'src/app/core/models/ball.model';
import { BallSortField, BallSortOption, SortDirection } from 'src/app/core/models/sort.model';
import { AnalyticsService } from 'src/app/core/services/analytics/analytics.service';
import { BallFilterService } from 'src/app/core/services/ball-filter/ball-filter.service';
import { getFlareLabel, getLengthLabel } from 'src/app/core/services/ball/ball-metrics.util';
import { BallService } from 'src/app/core/services/ball/ball.service';
import { FavoritesService } from 'src/app/core/services/favorites/favorites.service';
import { HapticService } from 'src/app/core/services/haptic/haptic.service';
import { LoadingService } from 'src/app/core/services/loader/loading.service';
import { NetworkService } from 'src/app/core/services/network/network.service';
import { BallSortService } from 'src/app/core/services/sort/ball-sort.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { buildSearchSuggestions } from 'src/app/core/utils/search-utils/suggestion.utils';
import { BallFilterComponent } from 'src/app/shared/components/ball-filter/ball-filter.component';
import { BallListComponent } from 'src/app/shared/components/ball-list/ball-list.component';
import { GenericFilterActiveComponent } from 'src/app/shared/components/generic-filter-active/generic-filter-active.component';
import { SearchSuggestionsComponent } from 'src/app/shared/components/search-suggestions/search-suggestions.component';
import { SortHeaderComponent } from 'src/app/shared/components/sort-header/sort-header.component';
import { BowlingRefresherComponent } from 'src/app/shared/components/bowling-refresher/bowling-refresher.component';

@Component({
  selector: 'app-balls',
  templateUrl: './balls.page.html',
  styleUrls: ['./balls.page.scss'],
  providers: [ModalController],
  imports: [
    IonRefresher,
    IonSkeletonText,
    BowlingRefresherComponent,
    IonRippleEffect,
    IonModal,
    IonText,
    IonButton,
    IonButtons,
    IonIcon,
    IonCardSubtitle,
    IonSearchbar,
    IonInfiniteScrollContent,
    IonInfiniteScroll,
    IonCardHeader,
    IonCard,
    IonCardContent,
    IonImg,
    IonCardTitle,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonSelect,
    IonSelectOption,
    CommonModule,
    FormsModule,
    BallListComponent,
    GenericFilterActiveComponent,
    SearchBlurDirective,
    SearchHistoryDirective,
    SearchSuggestionsComponent,
    SortHeaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BallsPage implements OnInit {
  @ViewChild(IonContent, { static: false }) content!: IonContent;

  ballFilterConfigs = BALL_FILTER_CONFIGS;

  readonly currentFilters = this.ballFilterService.filters;

  readonly defaultFilters = this.ballFilterService.defaultFilters;

  balls = signal<Ball[]>([]);
  coreBalls = signal<Ball[]>([]);
  coverstockBalls = signal<Ball[]>([]);
  movementBalls = signal<Ball[]>([]);
  searchSubject = new Subject<string>();
  searchTerm = signal('');
  searchSuggestions = computed(() =>
    buildSearchSuggestions(
      this.ballsStore.allBalls().map((ball) => ball.ball_name),
      this.searchTerm(),
    ),
  );
  searchDisabled = computed(() => this.ballsStore.allBalls().length === 0);
  favoritesFirst = signal(false);
  currentPage = 0;
  isPageLoading = signal(false);
  hasMoreData = true;
  filterDisplayCount = 100;
  loadingWeightBallIds = signal<Set<string>>(new Set());
  readonly availableWeights = ['12', '13', '14', '15', '16'];
  currentSortOption = signal<BallSortOption>({
    field: BallSortField.RELEASE_DATE,
    direction: SortDirection.DESC,
    label: 'Newest First',
  });

  // Computed getter for displayed balls.
  // • If a search term exists, we build a Fuse instance over the correct data source and return results sorted by relevance.
  // • If filters are active and no search term exists, we display only a slice (up to filterDisplayCount) of the filtered list.
  // • Otherwise, we display the paged API-loaded balls.
  displayedBalls: Signal<Ball[]> = computed(() => {
    let result: Ball[];
    if (this.searchTerm().trim() !== '') {
      this.hasMoreData = false;
      const options = {
        keys: [
          { name: 'ball_name', weight: 1 },
          { name: 'brand_name', weight: 0.9 },
          { name: 'core_name', weight: 0.7 },
          { name: 'coverstock_name', weight: 0.7 },
          { name: 'factory_finish', weight: 0.5 },
        ],
        threshold: 0.2,
        ignoreLocation: true,
        minMatchCharLength: 3,
        includeMatches: false,
        includeScore: false,
        shouldSort: true,
        useExtendedSearch: false,
      };

      const baseArray = this.isFilterActive() ? this.ballFilterService.filteredBalls() : this.ballsStore.allBalls();
      const fuseInstance = new Fuse(baseArray, options);

      // Split the search term by commas and trim each term
      const searchTerms = this.searchTerm()
        .split(',')
        .map((term) => term.trim());

      // Collect results for each search term
      result = searchTerms.flatMap((term) => fuseInstance.search(term).map((result) => result.item));

      return result;
    } else {
      result = this.isFilterActive() ? this.ballFilterService.filteredBalls() : this.balls();
      if (this.isFilterActive()) {
        result = result.slice(0, this.filterDisplayCount);
      }
      this.hasMoreData = true;
    }

    return this.sortService.sortBalls(result, this.currentSortOption(), this.favoritesFirst());
  });

  private lastLoadTime = 0;
  private debounceMs = 300;

  constructor(
    private modalCtrl: ModalController,
    public loadingService: LoadingService,
    public ballsStore: BallsStore,
    private toastService: ToastService,
    private hapticService: HapticService,
    private ballService: BallService,
    public ballFilterService: BallFilterService,
    private route: ActivatedRoute,
    public sortService: BallSortService,
    private networkService: NetworkService,
    public favoritesService: FavoritesService,
    private analyticsService: AnalyticsService,
  ) {
    addIcons({ filterOutline, closeCircle, globeOutline, openOutline, addOutline, camera, heart, heartOutline, chevronDownOutline });
    this.searchSubject.subscribe((query) => {
      this.searchTerm.set(query);
      if (this.content) {
        setTimeout(() => {
          this.content.scrollToTop(300);
        }, 300);
      }
    });
    this.route.queryParams.subscribe((params) => {
      if (params['search']) {
        this.searchTerm.set(params['search']);
      }
    });
  }

  async ngOnInit(): Promise<void> {
    this.isPageLoading.set(true);
    this.loadFavoritesFirstSetting();
    try {
      await this.waitForAllBalls();
      await this.loadBalls();
    } catch (error) {
      console.error('Error loading balls:', error);
    } finally {
      this.isPageLoading.set(false);
    }
  }

  private async waitForAllBalls(): Promise<void> {
    const maxWaitTime = 10000;
    const checkInterval = 100;
    let elapsed = 0;

    while (this.ballsStore.allBalls().length === 0 && elapsed < maxWaitTime) {
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
      elapsed += checkInterval;
    }

    if (elapsed >= maxWaitTime) {
      console.warn('Timeout waiting for allBalls to load');
    }
  }

  async handleRefresh(event: RefresherCustomEvent): Promise<void> {
    try {
      this.hapticService.vibrate(ImpactStyle.Medium);
      this.isPageLoading.set(true);
      this.currentPage = 0;
      this.hasMoreData = true;
      this.balls.set([]);
      if (this.isFilterActive()) {
        this.filterDisplayCount = 100;
      }
      await Promise.all([this.ballsStore.loadAllBalls(undefined, undefined, true), this.ballsStore.loadArsenal()]);
      await this.loadBalls();
    } catch (error) {
      console.error(error);
      this.toastService.showToast(TOAST_MESSAGES.ballLoadError, 'bug', true);
    } finally {
      event.target.complete();
      this.isPageLoading.set(false);
    }
  }

  searchBalls(event: SearchbarCustomEvent): void {
    const query = event.detail.value!.toLowerCase();
    this.searchSubject.next(query);
    this.analyticsService.trackBallSearch(query);
  }

  onSearchSuggestionSelected(term: string): void {
    this.searchSubject.next(term);
  }

  async removeFromArsenal(ball: Ball): Promise<void> {
    try {
      this.hapticService.vibrate(ImpactStyle.Light);
      await this.ballsStore.removeFromArsenal(ball);
      this.toastService.showToast(`${ball.ball_name} removed from Arsenal.`, 'checkmark-outline');
    } catch (error) {
      console.error(`Fehler beim Entfernen von ${ball.ball_name} aus dem Arsenal:`, error);
      this.toastService.showToast(TOAST_MESSAGES.ballDeleteError, 'bug', true);
    }
  }

  async saveBallToArsenal(ball: Ball): Promise<void> {
    try {
      this.hapticService.vibrate(ImpactStyle.Light);
      await this.ballsStore.saveBallToArsenal(ball);
      this.toastService.showToast(`${ball.ball_name} added to Arsenal.`, 'add');
    } catch (error) {
      console.error(`Fehler beim Speichern von ${ball.ball_name} im Arsenal:`, error);
      this.toastService.showToast(TOAST_MESSAGES.ballSaveError, 'bug', true);
    }
  }

  async openFilterModal(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: BallFilterComponent,
    });
    modal.onDidDismiss().then(() => {
      this.currentPage = 0;
      this.hasMoreData = true;
      this.filterDisplayCount = 100;
      if (this.content) {
        setTimeout(() => {
          this.content.scrollToTop(300);
        }, 300);
      }
    });
    return await modal.present();
  }

  async loadBalls(event?: InfiniteScrollCustomEvent): Promise<void> {
    const now = Date.now();
    if (now - this.lastLoadTime < this.debounceMs) {
      if (event) event.target.complete();
      return;
    }
    this.lastLoadTime = now;

    try {
      if (this.isFilterActive() && event) {
        this.filterDisplayCount += 100;
        const totalFiltered = this.ballFilterService.filteredBalls().length;
        if (this.filterDisplayCount >= totalFiltered) {
          this.hasMoreData = false;
        }
        event.target.complete();
        return;
      }

      const response = await this.ballService.loadBalls(this.currentPage);

      if (response.length > 0) {
        this.balls.set([...this.balls(), ...response]);
        this.currentPage++;
      } else if (this.networkService.isOffline) {
        this.toastService.showToast('You are offline and no cached data is available.', 'information-circle-outline', true);
      } else {
        this.hasMoreData = false;
      }
    } catch (error) {
      console.error('Error fetching balls:', error);
      this.toastService.showToast(TOAST_MESSAGES.ballLoadError, 'bug', true);
    } finally {
      if (!event) {
        this.loadingService.setLoading(false);
      }
      if (event && !this.isFilterActive()) {
        event.target.complete();
      }
    }
  }

  getLengthPotential(ball: Ball): string {
    return getLengthLabel(ball);
  }

  getFlarePotential(ball: Ball): string {
    return getFlareLabel(ball);
  }

  async getSameCoreBalls(ball: Ball): Promise<void> {
    try {
      this.hapticService.vibrate(ImpactStyle.Light);
      this.loadingService.setLoading(true);
      const result = await this.ballService.getBallsByCore(ball);
      if (result.length > 0) {
        this.coreBalls.set(result);
      } else {
        this.toastService.showToast(`No similar balls found for core: ${ball.core_name}.`, 'information-circle-outline');
      }
    } catch (error) {
      console.error('Error fetching core balls:', error);
      this.toastService.showToast(`Error fetching balls for core ${ball.core_name}`, 'bug', true);
    } finally {
      this.loadingService.setLoading(false);
    }
  }

  async getSameCoverstockBalls(ball: Ball): Promise<void> {
    try {
      this.hapticService.vibrate(ImpactStyle.Light);
      this.loadingService.setLoading(true);
      const result = await this.ballService.getBallsByCoverstock(ball);
      if (result.length > 0) {
        this.coverstockBalls.set(result);
      } else {
        this.toastService.showToast(`No similar balls found for coverstock: ${ball.coverstock_name}.`, 'information-circle-outline');
      }
    } catch (error) {
      console.error('Error fetching coverstock balls:', error);
      this.toastService.showToast(`Error fetching balls for coverstock ${ball.coverstock_name}`, 'bug', true);
    } finally {
      this.loadingService.setLoading(false);
    }
  }

  async getSimilarMovementBalls(ball: Ball): Promise<void> {
    try {
      this.hapticService.vibrate(ImpactStyle.Light);
      this.loadingService.setLoading(true);
      const result = await this.ballService.getBallsByMovementPattern(ball, this.ballsStore.allBalls());
      if (result.length > 0) {
        this.movementBalls.set(result);
        void this.analyticsService.trackEvent('ball_similar_movement_viewed', {
          ball_name: ball.ball_name,
          brand: ball.brand_name,
          similar_count: result.length - 1,
        });
      } else {
        this.toastService.showToast(`No balls found with similar reaction to ${ball.ball_name}.`, 'information-circle-outline');
      }
    } catch (error) {
      console.error('Error fetching similar reaction balls:', error);
      this.toastService.showToast(`Error fetching balls with similar reaction`, 'bug', true);
    } finally {
      this.loadingService.setLoading(false);
    }
  }

  isInArsenal(ball: Ball): boolean {
    return this.ballsStore.activeArsenal().some((b: Ball) => b.ball_id === ball.ball_id && b.core_weight === ball.core_weight);
  }

  isFilterActive(): boolean {
    return this.ballFilterService.activeFilterCount() > 0;
  }

  onSortChanged(sortOption: BallSortOption): void {
    this.currentSortOption.set(sortOption);
    if (this.content) {
      setTimeout(() => {
        this.content.scrollToTop(300);
      }, 100);
    }

    void this.analyticsService.trackEvent('balls_sorted', {
      sort_field: sortOption.field,
      sort_direction: sortOption.direction,
      sort_label: sortOption.label,
    });
  }

  toggleFavorite(event: Event, ball: Ball): void {
    event.stopPropagation();
    const isFavorited = this.favoritesService.toggleBallFavorite(ball);

    if (isFavorited) {
      this.toastService.showToast(`Added ${ball.ball_name} to favorites`, 'heart');
      void this.analyticsService.trackEvent('ball_favorited', {
        ball_name: ball.ball_name,
        brand: ball.brand_name,
        ball_id: ball.ball_id,
      });
    } else {
      this.toastService.showToast(`Removed ${ball.ball_name} from favorites`, 'heart-outline');
      void this.analyticsService.trackEvent('ball_unfavorited', {
        ball_name: ball.ball_name,
        brand: ball.brand_name,
        ball_id: ball.ball_id,
      });
    }
  }

  onFavoritesFirstChange(checked: boolean): void {
    this.favoritesFirst.set(checked);
    this.saveFavoritesFirstSetting(checked);

    if (this.content) {
      setTimeout(() => {
        this.content.scrollToTop(300);
      }, 100);
    }
  }

  private loadFavoritesFirstSetting(): void {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('balls-favorites-first');
      if (saved !== null) {
        this.favoritesFirst.set(saved === 'true');
      }
    }
  }

  private saveFavoritesFirstSetting(value: boolean): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('balls-favorites-first', value.toString());
    }
  }

  async onWeightSelect(ball: Ball, weight: string, selectEl: IonSelect): Promise<void> {
    const selectedWeight = Number(weight);
    if (!Number.isFinite(selectedWeight) || weight === ball.core_weight) return;

    const key = ball.ball_id + ball.core_weight;
    this.loadingWeightBallIds.update((s) => new Set([...s, key]));
    try {
      const ballsAtWeight = await this.ballService.getBallsByWeight(selectedWeight);
      const replacementBall = ballsAtWeight.find((c) => c.ball_id === ball.ball_id);
      if (!replacementBall) {
        selectEl.value = ball.core_weight;
        this.toastService.showToast('Selected weight is unavailable for this ball.', 'alert-circle-outline', true);
        return;
      }
      this.balls.update((list) => list.map((b) => (b.ball_id === ball.ball_id && b.core_weight === ball.core_weight ? replacementBall : b)));
    } catch {
      selectEl.value = ball.core_weight;
      this.toastService.showToast(TOAST_MESSAGES.ballLoadError, 'alert-circle-outline', true);
    } finally {
      this.loadingWeightBallIds.update((s) => {
        const next = new Set(s);
        next.delete(key);
        return next;
      });
    }
  }

  onBallSelected(ball: Ball): void {
    this.searchTerm.set(ball.ball_name);
    this.searchSubject.next(ball.ball_name);
    if (this.content) {
      setTimeout(() => {
        this.content.scrollToTop(300);
      }, 300);
    }
  }
}
