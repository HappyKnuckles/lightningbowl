import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { SearchHistoryService } from 'src/app/core/services/search-history/search-history.service';

import { createSpyObj, SpyObj } from '../../../../testing/spy-obj';
import { SearchSuggestionsComponent } from './search-suggestions.component';

describe('SearchSuggestionsComponent', () => {
  let component: SearchSuggestionsComponent;
  let fixture: ComponentFixture<SearchSuggestionsComponent>;
  let historySignal: ReturnType<typeof signal<string[]>>;
  let searchHistoryService: SpyObj<SearchHistoryService>;

  beforeEach(async () => {
    historySignal = signal<string[]>([]);
    searchHistoryService = createSpyObj(['history', 'addSearch', 'removeSearch']);
    searchHistoryService.history.mockImplementation(() => historySignal.asReadonly());
    searchHistoryService.removeSearch.mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [SearchSuggestionsComponent],
      providers: [{ provide: SearchHistoryService, useValue: searchHistoryService }],
    }).compileComponents();

    fixture = TestBed.createComponent(SearchSuggestionsComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('historyKey', 'balls');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('stays hidden while the searchbar is not focused, even with content', () => {
    historySignal.set(['zen']);
    fixture.detectChanges();

    expect(component.isVisible()).toBe(false);
    expect(fixture.debugElement.query(By.css('.suggestion-panel'))).toBeNull();
  });

  it('shows at most five recent searches while the term is empty', () => {
    historySignal.set(['one', 'two', 'three', 'four', 'five', 'six', 'seven']);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    expect(component.displayedHistory()).toEqual(['one', 'two', 'three', 'four', 'five']);
    expect(component.displayedSuggestions()).toEqual([]);
    expect(fixture.debugElement.queryAll(By.css('ion-item')).length).toBe(5);
  });

  it('narrows history to matching entries while typing, hiding the exact match', () => {
    historySignal.set(['zen master', 'zen', 'phaze', 'zenith', 'zen garden']);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('searchTerm', 'zen');
    fixture.detectChanges();

    // "zen" itself is dropped (already typed), non-matches are dropped, max three shown.
    expect(component.displayedHistory()).toEqual(['zen master', 'zenith', 'zen garden']);
  });

  it('shows suggestions minus entries already listed in history, capped at four', () => {
    historySignal.set(['zen']);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('searchTerm', 'ze');
    fixture.componentRef.setInput('suggestions', ['Zen', 'Zen Master', 'Phaze', 'Zen Garden', 'Zenith', 'Zealot']);
    fixture.detectChanges();

    expect(component.displayedHistory()).toEqual(['zen']);
    expect(component.displayedSuggestions()).toEqual(['Zen Master', 'Phaze', 'Zen Garden', 'Zenith']);
  });

  it('shows no suggestions while the term is empty', () => {
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('suggestions', ['Zen']);
    fixture.detectChanges();

    expect(component.displayedSuggestions()).toEqual([]);
    expect(component.isVisible()).toBe(false);
  });

  it('renders the Recent and Suggestions sections when both have entries', () => {
    historySignal.set(['zen']);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('searchTerm', 'ze');
    fixture.componentRef.setInput('suggestions', ['Zen Master']);
    fixture.detectChanges();

    const labels = fixture.debugElement.queryAll(By.css('.section-label')).map((el) => el.nativeElement.textContent.trim());
    expect(labels).toEqual(['Recent', 'Suggestions']);
  });

  it('emits the picked term on pointerdown and prevents the searchbar blur', () => {
    historySignal.set(['zen']);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    const selected: string[] = [];
    component.suggestionSelected.subscribe((term) => selected.push(term));
    const event = new Event('pointerdown', { cancelable: true });
    fixture.debugElement.query(By.css('ion-item')).triggerEventHandler('pointerdown', event);

    expect(selected).toEqual(['zen']);
    expect(event.defaultPrevented).toBe(true);
  });

  it('removes a history entry without selecting it', () => {
    historySignal.set(['zen']);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    const selected: string[] = [];
    component.suggestionSelected.subscribe((term) => selected.push(term));
    const event = new Event('pointerdown', { cancelable: true });
    fixture.debugElement.query(By.css('.remove-button')).triggerEventHandler('pointerdown', event);

    expect(searchHistoryService.removeSearch).toHaveBeenCalledWith('balls', 'zen');
    expect(selected).toEqual([]);
  });
});
