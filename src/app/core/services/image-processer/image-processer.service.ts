import { Injectable } from '@angular/core';

import { environment } from 'src/environments/environment';

const MAX_OCR_IMAGE_DIMENSION = 1600;
const OCR_JPEG_QUALITY = 0.9;
/** Without this a stalled response leaves the full-screen loading backdrop up forever. */
const OCR_REQUEST_TIMEOUT_MS = 45000;

@Injectable({
  providedIn: 'root',
})
export class ImageProcesserService {
  async performOCR(image: Blob): Promise<string> {
    const base64Image = await this.toDownscaledBase64(image);

    if (!base64Image) {
      throw new Error('Failed to convert image to base64.');
    }

    const response = await fetch(environment.ocrEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: base64Image }),
      signal: AbortSignal.timeout(OCR_REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`OCR request failed (${response.status} ${response.statusText}) ${body}`.trim());
    }

    return await response.text();
  }

  /** Scales the image down to fit MAX_OCR_IMAGE_DIMENSION (never up) and returns raw base64, no data-URI prefix. */
  private async toDownscaledBase64(image: Blob): Promise<string> {
    const bitmap = await createImageBitmap(image);

    try {
      const scale = Math.min(1, MAX_OCR_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);

      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Failed to read the image file.');
      }

      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', OCR_JPEG_QUALITY).split(',')[1];
    } finally {
      bitmap.close();
    }
  }
}
