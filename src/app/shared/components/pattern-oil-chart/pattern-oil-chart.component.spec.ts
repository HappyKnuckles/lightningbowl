import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PatternOilChartComponent } from './pattern-oil-chart.component';

describe('PatternOilChartComponent', () => {
  let fixture: ComponentFixture<PatternOilChartComponent>;
  let host: HTMLElement;

  const render = async (inputs: Record<string, unknown>) => {
    fixture = TestBed.createComponent(PatternOilChartComponent);
    host = fixture.nativeElement as HTMLElement;
    host.style.width = '400px';
    host.style.height = '100px';
    document.body.appendChild(host);
    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value);
    }
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.componentInstance.chart!;
  };

  afterEach(() => host?.remove());

  it('draws the bars and follows input changes', async () => {
    const chart = await render({ bars: [{ forward: 1, reverse: 1 }] });
    expect(chart.data.datasets[0].data).toEqual([1]);

    fixture.componentRef.setInput('bars', [
      { forward: 3, reverse: 0 },
      { forward: 2, reverse: 0 },
    ]);
    fixture.detectChanges();

    expect(fixture.componentInstance.chart).toBe(chart);
    expect(chart.data.datasets[0].data).toEqual([3, 2]);
  });

  it('picks the bar under a tap, and every bar from there to the finger while dragging', async () => {
    const chart = await render({ bars: Array.from({ length: 4 }, () => ({ forward: 1, reverse: 0 })) });
    const picked: string[] = [];
    fixture.componentInstance.barPick.subscribe(({ range, start }) => picked.push(`${range.from}-${range.to}${start ? ' start' : ''}`));
    const { left: canvasLeft } = host.querySelector('canvas')!.getBoundingClientRect();
    const { left, width } = chart.chartArea;
    const at = (fraction: number) => canvasLeft + left + width * fraction;

    host.dispatchEvent(new PointerEvent('pointerdown', { clientX: at(0.375), buttons: 1 }));
    host.dispatchEvent(new PointerEvent('pointermove', { clientX: at(0.4), buttons: 1 })); // same bar: nothing new
    host.dispatchEvent(new PointerEvent('pointermove', { clientX: at(0.875), buttons: 1 }));
    host.dispatchEvent(new PointerEvent('pointermove', { clientX: at(0.125), buttons: 1 }));
    host.dispatchEvent(new PointerEvent('pointermove', { clientX: at(0.625), buttons: 0 })); // not pressed: ignored

    expect(picked).toEqual(['1-1 start', '1-3', '0-1']);
  });
});
