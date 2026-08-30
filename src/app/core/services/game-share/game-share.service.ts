import { formatDate } from '@angular/common';
import { inject, Injectable, LOCALE_ID, Renderer2, RendererFactory2 } from '@angular/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { toPng } from 'html-to-image';
import { TOAST_MESSAGES } from 'src/app/core/constants/toast-messages.constants';
import { Game } from 'src/app/core/models/game.model';
import { BallsStore } from 'src/app/core/stores/balls.store';

import { getGameBallNames } from '../../utils/game-utils/ball.utils';
import { LoadingService } from '../loader/loading.service';
import { ToastService } from '../toast/toast.service';

@Injectable({ providedIn: 'root' })
export class GameShareService {
  private renderer: Renderer2;
  private locale = inject(LOCALE_ID);
  private ballsStore = inject(BallsStore);

  constructor(
    rendererFactory: RendererFactory2,
    private loadingService: LoadingService,
    private toastService: ToastService,
  ) {
    this.renderer = rendererFactory.createRenderer(null, null);
  }

  async shareGame(game: Game, scoreTemplate: HTMLElement): Promise<void> {
    try {
      this.loadingService.setLoading(true);

      await new Promise((r) => setTimeout(r, 100));

      const message = this.buildShareMessage(game);
      const dataUrl = await toPng(scoreTemplate, {
        quality: 1,
        pixelRatio: 3,
        width: scoreTemplate.scrollWidth,
        height: scoreTemplate.scrollHeight,
        style: {
          margin: '0',
          overflow: 'visible',
        },
      });
      if (this.canUseNavigatorShare()) {
        await this.shareViaNavigator(dataUrl, game.gameId, message);
      } else {
        await this.shareViaCapacitor(dataUrl, game.gameId, message);
        this.toastService.showToast(TOAST_MESSAGES.screenshotShareSuccess, 'share-social-outline');
      }
    } catch (error) {
      console.error('Error taking screenshot and sharing', error);
      this.toastService.showToast(TOAST_MESSAGES.screenshotShareError, 'bug', true);
    } finally {
      this.loadingService.setLoading(false);
    }
  }

  private buildShareMessage(game: Game): string {
    const formattedDate = formatDate(game.date, 'dd.MM.yy', this.locale);

    const parts = [
      game.totalScore === 300
        ? `Look at me bitches, perfect game on ${formattedDate}! 🎳🎉.`
        : `Check out this game from ${formattedDate}. A ${game.totalScore}.`,
      this.formatBallsPart(getGameBallNames(game, this.ballsStore.arsenal())),
      game.patterns?.length ? `Patterns: ${game.patterns.join(', ')}` : null,
    ];

    return parts.filter((p): p is string => p !== null).join('\n');
  }

  private formatBallsPart(balls?: string[]): string | null {
    if (!balls?.length) return null;
    return balls.length === 1 ? `Bowled with: ${balls[0]}` : `Bowled with: ${balls.join(', ')}`;
  }

  private canUseNavigatorShare(): boolean {
    return !!navigator.share && navigator.canShare({ files: [new File([], '')] });
  }

  private async shareViaNavigator(dataUrl: string, gameId: string, message: string): Promise<void> {
    const blob = await (await fetch(dataUrl)).blob();
    const files = [new File([blob], `score_${gameId}.png`, { type: blob.type })];

    await navigator.share({
      title: 'Game Score',
      text: message,
      files,
    });
  }

  private async shareViaCapacitor(dataUrl: string, gameId: string, message: string): Promise<void> {
    const base64Data = dataUrl.split(',')[1];
    const fileName = `score_${gameId}.png`;

    await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });

    const fileUri = await Filesystem.getUri({
      directory: Directory.Cache,
      path: fileName,
    });

    await Share.share({
      title: 'Game Score',
      text: message,
      url: fileUri.uri,
      dialogTitle: 'Share Game Score',
    });
  }
}
