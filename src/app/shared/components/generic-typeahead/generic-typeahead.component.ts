import { Component, computed, EventEmitter, input, Output, signal, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { InfiniteScrollCustomEvent, ModalController } from '@ionic/angular';
import Fuse from 'fuse.js';
import {
  IonToolbar,
  IonTitle,
  IonHeader,
  IonInfiniteScrollContent,
  IonInfiniteScroll,
  IonContent,
  IonItem,
  IonCheckbox,
  IonLabel,
  IonSearchbar,
  IonList,
  IonButtons,
  IonButton,
  IonAvatar,
  IonImg,
  IonText,
} from '@ionic/angular/standalone';
import { NgClass } from '@angular/common';
import { SearchBlurDirective } from 'src/app/core/directives/search-blur/search-blur.directive';
import { LoadingService } from 'src/app/core/services/loader/loading.service';
import { TypeaheadConfig } from 'src/app/core/models/typeahead-config.model';

@Component({
  selector: 'app-generic-typeahead',
  imports: [
    IonButton,
    IonButtons,
    IonList,
    IonSearchbar,
    IonLabel,
    IonCheckbox,
    IonItem,
    IonContent,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonAvatar,
    IonImg,
    IonText,
    SearchBlurDirective,
    NgClass,
  ],
  templateUrl: './generic-typeahead.component.html',
  styleUrl: './generic-typeahead.component.scss',
})
export class GenericTypeaheadComponent<T> implements OnInit, OnDestroy {
  items = input<T[]>([]);
  config = input.required<TypeaheadConfig<T>>();
  prevSelectedItems = input<string[]>([]);
  @Output() selectedItemsChange = new EventEmitter<string[]>();
  /** Same moment as `selectedItemsChange`, with the full items (needed for API search results that aren't in `items`). */
  @Output() selectedObjectsChange = new EventEmitter<T[]>();
  @ViewChild(IonContent, { static: false }) content!: IonContent;
  @ViewChild('infiniteScroll') infiniteScroll!: IonInfiniteScroll;

  filteredItems = signal<T[]>([]);
  selectedItems: T[] = [];
  displayedItems = computed(() => this.filteredItems().slice(0, this.loadedCount()));
  fuse!: Fuse<T>;
  private batchSize = 100;
  public loadedCount = signal(0);
  private initialSelectedValues: string[] = [];
  // API paging state (only used when config().apiPageFn is set)
  private apiTerm = '';
  private apiNextPage = 0;
  private apiHasMore = false;
  private apiRequestId = 0;

  constructor(
    private modalCtrl: ModalController,
    private loadingService: LoadingService,
  ) {}

  ngOnInit() {
    this.filteredItems.set([...this.items()]);
    this.loadedCount.set(Math.min(this.batchSize, this.items().length));

    const prevSelected = this.prevSelectedItems();
    if (prevSelected && prevSelected.length > 0) {
      this.selectedItems = this.items().filter((item) => prevSelected.includes(this.getItemValue(item)));
    }

    if (this.config().searchMode === 'local') {
      const options = {
        keys: this.config().searchKeys,
        threshold: 0.3,
        ignoreLocation: true,
        minMatchCharLength: 3,
        includeMatches: true,
        includeScore: true,
        shouldSort: true,
        useExtendedSearch: false,
      };
      this.fuse = new Fuse(this.items(), options);
    }

    // Reorder items if there are selected items
    if (this.selectedItems.length > 0) {
      this.reorderItemsForSelected();
    }

    // Store initial selected state for comparison in ngOnDestroy
    this.initialSelectedValues = this.selectedItems.map((item) => this.getItemValue(item));

    if (this.usesApiPaging()) {
      void this.loadApiPage('', true);
    }
  }

  async loadData(event: InfiniteScrollCustomEvent): Promise<void> {
    // Everything loaded is shown: fetch the next API page instead of revealing the next local batch
    if (this.usesApiPaging() && this.loadedCount() >= this.filteredItems().length) {
      if (this.apiHasMore) {
        await this.loadApiPage(this.apiTerm, false);
      }
      event.target.complete();
      event.target.disabled = !this.apiHasMore && this.loadedCount() >= this.filteredItems().length;
      return;
    }

    setTimeout(() => {
      if (this.loadedCount() < this.filteredItems().length) {
        this.loadedCount.update((count) => Math.min(count + this.batchSize, this.filteredItems().length));
      }
      event.target.complete();

      if (this.loadedCount() >= this.filteredItems().length && !(this.usesApiPaging() && this.apiHasMore)) {
        event.target.disabled = true;
      }
    }, 50);
  }

  async searchItems(event: CustomEvent) {
    const searchTerm = event.detail.value?.toLowerCase() ?? '';

    if (this.usesApiPaging()) {
      this.loadingService.setLoading(true);
      try {
        await this.loadApiPage(searchTerm, true);
      } finally {
        this.loadingService.setLoading(false);
      }
      setTimeout(() => {
        this.content.scrollToTop(300);
      }, 300);
      return;
    }

    if (this.config().searchMode === 'api' && this.config().apiSearchFn) {
      try {
        this.loadingService.setLoading(true);
        if (searchTerm === '') {
          this.filteredItems.set([...this.items()]);
        } else {
          const apiSearchFn = this.config().apiSearchFn;
          if (apiSearchFn) {
            const response = await apiSearchFn(searchTerm);
            this.filteredItems.set(response.items);
          }
        }
      } catch (error) {
        console.error('Error searching items:', error);
      } finally {
        this.loadingService.setLoading(false);
      }
    } else {
      // Local search with Fuse.js
      if (searchTerm && searchTerm.trim() !== '') {
        const result = this.fuse.search(searchTerm);
        this.filteredItems.set(result.map((res) => res.item));
      } else {
        this.filteredItems.set([...this.items()]);
      }
    }

    // Reorder items if there are selected items
    if (this.selectedItems.length > 0) {
      this.reorderItemsForSelected();
    }

    this.loadedCount.set(Math.min(this.batchSize, this.filteredItems().length));

    if (this.infiniteScroll) {
      this.infiniteScroll.disabled = this.loadedCount() >= this.filteredItems().length;
    }

    setTimeout(() => {
      this.content.scrollToTop(300);
    }, 300);
  }

  resetSelection() {
    this.selectedItems = [];
  }

  saveSelection() {
    this.modalCtrl.dismiss();
  }

  checkboxChange(event: CustomEvent, item: T): void {
    const checked = event.detail.checked;

    if (checked) {
      const maxSelections = this.config().maxSelections;
      if (!maxSelections || this.selectedItems.length < maxSelections) {
        if (!this.isItemSelected(item)) {
          this.selectedItems = [...this.selectedItems, item];
        }
      }
    } else {
      this.selectedItems = this.selectedItems.filter((selected) => this.getItemIdentifier(selected) !== this.getItemIdentifier(item));
    }

    this.reorderItemsForSelected();
  }

  isItemSelected(item: T): boolean {
    if (this.config().valueKey) {
      return this.selectedItems.some((selected) => this.getItemValue(selected) === this.getItemValue(item));
    }
    return this.selectedItems.some((selected) => this.getItemIdentifier(selected) === this.getItemIdentifier(item));
  }

  canSelectMoreItems(): boolean {
    const maxSelections = this.config().maxSelections;
    return !maxSelections || this.selectedItems.length < maxSelections;
  }

  getItemDisplayValue(item: T, field: string): string {
    const customFormatter = this.config().customDisplayFormatter;
    if (customFormatter) {
      return customFormatter(item, field);
    }
    return (item as any)[field] || '';
  }

  getItemIdentifier(item: T): any {
    return (item as any)[this.config().identifierKey];
  }

  getItemValue(item: T): any {
    const valueKey = this.config().valueKey;
    if (valueKey) {
      return (item as any)[valueKey];
    }
    return (item as any)[this.config().identifierKey];
  }

  getImageUrl(item: T): string {
    return this.config().imageUrlGenerator?.(item) || '';
  }

  onImageError(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  getCustomDisplayLogic(item: T): { cssClass?: string; disabled?: boolean } {
    return this.config().customDisplayLogic?.(item) || {};
  }

  private usesApiPaging(): boolean {
    return this.config().searchMode === 'api' && !!this.config().apiPageFn;
  }

  /**
   * Loads one API page. `reset` starts a new list: the passed-in `items` when browsing, nothing when
   * searching. Responses of an outdated term (the user kept typing) are dropped.
   */
  private async loadApiPage(term: string, reset: boolean): Promise<void> {
    const apiPageFn = this.config().apiPageFn;
    if (!apiPageFn) {
      return;
    }
    const requestId = ++this.apiRequestId;
    if (reset) {
      this.apiTerm = term;
      this.apiNextPage = 0;
      this.apiHasMore = false;
      this.filteredItems.set(term ? [] : [...this.items()]);
      if (this.selectedItems.length > 0) {
        this.reorderItemsForSelected();
      }
      this.loadedCount.set(Math.min(this.batchSize, this.filteredItems().length));
    }

    try {
      const response = await apiPageFn(term, this.apiNextPage);
      if (requestId !== this.apiRequestId) {
        return;
      }
      const known = new Set(this.filteredItems().map((item) => this.getItemIdentifier(item)));
      const fresh = response.items.filter((item) => !known.has(this.getItemIdentifier(item)));
      this.filteredItems.update((items) => [...items, ...fresh]);
      this.apiNextPage++;
      this.apiHasMore = response.hasMore;
      this.loadedCount.update((count) => Math.min(count + fresh.length, this.filteredItems().length));
    } catch (error) {
      console.error('Error loading items:', error);
      if (requestId === this.apiRequestId) {
        this.apiHasMore = false;
      }
    }

    if (this.infiniteScroll && requestId === this.apiRequestId) {
      this.infiniteScroll.disabled = !this.apiHasMore && this.loadedCount() >= this.filteredItems().length;
    }
  }

  private reorderItemsForSelected(): void {
    if (this.selectedItems.length === 0) return;

    // Pin the selected items themselves so they stay visible even when the current search doesn't match them
    const selectedIdentifiers = this.selectedItems.map((item) => this.getItemIdentifier(item));
    const unselectedItems = this.filteredItems().filter((item) => !selectedIdentifiers.includes(this.getItemIdentifier(item)));

    this.filteredItems.set([...this.selectedItems, ...unselectedItems]);
  }

  ngOnDestroy(): void {
    // Get current selected values for comparison
    const selectedValues = this.selectedItems.map((item) => this.getItemValue(item));

    // Only emit if the current selection is different from the initial selection
    // Compare values since we now store and emit values
    const isDifferent =
      selectedValues.length !== this.initialSelectedValues.length ||
      selectedValues.some((value) => !this.initialSelectedValues.includes(value)) ||
      this.initialSelectedValues.some((value) => !selectedValues.includes(value));

    if (isDifferent) {
      this.selectedItemsChange.emit(selectedValues);
      this.selectedObjectsChange.emit([...this.selectedItems]);
    }
  }
}
