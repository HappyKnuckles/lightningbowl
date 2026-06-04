import { CommonModule } from '@angular/common';
import { Component, OnInit, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { ImpactStyle } from '@capacitor/haptics';
import { InfiniteScrollCustomEvent, RefresherCustomEvent } from '@ionic/angular';
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
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonItem,
  IonLabel,
  IonModal,
  IonPopover,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonSkeletonText,
  IonText,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  add,
  addOutline,
  arrowDownOutline,
  arrowUpOutline,
  chevronBack,
  documentOutline,
  ellipsisVerticalOutline,
  heart,
  heartOutline,
  linkOutline,
} from 'ionicons/icons';
import { TOAST_MESSAGES } from 'src/app/core/constants/toast-messages.constants';
import { SearchBlurDirective } from 'src/app/core/directives/search-blur/search-blur.directive';
import { Pattern } from 'src/app/core/models/pattern.model';
import { PatternSortField, PatternSortOption, SortDirection } from 'src/app/core/models/sort.model';
import { AnalyticsService } from 'src/app/core/services/analytics/analytics.service';
import { ChartGenerationService } from 'src/app/core/services/chart/chart-generation.service';
import { FavoritesService } from 'src/app/core/services/favorites/favorites.service';
import { HapticService } from 'src/app/core/services/haptic/haptic.service';
import { LoadingService } from 'src/app/core/services/loader/loading.service';
import { NetworkService } from 'src/app/core/services/network/network.service';
import { PatternService } from 'src/app/core/services/pattern/pattern.service';
import { PatternSortService } from 'src/app/core/services/sort/pattern-sort.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { PatternInfoComponent } from 'src/app/shared/components/pattern-info/pattern-info.component';
import { SortHeaderComponent } from 'src/app/shared/components/sort-header/sort-header.component';
import { environment } from 'src/environments/environment';
import { PatternFormComponent } from '../../shared/components/pattern-form/pattern-form.component';

@Component({
  selector: 'app-pattern',
  templateUrl: './pattern.page.html',
  styleUrls: ['./pattern.page.scss'],
  imports: [
    IonLabel,
    IonItem,
    IonPopover,
    IonIcon,
    IonButton,
    IonButtons,
    IonModal,
    IonText,
    IonRefresherContent,
    IonSearchbar,
    IonSkeletonText,
    IonRefresher,
    IonInfiniteScrollContent,
    IonInfiniteScroll,
    IonCardContent,
    IonCardHeader,
    IonCardSubtitle,
    IonCardTitle,
    IonCard,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    CommonModule,
    FormsModule,
    PatternInfoComponent,
    SearchBlurDirective,
    SortHeaderComponent,
  ],
})
export class PatternPage implements OnInit {
  @ViewChild(IonContent, { static: false }) content!: IonContent;
  patterns: Pattern[] = [];
  currentPage = 1;
  hasMoreData = true;
  isPageLoading = signal(false);
  searchTerm = signal('');
  favoritesFirst = signal(false);
  currentSortOption: PatternSortOption = {
    field: PatternSortField.TITLE,
    direction: SortDirection.ASC,
    label: 'Title (A-Z)',
  };
  imagesUrl = environment.imagesUrl;

  get displayedPatterns(): Pattern[] {
    let patterns: Pattern[];

    // If there's a search term, return patterns without additional sorting to preserve relevance ranking
    if (this.searchTerm().trim() !== '') {
      patterns = this.patterns;
    } else {
      // Apply sorting only when not searching
      patterns = this.sortService.sortPatterns(this.patterns, this.currentSortOption, this.favoritesFirst());
    }

    return patterns;
  }

  private lastLoadTime = 0;
  private debounceMs = 300;
  constructor(
    private patternService: PatternService,
    private hapticService: HapticService,
    public loadingService: LoadingService,
    private toastService: ToastService,
    private chartService: ChartGenerationService,
    private sanitizer: DomSanitizer,
    private modalCtrl: ModalController,
    public sortService: PatternSortService,
    private networkService: NetworkService,
    public favoritesService: FavoritesService,
    private analyticsService: AnalyticsService,
  ) {
    addIcons({
      addOutline,
      documentOutline,
      linkOutline,
      arrowUpOutline,
      arrowDownOutline,
      chevronBack,
      add,
      heart,
      heartOutline,
      ellipsisVerticalOutline,
    });
  }
  async ngOnInit() {
    this.loadFavoritesFirstSetting();
    await this.loadPatterns();
    // this.generateChartImages();
    // this.renderCharts();
  }

  async handleRefresh(event: RefresherCustomEvent): Promise<void> {
    try {
      this.hapticService.vibrate(ImpactStyle.Medium);
      this.isPageLoading.set(true);
      this.currentPage = 1;
      this.hasMoreData = true;
      this.patterns = [];
      this.searchTerm.set(''); // Clear search term on refresh
      await this.loadPatterns(undefined, true);
    } catch (error) {
      console.error(error);
      this.toastService.showToast(TOAST_MESSAGES.ballLoadError, 'bug', true);
    } finally {
      event.target.complete();
      this.isPageLoading.set(false);
    }
  }

