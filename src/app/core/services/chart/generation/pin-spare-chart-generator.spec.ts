import { ElementRef } from '@angular/core';
import Chart from 'chart.js/auto';
import { vi } from 'vitest';

import { makeStats } from 'src/testing/fixtures';

import { generatePinChart, generateSpareDistributionChart } from './pin-spare-chart-generator';

/** `config` is a union that only carries `type` on some arms; at runtime it is always set. */
const chartType = (chart: Chart) => (chart.config as { type: string }).type;

/** Pin arrays are 1-based; index 0 is padding the calculators slice off. */
const pinStats = () =>
  makeStats({
    spareRates: [0, 100, 90, 80, 70, 60, 50, 40, 30, 20, 10],
    pinCounts: [0, 10, 8, 6, 4, 2, 0, 0, 0, 0, 1],
    missedCounts: [0, 2, 4, 0, 0, 0, 0, 0, 0, 0, 3],
  });

describe('pin-spare-chart-generator', () => {
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
  });

  const track = (chart: Chart) => {
    created.push(chart);
    return chart;
  };

  describe('generatePinChart', () => {
    it('plots converted and missed rates for all ten pins', () => {
      const chart = track(generatePinChart(host, pinStats(), undefined));

      expect(chartType(chart)).toBe('radar');
      expect(chart.data.labels).toHaveLength(10);
      expect(chart.data.labels?.[0]).toBe('1 Pin');
      expect(chart.data.labels?.[9]).toBe('10 Pins');
      expect(chart.data.datasets[0].label).toBe('Converted');
      expect(chart.data.datasets[1].label).toBe('Missed');
      expect(chart.data.datasets[0].data).toHaveLength(10);
    });

    it('drops the unused leading entry from the pin arrays', () => {
      const chart = track(generatePinChart(host, pinStats(), undefined));

      // spareRates[0] is padding — the first plotted rate is pin 1's 100.
      expect(chart.data.datasets[0].data[0]).toBe(100);
      expect(chart.data.datasets[0].data[9]).toBe(10);
    });

    it('refreshes both datasets on the existing chart rather than rebuilding', () => {
      const first = track(generatePinChart(host, pinStats(), undefined));

      const second = generatePinChart(host, makeStats({ spareRates: Array(11).fill(50) }), first);

      expect(second).toBe(first);
      expect(second.data.datasets[0].data[0]).toBe(50);
    });

    it('destroys the previous chart when reloading', () => {
      const first = track(generatePinChart(host, pinStats(), undefined));
      const destroy = vi.spyOn(first, 'destroy');

      const second = track(generatePinChart(host, pinStats(), first, true));

      expect(destroy).toHaveBeenCalled();
      expect(second).not.toBe(first);
    });
  });

  describe('generateSpareDistributionChart', () => {
    it('counts an appearance as every time the leave was hit or missed', () => {
      const chart = track(generateSpareDistributionChart(host, pinStats(), undefined));

      expect(chartType(chart)).toBe('bar');
      expect(chart.data.labels).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
      // Pin 1: 10 converted + 2 missed = 12 appearances; pin 2: 8 + 4 = 12.
      expect(chart.data.datasets[0].data).toEqual([12, 12, 6, 4, 2, 0, 0, 0, 0, 4]);
      expect(chart.data.datasets[1].data).toEqual([10, 8, 6, 4, 2, 0, 0, 0, 0, 1]);
    });

    it('labels the two series by what they measure', () => {
      const chart = track(generateSpareDistributionChart(host, pinStats(), undefined));

      expect(chart.data.datasets[0].label).toBe('Appearance Count');
    });

    it('reuses the existing chart when not reloading', () => {
      const first = track(generateSpareDistributionChart(host, pinStats(), undefined));

      const second = generateSpareDistributionChart(host, pinStats(), first);

      expect(second).toBe(first);
    });

    it('destroys the previous chart when reloading', () => {
      const first = track(generateSpareDistributionChart(host, pinStats(), undefined));
      const destroy = vi.spyOn(first, 'destroy');

      track(generateSpareDistributionChart(host, pinStats(), first, true));

      expect(destroy).toHaveBeenCalled();
    });
  });
});
