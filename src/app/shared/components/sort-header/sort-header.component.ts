import { Component, Input, Output, EventEmitter, OnInit, model, ViewChild, ElementRef } from '@angular/core';
import { IonButton, IonIcon, IonPopover, IonList, IonItem, IonLabel, IonRadioGroup, IonRadio, IonCheckbox } from '@ionic/angular/standalone';

import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import { swapVertical } from 'ionicons/icons';
import { SortOption, SortField } from 'src/app/core/models/sort.model';

@Component({
  selector: 'app-sort-header',
  templateUrl: './sort-header.component.html',
  styleUrls: ['./sort-header.component.scss'],
  imports: [FormsModule, IonButton, IonIcon, IonPopover, IonList, IonItem, IonLabel, IonRadioGroup, IonRadio, IonCheckbox],
})
export class SortHeaderComponent<F extends SortField = SortField> implements OnInit {
  @Input() storageKey = '';
  @Input() favoritesFirst = false;
  @Input() favoritesFirstStorageKey = '';
  sortOptions = model.required<SortOption<F>[]>();
  selectedSort = model.required<SortOption<F>>();
  id = model.required<string>();
  @Output() sortChanged = new EventEmitter<SortOption<F>>();
  @Output() favoritesFirstChanged = new EventEmitter<boolean>();
  @ViewChild('sortList', { read: ElementRef }) sortList!: ElementRef;

  selectedSortKey = '';

  constructor() {
    addIcons({ swapVertical });
  }

  ngOnInit() {
    this.loadSortFromStorage();
    this.loadFavoritesFirstFromStorage();
    this.updateSelectedSortKey();
  }

  selectOption(option: SortOption<F>) {
    this.selectedSort.set(option);
    this.selectedSortKey = `${option.field}_${option.direction}`;
    this.saveSortToStorage(option);
    this.sortChanged.emit(option);
  }

  onSortChange(selectedKey: string) {
    const selectedOption = this.sortOptions().find((option) => `${option.field}_${option.direction}` === selectedKey);

    if (selectedOption) {
      this.selectedSort.set(selectedOption);
      this.selectedSortKey = selectedKey;
      this.saveSortToStorage(selectedOption);
      this.sortChanged.emit(selectedOption);
    }
  }

  getSortKey(option: SortOption<F>): string {
    return `${option.field}_${option.direction}`;
  }

  async onPopoverPresent() {
    setTimeout(() => {
      this.scrollToSelectedItem();
    }, 50);
  }

  onFavoritesFirstChange(event: CustomEvent<{ checked: boolean }>) {
    const checked = event.detail.checked;
    this.favoritesFirst = checked;
    this.saveFavoritesFirstToStorage(checked);
    this.favoritesFirstChanged.emit(checked);
  }

  private loadSortFromStorage() {
    if (this.storageKey && typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        try {
          const parsedSort = JSON.parse(saved);
          // Find matching option in available sortOptions
          const matchingOption = this.sortOptions().find((option) => option.field === parsedSort.field && option.direction === parsedSort.direction);
          if (matchingOption) {
            this.selectedSort.set(matchingOption);
            // Emit the loaded sort option to parent component
            setTimeout(() => {
              this.sortChanged.emit(matchingOption);
            });
          }
        } catch (error) {
          // If parsing fails, ignore and use default
          console.warn('Failed to parse saved sort option:', error);
        }
      }
    }
  }

  private saveSortToStorage(sortOption: SortOption<F>) {
    if (this.storageKey && typeof localStorage !== 'undefined') {
      localStorage.setItem(this.storageKey, JSON.stringify(sortOption));
    }
  }

  private updateSelectedSortKey() {
    if (this.selectedSort()) {
      this.selectedSortKey = `${this.selectedSort().field}_${this.selectedSort().direction}`;
    }
  }

  private loadFavoritesFirstFromStorage() {
    if (this.favoritesFirstStorageKey && typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(this.favoritesFirstStorageKey);
      if (saved !== null) {
        this.favoritesFirst = saved === 'true';
      }
    }
  }

  private saveFavoritesFirstToStorage(value: boolean) {
    if (this.favoritesFirstStorageKey && typeof localStorage !== 'undefined') {
      localStorage.setItem(this.favoritesFirstStorageKey, value.toString());
    }
  }

  private scrollToSelectedItem() {
    if (!this.sortList || !this.selectedSortKey) return;

    try {
      const selectedItemId = `sort-item-${this.selectedSortKey}`;
      const selectedElement = this.sortList.nativeElement.querySelector(`#${selectedItemId}`);

      if (selectedElement) {
        const listContainer = this.sortList.nativeElement;
        const itemTop = selectedElement.offsetTop;
        const itemHeight = selectedElement.offsetHeight;
        const containerHeight = listContainer.clientHeight;

        // Calculate scroll position to center the selected item
        const scrollTop = itemTop - containerHeight / 2 + itemHeight / 2;

        listContainer.scrollTo({
          top: Math.max(0, scrollTop),
          behavior: 'smooth',
        });
      }
    } catch (error) {
      console.warn('Could not scroll to selected item:', error);
    }
  }
}
