import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GameReadonlyComponent } from './game-readonly.component';

describe('GameReadonlyComponent', () => {
  let component: GameReadonlyComponent;
  let fixture: ComponentFixture<GameReadonlyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameReadonlyComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(GameReadonlyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
