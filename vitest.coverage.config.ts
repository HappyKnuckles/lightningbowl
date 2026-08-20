/// <reference types="vitest" />
import { fileURLToPath } from 'node:url';
import angular from '@analogjs/vite-plugin-angular';
import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('.', import.meta.url));

/**
 * Line-coverage run, separate from `ng test`.
 *
 * `@angular/build:unit-test` cannot report coverage (its v8 integration collects
 * no data from the bundles it hands to Vitest), so this config drives the same
 * spec files through Vitest directly. Same browser, same providers — only the
 * compilation pipeline differs.
 */
export default defineConfig({
  root,
  plugins: [angular({ jit: true, inlineStylesExtension: 'scss', tsconfig: 'tsconfig.coverage.json' })],
  resolve: {
    alias: {
      src: fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    include: ['src/**/*.spec.ts'],
    setupFiles: ['src/testing/vitest-setup.ts'],
    browser: {
      enabled: true,
      provider: 'playwright',
      headless: true,
      screenshotFailures: false,
      instances: [{ browser: 'chromium' }],
    },
    coverage: {
      enabled: true,
      provider: 'v8',
      reportsDirectory: 'coverage',
      reporter: ['text-summary', 'json-summary', 'lcov'],
      include: ['src/app/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/**/*.model.ts', 'src/app/core/constants/**'],
      // Floor, not a target — raise it as coverage climbs so it can't silently regress.
      thresholds: { lines: 40 },
    },
  },
});
