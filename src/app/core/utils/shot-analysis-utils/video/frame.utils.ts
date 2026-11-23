/**
 * The video's frames as the tracker reads them: the part of the frame it needs, the frame the way the
 * browser shows it, and part of a decoded frame straight from the decoder's pixel data (YUV), without
 * drawing it to a canvas.
 *
 * A canvas is colour managed: Safari tone-maps an iPhone's HDR video (HLG) into it, which flattens the
 * bright pin deck, and the ball at the far end barely stands out any more. The decoder's YUV values are
 * what the BallTracker service gets from FFmpeg, so the tracker sees the same pixels on the phone.
 *
 * The region is copied once per frame. Its Y plane is the grey frame for the alignment as it is (no
 * conversion, no turning); only the part the lane needs is converted to RGB, left as stored: the
 * tracker's warp turns it upright on the way.
 */
import type { VideoSample } from 'mediabunny';

import { ShotCalibration } from 'src/app/core/models/shot-analysis.model';

import { Mat3, mul3 } from '../geometry/math.utils';
import type { FramePixels } from '../tracking/frame-tracker.utils';
import { Cv, release } from './opencv.utils';

/** A rectangle on the video frame, in display pixels (after the video's rotation). */
export interface CropRect {
  height: number;
  left: number;
  top: number;
  width: number;
}

/**
 * Room kept around the lane, as a share of the lane's larger side: for hand shake, for the ball and
 * pins above the lane, and for enough of the scene for the tracker to align the frames on.
 */
const LANE_CROP_MARGIN = 0.5;
/** A crop has to leave out at least this share of the frame to be worth it. */
const MIN_CROP_SAVING = 0.4;

const evenFloor = (value: number) => Math.floor(value / 2) * 2;

/**
 * The part of the frame the tracker needs: the marked lane (foul line to the pins) plus
 * {@link LANE_CROP_MARGIN}, in display pixels with even sizes. Null when that is most of the frame anyway.
 */
export function laneCropRect(calibration: ShotCalibration, frame: { height: number; width: number }): CropRect | null {
  const corners = [calibration.foulLeft, calibration.foulRight, calibration.farLeft, calibration.farRight];
  const xs = corners.map(([x]) => x * frame.width);
  const ys = corners.map(([, y]) => y * frame.height);
  const margin = LANE_CROP_MARGIN * Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const left = evenFloor(Math.max(0, Math.min(...xs) - margin));
  const top = evenFloor(Math.max(0, Math.min(...ys) - margin));
  const width = evenFloor(Math.min(frame.width, Math.max(...xs) + margin) - left);
  const height = evenFloor(Math.min(frame.height, Math.max(...ys) + margin) - top);
  if (width <= 0 || height <= 0 || width * height > (1 - MIN_CROP_SAVING) * frame.width * frame.height) {
    return null;
  }
  return { left, top, width, height };
}

/** Side of the grey thumbnails {@link shownFrame} makes. */
const MATCH_PX = 32;
/**
 * Right after `seeked` a busy device can still draw the frame from before the seek: the frame is drawn
 * again this long apart (ms) until two draws agree, at most this many times.
 */
const SETTLE_MS = 40;
const SETTLE_TRIES = 6;

/** Resolves on `name`, rejects on an error or after `timeoutMs`. */
function nextEvent(target: HTMLVideoElement, name: string, timeoutMs = 10_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = (ok: boolean) => {
      clearTimeout(timer);
      target.removeEventListener(name, onEvent);
      target.removeEventListener('error', onError);
      if (ok) resolve();
      else reject(new Error(`video: no ${name}`));
    };
    const onEvent = () => done(true);
    const onError = () => done(false);
    const timer = setTimeout(() => done(false), timeoutMs);
    target.addEventListener(name, onEvent);
    target.addEventListener('error', onError);
  });
}

