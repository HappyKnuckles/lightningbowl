import type { Plugin } from 'chart.js';

/** Prints each horizontal bar's value just past its end, so small differences between balls stay readable. */
export const barValueLabelsPlugin: Plugin<'bar'> = {
  id: 'barValueLabels',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    ctx.save();
    ctx.font = '10px Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (meta.hidden) return;
      meta.data.forEach((bar, index) => {
        const value = dataset.data[index];
        if (typeof value !== 'number') return;
        ctx.fillText(String(value), bar.x + 4, bar.y);
      });
    });

    ctx.restore();
  },
};
