import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BallListComponent } from './ball-list.component';
import { makeBall } from 'src/testing/fixtures';

describe('BallListComponent', () => {
  let component: BallListComponent;
  let fixture: ComponentFixture<BallListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BallListComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(BallListComponent);
    component = fixture.componentInstance;
    // ball-list.component.html reads balls[0] unguarded, so the list must be non-empty
    component.balls = [makeBall()];
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
