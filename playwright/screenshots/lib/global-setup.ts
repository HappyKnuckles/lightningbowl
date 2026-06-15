import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { APP_STAGING_ROOT } from './constants';

/**
 * Runs once before the suite. We deliberately write NOTHING into the served
 * `src/` tree here — doing so makes `ng serve` rebuild before the first shot is
 * even taken. `app` shots are staged under APP_STAGING_ROOT during the run and
 * promoted into src/assets by global-teardown (the manifest is written there
 * too). We just start from a clean staging dir so a previous run's app shots
 * can't leak through if a shot is later removed from the registry.
 */
export default function globalSetup(): void {
  const staging = join(process.cwd(), APP_STAGING_ROOT);
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(staging, { recursive: true });
}
