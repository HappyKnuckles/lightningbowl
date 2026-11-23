import { texture } from 'src/testing/texture';

import { applyHomography } from '../geometry/math.utils';
import { loadOpenCv } from '../video/opencv.utils';
import { matPixels, referenceToMarked } from './frame-tracker.utils';

describe('referenceToMarked', () => {
  it('finds how far the decoded reference frame lies from the frame shown for marking', async () => {
    const cv = await loadOpenCv();
    const gray = texture(cv, 320, 240, 7);
    const reference = new cv.Mat();
    cv.cvtColor(gray, reference, cv.COLOR_GRAY2RGB);
    // shown: the neighbouring frame of a phone panning, the picture 6 px right and 4 px up
    const shift = cv.matFromArray(2, 3, cv.CV_64F, [1, 0, 6, 0, 1, -4]);
    const shownMat = new cv.Mat();
    cv.warpAffine(gray, shownMat, shift, new cv.Size(320, 240), cv.INTER_LINEAR, cv.BORDER_REPLICATE);
    const region = { left: 0, top: 0, width: 320, height: 240 };
    const pixels = matPixels(cv, reference, [0, 0], 0);

    const toMarked = referenceToMarked(cv, pixels, region, Float32Array.from(shownMat.data as Uint8Array), 320, 240)!;
    const same = referenceToMarked(cv, pixels, region, Float32Array.from(gray.data as Uint8Array), 320, 240)!;

    const [x, y] = applyHomography(toMarked, 160, 120);
    expect(x - 160).toBeCloseTo(6, 1);
    expect(y - 120).toBeCloseTo(-4, 1);
    const [sx, sy] = applyHomography(same, 160, 120);
    expect(Math.hypot(sx - 160, sy - 120)).toBeLessThan(0.1);
    pixels.dispose();
    [gray, reference, shift, shownMat].forEach((mat) => mat.delete());
  });
});
