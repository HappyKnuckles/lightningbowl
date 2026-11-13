/**
 * Prototype: how long the ball tracker's heavy steps take on this device, to decide whether the
 * analysis could run on the phone instead of the server. Measures, on the video that would be
 * uploaded:
 *
 * - decode: the browser's (hardware) video decoder, through mediabunny;
 * - stabilize: aligning each frame to the first, as the tracker does (feature matching every 15th
 *   frame, optical flow in between, a RANSAC homography per frame);
 * - detect: warping the lane out of the frame and the background subtraction the detector runs on it.
 *
 * It mirrors the tracker's per-frame work, not its results: nothing here is compared with the
 * server's numbers. One difference: OpenCV's prebuilt WebAssembly has no SIFT, so the anchor frames
 * use ORB, which is cheaper. Anchors are one frame in 15, so stabilization comes out somewhat low.
 */
import { ShotCalibration } from 'src/app/core/models/shot-analysis.model';

export interface DeviceBenchmark {
  frames: number;
  width: number;
  height: number;
  decodeS: number;
  stabilizeS: number;
  detectS: number;
  totalS: number;
}

const ANCHOR_EVERY = 15;
const FEATURE_PX = 960;
const MAX_CORNERS = 400;
const MIN_TRACKED = 40;

// opencv.js has no types worth using here; it's a prototype
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cv = any;

/** Where the build puts OpenCV's WebAssembly build (an asset in angular.json, 10 MB: loaded only when used). */
export const OPENCV_URL = 'assets/opencv/opencv.js';

let openCv: Promise<Cv> | null = null;

/** Loads OpenCV once, with a script tag, and resolves when its WebAssembly is ready. */
export function loadOpenCv(url = OPENCV_URL): Promise<Cv> {
  openCv ??= new Promise<Cv>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.onerror = () => {
      openCv = null;
      reject(new Error(`could not load ${url}`));
    };
    script.onload = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cv: Cv = (window as any).cv;
      if (cv?.Mat) {
        resolve(cv);
      } else if (typeof cv?.then === 'function') {
        // Emscripten's module is a thenable that resolves to itself: drop `then` before handing it on,
        // or awaiting it would never end
        cv.then((ready: Cv) => {
          delete ready.then;
          resolve(ready);
        });
      } else {
        reject(new Error('OpenCV did not load'));
      }
    };
    document.head.appendChild(script);
  });
  return openCv;
}

/** The lane as the tracker crops it: the marked corners' box plus a margin, in pixels of `width` x `height`. */
function laneBox(calibration: ShotCalibration, width: number, height: number) {
  const corners = [calibration.foulLeft, calibration.foulRight, calibration.farLeft, calibration.farRight];
  const xs = corners.map(([x]) => x * width);
  const ys = corners.map(([, y]) => y * height);
  const margin = 0.08 * (Math.max(...xs) - Math.min(...xs));
  const left = Math.max(0, Math.min(...xs) - margin);
  const top = Math.max(0, Math.min(...ys) - 2 * margin);
  return {
    left,
    top,
    width: Math.round(Math.min(width, Math.max(...xs) + margin) - left),
    height: Math.round(Math.min(height, Math.max(...ys) + margin) - top),
  };
}

