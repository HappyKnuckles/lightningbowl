import { NormalizedPoint, ShotCalibration } from 'src/app/core/models/shot-analysis.model';

/**
 * Longest selectable part of a video. The ball tracker analyses the first 20 s of a file (its
 * `MAX_VIDEO_SECONDS`), and a cut can run up to a key frame interval longer on each side (see
 * {@link trimVideo}), so this leaves room for that.
 */
export const MAX_SHOT_WINDOW_S = 18;

/** Closer than this to the start/end of the video counts as not trimmed. */
const EDGE_TOLERANCE_S = 0.05;

export interface TrimWindow {
  endS: number;
  startS: number;
}

export interface TrimmedVideo {
  blob: Blob;
  /** Where the cut file starts in the original video, in seconds (the key frame at or before the window start). */
  offsetS: number;
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

/** Whether the window leaves out a noticeable part of the video, i.e. cutting it is worth it. */
export function isTrimmed(window: TrimWindow, durationS: number): boolean {
  return window.startS > EDGE_TOLERANCE_S || window.endS < durationS - EDGE_TOLERANCE_S;
}

/**
 * Copies the part of the video covering `window` into a new MP4 without re-encoding, so the cut is
 * lossless, keeps the frame rate and takes well under a second. Encoded video can only start on a key
 * frame, so the cut begins at the key frame at or before `startS` (phones place one every 1–2 s) and
 * `offsetS` says where that is; it runs to the end of the group of pictures containing `endS`.
 * Audio is dropped, the tracker doesn't use it.
 *
 * Returns null when the video can't be cut (unsupported container or codec, no key frames); the
 * caller then sends the original file with the window instead.
 */
export async function trimVideo(file: Blob, window: TrimWindow): Promise<TrimmedVideo | null> {
  // loaded on demand: only this page needs it
  const { ALL_FORMATS, BlobSource, BufferTarget, EncodedPacketSink, EncodedVideoPacketSource, Input, Mp4OutputFormat, Output } = await import(
    'mediabunny'
  );

  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryVideoTrack();
    const codec = track?.codec;
    const decoderConfig = track ? await track.getDecoderConfig() : null;
    if (!track || !codec || !decoderConfig) {
      return null;
    }

    const sink = new EncodedPacketSink(track);
    const startKey = (await sink.getKeyPacket(window.startS, { verifyKeyPackets: true })) ?? (await sink.getFirstKeyPacket());
    if (!startKey) {
      return null;
    }
    const offsetS = Math.max(0, startKey.timestamp);

    const target = new BufferTarget();
    const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target });
    const source = new EncodedVideoPacketSource(codec);
    output.addVideoTrack(source, { rotation: track.rotation });
    await output.start();

    let first = true;
    for await (const packet of sink.packets(startKey)) {
      // the next group of pictures starting after the window: everything the window needs is copied
      if (!first && packet.type === 'key' && packet.timestamp > window.endS) {
        break;
      }
      // leading frames of an open GOP reference the group before the cut and can't be decoded
      if (packet.timestamp < offsetS) {
        continue;
      }
      await source.add(packet.clone({ timestamp: packet.timestamp - offsetS }), first ? { decoderConfig } : undefined);
      first = false;
    }
    if (first) {
      await output.cancel();
      return null;
    }
    await output.finalize();

    return target.buffer ? { blob: new Blob([target.buffer], { type: 'video/mp4' }), offsetS } : null;
  } catch (error) {
    console.warn('Could not trim video, sending the original:', error);
    return null;
  } finally {
    input.dispose();
  }
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
/** A crop has to leave out at least this share of the frame to be worth re-encoding the video for. */
const MIN_CROP_SAVING = 0.4;

const evenFloor = (value: number) => Math.floor(value / 2) * 2;

