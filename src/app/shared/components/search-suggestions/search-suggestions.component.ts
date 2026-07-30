import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Keyboard } from '@capacitor/keyboard';
import { IonButton, IonIcon, IonItem, IonLabel } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline, searchOutline, timeOutline } from 'ionicons/icons';
import { SearchHistoryService } from 'src/app/core/services/search-history/search-history.service';

const MAX_HISTORY_SHOWN = 5;
const MAX_HISTORY_SHOWN_WHILE_TYPING = 3;
const MAX_SUGGESTIONS_SHOWN = 4;

@Component({
  selector: 'app-search-suggestions',
  templateUrl: './search-suggestions.component.html',
  styleUrls: ['./search-suggestions.component.scss'],
  imports: [IonItem, IonLabel, IonIcon, IonButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchSuggestionsComponent {
  readonly historyKey = input.required<string>();
  readonly searchTerm = input('');
  readonly suggestions = input<string[]>([]);
  readonly open = input(false);
  readonly suggestionSelected = output<string>();

  readonly displayedHistory = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const history = this.searchHistoryService.history(this.historyKey())();
    if (term === '') {
      return history.slice(0, MAX_HISTORY_SHOWN);
    }
    return history.filter((entry) => entry.toLowerCase().includes(term) && entry.toLowerCase() !== term).slice(0, MAX_HISTORY_SHOWN_WHILE_TYPING);
  });

  readonly displayedSuggestions = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    if (term === '') {
      return [];
    }
    const shownHistory = new Set(this.displayedHistory().map((entry) => entry.toLowerCase()));
    return this.suggestions()
      .filter((entry) => !shownHistory.has(entry.toLowerCase()))
      .slice(0, MAX_SUGGESTIONS_SHOWN);
  });

  readonly isVisible = computed(() => this.open() && (this.displayedHistory().length > 0 || this.displayedSuggestions().length > 0));

  constructor(private searchHistoryService: SearchHistoryService) {
    addIcons({ closeOutline, searchOutline, timeOutline });
  }

  // Handled on pointerdown (with preventDefault) so the searchbar is not blurred
  // before the selection is processed; the blur is then triggered deliberately.
  selectSuggestion(event: Event, term: string): void {
    event.preventDefault();
    event.stopPropagation();
    this.suggestionSelected.emit(term);
    (document.activeElement as HTMLElement | null)?.blur();
    void Keyboard.hide().catch(() => {
      // Not available in the browser.
    });
  }

  removeFromHistory(event: Event, term: string): void {
    event.preventDefault();
    event.stopPropagation();
    void this.searchHistoryService.removeSearch(this.historyKey(), term);
  }
}
