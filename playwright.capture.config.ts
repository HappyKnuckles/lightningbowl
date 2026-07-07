import config from './playwright.config';

/**
 * Fixture refresh (`npm run capture:fixtures`) runs ONLY capture-fixtures.spec.ts
 * against the live API. The screenshot config's globalSetup/globalTeardown are
 * disabled: a fixture refresh must not touch src/assets/screenshots or rewrite
 * its manifest.
 */
export default {
  ...config,
  testIgnore: [],
  globalSetup: undefined,
  globalTeardown: undefined,
};
