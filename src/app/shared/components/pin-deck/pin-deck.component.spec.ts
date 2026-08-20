import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PinDeckComponent } from './pin-deck.component';

describe('PinDeckComponent', () => {
  let component: PinDeckComponent;
  let fixture: ComponentFixture<PinDeckComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PinDeckComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PinDeckComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('activePins', []);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
