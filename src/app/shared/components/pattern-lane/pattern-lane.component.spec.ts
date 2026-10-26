import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ForwardsData } from 'src/app/core/models/pattern.model';
import { makePattern } from 'src/testing/fixtures';

import { PatternLaneComponent } from './pattern-lane.component';

function row(start: string, stop: string, totalOil: string, from: string, to: string): ForwardsData {
  return { number: '', start, stop, load: '', mics: '', speed: '', buf: '', tank: '', total_oil: totalOil, distance_start: from, distance_end: to };
}

describe('PatternLaneComponent', () => {
  let fixture: ComponentFixture<PatternLaneComponent>;

  const render = (pattern = makePattern()) => {
    fixture = TestBed.createComponent(PatternLaneComponent);
    fixture.componentRef.setInput('pattern', pattern);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('shows ten pins, the arrows and the range finders', () => {
    const el = render();

    expect(el.querySelectorAll('.pin').length).toBe(10);
    expect(el.querySelectorAll('.arrow').length).toBe(7);
    expect(el.querySelectorAll('.range-finder').length).toBe(4);
  });

  it('draws the oil in the ratio colour and marks where it ends', () => {
    const el = render(makePattern({ distance: "37'", ratio: '2.5:1', forwards_data: [row('10L', '10R', '3', '0', '30')], reverse_data: [] }));

    const oil = [...el.querySelectorAll('.oil')];
    expect(oil.length).toBe(2); // the forward wash (no reverse passes, so no main wash) and the pass
    expect(oil.every((r) => r.getAttribute('fill') === 'red')).toBe(true);
    expect(el.querySelector('.pattern-end-label')?.textContent?.trim()).toBe("end of pattern 37'");
  });

  it('leaves out the end line for a pattern without a distance', () => {
    const el = render(makePattern({ distance: '' }));
    expect(el.querySelector('.pattern-end')).toBeNull();
  });
});
