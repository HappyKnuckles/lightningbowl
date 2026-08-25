import { TestBed } from '@angular/core/testing';
import { MockInstance, vi } from 'vitest';

import { CloudProvider, CloudSyncSettings, SyncFrequency } from 'src/app/core/models/cloud-sync.model';
import { environment } from 'src/environments/environment';

import { CloudAuthRequiredError, CloudSyncApiService } from './cloud-sync-api.service';

/** Minimal fetch Response stand-in — only the members the service reads. */
function response(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: () => Promise.resolve(body) } as Response;
}

function settings(overrides: Partial<CloudSyncSettings> = {}): CloudSyncSettings {
  return { enabled: true, provider: CloudProvider.GOOGLE_DRIVE, frequency: SyncFrequency.WEEKLY, ...overrides };
}

describe('CloudSyncApiService', () => {
  let service: CloudSyncApiService;
  let fetchSpy: MockInstance<typeof window.fetch>;

  /** URL of the nth fetch call. */
  function calledUrl(index = 0): string {
    return String(fetchSpy.mock.calls[index][0]);
  }

  /** Init object of the nth fetch call. */
  function calledInit(index = 0): RequestInit {
    return (fetchSpy.mock.calls[index][1] ?? {}) as RequestInit;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CloudSyncApiService);
    fetchSpy = vi.spyOn(window, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAccessToken', () => {
    it('asks the backend for a token and sends the session cookie', async () => {
      fetchSpy.mockResolvedValue(response({ access_token: 'token-123' }));

      await expect(service.getAccessToken(CloudProvider.DROPBOX)).resolves.toBe('token-123');
      expect(calledUrl()).toBe(`${environment.authBackendUrl}/dropbox/access-token`);
      expect(calledInit().credentials).toBe('include');
    });

    it('demands a reconnect when the session is gone', async () => {
      for (const status of [401, 404]) {
        fetchSpy.mockResolvedValue(response({}, false, status));

        await expect(service.getAccessToken(CloudProvider.GOOGLE_DRIVE)).rejects.toBeInstanceOf(CloudAuthRequiredError);
      }
    });

    it('keeps the connection when the backend is only temporarily down', async () => {
      fetchSpy.mockResolvedValue(response({}, false, 503));

      const pending = service.getAccessToken(CloudProvider.GOOGLE_DRIVE);

      await expect(pending).rejects.toThrow(/temporarily unavailable/);
      await expect(pending).rejects.not.toBeInstanceOf(CloudAuthRequiredError);
    });

    it('explains an unreachable backend', async () => {
      fetchSpy.mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(service.getAccessToken(CloudProvider.GOOGLE_DRIVE)).rejects.toThrow(/check your connection/);
    });
  });

  describe('disconnect', () => {
    it('posts to the disconnect endpoint', async () => {
      fetchSpy.mockResolvedValue(response({}));

      await service.disconnect(CloudProvider.ONEDRIVE);

      expect(calledUrl()).toBe(`${environment.authBackendUrl}/onedrive/disconnect`);
      expect(calledInit().method).toBe('POST');
    });

    it('fails when the backend refuses', async () => {
      fetchSpy.mockResolvedValue(response({}, false, 500));

      await expect(service.disconnect(CloudProvider.ONEDRIVE)).rejects.toThrow('Failed to disconnect from provider');
    });
  });

  describe('uploadFile', () => {
    const buffer = new ArrayBuffer(8);

    it('routes Google Drive uploads and returns the folder id', async () => {
      fetchSpy.mockResolvedValueOnce(response({ files: [{ id: 'folder-1' }] })).mockResolvedValueOnce(response({ id: 'file-1' }));

      const folderId = await service.uploadFile(buffer, CloudProvider.GOOGLE_DRIVE, 'token', settings());

      expect(folderId).toBe('folder-1');
      expect(calledUrl(1)).toContain('googleapis.com/upload/drive/v3/files');
    });

    it('routes OneDrive uploads without a folder id', async () => {
      fetchSpy.mockResolvedValue(response({}));

      await expect(service.uploadFile(buffer, CloudProvider.ONEDRIVE, 'token', settings())).resolves.toBeUndefined();
      expect(calledUrl()).toContain('graph.microsoft.com');
    });

    it('routes Dropbox uploads without a folder id', async () => {
      fetchSpy.mockResolvedValue(response({}));

      await expect(service.uploadFile(buffer, CloudProvider.DROPBOX, 'token', settings())).resolves.toBeUndefined();
      expect(calledUrl()).toContain('dropboxapi.com');
    });

    it('refuses an unknown provider', async () => {
      await expect(service.uploadFile(buffer, 'icloud' as CloudProvider, 'token', settings())).rejects.toThrow(/Unsupported provider/);
    });
  });

  describe('uploadToGoogleDrive', () => {
    const buffer = new ArrayBuffer(8);

    it('uploads a dated workbook into the configured folder', async () => {
      fetchSpy.mockResolvedValueOnce(response({ files: [{ id: 'folder-1' }] })).mockResolvedValueOnce(response({ id: 'file-1' }));

      await service.uploadToGoogleDrive(buffer, 'token', settings({ folderPath: 'My Bowling' }));

      expect(decodeURIComponent(calledUrl(0))).toContain("name='My Bowling'");
      const headers = calledInit(1).headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer token');
      expect(calledInit(1).body).toBeInstanceOf(FormData);
    });

    it('reports the reason Drive gave for refusing the upload', async () => {
      fetchSpy
        .mockResolvedValueOnce(response({ files: [{ id: 'folder-1' }] }))
        .mockResolvedValueOnce(response({ error: { message: 'Storage quota exceeded' } }, false, 403));

      await expect(service.uploadToGoogleDrive(buffer, 'token', settings())).rejects.toThrow('Storage quota exceeded');
    });
  });

  describe('getOrCreateFolder', () => {
    it('reuses an existing folder', async () => {
      fetchSpy.mockResolvedValue(response({ files: [{ id: 'folder-1' }] }));

      await expect(service.getOrCreateFolder('Lightningbowl Game-History', 'token')).resolves.toBe('folder-1');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('creates the folder when none exists', async () => {
      fetchSpy.mockResolvedValueOnce(response({ files: [] })).mockResolvedValueOnce(response({ id: 'new-folder' }));

      await expect(service.getOrCreateFolder('Lightningbowl Game-History', 'token')).resolves.toBe('new-folder');
      expect(calledInit(1).method).toBe('POST');
      expect(String(calledInit(1).body)).toContain('application/vnd.google-apps.folder');
    });

    it('escapes quotes in the folder name so the query stays valid', async () => {
      fetchSpy.mockResolvedValue(response({ files: [{ id: 'folder-1' }] }));

      await service.getOrCreateFolder("Nico's Games", 'token');

      expect(decodeURIComponent(calledUrl())).toContain("name='Nico\\'s Games'");
    });

    it('fails when the search or the creation fails', async () => {
      fetchSpy.mockResolvedValue(response({}, false, 500));
      await expect(service.getOrCreateFolder('Folder', 'token')).rejects.toThrow('Failed to search for folder');

      fetchSpy.mockReset();
      fetchSpy.mockResolvedValueOnce(response({ files: [] })).mockResolvedValueOnce(response({}, false, 500));
      await expect(service.getOrCreateFolder('Folder', 'token')).rejects.toThrow('Failed to create folder');
    });
  });

  describe('uploadToOneDrive', () => {
    const buffer = new ArrayBuffer(8);

    it('puts the workbook at the folder path', async () => {
      fetchSpy.mockResolvedValue(response({}));

      await service.uploadToOneDrive(buffer, 'token', settings({ folderPath: 'My Bowling' }));

      expect(decodeURIComponent(calledUrl())).toContain('/me/drive/root:/My Bowling/game_data_');
      expect(calledInit().method).toBe('PUT');
      expect(calledInit().body).toBe(buffer);
    });

    it('falls back to the default folder', async () => {
      fetchSpy.mockResolvedValue(response({}));

      await service.uploadToOneDrive(buffer, 'token', settings());

      expect(decodeURIComponent(calledUrl())).toContain('Lightningbowl Game-History');
    });

    it('reports a failed upload', async () => {
      fetchSpy.mockResolvedValue(response({ error: { message: 'Quota exceeded' } }, false, 507));

      await expect(service.uploadToOneDrive(buffer, 'token', settings())).rejects.toThrow(/Quota exceeded|Failed to upload to OneDrive/);
    });
  });

  describe('uploadToDropbox', () => {
    const buffer = new ArrayBuffer(8);

    it('sends the target path in the API argument header', async () => {
      fetchSpy.mockResolvedValue(response({}));

      await service.uploadToDropbox(buffer, 'token', settings({ folderPath: 'My Bowling' }));

      const headers = calledInit().headers as Record<string, string>;
      const apiArg = JSON.parse(headers['Dropbox-API-Arg']);
      expect(apiArg.path).toMatch(/^\/My Bowling\/game_data_.*\.xlsx$/);
      expect(apiArg.mode).toBe('overwrite');
    });

    it('reports the summary Dropbox gave for refusing the upload', async () => {
      fetchSpy.mockResolvedValue(response({ error_summary: 'insufficient_space/' }, false, 507));

      await expect(service.uploadToDropbox(buffer, 'token', settings())).rejects.toThrow('insufficient_space/');
    });
  });

  // `authenticateWithProvider` is not unit-tested: the web branch assigns
  // window.location.href (navigating the test runner away) and the native
  // branch hands off to the Capacitor bridge, so both need e2e/device coverage.

  describe('getProviderDisplayName', () => {
    it('names the supported providers', () => {
      expect(service.getProviderDisplayName(CloudProvider.GOOGLE_DRIVE)).toBe('Google Drive');
      expect(service.getProviderDisplayName(CloudProvider.ONEDRIVE)).toBe('OneDrive');
      expect(service.getProviderDisplayName(CloudProvider.DROPBOX)).toBe('Dropbox');
    });

    it('falls back to the raw value for anything else', () => {
      expect(service.getProviderDisplayName('icloud' as CloudProvider)).toBe('icloud');
    });
  });
});
