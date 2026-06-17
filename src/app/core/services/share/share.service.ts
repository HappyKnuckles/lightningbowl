import { Injectable, inject } from '@angular/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { toPng } from 'html-to-image';
import { LoadingService } from '../loader/loading.service';
import { ToastService } from '../toast/toast.service';
import { Options } from 'html-to-image/lib/types';

export interface ShareOptions {
  /** Element to capture as a PNG. */
  element: HTMLElement;
  /** Base file name without extension (`.png` is appended). */
  fileName: string;
  title?: string;
  text?: string;
  /** Override/extend the html-to-image defaults (e.g. style, pixelRatio). */
  pngOptions?: Partial<Options>;
  /** Shown after a successful Capacitor share (native share sheet handles its own UX). */
  successMessage?: string;
  /** Shown if capture/share fails. */
  errorMessage?: string;
}

@Injectable({ providedIn: 'root' })
export class ShareService {
  private loadingService = inject(LoadingService);
  private toastService = inject(ToastService);

  async share(options: ShareOptions): Promise<void> {
    const { element, fileName, title = '', text = '', pngOptions, successMessage, errorMessage } = options;

    try {
      this.loadingService.setLoading(true);

      // Let the DOM/fonts settle before capturing.
      await new Promise((r) => setTimeout(r, 100));

      const dataUrl = await toPng(element, {
        quality: 1,
        pixelRatio: 3,
        width: element.scrollWidth,
        height: element.scrollHeight,
        ...pngOptions,
      });

      if (this.canUseNavigatorShare()) {
        await this.shareViaNavigator(dataUrl, fileName, title, text);
      } else {
        await this.shareViaCapacitor(dataUrl, fileName, title, text);
        if (successMessage) {
          this.toastService.showToast(successMessage, 'share-social-outline');
        }
      }
    } catch (error) {
      console.error('Error taking screenshot and sharing', error);
      if (errorMessage) {
        this.toastService.showToast(errorMessage, 'bug', true);
      }
    } finally {
      this.loadingService.setLoading(false);
    }
  }

  private canUseNavigatorShare(): boolean {
    return !!navigator.share && navigator.canShare({ files: [new File([], '')] });
  }

  private async shareViaNavigator(dataUrl: string, fileName: string, title: string, text: string): Promise<void> {
    const blob = await (await fetch(dataUrl)).blob();
    const files = [new File([blob], `${fileName}.png`, { type: blob.type })];

    await navigator.share({ title, text, files });
  }

  private async shareViaCapacitor(dataUrl: string, fileName: string, title: string, text: string): Promise<void> {
    const base64Data = dataUrl.split(',')[1];
    const path = `${fileName}.png`;

    await Filesystem.writeFile({
      path,
      data: base64Data,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });

    const fileUri = await Filesystem.getUri({
      directory: Directory.Cache,
      path,
    });

    await Share.share({
      title,
      text,
      url: fileUri.uri,
      dialogTitle: title || 'Share',
    });
  }
}
