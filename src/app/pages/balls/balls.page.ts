import { BallImagePipe } from 'src/app/shared/pipes/ball-image-pipe/ball-image.pipe';
import { ChangeDetectionStrategy, Component, computed, OnInit, Signal, signal, untracked, ViewChild } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
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
import { addOutline, camera, chevronDownOutline, chevronForward, closeCircle, filterOutline, globeOutline, heart, heartOutline, openOutline } from 'ionicons/icons';
import { debounceTime, Subject } from 'rxjs';
import { BALL_FILTER_CONFIGS } from 'src/app/core/configs/filter/ball-filter.config';
import { BALL_PAGE_SIZE } from 'src/app/core/constants/ball-api.constants';
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
import { buildBallQueryParams } from 'src/app/core/utils/ball-query/ball-query.utils';
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
  imports: [BallImagePipe, 
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

  /** Balls loaded from the API so far (online mode). */
  balls = signal<Ball[]>([]);
  coreBalls = signal<Ball[]>([]);
  coverstockBalls = signal<Ball[]>([]);
  movementBalls = signal<Ball[]>([]);
  searchSubject = new Subject<string>();
  searchTerm = signal('');
  // Names of balls you have plus the ones currently listed; the catalog itself isn't on the device.
  searchSuggestions = computed(() =>
    buildSearchSuggestions(
      [...new Set([...this.ballsStore.knownBalls(), ...this.balls()].map((ball) => ball.ball_name))],
      this.searchTerm(),
    ),
  );
  readonly isOnline = computed(() => this.networkService.isOnline);
  /** Online, the API searches; offline, search runs over your known balls. */
  searchDisabled = computed(() => !this.isOnline() && this.ballsStore.knownBalls().length === 0);
  favoritesFirst = signal(false);
  isPageLoading = signal(false);
  loadingWeightBallIds = signal<Set<string>>(new Set());
  readonly availableWeights = ['12', '13', '14', '15', '16'];
  currentSortOption = signal<BallSortOption>({
    field: BallSortField.RELEASE_DATE,
    direction: SortDirection.DESC,
    label: 'Newest First',
  });
  /** "Best Match" is offered only while searching. */
  readonly sortOptions = computed(() =>
    this.searchTerm().trim() !== '' ? [this.sortService.BEST_MATCH_OPTION, ...this.sortService.BALL_SORT_OPTIONS] : this.sortService.BALL_SORT_OPTIONS,
  );

  // Online: search, filters, sort and paging run on the ball API.
  private readonly serverHasMore = signal(false);
  private nextPage = 0;
  /** Bumped on every new query so responses to outdated queries are dropped. */
  private queryVersion = 0;
  /** The sort that was active when the search started, restored when it's cleared. */
  private sortBeforeSearch: BallSortOption | null = null;

  // Offline: client-side search/filter/sort over your known balls.
  private readonly offlineDisplayCount = signal(100);

  /** Everything that changes which balls the API should return. */
  private readonly query = computed(() => ({
    filters: this.ballFilterService.filters(),
    search: this.searchTerm(),
    sort: this.currentSortOption(),
    // Only matters for the "only arsenal balls" filter; otherwise adding a ball
    // to the arsenal would reload the list.
    arsenal: this.ballFilterService.filters().inArsenal ? this.ballsStore.arsenal() : null,
    // The favorites themselves are read when the request is made, so that
    // (un)favoriting a ball doesn't reload the list.
    favoritesFirst: this.favoritesFirst(),
    online: this.isOnline(),
  }));

  private readonly offlineResult = computed(() => {
    const search = this.searchTerm().trim();
    const baseArray = this.isFilterActive() ? this.ballFilterService.filteredBalls() : this.ballsStore.knownBalls();
    if (search === '') {
      return baseArray;
    }
    const fuseInstance = new Fuse(baseArray, {
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
      shouldSort: true,
    });
    // Comma-separated terms are searched individually.
    return search
      .split(',')
      .map((term) => term.trim())
      .flatMap((term) => fuseInstance.search(term).map((result) => result.item));
  });

  readonly hasMoreData = computed(() => {
    if (this.isOnline()) {
      return this.serverHasMore();
    }
    return this.searchTerm().trim() === '' && this.offlineDisplayCount() < this.offlineResult().length;
  });

  // Online, the API already searched, sorted (Best Match = relevance order)
  // and put favorites first. Offline, the known balls are sorted here.
  displayedBalls: Signal<Ball[]> = computed(() => {
    if (this.isOnline()) {
      return this.balls();
    }

    const result = this.offlineResult();
    const visible = this.searchTerm().trim() !== '' ? result : result.slice(0, this.offlineDisplayCount());
    return this.sortService.sortBalls(visible, this.currentSortOption(), this.favoritesFirst());
  });

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
    addIcons({ filterOutline, closeCircle, globeOutline, openOutline, addOutline, camera, heart, heartOutline, chevronDownOutline, chevronForward });
    this.searchSubject.subscribe((query) => {
      this.setSearchTerm(query);
      if (this.content) {
        setTimeout(() => {
          this.content.scrollToTop(300);
        }, 300);
      }
    });
    this.route.queryParams.subscribe((params) => {
      if (params['search']) {
        this.setSearchTerm(params['search']);
      }
    });
    toObservable(this.query)
      .pipe(debounceTime(150), takeUntilDestroyed())
      .subscribe(({ online }) => {
        this.offlineDisplayCount.set(100);
        if (online) {
          void this.loadFirstPage();
        } else {
          this.isPageLoading.set(false);
        }
      });
  }

  ngOnInit(): void {
    // The first page is requested by the query subscription in the constructor.
    this.isPageLoading.set(this.isOnline());
    this.loadFavoritesFirstSetting();
  }

  async handleRefresh(event: RefresherCustomEvent): Promise<void> {
    try {
      this.hapticService.vibrate(ImpactStyle.Medium);
      this.isPageLoading.set(true);
      this.offlineDisplayCount.set(100);
      await Promise.all([this.ballsStore.refreshKnownBalls(), this.ballsStore.loadArsenal()]);
      if (this.isOnline()) {
        await this.loadFirstPage();
      }
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
      if (this.content) {
        setTimeout(() => {
          this.content.scrollToTop(300);
        }, 300);
      }
    });
    return await modal.present();
  }

  /** Loads page 0 for the current query, replacing the list. */
  async loadFirstPage(): Promise<void> {
    const version = ++this.queryVersion;
    try {
      const page = await this.ballService.searchBalls(this.queryParams(0));
      if (version !== this.queryVersion) return;
      this.balls.set(page.content);
      this.nextPage = 1;
      this.serverHasMore.set(page.page.number + 1 < page.page.totalPages);
    } catch (error) {
      if (version !== this.queryVersion) return;
      console.error('Error fetching balls:', error);
      this.serverHasMore.set(false);
      this.toastService.showToast(TOAST_MESSAGES.ballLoadError, 'bug', true);
    } finally {
      if (version === this.queryVersion) {
        this.isPageLoading.set(false);
      }
    }
  }

  /** Infinite scroll: next API page online, next slice of the known balls offline. */
  async loadMore(event: InfiniteScrollCustomEvent): Promise<void> {
    if (!this.isOnline()) {
      this.offlineDisplayCount.update((count) => count + 100);
      event.target.complete();
      return;
    }

    const version = this.queryVersion;
    try {
      const page = await this.ballService.searchBalls(this.queryParams(this.nextPage));
      if (version !== this.queryVersion) return;
      this.balls.update((balls) => [...balls, ...page.content]);
      this.nextPage++;
      this.serverHasMore.set(page.page.number + 1 < page.page.totalPages);
    } catch (error) {
      console.error('Error fetching balls:', error);
      this.toastService.showToast(TOAST_MESSAGES.ballLoadError, 'bug', true);
    } finally {
      event.target.complete();
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
      const result = await this.ballService.getBallsByMovementPattern(ball);
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
    return this.ballsStore.arsenal().some((b: Ball) => b.ball_id === ball.ball_id && b.core_weight === ball.core_weight);
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
      const replacementBall = await this.ballService.getBallVariant(ball.ball_id, selectedWeight);
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
    this.setSearchTerm(ball.ball_name);
    this.searchSubject.next(ball.ball_name);
    if (this.content) {
      setTimeout(() => {
        this.content.scrollToTop(300);
      }, 300);
    }
  }

  /**
   * Starting a search switches to "Best Match"; clearing it restores the
   * previous sort unless another sort was picked meanwhile.
   */
  private setSearchTerm(term: string): void {
    const wasSearching = this.searchTerm().trim() !== '';
    const isSearching = term.trim() !== '';
    if (!wasSearching && isSearching) {
      this.sortBeforeSearch = this.currentSortOption();
      this.currentSortOption.set(this.sortService.BEST_MATCH_OPTION);
    } else if (wasSearching && !isSearching) {
      if (this.currentSortOption().field === BallSortField.RELEVANCE && this.sortBeforeSearch) {
        this.currentSortOption.set(this.sortBeforeSearch);
      }
      this.sortBeforeSearch = null;
    }
    this.searchTerm.set(term);
  }

  private queryParams(page: number) {
    return buildBallQueryParams({
      filters: this.ballFilterService.filters(),
      defaultFilters: this.ballFilterService.defaultFilters,
      search: this.searchTerm(),
      sort: this.currentSortOption(),
      arsenalIds: this.ballsStore.arsenal().map((ball) => ball.ball_id),
      favorites: this.favoritesFirst() ? [...untracked(() => this.favoritesService.favoriteBalls()).keys()] : [],
      page,
      size: BALL_PAGE_SIZE,
    });
  }
}
