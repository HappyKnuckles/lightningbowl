import { fitWithin, scaleImageToJpeg } from './image-scale.utils';

describe('image-scale.utils', () => {
  it('fits the long side into the limit and keeps the aspect ratio', () => {
    expect(fitWithin(4032, 3024, 512)).toEqual({ height: 384, width: 512 });
    expect(fitWithin(1080, 1920, 512)).toEqual({ height: 512, width: 288 });
  });

  it('never makes a picture larger', () => {
    expect(fitWithin(300, 200, 512)).toEqual({ height: 200, width: 300 });
  });

  it('scales a picture down to a JPEG data URL, transparency on white', async () => {
    const canvas = new OffscreenCanvas(1000, 500);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgb(200, 0, 0)';
    ctx.fillRect(0, 0, 500, 500);
    const png = await canvas.convertToBlob({ type: 'image/png' });

    const dataUrl = await scaleImageToJpeg(png, 100);

    expect(dataUrl.startsWith('data:image/jpeg;base64,')).toBe(true);
    const image = await createImageBitmap(await (await fetch(dataUrl)).blob());
    expect([image.width, image.height]).toEqual([100, 50]);
    const pixels = new OffscreenCanvas(100, 50).getContext('2d')!;
    pixels.drawImage(image, 0, 0);
    const [r, g, b] = pixels.getImageData(10, 25, 1, 1).data;
    const [wr, wg, wb] = pixels.getImageData(90, 25, 1, 1).data;
    expect(r).toBeGreaterThan(180);
    expect(g + b).toBeLessThan(40);
    expect(Math.min(wr, wg, wb)).toBeGreaterThan(240);
  });
});
