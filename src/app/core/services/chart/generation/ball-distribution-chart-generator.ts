import { ElementRef } from '@angular/core';
import Chart, { ChartConfiguration, ScatterDataPoint } from 'chart.js/auto';
import zoomPlugin from 'chartjs-plugin-zoom';
import { Ball } from 'src/app/core/models/ball.model';
import { ballDistributionZonePlugin } from '../plugins/ball-distribution.plugin';
import { customAxisTitlesPlugin } from '../plugins/custom-axis-titles.plugin';

/**
 * Generate ball distribution chart showing RG vs Diff scatter plot with ball images
 */
export function generateBallDistributionChart(
  ballDistributionChartCanvas: ElementRef,
  balls: Ball[],
  existingChartInstance: Chart | undefined,
  isReload?: boolean,
  labels?: { bowlingBalls: string },
): Chart {
  try {
    const baseUrl = 'https://bowwwl.com';
    const canvas = ballDistributionChartCanvas.nativeElement as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      if (existingChartInstance) return existingChartInstance;
      throw new Error('Failed to get canvas context.');
    }

    if (isReload && existingChartInstance) {
      existingChartInstance.destroy();
    }

    const jitter = () => (Math.random() - 0.5) * 0.004;

    const dataPoints: (ScatterDataPoint & { name: string; imageUrl: string; cover: string })[] = [];
    const pointImages: HTMLImageElement[] = [];
    for (const ball of balls) {
      const xRaw = parseFloat(ball.core_diff);
      const yRaw = parseFloat(ball.core_rg);
      if (isNaN(xRaw) || isNaN(yRaw)) {
        console.warn(`Skipping invalid RG/Diff for ${ball.ball_name}`);
        continue;
      }
      const x = xRaw + jitter();
      const y = yRaw + jitter();
      dataPoints.push({ x, y, name: ball.ball_name, imageUrl: baseUrl + ball.thumbnail_image, cover: ball.coverstock_type });

      const img = new Image(70, 70);
      img.src = baseUrl + ball.thumbnail_image;
      img.onerror = () => console.warn(`Failed to load image for ${ball.ball_name}`);
      pointImages.push(img);
    }

    const dataset = {
      label: labels?.bowlingBalls ?? 'Bowling Balls',
      data: dataPoints,
      pointStyle: pointImages,
      pointHitRadius: 35,
      usePointStyle: true,
      backgroundColor: 'rgba(0,0,0,0)',
    };

    const config: ChartConfiguration<'scatter'> = {
      type: 'scatter',
      data: { datasets: [dataset] },
      plugins: [zoomPlugin, ballDistributionZonePlugin, customAxisTitlesPlugin],

      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            bottom: 20,
            left: 20,
            right: 0,
          },
          autoPadding: false,
        },
        scales: {
          x: {
            type: 'linear',
            position: 'bottom',
            ticks: {
              color: 'white',
              callback: (v) => Number(v).toFixed(3),
              font: { size: 8 },
            },
            grid: { color: 'rgba(255,255,255,0.2)', drawOnChartArea: false },
            min: 0.015,
            max: 0.073,
          },
          y: {
            ticks: {
              color: 'white',
              callback: (v) => Number(v).toFixed(3),
              font: { size: 8 },
            },
            grid: { color: 'rgba(255,255,255,0.2)', drawOnChartArea: false },
            min: 2.35,
            max: 2.75,
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true,
            backgroundColor: 'rgba(0,0,0,0.85)',
            titleFont: { size: 14, weight: 'bold' },
            mode: 'nearest',
            bodyFont: { size: 12 },
            padding: 10,
            displayColors: false,
            callbacks: {
              title: (items) => (items[0]?.raw as { name: string }).name || '',
              label: (context) => {
                const dp = context.raw as ScatterDataPoint & { cover: string };
                const x = dp.x ?? 0;
                const y = dp.y ?? 0;

                let rollCat: string;
                if (y < 2.52) {
                  rollCat = 'Early Roll';
                } else if (y < 2.58) {
                  rollCat = 'Medium Roll';
                } else {
                  rollCat = 'Later Roll';
                }

                let flareCat: string;
                if (x < 0.035) {
                  flareCat = 'Low Flare';
                } else if (x < 0.05) {
                  flareCat = 'Medium Flare';
                } else {
                  flareCat = 'High Flare';
                }

                return [`RG: ${y.toFixed(3)}`, `Diff: ${x.toFixed(3)}`, `Cover: ${dp.cover}`, rollCat, flareCat];
              },
            },
          },
          zoom: {
            zoom: {
              wheel: { enabled: true },
              pinch: { enabled: true },
              mode: 'xy',
            },
            pan: {
              enabled: true,
              mode: 'xy',
              onPanStart: ({ chart, event }) => {
                const { left, right, top, bottom } = chart.chartArea;
                const panEvent = event as unknown as { center: { x: number; y: number } };
                return (
                  panEvent.center.x >= left + 25 && panEvent.center.x <= right + 30 && panEvent.center.y >= top && panEvent.center.y <= bottom + 50
                );
              },
            },
          },
        },
      },
    };

    if (existingChartInstance && !isReload) {
      existingChartInstance.data.datasets[0] = dataset;
      if (existingChartInstance.options.scales) {
        existingChartInstance.options.scales['x'] = config.options?.scales?.['x'];
        existingChartInstance.options.scales['y'] = config.options?.scales?.['y'];
      }
      existingChartInstance.update();
      return existingChartInstance;
    } else {
      return new Chart(ctx, config);
    }
  } catch (err) {
    console.error('Error generating chart:', err);
    if (existingChartInstance) return existingChartInstance;
    throw err;
  }
}
