import { ShotCalibration } from 'src/app/core/models/shot-analysis.model';

/** Longest selectable part of a video (the tracker stops after 20 s). */
export const MAX_SHOT_WINDOW_S = 18;

export interface TrimWindow {
  endS: number;
  startS: number;
}

/** Default selection for a freshly loaded video: from the start, as long as the tracker allows. */
export function defaultTrimWindow(durationS: number): TrimWindow {
  return { startS: 0, endS: Math.min(durationS, MAX_SHOT_WINDOW_S) };
}

/**
 * Applies a knob move of the dual range: values are clamped to the video and the selection to
 * {@link MAX_SHOT_WINDOW_S}, moving the knob that was not dragged along when the window gets too long.
 */
export function clampTrimWindow(next: TrimWindow, previous: TrimWindow, durationS: number): TrimWindow {
  let startS = Math.max(0, Math.min(next.startS, durationS));
  let endS = Math.max(startS, Math.min(next.endS, durationS));
  if (endS - startS > MAX_SHOT_WINDOW_S) {
    if (startS !== previous.startS) {
      endS = startS + MAX_SHOT_WINDOW_S;
    } else {
      startS = endS - MAX_SHOT_WINDOW_S;
    }
  }
  return { startS, endS };
}

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
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = MATCH_PX;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      return null;
    }
    const area = crop ?? { left: 0, top: 0, width: video.videoWidth, height: video.videoHeight };
    ctx.drawImage(video, area.left, area.top, area.width, area.height, 0, 0, MATCH_PX, MATCH_PX);
    const { data } = ctx.getImageData(0, 0, MATCH_PX, MATCH_PX);
    const grey = new Float32Array(MATCH_PX * MATCH_PX);
    for (let i = 0; i < grey.length; i++) {
      grey[i] = 0.299 * data[4 * i] + 0.587 * data[4 * i + 1] + 0.114 * data[4 * i + 2];
    }
    return grey;
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
