import { Component, Input, Output, EventEmitter, OnInit, model, ViewChild, ElementRef } from '@angular/core';
import { IonButton, IonIcon, IonPopover, IonList, IonItem, IonLabel, IonRadioGroup, IonRadio, IonCheckbox } from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import { swapVertical } from 'ionicons/icons';
import { SortOption, BallSortField, PatternSortField, GameSortField } from 'src/app/core/models/sort.model';

@Component({
  selector: 'app-sort-header',
  templateUrl: './sort-header.component.html',
  styleUrls: ['./sort-header.component.scss'],
  imports: [CommonModule, FormsModule, IonButton, IonIcon, IonPopover, IonList, IonItem, IonLabel, IonRadioGroup, IonRadio, IonCheckbox],
})
export class SortHeaderComponent implements OnInit {
  sortOptions = model.required<SortOption<BallSortField | PatternSortField | GameSortField>[]>();
  selectedSort = model.required<SortOption<BallSortField | PatternSortField | GameSortField>>();
  id = model.required<string>();
  @Input() storageKey = '';
  @Input() favoritesFirst = false;
  @Input() favoritesFirstStorageKey = '';
  @Output() sortChanged = new EventEmitter<SortOption<BallSortField | PatternSortField | GameSortField>>();
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

  private saveSortToStorage(sortOption: SortOption<BallSortField | PatternSortField | GameSortField>) {
    if (this.storageKey && typeof localStorage !== 'undefined') {
      localStorage.setItem(this.storageKey, JSON.stringify(sortOption));
    }
  }

  private updateSelectedSortKey() {
    if (this.selectedSort()) {
      this.selectedSortKey = `${this.selectedSort().field}_${this.selectedSort().direction}`;
    }
  }

  selectOption(option: SortOption<BallSortField | PatternSortField | GameSortField>) {
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

  getSortKey(option: SortOption<BallSortField | PatternSortField | GameSortField>): string {
    return `${option.field}_${option.direction}`;
  }

  async onPopoverPresent() {
    setTimeout(() => {
      this.scrollToSelectedItem();
    }, 50);
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

  onFavoritesFirstChange(event: any) {
    const checked = event.detail.checked;
    this.favoritesFirst = checked;
    this.saveFavoritesFirstToStorage(checked);
    this.favoritesFirstChanged.emit(checked);
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
