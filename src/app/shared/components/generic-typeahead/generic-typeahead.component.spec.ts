import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController } from '@ionic/angular';
import { IonContent } from '@ionic/angular/standalone';
import { TypeaheadConfig } from 'src/app/core/models/typeahead-config.model';
import { LoadingService } from 'src/app/core/services/loader/loading.service';
import { vi } from 'vitest';

import { createSpyObj } from '../../../../testing/spy-obj';
import { GenericTypeaheadComponent } from './generic-typeahead.component';

interface TestItem {
  id: string;
  name: string;
}

const ITEMS: TestItem[] = [
  { id: 'alpha', name: 'Alpha' },
  { id: 'beta', name: 'Beta' },
  { id: 'gamma', name: 'Gamma' },
];

const CONFIG: TypeaheadConfig<TestItem> = {
  title: 'Test Title',
  searchPlaceholder: 'Search...',
  loadingText: 'Loading...',
  displayFields: [{ key: 'name', isPrimary: true }],
  searchKeys: [{ name: 'name', weight: 1 }],
  identifierKey: 'id',
  searchMode: 'local',
};

describe('GenericTypeaheadComponent', () => {
  let component: GenericTypeaheadComponent<TestItem>;
  let fixture: ComponentFixture<GenericTypeaheadComponent<TestItem>>;

  const search = (value: string): Promise<void> => component.searchItems({ detail: { value } } as CustomEvent);
  const check = (item: TestItem, checked: boolean): void => component.checkboxChange({ detail: { checked } } as CustomEvent, item);

  beforeEach(async () => {
    const modalControllerSpy = createSpyObj(['dismiss']);
    const loadingServiceSpy = createSpyObj(['setLoading']);

    await TestBed.configureTestingModule({
      imports: [GenericTypeaheadComponent],
      providers: [
        { provide: ModalController, useValue: modalControllerSpy },
        { provide: LoadingService, useValue: loadingServiceSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GenericTypeaheadComponent<TestItem>);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('items', ITEMS);
    fixture.componentRef.setInput('config', CONFIG);
    fixture.componentRef.setInput('prevSelectedItems', []);
  });

  /** Runs ngOnInit and stubs the content ViewChild that searchItems scrolls. */
  const init = (): void => {
    fixture.detectChanges();
    component.content = { scrollToTop: vi.fn() } as unknown as IonContent;
  };

  it('should create', () => {
    init();
    expect(component).toBeTruthy();
  });

  it('initialises the list from the items input', () => {
    init();
    expect(component.filteredItems()).toEqual(ITEMS);
    expect(component.displayedItems()).toEqual(ITEMS);
  });

  it('restores the previous selection from values and pins it to the top', () => {
    fixture.componentRef.setInput('prevSelectedItems', ['beta']);
    init();

    expect(component.selectedItems).toEqual([ITEMS[1]]);
    expect(component.filteredItems()[0]).toEqual(ITEMS[1]);
  });

  it('narrows the list with a local fuzzy search and restores it on empty term', async () => {
    init();

    await search('beta');
    expect(component.filteredItems()).toEqual([ITEMS[1]]);

    await search('');
    expect(component.filteredItems()).toEqual(ITEMS);
  });

  it('keeps selected items visible even when the search does not match them', async () => {
    init();
    check(ITEMS[0], true);

    await search('beta');

    // "Alpha" does not match "beta" but stays pinned above the actual match.
    expect(component.filteredItems()).toEqual([ITEMS[0], ITEMS[1]]);
  });

  it('pins a newly checked item to the top and unpins it when unchecked', () => {
    init();

    check(ITEMS[2], true);
    expect(component.selectedItems).toEqual([ITEMS[2]]);
    expect(component.filteredItems()[0]).toEqual(ITEMS[2]);

    check(ITEMS[2], false);
    expect(component.selectedItems).toEqual([]);
  });

  it('emits the changed selection values on destroy', () => {
    init();
    vi.spyOn(component.selectedItemsChange, 'emit');

    check(ITEMS[0], true);
    component.ngOnDestroy();

    expect(component.selectedItemsChange.emit).toHaveBeenCalledWith(['alpha']);
  });

  it('does not emit on destroy when the selection is unchanged', () => {
    fixture.componentRef.setInput('prevSelectedItems', ['alpha']);
    init();
    vi.spyOn(component.selectedItemsChange, 'emit');

    component.ngOnDestroy();

    expect(component.selectedItemsChange.emit).not.toHaveBeenCalled();
  });
});
