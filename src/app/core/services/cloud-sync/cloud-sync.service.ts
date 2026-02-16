import { Injectable, signal, computed } from '@angular/core';
import { CloudSyncSettings, CloudProvider, SyncFrequency, CloudSyncStatus } from '../../models/cloud-sync.model';
import { ExcelService } from '../excel/excel.service';
import { ToastService } from '../toast/toast.service';
import { StorageService } from '../storage/storage.service';
import { Storage } from '@ionic/storage-angular';
import { environment } from 'src/environments/environment';

const CLOUD_SYNC_STORAGE_KEY = 'cloud_sync_settings';

@Injectable({
  providedIn: 'root',
})
export class CloudSyncService {
  #settings = signal<CloudSyncSettings>({
    enabled: false,
    provider: CloudProvider.GOOGLE_DRIVE,
    frequency: SyncFrequency.WEEKLY,
  });

  #syncStatus = signal<CloudSyncStatus>({
    isAuthenticated: false,
    syncInProgress: false,
  });

  readonly settings = this.#settings.asReadonly();
  readonly syncStatus = this.#syncStatus.asReadonly();

  readonly isConfigured = computed(() => {
    const settings = this.#settings();
    return settings.enabled && settings.connectedProvider !== undefined;
  });

  constructor(
    private storage: Storage,
    private excelService: ExcelService,
    private toastService: ToastService,
    private storageService: StorageService,
  ) {
    this.init();
  }

  private async init(): Promise<void> {
    await this.storage.create();
    await this.loadSettings();
    await this.checkAndSyncOnStartup();
  }

  private async loadSettings(): Promise<void> {
    const savedSettings = await this.storage.get(CLOUD_SYNC_STORAGE_KEY);
    if (savedSettings) {
      this.#settings.set(savedSettings);
      this.#syncStatus.update((status) => ({
        ...status,
        isAuthenticated: !!savedSettings.connectedProvider,
        lastSync: savedSettings.lastSyncDate ? new Date(savedSettings.lastSyncDate) : undefined,
        nextSync: savedSettings.nextSyncDate ? new Date(savedSettings.nextSyncDate) : undefined,
      }));
    }
  }

  async updateSettings(settings: Partial<CloudSyncSettings>): Promise<void> {
    const currentSettings = this.#settings();
    const updatedSettings = { ...currentSettings, ...settings };

    // If frequency is being updated, recalculate nextSyncDate
    if (settings.frequency !== undefined) {
      const now = Date.now();
      const fromDate = currentSettings.lastSyncDate || now;
      const calculatedNextSync = this.calculateNextSyncDate(settings.frequency, fromDate);

      // If the calculated next sync is in the past, sync now
      if (calculatedNextSync < now) {
        // First update the settings with the new frequency
        this.#settings.set(updatedSettings);
        await this.storage.set(CLOUD_SYNC_STORAGE_KEY, updatedSettings);

        // Then trigger immediate sync (this will update lastSyncDate and nextSyncDate)
        try {
          await this.syncNow();
        } catch (error) {
          console.error('Automatic sync after frequency change failed:', error);
          // Even if sync fails, calculate next sync from now
          const newNextSync = this.calculateNextSyncDate(settings.frequency, now);
          updatedSettings.nextSyncDate = newNextSync;
          this.#syncStatus.update((status) => ({
            ...status,
            nextSync: new Date(newNextSync),
          }));
          this.#settings.set(updatedSettings);
          await this.storage.set(CLOUD_SYNC_STORAGE_KEY, updatedSettings);
        }
        return;
      }

      // Next sync is in the future, just update it
      updatedSettings.nextSyncDate = calculatedNextSync;
      this.#syncStatus.update((status) => ({
        ...status,
        nextSync: new Date(calculatedNextSync),
      }));
    }

    this.#settings.set(updatedSettings);
    await this.storage.set(CLOUD_SYNC_STORAGE_KEY, updatedSettings);
  }

  async authenticateWithProvider(provider: CloudProvider): Promise<void> {
    this.#syncStatus.update((status) => ({ ...status, error: undefined }));

    try {
      // Navigate browser to the OAuth backend start endpoint
      const redirectUrl = `${window.location.origin}/auth/callback?openModal=true`;
      const startUrl = `${environment.authBackendUrl}/${provider}/start?redirect=${encodeURIComponent(redirectUrl)}`;
      window.location.href = startUrl;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      this.#syncStatus.update((status) => ({ ...status, error: errorMessage }));
      this.toastService.showToast('Authentication failed', 'bug-outline', true);
      throw error;
    }
  }

  /**
   * Called by the auth-callback page after the OAuth backend redirects back
   */
  async handleAuthCallback(provider: string, status: string, error?: string): Promise<void> {
    if (status === 'success') {
      const providerEnum = provider as CloudProvider;
      const currentSettings = this.#settings();
      const now = Date.now();
      const nextSync = this.calculateNextSyncDate(currentSettings.frequency, now);

      await this.updateSettings({
        provider: providerEnum,
        connectedProvider: providerEnum,
        enabled: true,
        nextSyncDate: nextSync,
      });

      this.#syncStatus.update((s) => ({
        ...s,
        isAuthenticated: true,
        error: undefined,
        lastSync: undefined,
        nextSync: new Date(nextSync),
      }));

      this.toastService.showToast(`${this.getProviderDisplayName(providerEnum)} connected successfully!`, 'checkmark-circle');
    } else {
      const errorMessage = error || 'Authentication failed';
      this.#syncStatus.update((s) => ({ ...s, error: errorMessage }));
      this.toastService.showToast(`Authentication failed: ${errorMessage}`, 'bug-outline', true);
    }
  }

  /**
   * Fetch a fresh access token from the OAuth backend
   */
  private async getAccessToken(provider: CloudProvider): Promise<string> {
    const response = await fetch(`${environment.authBackendUrl}/${provider}/access-token`, {
      credentials: 'include',
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 404) {
        // Session expired or not connected — clear local state
        await this.updateSettings({ connectedProvider: undefined, enabled: false });
        this.#syncStatus.update((s) => ({ ...s, isAuthenticated: false }));
        throw new Error('Not authenticated. Please reconnect your cloud provider.');
      }
      throw new Error('Failed to retrieve access token');
    }

    const data = await response.json();
    return data.access_token;
  }

  async disconnect(): Promise<void> {
    const settings = this.#settings();

    if (settings.connectedProvider) {
      try {
        const response = await fetch(`${environment.authBackendUrl}/${settings.connectedProvider}/disconnect`, {
          method: 'POST',
          credentials: 'include',
        });

        if (response.ok) {
          // Clear local state
          await this.updateSettings({
            enabled: false,
            connectedProvider: undefined,
            lastSyncDate: undefined,
            nextSyncDate: undefined,
            folderId: undefined,
          });

          this.#syncStatus.update((status) => ({
            ...status,
            isAuthenticated: false,
            error: undefined,
            lastSync: undefined,
            nextSync: undefined,
          }));

          this.toastService.showToast('Cloud sync disconnected', 'checkmark-outline');
        } else {
          console.warn('Failed to revoke tokens at provider, continuing with local disconnect');
          this.toastService.showToast('Disconnecting failed, try again.', 'bug-outline', true);
        }
      } catch (error) {
        console.warn('Error calling disconnect API:', error);
      }
    }
  }

  async syncNow(): Promise<void> {
    const settings = this.#settings();

    if (this.#syncStatus().syncInProgress) return;

    if (!settings.enabled || !settings.connectedProvider) {
      throw new Error('Cloud sync is not configured');
    }

    this.#syncStatus.update((status) => ({ ...status, syncInProgress: true, error: undefined }));

    try {
      // Get a fresh access token from the backend
      const accessToken = await this.getAccessToken(settings.connectedProvider);

      // Generate Excel file
      const buffer = await this.generateExcelBuffer();

      // Upload to cloud provider
      await this.uploadToCloud(buffer, settings, accessToken);

      // Update sync status
      const now = Date.now();
      const nextSync = this.calculateNextSyncDate(settings.frequency, now);

      await this.updateSettings({
        lastSyncDate: now,
        nextSyncDate: nextSync,
      });

      this.#syncStatus.update((status) => ({
        ...status,
        syncInProgress: false,
        lastSync: new Date(now),
        nextSync: new Date(nextSync),
      }));

      this.toastService.showToast('Excel file synced to cloud successfully!', 'checkmark-outline');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sync failed';
      this.#syncStatus.update((status) => ({
        ...status,
        syncInProgress: false,
        error: errorMessage,
      }));
      this.toastService.showToast(`Sync failed. ${errorMessage}`, 'bug-outline', true);
      throw error;
    }
  }

  private async generateExcelBuffer(): Promise<ArrayBuffer> {
    return await this.excelService.generateExcelArrayBuffer();
  }

  private async uploadToCloud(buffer: ArrayBuffer, settings: CloudSyncSettings, accessToken: string): Promise<void> {
    switch (settings.connectedProvider) {
      case CloudProvider.GOOGLE_DRIVE:
        await this.uploadToGoogleDrive(buffer, accessToken);
        break;
      case CloudProvider.ONEDRIVE:
        await this.uploadToOneDrive(buffer, accessToken);
        break;
      case CloudProvider.DROPBOX:
        await this.uploadToDropbox(buffer, accessToken);
        break;
    }
  }

  private async uploadToGoogleDrive(buffer: ArrayBuffer, accessToken: string): Promise<void> {
    const date = new Date();
    const formattedDate = date.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const fileName = `game_data_${formattedDate}.xlsx`;

    // Get or create the folder
    const settings = this.#settings();
    const folderName = settings.folderPath || 'Lightningbowl Game-History';
    const folderId = await this.getOrCreateFolder(folderName, accessToken);

    // Update settings with folder ID
    if (folderId !== settings.folderId) {
      await this.updateSettings({ folderId });
    }

    // Create file metadata with parent folder
    const metadata = {
      name: fileName,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      parents: [folderId],
    };

    // Create multipart request
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([buffer], { type: metadata.mimeType }));

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: form,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to upload to Google Drive');
    }
  }

  private async getOrCreateFolder(folderName: string, accessToken: string): Promise<string> {
    // Search for existing folder
    const escapedFolderName = folderName.replace(/'/g, "\\'");
    const query = `name='${escapedFolderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const searchResponse = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!searchResponse.ok) {
      throw new Error('Failed to search for folder');
    }

    const searchData = await searchResponse.json();

    // If folder exists, return its ID
    if (searchData.files && searchData.files.length > 0) {
      return searchData.files[0].id;
    }

    // Create new folder
    const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });

    if (!createResponse.ok) {
      throw new Error('Failed to create folder');
    }

    const createData = await createResponse.json();
    return createData.id;
  }

  private async uploadToOneDrive(buffer: ArrayBuffer, accessToken: string): Promise<void> {
    const date = new Date();
    const formattedDate = date.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const settings = this.#settings();
    const folderPath = settings.folderPath || 'Lightningbowl Game-History';
    const fileName = `game_data_${formattedDate}.xlsx`;

    const encodedFolderPath = encodeURIComponent(folderPath);
    const encodedFileName = encodeURIComponent(fileName);
    const uploadUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodedFolderPath}/${encodedFileName}:/content`;

    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
      body: buffer,
    });

    if (!response.ok) {
      try {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to upload to OneDrive');
      } catch {
        throw new Error('Failed to upload to OneDrive');
      }
    }
  }

  private async uploadToDropbox(buffer: ArrayBuffer, accessToken: string): Promise<void> {
    const date = new Date();
    const formattedDate = date.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const settings = this.#settings();
    const folderPath = settings.folderPath || 'Lightningbowl Game-History';
    const fileName = `game_data_${formattedDate}.xlsx`;

    const dropboxPath = `/${folderPath}/${fileName}`;

    const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          path: dropboxPath,
          mode: 'overwrite',
          autorename: false,
          mute: false,
        }),
      },
      body: buffer,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error_summary || 'Failed to upload to Dropbox');
    }
  }

  private getProviderDisplayName(provider: CloudProvider): string {
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
  }

  private async checkAndSyncOnStartup(): Promise<void> {
    const settings = this.#settings();

    if (!settings.enabled || !settings.connectedProvider) {
      return;
    }

    const now = Date.now();
    const lastSyncDate = settings.lastSyncDate || 0;

    // Calculate if sync is needed based on frequency
    const shouldSync = this.shouldSyncNow(lastSyncDate, settings.frequency, now);

    if (!shouldSync) {
      return;
    }

    try {
      // Wait until StorageService has finished loading game history
      await this.storageService.gamesReady;
      await this.syncNow();
    } catch (error) {
      console.error('Automatic sync on startup failed:', error);
    }
  }

  private shouldSyncNow(lastSyncDate: number, frequency: SyncFrequency, currentDate: number): boolean {
    // if (lastSyncDate === 0) {
    //   return false; // Never synced before
    // }

    const timeSinceLastSync = currentDate - lastSyncDate;
    const oneDayMs = 24 * 60 * 60 * 1000;

    switch (frequency) {
      case SyncFrequency.DAILY:
        return timeSinceLastSync >= oneDayMs;
      case SyncFrequency.WEEKLY:
        return timeSinceLastSync >= 7 * oneDayMs;
      case SyncFrequency.MONTHLY:
        return timeSinceLastSync >= 30 * oneDayMs;
      default:
        return false;
    }
  }

  private calculateNextSyncDate(frequency: SyncFrequency, from: number = Date.now()): number {
    const date = new Date(from);

    switch (frequency) {
      case SyncFrequency.DAILY:
        date.setDate(date.getDate() + 1);
        break;
      case SyncFrequency.WEEKLY:
        date.setDate(date.getDate() + 7);
        break;
      case SyncFrequency.MONTHLY:
        date.setMonth(date.getMonth() + 1);
        break;
    }

    return date.getTime();
  }
}
