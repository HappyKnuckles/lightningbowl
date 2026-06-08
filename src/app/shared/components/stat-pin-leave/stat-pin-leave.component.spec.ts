import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StatPinLeaveComponent } from './stat-pin-leave.component';

describe('StatPinLeaveComponent', () => {
  let component: StatPinLeaveComponent;
  let fixture: ComponentFixture<StatPinLeaveComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatPinLeaveComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(StatPinLeaveComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
