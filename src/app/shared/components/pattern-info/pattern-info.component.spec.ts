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

  it('marks a board picked on the graph on the lane and reads out its oil', () => {
    fixture.componentRef.setInput('pattern', makePattern({ distance: "37'", forwards_data: [row('2L', '2R', '0', '24')], reverse_data: [] }));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.lane-overlay .highlight').length).toBe(0);

    component.selectBoard(12);
    fixture.detectChanges();

    expect(el.querySelectorAll('.lane-overlay .highlight').length).toBe(1);
    expect(component.boardReadout()).toBe('Board 12L · 90 µL · 90 ↑ 0 ↓');

    component.selectBoard(12); // tapping it again clears it
    expect(component.selectedBoard()).toBeNull();
  });

  it('reads out a picked foot and says when there is no oil', () => {
    fixture.componentRef.setInput('pattern', makePattern({ distance: "37'", forwards_data: [row('2L', '2R', '0', '24')], reverse_data: [] }));
    component.selectFoot(30);
    fixture.detectChanges();

    expect(component.footReadout()).toBe('30–31 ft · no oil');
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.lane-overlay .highlight').length).toBe(1);
  });
});
