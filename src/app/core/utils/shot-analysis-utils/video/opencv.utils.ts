/**
 * OpenCV's WebAssembly build, loaded on demand. It is our own build (`scripts/opencv/build.sh`): with
 * WebAssembly SIMD and only the functions the shot analysis calls, about 20% faster per frame and half the
 * size of the npm builds. At 5.7 MB it isn't bundled: it lives in `assets/opencv/` and is loaded with a
 * script tag the first time a video is picked.
 */

// opencv.js has no types worth using here
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Cv = any;

export const OPENCV_URL = 'assets/opencv/opencv.js';

let openCv: Promise<Cv> | null = null;

/** Loads OpenCV once and resolves when its WebAssembly is ready. */
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

/** Deletes OpenCV objects that are still alive (they live in WebAssembly memory, not the JS heap). */
export function release(...objects: Cv[]): void {
  for (const o of objects) {
    if (o && !(o.isDeleted?.() ?? false)) o.delete();
  }
}
