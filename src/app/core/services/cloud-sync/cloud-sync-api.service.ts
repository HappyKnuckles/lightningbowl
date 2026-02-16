import { Injectable } from '@angular/core';
import { CloudProvider, CloudSyncSettings } from '../../models/cloud-sync.model';
import { environment } from 'src/environments/environment';

/**
 * Service responsible for all cloud provider API interactions (OAuth, uploads).
 */
@Injectable({
  providedIn: 'root',
})
export class CloudSyncApiService {
  /**
   * Navigate browser to OAuth start endpoint
   */
  authenticateWithProvider(provider: CloudProvider): void {
    const redirectUrl = `${window.location.origin}/auth/callback?openModal=true`;
    const startUrl = `${environment.authBackendUrl}/${provider}/start?redirect=${encodeURIComponent(redirectUrl)}`;
    window.location.href = startUrl;
  }

  /**
   * Fetch a fresh access token from the OAuth backend
   */
  async getAccessToken(provider: CloudProvider): Promise<string> {
    const response = await fetch(`${environment.authBackendUrl}/${provider}/access-token`, {
      credentials: 'include',
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 404) {
        throw new Error('Not authenticated. Please reconnect your cloud provider.');
      }
      throw new Error('Failed to retrieve access token');
    }

    const data = await response.json();
    return data.access_token;
  }

  /**
   * Revoke OAuth tokens at the backend
   */
  async disconnect(provider: CloudProvider): Promise<void> {
    const response = await fetch(`${environment.authBackendUrl}/${provider}/disconnect`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to disconnect from provider');
    }
  }

  /**
   * Upload file buffer to the configured cloud provider
   * @returns folder ID for Google Drive, undefined for other providers
   */
  async uploadFile(buffer: ArrayBuffer, provider: CloudProvider, accessToken: string, settings: CloudSyncSettings): Promise<string | undefined> {
    switch (provider) {
      case CloudProvider.GOOGLE_DRIVE:
        return await this.uploadToGoogleDrive(buffer, accessToken, settings);
      case CloudProvider.ONEDRIVE:
        await this.uploadToOneDrive(buffer, accessToken, settings);
        return undefined;
      case CloudProvider.DROPBOX:
        await this.uploadToDropbox(buffer, accessToken, settings);
        return undefined;
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  /**
   * Upload file to Google Drive
   * @returns folder ID if it was created/found
   */
  async uploadToGoogleDrive(buffer: ArrayBuffer, accessToken: string, settings: CloudSyncSettings): Promise<string | undefined> {
    const date = new Date();
    const formattedDate = date.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const fileName = `game_data_${formattedDate}.xlsx`;

    // Get or create the folder
    const folderName = settings.folderPath || 'Lightningbowl Game-History';
    const folderId = await this.getOrCreateFolder(folderName, accessToken);

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

    return folderId;
  }

  /**
   * Get or create a Google Drive folder by name
   */
  async getOrCreateFolder(folderName: string, accessToken: string): Promise<string> {
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

  /**
   * Upload file to OneDrive
   */
  async uploadToOneDrive(buffer: ArrayBuffer, accessToken: string, settings: CloudSyncSettings): Promise<void> {
    const date = new Date();
    const formattedDate = date.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
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

  /**
   * Upload file to Dropbox
   */
  async uploadToDropbox(buffer: ArrayBuffer, accessToken: string, settings: CloudSyncSettings): Promise<void> {
    const date = new Date();
    const formattedDate = date.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
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

  /**
   * Get user-friendly display name for a cloud provider
   */
  getProviderDisplayName(provider: CloudProvider): string {
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
}
