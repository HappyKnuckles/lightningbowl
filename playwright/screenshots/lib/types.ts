import type { Page } from '@playwright/test';
import type { ViewportName } from './viewports';

/** Named, reusable data sets that can be seeded before a shot is captured. */
export type SeedProfileName = 'rich' | 'empty';

/**
 * Context handed to every per-shot `prepare`/`ready` hook. Keeps page objects
 * and helpers a single argument so registry entries stay terse.
 */
export interface ShotContext {
  page: Page;
  viewport: ViewportName;
  /** True for the wide/desktop render. */
  isWide: boolean;
}

/**
 * A single screenshot definition. This is the ONLY thing a developer needs to
 * add to cover a new screen/state — see registry.ts.
 */
export interface ShotDefinition {
  /** Stable, unique id. Used for logging and `--grep` filtering. */
  id: string;
  /** Optional grouping label for the manifest only (not part of the file path). */
  feature: string;
  /**
   * Flat file name (no extension/suffix) written under src/assets/screenshots,
   * e.g. "start" → start.png (+ start_wide.png). These names are what the PWA
   * manifest and install prompt reference, so keep them stable.
   */
  name: string;
  /** App route to navigate to, e.g. "/tabs/history". */
  route: string;
  /** Short human description shown in the registry/manifest. */
  description?: string;
  /** Which viewports to render. Defaults to all. */
  viewports?: ViewportName[];
  /** Which seed profile to load before navigating. Defaults to "rich". */
  seed?: SeedProfileName;
  /** Extra localStorage entries merged on top of the seed profile (e.g. a draft). */
  extraLocal?: Record<string, string>;
  /**
   * Optional interaction performed after the page is ready (open a modal,
   * switch a segment, type into search, …). Throw to fail the shot.
   */
  prepare?: (ctx: ShotContext) => Promise<void>;
  /**
   * Optional extra readiness wait, on top of the default app-ready waits.
   * Use for page-specific signals (charts drawn, map tiles painted, …).
   */
  ready?: (ctx: ShotContext) => Promise<void>;
  /** Capture the full scrollable page instead of just the viewport. */
  fullPage?: boolean;
  /** Clip to a specific element selector instead of the whole viewport. */
  clip?: string;
}

/** Entry written to the generated manifest after a successful run. */
export interface ManifestEntry {
  id: string;
  feature: string;
  page: string;
  description: string;
  seed: SeedProfileName;
  files: { viewport: ViewportName; path: string }[];
}