export async function benchmarkOnDevice(
  video: Blob,
  calibration: ShotCalibration,
  onProgress?: (frame: number) => void,
  openCvUrl = OPENCV_URL,
): Promise<DeviceBenchmark> {
  const [cv, { ALL_FORMATS, BlobSource, Input, VideoSampleSink }] = await Promise.all([loadOpenCv(openCvUrl), import('mediabunny')]);
  const input = new Input({ source: new BlobSource(video), formats: ALL_FORMATS });
  const track = await input.getPrimaryVideoTrack();
  if (!track) {
    input.dispose();
    throw new Error('no video track');
  }
  const width = track.displayWidth;
  const height = track.displayHeight;
  const scale = Math.min(1, FEATURE_PX / Math.max(width, height));
  const lane = laneBox(calibration, width, height);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  const spent = { decode: 0, stabilize: 0, detect: 0 };
  const orb = new cv.ORB(3000);
  const matcher = new cv.BFMatcher(cv.NORM_HAMMING);
  const mog2 = new cv.BackgroundSubtractorMOG2(500, 16, false);
  const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(5, 5));
  const toLane = cv.matFromArray(3, 3, cv.CV_64F, [1, 0, -lane.left, 0, 1, -lane.top, 0, 0, 1]);
  const none = new cv.Mat();
  const refKp = new cv.KeyPointVector();
  const refDes = new cv.Mat();
  let prev: Cv = null;
  let pts: Float32Array | null = null;
  let anchorPts: Float32Array | null = null;
  let anchorH: Cv = null;
  let sinceAnchor = 0;
  let frames = 0;

  const free = (...mats: Cv[]) => mats.forEach((m) => m && !m.isDeleted() && m.delete());

  /** Homography (small pixels) from `src` points onto `dst` points, or null. */
  const fit = (src: Float32Array, dst: Float32Array): Cv => {
    const a = cv.matFromArray(src.length / 2, 1, cv.CV_32FC2, src);
    const b = cv.matFromArray(dst.length / 2, 1, cv.CV_32FC2, dst);
    const h = cv.findHomography(a, b, cv.RANSAC, 2.0);
    free(a, b);
    return h.empty() ? (free(h), null) : h;
  };

  const anchor = (gray: Cv): Cv => {
    const kp = new cv.KeyPointVector();
    const des = new cv.Mat();
    orb.detectAndCompute(gray, none, kp, des);
    let h: Cv = null;
    if (refDes.rows > 0 && des.rows > 0) {
      const pairs = new cv.DMatchVectorVector();
      matcher.knnMatch(des, refDes, pairs, 2);
      const src: number[] = [];
      const dst: number[] = [];
      for (let i = 0; i < pairs.size(); i++) {
        const pair = pairs.get(i);
        if (pair.size() === 2 && pair.get(0).distance < 0.75 * pair.get(1).distance) {
          const m = pair.get(0);
          const p = kp.get(m.queryIdx).pt;
          const q = refKp.get(m.trainIdx).pt;
          src.push(p.x, p.y);
          dst.push(q.x, q.y);
        }
      }
      pairs.delete();
      if (src.length >= 24) {
        h = fit(Float32Array.from(src), Float32Array.from(dst));
      }
    }
    free(des);
    kp.delete();
    const corners = new cv.Mat();
    cv.goodFeaturesToTrack(gray, corners, MAX_CORNERS, 0.01, 8);
    if (h && corners.rows >= MIN_TRACKED) {
      pts = Float32Array.from(corners.data32F);
      anchorPts = Float32Array.from(pts);
      free(anchorH);
      anchorH = h.clone();
      sinceAnchor = 0;
    } else {
      pts = null;
    }
    free(corners);
    return h;
  };

  const flow = (gray: Cv): Cv => {
    const from = cv.matFromArray(pts!.length / 2, 1, cv.CV_32FC2, pts!);
    const to = new cv.Mat();
    const status = new cv.Mat();
    const err = new cv.Mat();
    cv.calcOpticalFlowPyrLK(prev, gray, from, to, status, err, new cv.Size(21, 21), 3);
    const cur: number[] = [];
    const anchored: number[] = [];
    for (let i = 0; i < status.rows; i++) {
      if (status.data[i] === 1) {
        cur.push(to.data32F[2 * i], to.data32F[2 * i + 1]);
        anchored.push(anchorPts![2 * i], anchorPts![2 * i + 1]);
      }
    }
    free(from, to, status, err);
    if (cur.length / 2 < MIN_TRACKED) {
      return null;
    }
    pts = Float32Array.from(cur);
    anchorPts = Float32Array.from(anchored);
    const h = fit(pts, anchorPts);
    if (!h) {
      return null;
    }
    const combined = new cv.Mat();
    cv.gemm(anchorH, h, 1, none, 0, combined);
    free(h);
    return combined;
  };

  const started = performance.now();
  try {
    const sink = new VideoSampleSink(track);
    let t = performance.now();
    for await (const sample of sink.samples()) {
      ctx.drawImage(sample.toCanvasImageSource(), 0, 0, width, height);
      sample.close();
      const frame = cv.matFromImageData(ctx.getImageData(0, 0, width, height));
      spent.decode += performance.now() - t;

      t = performance.now();
      const gray = new cv.Mat();
      cv.cvtColor(frame, gray, cv.COLOR_RGBA2GRAY);
      cv.resize(gray, gray, new cv.Size(0, 0), scale, scale, cv.INTER_AREA);
      let hSmall: Cv = null;
      if (frames === 0) {
        orb.detectAndCompute(gray, none, refKp, refDes);
        hSmall = cv.Mat.eye(3, 3, cv.CV_64F);
        anchor(gray);
      } else {
        hSmall = pts && sinceAnchor < ANCHOR_EVERY ? flow(gray) : null;
        if (hSmall) {
          sinceAnchor++;
        } else {
          hSmall = anchor(gray);
        }
      }
      free(prev);
      prev = gray;
      spent.stabilize += performance.now() - t;

      t = performance.now();
      // full-size homography: up @ hSmall @ down, then into the lane box
      const h = hSmall ?? cv.Mat.eye(3, 3, cv.CV_64F);
      const up = cv.matFromArray(3, 3, cv.CV_64F, [1 / scale, 0, 0, 0, 1 / scale, 0, 0, 0, 1]);
      const down = cv.matFromArray(3, 3, cv.CV_64F, [scale, 0, 0, 0, scale, 0, 0, 0, 1]);
      const a = new cv.Mat();
      const b = new cv.Mat();
      cv.gemm(up, h, 1, none, 0, a);
      cv.gemm(a, down, 1, none, 0, b);
      cv.gemm(toLane, b, 1, none, 0, a);
      const warped = new cv.Mat();
      cv.warpPerspective(frame, warped, a, new cv.Size(lane.width, lane.height), cv.INTER_LINEAR, cv.BORDER_REPLICATE);
      const mask = new cv.Mat();
      mog2.apply(warped, mask);
      cv.morphologyEx(mask, mask, cv.MORPH_OPEN, kernel);
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
      free(h, up, down, a, b, warped, mask, hierarchy, frame);
      contours.delete();
      spent.detect += performance.now() - t;

      frames++;
      onProgress?.(frames);
      t = performance.now();
    }
  } finally {
    input.dispose();
    free(prev, anchorH, refDes, toLane, none, kernel);
    refKp.delete();
    orb.delete();
    matcher.delete();
    mog2.delete();
  }

  const s = (ms: number) => Math.round(ms / 100) / 10;
  return {
    frames,
    width,
    height,
    decodeS: s(spent.decode),
    stabilizeS: s(spent.stabilize),
    detectS: s(spent.detect),
    totalS: s(performance.now() - started),
  };
}
