import type { Chart, Plugin } from 'chart.js';

import { getBallMarkerSize, PixelPoint, spreadMarkers } from 'src/app/core/utils/chart-utils/ball-distribution.utils';

export interface BallMarkerPoint {
  image?: HTMLImageElement;
  name: string;
  x: number;
  y: number;
}

interface MarkerLayout {
  labelWidth: number;
  markers: { anchor: PixelPoint; index: number; position: PixelPoint }[];
  size: number;
}

/** Room for the name below each ball. */
const LABEL_HEIGHT = 12;
/** Keeps balls clear of the Diff band labels along the top edge. */
const TOP_LABEL_HEIGHT = 16;
const LABEL_FONT = '10px Arial';
/** Extra spacing between balls so names under neighbouring balls stay readable. */
const MARKER_GAP = 20;
/** Names may run a bit wider than the spacing; only nudged neighbours sit that close. */
const MIN_LABEL_WIDTH = 76;

const layouts = new WeakMap<Chart, MarkerLayout>();

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let end = text.length;
  while (end > 1 && ctx.measureText(`${text.slice(0, end)}…`).width > maxWidth) end--;
  return `${text.slice(0, end)}…`;
}

function computeLayout(chart: Chart): MarkerLayout | null {
  const { chartArea, scales } = chart;
  const meta = chart.getDatasetMeta(0);
  const data = chart.data.datasets[0]?.data as unknown as BallMarkerPoint[] | undefined;
  if (!chartArea || !scales['x'] || !scales['y'] || !data) return null;

  const size = getBallMarkerSize(chart.width);
  const half = size / 2;

  const visible: { anchor: PixelPoint; index: number; }[] = [];
  data.forEach((point, index) => {
    const x = scales['x'].getPixelForValue(point.x);
    const y = scales['y'].getPixelForValue(point.y);
    // Balls panned or zoomed out of view are left out instead of being pinned to the edge.
    if (x < chartArea.left || x > chartArea.right || y < chartArea.top || y > chartArea.bottom) return;
    visible.push({ index, anchor: { x, y } });
  });

  const positions = spreadMarkers(
    visible.map((v) => v.anchor),
    size + MARKER_GAP,
    {
      left: chartArea.left + half,
      right: chartArea.right - half,
      top: chartArea.top + half + TOP_LABEL_HEIGHT,
      bottom: chartArea.bottom - half - LABEL_HEIGHT,
    },
  );

  // Move the hit areas onto the drawn balls so tapping a nudged ball still opens its tooltip.
  const visibleIndexes = new Set(visible.map((v) => v.index));
  const elements = meta.data as unknown as { skip: boolean; x: number; y: number; }[];
  elements.forEach((element, index) => {
    if (!visibleIndexes.has(index)) element.skip = true;
  });
  visible.forEach((v, i) => {
    const element = elements[v.index];
    if (!element) return;
    element.skip = false;
    element.x = positions[i].x;
    element.y = positions[i].y;
  });

  return {
    size,
    labelWidth: Math.max(size + MARKER_GAP, MIN_LABEL_WIDTH),
    markers: visible.map((v, i) => ({ index: v.index, anchor: v.anchor, position: positions[i] })),
  };
}

/**
 * Draws each ball's image with its name below. Overlapping balls are nudged apart;
 * a thin line then connects the image to a dot at the ball's real RG/Diff spot.
 */
export const ballMarkersPlugin: Plugin<'scatter'> = {
  id: 'ballMarkers',
  beforeDatasetsDraw(chart) {
    const layout = computeLayout(chart as unknown as Chart);
    if (layout) layouts.set(chart as unknown as Chart, layout);
    else layouts.delete(chart as unknown as Chart);
  },
  afterDatasetsDraw(chart) {
    const layout = layouts.get(chart as unknown as Chart);
    if (!layout) return;
    const { ctx } = chart;
    const data = chart.data.datasets[0].data as unknown as BallMarkerPoint[];
    const { size, labelWidth, markers } = layout;
    const half = size / 2;

    ctx.save();

    // Leader lines and true-position dots first, so images sit on top of them.
    for (const { anchor, position } of markers) {
      if (Math.hypot(position.x - anchor.x, position.y - anchor.y) < 1) continue;
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(anchor.x, anchor.y);
      ctx.lineTo(position.x, position.y);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(anchor.x, anchor.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const { index, position } of markers) {
      const image = data[index]?.image;
      if (image?.complete && image.naturalWidth > 0) {
        ctx.drawImage(image, position.x - half, position.y - half, size, size);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.arc(position.x, position.y, half, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.font = LABEL_FONT;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const { index, position } of markers) {
      const name = data[index]?.name;
      if (name) ctx.fillText(truncate(ctx, name, labelWidth), position.x, position.y + half + 2);
    }

    ctx.restore();
  },
  afterDestroy(chart) {
    layouts.delete(chart as unknown as Chart);
  },
};
