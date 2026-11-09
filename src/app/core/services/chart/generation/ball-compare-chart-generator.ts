import type { Chart } from 'chart.js';
import ChartJs from 'chart.js/auto';
import { Ball } from 'src/app/core/models/ball.model';
import { getBallMetrics } from 'src/app/core/services/ball/ball-metrics.util';
import { ElementRef } from '@angular/core';
import { barValueLabelsPlugin } from '../plugins/bar-value-labels.plugin';

const CHART_COLORS = [
  { border: 'rgba(99, 179, 237, 0.9)', bg: 'rgba(99, 179, 237, 0.15)' }, // Blue
  { border: 'rgba(252, 129, 74, 0.9)', bg: 'rgba(252, 129, 74, 0.15)' }, // Orange
  { border: 'rgba(104, 211, 145, 0.9)', bg: 'rgba(104, 211, 145, 0.15)' }, // Green
  { border: 'rgba(214, 158, 246, 0.9)', bg: 'rgba(214, 158, 246, 0.15)' }, // Purple
  { border: 'rgba(245, 101, 101, 0.9)', bg: 'rgba(245, 101, 101, 0.15)' }, // Red
  { border: 'rgba(236, 201, 75, 0.9)', bg: 'rgba(236, 201, 75, 0.15)' }, // Yellow
];
export function generateBallComparisonChart(ballCompareChartCanvas: ElementRef, balls: Ball[], existingChart: Chart | null): Chart | null {
  if (!ballCompareChartCanvas || balls.length === 0) {
    return existingChart;
  }

  const canvas = ballCompareChartCanvas.nativeElement as HTMLCanvasElement;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return existingChart;
  }

  existingChart?.destroy();

  const datasets = balls.map((ball, i) => {
    const metrics = getBallMetrics(ball);
    const color = CHART_COLORS[i % CHART_COLORS.length];
    return {
      label: ball.ball_name,
      data: [metrics.hookScore, metrics.lengthScore, metrics.flareScore],
      backgroundColor: color.border,
      borderRadius: 4,
      barPercentage: 0.9,
      categoryPercentage: 0.8,
    };
  });

  // Grouped horizontal bars instead of a radar: balls with similar scores no longer hide behind each other,
  // and the printed values make small differences readable on a phone.
  return new ChartJs(ctx, {
    type: 'bar',
    data: {
      labels: ['Hook Potential', 'Length', 'Flare'],
      datasets,
    },
    plugins: [barValueLabelsPlugin],
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      // Room for the value printed past the longest bar.
      layout: { padding: { right: 24 } },
      scales: {
        x: {
          min: 0,
          max: 100,
          grid: { color: 'rgba(255,255,255,0.08)' },
          ticks: { color: 'rgba(255,255,255,0.4)', stepSize: 25 },
        },
        y: {
          grid: { display: false },
          ticks: { color: 'rgba(255,255,255,0.75)', font: { size: 12 } },
        },
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: 'rgba(255,255,255,0.8)',
            boxWidth: 12,
            padding: 12,
            font: { size: 12 },
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${ctx.raw}`,
          },
        },
      },
    },
  });
}