/**
 * The frame at `timeS` the way the browser shows the video (rotation applied), cut to `crop`, as
 * {@link MATCH_PX}² grey values; null when the browser can't show it.
 */
export async function shownFrame(source: Blob, timeS: number, crop?: CropRect): Promise<Float32Array | null> {
  return (await shownGrays(source, timeS, crop, [{ width: MATCH_PX, height: MATCH_PX }]))?.[0] ?? null;
}

/**
 * The frame at `timeS` the way the browser shows the video (rotation applied), cut to `crop`, as grey
 * values at each of `sizes` (row by row); null when the browser can't show it.
 */
export async function shownGrays(
  source: Blob,
  timeS: number,
  crop: CropRect | undefined,
  sizes: readonly { height: number; width: number }[],
): Promise<Float32Array[] | null> {
  const url = URL.createObjectURL(source);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  try {
    const loaded = nextEvent(video, 'loadeddata');
    video.src = url;
    await loaded;
    const seeked = nextEvent(video, 'seeked');
    // seeking to where the video already is fires no `seeked`
    video.currentTime = Math.max(timeS, 0.001);
    await seeked;
    const area = crop ?? { left: 0, top: 0, width: video.videoWidth, height: video.videoHeight };
    const draw = (width: number, height: number): Float32Array | null => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        return null;
      }
      ctx.drawImage(video, area.left, area.top, area.width, area.height, 0, 0, width, height);
      const { data } = ctx.getImageData(0, 0, width, height);
      const grey = new Float32Array(width * height);
      for (let i = 0; i < grey.length; i++) {
        grey[i] = 0.299 * data[4 * i] + 0.587 * data[4 * i + 1] + 0.114 * data[4 * i + 2];
      }
      return grey;
    };
    let before = draw(MATCH_PX, MATCH_PX);
    for (let k = 0; k < SETTLE_TRIES && before; k++) {
      await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
      const now = draw(MATCH_PX, MATCH_PX);
      if (now && now.every((v, i) => v === before![i])) {
        break;
      }
      before = now;
    }
    const grays = sizes.map(({ width, height }) => draw(width, height));
    return grays.every((grey) => grey !== null) ? (grays as Float32Array[]) : null;
  } catch {
    return null;
  } finally {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}

/** Correlation of two thumbnails, -1 to 1; 0 when either is flat (nothing to compare). */
export function frameSimilarity(a: Float32Array, b: Float32Array): number {
  const mean = (v: Float32Array) => v.reduce((sum, x) => sum + x, 0) / v.length;
  const ma = mean(a);
  const mb = mean(b);
  let ab = 0;
  let aa = 0;
  let bb = 0;
  for (let i = 0; i < a.length; i++) {
    ab += (a[i] - ma) * (b[i] - mb);
    aa += (a[i] - ma) ** 2;
    bb += (b[i] - mb) ** 2;
  }
  return aa > 1e-6 && bb > 1e-6 ? ab / Math.sqrt(aa * bb) : 0;
}

export type Rotation = 0 | 90 | 180 | 270;

interface StoredRect {
  height: number;
  width: number;
  x: number;
  y: number;
}

/**
 * A region of a frame as the decoder stores it (not turned), the way `VideoFrame.copyTo` lays it out:
 * 8-bit YUV planes as decoded, or RGBA the browser converted the frame to.
 */
export interface StoredPlanes {
  /** Size of the stored frame (its visible part). */
  codedH: number;
  codedW: number;
  data: Uint8Array;
  format: 'NV12' | 'I420' | 'RGBA';
  layout: { offset: number; stride: number }[];
  /** The copied rectangle, in the stored frame. */
  rect: StoredRect;
  rotation: Rotation;
  /** How the pixels were read: copied out of the frame, or read back from a WebGL texture (frames on the GPU). */
  via: 'copy' | 'webgl';
}

