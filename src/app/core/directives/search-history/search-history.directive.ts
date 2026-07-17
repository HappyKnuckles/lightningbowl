import { Directive, HostListener, input, output, signal } from '@angular/core';
import { SearchbarCustomEvent } from '@ionic/angular';
import { SearchHistoryService } from 'src/app/core/services/search-history/search-history.service';

/**
 * Records committed searchbar values (Enter/blur) into the per-context search history and
 * tracks focus for showing an app-search-suggestions dropdown. Grab the directive via
 * `#search="appSearchHistory"` to read `focused()` and to call `recordSelection()` when a
 * suggestion is picked; listen to `searchCommitted` instead of `ionChange` for commits that
 * were not suppressed by a suggestion selection.
 */
@Directive({
  selector: 'ion-searchbar[appSearchHistory]',
  exportAs: 'appSearchHistory',
  standalone: true,
})
export class SearchHistoryDirective {
  historyKey = input.required<string>();
  searchCommitted = output<string>();

  readonly focused = signal(false);
  #suppressNextCommit = false;

  constructor(private searchHistoryService: SearchHistoryService) {}

  @HostListener('ionFocus')
  onFocus(): void {
    this.#suppressNextCommit = false;
    this.focused.set(true);
  }

  @HostListener('ionBlur')
  onBlur(): void {
    this.focused.set(false);
  }

  @HostListener('ionChange', ['$event'])
  onCommit(event: SearchbarCustomEvent): void {
    if (this.#suppressNextCommit) {
      this.#suppressNextCommit = false;
      return;
    }
    const query = event.detail.value?.trim() ?? '';
    if (query) {
      void this.searchHistoryService.addSearch(this.historyKey(), query);
    }
    this.searchCommitted.emit(query);
  }

  /** Records a picked suggestion and swallows the ionChange the following blur fires with the stale typed text. */
  recordSelection(term: string): void {
    this.#suppressNextCommit = true;
    void this.searchHistoryService.addSearch(this.historyKey(), term);
  }
}
