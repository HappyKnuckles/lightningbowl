/** Long side of photos sent to the ball image search; the model looks at 224 px, so more only costs upload time. */
export const PHOTO_SEARCH_MAX_PX = 512;

/** Width and height that fit `width` x `height` into `maxSide` on the long side, keeping the aspect ratio; never larger. */
export function fitWithin(width: number, height: number, maxSide: number): { height: number; width: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { height: Math.max(1, Math.round(height * scale)), width: Math.max(1, Math.round(width * scale)) };
}

/** The picture upright (EXIF) and at most `maxSide` px on its long side, as a JPEG data URL. */
export async function scaleImageToJpeg(image: Blob, maxSide = PHOTO_SEARCH_MAX_PX, quality = 0.85): Promise<string> {
  const bitmap = await createImageBitmap(image, { imageOrientation: 'from-image' });
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, maxSide);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    // transparency would turn black in a JPEG; the catalog's cut-outs sit on white
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    bitmap.close();
  }
}
