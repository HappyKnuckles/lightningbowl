import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StatRowComponent } from './stat-row.component';

describe('StatRowComponent', () => {
  let component: StatRowComponent;
  let fixture: ComponentFixture<StatRowComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatRowComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(StatRowComponent);
    component = fixture.componentInstance;

    // Provide default input values
    fixture.componentRef.setInput('label', 'Test Stat');
    fixture.componentRef.setInput('currentStat', 100);

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
