import { ElementRef } from '@angular/core';
import Chart from 'chart.js/auto';

import { BarRange, OilBar } from 'src/app/core/utils/pattern-utils/pattern-oil.utils';

import { BAND_SPACE, ChartBand, oilChartPlugin, setOilChartExtras, withAlpha } from '../plugins/oil-chart.plugin';

/** A label under the chart at a bar (0-based). */
export interface ChartTick {
  at: number;
  label: string;
}

export interface OilChartData {
  bands: ChartBand[];
  bars: OilBar[];
  color: string;
  selected: BarRange | null;
  ticks: ChartTick[];
}

/**
 * Generate an oil chart (stacked bars): forward passes below, reverse passes on top, like a pattern sheet's
 * "left to right" and "front to back" graphs. Updates `existingChartInstance` in place when there is one.
 */
export function generateOilChart(canvas: ElementRef<HTMLCanvasElement>, data: OilChartData, existingChartInstance?: Chart<'bar'>): Chart<'bar'> {
  const chart = existingChartInstance ?? createOilChart(canvas.nativeElement);
  const labels = new Map(data.ticks.map((t) => [t.at, t.label]));
  chart.data.labels = data.bars.map((_, i) => labels.get(i) ?? '');
  chart.data.datasets = [
    { label: 'Forward', data: data.bars.map((b) => b.forward), backgroundColor: withAlpha(data.color, 0.85) },
    { label: 'Reverse', data: data.bars.map((b) => b.reverse), backgroundColor: withAlpha(data.color, 0.4) },
  ];
  chart.options.layout!.padding = { top: data.bands.length ? BAND_SPACE : 0 };
  setOilChartExtras(chart as Chart, { bands: data.bands, selected: data.selected });
  chart.update();
  return chart;
}

function createOilChart(canvas: HTMLCanvasElement): Chart<'bar'> {
  const style = getComputedStyle(canvas);
  const text = style.getPropertyValue('--ion-text-color').trim() || '#fff';
  const muted = style.getPropertyValue('--ion-color-medium').trim() || 'gray';
  const card = style.getPropertyValue('--ion-card-background').trim() || 'transparent';
  const chart = new Chart(canvas, {
    type: 'bar',
    data: { labels: [], datasets: [] },
    plugins: [oilChartPlugin],
    options: {
      animation: false,
      maintainAspectRatio: false,
      events: [], // picking is done by the component, so drags work too
      layout: { padding: { top: 0 } },
      datasets: { bar: { barPercentage: 0.9, categoryPercentage: 1 } },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: { autoSkip: false, maxRotation: 0, color: muted, font: { size: 10 }, padding: 2 },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          border: { display: false },
          grid: { color: withAlpha(muted, 0.2), drawTicks: false },
          // labels inside the plot, so the bars keep the full width
          ticks: {
            mirror: true,
            maxTicksLimit: 4,
            color: muted,
            font: { size: 10 },
            padding: 0,
            z: 1,
            labelOffset: 6,
            showLabelBackdrop: true, // stays readable over the bars
            backdropColor: card,
            backdropPadding: 1,
            callback: (value) => (value === 0 ? '' : `${value}`), // no "1,500", and the baseline needs no 0
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
    },
  });
  setOilChartExtras(chart as Chart, { text });
  return chart;
}