  async loadPatterns(event?: InfiniteScrollCustomEvent, forceRefresh = false): Promise<void> {
    const now = Date.now();
    if (now - this.lastLoadTime < this.debounceMs) {
      if (event) event.target.complete();
      return;
    }
    this.lastLoadTime = now;
    try {
      if (!event) {
        this.isPageLoading.set(true);
      }
      const response = await this.patternService.getPatterns(this.currentPage, forceRefresh);
      const patterns = response.patterns;
      if (response.total > 0) {
        this.patterns = [...this.patterns, ...patterns];
        this.currentPage++;
      } else if (this.networkService.isOffline) {
        this.toastService.showToast('You are offline and no cached data is available.', 'information-circle-outline', true);
      } else {
        this.hasMoreData = false;
      }
    } catch (error) {
      console.error('Error fetching patterns:', error);
      this.toastService.showToast(TOAST_MESSAGES.patternLoadError, 'bug', true);
    } finally {
      if (!event) {
        this.isPageLoading.set(false);
      }
      if (event) {
        event.target.complete();
      }
      // this.generateChartImages();
    }
  }

  async searchPatterns(event: CustomEvent): Promise<void> {
    try {
      this.loadingService.setLoading(true);
      const searchValue = event.detail.value || '';
      this.searchTerm.set(searchValue);

      if (searchValue === '') {
        this.hasMoreData = true;
        const response = await this.patternService.getPatterns(this.currentPage);
        this.patterns = response.patterns;
        this.currentPage++;
      } else {
        const response = await this.patternService.searchPattern(searchValue, true);
        this.patterns = response.patterns;
        this.hasMoreData = false;
        this.currentPage = 1;

        void this.analyticsService.trackPatternLookup(searchValue);
      }
      setTimeout(() => {
        this.content.scrollToTop(300);
      }, 300);
    } catch (error) {
      console.error('Error searching patterns:', error);
      this.toastService.showToast(TOAST_MESSAGES.patternLoadError, 'bug', true);
    } finally {
      this.loadingService.setLoading(false);
      // this.generateChartImages();
    }
  }

  async openAddPatternModal(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: PatternFormComponent,
    });
    return await modal.present();
  }

  getRatioValue(ratio: string): number {
    const numericPart = ratio.split(':')[0];
    return parseFloat(numericPart);
  }

  // private generateChartImages(): void {
  //   this.patterns.forEach((pattern) => {
  //     if (!pattern.chartImageSrc) {
  //       try {
  //         const svgDataUri = this.chartService.generatePatternChartDataUri(pattern, 325, 1300, 1300, 400, 20, 1, 7, true);
  //         const svgDataUriHor = this.chartService.generatePatternChartDataUri(pattern, 375, 1500, 400, 1500, 20, 1, 7, false);
  //         pattern.chartImageSrcHorizontal = this.sanitizer.bypassSecurityTrustUrl(svgDataUriHor);
  //         pattern.chartImageSrc = this.sanitizer.bypassSecurityTrustUrl(svgDataUri);
  //       } catch (error) {
  //         console.error(`Error generating chart for pattern ${pattern.title}:`, error);
  //       }
  //     }
  //   });
  // }

  onSortChanged(sortOption: PatternSortOption): void {
    this.currentSortOption = sortOption as PatternSortOption;
    if (this.content) {
      setTimeout(() => {
        this.content.scrollToTop(300);
      }, 100);
    }

    void this.analyticsService.trackEvent('patterns_sorted', {
      sort_field: this.currentSortOption.field,
      sort_direction: this.currentSortOption.direction,
      sort_label: this.currentSortOption.label,
    });
  }

  toggleFavorite(event: Event, pattern: Pattern): void {
    event.stopPropagation();
    const isFavorited = this.favoritesService.toggleFavorite(pattern.url);

    if (isFavorited) {
      this.toastService.showToast(`Added ${pattern.title} to favorites`, 'heart');

      void this.analyticsService.trackEvent('pattern_favorited', {
        pattern_title: pattern.title,
        pattern_category: pattern.category,
        pattern_url: pattern.url,
      });
    } else {
      this.toastService.showToast(`Removed ${pattern.title} from favorites`, 'heart-outline');

      void this.analyticsService.trackEvent('pattern_unfavorited', {
        pattern_title: pattern.title,
        pattern_category: pattern.category,
        pattern_url: pattern.url,
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
      const saved = localStorage.getItem('patterns-favorites-first');
      if (saved !== null) {
        this.favoritesFirst.set(saved === 'true');
      }
    }
  }

  private saveFavoritesFirstSetting(value: boolean): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('patterns-favorites-first', value.toString());
    }
  }
}
