import type { Cv } from 'src/app/core/utils/shot-analysis-utils/video/opencv.utils';

/** A grey picture full of edges and corners: random blocks of random shades. */
export function texture(cv: Cv, width: number, height: number, seed = 1): Cv {
  let state = seed;
  const random = () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648;
  const mat = new cv.Mat(height, width, cv.CV_8UC1, new cv.Scalar(90));
  for (let i = 0; i < 400; i++) {
    const [x, y] = [Math.floor(random() * width), Math.floor(random() * height)];
    const [w, h] = [4 + Math.floor(random() * 24), 4 + Math.floor(random() * 18)];
    cv.rectangle(mat, new cv.Point(x, y), new cv.Point(x + w, y + h), new cv.Scalar(Math.floor(random() * 255)), -1);
  }
  return mat;
}
