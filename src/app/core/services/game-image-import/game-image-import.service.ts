import { Injectable, inject } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { AlertController, isPlatform } from '@ionic/angular/standalone';
import { TOAST_MESSAGES } from 'src/app/core/constants/toast-messages.constants';
import { Game, numberArraysToFrames } from 'src/app/core/models/game.model';
import { AnalyticsService } from 'src/app/core/services/analytics/analytics.service';
import { GameDataTransformerService } from 'src/app/core/services/game-transform/game-data-transform.service';
import { GameUtilsService } from 'src/app/core/services/game-utils/game-utils.service';
import { ImageProcesserService } from 'src/app/core/services/image-processer/image-processer.service';
import { LoadingService } from 'src/app/core/services/loader/loading.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { UserService } from 'src/app/core/services/user/user.service';

const WARNING_STORAGE_KEY = 'alert';
const WARNING_TTL_DAYS = 7;

@Injectable({ providedIn: 'root' })
export class GameImageImportService {
  private alertController = inject(AlertController);
  private imageProcessingService = inject(ImageProcesserService);
  private gameUtilsService = inject(GameUtilsService);
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
      if (!(image instanceof File)) {
        this.toastService.showToast(TOAST_MESSAGES.noImage, 'bug', true);
        return null;
      }

      this.loadingService.setLoading(true);
      const gameText = await this.imageProcessingService.performOCR(image);
      await this.analyticsService.trackOCRUsed(!!gameText);

      if (!gameText) return null;
      return this.parseBowlingScores(gameText);
    } catch (error) {
      this.toastService.showToast(TOAST_MESSAGES.imageUploadError, 'bug', true);
      console.error(error);
      await this.analyticsService.trackError('ocr_error', error instanceof Error ? error.message : String(error));
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
      if (permissions.photos === 'prompt' || permissions.photos === 'denied') {
        const requested = await Camera.requestPermissions();
        if (!requested.photos) {
          await this.showPermissionDeniedAlert();
          return undefined;
        }
      }
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Prompt,
      });
      return await fetch(image.webPath!).then((r) => r.blob());
    }
    return await this.openFileInput();
  }

  private async openFileInput(): Promise<File | undefined> {
    return new Promise((resolve) => {
      try {
        const fileInput = document.getElementById('upload') as HTMLInputElement;
        fileInput.value = '';
        fileInput.onchange = () => resolve(fileInput.files?.[0]);
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
      buttons: [
        {
          text: 'OK',
          handler: async () => {
            const res = await Camera.requestPermissions();
            if (res.photos === 'granted') this.takeOrChoosePicture();
          },
        },
      ],
    });
    await alert.present();
  }

  private parseBowlingScores(input: string): Game | null {
    try {
      const { frames, frameScores, totalScore } = this.gameUtilsService.parseBowlingScores(input, this.userService.username());
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
      this.toastService.showToast(TOAST_MESSAGES.unexpectedError, 'bug', true);
      console.error(error);
      return null;
    }
  }
}
