import { Component, ElementRef, inject, ViewChild } from '@angular/core';
import { Filesystem } from '@capacitor/filesystem';
import { AlertController } from '@ionic/angular';
import { IonButton, IonButtons, IonIcon, IonSpinner } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { cloudDownloadOutline, cloudUploadOutline } from 'ionicons/icons';
import { TOAST_MESSAGES } from 'src/app/core/constants/toast-messages.constants';
import { ExcelService } from 'src/app/core/services/excel/excel.service';
import { ImportDispatcherService } from 'src/app/core/services/import/import-dispatcher.service';
import { LoadingService } from 'src/app/core/services/loader/loading.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { GamesStore } from 'src/app/core/stores/games.store';

@Component({
  selector: 'app-file-header-buttons',
  imports: [IonButtons, IonSpinner, IonButton, IonIcon],
  templateUrl: './file-header-buttons.component.html',
  styleUrl: './file-header-buttons.component.css',
})
export class FileHeaderButtonsComponent {
  gamesStore = inject(GamesStore);
  ballsStore = inject(BallsStore);
  loadingService = inject(LoadingService);
  excelService = inject(ExcelService);
  importDispatcherService = inject(ImportDispatcherService);
  toastService = inject(ToastService);
  alertController = inject(AlertController);
  @ViewChild('import', { static: false }) fileImport!: ElementRef<HTMLInputElement>;

  constructor() {
    addIcons({ cloudUploadOutline, cloudDownloadOutline });
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

  async openFileInput(): Promise<void> {
    if (!this.fileImport) {
      return;
    }

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

  async exportToExcel(): Promise<void> {
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
