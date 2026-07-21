import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pattern } from 'src/app/core/models/pattern.model';
import { PatternCanvasComponent } from './pattern-canvas.component';

function makePattern(overrides: Partial<Pattern> = {}): Pattern {
  return {
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
    forwards_data: [
      {
        number: '1',
        start: '10L',
        stop: '10R',
        load: '2',
        mics: '40',
        speed: '18',
        buf: '0',
        tank: '1',
        total_oil: '25',
        distance_start: '0',
        distance_end: '35',
      },
    ],
    reverse_data: [],
    chart_standard: '',
    chart_horizontal: '',
    ...overrides,
  };
}

describe('PatternCanvasComponent', () => {
  let fixture: ComponentFixture<PatternCanvasComponent>;
  let component: PatternCanvasComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PatternCanvasComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PatternCanvasComponent);
    component = fixture.componentInstance;
  });

  it('renders a canvas for a pattern with load data', () => {
    fixture.componentRef.setInput('pattern', makePattern());
    fixture.detectChanges();

    const canvas = fixture.nativeElement.querySelector('canvas');
    expect(canvas).toBeTruthy();
    expect(component.hasNoLoadData()).toBeFalse();
  });

  it('falls back to a message when the pattern has no load data', () => {
    fixture.componentRef.setInput('pattern', makePattern({ forwards_data: [], reverse_data: [] }));
    fixture.detectChanges();

    expect(component.hasNoLoadData()).toBeTrue();
    expect(fixture.nativeElement.querySelector('canvas')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('No detailed load data');
  });

  it('paints oil onto the canvas', () => {
    fixture.componentRef.setInput('pattern', makePattern());
    fixture.detectChanges();

    const canvas: HTMLCanvasElement = fixture.nativeElement.querySelector('canvas');
    const context = canvas.getContext('2d');
    expect(context).toBeTruthy();

    // Sample mid-lane, which the 10L-10R load covers.
    const pixel = context!.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height * 0.7), 1, 1).data;
    expect(pixel[3]).toBeGreaterThan(0);
  });
});
