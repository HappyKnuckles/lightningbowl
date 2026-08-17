import { computed, Injectable, signal } from '@angular/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { CloudProvider, CloudSyncSettings, CloudSyncStatus, SyncFrequency } from '../../models/cloud-sync.model';
import { AppFacade } from '../../stores/app.facade';
import { ExcelService } from '../excel/excel.service';
import { StorageRepository } from '../storage/storage.repository';
import { ToastService } from '../toast/toast.service';
import { CloudAuthRequiredError, CloudSyncApiService, NATIVE_AUTH_CALLBACK_URL } from './cloud-sync-api.service';

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

  constructor(
    private storageRepository: StorageRepository,
    private appFacade: AppFacade,
    private excelService: ExcelService,
    private toastService: ToastService,
    private cloudSyncApiService: CloudSyncApiService,
  ) {}

  public async init(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      this.listenForNativeAuthCallback();
    }

    await this.appFacade.init();
    await this.loadSettings();
    // Fire-and-forget: startup sync runs in the background and should not
    // block other operations like handling the OAuth callback redirect.
    void this.checkAndSyncOnStartup();
  }

  /**
   * The in-app browser used for OAuth on native platforms is a separate
   * browsing context, so the backend can't redirect straight back into the
   * app's own WebView like it does on web — it redirects to a custom URL
   * scheme instead, which the OS hands to the app as an `appUrlOpen` event.
   *
   * Unlike the web flow (a full page reload that has to reconstruct UI state
   * from query params, including reopening the sync modal), the native app
   * never navigates away: authenticateWithProvider can only be triggered from
   * the sync modal on the settings page, and that modal is still open
   * underneath the in-app browser the whole time. So we just close the
   * browser and update auth state directly — the modal picks it up reactively
   * through the syncStatus/settings signals, no navigation needed.
   */
  private listenForNativeAuthCallback(): void {
    void App.addListener('appUrlOpen', ({ url }) => {
      if (!url.startsWith(NATIVE_AUTH_CALLBACK_URL)) return;

      void Browser.close().catch(() => undefined);

      const { searchParams } = new URL(url);
      const provider = searchParams.get('provider');
      const status = searchParams.get('status');
      const error = searchParams.get('error');

      if (provider && status) {
        void this.handleAuthCallback(provider, status, error || undefined).catch((err) => {
          console.error('Auth callback handling failed:', err);
        });
      }
    });
  }

  private async loadSettings(): Promise<void> {
    const savedSettings = await this.storageRepository.get<CloudSyncSettings>(CLOUD_SYNC_STORAGE_KEY);
    if (savedSettings) {
      if (savedSettings.lastSyncDate && !savedSettings.lastSyncProvider) {
        savedSettings.lastSyncProvider = savedSettings.connectedProvider ?? savedSettings.provider;
      }

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
      const fromDate = updatedSettings.lastSyncDate || now;
      const calculatedNextSync = this.calculateNextSyncDate(settings.frequency, fromDate);

      // If the calculated next sync is in the past, sync now
      if (calculatedNextSync < now) {
        // First update the settings with the new frequency
        this.#settings.set(updatedSettings);
        await this.storageRepository.set(CLOUD_SYNC_STORAGE_KEY, updatedSettings);

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
          await this.storageRepository.set(CLOUD_SYNC_STORAGE_KEY, updatedSettings);
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
    await this.storageRepository.set(CLOUD_SYNC_STORAGE_KEY, updatedSettings);
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
   * Called after the OAuth backend redirects to settings with callback query params
   */
  async handleAuthCallback(provider: string, status: string, error?: string): Promise<void> {
    if (status === 'success') {
      const providerEnum = provider as CloudProvider;
      const currentSettings = this.#settings();
      // Reconnecting to the provider the saved lastSyncDate belongs to
      // (e.g. after the session went stale) keeps the sync history;
      // connecting to a different provider starts fresh.
      const isReconnect = currentSettings.lastSyncDate !== undefined && currentSettings.lastSyncProvider === providerEnum;

      await this.updateSettings({
        provider: providerEnum,
        connectedProvider: providerEnum,
        enabled: true,
        frequency: isReconnect ? currentSettings.frequency : SyncFrequency.WEEKLY,
        ...(isReconnect ? {} : { lastSyncDate: undefined, lastSyncProvider: undefined }),
      });

      // updateSettings recalculated nextSyncDate (and may have synced
      // immediately if the reconnect was overdue), so read the result back.
      const updatedSettings = this.#settings();
      this.#syncStatus.update((s) => ({
        ...s,
        isAuthenticated: true,
        error: undefined,
        lastSync: updatedSettings.lastSyncDate ? new Date(updatedSettings.lastSyncDate) : undefined,
        nextSync: updatedSettings.nextSyncDate ? new Date(updatedSettings.nextSyncDate) : undefined,
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
      // Only a definitive auth rejection clears local state; transient
      // failures keep the connection so the next sync can retry.
      if (error instanceof CloudAuthRequiredError) {
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
          lastSyncProvider: undefined,
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
        lastSyncProvider: settings.connectedProvider,
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
    const lastSyncDate = settings.lastSyncDate;

    // First sync: do not sync immediately after connection.
    // Sync only once the initially scheduled nextSyncDate is due.
    const shouldSync = lastSyncDate
      ? this.shouldSyncNow(lastSyncDate, settings.frequency, now)
      : settings.nextSyncDate !== undefined && settings.nextSyncDate <= now;

    if (!shouldSync) {
      // No sync due — still ping the backend so its sliding session cookie
      // is renewed on every app start and revoked connections are detected
      // early instead of at the next scheduled sync.
      void this.keepSessionAlive(settings.connectedProvider);
      return;
    }

    try {
      await this.appFacade.init();
      await this.syncNow();
    } catch (error) {
      console.error('Automatic sync on startup failed:', error);
    }
  }

  private async keepSessionAlive(provider: CloudProvider): Promise<void> {
    try {
      await this.getAccessToken(provider);
    } catch (error) {
      // Auth rejections already cleared local state in getAccessToken;
      // transient failures are ignored — the next sync will retry.
      if (error instanceof CloudAuthRequiredError) {
        this.toastService.showToast('Cloud sync connection expired. Please reconnect.', 'bug-outline', true);
      }
    }
  }

  private shouldSyncNow(lastSyncDate: number, frequency: SyncFrequency, currentDate: number): boolean {
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
