import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BallFilterComponent } from './ball-filter.component';

describe('BallFilterComponent', () => {
  let component: BallFilterComponent;
  let fixture: ComponentFixture<BallFilterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BallFilterComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(BallFilterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
