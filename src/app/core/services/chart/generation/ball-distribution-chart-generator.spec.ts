import { ElementRef } from '@angular/core';
import Chart from 'chart.js/auto';
import { BOWWWL_URL } from 'src/app/core/constants/app.constants';
import { getBallMetrics } from 'src/app/core/services/ball/ball-metrics.util';
import { makeBall } from 'src/testing/fixtures';
import { vi } from 'vitest';
import { generateBallDistributionChart } from './ball-distribution-chart-generator';

interface BallPoint {
  x: number;
  y: number;
  name: string;
  imageUrl: string;
  cover: string;
}

/** `config` is a union that only carries `type` on some arms; at runtime it is always set. */
const chartType = (chart: Chart) => (chart.config as { type: string }).type;

describe('generateBallDistributionChart', () => {
  let canvas: HTMLCanvasElement;
  let host: ElementRef;
  const created: Chart[] = [];

  beforeEach(() => {
    canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    host = new ElementRef(canvas);
  });

  afterEach(() => {
    while (created.length) created.pop()?.destroy();
    canvas.remove();
    vi.restoreAllMocks();
  });

  const track = (chart: Chart) => {
    created.push(chart);
    return chart;
  };

  const pointsOf = (chart: Chart) => chart.data.datasets[0].data as unknown as BallPoint[];

  it('plots each ball at its differential against its RG', () => {
    const ball = makeBall({ ball_name: 'Phaze II', core_diff: '0.051', core_rg: '2.48' });

    const chart = track(generateBallDistributionChart(host, [ball], undefined));

    expect(chartType(chart)).toBe('scatter');
    expect(pointsOf(chart)).toHaveLength(1);
    expect(pointsOf(chart)[0]).toMatchObject({ x: 0.051, y: 2.48, name: 'Phaze II' });
  });

  it('points each marker at the ball thumbnail on the bowwwl host', () => {
    const ball = makeBall({ thumbnail_image: '/img/phaze.png' });

    const chart = track(generateBallDistributionChart(host, [ball], undefined));

    expect(pointsOf(chart)[0].imageUrl).toBe(`${BOWWWL_URL}/img/phaze.png`);
  });

  it('plots identical balls at their exact spot and leaves the spreading to the markers', () => {
    const twins = [makeBall({ ball_id: 'a', ball_name: 'A' }), makeBall({ ball_id: 'b', ball_name: 'B' })];

    const chart = track(generateBallDistributionChart(host, twins, undefined));
    const [first, second] = pointsOf(chart);

    // No random jitter any more: the tooltip shows the real numbers and balls don't jump between renders.
    expect(first.x).toBe(0.045);
    expect(second.x).toBe(0.045);
  });

  it('zooms the axes to the plotted balls instead of the whole catalog', () => {
    const balls = [
      makeBall({ ball_id: 'a', core_diff: '0.026', core_rg: '2.482' }),
      makeBall({ ball_id: 'b', core_diff: '0.049', core_rg: '2.497' }),
      makeBall({ ball_id: 'c', core_diff: '0.052', core_rg: '2.461' }),
    ];

    const chart = track(generateBallDistributionChart(host, balls, undefined));

    expect(chart.options.scales?.['x']).toMatchObject({ min: 0.02, max: 0.06 });
    expect(chart.options.scales?.['y']).toMatchObject({ min: 2.42, max: 2.53 });
  });

  it('refits the axes when the existing chart gets new balls', () => {
    const first = track(generateBallDistributionChart(host, [makeBall({ core_diff: '0.02', core_rg: '2.48' })], undefined));

    generateBallDistributionChart(host, [makeBall({ core_diff: '0.055', core_rg: '2.6' })], first);

    const x = first.options.scales?.['x'] as { min: number; max: number };
    expect(x.min).toBeLessThan(0.055);
    expect(x.max).toBeGreaterThan(0.055);
  });

  it('labels roll and flare with the same scoring as the Compare tab', () => {
    // Low-RG core, but a polished pearl cover: the core alone would say "early", the whole ball reads late.
    const pearl = makeBall({ coverstock_type: 'Pearl Reactive', factory_finish: 'Power Edge', core_rg: '2.47', core_diff: '0.055' });

    const chart = track(generateBallDistributionChart(host, [pearl], undefined));
    const point = pointsOf(chart)[0] as BallPoint & { lengthLabel: string; flareLabel: string };

    expect(point.lengthLabel).toBe(getBallMetrics(pearl).lengthLabel);
    expect(point.lengthLabel).toBe('Late Roll');
    expect(point.flareLabel).toBe(getBallMetrics(pearl).flareLabel);
  });

  it('skips balls whose core numbers cannot be parsed', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const balls = [makeBall({ ball_id: 'ok', ball_name: 'Good' }), makeBall({ ball_id: 'bad', ball_name: 'Mystery', core_rg: 'n/a' })];

    const chart = track(generateBallDistributionChart(host, balls, undefined));

    expect(pointsOf(chart).map((p) => p.name)).toEqual(['Good']);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Mystery'));
  });

  it('yields an empty plot when no ball has usable numbers', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const chart = track(generateBallDistributionChart(host, [makeBall({ core_diff: '', core_rg: '' })], undefined));

    expect(pointsOf(chart)).toEqual([]);
  });

  it('swaps the dataset into the existing chart rather than rebuilding', () => {
    const first = track(generateBallDistributionChart(host, [makeBall({ ball_name: 'First' })], undefined));

    const second = generateBallDistributionChart(host, [makeBall({ ball_name: 'Second' })], first);

    expect(second).toBe(first);
    expect(pointsOf(second).map((p) => p.name)).toEqual(['Second']);
  });

  it('destroys the previous chart when reloading', () => {
    const first = track(generateBallDistributionChart(host, [makeBall()], undefined));
    const destroy = vi.spyOn(first, 'destroy');

    track(generateBallDistributionChart(host, [makeBall()], first, true));

    expect(destroy).toHaveBeenCalled();
  });
});
