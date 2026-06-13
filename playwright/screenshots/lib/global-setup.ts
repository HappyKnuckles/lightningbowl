import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { SCREENSHOT_ROOT } from './constants';
import { writeManifest } from './manifest';

/**
 * Runs once before the screenshot suite. Ensures the output root exists and
 * regenerates the manifest from the registry so it never drifts.
 */
export default function globalSetup(): void {
  mkdirSync(join(process.cwd(), SCREENSHOT_ROOT), { recursive: true });
  const rel = writeManifest();
  // eslint-disable-next-line no-console
  console.log(`\n📸 Screenshot manifest written to ${rel}\n`);
}
