import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StatBallComponent } from './stat-ball.component';

describe('StatBallComponent', () => {
  let component: StatBallComponent;
  let fixture: ComponentFixture<StatBallComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatBallComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(StatBallComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
