import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { CloudProvider, CloudSyncSettings, SyncFrequency } from 'src/app/core/models/cloud-sync.model';
import { AppFacade } from 'src/app/core/stores/app.facade';
import { createSpyObj, SpyObj } from 'src/testing/spy-obj';

import { ExcelService } from '../excel/excel.service';
import { StorageRepository } from '../storage/storage.repository';
import { ToastService } from '../toast/toast.service';
import { CloudAuthRequiredError, CloudSyncApiService } from './cloud-sync-api.service';
import { CloudSyncService } from './cloud-sync.service';

const STORAGE_KEY = 'cloud_sync_settings';
const ONE_DAY = 24 * 60 * 60 * 1000;

function settings(overrides: Partial<CloudSyncSettings> = {}): CloudSyncSettings {
  return { enabled: true, provider: CloudProvider.GOOGLE_DRIVE, frequency: SyncFrequency.WEEKLY, ...overrides };
}

/** Settings of a live connection to Google Drive. */
function connected(overrides: Partial<CloudSyncSettings> = {}): CloudSyncSettings {
  return settings({ connectedProvider: CloudProvider.GOOGLE_DRIVE, ...overrides });
}

describe('CloudSyncService', () => {
  let service: CloudSyncService;
  let storageRepository: SpyObj<StorageRepository>;
  let appFacade: SpyObj<AppFacade>;
  let excelService: SpyObj<ExcelService>;
  let toastService: SpyObj<ToastService>;
  let api: SpyObj<CloudSyncApiService>;

  /** Settings written to storage by the last persisted change. */
  function storedSettings(): CloudSyncSettings {
    const calls = storageRepository.set.mock.calls;
    return calls[calls.length - 1][1] as CloudSyncSettings;
  }

  beforeEach(() => {
    storageRepository = createSpyObj<StorageRepository>(['get', 'set']);
    storageRepository.get.mockResolvedValue(null);
    storageRepository.set.mockResolvedValue(undefined);

    appFacade = createSpyObj<AppFacade>(['init']);
    appFacade.init.mockResolvedValue(undefined);

    excelService = createSpyObj<ExcelService>(['generateExcelArrayBuffer']);
    excelService.generateExcelArrayBuffer.mockResolvedValue(new ArrayBuffer(8));

    toastService = createSpyObj<ToastService>(['showToast']);

    api = createSpyObj<CloudSyncApiService>(['authenticateWithProvider', 'getAccessToken', 'disconnect', 'uploadFile', 'getProviderDisplayName']);
    api.getAccessToken.mockResolvedValue('token');
    api.uploadFile.mockResolvedValue(undefined);
    api.disconnect.mockResolvedValue(undefined);
    api.getProviderDisplayName.mockReturnValue('Google Drive');

    TestBed.configureTestingModule({
      providers: [
        { provide: StorageRepository, useValue: storageRepository },
        { provide: AppFacade, useValue: appFacade },
        { provide: ExcelService, useValue: excelService },
        { provide: ToastService, useValue: toastService },
        { provide: CloudSyncApiService, useValue: api },
      ],
    });
    service = TestBed.inject(CloudSyncService);
  });

  describe('init', () => {
    it('starts the app and restores saved settings', async () => {
      const saved = connected({ lastSyncDate: Date.now(), lastSyncProvider: CloudProvider.GOOGLE_DRIVE, nextSyncDate: Date.now() + ONE_DAY });
      storageRepository.get.mockResolvedValue(saved);

      await service.init();

      expect(appFacade.init).toHaveBeenCalled();
      expect(service.settings().connectedProvider).toBe(CloudProvider.GOOGLE_DRIVE);
      expect(service.syncStatus().isAuthenticated).toBe(true);
      expect(service.syncStatus().lastSync).toBeInstanceOf(Date);
      expect(service.syncStatus().nextSync).toBeInstanceOf(Date);
    });

    it('keeps the defaults when nothing was saved', async () => {
      await service.init();

      expect(service.settings().enabled).toBe(false);
      expect(service.syncStatus().isAuthenticated).toBe(false);
    });

    it('attributes an old sync date to the connected provider', async () => {
      storageRepository.get.mockResolvedValue(connected({ lastSyncDate: Date.now() }));

      await service.init();

      expect(service.settings().lastSyncProvider).toBe(CloudProvider.GOOGLE_DRIVE);
    });

    it('syncs on startup when the schedule is overdue', async () => {
      storageRepository.get.mockResolvedValue(connected({ lastSyncDate: Date.now() - 8 * ONE_DAY }));

      await service.init();
      await vi.waitFor(() => expect(api.uploadFile).toHaveBeenCalled());
    });

    it('only renews the session when no sync is due', async () => {
      storageRepository.get.mockResolvedValue(connected({ lastSyncDate: Date.now() - ONE_DAY }));

      await service.init();
      await vi.waitFor(() => expect(api.getAccessToken).toHaveBeenCalled());

      expect(api.uploadFile).not.toHaveBeenCalled();
    });

    it('waits for the first scheduled sync after connecting', async () => {
      storageRepository.get.mockResolvedValue(connected({ nextSyncDate: Date.now() + ONE_DAY }));

      await service.init();

      expect(api.uploadFile).not.toHaveBeenCalled();
    });

    it('asks the user to reconnect when the session expired in the background', async () => {
      storageRepository.get.mockResolvedValue(connected({ lastSyncDate: Date.now() - ONE_DAY }));
      api.getAccessToken.mockRejectedValue(new CloudAuthRequiredError());

      await service.init();
      await vi.waitFor(() =>
        expect(toastService.showToast).toHaveBeenCalledWith('Cloud sync connection expired. Please reconnect.', 'bug-outline', true),
      );

      expect(service.syncStatus().isAuthenticated).toBe(false);
    });

    it('does nothing on startup without a connection', async () => {
      storageRepository.get.mockResolvedValue(settings({ enabled: false }));

      await service.init();

      expect(api.getAccessToken).not.toHaveBeenCalled();
    });
  });

  describe('isConfigured', () => {
    it('is true only when sync is enabled and a provider is connected', async () => {
      expect(service.isConfigured()).toBe(false);

      await service.updateSettings(connected());

      expect(service.isConfigured()).toBe(true);
    });
  });

  describe('updateSettings', () => {
    it('merges and persists the change', async () => {
      await service.updateSettings({ folderPath: 'My Bowling' });

      expect(service.settings().folderPath).toBe('My Bowling');
      expect(storageRepository.set).toHaveBeenCalledWith(STORAGE_KEY, expect.objectContaining({ folderPath: 'My Bowling' }));
    });

    it('reschedules the next sync when the frequency changes', async () => {
      await service.updateSettings({ lastSyncDate: Date.now() });

      await service.updateSettings({ frequency: SyncFrequency.DAILY });

      const nextSync = service.settings().nextSyncDate!;
      expect(nextSync).toBeGreaterThan(Date.now());
      expect(service.syncStatus().nextSync).toBeInstanceOf(Date);
    });

    it('syncs straight away when the new frequency is already overdue', async () => {
      await service.updateSettings(connected({ lastSyncDate: Date.now() - 8 * ONE_DAY }));

      await service.updateSettings({ frequency: SyncFrequency.DAILY });

      expect(api.uploadFile).toHaveBeenCalled();
      expect(service.settings().lastSyncDate).toBeGreaterThan(Date.now() - 1000);
    });

    it('still reschedules when that immediate sync fails', async () => {
      await service.updateSettings(connected({ lastSyncDate: Date.now() - 8 * ONE_DAY }));
      api.uploadFile.mockRejectedValue(new Error('upload failed'));

      await service.updateSettings({ frequency: SyncFrequency.DAILY });

      expect(service.settings().nextSyncDate).toBeGreaterThan(Date.now());
      expect(storedSettings().nextSyncDate).toBe(service.settings().nextSyncDate);
    });
  });

  describe('authenticateWithProvider', () => {
    it('hands the flow to the api service', async () => {
      await service.authenticateWithProvider(CloudProvider.DROPBOX);

      expect(api.authenticateWithProvider).toHaveBeenCalledWith(CloudProvider.DROPBOX);
      expect(service.syncStatus().error).toBeUndefined();
    });

    it('surfaces a failure to start the flow', async () => {
      api.authenticateWithProvider.mockImplementation(() => {
        throw new Error('popup blocked');
      });

      await expect(service.authenticateWithProvider(CloudProvider.DROPBOX)).rejects.toThrow('popup blocked');
      expect(service.syncStatus().error).toBe('popup blocked');
      expect(toastService.showToast).toHaveBeenCalledWith('Authentication failed', 'bug-outline', true);
    });
  });

  describe('handleAuthCallback', () => {
    it('connects the provider and confirms it', async () => {
      await service.handleAuthCallback(CloudProvider.GOOGLE_DRIVE, 'success');

      expect(service.settings()).toMatchObject({
        enabled: true,
        provider: CloudProvider.GOOGLE_DRIVE,
        connectedProvider: CloudProvider.GOOGLE_DRIVE,
        frequency: SyncFrequency.WEEKLY,
      });
      expect(service.syncStatus().isAuthenticated).toBe(true);
      expect(toastService.showToast).toHaveBeenCalledWith('Google Drive connected successfully!', 'checkmark-circle');
    });

    it('keeps the history when reconnecting the same provider', async () => {
      const lastSyncDate = Date.now() - ONE_DAY;
      await service.updateSettings(
        connected({ lastSyncDate, lastSyncProvider: CloudProvider.GOOGLE_DRIVE, frequency: SyncFrequency.MONTHLY, connectedProvider: undefined }),
      );

      await service.handleAuthCallback(CloudProvider.GOOGLE_DRIVE, 'success');

      expect(service.settings().lastSyncDate).toBe(lastSyncDate);
      expect(service.settings().frequency).toBe(SyncFrequency.MONTHLY);
    });

    it('starts fresh when connecting a different provider', async () => {
      await service.updateSettings(
        settings({ lastSyncDate: Date.now() - ONE_DAY, lastSyncProvider: CloudProvider.GOOGLE_DRIVE, frequency: SyncFrequency.MONTHLY }),
      );

      await service.handleAuthCallback(CloudProvider.DROPBOX, 'success');

      expect(service.settings().lastSyncDate).toBeUndefined();
      expect(service.settings().frequency).toBe(SyncFrequency.WEEKLY);
    });

    it('reports a failed authentication', async () => {
      await service.handleAuthCallback(CloudProvider.GOOGLE_DRIVE, 'error', 'access_denied');

      expect(service.syncStatus().error).toBe('access_denied');
      expect(service.syncStatus().isAuthenticated).toBe(false);
      expect(toastService.showToast).toHaveBeenCalledWith('Authentication failed: access_denied', 'bug-outline', true);
    });
  });

  describe('syncNow', () => {
    beforeEach(async () => {
      await service.updateSettings(connected());
      storageRepository.set.mockClear();
    });

    it('uploads a generated workbook and records the sync', async () => {
      const buffer = new ArrayBuffer(16);
      excelService.generateExcelArrayBuffer.mockResolvedValue(buffer);

      await service.syncNow();

      expect(api.uploadFile).toHaveBeenCalledWith(buffer, CloudProvider.GOOGLE_DRIVE, 'token', expect.any(Object));
      expect(service.settings().lastSyncProvider).toBe(CloudProvider.GOOGLE_DRIVE);
      expect(service.syncStatus().syncInProgress).toBe(false);
      expect(service.syncStatus().lastSync).toBeInstanceOf(Date);
      expect(toastService.showToast).toHaveBeenCalledWith('Excel file synced to cloud successfully!', 'checkmark-outline');
    });

    it('remembers a newly created Drive folder', async () => {
      api.uploadFile.mockResolvedValue('folder-1');

      await service.syncNow();

      expect(service.settings().folderId).toBe('folder-1');
    });

    it('schedules the next sync from the current frequency', async () => {
      await service.syncNow();

      const { lastSyncDate, nextSyncDate } = service.settings();
      expect(nextSyncDate! - lastSyncDate!).toBeCloseTo(7 * ONE_DAY, -3);
    });

    it('refuses to sync without a connection', async () => {
      await service.updateSettings({ enabled: false, connectedProvider: undefined });

      await expect(service.syncNow()).rejects.toThrow('Cloud sync is not configured');
    });

    it('reports a failed upload and keeps the connection', async () => {
      api.uploadFile.mockRejectedValue(new Error('upload failed'));

      await expect(service.syncNow()).rejects.toThrow('upload failed');
      expect(service.syncStatus().error).toBe('upload failed');
      expect(service.syncStatus().syncInProgress).toBe(false);
      expect(service.settings().connectedProvider).toBe(CloudProvider.GOOGLE_DRIVE);
      expect(toastService.showToast).toHaveBeenCalledWith('Sync failed. upload failed', 'bug-outline', true);
    });

    it('drops the connection when the backend rejects the session', async () => {
      api.getAccessToken.mockRejectedValue(new CloudAuthRequiredError());

      await expect(service.syncNow()).rejects.toBeInstanceOf(CloudAuthRequiredError);
      expect(service.settings().connectedProvider).toBeUndefined();
      expect(service.settings().enabled).toBe(false);
      expect(service.syncStatus().isAuthenticated).toBe(false);
    });

    it('keeps the connection when the backend is only temporarily down', async () => {
      api.getAccessToken.mockRejectedValue(new Error('Sync service is temporarily unavailable. Please try again later.'));

      await expect(service.syncNow()).rejects.toThrow(/temporarily unavailable/);
      expect(service.settings().connectedProvider).toBe(CloudProvider.GOOGLE_DRIVE);
    });
  });

  describe('disconnect', () => {
    beforeEach(async () => {
      await service.updateSettings(connected({ lastSyncDate: Date.now(), folderId: 'folder-1' }));
    });

    it('revokes the tokens and clears the local connection', async () => {
      await service.disconnect();

      expect(api.disconnect).toHaveBeenCalledWith(CloudProvider.GOOGLE_DRIVE);
      expect(service.settings()).toMatchObject({ enabled: false, connectedProvider: undefined, folderId: undefined });
      expect(service.settings().lastSyncDate).toBeUndefined();
      expect(service.syncStatus()).toMatchObject({ isAuthenticated: false, disconnectInProgress: false });
      expect(toastService.showToast).toHaveBeenCalledWith('Cloud sync disconnected', 'checkmark-outline');
    });

    it('keeps the connection when revoking fails', async () => {
      api.disconnect.mockRejectedValue(new Error('backend down'));

      await service.disconnect();

      expect(service.settings().connectedProvider).toBe(CloudProvider.GOOGLE_DRIVE);
      expect(service.syncStatus().disconnectInProgress).toBe(false);
      expect(toastService.showToast).toHaveBeenCalledWith('Disconnecting failed, try again.', 'bug-outline', true);
    });

    it('does nothing when no provider is connected', async () => {
      await service.updateSettings({ connectedProvider: undefined });

      await service.disconnect();

      expect(api.disconnect).not.toHaveBeenCalled();
    });
  });
});
