import { ElementRef } from '@angular/core';
import Chart from 'chart.js/auto';
import { vi } from 'vitest';

import { makeBall } from 'src/testing/fixtures';

import { generateBallComparisonChart } from './ball-compare-chart-generator';

/** `config` is a union that only carries `type` on some arms; at runtime it is always set. */
const chartType = (chart: Chart | null) => (chart?.config as { type: string }).type;

describe('generateBallComparisonChart', () => {
  let canvas: HTMLCanvasElement;
  let host: ElementRef;
  const created: (Chart | null)[] = [];

  beforeEach(() => {
    canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    host = new ElementRef(canvas);
  });

  afterEach(() => {
    while (created.length) created.pop()?.destroy();
    canvas.remove();
  });

  const track = (chart: Chart | null) => {
    created.push(chart);
    return chart;
  };

  const balls = [makeBall({ ball_id: 'a', ball_name: 'Phaze II' }), makeBall({ ball_id: 'b', ball_name: 'Zen Master' })];

  it('gives every ball its own series named after it', () => {
    const chart = track(generateBallComparisonChart(host, balls, null));

    expect(chartType(chart)).toBe('radar');
    expect(chart?.data.datasets.map((d) => d.label)).toEqual(['Phaze II', 'Zen Master']);
  });

  it('compares the balls on hook, length and flare', () => {
    const chart = track(generateBallComparisonChart(host, balls, null));

    expect(chart?.data.labels).toEqual(['Hook Potential', 'Length', 'Flare']);
    expect(chart?.data.datasets[0].data).toHaveLength(3);
  });

  it('keeps the existing chart when there are no balls to compare', () => {
    const existing = track(generateBallComparisonChart(host, balls, null));

    // Nothing selected — the previous chart should survive untouched rather than be torn down.
    expect(generateBallComparisonChart(host, [], existing ?? null)).toBe(existing);
  });

  it('returns the existing chart when handed no canvas', () => {
    const existing = track(generateBallComparisonChart(host, balls, null));

    expect(generateBallComparisonChart(null as unknown as ElementRef, balls, existing ?? null)).toBe(existing);
  });

  it('destroys the previous chart before drawing a new comparison', () => {
    const first = generateBallComparisonChart(host, balls, null);
    const destroy = vi.spyOn(first as Chart, 'destroy');

    const second = track(generateBallComparisonChart(host, [balls[0]], first));

    expect(destroy).toHaveBeenCalled();
    expect(second).not.toBe(first);
    expect(second?.data.datasets).toHaveLength(1);
  });
});
