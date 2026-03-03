import { NgIf } from '@angular/common';
import { Component, ElementRef, inject, ViewChild } from '@angular/core';
import { Filesystem } from '@capacitor/filesystem';
import { AlertController } from '@ionic/angular';
import { IonIcon, IonButton, IonSpinner, IonButtons } from '@ionic/angular/standalone';
import { ToastMessages } from 'src/app/core/constants/toast-messages.constants';
import { ExcelService } from 'src/app/core/services/excel/excel.service';
import { LoadingService } from 'src/app/core/services/loader/loading.service';
import { StorageService } from 'src/app/core/services/storage/storage.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';

@Component({
  selector: 'app-file-header-buttons',
  imports: [IonButtons, IonSpinner, IonButton, IonIcon, NgIf],
  templateUrl: './file-header-buttons.component.html',
  styleUrl: './file-header-buttons.component.css',
})
export class FileHeaderButtonsComponent {
  storageService = inject(StorageService);
  loadingService = inject(LoadingService);
  excelService = inject(ExcelService);
  toastService = inject(ToastService);
  alertController = inject(AlertController);
  @ViewChild('excelUpload', { static: false }) excelUpload!: ElementRef<HTMLInputElement>;

  async handleFileUpload(): Promise<void> {
    try {
      this.loadingService.setLoading(true);
      const input = this.excelUpload.nativeElement;
      if (!input.files || input.files.length === 0) return;
      const file = input.files[0];
      const gameData = await this.excelService.readExcelData(file);
      await this.excelService.transformData(gameData);
      this.toastService.showToast(ToastMessages.excelFileUploadSuccess, 'checkmark-outline');
    } catch (error) {
      this.toastService.showToast(ToastMessages.excelFileUploadError, 'bug', true);
      console.error(error);
    } finally {
      const input = this.excelUpload.nativeElement;
      input.value = '';
      this.loadingService.setLoading(false);
    }
  }

  openExcelFileInput(): void {
    if (this.excelUpload) {
      this.excelUpload.nativeElement.click();
    }
  }

  async exportToExcel(): Promise<void> {
    try {
      const gotPermission = await this.excelService.exportToExcel();
      if (gotPermission) {
        this.toastService.showToast(ToastMessages.excelFileDownloadSuccess, 'checkmark-outline');
      } else {
        await this.showPermissionDeniedAlert();
      }
    } catch (error) {
      this.toastService.showToast(ToastMessages.excelFileDownloadError, 'bug', true);
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
