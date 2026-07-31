import { Injectable } from '@angular/core';
import { Pattern } from 'src/app/core/models/pattern.model';
import { LANE_ARROWS, LANE_LENGTH_FT, LANE_UNITS, laneXToBoard } from 'src/app/core/utils/pattern-utils/board.utils';
import { LoadRect, OilField, OilModel, patternToOilField, referenceOpacity, toDrawableRects } from 'src/app/core/utils/pattern-utils/oil-map.utils';

export interface PatternRenderOptions {
  /** Coverage counts passes; thickness uses mics. Coverage is the verified one. */
  model?: OilModel;
  /** Lane furniture — boards, arrows, distance ticks. Off for the AR texture. */
  showFurniture?: boolean;
  /** Board numbers along the foul line. Only drawn when furniture is on. */
  showBoardNumbers?: boolean;
}

/**
 * Sequential single-hue ramp for oil magnitude, light to dark.
 * Alpha ramps alongside lightness so zero oil is fully transparent and whatever
 * is underneath — the lane in 2D, the camera feed in AR — shows through.
 */
const OIL_RAMP: readonly { stop: number; rgb: [number, number, number] }[] = [
  { stop: 0.0, rgb: [205, 226, 251] },
  { stop: 0.25, rgb: [134, 182, 239] },
  { stop: 0.5, rgb: [57, 135, 229] },
  { stop: 0.75, rgb: [28, 92, 171] },
  { stop: 1.0, rgb: [13, 54, 107] },
];

/** Mid-ramp blue, used flat in coverage mode where opacity carries the buildup. */
const OIL_INK = '#2a78d6';

const LANE_SURFACE = '#e8dcc4';
const FURNITURE_INK = 'rgba(20, 24, 30, 0.55)';
const GRID_INK = 'rgba(20, 24, 30, 0.12)';

@Injectable({ providedIn: 'root' })
export class PatternTextureService {
  /** Renders a pattern into a canvas sized by the caller. Foul line at the bottom. */
  renderToCanvas(canvas: HTMLCanvasElement, pattern: Pattern, options: PatternRenderOptions = {}): void {
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    const { width, height } = canvas;
    const showFurniture = options.showFurniture ?? true;
    const model = options.model ?? 'coverage';

    context.clearRect(0, 0, width, height);

    if (showFurniture) {
      context.fillStyle = LANE_SURFACE;
      context.fillRect(0, 0, width, height);
    }

    if (model === 'coverage') {
      this.drawRects(context, toDrawableRects(pattern), width, height);
    } else {
      this.drawOilField(context, patternToOilField(pattern, { model }), width, height);
    }

    if (showFurniture) {
      this.drawFurniture(context, width, height, options.showBoardNumbers ?? true);
    }
  }

  /**
   * Bakes a pattern to a texture for the AR overlay: oil only, no furniture.
   * The real lane supplies its own arrows and boards — drawing ours over them
   * would double them up.
   */
  async bakeTexture(pattern: Pattern, options: PatternRenderOptions = {}): Promise<string> {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 2048;

    // Furniture off by default: in a live AR session the real lane supplies its
    // own arrows, and drawing ours over them would double them up. Callers that
    // need an opaque, self-contained lane can opt in.
    this.renderToCanvas(canvas, pattern, { ...options, showFurniture: options.showFurniture ?? false });

    return canvas.toDataURL('image/png');
  }

