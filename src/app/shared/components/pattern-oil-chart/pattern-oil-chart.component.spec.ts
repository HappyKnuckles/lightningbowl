import { ComponentFixture, TestBed } from '@angular/core/testing';

import { niceStep, PatternOilChartComponent } from './pattern-oil-chart.component';

describe('PatternOilChartComponent', () => {
  let fixture: ComponentFixture<PatternOilChartComponent>;

  const render = (inputs: Record<string, unknown>) => {
    fixture = TestBed.createComponent(PatternOilChartComponent);
    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value);
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('stacks the reverse oil on the forward oil, scaled to the y-axis top', () => {
    const el = render({
      bars: [
        { forward: 75, reverse: 75 },
        { forward: 30, reverse: 0 },
      ],
    });

    const forward = [...el.querySelectorAll('.forward')].map((r) => Number(r.getAttribute('height')));
    const reverse = [...el.querySelectorAll('.reverse')].map((r) => Number(r.getAttribute('height')));
    expect(forward).toEqual([50, 20]);
    expect(reverse).toEqual([50, 0]);
    expect(el.querySelector('.reverse')?.getAttribute('y')).toBe('0');
  });

  it('rounds the y-axis up to round steps', () => {
    expect(niceStep(0)).toBe(1);
    expect(niceStep(33.4)).toBe(50);
    expect(niceStep(40)).toBe(50);
    expect(niceStep(50)).toBe(50);
    expect(niceStep(180)).toBe(200);
    expect(niceStep(240)).toBe(250);
    expect(niceStep(700)).toBe(1000);
  });

  it('labels the y-axis at each grid line, with the unit on top', () => {
    const el = render({ bars: [{ forward: 100, reverse: 20 }], unit: 'µL' });

    const labels = [...el.querySelectorAll<HTMLElement>('.axis span')];
    expect(labels.map((l) => l.textContent?.trim())).toEqual(['150 µL', '100', '50', '0']);
    expect(labels.map((l) => l.style.top)).toEqual(['0%', '33.3333%', '66.6667%', '100%']);
  });

  it('places tick and band labels over their bars', () => {
    const el = render({
      bars: Array.from({ length: 4 }, () => ({ forward: 1, reverse: 0 })),
      ticks: [{ at: 1, label: '2' }],
      bands: [{ from: 2, to: 3, label: '1:1' }],
      color: 'green',
    });

    const tick = el.querySelector<HTMLElement>('.ticks span')!;
    expect(tick.textContent).toBe('2');
    expect(tick.style.left).toBe('37.5%');
    const band = el.querySelector<HTMLElement>('.bands span')!;
    expect(band.textContent?.trim()).toBe('1:1');
    expect(band.style.left).toBe('50%');
    expect(band.style.width).toBe('50%');
    expect(el.querySelector('.forward')?.getAttribute('fill')).toBe('green');
  });

  it('leaves out the band row without bands', () => {
    const el = render({ bars: [{ forward: 1, reverse: 1 }] });
    expect(el.querySelector('.bands')).toBeNull();
    expect(el.querySelector('svg')?.classList.contains('with-bands')).toBe(false);
  });

  it('highlights the picked bars', () => {
    const el = render({ bars: Array.from({ length: 4 }, () => ({ forward: 1, reverse: 0 })), selected: { from: 1, to: 2 } });
    const column = el.querySelector('.selected-column');
    expect(column?.getAttribute('x')).toBe('10');
    expect(column?.getAttribute('width')).toBe('20');
  });

  it('picks the bar under a tap, and every bar from there to the finger while dragging', () => {
    const el = render({ bars: Array.from({ length: 4 }, () => ({ forward: 1, reverse: 0 })) });
    el.style.width = '400px';
    el.style.height = '100px';
    document.body.appendChild(el);
    const picked: string[] = [];
    fixture.componentInstance.barPick.subscribe(({ range, start }) => picked.push(`${range.from}-${range.to}${start ? ' start' : ''}`));
    // the plot sits right of the y-axis column, so positions are relative to it
    const { left, width } = el.querySelector('.plot')!.getBoundingClientRect();
    const at = (fraction: number) => left + width * fraction;

    el.dispatchEvent(new PointerEvent('pointerdown', { clientX: at(0.375), buttons: 1 }));
    el.dispatchEvent(new PointerEvent('pointermove', { clientX: at(0.4), buttons: 1 })); // same bar: nothing new
    el.dispatchEvent(new PointerEvent('pointermove', { clientX: at(0.875), buttons: 1 }));
    el.dispatchEvent(new PointerEvent('pointermove', { clientX: at(0.125), buttons: 1 }));
    el.dispatchEvent(new PointerEvent('pointermove', { clientX: at(0.625), buttons: 0 })); // not pressed: ignored

    expect(picked).toEqual(['1-1 start', '1-3', '0-1']);
    el.remove();
  });
});
