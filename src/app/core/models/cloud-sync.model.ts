export interface CloudSyncSettings {
  connectedProvider?: CloudProvider; // which provider is connected via backend
  enabled: boolean;
  folderId?: string; // Google Drive folder ID
  folderPath?: string; // User-selectable folder path
  frequency: SyncFrequency;
  lastSyncDate?: number;
  lastSyncProvider?: CloudProvider; // which provider lastSyncDate belongs to
  nextSyncDate?: number;
  provider: CloudProvider;
}

export enum CloudProvider {
  DROPBOX = 'dropbox',
  GOOGLE_DRIVE = 'google-drive',
  ONEDRIVE = 'onedrive',
}

export enum SyncFrequency {
  DAILY = 'daily',
  MONTHLY = 'monthly',
  WEEKLY = 'weekly',
}

export interface CloudSyncStatus {
  disconnectInProgress: boolean;
  error?: string;
  isAuthenticated: boolean;
  lastSync?: Date;
  nextSync?: Date;
  syncInProgress: boolean;
}
