import { Injectable } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

import { scaleImageToJpeg } from 'src/app/core/utils/image-utils/image-scale.utils';

/** Takes or picks a photo of a ball for the image search. */
@Injectable({
  providedIn: 'root',
})
export class BallPhotoService {
  /** The photo, upright and scaled down, as a JPEG data URL; undefined when the user cancels. */
  async takePhoto(): Promise<string | undefined> {
    const picture = Capacitor.isNativePlatform() ? await this.fromCamera() : await this.fromFileInput();
    return picture ? scaleImageToJpeg(picture) : undefined;
  }

  /** Camera or gallery, as the user chooses; the plugin asks for permission itself. */
  private async fromCamera(): Promise<Blob | undefined> {
    try {
      const photo = await Camera.getPhoto({ source: CameraSource.Prompt, resultType: CameraResultType.Uri, width: 1024, quality: 90 });
      return photo.webPath ? await (await fetch(photo.webPath)).blob() : undefined;
    } catch (error) {
      if (/cancel/i.test((error as Error).message ?? '')) return undefined;
      throw error;
    }
  }

  /** In the browser a file input; phones offer the camera there too. */
  private fromFileInput(): Promise<File | undefined> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = () => resolve(input.files?.[0]);
      input.oncancel = () => resolve(undefined);
      input.click();
    });
  }
}
