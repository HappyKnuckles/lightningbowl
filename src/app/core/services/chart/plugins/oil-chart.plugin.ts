import Chart, { Plugin } from 'chart.js/auto';

import { BarRange } from 'src/app/core/utils/pattern-utils/pattern-oil.utils';

/** A band label over a range of bars (0-based, both included), drawn above the bars. */
export interface ChartBand {
  from: number;
  label: string;
  to: number;
}

/** What the plugin draws besides the bars, per chart. */
export interface OilChartExtras {
  bands: ChartBand[];
  selected: BarRange | null;
  text: string;
}

const BAND_H = 16;
const BAND_GAP = 4;
/** Room the bands need above the bars. */
export const BAND_SPACE = BAND_H + BAND_GAP;

const extrasOf = new WeakMap<Chart, OilChartExtras>();

/** Sets what `oilChartPlugin` draws on `chart`, merged into what it drew before. */
export function setOilChartExtras(chart: Chart, extras: Partial<OilChartExtras>): void {
  extrasOf.set(chart, { bands: [], selected: null, text: '#fff', ...extrasOf.get(chart), ...extras });
}

/** `color` with the given opacity, for any CSS color the canvas understands ("red", "#ed8e07", …). */
export function withAlpha(color: string, alpha: number): string {
  const ctx = document.createElement('canvas').getContext('2d')!;
  ctx.fillStyle = color;
  const hex = ctx.fillStyle; // the canvas hands back "#rrggbb" for opaque colors
  if (!/^#[0-9a-f]{6}$/i.test(hex)) {
    return color;
  }
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Shades the picked bars behind the bars, and draws the ratio bands in the padding above them. */
export const oilChartPlugin: Plugin<'bar'> = {
  id: 'oilChart',
  beforeDatasetsDraw(chart) {
    const extras = extrasOf.get(chart as Chart);
    const range = extras?.selected;
    const count = chart.data.labels?.length ?? 0;
    if (!extras || !range || count === 0) {
      return;
    }
    const { ctx, chartArea } = chart;
    const step = chartArea.width / count;
    const from = Math.max(0, range.from);
    const to = Math.min(count - 1, range.to);
    ctx.save();
    ctx.fillStyle = withAlpha(extras.text, 0.15);
    ctx.fillRect(chartArea.left + from * step, chartArea.top, (to - from + 1) * step, chartArea.height);
    ctx.restore();
  },
  afterDraw(chart) {
    const extras = extrasOf.get(chart as Chart);
    const count = chart.data.labels?.length ?? 0;
    if (!extras?.bands.length || count === 0) {
      return;
    }
    const { ctx, chartArea } = chart;
    const step = chartArea.width / count;
    const top = chartArea.top - BAND_SPACE;
    ctx.save();
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const band of extras.bands) {
      const x = chartArea.left + band.from * step + 1;
      const width = (band.to - band.from + 1) * step - 2;
      ctx.fillStyle = withAlpha(extras.text, 0.08);
      ctx.beginPath();
      ctx.roundRect(x, top, width, BAND_H, 4);
      ctx.fill();
      ctx.fillStyle = extras.text;
      ctx.fillText(band.label, x + width / 2, top + BAND_H / 2, width - 2);
    }
    ctx.restore();
  },
};
