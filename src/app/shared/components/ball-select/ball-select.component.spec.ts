import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BallSelectComponent } from './ball-select.component';

describe('BallSelectComponent', () => {
  let component: BallSelectComponent;
  let fixture: ComponentFixture<BallSelectComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BallSelectComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(BallSelectComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('selectedBalls', []);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
