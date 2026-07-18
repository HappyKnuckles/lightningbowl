import { Component, DebugElement } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { IonSearchbar } from '@ionic/angular/standalone';
import { SearchHistoryService } from 'src/app/core/services/search-history/search-history.service';
import { SearchHistoryDirective } from './search-history.directive';

@Component({
  template: `<ion-searchbar appSearchHistory historyKey="balls" (searchCommitted)="committed.push($event)"></ion-searchbar>`,
  imports: [IonSearchbar, SearchHistoryDirective],
})
class HostComponent {
  committed: string[] = [];
}

describe('SearchHistoryDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let searchbar: DebugElement;
  let directive: SearchHistoryDirective;
  let searchHistoryService: jasmine.SpyObj<SearchHistoryService>;

  const commit = (value: string | undefined): void => searchbar.triggerEventHandler('ionChange', { detail: { value } });

  beforeEach(async () => {
    searchHistoryService = jasmine.createSpyObj('SearchHistoryService', ['history', 'addSearch', 'removeSearch']);
    searchHistoryService.addSearch.and.resolveTo();

    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [{ provide: SearchHistoryService, useValue: searchHistoryService }],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    searchbar = fixture.debugElement.query(By.directive(SearchHistoryDirective));
    directive = searchbar.injector.get(SearchHistoryDirective);
  });

  it('tracks searchbar focus', () => {
    expect(directive.focused()).toBeFalse();

    searchbar.triggerEventHandler('ionFocus');
    expect(directive.focused()).toBeTrue();

    searchbar.triggerEventHandler('ionBlur');
    expect(directive.focused()).toBeFalse();
  });

  it('records a committed search trimmed and re-emits it', () => {
    commit('  zen  ');

    expect(searchHistoryService.addSearch).toHaveBeenCalledWith('balls', 'zen');
    expect(host.committed).toEqual(['zen']);
  });

  it('emits an empty commit without recording it', () => {
    commit('   ');

    expect(searchHistoryService.addSearch).not.toHaveBeenCalled();
    expect(host.committed).toEqual(['']);
  });

  it('records a picked suggestion and swallows only the immediately following commit', () => {
    directive.recordSelection('zen master');
    expect(searchHistoryService.addSearch).toHaveBeenCalledWith('balls', 'zen master');

    // The blur after picking fires ionChange with the stale typed text — must not be recorded or emitted.
    commit('zen ma');
    expect(searchHistoryService.addSearch).toHaveBeenCalledTimes(1);
    expect(host.committed).toEqual([]);

    // The next real commit goes through again.
    commit('phaze');
    expect(searchHistoryService.addSearch).toHaveBeenCalledWith('balls', 'phaze');
    expect(host.committed).toEqual(['phaze']);
  });

  it('clears a pending suppression when the searchbar is refocused', () => {
    directive.recordSelection('zen');

    searchbar.triggerEventHandler('ionFocus');
    commit('phaze');

    expect(host.committed).toEqual(['phaze']);
  });
});
