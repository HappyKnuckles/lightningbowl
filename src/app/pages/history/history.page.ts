import { DatePipe, NgIf } from '@angular/common';
import { Component, ViewChild } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Filesystem } from '@capacitor/filesystem';
import { ImpactStyle } from '@capacitor/haptics';
import { ModalController, RefresherCustomEvent } from '@ionic/angular';
import {
  AlertController,
  IonAccordionGroup,
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { createOutline, documentTextOutline, filterOutline, medalOutline, shareOutline, swapVertical, trashOutline } from 'ionicons/icons';
import { GAME_FILTER_CONFIGS } from 'src/app/core/configs/filter/game-filter.config';
import { TOAST_MESSAGES } from 'src/app/core/constants/toast-messages.constants';
import { AnalyticsService } from 'src/app/core/services/analytics/analytics.service';
import { ExcelService } from 'src/app/core/services/excel/excel.service';
import { GameFilterService } from 'src/app/core/services/game-filter/game-filter.service';
import { HapticService } from 'src/app/core/services/haptic/haptic.service';
import { LoadingService } from 'src/app/core/services/loader/loading.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { AppFacade } from 'src/app/core/stores/app.facade';
import { GamesStore } from 'src/app/core/stores/games.store';
import { FileHeaderButtonsComponent } from 'src/app/shared/components/file-header-buttons/file-header-buttons.component';
import { GameFilterComponent } from 'src/app/shared/components/game-filter/game-filter.component';
import { GameComponent } from 'src/app/shared/components/game/game.component';
import { GenericFilterActiveComponent } from 'src/app/shared/components/generic-filter-active/generic-filter-active.component';

@Component({
  selector: 'app-history',
  templateUrl: 'history.page.html',
  styleUrls: ['history.page.scss'],
  providers: [DatePipe, ModalController],
  imports: [
    IonRefresherContent,
    IonButtons,
    IonHeader,
    IonToolbar,
    IonButton,
    IonIcon,
    IonTitle,
    IonBadge,
    IonContent,
    IonRefresher,
    NgIf,
    IonText,
    ReactiveFormsModule,
    ReactiveFormsModule,
    FormsModule,
    GameComponent,
    GenericFilterActiveComponent,
    FileHeaderButtonsComponent,
  ],
})
export class HistoryPage {
  @ViewChild('accordionGroup') accordionGroup!: IonAccordionGroup;
  @ViewChild(IonContent, { static: false }) content!: IonContent;

  gameFilterConfigs = GAME_FILTER_CONFIGS;

  get currentFilters(): Record<string, unknown> {
    return this.gameFilterService.filters() as unknown as Record<string, unknown>;
  }

  get defaultFilters(): Record<string, unknown> {
    return this.gameFilterService.defaultFilters as unknown as Record<string, unknown>;
  }

  // currentSortOption: GameSortOption = {
  //   field: GameSortField.DATE,
  //   direction: SortDirection.DESC,
  //   label: 'Date (Newest First)'
  // };

  // get displayedGames() {
  //   return this.sortService.sortGames(this.gameFilterService.filteredGames(), this.currentSortOption);
  // }

  constructor(
    private alertController: AlertController,
    private toastService: ToastService,
    public gamesStore: GamesStore,
    private appFacade: AppFacade,
    public loadingService: LoadingService,
    private hapticService: HapticService,
    private modalCtrl: ModalController,
    public gameFilterService: GameFilterService,
    private excelService: ExcelService,
    private analyticsService: AnalyticsService,
    // public sortService: SortService,
  ) {
    addIcons({
      filterOutline,
      trashOutline,
      createOutline,
      shareOutline,
      documentTextOutline,
      medalOutline,
      swapVertical,
    });
  }

  //  onSortChanged(sortOption: any): void {
  //     this.currentSortOption = sortOption as GameSortOption;
  //     if (this.content) {
  //       setTimeout(() => {
  //         this.content.scrollToTop(300);
  //       }, 100);
  //     }
  //   }

  async openFilterModal() {
    const modal = await this.modalCtrl.create({
      component: GameFilterComponent,
    });

    return await modal.present();
  }

  async handleRefresh(event: RefresherCustomEvent): Promise<void> {
    try {
      this.hapticService.vibrate(ImpactStyle.Medium);
      await this.gamesStore.loadGameHistory();
    } catch (error) {
      console.error(error);
      this.toastService.showToast(TOAST_MESSAGES.gameLoadError, 'bug', true);
    } finally {
      event.target.complete();
    }
  }

  async handleFileUpload(event: Event): Promise<void> {
    try {
      this.loadingService.setLoading(true);
      const input = event.target as HTMLInputElement;
      if (!input.files || input.files.length === 0) return;
      const file = input.files[0];
      const gameData = await this.excelService.readExcelData(file);
      await this.excelService.transformData(gameData);
      this.toastService.showToast(TOAST_MESSAGES.excelFileUploadSuccess, 'checkmark-outline');
    } catch (error) {
      this.toastService.showToast(TOAST_MESSAGES.excelFileUploadError, 'bug', true);
      console.error(error);
    } finally {
      const input = event.target as HTMLInputElement;
      input.value = '';
      this.loadingService.setLoading(false);
    }
  }

  openExcelFileInput(): void {
    const fileInput = document.getElementById('excelUpload');
    if (fileInput) {
      fileInput.click();
    }
  }

  async exportToExcel(): Promise<void> {
    try {
      const gotPermission = await this.excelService.exportToExcel();
      if (gotPermission) {
        this.toastService.showToast(TOAST_MESSAGES.excelFileDownloadSuccess, 'checkmark-outline');
        await this.analyticsService.trackExport('excel');
      } else {
        await this.showPermissionDeniedAlert();
      }
    } catch (error) {
      this.toastService.showToast(TOAST_MESSAGES.excelFileDownloadError, 'bug', true);
      console.error('Error exporting to Excel:', error);
      await this.analyticsService.trackError('excel_export_error', error instanceof Error ? error.message : String(error));
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
              await this.exportToExcel();
            }
          },
        },
      ],
    });
    await alert.present();
  }

  async deleteAll(): Promise<void> {
    await this.appFacade.deleteAllData();
    window.dispatchEvent(new Event('dataDeleted'));
  }
}
