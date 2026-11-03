import { ElementRef } from '@angular/core';
import Chart from 'chart.js/auto';

import { generateOilChart, OilChartData } from './oil-chart-generator';

describe('generateOilChart', () => {
  let canvas: HTMLCanvasElement;
  let chart: Chart<'bar'> | undefined;

  const data = (overrides: Partial<OilChartData> = {}): OilChartData => ({
    bars: [
      { forward: 50, reverse: 50 },
      { forward: 25, reverse: 0 },
    ],
    color: 'green',
    ticks: [],
    bands: [],
    selected: null,
    ...overrides,
  });

  beforeEach(() => {
    canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
  });

  afterEach(() => {
    chart?.destroy();
    chart = undefined;
    canvas.remove();
  });

  it('stacks the reverse oil on the forward oil in the given color', () => {
    chart = generateOilChart(new ElementRef(canvas), data());

    const [forward, reverse] = chart.data.datasets;
    expect(forward.data).toEqual([50, 25]);
    expect(reverse.data).toEqual([50, 0]);
    expect(forward.backgroundColor).toBe('rgba(0, 128, 0, 0.85)');
    expect(chart.options.scales!['x']!.stacked).toBe(true);
    expect(chart.options.scales!['y']!.stacked).toBe(true);
  });

  it('labels only the ticked bars and makes room for bands above them', () => {
    chart = generateOilChart(
      new ElementRef(canvas),
      data({
        bars: Array.from({ length: 4 }, () => ({ forward: 1, reverse: 0 })),
        ticks: [{ at: 1, label: '2' }],
        bands: [{ from: 2, to: 3, label: '1:1' }],
      }),
    );

    expect(chart.data.labels).toEqual(['', '2', '', '']);
    expect(chart.options.layout!.padding).toEqual({ top: 20 });
  });

  it('updates an existing chart in place', () => {
    chart = generateOilChart(new ElementRef(canvas), data({ bands: [{ from: 0, to: 1, label: '1:1' }] }));
    const updated = generateOilChart(new ElementRef(canvas), data({ bars: [{ forward: 3, reverse: 0 }] }), chart);

    expect(updated).toBe(chart);
    expect(chart.data.datasets[0].data).toEqual([3]);
    expect(chart.options.layout!.padding).toEqual({ top: 0 });
  });
});
