import { Injectable, signal, computed } from '@angular/core';
import { CloudSyncSettings, CloudProvider, SyncFrequency, CloudSyncStatus } from '../../models/cloud-sync.model';
import { ExcelService } from '../excel/excel.service';
import { ToastService } from '../toast/toast.service';
import { StorageService } from '../storage/storage.service';
import { CloudSyncApiService } from './cloud-sync-api.service';

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
    disconnectInProgress: false,
  });

  readonly settings = this.#settings.asReadonly();
  readonly syncStatus = this.#syncStatus.asReadonly();

  readonly isConfigured = computed(() => {
    const settings = this.#settings();
    return settings.enabled && settings.connectedProvider !== undefined;
  });

  private readonly _initialized: Promise<void>;

  constructor(
    private storageService: StorageService,
    private excelService: ExcelService,
    private toastService: ToastService,
    private cloudSyncApiService: CloudSyncApiService,
  ) {
    this._initialized = this.init();
  }

  private async init(): Promise<void> {
    await this.loadSettings();
    await this.checkAndSyncOnStartup();
  }

  private async loadSettings(): Promise<void> {
    const savedSettings = await this.storageService.get<CloudSyncSettings>(CLOUD_SYNC_STORAGE_KEY);
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
        await this.storageService.set(CLOUD_SYNC_STORAGE_KEY, updatedSettings);

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
          await this.storageService.set(CLOUD_SYNC_STORAGE_KEY, updatedSettings);
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
    await this.storageService.set(CLOUD_SYNC_STORAGE_KEY, updatedSettings);
  }

  async authenticateWithProvider(provider: CloudProvider): Promise<void> {
    this.#syncStatus.update((status) => ({ ...status, error: undefined }));

    try {
      this.cloudSyncApiService.authenticateWithProvider(provider);
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
    await this._initialized;

    if (status === 'success') {
      const providerEnum = provider as CloudProvider;
      const now = Date.now();
      const nextSync = this.calculateNextSyncDate(SyncFrequency.WEEKLY, now);

      await this.updateSettings({
        provider: providerEnum,
        connectedProvider: providerEnum,
        enabled: true,
        frequency: SyncFrequency.WEEKLY,
        nextSyncDate: nextSync,
      });

      this.#syncStatus.update((s) => ({
        ...s,
        isAuthenticated: true,
        error: undefined,
        lastSync: undefined,
        nextSync: new Date(nextSync),
      }));

      this.toastService.showToast(`${this.cloudSyncApiService.getProviderDisplayName(providerEnum)} connected successfully!`, 'checkmark-circle');
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
    try {
      return await this.cloudSyncApiService.getAccessToken(provider);
    } catch (error) {
      // If not authenticated, clear local state
      if (error instanceof Error && error.message.includes('Not authenticated')) {
        await this.updateSettings({ connectedProvider: undefined, enabled: false });
        this.#syncStatus.update((s) => ({ ...s, isAuthenticated: false }));
      }
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.#syncStatus().disconnectInProgress) return;

    const settings = this.#settings();

    if (settings.connectedProvider) {
      this.#syncStatus.update((status) => ({ ...status, disconnectInProgress: true }));
      try {
        await this.cloudSyncApiService.disconnect(settings.connectedProvider);

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
          disconnectInProgress: false,
          error: undefined,
          lastSync: undefined,
          nextSync: undefined,
        }));

        this.toastService.showToast('Cloud sync disconnected', 'checkmark-outline');
      } catch (error) {
        console.warn('Error calling disconnect API:', error);
        this.#syncStatus.update((status) => ({ ...status, disconnectInProgress: false }));
        this.toastService.showToast('Disconnecting failed, try again.', 'bug-outline', true);
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
      const buffer = await this.excelService.generateExcelArrayBuffer();

      // Upload to cloud provider
      if (!settings.connectedProvider) {
        throw new Error('No provider connected');
      }

      const folderId = await this.cloudSyncApiService.uploadFile(buffer, settings.connectedProvider, accessToken, settings);

      // Update folder ID if returned (Google Drive only)
      if (folderId && folderId !== settings.folderId) {
        await this.updateSettings({ folderId });
      }

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
    if (lastSyncDate === 0) {
      return false; // Never synced before — first sync is scheduled, not immediate
    }

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
