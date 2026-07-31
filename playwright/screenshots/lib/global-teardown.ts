import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { APP_SCREENSHOT_ROOT, APP_STAGING_ROOT } from './constants';
import { writeManifest } from './manifest';

/**
 * Runs once after the suite. Promotes the staged `app` screenshots into
 * src/assets/screenshots and writes the manifest. Doing the src/ writes HERE —
 * after every capture is finished — is what keeps the dev server from
 * rebuilding/reloading mid-run (see global-setup + constants APP_STAGING_ROOT).
 */
export default function globalTeardown(): void {
  const staging = join(process.cwd(), APP_STAGING_ROOT);
  const dest = join(process.cwd(), APP_SCREENSHOT_ROOT);

  if (existsSync(staging) && readdirSync(staging).length > 0) {
    mkdirSync(dest, { recursive: true });
    // Merge staged feature folders into src/assets/screenshots, overwriting.
    cpSync(staging, dest, { recursive: true });
  }

  const rel = writeManifest();
  // eslint-disable-next-line no-console
  console.log(`\n📸 Screenshots promoted to ${APP_SCREENSHOT_ROOT}; manifest written to ${rel}\n`);
}
