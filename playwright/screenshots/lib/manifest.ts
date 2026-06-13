import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { SCREENSHOT_ROOT } from './constants';
import { REGISTRY } from '../registry';
import type { ManifestEntry } from './types';
import { ALL_VIEWPORTS, VIEWPORTS } from './viewports';

/**
 * The registry, projected into a flat manifest of every file the system owns.
 * Written to src/assets/screenshots/manifest.json so documentation tooling /
 * humans can see exactly what exists and selectively regenerate.
 */
export function buildManifest(): ManifestEntry[] {
  return REGISTRY.map((shot) => {
    const viewports = shot.viewports ?? ALL_VIEWPORTS;
    return {
      id: shot.id,
      feature: shot.feature,
      page: shot.name,
      description: shot.description ?? '',
      seed: shot.seed ?? 'rich',
      files: viewports.map((v) => ({
        viewport: v,
        path: `${SCREENSHOT_ROOT}/${shot.feature}/${shot.name}${VIEWPORTS[v].suffix}.png`,
      })),
    };
  });
}

export function writeManifest(): string {
  const manifestPath = join(process.cwd(), SCREENSHOT_ROOT, 'manifest.json');
  mkdirSync(dirname(manifestPath), { recursive: true });
  const payload = {
    generatedFrom: 'playwright/screenshots/registry.ts',
    count: REGISTRY.length,
    viewports: VIEWPORTS,
    shots: buildManifest(),
  };
  writeFileSync(manifestPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  return relative(process.cwd(), manifestPath);
}