const evenDown = (v: number) => Math.floor(v / 2) * 2;
const evenUp = (v: number) => Math.ceil(v / 2) * 2;
const translate = (x: number, y: number): Mat3 => [1, 0, x, 0, 1, y, 0, 0, 1];

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

/** Stored pixels to pixels of the frame as shown (pixel centres), for a stored frame of `codedW` x `codedH`. */
export function storedToShown(rotation: Rotation, codedW: number, codedH: number): Mat3 {
  switch (rotation) {
    case 90:
      return [0, -1, codedH - 1, 1, 0, 0, 0, 0, 1];
    case 180:
      return [-1, 0, codedW - 1, 0, -1, codedH - 1, 0, 0, 1];
    case 270:
      return [0, 1, 0, -1, 0, codedW - 1, 0, 0, 1];
    default:
      return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  }
}

/**
 * Copies the part of the frame holding `area` (in the frame as shown) out of the decoder; null when the
 * browser can't copy it out. 8-bit YUV is copied as decoded. Anything else is converted to RGBA by the
 * browser: frames the decoder keeps on the GPU (no `format`, as hardware decoders hand them over) through
 * WebGL, which reads back just the part (or copied, `gpuVia`), the rest (10-bit HDR, as iPhones film by
 * default) while copying. Either costs a fraction of drawing the whole 4K frame to read it (~70 ms).
 */
export async function readStoredPlanes(
  sample: VideoSample,
  area: CropRect,
  rotation: Rotation,
  gpuVia: StoredPlanes['via'] = 'webgl',
): Promise<StoredPlanes | null> {
  const format = sample.format === 'NV12' || sample.format === 'I420' ? sample.format : 'RGBA';
  // coordinates within the visible part of the stored frame (decoders may pad it)
  const visible = sample.visibleRect;
  const codedW = visible.width;
  const codedH = visible.height;
  const rect = storedRect(area, rotation, codedW, codedH);
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }
  if (sample.format === null && gpuVia === 'webgl') {
    const frame = sample.toVideoFrame();
    try {
      const read = readWithWebGl(frame, rect);
      if (read) return { ...read, format, rect, codedW, codedH, rotation, via: 'webgl' };
    } finally {
      frame.close();
    }
  }
  const copyRect = { x: visible.left + rect.x, y: visible.top + rect.y, width: rect.width, height: rect.height };
  const options: VideoFrameCopyToOptions = format === 'RGBA' ? { rect: copyRect, format: 'RGBA', colorSpace: 'srgb' } : { rect: copyRect };
  try {
    const data = new Uint8Array(sample.allocationSize(options));
    const layout = await sample.copyTo(data, options);
    return { data, layout, format, rect, codedW, codedH, rotation, via: 'copy' };
  } catch (error) {
    // a browser that can't convert frames while copying them: they are drawn to a canvas instead
    if (format === 'RGBA') return null;
    throw error;
  }
}

/** One WebGL context for reading frames, made on first use; null where WebGL 2 isn't available. */
let webGl: { context: WebGL2RenderingContext; framebuffer: WebGLFramebuffer; texture: WebGLTexture } | null | undefined;

/**
 * `rect` of the stored (unturned, visible part of the) frame as RGBA, read through WebGL: the frame is put
 * into a texture on the GPU (converted and tone mapped to sRGB there) and only `rect` is read back. Null
 * when it can't be (no WebGL 2, a frame larger than a texture may be, or one already turned).
 */
