import { EnvironmentProviders } from '@angular/core';

// provide-api directly, not the index: this file is also loaded by the test setup (src/testing/test-providers.ts),
// which isn't AOT-compiled and can't take the index's decorated API classes
import { provideApi } from 'src/app/core/api/pattern-api/provide-api';
import { environment } from 'src/environments/environment';

/**
 * Base URL of the pattern API for the generated client (`src/app/core/api/pattern-api`, made by
 * `npm run generate:pattern-api`). Its paths already start with /api, `patternEndpoint` ends with it.
 */
export const PATTERN_API_BASE_PATH = environment.patternEndpoint.replace(/\/api\/?$/, '');

export function providePatternApi(): EnvironmentProviders {
  return provideApi(PATTERN_API_BASE_PATH);
}
