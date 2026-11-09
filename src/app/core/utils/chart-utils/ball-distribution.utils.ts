export interface AxisBounds {
  max: number;
  min: number;
}

export interface PixelPoint {
  x: number;
  y: number;
}

export interface PixelArea {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

/** Full catalog view, used when there is nothing to fit to. */
export const DIFF_AXIS_LIMITS: AxisBounds = { min: 0.015, max: 0.073 };
export const RG_AXIS_LIMITS: AxisBounds = { min: 2.35, max: 2.75 };

/** Smallest visible span, so two near-identical balls don't look miles apart. */
const DIFF_MIN_SPAN = 0.03;
const RG_MIN_SPAN = 0.1;
const DIFF_STEP = 0.005;
const RG_STEP = 0.01;
const PADDING_RATIO = 0.2;

const MIN_MARKER_SIZE = 32;
const MAX_MARKER_SIZE = 70;
const MARKER_SIZE_RATIO = 0.1;

const round = (value: number) => Math.round(value * 1000) / 1000;

function fitAxis(values: number[], limits: AxisBounds, minSpan: number, step: number): AxisBounds {
  if (values.length === 0) return { ...limits };

  const lo = Math.min(...values);
  const hi = Math.max(...values);
  // Never cut off a ball that sits outside the usual catalog range.
  const outer = { min: Math.min(limits.min, lo), max: Math.max(limits.max, hi) };

  const pad = (hi - lo) * PADDING_RATIO;
  let min = lo - pad;
  let max = hi + pad;
  if (max - min < minSpan) {
    const center = (lo + hi) / 2;
    min = center - minSpan / 2;
    max = center + minSpan / 2;
  }

  // Small epsilon keeps values already on a step from snapping one step further out.
  min = Math.floor(min / step + 1e-9) * step;
  max = Math.ceil(max / step - 1e-9) * step;

  // Shift back inside the outer range while keeping the span.
  if (min < outer.min) {
    max += outer.min - min;
    min = outer.min;
  }
  if (max > outer.max) {
    min -= max - outer.max;
    max = outer.max;
  }

  return { min: round(Math.max(min, outer.min)), max: round(Math.min(max, outer.max)) };
}

/** Axis ranges zoomed to the given balls, with padding and a minimum span. */
export function getBallDistributionBounds(points: PixelPoint[]): { x: AxisBounds; y: AxisBounds } {
  return {
    x: fitAxis(
      points.map((p) => p.x),
      DIFF_AXIS_LIMITS,
      DIFF_MIN_SPAN,
      DIFF_STEP,
    ),
    y: fitAxis(
      points.map((p) => p.y),
      RG_AXIS_LIMITS,
      RG_MIN_SPAN,
      RG_STEP,
    ),
  };
}

/** Ball image size in px for a chart of the given width: ~32px on phones, up to 70px on desktop. */
export function getBallMarkerSize(chartWidth: number): number {
  return Math.round(Math.min(MAX_MARKER_SIZE, Math.max(MIN_MARKER_SIZE, chartWidth * MARKER_SIZE_RATIO)));
}

/**
 * Pushes markers apart until none are closer than `minDistance`, keeping their centers inside `area`.
 * Deterministic: the same input always yields the same layout, so balls don't jump between renders.
 */
export function spreadMarkers(points: PixelPoint[], minDistance: number, area: PixelArea, maxIterations = 50): PixelPoint[] {
  const positions = points.map((p) => ({ x: p.x, y: p.y }));
  const clamp = (p: PixelPoint) => {
    p.x = Math.min(Math.max(p.x, area.left), Math.max(area.left, area.right));
    p.y = Math.min(Math.max(p.y, area.top), Math.max(area.top, area.bottom));
  };

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let moved = false;
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const a = positions[i];
        const b = positions[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let distance = Math.hypot(dx, dy);
        if (distance >= minDistance) continue;

        if (distance < 0.01) {
          // Identical spots: fan out along a fixed angle per pair instead of a random one.
          const angle = (i + j) * 2.399963;
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          distance = 1;
        }

        const push = (minDistance - distance) / 2;
        const ux = dx / distance;
        const uy = dy / distance;
        a.x -= ux * push;
        a.y -= uy * push;
        b.x += ux * push;
        b.y += uy * push;
        clamp(a);
        clamp(b);
        moved = true;
      }
    }
    if (!moved) break;
  }

  positions.forEach(clamp);
  return positions;
}