export function readWithWebGl(frame: VideoFrame, rect: StoredRect): { data: Uint8Array; layout: { offset: number; stride: number }[] } | null {
  const visible = frame.visibleRect;
  // the texture is the frame at its display size: only when that is the stored size do the pixels match
  if (!visible || frame.displayWidth !== visible.width || frame.displayHeight !== visible.height) return null;
  if (webGl === undefined) {
    const context =
      typeof OffscreenCanvas === 'undefined' ? null : new OffscreenCanvas(1, 1).getContext('webgl2', { antialias: false, depth: false });
    const texture = context?.createTexture();
    const framebuffer = context?.createFramebuffer();
    webGl = context && texture && framebuffer ? { context, texture, framebuffer } : null;
  }
  if (!webGl) return null;
  const { context: gl, texture, framebuffer } = webGl;
  if (Math.max(visible.width, visible.height) > gl.getParameter(gl.MAX_TEXTURE_SIZE)) return null;
  try {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, frame);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) return null;
    // the frame's first row is the texture's first row, read back first
    const data = new Uint8Array(rect.width * rect.height * 4);
    gl.readPixels(rect.x, rect.y, rect.width, rect.height, gl.RGBA, gl.UNSIGNED_BYTE, data);
    return gl.getError() === gl.NO_ERROR ? { data, layout: [{ offset: 0, stride: rect.width * 4 }] } : null;
  } catch {
    return null;
  } finally {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
}

/** The planes' Y values in `part` (a rectangle of `planes.rect`, in stored pixels) as a grey Mat. */
function lumaOf(cv: Cv, planes: StoredPlanes, part: StoredRect): Cv {
  if (planes.format === 'RGBA') {
    return converted(cv, rgbaOf(cv, planes, part), cv.COLOR_RGBA2GRAY);
  }
  const gray = new cv.Mat(part.height, part.width, cv.CV_8UC1);
  const out = gray.data as Uint8Array;
  const { offset, stride } = planes.layout[0];
  const dx = part.x - planes.rect.x;
  const dy = part.y - planes.rect.y;
  for (let row = 0; row < part.height; row++) {
    const from = offset + (dy + row) * stride + dx;
    out.set(planes.data.subarray(from, from + part.width), row * part.width);
  }
  return gray;
}

/** RGB of `part` (an even-edged rectangle of `planes.rect`), as stored. */
function rgbOf(cv: Cv, planes: StoredPlanes, part: StoredRect): Cv {
  if (planes.format === 'RGBA') {
    return converted(cv, rgbaOf(cv, planes, part), cv.COLOR_RGBA2RGB);
  }
  // the planes packed tightly, one after the other, as OpenCV expects them
  const w = part.width;
  const h = part.height;
  const dx = part.x - planes.rect.x;
  const dy = part.y - planes.rect.y;
  const yuv = new cv.Mat(h + h / 2, w, cv.CV_8UC1);
  const out = yuv.data as Uint8Array;
  const copyPlane = (plane: number, rows: number, rowBytes: number, x0: number, y0: number, at: number) => {
    const { offset, stride } = planes.layout[plane];
    for (let row = 0; row < rows; row++) {
      const from = offset + (y0 + row) * stride + x0;
      out.set(planes.data.subarray(from, from + rowBytes), at + row * rowBytes);
    }
  };
  copyPlane(0, h, w, dx, dy, 0);
  if (planes.format === 'NV12') {
    copyPlane(1, h / 2, w, dx, dy / 2, w * h);
  } else {
    copyPlane(1, h / 2, w / 2, dx / 2, dy / 2, w * h);
    copyPlane(2, h / 2, w / 2, dx / 2, dy / 2, w * h + (w * h) / 4);
  }
  const rgb = new cv.Mat();
  try {
    cv.cvtColor(yuv, rgb, planes.format === 'NV12' ? cv.COLOR_YUV2RGB_NV12 : cv.COLOR_YUV2RGB_I420);
    return rgb;
  } finally {
    yuv.delete();
  }
}

/** RGBA pixels of `part` of RGBA planes, as stored. */
function rgbaOf(cv: Cv, planes: StoredPlanes, part: StoredRect): Cv {
  const rgba = new cv.Mat(part.height, part.width, cv.CV_8UC4);
  const out = rgba.data as Uint8Array;
  const { offset, stride } = planes.layout[0];
  const dx = part.x - planes.rect.x;
  const dy = part.y - planes.rect.y;
  for (let row = 0; row < part.height; row++) {
    const from = offset + (dy + row) * stride + 4 * dx;
    out.set(planes.data.subarray(from, from + 4 * part.width), 4 * row * part.width);
  }
  return rgba;
}

