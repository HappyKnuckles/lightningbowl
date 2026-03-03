export interface CloudSyncSettings {
  enabled: boolean;
  provider: CloudProvider;
  frequency: SyncFrequency;
  lastSyncDate?: number;
  nextSyncDate?: number;
  connectedProvider?: CloudProvider; // which provider is connected via backend
  folderPath?: string; // User-selectable folder path
  folderId?: string; // Google Drive folder ID
}

export enum CloudProvider {
  GOOGLE_DRIVE = 'google-drive',
  ONEDRIVE = 'onedrive',
  DROPBOX = 'dropbox',
}

export enum SyncFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

export interface CloudSyncStatus {
  isAuthenticated: boolean;
  lastSync?: Date;
  nextSync?: Date;
  syncInProgress: boolean;
  disconnectInProgress: boolean;
  error?: string;
}
