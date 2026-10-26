import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PatternOilChartComponent } from './pattern-oil-chart.component';

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

  it('stacks the reverse oil on the forward oil, scaled to the fullest bar', () => {
    const el = render({
      bars: [
        { forward: 50, reverse: 50 },
        { forward: 25, reverse: 0 },
      ],
    });

    const forward = [...el.querySelectorAll('.forward')].map((r) => Number(r.getAttribute('height')));
    const reverse = [...el.querySelectorAll('.reverse')].map((r) => Number(r.getAttribute('height')));
    expect(forward).toEqual([50, 25]);
    expect(reverse).toEqual([50, 0]);
    expect(el.querySelector('.reverse')?.getAttribute('y')).toBe('0');
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

  it('highlights the selected bar', () => {
    const el = render({ bars: Array.from({ length: 4 }, () => ({ forward: 1, reverse: 0 })), selected: 2 });
    expect(el.querySelector('.selected-column')?.getAttribute('x')).toBe('20');
  });

  it('reports the bar under a tap, and while dragging only new bars', () => {
    const el = render({ bars: Array.from({ length: 4 }, () => ({ forward: 1, reverse: 0 })) });
    el.style.width = '400px';
    el.style.height = '100px';
    document.body.appendChild(el);
    const picked: number[] = [];
    fixture.componentInstance.barSelect.subscribe((i) => picked.push(i));
    const left = el.getBoundingClientRect().left;

    el.dispatchEvent(new PointerEvent('pointerdown', { clientX: left + 150, buttons: 1 }));
    el.dispatchEvent(new PointerEvent('pointermove', { clientX: left + 160, buttons: 1 }));
    el.dispatchEvent(new PointerEvent('pointermove', { clientX: left + 350, buttons: 1 }));
    el.dispatchEvent(new PointerEvent('pointermove', { clientX: left + 50, buttons: 0 }));

    expect(picked).toEqual([1, 3]);
    el.remove();
  });
});
