/**
 * Guard for the standalone coverage pipeline (vitest.coverage.config.ts).
 *
 * That pipeline only exists because `@angular/build:unit-test` cannot report
 * coverage on Angular 20 — it passes one `include` list to a Vitest filter that
 * runs twice, once against bundled chunks and once against the remapped sources,
 * so no value satisfies both stages and the report always comes back 0/0.
 *
 * `@angular/build` 22 fixes exactly that, so the moment this repo lands on 22 the
 * parallel pipeline becomes dead weight. Rather than rely on someone remembering,
 * this check runs before every coverage run and on CI, and says so.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const FIXED_IN_MAJOR = 22;

const CLEANUP = `Angular's own builder can do this now. To retire the parallel pipeline:

  1. npm i -D @vitest/coverage-istanbul
  2. In angular.json, on the "test" target, add:
       "coverage": true,
       "coverageInclude": ["src/app/**/*.ts"],
       "coverageExclude": ["src/**/*.model.ts", "src/app/core/constants/**"],
       "coverageReporters": ["text-summary", "json-summary", "lcov"],
       "coverageThresholds": { "lines": 40 }
  3. Point "test:coverage" at \`ng test --configuration=ci\` and re-baseline the
     percentage — the Analog compile path differs, so the number will move.
  4. Update the SUMMARY constant in scripts/coverage-summary.mjs: v22 writes to
     coverage/<projectName>, i.e. coverage/app.
  5. Delete vitest.coverage.config.ts, tsconfig.coverage.json,
     src/testing/vitest-setup.ts, and the @analogjs/vite-plugin-angular + sass
     devDependencies. Drop the coverage note from CLAUDE.md > Gotchas.`;

export function coveragePipelineStatus() {
  let version;
  try {
    ({ version } = require("@angular/build/package.json"));
  } catch {
    return { obsolete: false, version: null };
  }

  const major = Number.parseInt(version, 10);
  if (!Number.isFinite(major) || major < FIXED_IN_MAJOR) {
    return { obsolete: false, version };
  }

  return {
    obsolete: true,
    version,
    headline: `@angular/build ${version} reports coverage natively — the standalone coverage pipeline is no longer needed.`,
    cleanup: CLEANUP,
  };
}

// CLI mode: informational only, never fails a build.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const status = coveragePipelineStatus();
  if (status.obsolete) {
    if (process.env.GITHUB_ACTIONS) {
      process.stdout.write(`::warning title=Coverage pipeline can be retired::${status.headline}\n`);
    }
    console.warn(`\n${status.headline}\n\n${status.cleanup}\n`);
  }
}
