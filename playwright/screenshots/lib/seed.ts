import type { Page } from '@playwright/test';

/**
 * Everything that must exist in browser storage before the Angular app boots.
 *  - `idb`   → Ionic Storage entries (games, leagues, arsenal)
 *  - `local` → plain localStorage (username, theme, favorites, prefs)
 *
 * Built by fixtures-data/seed-profiles.ts.
 */
export interface SeedBundle {
  idb: [string, unknown][];
  local: Record<string, string>;
}

// Ionic Storage (v4) defaults — verified against @ionic/storage's defaultConfig.
// localForage's IndexedDB driver stores each value directly via store.put(value, key)
// in DB "_ionicstorage", object store "_ionickv".
const IDB_NAME = '_ionicstorage';
const IDB_STORE = '_ionickv';

/**
 * Seed browser storage for the app origin. MUST be called while the page is on
 * a blank same-origin document (see capture.ts) so the writes land in the same
 * IndexedDB the app will read on the subsequent navigation — no race with the
 * app's own `storage.create()`.
 */
export async function applySeed(page: Page, bundle: SeedBundle): Promise<void> {
  await page.evaluate(
    async ({ idb, local, dbName, storeName }) => {
      // ---- localStorage --------------------------------------------------
      localStorage.clear();
      for (const [key, value] of Object.entries(local)) {
        localStorage.setItem(key, value);
      }

      // ---- IndexedDB (Ionic Storage / localForage layout) ----------------
      // Start from a clean DB so each shot is fully isolated.
      await new Promise<void>((resolve) => {
        const del = indexedDB.deleteDatabase(dbName);
        del.onsuccess = del.onerror = del.onblocked = () => resolve();
      });

      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const open = indexedDB.open(dbName, 1);
        open.onupgradeneeded = () => {
          const database = open.result;
          if (!database.objectStoreNames.contains(storeName)) {
            database.createObjectStore(storeName);
          }
        };
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
      });

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        for (const [key, value] of idb) store.put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      db.close();
    },
    { idb: bundle.idb, local: bundle.local, dbName: IDB_NAME, storeName: IDB_STORE },
  );
}
