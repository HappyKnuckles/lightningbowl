import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ForwardsData } from 'src/app/core/models/pattern.model';
import { makePattern } from 'src/testing/fixtures';

import { PatternInfoComponent } from './pattern-info.component';

function row(start: string, stop: string, from: string, to: string): ForwardsData {
  return { number: '', start, stop, load: '2', mics: '45', speed: '', buf: '', tank: '', total_oil: '', distance_start: from, distance_end: to };
}

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

  it('draws the pattern on the lane and shows its numbers and both graphs', () => {
    fixture.componentRef.setInput(
      'pattern',
      makePattern({
        distance: "37'",
        ratio: '2.92:1',
        volume: '26.51',
        forward: '13.64',
        reverse: '12.87',
        chart_standard: 'chart.svg',
        forwards_data: [row('2L', '2R', '0', '24')],
        reverse_data: [row('9L', '9R', '30', '25')],
      }),
    );
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.lane img')?.getAttribute('src')).toContain('chart.svg');
    const values = [...el.querySelectorAll('.info-tile-value')].map((v) => v.textContent?.trim());
    expect(values).toEqual(['37 ft', '2.92:1', '26.51 mL']);
    expect(el.querySelectorAll('app-pattern-oil-chart').length).toBe(2);
    expect(component.byFoot().length).toBe(37);
    expect(component.ratios()[3].label).toBe('1:1');
  });

  it('marks boards picked on the graph on the lane and adds up their oil', () => {
    fixture.componentRef.setInput('pattern', makePattern({ distance: "37'", forwards_data: [row('2L', '2R', '0', '24')], reverse_data: [] }));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.lane-overlay .highlight').length).toBe(0);

    const tap = (index: number) =>
      component.boardRange.set(component.pickRange(component.boardRange(), { range: { from: index, to: index }, start: true }));
    tap(11);
    fixture.detectChanges();

    expect(el.querySelectorAll('.lane-overlay .highlight').length).toBe(1);
    expect(component.boardReadout()).toBe('Board 12L · 90 µL · 90 ↑ 0 ↓');

    component.boardRange.set(component.pickRange(component.boardRange(), { range: { from: 7, to: 11 }, start: false }));
    expect(component.boardReadout()).toBe('Boards 8L–12L · 450 µL · 450 ↑ 0 ↓');

    tap(11); // a new tap starts over on that board
    expect(component.boardRange()).toEqual({ from: 11, to: 11 });
    tap(11); // and tapping it again clears it
    expect(component.boardRange()).toBeNull();
  });

  it('reads out picked feet and says when there is no oil', () => {
    fixture.componentRef.setInput('pattern', makePattern({ distance: "37'", forwards_data: [row('2L', '2R', '0', '24')], reverse_data: [] }));
    component.footRange.set({ from: 30, to: 33 });
    fixture.detectChanges();

    expect(component.footReadout()).toBe('30–34 ft · no oil');
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.lane-overlay .highlight').length).toBe(1);
  });
});
