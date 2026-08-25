import { ElementRef } from '@angular/core';
import Chart from 'chart.js/auto';
import { BOWWWL_URL } from 'src/app/core/constants/app.constants';
import { makeBall } from 'src/testing/fixtures';
import { vi } from 'vitest';

import { generateBallDistributionChart } from './ball-distribution-chart-generator';

/** Each point is nudged by ±0.002 so identical balls stay distinguishable; 0.5 cancels it out. */
const withoutJitter = () => vi.spyOn(Math, 'random').mockReturnValue(0.5);

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
    withoutJitter();
    const ball = makeBall({ ball_name: 'Phaze II', core_diff: '0.051', core_rg: '2.48' });

    const chart = track(generateBallDistributionChart(host, [ball], undefined));

    expect(chartType(chart)).toBe('scatter');
    expect(pointsOf(chart)).toHaveLength(1);
    expect(pointsOf(chart)[0]).toMatchObject({ x: 0.051, y: 2.48, name: 'Phaze II' });
  });

  it('points each marker at the ball thumbnail on the bowwwl host', () => {
    withoutJitter();
    const ball = makeBall({ thumbnail_image: '/img/phaze.png' });

    const chart = track(generateBallDistributionChart(host, [ball], undefined));

    expect(pointsOf(chart)[0].imageUrl).toBe(`${BOWWWL_URL}/img/phaze.png`);
  });

  it('separates overlapping balls with a small jitter', () => {
    const twins = [makeBall({ ball_id: 'a', ball_name: 'A' }), makeBall({ ball_id: 'b', ball_name: 'B' })];

    const chart = track(generateBallDistributionChart(host, twins, undefined));
    const [first, second] = pointsOf(chart);

    // Same core numbers, so only the jitter keeps the two markers apart.
    expect(first.x).not.toBe(second.x);
    expect(Math.abs(first.x - 0.045)).toBeLessThanOrEqual(0.002);
    expect(Math.abs(second.x - 0.045)).toBeLessThanOrEqual(0.002);
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
    withoutJitter();
    const first = track(generateBallDistributionChart(host, [makeBall({ ball_name: 'First' })], undefined));

    const second = generateBallDistributionChart(host, [makeBall({ ball_name: 'Second' })], first);

    expect(second).toBe(first);
    expect(pointsOf(second).map((p) => p.name)).toEqual(['Second']);
  });

  it('destroys the previous chart when reloading', () => {
    withoutJitter();
    const first = track(generateBallDistributionChart(host, [makeBall()], undefined));
    const destroy = vi.spyOn(first, 'destroy');

    track(generateBallDistributionChart(host, [makeBall()], first, true));

    expect(destroy).toHaveBeenCalled();
  });
});
