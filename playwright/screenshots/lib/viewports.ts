/**
 * Viewport definitions shared between playwright.config.ts and the capture
 * pipeline. Adding a new viewport here (and a matching Playwright project) is
 * all that is required to render every screenshot at a new size.
 */
export type ViewportName = 'mobile' | 'desktop';

export interface ViewportSpec {
  /** Playwright viewport size in CSS pixels. */
  viewport: { width: number; height: number };
  /** Retina factor — higher = crisper but larger files. */
  deviceScaleFactor: number;
  /**
   * Filename suffix appended before `.png`. Mobile is the default (no suffix),
   * desktop screenshots get `_wide` per the project naming convention.
   */
  suffix: string;
}

export const VIEWPORTS: Record<ViewportName, ViewportSpec> = {
  // iPhone 15 Pro logical resolution (also matches iPhone 16). 393x852 @3x is
  // the real device, which is exactly what App Store / mobile listings expect.
  mobile: {
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    suffix: '',
  },
  // 1440x900 showcases dashboards/charts without excessive whitespace.
  desktop: {
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    suffix: '_wide',
  },
};

export const ALL_VIEWPORTS = Object.keys(VIEWPORTS) as ViewportName[];
