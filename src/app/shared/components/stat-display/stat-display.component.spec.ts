import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StatDisplayComponent } from './stat-display.component';

describe('StatDisplayComponent', () => {
  let component: StatDisplayComponent;
  let fixture: ComponentFixture<StatDisplayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatDisplayComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(StatDisplayComponent);
    component = fixture.componentInstance;
    // No stat definitions means nothing is rendered from currentStats.
    fixture.componentRef.setInput('statDefinitions', []);
    fixture.componentRef.setInput('currentStats', {});
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
