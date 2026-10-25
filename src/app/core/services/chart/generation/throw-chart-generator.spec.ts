import { ElementRef } from '@angular/core';
import Chart from 'chart.js/auto';
import { makeStats } from 'src/testing/fixtures';
import { vi } from 'vitest';
import { generateThrowChart } from './throw-chart-generator';

/** `config` is a union that only carries `type` on some arms; at runtime it is always set. */
const chartType = (chart: Chart) => (chart.config as { type: string }).type;

describe('generateThrowChart', () => {
  let canvas: HTMLCanvasElement;
  let host: ElementRef;
  const created: Chart[] = [];

  beforeEach(() => {
    canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    host = new ElementRef(canvas);
  });

  afterEach(() => {
    // Chart.js keeps a registry keyed by canvas — leaving instances alive breaks the next test.
    while (created.length) created.pop()?.destroy();
    canvas.remove();
  });

  const generate = (...args: Parameters<typeof generateThrowChart>) => {
    const chart = generateThrowChart(...args);
    created.push(chart);
    return chart;
  };

  it('builds a radar chart of spare, strike and open rates', () => {
    const stats = makeStats({ sparePercentage: 40.5, strikePercentage: 35.25, openPercentage: 24.25 });

    const chart = generate(host, stats, undefined);

    expect(chartType(chart)).toBe('radar');
    expect(chart.data.labels).toEqual(['Spare', 'Strike', 'Open']);
    // Data follows the label order — spares, strikes, opens — not the destructured order.
    expect(chart.data.datasets[0].data).toEqual([40.5, 35.25, 24.25]);
  });

  it('caps the radial axis at 100 so percentages stay comparable', () => {
    const chart = generate(host, makeStats(), undefined);

    expect(chart.options.scales?.['r']?.max).toBe(100);
  });

  it('reuses the existing chart instead of building a second one', () => {
    const first = generate(host, makeStats({ sparePercentage: 10 }), undefined);

    const second = generateThrowChart(host, makeStats({ sparePercentage: 55, strikePercentage: 30 }), first);

    expect(second).toBe(first);
    expect(second.data.datasets[0].data).toEqual([55, 30, 0]);
  });

  it('destroys the previous chart when reloading', () => {
    const first = generate(host, makeStats(), undefined);
    const destroy = vi.spyOn(first, 'destroy');

    const second = generate(host, makeStats(), first, true);

    expect(destroy).toHaveBeenCalled();
    expect(second).not.toBe(first);
  });
});
