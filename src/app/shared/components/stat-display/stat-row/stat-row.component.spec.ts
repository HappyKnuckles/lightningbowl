import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { StatRowComponent } from './stat-row.component';

describe('StatRowComponent', () => {
  let component: StatRowComponent;
  let fixture: ComponentFixture<StatRowComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [StatRowComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(StatRowComponent);
    component = fixture.componentInstance;

    // Provide default input values
    component.label = 'Test Stat';
    component.currentStat = 100;

    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