/**
 * The part of the frame the tracker needs: the marked lane (foul line to the pins) plus
 * {@link LANE_CROP_MARGIN}, in display pixels with even sizes (video encoders need them). Null when
 * that is most of the frame anyway.
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

/** The calibration for a video cropped to `crop` out of a `frame`-sized video. */
export function cropCalibration(calibration: ShotCalibration, crop: CropRect, frame: { height: number; width: number }): ShotCalibration {
  const toCrop = ([x, y]: NormalizedPoint): NormalizedPoint => [
    (x * frame.width - crop.left) / crop.width,
    (y * frame.height - crop.top) / crop.height,
  ];
  return {
    ...calibration,
    foulLeft: toCrop(calibration.foulLeft),
    foulRight: toCrop(calibration.foulRight),
    farLeft: toCrop(calibration.farLeft),
    farRight: toCrop(calibration.farRight),
  };
}

/** Side of the grey thumbnails compared to check a crop. */
const MATCH_PX = 32;
/** Correlation the cropped video's first frame needs with the same part of the original. */
const MIN_FRAME_MATCH = 0.7;

/**
 * Re-encodes the part of the video covering `window`, cropped to `crop` (see {@link laneCropRect}),
 * with the phone's video encoder. The tracker only works on the lane, so it then decodes a fraction of
 * the pixels, and far less has to be uploaded. The lane keeps its full resolution: at the far end a
 * board is only a few pixels wide. The rotation is applied to the frames, and the cut starts exactly
 * at `window.startS` (that is `offsetS`). Audio is dropped.
 *
 * The crop and the lane corners are in the frame as the browser shows it. Browsers don't all hand the
 * decoder's frames over the same way (one may rotate them already, and they'd be rotated twice), so
 * the cropped video's first frame is compared with that part of the original as shown; when it doesn't
 * match, the crop is tried once more with the rotation undone, and otherwise given up.
 *
 * Returns null when the browser can't decode the video, encode the result or show both for the check;
 * the caller then falls back to {@link trimVideo} or the original file. `rotations` (extra rotations to
 * try, in order) is for tests.
 */
export async function cropVideo(file: Blob, window: TrimWindow, crop: CropRect, rotations?: Rotation[]): Promise<TrimmedVideo | null> {
  const { ALL_FORMATS, BlobSource, BufferTarget, Conversion, getFirstEncodableVideoCodec, Input, Mp4OutputFormat, Output, Quality } = await import(
    'mediabunny'
  );
  const open = () => new Input({ source: new BlobSource(file), formats: ALL_FORMATS });

  const convert = async (rotate: Rotation): Promise<Blob | null> => {
    const input = open();
    try {
      const quality = new Quality('very-high');
      const codec = await getFirstEncodableVideoCodec(['avc', 'hevc', 'vp9'], { width: crop.width, height: crop.height, quality });
      if (!codec) {
        return null;
      }
      const target = new BufferTarget();
      const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target });
      const conversion = await Conversion.init({
        input,
        output,
        tracks: 'primary',
        audio: { discard: true },
        // rotation baked into the frames: the crop and the calibration are in display pixels
        video: { crop, codec, quality, rotate, allowTransformationMetadata: false },
        trim: { start: window.startS, end: window.endS },
      });
      if (!conversion.isValid) {
        return null;
      }
      await conversion.execute();
      return target.buffer ? new Blob([target.buffer], { type: 'video/mp4' }) : null;
    } finally {
      input.dispose();
    }
  };

  try {
    if (!rotations) {
      const input = open();
      const track = await input.getPrimaryVideoTrack();
      input.dispose();
      const turned = track?.rotation ?? 0;
      rotations = turned ? [0, ((360 - turned) % 360) as Rotation] : [0];
    }
    const expected = await shownFrame(file, window.startS, crop);
    if (!expected) {
      return null;
    }
    for (const rotate of rotations) {
      const blob = await convert(rotate);
      const first = blob ? await shownFrame(blob, 0) : null;
      if (blob && first && frameSimilarity(expected, first) >= MIN_FRAME_MATCH) {
        return { blob, offsetS: window.startS };
      }
    }
    console.warn('Cropped video did not show the lane where it was marked, sending it uncropped.');
    return null;
  } catch (error) {
    console.warn('Could not crop video, sending it uncropped:', error);
    return null;
  }
}

type Rotation = 0 | 90 | 180 | 270;

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
async function shownFrame(source: Blob, timeS: number, crop?: CropRect): Promise<Float32Array | null> {
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
function frameSimilarity(a: Float32Array, b: Float32Array): number {
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
