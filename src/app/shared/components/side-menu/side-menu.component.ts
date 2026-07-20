import { Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { Filesystem } from '@capacitor/filesystem';
import {
  AlertController,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonMenu,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToolbar,
  MenuController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { bowlingBallOutline, cameraOutline, cloudDownloadOutline, cloudUploadOutline, personCircleOutline } from 'ionicons/icons';
import { filter } from 'rxjs/operators';
import { TOAST_MESSAGES } from 'src/app/core/constants/toast-messages.constants';
import { ExcelService } from 'src/app/core/services/excel/excel.service';
import { ImportDispatcherService } from 'src/app/core/services/import/import-dispatcher.service';
import { LoadingService } from 'src/app/core/services/loader/loading.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { GamesStore } from 'src/app/core/stores/games.store';
import { SettingsStore } from 'src/app/core/stores/settings.store';
import { GameOcrImportComponent } from '../game-ocr-import/game-ocr-import.component';
import { LeagueSelectorComponent } from '../league-selector/league-selector.component';
import { UserService } from 'src/app/core/services/user/user.service';
import { InputCustomEvent } from '@ionic/angular';

/** Pages that own their toolbar start slot and therefore get no menu. */
const MENULESS_ROUTES = ['/tabs/arsenal', '/tabs/balls'];

@Component({
  selector: 'app-side-menu',
  templateUrl: './side-menu.component.html',
  styleUrls: ['./side-menu.component.scss'],
  imports: [
    IonInput,
    IonMenu,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonIcon,
    IonLabel,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    GameOcrImportComponent,
    LeagueSelectorComponent,
  ],
})
export class SideMenuComponent {
  readonly isDisabled = signal(false);

  ballsStore = inject(BallsStore);
  settingsStore = inject(SettingsStore);

  @ViewChild(GameOcrImportComponent, { static: true }) ocrImport!: GameOcrImportComponent;
  @ViewChild('import', { static: true }) fileImport!: ElementRef<HTMLInputElement>;

  private gamesStore = inject(GamesStore);
  private loadingService = inject(LoadingService);
  private excelService = inject(ExcelService);
  private importDispatcherService = inject(ImportDispatcherService);
  private toastService = inject(ToastService);
  private alertController = inject(AlertController);
  private menuController = inject(MenuController);
  private router = inject(Router);
  userService = inject(UserService);

  constructor() {
    addIcons({ cameraOutline, cloudUploadOutline, cloudDownloadOutline, personCircleOutline, bowlingBallOutline });

    this.updateDisabledState();
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.updateDisabledState());
  }

  changeName(event: InputCustomEvent): void {
    const username = event.detail.value;
    if (username) {
      this.userService.setUsername(username);
    }
  }

  async scanScoreboard(): Promise<void> {
    await this.menuController.close();
    await this.ocrImport.open();
  }

  async openFileInput(): Promise<void> {
    await this.menuController.close();

    if (this.gamesStore.games().length === 0) {
      const importInfoAlert = await this.alertController.create({
        header: 'Info',
        message: 'You can import files from PinPal or our custom Excel file.',
        buttons: [
          {
            text: 'Continue',
            role: 'confirm',
            handler: () => {
              this.fileImport.nativeElement.click();
            },
          },
          {
            text: 'Download .XLSX template',
            role: 'cancel',
            handler: () => {
              this.exportToExcel();
            },
          },
        ],
      });
      await importInfoAlert.present();
      return;
    }

    this.fileImport.nativeElement.click();
  }

  async handleFileUpload(): Promise<void> {
    try {
      this.loadingService.setLoading(true);
      const input = this.fileImport.nativeElement;
      if (!input.files || input.files.length === 0) return;
      const file = input.files[0];
      const importResult = await this.importDispatcherService.importFromFile(file);

      if (importResult.type === 'pinpal') {
        this.toastService.showToast(`${TOAST_MESSAGES.pinpalImportSuccess} (${importResult.importedGames} games)`, 'checkmark-outline');
      } else {
        this.toastService.showToast(TOAST_MESSAGES.excelFileUploadSuccess, 'checkmark-outline');
      }
    } catch {
      this.toastService.showToast(TOAST_MESSAGES.unexpectedError, 'bug', true);
    } finally {
      const input = this.fileImport.nativeElement;
      input.value = '';
      this.loadingService.setLoading(false);
    }
  }

  async exportToExcel(): Promise<void> {
    await this.menuController.close();

    try {
      const gotPermission = await this.excelService.exportToExcel();
      if (gotPermission) {
        this.toastService.showToast(TOAST_MESSAGES.excelFileDownloadSuccess, 'checkmark-outline');
      } else {
        await this.showPermissionDeniedAlert();
      }
    } catch (error) {
      this.toastService.showToast(TOAST_MESSAGES.excelFileDownloadError, 'bug', true);
      console.error('Error exporting to Excel:', error);
    }
  }

  savePinInputMode(pinMode: string): void {
    this.settingsStore.savePinInputMode(pinMode);
  }

  private updateDisabledState(): void {
    const path = this.router.url.split('?')[0];
    this.isDisabled.set(MENULESS_ROUTES.includes(path));
  }

  private async showPermissionDeniedAlert(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Permission Denied',
      message: 'To save to Gamedata.xlsx, you need to give permissions!',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Try again',
          handler: async () => {
            const permissionRequestResult = await Filesystem.requestPermissions();
            if (permissionRequestResult.publicStorage === 'granted') {
              this.exportToExcel();
            }
          },
        },
      ],
    });
    await alert.present();
  }
}
