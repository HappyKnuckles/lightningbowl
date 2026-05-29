import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SortHeaderComponent } from './sort-header.component';

describe('SortHeaderComponent', () => {
  let component: SortHeaderComponent;
  let fixture: ComponentFixture<SortHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SortHeaderComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SortHeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
