import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Pattern } from 'src/app/core/models/pattern.model';
import { PatternInfoComponent } from './pattern-info.component';

const PATTERN: Pattern = {
  url: 'test-pattern',
  title: 'Test Pattern',
  category: 'Sport',
  distance: '40',
  ratio: '2.5:1',
  volume: '25.0',
  forward: '12.0',
  reverse: '10.5',
  pump: '40',
  tanks: '3',
  pdf_url: '',
  kosi_url: '',
  forwards_data: [],
  reverse_data: [],
  chart_standard: '',
  chart_horizontal: '',
};

describe('PatternInfoComponent', () => {
  let component: PatternInfoComponent;
  let fixture: ComponentFixture<PatternInfoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PatternInfoComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PatternInfoComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('pattern', PATTERN);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
