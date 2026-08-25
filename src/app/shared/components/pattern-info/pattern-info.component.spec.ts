import { ComponentFixture, TestBed } from '@angular/core/testing';

import { makePattern } from 'src/testing/fixtures';

import { PatternInfoComponent } from './pattern-info.component';

describe('PatternInfoComponent', () => {
  let component: PatternInfoComponent;
  let fixture: ComponentFixture<PatternInfoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PatternInfoComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PatternInfoComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('pattern', makePattern());
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
