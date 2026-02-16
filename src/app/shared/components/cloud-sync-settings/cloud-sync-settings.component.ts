import { Component, computed, inject } from '@angular/core';
import {
  IonCard,
  IonCardContent,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonButton,
  IonIcon,
  IonSpinner,
  IonToggle,
  IonInput,
  IonFooter,
  IonToolbar,
  IonCol,
  IonRow,
  IonGrid,
  IonList,
  IonListHeader,
  IonBadge,
  IonContent,
  IonButtons,
  IonHeader,
  IonTitle,
} from '@ionic/angular/standalone';
import { NgIf, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import {
  cloudUploadOutline,
  cloudDoneOutline,
  cloudOfflineOutline,
  syncOutline,
  linkOutline,
  unlinkOutline,
  folderOutline,
  calendarOutline,
} from 'ionicons/icons';
import { CloudSyncService } from 'src/app/core/services/cloud-sync/cloud-sync.service';
import { CloudProvider, SyncFrequency } from 'src/app/core/models/cloud-sync.model';
import { AlertController, ModalController } from '@ionic/angular';

@Component({
  selector: 'app-cloud-sync-settings',
  standalone: true,
  imports: [
    IonTitle,
    IonHeader,
    IonButtons,
    IonContent,
    IonBadge,
    IonListHeader,
    IonList,
    IonGrid,
    IonRow,
    IonCol,
    IonToolbar,
    IonFooter,
    NgIf,
    DatePipe,
    FormsModule,
    IonCard,
    IonCardContent,
    IonItem,
    IonLabel,
    IonSelect,
    IonSelectOption,
    IonButton,
    IonIcon,
    IonSpinner,
    IonToggle,
    IonInput,
  ],
  templateUrl: './cloud-sync-settings.component.html',
  styleUrl: './cloud-sync-settings.component.scss',
})
export class CloudSyncSettingsComponent {
  cloudSyncService = inject(CloudSyncService);
  modalCtrl = inject(ModalController);
  alertCtrl = inject(AlertController);

  readonly CloudProvider = CloudProvider;
  readonly SyncFrequency = SyncFrequency;

  selectedProvider = computed(() => this.cloudSyncService.settings().provider);
  selectedFrequency = computed(() => this.cloudSyncService.settings().frequency);
  folderPath = computed(() => this.cloudSyncService.settings().folderPath || 'Lightningbowl Game-History');

  providerDisplayName = computed(() => {
    const provider = this.selectedProvider();
    switch (provider) {
      case CloudProvider.GOOGLE_DRIVE:
        return 'Google Drive';
      case CloudProvider.ONEDRIVE:
        return 'OneDrive';
      case CloudProvider.DROPBOX:
        return 'Dropbox';
      default:
        return provider;
    }
  });

  frequencyDisplayName = computed(() => {
    const frequency = this.selectedFrequency();
    switch (frequency) {
      case SyncFrequency.DAILY:
        return 'Daily';
      case SyncFrequency.WEEKLY:
        return 'Weekly';
      case SyncFrequency.MONTHLY:
        return 'Monthly';
      default:
        return frequency;
    }
  });

  constructor() {
    addIcons({
      cloudUploadOutline,
      cloudDoneOutline,
      cloudOfflineOutline,
      syncOutline,
      linkOutline,
      unlinkOutline,
      folderOutline,
      calendarOutline,
    });
  }

  cancel(): Promise<boolean> {
    return this.modalCtrl.dismiss(null, 'cancel');
  }

  async connectProvider(): Promise<void> {
    try {
      await this.cloudSyncService.authenticateWithProvider(this.selectedProvider());
    } catch (error) {
      console.error('Failed to connect:', error);
    }
  }

  async disconnect(): Promise<void> {
    await this.alertCtrl
      .create({
        header: 'Disconnect Cloud Sync',
        message: 'Are you sure you want to disconnect from the cloud provider? This will stop all syncing and remove stored credentials.',
        buttons: [
          { text: 'Cancel', role: 'cancel' },
          {
            text: 'Disconnect',
            role: 'destructive',
            handler: async () => {
              await this.cloudSyncService.disconnect();
            },
          },
        ],
      })
      .then((alert) => alert.present());
  }

  async toggleSync(event: any): Promise<void> {
    const enabled = event.detail.checked;
    await this.cloudSyncService.updateSettings({ enabled });
  }

  async updateProvider(event: any): Promise<void> {
    const provider = event.detail.value as CloudProvider;
    await this.cloudSyncService.updateSettings({ provider });
  }

  async updateFrequency(event: any): Promise<void> {
    const frequency = event.detail.value as SyncFrequency;
    await this.cloudSyncService.updateSettings({ frequency });
  }

  async updateFolderPath(event: any): Promise<void> {
    const folderPath = event.target.value?.trim();
    if (folderPath) {
      await this.cloudSyncService.updateSettings({ folderPath });
    }
  }

  async syncNow(): Promise<void> {
    try {
      await this.cloudSyncService.syncNow();
    } catch (error) {
      console.error('Manual sync failed:', error);
    }
  }
}
