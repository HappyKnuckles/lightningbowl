import { inject, Injectable, LOCALE_ID } from '@angular/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { toPng } from 'html-to-image';
import { TOAST_MESSAGES } from 'src/app/core/constants/toast-messages.constants';
import { Ball } from 'src/app/core/models/ball.model';
import { Game } from 'src/app/core/models/game.model';
import { buildBallShareMessage, buildGameShareMessage } from 'src/app/core/utils/share-utils/share-message.utils';

import { LoadingService } from '../loader/loading.service';
import { ToastService } from '../toast/toast.service';

export interface ShareContent {
  /** Shared as a PNG screenshot along with the text; if it can't be rendered, the text goes alone. */
  element?: HTMLElement;
  /** Name of the screenshot file, without extension. */
  fileName: string;
  title: string;
  text: string;
}

/** Marks an element (e.g. buttons) to leave out of the screenshot: `<div data-share-exclude>`. */
export const SHARE_EXCLUDE_ATTRIBUTE = 'data-share-exclude';

/** Stands in for an image that can't be embedded (no CORS headers), so the rest still renders. */
const TRANSPARENT_PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

/** Shares any part of the app: a screenshot of an element plus a text, through the system share sheet. */
@Injectable({ providedIn: 'root' })
export class ShareService {
  private locale = inject(LOCALE_ID);

  constructor(
    private loadingService: LoadingService,
    private toastService: ToastService,
  ) {}

  shareGame(game: Game, scoreTemplate: HTMLElement): Promise<void> {
    return this.share({
      element: scoreTemplate,
      fileName: `score_${game.gameId}`,
      title: 'Game Score',
      text: buildGameShareMessage(game, this.locale),
    });
  }

  /** `owned`: the ball is from the arsenal, so its weight and layout are shared too. */
  shareBall(ball: Ball, element?: HTMLElement, owned = false): Promise<void> {
    return this.share({
      element,
      fileName: `ball_${ball.ball_id}`,
      title: ball.ball_name,
      text: buildBallShareMessage(ball, owned),
    });
  }

  async share({ element, fileName, title, text }: ShareContent): Promise<void> {
    try {
      this.loadingService.setLoading(true);
      const dataUrl = element ? await this.renderImage(element) : undefined;

      if (this.canUseNavigatorShare(!!dataUrl)) {
        await this.shareViaNavigator(title, text, dataUrl, fileName);
      } else {
        await this.shareViaCapacitor(title, text, dataUrl, fileName);
        this.toastService.showToast(TOAST_MESSAGES.shareSuccess, 'share-social-outline');
      }
    } catch (error) {
      if (this.isCancelled(error)) return;
      console.error('Error sharing', error);
      this.toastService.showToast(TOAST_MESSAGES.shareError, 'bug', true);
    } finally {
      this.loadingService.setLoading(false);
    }
  }

  /** A PNG data URL of the element, or undefined if it can't be rendered. */
  protected async renderImage(element: HTMLElement): Promise<string | undefined> {
    // give an element that was just opened (e.g. an accordion) a moment to lay out
    await new Promise((r) => setTimeout(r, 100));
    try {
      return await toPng(element, {
        quality: 1,
        pixelRatio: 3,
        width: element.scrollWidth,
        height: element.scrollHeight,
        // transform: a swiped list item is still shifted aside while its options close
        style: { margin: '0', overflow: 'visible', transform: 'none' },
        imagePlaceholder: TRANSPARENT_PIXEL,
        filter: (node) => !(node instanceof HTMLElement && node.hasAttribute(SHARE_EXCLUDE_ATTRIBUTE)),
      });
    } catch (error) {
      console.error('Error rendering the share image, sharing the text only', error);
      return undefined;
    }
  }

  private canUseNavigatorShare(withFile: boolean): boolean {
    if (!navigator.share) return false;
    return !withFile || (!!navigator.canShare && navigator.canShare({ files: [new File([], 'probe.png', { type: 'image/png' })] }));
  }

  private async shareViaNavigator(title: string, text: string, dataUrl: string | undefined, fileName: string): Promise<void> {
    if (!dataUrl) {
      await navigator.share({ title, text });
      return;
    }
    const blob = await (await fetch(dataUrl)).blob();
    await navigator.share({ title, text, files: [new File([blob], `${fileName}.png`, { type: blob.type })] });
  }

  private async shareViaCapacitor(title: string, text: string, dataUrl: string | undefined, fileName: string): Promise<void> {
    let url: string | undefined;
    if (dataUrl) {
      const path = `${fileName}.png`;
      // without an encoding, Filesystem takes the data as base64 and writes the binary PNG
      await Filesystem.writeFile({ path, data: dataUrl.split(',')[1], directory: Directory.Cache });
      url = (await Filesystem.getUri({ path, directory: Directory.Cache })).uri;
    }
    await Share.share({ title, text, url, dialogTitle: `Share ${title}` });
  }

  /** The user closed the share sheet: nothing went wrong. */
  private isCancelled(error: unknown): boolean {
    const name = (error as { name?: string })?.name;
    const message = (error as { message?: string })?.message ?? '';
    return name === 'AbortError' || /cancel/i.test(message);
  }
}
