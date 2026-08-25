import { ElementRef } from '@angular/core';
import type { Chart } from 'chart.js';
import ChartJs from 'chart.js/auto';

import { Ball } from 'src/app/core/models/ball.model';
import { getBallMetrics } from 'src/app/core/services/ball/ball-metrics.util';

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
      backgroundColor: color.bg,
      borderColor: color.border,
      borderWidth: 2,
      pointBackgroundColor: color.border,
      pointRadius: 4,
    };
  });

  return new ChartJs(ctx, {
    type: 'radar',
    data: {
      labels: ['Hook Potential', 'Length', 'Flare'],
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          beginAtZero: true,
          max: 100,
          grid: { color: 'rgba(255,255,255,0.12)' },
          angleLines: { color: 'rgba(255,255,255,0.12)' },
          pointLabels: {
            color: 'rgba(255,255,255,0.75)',
            font: { size: 13 },
          },
          ticks: {
            backdropColor: 'transparent',
            color: 'rgba(255,255,255,0.4)',
            stepSize: 25,
          },
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
