/**
 * Reads part of a decoded frame straight from the decoder's pixel data (YUV), without drawing it to a canvas.
 *
 * A canvas is colour managed: Safari tone-maps an iPhone's HDR video (HLG) into it, which flattens the
 * bright pin deck, and the ball at the far end barely stands out any more. The decoder's YUV values are
 * what the BallTracker service gets from FFmpeg, so the tracker sees the same pixels on the phone.
 */
import type { VideoSample } from 'mediabunny';

import type { CropRect } from '../shot-analysis-utils/video-trim.utils';
import { Cv } from './opencv.utils';

export type Rotation = 0 | 90 | 180 | 270;

interface StoredRect {
  height: number;
  width: number;
  x: number;
  y: number;
}

const evenDown = (v: number) => Math.floor(v / 2) * 2;
const evenUp = (v: number) => Math.ceil(v / 2) * 2;

/**
 * The rectangle of the stored (coded) frame that holds `area` of the frame as shown, i.e. turned clockwise
 * by `rotation`; widened to even edges (the colour planes have half the resolution).
 */
export function storedRect(area: CropRect, rotation: Rotation, codedW: number, codedH: number): StoredRect {
  const toStored = (x: number, y: number): [number, number] => {
    switch (rotation) {
      case 90:
        return [y, codedH - x];
      case 180:
        return [codedW - x, codedH - y];
      case 270:
        return [codedW - y, x];
      default:
        return [x, y];
    }
  };
  const a = toStored(area.left, area.top);
  const b = toStored(area.left + area.width, area.top + area.height);
  const x0 = Math.max(0, evenDown(Math.min(a[0], b[0])));
  const y0 = Math.max(0, evenDown(Math.min(a[1], b[1])));
  const x1 = Math.min(codedW, evenUp(Math.max(a[0], b[0])));
  const y1 = Math.min(codedH, evenUp(Math.max(a[1], b[1])));
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/** Where the stored rectangle `r` ends up in the frame as shown (its top-left corner). */
function shownTopLeft(r: StoredRect, rotation: Rotation, codedW: number, codedH: number): [number, number] {
  switch (rotation) {
    case 90:
      return [codedH - (r.y + r.height), r.x];
    case 180:
      return [codedW - (r.x + r.width), codedH - (r.y + r.height)];
    case 270:
      return [r.y, codedW - (r.x + r.width)];
    default:
      return [r.x, r.y];
  }
}

/**
 * `area` (in the frame as shown) as an RGB Mat, from the decoder's YUV data; null when the decoder hands
 * frames over in a format other than NV12 or I420, or doesn't let them be copied.
 */
export async function readStoredRegion(cv: Cv, sample: VideoSample, area: CropRect, rotation: Rotation): Promise<Cv | null> {
  const format = sample.format;
  if (format !== 'NV12' && format !== 'I420') {
    return null;
  }
  // coordinates within the visible part of the stored frame (decoders may pad it)
  const visible = sample.visibleRect;
  const codedW = visible.width;
  const codedH = visible.height;
  const r = storedRect(area, rotation, codedW, codedH);
  if (r.width <= 0 || r.height <= 0) {
    return null;
  }
  const rect = { x: visible.left + r.x, y: visible.top + r.y, width: r.width, height: r.height };
  const data = new Uint8Array(sample.allocationSize({ rect }));
  const layout = await sample.copyTo(data, { rect });

  // the planes packed tightly, one after the other, as OpenCV expects them
  const w = r.width;
  const h = r.height;
  const yuv = new cv.Mat(h + h / 2, w, cv.CV_8UC1);
  const out = yuv.data as Uint8Array;
  const copyPlane = (plane: number, rows: number, rowBytes: number, at: number) => {
    const { offset, stride } = layout[plane];
    for (let row = 0; row < rows; row++) {
      out.set(data.subarray(offset + row * stride, offset + row * stride + rowBytes), at + row * rowBytes);
    }
  };
  copyPlane(0, h, w, 0);
  if (format === 'NV12') {
    copyPlane(1, h / 2, w, w * h);
  } else {
    copyPlane(1, h / 2, w / 2, w * h);
    copyPlane(2, h / 2, w / 2, w * h + (w * h) / 4);
  }

  const rgb = new cv.Mat();
  const turned = new cv.Mat();
  try {
    cv.cvtColor(yuv, rgb, format === 'NV12' ? cv.COLOR_YUV2RGB_NV12 : cv.COLOR_YUV2RGB_I420);
    const code = { 90: cv.ROTATE_90_CLOCKWISE, 180: cv.ROTATE_180, 270: cv.ROTATE_90_COUNTERCLOCKWISE }[rotation as 90 | 180 | 270];
    const upright = code === undefined ? rgb : (cv.rotate(rgb, turned, code), turned);
    const [left, top] = shownTopLeft(r, rotation, codedW, codedH);
    const x = Math.round(area.left - left);
    const y = Math.round(area.top - top);
    const width = Math.min(Math.round(area.width), upright.cols - x);
    const height = Math.min(Math.round(area.height), upright.rows - y);
    const part = upright.roi(new cv.Rect(x, y, width, height));
    const copy = part.clone();
    part.delete();
    return copy;
  } finally {
    yuv.delete();
    rgb.delete();
    turned.delete();
  }
}

/** An RGB Mat as 32 x 32 grey values, like the thumbnails `shownFrame` makes. */
export function matThumbnail(cv: Cv, rgb: Cv): Float32Array {
  const gray = new cv.Mat();
  const small = new cv.Mat();
  try {
    cv.cvtColor(rgb, gray, cv.COLOR_RGB2GRAY);
    cv.resize(gray, small, new cv.Size(32, 32), 0, 0, cv.INTER_AREA);
    return Float32Array.from(small.data as Uint8Array);
  } finally {
    gray.delete();
    small.delete();
  }
}
