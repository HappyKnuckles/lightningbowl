import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SortOption } from 'src/app/core/models/sort.model';

import { SortHeaderComponent } from './sort-header.component';

const SORT_OPTION: SortOption = { field: 'date', direction: 'desc', label: 'Date' } as SortOption;

describe('SortHeaderComponent', () => {
  let component: SortHeaderComponent;
  let fixture: ComponentFixture<SortHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SortHeaderComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SortHeaderComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('sortOptions', [SORT_OPTION]);
    fixture.componentRef.setInput('selectedSort', SORT_OPTION);
    fixture.componentRef.setInput('id', 'test-sort');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
