import { collectImages, cornerRadius, drawImagesOnto, objectFitBox } from './share-image.utils';

describe('objectFitBox', () => {
  const box = { x: 10, y: 20, width: 100, height: 50 };

  it('contains a square image centered in a wide box', () => {
    expect(objectFitBox(box, 200, 200, 'contain')).toEqual({ x: 35, y: 20, width: 50, height: 50 });
  });

  it('covers the box, cropping the overflow', () => {
    expect(objectFitBox(box, 200, 200, 'cover')).toEqual({ x: 10, y: -5, width: 100, height: 100 });
  });

  it('stretches with fill', () => {
    expect(objectFitBox(box, 200, 200, 'fill')).toEqual(box);
  });
});

describe('cornerRadius', () => {
  it('reads pixels and percentages', () => {
    expect(cornerRadius('8px', 40, 40)).toBe(8);
    expect(cornerRadius('50%', 40, 60)).toBe(20);
    expect(cornerRadius('0px', 40, 40)).toBe(0);
  });
});

describe('collectImages', () => {
  it('finds images inside shadow roots', () => {
    const root = document.createElement('div');
    root.appendChild(document.createElement('img'));
    const host = root.appendChild(document.createElement('div'));
    host.attachShadow({ mode: 'open' }).appendChild(document.createElement('img'));

    expect(collectImages(root)).toHaveLength(2);
  });
});

describe('drawImagesOnto', () => {
  // 1×1 red PNG
  const RED = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
  let root: HTMLElement;

  beforeEach(async () => {
    root = document.createElement('div');
    root.style.cssText = 'position: fixed; left: 0; top: 0; width: 40px; height: 20px;';
    const img = document.createElement('img');
    img.style.cssText = 'position: absolute; left: 20px; top: 0; width: 20px; height: 20px;';
    img.src = RED;
    root.appendChild(img);
    document.body.appendChild(root);
    await img.decode();
  });

  afterEach(() => root.remove());

  const pixel = (canvas: HTMLCanvasElement, x: number, y: number) => Array.from(canvas.getContext('2d')!.getImageData(x, y, 1, 1).data);

  it('draws each image where it is on screen, scaled by the pixel ratio', async () => {
    const canvas = Object.assign(document.createElement('canvas'), { width: 80, height: 40 });
    await drawImagesOnto(canvas, root, 2, 'data-share-exclude');

    expect(pixel(canvas, 60, 20)).toEqual([255, 0, 0, 255]);
    expect(pixel(canvas, 10, 20)).toEqual([0, 0, 0, 0]);
  });

  it('skips images in excluded parts', async () => {
    root.setAttribute('data-share-exclude', '');
    const canvas = Object.assign(document.createElement('canvas'), { width: 80, height: 40 });
    await drawImagesOnto(canvas, root, 2, 'data-share-exclude');

    expect(pixel(canvas, 60, 20)).toEqual([0, 0, 0, 0]);
  });
});
