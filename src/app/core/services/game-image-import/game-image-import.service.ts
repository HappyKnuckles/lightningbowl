import { inject, Injectable } from '@angular/core';
import { Camera, CameraPermissionState, CameraResultType, CameraSource } from '@capacitor/camera';
import { AlertController, isPlatform } from '@ionic/angular/standalone';

import { TOAST_MESSAGES } from 'src/app/core/constants/toast-messages.constants';
import { AnalyticsService } from 'src/app/core/services/analytics/analytics.service';
import { GameDataTransformerService } from 'src/app/core/services/game-transform/game-data-transform.service';
import { ImageProcesserService } from 'src/app/core/services/image-processer/image-processer.service';
import { LoadingService } from 'src/app/core/services/loader/loading.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { UserService } from 'src/app/core/services/user/user.service';

import { Game } from '../../models/game.model';
import { numberArraysToFrames } from '../../utils/game-utils/frame.utils';
import { parseBowlingScores, ScoreSheetPlayerNotFoundError } from '../../utils/game-utils/score-input.utils';

const WARNING_STORAGE_KEY = 'alert';
const WARNING_TTL_DAYS = 7;

@Injectable({ providedIn: 'root' })
export class GameImageImportService {
  private alertController = inject(AlertController);
  private imageProcessingService = inject(ImageProcesserService);
  private transformGameService = inject(GameDataTransformerService);
  private loadingService = inject(LoadingService);
  private toastService = inject(ToastService);
  private userService = inject(UserService);
  private analyticsService = inject(AnalyticsService);

  /**
   * Full flow: shows experimental warning (if not recently dismissed),
   * captures or picks an image, runs OCR, parses the scoreboard,
   * returns a Game ready to drop into the modal. Returns null if the
   * user cancels, denies, or anything fails along the way.
   */
  async captureAndParseGame(): Promise<Game | null> {
    const warningAcknowledged = await this.ensureWarningAcknowledged();
    if (!warningAcknowledged) return null;

    try {
      const image = await this.takeOrChoosePicture();
      if (!image) {
        this.toastService.showToast(TOAST_MESSAGES.noImage, 'bug', true);
        return null;
      }

      this.loadingService.setLoading(true);
      const gameText = await this.imageProcessingService.performOCR(image);

      void this.analyticsService.trackOCRUsed(!!gameText).catch(() => undefined);

      if (!gameText) {
        this.toastService.showToast(TOAST_MESSAGES.noTextFound, 'bug', true);
        return null;
      }
      return this.parseBowlingScores(gameText);
    } catch (error) {
      const details = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      this.toastService.showToast(TOAST_MESSAGES.imageUploadError, 'bug', true);
      void this.analyticsService.trackError('ocr_error', details).catch(() => undefined);
      return null;
    } finally {
      this.loadingService.setLoading(false);
    }
  }

  private async ensureWarningAcknowledged(): Promise<boolean> {
    const stored = localStorage.getItem(WARNING_STORAGE_KEY);
    if (stored) {
      try {
        const { value, expiration } = JSON.parse(stored);
        if (value === 'true' && Date.now() < expiration) return true;
      } catch {
        // fall through and re-prompt
      }
    }

    return await this.presentWarningAlert();
  }

  private async presentWarningAlert(): Promise<boolean> {
    localStorage.removeItem(WARNING_STORAGE_KEY);

    const alert = await this.alertController.create({
      header: 'Warning!',
      subHeader: 'Experimental Feature',
      message: 'It only works in certain alleys and will probably NOT work in yours!',
      buttons: [
        { text: 'Dismiss', role: 'cancel' },
        { text: 'OK', role: 'confirm' },
      ],
    });
    await alert.present();

    const result = await alert.onDidDismiss();
    const expiration = Date.now() + WARNING_TTL_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(WARNING_STORAGE_KEY, JSON.stringify({ value: 'true', expiration }));

    return result.role === 'confirm';
  }

  private async takeOrChoosePicture(): Promise<File | Blob | undefined> {
    if ((isPlatform('android') || isPlatform('ios')) && !isPlatform('mobileweb')) {
      const permissions = await Camera.checkPermissions();
      if (!this.hasPhotoAccess(permissions.photos)) {
        const requested = await Camera.requestPermissions();
        if (!this.hasPhotoAccess(requested.photos)) {
          await this.showPermissionDeniedAlert();
          return undefined;
        }
      }
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        width: 1600,
        resultType: CameraResultType.Base64,
        source: CameraSource.Prompt,
      });
      if (!image.base64String) return undefined;
      return this.base64ToBlob(image.base64String, `image/${image.format}`);
    }
    return await this.openFileInput();
  }

  private hasPhotoAccess(state: CameraPermissionState): boolean {
    return state === 'granted' || state === 'limited';
  }

  private base64ToBlob(base64: string, mimeType: string): Blob {
    const byteChars = atob(base64);
    const byteNumbers = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteNumbers[i] = byteChars.charCodeAt(i);
    }
    return new Blob([byteNumbers], { type: mimeType });
  }

  private async openFileInput(): Promise<File | undefined> {
    return new Promise((resolve) => {
      try {
        const fileInput = document.getElementById('upload') as HTMLInputElement;
        fileInput.value = '';

        const settle = (file: File | undefined) => {
          fileInput.onchange = null;
          fileInput.oncancel = null;
          resolve(file);
        };

        fileInput.onchange = () => settle(fileInput.files?.[0]);
        fileInput.oncancel = () => settle(undefined);
        fileInput.click();
      } catch (error) {
        console.error('Upload Error:', error);
        this.toastService.showToast(TOAST_MESSAGES.unexpectedError, 'bug', true);
        resolve(undefined);
      }
    });
  }

  private async showPermissionDeniedAlert(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Permission Denied',
      message: 'To take or choose a picture, you need to grant camera access.',
      buttons: ['OK'],
    });
    await alert.present();
  }

  private parseBowlingScores(input: string): Game | null {
    try {
      const { frames, frameScores, totalScore } = parseBowlingScores(input, this.userService.username());
      const framesAsFrameArray = numberArraysToFrames(frames);

      const parsedGame: Game = {
        gameId: '',
        date: 0,
        frames: framesAsFrameArray,
        frameScores,
        totalScore,
        isPractice: true,
        isPinMode: false,
        isClean: false,
        isPerfect: false,
        patterns: [],
        balls: [],
      };

      return this.transformGameService.transformGameData(parsedGame);
    } catch (error) {
      const message = error instanceof ScoreSheetPlayerNotFoundError ? TOAST_MESSAGES.noScoresForUser : TOAST_MESSAGES.unexpectedError;
      this.toastService.showToast(message, 'bug', true);
      console.error(error);
      return null;
    }
  }
}