  /** Colour for a normalised oil value, as rgba(). */
  colourFor(value: number): string {
    const [r, g, b, a] = this.sampleRamp(value);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  private sampleRamp(value: number): [number, number, number, number] {
    const t = Math.min(1, Math.max(0, value));
    if (t <= 0) {
      return [0, 0, 0, 0];
    }

    let lower = OIL_RAMP[0];
    let upper = OIL_RAMP[OIL_RAMP.length - 1];
    for (let i = 0; i < OIL_RAMP.length - 1; i++) {
      if (t >= OIL_RAMP[i].stop && t <= OIL_RAMP[i + 1].stop) {
        lower = OIL_RAMP[i];
        upper = OIL_RAMP[i + 1];
        break;
      }
    }

    const span = upper.stop - lower.stop;
    const local = span > 0 ? (t - lower.stop) / span : 0;
    const channel = (index: number) => Math.round(lower.rgb[index] + (upper.rgb[index] - lower.rgb[index]) * local);

    // Alpha climbs quickly off zero so light coverage stays visible, then holds.
    const alpha = Math.min(1, 0.25 + t * 0.75);

    return [channel(0), channel(1), channel(2), alpha];
  }

  /**
   * Coverage mode: composite the rects the way the reference renderer does.
   *
   * Base bands run from the foul line out, loads stack on top, and overlapping
   * fills darken naturally. Normalising these into a field instead would scale
   * the 0.1 band against the brightest load and wash it out to nothing.
   */
  private drawRects(context: CanvasRenderingContext2D, rects: LoadRect[], width: number, height: number): void {
    const xToPx = (x: number) => (x / LANE_UNITS) * width;
    const feetToPx = (feet: number) => height - (feet / LANE_LENGTH_FT) * height;

    context.save();
    context.fillStyle = OIL_INK;

    for (const rect of rects) {
      const left = xToPx(rect.x0);
      const right = xToPx(rect.x1);
      const bottom = feetToPx(rect.y0);
      const top = feetToPx(rect.y1);

      context.globalAlpha = referenceOpacity(rect);
      context.fillRect(left, Math.min(top, bottom), right - left, Math.abs(bottom - top));
    }

    context.restore();
  }

  /**
   * Thickness mode: draw the field at its own resolution into an offscreen
   * buffer, then scale it up in one call. Cheaper than per-cell rects, and the
   * smoothing suits oil — it is a continuous film, not 39 discrete stripes.
   */
  private drawOilField(context: CanvasRenderingContext2D, field: OilField, width: number, height: number): void {
    if (field.max <= 0) {
      return;
    }

    const buffer = document.createElement('canvas');
    buffer.width = field.units;
    buffer.height = field.slices;

    const bufferContext = buffer.getContext('2d');
    if (!bufferContext) {
      return;
    }

    const image = bufferContext.createImageData(field.units, field.slices);
    for (let slice = 0; slice < field.slices; slice++) {
      // The field runs foul line first; the canvas draws top-down, so flip.
      const targetRow = field.slices - 1 - slice;
      for (let x = 0; x < field.units; x++) {
        const [r, g, b, a] = this.sampleRamp(field.data[slice * field.units + x] / field.max);
        const offset = (targetRow * field.units + x) * 4;
        image.data[offset] = r;
        image.data[offset + 1] = g;
        image.data[offset + 2] = b;
        image.data[offset + 3] = Math.round(a * 255);
      }
    }

    bufferContext.putImageData(image, 0, 0);

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(buffer, 0, 0, width, height);
  }

  private drawFurniture(context: CanvasRenderingContext2D, width: number, height: number, showBoardNumbers: boolean): void {
    const unitWidth = width / LANE_UNITS;
    const footHeight = height / LANE_LENGTH_FT;
    const yForFoot = (feet: number) => height - feet * footHeight;

    context.save();

    context.strokeStyle = GRID_INK;
    context.lineWidth = 1;
    for (let unit = 1; unit < LANE_UNITS; unit++) {
      const x = unit * unitWidth;
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }

    for (let feet = 10; feet < LANE_LENGTH_FT; feet += 10) {
      const y = yForFoot(feet);
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }

    context.fillStyle = FURNITURE_INK;
    for (const arrow of LANE_ARROWS) {
      const centreX = (arrow.x + 0.5) * unitWidth;
      const centreY = yForFoot(arrow.distanceFt);
      const arrowHeight = unitWidth * 2.4;
      const arrowHalfWidth = unitWidth * 0.7;

      context.beginPath();
      context.moveTo(centreX, centreY - arrowHeight / 2);
      context.lineTo(centreX - arrowHalfWidth, centreY + arrowHeight / 2);
      context.lineTo(centreX + arrowHalfWidth, centreY + arrowHeight / 2);
      context.closePath();
      context.fill();
    }

    context.strokeStyle = FURNITURE_INK;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(0, yForFoot(0));
    context.lineTo(width, yForFoot(0));
    context.stroke();

    if (showBoardNumbers) {
      context.fillStyle = FURNITURE_INK;
      context.font = `${Math.max(8, Math.round(unitWidth * 1.1))}px system-ui, sans-serif`;
      context.textAlign = 'center';
      context.textBaseline = 'bottom';

      for (const arrow of LANE_ARROWS) {
        context.fillText(String(laneXToBoard(arrow.x)), (arrow.x + 0.5) * unitWidth, height - 4);
      }
    }

    context.restore();
  }
}
