import { ElementRef } from '@angular/core';
import Chart, { ChartConfiguration, ScatterDataPoint } from 'chart.js/auto';
import zoomPlugin from 'chartjs-plugin-zoom';
import { Ball } from 'src/app/core/models/ball.model';
import { BOWWWL_URL } from 'src/app/core/constants/app.constants';
import { getBallDistributionBounds, getBallMarkerSize } from 'src/app/core/utils/chart-utils/ball-distribution.utils';
import { ballDistributionZonePlugin } from '../plugins/ball-distribution.plugin';
import { BallMarkerPoint, ballMarkersPlugin } from '../plugins/ball-markers.plugin';
import { customAxisTitlesPlugin } from '../plugins/custom-axis-titles.plugin';

/**
 * Generate ball distribution chart showing RG vs Diff scatter plot with ball images
 */
export function generateBallDistributionChart(
  ballDistributionChartCanvas: ElementRef,
  balls: Ball[],
  existingChartInstance: Chart | undefined,
  isReload?: boolean,
): Chart {
  try {
    const baseUrl = BOWWWL_URL;
    const canvas = ballDistributionChartCanvas.nativeElement as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      if (existingChartInstance) return existingChartInstance;
      throw new Error('Failed to get canvas context.');
    }

    if (isReload && existingChartInstance) {
      existingChartInstance.destroy();
    }

    const dataPoints: (ScatterDataPoint & BallMarkerPoint & { image: HTMLImageElement; imageUrl: string; cover: string })[] = [];
    for (const ball of balls) {
      const x = parseFloat(ball.core_diff);
      const y = parseFloat(ball.core_rg);
      if (isNaN(x) || isNaN(y)) {
        console.warn(`Skipping invalid RG/Diff for ${ball.ball_name}`);
        continue;
      }

      const image = new Image();
      image.src = baseUrl + ball.thumbnail_image;
      image.onerror = () => console.warn(`Failed to load image for ${ball.ball_name}`);
      dataPoints.push({ x, y, name: ball.ball_name, imageUrl: baseUrl + ball.thumbnail_image, cover: ball.coverstock_type, image });
    }

    // Zoom the axes to the plotted balls so they spread over the chart instead of clumping in one corner.
    const bounds = getBallDistributionBounds(dataPoints);

    // Images, names and overlap handling are drawn by ballMarkersPlugin; the points only carry the hit area.
    const dataset = {
      label: 'Bowling Balls',
      data: dataPoints,
      pointRadius: 0,
      pointHoverRadius: 0,
      pointHitRadius: (context: { chart: Chart }) => getBallMarkerSize(context.chart.width) / 2,
      backgroundColor: 'rgba(0,0,0,0)',
    };

    const config: ChartConfiguration<'scatter'> = {
      type: 'scatter',
      data: { datasets: [dataset] },
      plugins: [zoomPlugin, ballDistributionZonePlugin, ballMarkersPlugin, customAxisTitlesPlugin],

      options: {
        responsive: true,
        // The markers plugin moves points onto their nudged spots; animating them would fight that.
        animation: false,
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
            min: bounds.x.min,
            max: bounds.x.max,
          },
          y: {
            ticks: {
              color: 'white',
              callback: (v) => Number(v).toFixed(3),
              font: { size: 8 },
            },
            grid: { color: 'rgba(255,255,255,0.2)', drawOnChartArea: false },
            min: bounds.y.min,
            max: bounds.y.max,
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
                const panEvent = event as { center: { x: number; y: number } };
                return (
                  panEvent.center.x >= left + 25 && panEvent.center.x <= right + 30 && panEvent.center.y >= top && panEvent.center.y <= bottom + 50
                );
              },
            },
          },
        },
      },
    };

    let chart: Chart;
    if (existingChartInstance && !isReload) {
      existingChartInstance.data.datasets[0] = dataset;
      if (existingChartInstance.options.scales) {
        existingChartInstance.options.scales['x'] = config.options?.scales?.['x'];
        existingChartInstance.options.scales['y'] = config.options?.scales?.['y'];
      }
      existingChartInstance.update();
      chart = existingChartInstance;
    } else {
      chart = new Chart(ctx, config);
    }

    // Images load after the first draw; repaint once each arrives.
    for (const { image } of dataPoints) {
      if (!image.complete) image.addEventListener('load', () => chart.canvas && chart.draw(), { once: true });
    }
    return chart;
  } catch (err) {
    console.error('Error generating chart:', err);
    if (existingChartInstance) return existingChartInstance;
    throw err;
  }
}