/** `source` converted with `code`; deletes `source`. */
function converted(cv: Cv, source: Cv, code: number): Cv {
  const out = new cv.Mat();
  try {
    cv.cvtColor(source, out, code);
    return out;
  } finally {
    source.delete();
  }
}

/** The stored rectangle holding `area` (frame as shown), within the copied planes. */
function partFor(planes: StoredPlanes, area: CropRect): StoredRect | null {
  const want = storedRect(area, planes.rotation, planes.codedW, planes.codedH);
  const r = planes.rect;
  const x0 = Math.max(want.x, r.x);
  const y0 = Math.max(want.y, r.y);
  const x1 = Math.min(want.x + want.width, r.x + r.width);
  const y1 = Math.min(want.y + want.height, r.y + r.height);
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } : null;
}

/**
 * The tracker's pixels from copied planes: the Y plane halved `levels` times for the alignment, and RGB
 * of any part of the copied region, as stored.
 */
export function planesPixels(cv: Cv, planes: StoredPlanes, levels: number): FramePixels {
  const toShown = storedToShown(planes.rotation, planes.codedW, planes.codedH);
  let gray = lumaOf(cv, planes, planes.rect);
  for (let k = 0; k < levels; k++) {
    const smaller = new cv.Mat();
    cv.pyrDown(gray, smaller);
    gray.delete();
    gray = smaller;
  }
  const s = 2 ** levels;
  return {
    gray,
    grayToFrame: mul3(mul3(toShown, translate(planes.rect.x, planes.rect.y)), [s, 0, 0, 0, s, 0, 0, 0, 1]),
    rgb(area) {
      const part = partFor(planes, area);
      if (!part) return null;
      return { mat: rgbOf(cv, planes, part), toFrame: mul3(toShown, translate(part.x, part.y)) };
    },
    dispose: () => release(gray),
  };
}

/**
 * `area` (in the frame as shown) as an upright RGB Mat, from the decoder's YUV data; null when the decoder
 * hands frames over in a format other than NV12 or I420, or doesn't let them be copied.
 */
export async function readStoredRegion(cv: Cv, sample: VideoSample, area: CropRect, rotation: Rotation): Promise<Cv | null> {
  const planes = await readStoredPlanes(sample, area, rotation);
  if (!planes) {
    return null;
  }
  const rgb = rgbOf(cv, planes, planes.rect);
  const turned = new cv.Mat();
  try {
    const code = { 90: cv.ROTATE_90_CLOCKWISE, 180: cv.ROTATE_180, 270: cv.ROTATE_90_COUNTERCLOCKWISE }[rotation as 90 | 180 | 270];
    const upright = code === undefined ? rgb : (cv.rotate(rgb, turned, code), turned);
    // where the copied rectangle's top-left pixel is shown
    const corners = [
      [0, 0],
      [planes.rect.width - 1, planes.rect.height - 1],
    ].map(([x, y]) => {
      const m = mul3(storedToShown(rotation, planes.codedW, planes.codedH), translate(planes.rect.x, planes.rect.y));
      return [m[0] * x + m[1] * y + m[2], m[3] * x + m[4] * y + m[5]];
    });
    const left = Math.min(corners[0][0], corners[1][0]);
    const top = Math.min(corners[0][1], corners[1][1]);
    const x = Math.round(area.left - left);
    const y = Math.round(area.top - top);
    const width = Math.min(Math.round(area.width), upright.cols - x);
    const height = Math.min(Math.round(area.height), upright.rows - y);
    const part = upright.roi(new cv.Rect(x, y, width, height));
    const copy = part.clone();
    part.delete();
    return copy;
  } finally {
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
