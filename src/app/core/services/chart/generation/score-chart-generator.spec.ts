import { ElementRef } from '@angular/core';
import Chart from 'chart.js/auto';
import { vi } from 'vitest';

import { makeGame } from 'src/testing/fixtures';

import { generateAverageScoreChart, generateScoreChart, generateScoreDistributionChart } from './score-chart-generator';

const at = (year: number, month: number, day: number) => new Date(year, month - 1, day).getTime();
const gameOn = (date: number, totalScore: number) => makeGame({ date, totalScore, gameId: `${date}-${totalScore}` });

describe('score-chart-generator', () => {
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

  const games = [gameOn(at(2026, 1, 5), 150), gameOn(at(2026, 1, 5), 180), gameOn(at(2026, 2, 3), 210)];

  describe('generateScoreChart', () => {
    it('plots the running average, the swing around it, and games played', () => {
      const chart = track(generateScoreChart(host, games, undefined));

      expect(chart.data.datasets.map((d) => d.label)).toEqual(['Average over time', 'Difference from average', 'Games played']);
    });

    it('puts games played on its own right-hand axis', () => {
      const chart = track(generateScoreChart(host, games, undefined));

      const gamesPlayed = chart.data.datasets.find((d) => d.label === 'Games played') as { yAxisID?: string } | undefined;
      expect(gamesPlayed?.yAxisID).toBe('y1');
      expect(chart.options.scales?.['y']?.suggestedMax).toBe(300);
    });

    it('defaults to the per-game view', () => {
      const perGame = track(generateScoreChart(host, games, undefined));

      // Per-game plots one point per game; sessions would collapse the two 5 Jan games.
      expect(perGame.data.labels).toHaveLength(3);
    });

    it('honours the requested view mode', () => {
      const bySession = track(generateScoreChart(host, games, undefined, 'session'));

      expect(bySession.data.labels).toEqual(['1/5/2026', '2/3/2026']);
    });

    it('destroys the previous chart when reloading', () => {
      const first = track(generateScoreChart(host, games, undefined));
      const destroy = vi.spyOn(first, 'destroy');

      track(generateScoreChart(host, games, first, 'game', undefined, true));

      expect(destroy).toHaveBeenCalled();
    });
  });

  describe('generateScoreDistributionChart', () => {
    it('buckets scores in tens and collapses the empty stretches', () => {
      const chart = track(generateScoreDistributionChart(host, [gameOn(at(2026, 1, 5), 150), gameOn(at(2026, 1, 6), 155)], undefined));

      // Two games in the 150s; everything either side folds into one empty band.
      expect(chart.data.labels).toEqual(['0-149', '150-159', '160-299']);
      expect(chart.data.datasets[0].data).toEqual([0, 2, 0]);
    });

    it('files a 300 in the top bucket rather than off the end', () => {
      const chart = track(generateScoreDistributionChart(host, [gameOn(at(2026, 1, 5), 300)], undefined));

      expect(chart.data.labels).toEqual(['0-289', '290-300']);
      expect(chart.data.datasets[0].data).toEqual([0, 1]);
    });

    it('keeps a gutter game in the lowest bucket', () => {
      const chart = track(generateScoreDistributionChart(host, [gameOn(at(2026, 1, 5), 0)], undefined));

      expect(chart.data.labels?.[0]).toBe('0-9');
      expect(chart.data.datasets[0].data[0]).toBe(1);
    });

    it('renders a single empty band when there are no games', () => {
      const chart = track(generateScoreDistributionChart(host, [], undefined));

      expect(chart.data.labels).toEqual(['0-299']);
      expect(chart.data.datasets[0].data).toEqual([0]);
    });

    it('refreshes the existing chart rather than rebuilding it', () => {
      const first = track(generateScoreDistributionChart(host, [gameOn(at(2026, 1, 5), 150)], undefined));

      const second = generateScoreDistributionChart(host, [gameOn(at(2026, 1, 5), 300)], first);

      expect(second).toBe(first);
      expect(second.data.labels).toEqual(['0-289', '290-300']);
    });
  });

  describe('generateAverageScoreChart', () => {
    it('plots the average alongside games played', () => {
      const chart = track(generateAverageScoreChart(host, games, undefined));

      expect(chart.data.datasets.map((d) => d.label)).toEqual(['Average score', 'Games played']);
    });

    it('defaults to the monthly view', () => {
      const chart = track(generateAverageScoreChart(host, games, undefined));

      expect(chart.data.labels).toEqual(['Jan 2026', 'Feb 2026']);
    });

    it('honours the requested view mode', () => {
      const yearly = track(generateAverageScoreChart(host, games, undefined, 'yearly'));

      expect(yearly.data.labels).toEqual(['2026']);
    });

    it('destroys the previous chart when reloading', () => {
      const first = track(generateAverageScoreChart(host, games, undefined));
      const destroy = vi.spyOn(first, 'destroy');

      track(generateAverageScoreChart(host, games, first, 'monthly', undefined, true));

      expect(destroy).toHaveBeenCalled();
    });
  });
});
